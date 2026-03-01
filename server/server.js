// server.js — Express backend
// Handles: Cloudinary uploads, Google Vision OCR
// Run with: node server.js

const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { google } = require("googleapis");
const { ImageAnnotatorClient } = require("@google-cloud/vision");
const cloudinary = require("cloudinary").v2;
const path = require("path");

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || /^http:\/\/localhost(:\d+)?$/.test(origin) || origin.includes("github.io")) {
      callback(null, true);
    } else if (process.env.CLIENT_ORIGIN && process.env.CLIENT_ORIGIN.split(",").includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS blocked: " + origin));
    }
  },
  credentials: true
}));
app.use(express.json());

// ─── Cloudinary config ────────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "db2ixn8zh",
  api_key:    process.env.CLOUDINARY_API_KEY    || "421469929622667",
  api_secret: process.env.CLOUDINARY_API_SECRET || "ImgKNZvnbCD5RFOKk3StMtxgtZo",
});

// ─── Google Auth (Vision OCR only) ───────────────────────────────────────────
function getAuth() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;

  let credentials;

  if (keyJson) {
    // Railway: env var contains the raw JSON string
    try {
      credentials = JSON.parse(keyJson);
    } catch (e) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON: " + e.message);
    }
  } else if (keyPath) {
    // Local: env var contains path to key file
    const fs = require("fs");
    const resolved = path.resolve(keyPath);
    if (!fs.existsSync(resolved)) {
      throw new Error("key file not found at: " + resolved);
    }
    credentials = JSON.parse(fs.readFileSync(resolved, "utf8"));
  } else {
    throw new Error(
      "No credentials found. Set GOOGLE_SERVICE_ACCOUNT_JSON (Railway) " +
      "or GOOGLE_SERVICE_ACCOUNT_KEY_PATH (local)."
    );
  }

  // Fix private_key newlines that may get mangled in env vars
  if (credentials.private_key) {
    credentials.private_key = credentials.private_key.replace(/\n/g, "\n");
  }

  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/cloud-vision"],
  });
}

// ─── POST /api/drive/upload — Cloudinary ─────────────────────────────────────
app.post("/api/drive/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file provided" });

    const { folderId, fileName } = req.body;
    const folder = folderId ? `wandersplit/${folderId}` : "wandersplit";
    const publicId = `${folder}/${Date.now()}`;

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { public_id: publicId, resource_type: "image", overwrite: false },
        (error, result) => error ? reject(error) : resolve(result)
      );
      stream.end(req.file.buffer);
    });

    res.json({ fileId: result.public_id, imageUrl: result.secure_url });
  } catch (err) {
    console.error("Cloudinary upload error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ─── DELETE /api/drive/file/:fileId — Cloudinary ─────────────────────────────
app.delete("/api/drive/file/:fileId(*)", async (req, res) => {
  try {
    const fileId = decodeURIComponent(req.params.fileId);
    await cloudinary.uploader.destroy(fileId, { resource_type: "image" });
    res.json({ success: true });
  } catch (err) {
    console.error("Cloudinary delete error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ─── POST /api/drive/folder — no-op for Cloudinary ───────────────────────────
app.post("/api/drive/folder", async (req, res) => {
  res.json({ folderId: req.body.name || "wandersplit" });
});

// ─── POST /api/ocr/receipt — Google Vision ───────────────────────────────────
app.post("/api/ocr/receipt", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file provided" });

    const auth = getAuth();
    const client = new ImageAnnotatorClient({ authClient: await auth.getClient() });
    const [result] = await client.textDetection({
      image: { content: req.file.buffer.toString("base64") },
    });

    const rawText = result.fullTextAnnotation?.text || "";
    if (!rawText) return res.json({ restaurantName: null, date: null, totalAmount: null, items: [], rawText: "" });

    const lines = rawText.split("\n").map(l => l.trim()).filter(Boolean);
    const restaurantName = lines[0] || null;

    const dateRegex = /(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})|(\d{4}[\/-]\d{2}[\/-]\d{2})/;
    const dateLine = lines.find(l => dateRegex.test(l));
    let date = null;
    if (dateLine) {
      const match = dateLine.match(dateRegex);
      if (match) {
        const raw = match[0];
        const parts = raw.split(/[\/-]/);
        if (parts.length === 3) {
          if (parts[0].length === 4) date = raw.replace(/\//g, "-");
          else if (parts[2].length === 4) date = `${parts[2]}-${parts[1].padStart(2,"0")}-${parts[0].padStart(2,"0")}`;
          else date = `${new Date().getFullYear()}-${parts[0].padStart(2,"0")}-${parts[1].padStart(2,"0")}`;
        }
      }
    }

    const totalRegex = /(total|amount due|grand total|subtotal)[^\d]*(\d+[\.,]\d{2})/i;
    let totalAmount = null;
    for (const line of lines) {
      const match = line.match(totalRegex);
      if (match) { totalAmount = parseFloat(match[2].replace(",", ".")); break; }
    }
    if (!totalAmount) {
      const allAmounts = [...rawText.matchAll(/\$?\s*(\d+\.\d{2})/g)].map(m => parseFloat(m[1]));
      if (allAmounts.length) totalAmount = Math.max(...allAmounts);
    }

    const itemRegex = /^(.+?)\s+\$?(\d+\.\d{2})$/;
    const skipKeywords = /total|tax|tip|service|discount|change|cash|card|subtotal/i;
    const items = [];
    for (const line of lines) {
      if (skipKeywords.test(line)) continue;
      const match = line.match(itemRegex);
      if (match) {
        const name = match[1].trim();
        const price = parseFloat(match[2]);
        if (name.length > 1 && price > 0) items.push({ name, price });
      }
    }

    res.json({ restaurantName, date, totalAmount, items, rawText });
  } catch (err) {
    console.error("Vision OCR error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ─── Health ───────────────────────────────────────────────────────────────────
app.get("/health", (req, res) => res.json({ status: "ok", storage: "cloudinary" }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
