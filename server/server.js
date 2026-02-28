// server.js — Express backend
// Handles: Google Drive uploads, Google Vision OCR
// Run with: node server.js
// Required env vars: GOOGLE_SERVICE_ACCOUNT_KEY_PATH or GOOGLE_SERVICE_ACCOUNT_JSON

const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { google } = require("googleapis");
const { ImageAnnotatorClient } = require("@google-cloud/vision");
const path = require("path");
const stream = require("stream");

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json());

// ─── Auth ──────────────────────────────────────────────────────────────────────
function getAuth() {
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  let credentials;
  if (keyJson) {
    credentials = JSON.parse(keyJson);
  } else if (keyPath) {
    credentials = require(path.resolve(keyPath));
  } else {
    throw new Error("No Google Service Account credentials found. Set GOOGLE_SERVICE_ACCOUNT_KEY_PATH or GOOGLE_SERVICE_ACCOUNT_JSON");
  }

  return new google.auth.GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/cloud-vision",
    ],
  });
}

// ─── Google Drive ──────────────────────────────────────────────────────────────

/**
 * POST /api/drive/upload
 * Upload a file to Google Drive and make it publicly readable.
 * Body: multipart/form-data { file, folderId, fileName? }
 * Returns: { fileId, imageUrl }
 */
app.post("/api/drive/upload", upload.single("file"), async (req, res) => {
  try {
    const { folderId, fileName } = req.body;
    if (!req.file) return res.status(400).json({ message: "No file provided" });
    if (!folderId) return res.status(400).json({ message: "folderId is required" });

    const auth = getAuth();
    const drive = google.drive({ version: "v3", auth });

    const fileMetadata = {
      name: fileName || `${Date.now()}_${req.file.originalname}`,
      parents: [folderId],
    };

    const bufferStream = new stream.PassThrough();
    bufferStream.end(req.file.buffer);

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: {
        mimeType: req.file.mimetype,
        body: bufferStream,
      },
      fields: "id, name",
    });

    const fileId = response.data.id;

    // Make file publicly readable
    await drive.permissions.create({
      fileId,
      requestBody: { role: "reader", type: "anyone" },
    });

    const imageUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;

    res.json({ fileId, imageUrl });
  } catch (err) {
    console.error("Drive upload error:", err);
    res.status(500).json({ message: err.message });
  }
});

/**
 * DELETE /api/drive/file/:fileId
 * Delete a file from Google Drive.
 */
app.delete("/api/drive/file/:fileId", async (req, res) => {
  try {
    const { fileId } = req.params;
    const auth = getAuth();
    const drive = google.drive({ version: "v3", auth });
    await drive.files.delete({ fileId });
    res.json({ success: true });
  } catch (err) {
    console.error("Drive delete error:", err);
    res.status(500).json({ message: err.message });
  }
});

/**
 * POST /api/drive/folder
 * Create a folder in Google Drive.
 * Body: { name, parentFolderId }
 * Returns: { folderId }
 */
app.post("/api/drive/folder", async (req, res) => {
  try {
    const { name, parentFolderId } = req.body;
    const auth = getAuth();
    const drive = google.drive({ version: "v3", auth });

    const fileMetadata = {
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentFolderId ? { parents: [parentFolderId] } : {}),
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      fields: "id",
    });

    res.json({ folderId: response.data.id });
  } catch (err) {
    console.error("Drive folder create error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ─── Google Vision OCR ─────────────────────────────────────────────────────────

/**
 * POST /api/ocr/receipt
 * Analyze a receipt image using Google Vision API.
 * Body: multipart/form-data { file }
 * Returns: { restaurantName, date, totalAmount, items: [{ name, price }], rawText }
 */
app.post("/api/ocr/receipt", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file provided" });

    const auth = getAuth();
    const client = new ImageAnnotatorClient({ authClient: await auth.getClient() });

    const [result] = await client.textDetection({
      image: { content: req.file.buffer.toString("base64") },
    });

    const rawText = result.fullTextAnnotation?.text || "";

    if (!rawText) {
      return res.json({ restaurantName: null, date: null, totalAmount: null, items: [], rawText: "" });
    }

    // ── Parse the raw OCR text ────────────────────────────────────────────────
    const lines = rawText.split("\n").map(l => l.trim()).filter(Boolean);

    // Restaurant name: often first non-empty line or line with address keywords skipped
    const restaurantName = lines[0] || null;

    // Date: look for date patterns
    const dateRegex = /(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})|(\d{4}[\/-]\d{2}[\/-]\d{2})/;
    const dateLine = lines.find(l => dateRegex.test(l));
    let date = null;
    if (dateLine) {
      const match = dateLine.match(dateRegex);
      if (match) {
        const raw = match[0];
        // Try to normalize to YYYY-MM-DD
        const parts = raw.split(/[\/-]/);
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            date = raw.replace(/\//g, "-");
          } else if (parts[2].length === 4) {
            date = `${parts[2]}-${parts[1].padStart(2,"0")}-${parts[0].padStart(2,"0")}`;
          } else {
            const year = new Date().getFullYear();
            date = `${year}-${parts[0].padStart(2,"0")}-${parts[1].padStart(2,"0")}`;
          }
        }
      }
    }

    // Total amount: look for TOTAL / GRAND TOTAL / AMOUNT DUE patterns
    const totalRegex = /(total|amount due|grand total|subtotal)[^\d]*(\d+[\.,]\d{2})/i;
    let totalAmount = null;
    for (const line of lines) {
      const match = line.match(totalRegex);
      if (match) {
        totalAmount = parseFloat(match[2].replace(",", "."));
        break;
      }
    }
    // Fallback: last dollar amount in text
    if (!totalAmount) {
      const allAmounts = [...rawText.matchAll(/\$?\s*(\d+\.\d{2})/g)].map(m => parseFloat(m[1]));
      if (allAmounts.length) totalAmount = Math.max(...allAmounts);
    }

    // Items: look for lines with a price at the end
    const itemRegex = /^(.+?)\s+\$?(\d+\.\d{2})$/;
    const skipKeywords = /total|tax|tip|service|discount|change|cash|card|subtotal/i;
    const items = [];
    for (const line of lines) {
      if (skipKeywords.test(line)) continue;
      const match = line.match(itemRegex);
      if (match) {
        const name = match[1].trim();
        const price = parseFloat(match[2]);
        if (name.length > 1 && price > 0) {
          items.push({ name, price });
        }
      }
    }

    res.json({ restaurantName, date, totalAmount, items, rawText });
  } catch (err) {
    console.error("Vision OCR error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ─── Health ────────────────────────────────────────────────────────────────────
app.get("/health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
