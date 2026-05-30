const express = require("express");
const multer = require("multer");
const minioClient = require("../storage/minio");
const pool = require("../db/db");
const { v4: uuidv4 } = require("uuid");
const authMiddleware = require("../middleware/auth.middleware");

const router = express.Router();
const upload = multer({
  dest: "uploads/",
});

router.post(
  "/upload",
  authMiddleware,
  upload.single("file"),
  async (req, res) => {
    try {
      const file = req.file;
      await minioClient.fPutObject("files", file.filename, file.path, {
        "Content-Type": file.mimetype,
      });

      const fileId = uuidv4();

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
        [fileId, file.originalname, file.filename, req.user.id],
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

    const stream = await minioClient.getObject("files", file.storage_path);

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
      "files",
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

    const token = uuidv4();

    await pool.query(
      `
        INSERT INTO shared_links
        (
          file_id,
          share_token
        )
        VALUES
        (
          $1,
          $2
        )
        `,
      [fileId, token],
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

    const result = await pool.query(
      `
        SELECT
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

    const previewUrl = await minioClient.presignedGetObject(
      "files",
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

    await minioClient.removeObject("files", file.storage_path);

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
