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

    // ── Detect receipt language ───────────────────────────────────────────────
    const hasJapanese = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(rawText);
    const hasYen = /[¥￥]/.test(rawText);
    const isJpReceipt = hasJapanese || hasYen;

    // ── Restaurant name ───────────────────────────────────────────────────────
    const skipNameLine = /^(\d{2,}|tel|fax|http|www|〒|\+|[0-9\-（）()]{7,})/i;
    const restaurantName = lines.find(l => l.length >= 2 && !skipNameLine.test(l)) || lines[0] || null;

    // ── Date ──────────────────────────────────────────────────────────────────
    let date = null;
    for (const line of lines) {
      if (date) break;
      // Japanese: 2019年7月18日 or 2019年7月18日(木)
      const jpDate = line.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})/);
      if (jpDate) {
        date = `${jpDate[1]}-${jpDate[2].padStart(2,"0")}-${jpDate[3].padStart(2,"0")}`;
        break;
      }
      // Western: 2019-07-18 or 18/07/2019
      const enDate = line.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})|(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
      if (enDate) {
        if (enDate[1]) {
          date = `${enDate[1]}-${enDate[2].padStart(2,"0")}-${enDate[3].padStart(2,"0")}`;
        } else {
          date = `${enDate[6]}-${enDate[5].padStart(2,"0")}-${enDate[4].padStart(2,"0")}`;
        }
        break;
      }
    }

    // Helper: parse yen amount handling OCR artifacts like "¥28, 000外" or "¥1, 3609+"
    function parseYen(str) {
      const m = str.match(/[¥￥]\s*([\d,\s]+)/);
      if (!m) return null;
      const val = parseFloat(m[1].replace(/[\s,]/g, "").replace(/[^\d]/g, ""));
      return isNaN(val) || val <= 0 ? null : val;
    }

    // ── Total amount ──────────────────────────────────────────────────────────
    let totalAmount = null;

    if (isJpReceipt) {
      // Priority 1: actual payment line (お約/現計)
      for (const line of lines) {
        if (!/お\s*[約計]|現\s*計|お支払/.test(line)) continue;
        const val = parseYen(line);
        if (val) { totalAmount = val; break; }
        // Price may be on next line
        const nextLine = lines[lines.indexOf(line) + 1] || "";
        const val2 = parseYen(nextLine);
        if (val2) { totalAmount = val2; break; }
      }
      // Priority 2: 合計
      if (!totalAmount) {
        for (const line of lines) {
          if (!/合\s*計/.test(line)) continue;
          const val = parseYen(line);
          if (val) { totalAmount = val; break; }
          const nextLine = lines[lines.indexOf(line) + 1] || "";
          const val2 = parseYen(nextLine);
          if (val2) { totalAmount = val2; break; }
        }
      }
    } else {
      // English receipt
      for (const line of lines) {
        const m = line.match(/(?:grand\s+total|amount\s+due|total)[^\d]*([\d,]+(?:\.\d{2})?)/i);
        if (m) { totalAmount = parseFloat(m[1].replace(/,/g,"")); break; }
      }
    }
    // Fallback: largest ¥ amount
    if (!totalAmount) {
      const allNums = hasYen
        ? lines.map(l => parseYen(l)).filter(n => n && n > 0)
        : [...rawText.matchAll(/\$?\s*(\d+\.\d{2})/g)].map(m => parseFloat(m[1]));
      if (allNums.length) totalAmount = Math.max(...allNums);
    }

    // ── Items ─────────────────────────────────────────────────────────────────
    const items = [];

    if (isJpReceipt) {
      // Helper: extract yen amount handling OCR artifacts
      // "¥28, 00094"→28000  "¥7809+"→780  "¥1,3609"→1360  "¥38,397"→38397
      function extractYen(str) {
        const m = str.match(/[¥￥]\s*([\d,\s]+)/);
        if (!m) return null;
        const groups = m[1].trim().split(/[\s,]+/).filter(g => /^\d+$/.test(g));
        if (groups.length === 0) return null;

        if (groups.length === 1) {
          // Single number: strip trailing OCR junk digit (only if it follows a 0)
          let n = groups[0];
          for (let i = 0; i < 2; i++) {
            if (n.length <= 1) break;
            if (n.slice(-1) !== "0") {
              const c = n.slice(0, -1);
              if (c.slice(-1) === "0") { n = c; } else break;
            } else break;
          }
          return parseInt(n) || null;
        }

        // Comma-separated thousands groups
        let last = groups[groups.length - 1];
        if (last.startsWith("0")) {
          // e.g. "00094" → real thousands digits are the leading zeros → "000"
          last = (last.match(/^(0*)/)[1] + "000").slice(0, 3);
        } else if (last.length > 3) {
          last = last.slice(0, 3); // truncate OCR junk beyond 3 digits
        }
        groups[groups.length - 1] = last;
        return parseInt(groups.join("")) || null;
      }

      // Helper: find yen price in a line or the next few lines
      function findPriceNearby(lineIdx) {
        // Check current line and up to 2 following lines for a ¥ amount
        for (let offset = 0; offset <= 2; offset++) {
          const l = lines[lineIdx + offset] || "";
          const val = extractYen(l);
          if (val !== null) return { price: val, skipLines: offset };
        }
        return null;
      }

      const consumed = new Set(); // track line indices already used as price lines

      for (let i = 0; i < lines.length; i++) {
        if (consumed.has(i)) continue;
        const line = lines[i];

        // Only pick lines starting with * or ＊ — actual ordered items
        if (!/^[＊*]/.test(line)) continue;

        const name = line.replace(/^[＊*]\s*/, "").trim();
        if (name.length < 1) continue;

        // Try to find price on same line first
        let price = extractYen(line);
        if (price) {
          items.push({ name, price });
        } else {
          // Price is on a following line (may have @qty line in between)
          const result = findPriceNearby(i + 1);
          if (result) {
            items.push({ name, price: result.price });
            // Mark the price line as consumed
            consumed.add(i + 1 + result.skipLines);
          }
        }
      }
    } else {
      // English receipt: "Item name   $12.34"
      const skipItemLine = /total|tax|tip|service|discount|change|cash|card|subtotal/i;
      for (const line of lines) {
        if (skipItemLine.test(line)) continue;
        const m = line.match(/^(.+?)\s+\$?([\d,]+\.\d{2})$/);
        if (m) {
          const name = m[1].trim();
          const price = parseFloat(m[2].replace(/,/g, ""));
          if (name.length > 1 && price > 0) items.push({ name, price });
        }
      }
    }

    // Debug: log first 20 lines to see actual OCR characters
    console.log("OCR lines sample:", lines.slice(0, 20).map(l => JSON.stringify(l)).join("\n"));
    console.log("Items found:", items.length);

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
