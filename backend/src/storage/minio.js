require("dotenv").config();

const Minio = require("minio");

const minioClient = new Minio.Client({
  endPoint: process.env.B2_ENDPOINT,
  accessKey: process.env.B2_ACCESS_KEY_ID,
  secretKey: process.env.B2_SECRET_ACCESS_KEY,
  useSSL: true,
});

module.exports = minioClient;
