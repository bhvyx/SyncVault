const express = require("express");
const pool = require("./db/db");
const minioClient = require("./storage/minio");
const fileRoutes = require("./routes/file.routes");
const authRoutes = require("./routes/auth.routes");

const app = express();
app.use(express.json());
app.use("/files", fileRoutes);
app.use("/auth", authRoutes);

app.get("/status", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");

    res.json({
      status: "ok",
      time: result.rows[0],
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      status: "error",
    });
  }
});

app.get("/storage-status", async (req, res) => {
  try {
    const buckets = await minioClient.listBuckets();

    res.json({
      status: "ok",
      buckets,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      status: "error",
    });
  }
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
