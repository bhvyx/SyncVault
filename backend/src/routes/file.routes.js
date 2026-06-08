const express = require("express");
const multer = require("multer");
const minioClient = require("../storage/minio");
const pool = require("../db/db");
const { v4: uuidv4 } = require("uuid");
const authMiddleware = require("../middleware/auth.middleware");

require("dotenv").config();

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

router.post(
  "/upload",
  authMiddleware,
  upload.single("file"),
  async (req, res) => {
    try {
      const file = req.file;

      const fileCountResult = await pool.query(
        `
        SELECT COUNT(*)
        FROM files
        WHERE user_id = $1
        `,
        [req.user.id],
      );

      const fileCount = Number(fileCountResult.rows[0].count);

      if (fileCount >= 15) {
        return res.status(403).json({
          error: "Maximum file limit (15) reached",
        });
      }

      const fileId = uuidv4();

      await minioClient.putObject(
        process.env.B2_BUCKET_NAME,
        fileId,
        file.buffer,
        file.size,
        {
          "Content-Type": file.mimetype,
        },
      );

      await pool.query(
        `
        INSERT INTO files (
            id,
            file_name,
            storage_path,
            user_id
        )
        VALUES ($1, $2, $3, $4)
    `,
        [fileId, file.originalname, fileId, req.user.id],
      );

      const versionId = uuidv4();

      await pool.query(
        `
        INSERT INTO versions (
        id,
        file_id,
        version_number
        )
        VALUES ($1, $2, $3)
    `,
        [versionId, fileId, 1],
      );

      res.json({
        message: "File uploaded successfully",
        fileName: file.filename,
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Upload failed",
      });
    }
  },
);

router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const fileId = req.params.id;

    const result = await pool.query(
      `
        SELECT * FROM files
        WHERE id = $1
        AND user_id = $2
      `,
      [fileId, req.user.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "File not found",
      });
    }

    const file = result.rows[0];

    const stream = await minioClient.getObject(
      process.env.B2_BUCKET_NAME,
      file.storage_path,
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${file.file_name}"`,
    );

    stream.pipe(res);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Download failed",
    });
  }
});

router.get("/sync/:timestamp", authMiddleware, async (req, res) => {
  try {
    const timestamp = req.params.timestamp;

    const result = await pool.query(
      `
        SELECT *
        FROM files
        WHERE created_at > $1
        AND user_id = $2
      `,
      [timestamp, req.user.id],
    );

    res.json({
      updatedFiles: result.rows,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Sync failed",
    });
  }
});

router.get("/view/:id", authMiddleware, async (req, res) => {
  try {
    const fileId = req.params.id;

    const result = await pool.query(
      `
        SELECT *
        FROM files
        WHERE id = $1
        AND user_id = $2
        `,
      [fileId, req.user.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "File not found",
      });
    }

    const file = result.rows[0];

    const url = await minioClient.presignedGetObject(
      process.env.B2_BUCKET_NAME,
      file.storage_path,
      60 * 5,
    );

    res.json({
      previewUrl: url,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Preview failed",
    });
  }
});

router.post("/:id/share", authMiddleware, async (req, res) => {
  try {
    const fileId = req.params.id;

    const result = await pool.query(
      `
        SELECT *
        FROM files
        WHERE id = $1
        AND user_id = $2
        `,
      [fileId, req.user.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "File not found",
      });
    }

    const linksResult = await pool.query(
      `
    SELECT COUNT(*)
    FROM shared_links
    WHERE file_id = $1
    `,
      [fileId],
    );

    const linkCount = Number(linksResult.rows[0].count);

    if (linkCount >= 10) {
      return res.status(403).json({
        error: "Maximum share link limit (10) reached for this file",
      });
    }

    const token = uuidv4();

    const { expiryHours, isOneTime } = req.body;
    let expiresAt = null;
    if (expiryHours) {
      expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
    }

    await pool.query(
      `
        INSERT INTO shared_links
        (
          file_id,
          share_token,
          expires_at, 
          is_one_time
        )
        VALUES
        (
          $1,
          $2,
          $3,
          $4
        )
        `,
      [fileId, token, expiresAt, isOneTime || false],
    );

    res.json({
      shareUrl: `http://localhost:5173/share/${token}`,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Share failed",
    });
  }
});

router.get("/share/:token", async (req, res) => {
  try {
    const token = req.params.token;
    const consume = req.query.consume === "true";

    const result = await pool.query(
      `
       SELECT
          sl.*,
          f.*
        FROM shared_links sl
        JOIN files f
          ON sl.file_id = f.id
        WHERE sl.share_token = $1
        `,
      [token],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Invalid link",
      });
    }

    const file = result.rows[0];
    if (file.expires_at && new Date() > new Date(file.expires_at)) {
      return res.status(410).json({
        error: "Link expired",
      });
    }

    if (file.is_revoked) {
      return res.status(410).json({
        error: "Link revoked",
      });
    }

    if (file.is_one_time && file.is_used) {
      return res.status(410).json({
        error: "Link already used",
      });
    }

    if (!consume) {
      return res.json({
        fileName: file.file_name,
        isOneTime: file.is_one_time,
      });
    }

    if (consume && file.is_one_time) {
      await pool.query(
        `
    UPDATE shared_links
    SET is_used = TRUE
    WHERE share_token = $1
    `,
        [token],
      );
    }

    const previewUrl = await minioClient.presignedGetObject(
      process.env.B2_BUCKET_NAME,
      file.storage_path,
      60,
    );

    res.json({
      previewUrl,
      fileName: file.file_name,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Share link failed",
    });
  }
});

router.get("/:id/share-links", authMiddleware, async (req, res) => {
  try {
    const fileId = req.params.id;

    const result = await pool.query(
      `
      SELECT
        id,
        share_token,
        expires_at,
        is_one_time,
        is_used,
        is_revoked,
        created_at
      FROM shared_links
      WHERE file_id = $1
      ORDER BY created_at DESC
      `,
      [fileId],
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Failed to fetch links",
    });
  }
});

router.patch("/share-links/:id/revoke", authMiddleware, async (req, res) => {
  try {
    const linkId = req.params.id;

    const userId = req.user.id;

    const result = await pool.query(
      `
        UPDATE shared_links sl
        SET is_revoked = TRUE
        FROM files f
        WHERE sl.file_id = f.id
        AND sl.id = $1
        AND f.user_id = $2
        RETURNING sl.id
        `,
      [linkId, userId],
    );

    if (result.rows.length === 0) {
      return res.status(403).json({
        error: "Not authorized",
      });
    }

    res.json({
      success: true,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Failed to revoke link",
    });
  }
});

router.delete("/share-links/:id", authMiddleware, async (req, res) => {
  try {
    const linkId = req.params.id;

    const result = await pool.query(
      `
        DELETE FROM shared_links sl
        USING files f
        WHERE sl.file_id = f.id
        AND sl.id = $1
        AND f.user_id = $2
        AND sl.is_revoked = TRUE
        RETURNING sl.id
      `,
      [linkId, req.user.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Revoked link not found",
      });
    }

    res.json({
      message: "Link deleted successfully",
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Delete link failed",
    });
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const fileId = req.params.id;

    const result = await pool.query(
      `
        SELECT *
        FROM files
        WHERE id = $1
        AND user_id = $2
        `,
      [fileId, req.user.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "File not found",
      });
    }

    const file = result.rows[0];

    await minioClient.removeObject(
      process.env.B2_BUCKET_NAME,
      file.storage_path,
    );

    await pool.query(
      `
        DELETE FROM files
        WHERE id = $1
        `,
      [fileId],
    );

    res.json({
      message: "File deleted successfully",
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Delete failed",
    });
  }
});

module.exports = router;
