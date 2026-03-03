// server.js — Express backend
// Handles: Cloudinary uploads, Google Vision OCR
// Run with: node server.js

const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { google } = require("googleapis");
const { ImageAnnotatorClient } = require("@google-cloud/vision");
const cloudinary = require("cloudinary").v2;
const webpush = require("web-push");
const admin = require("firebase-admin");
const path = require("path");

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

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

// ─── Web Push config ─────────────────────────────────────────────────────────
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || "mailto:admin@matetrip.app",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// ─── Firebase Admin init ─────────────────────────────────────────────────────
let db = null;
try {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  let credential;
  if (keyJson) {
    credential = admin.credential.cert(JSON.parse(keyJson));
  } else if (keyPath) {
    credential = admin.credential.cert(require("path").resolve(keyPath));
  }
  if (credential && !admin.apps.length) {
    admin.initializeApp({ credential });
    db = admin.firestore();
    console.log("Firebase Admin initialized");
  }
} catch (e) {
  console.warn("Firebase Admin init failed:", e.message);
}

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
        { public_id: publicId, resource_type: "auto", overwrite: false },
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
    const skipLine = /合計|小計|サービス|消費税|内税|外税|お釣|現金|領収|伝票|テーブル|No\.|合計点数|tip|total|tax|service|discount|subtotal/i;
    const totalLine = /合\s*計|お会計|現計|お\s*[約計]|お支払/;

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

      // Helper: detect OCR garbage names (no recognizable letters)
      function isGarbage(name) {
        return name.length < 1 || (
          !/[a-zA-Z\u3040-\u30ff\u4e00-\u9fff]/.test(name) && name.length < 3
        );
      }

      // Collect item names and prices in parallel order, then zip them.
      // This handles scrambled OCR line order better than sequential matching.
      const itemNames = [];
      const itemPrices = [];

      for (const line of lines) {
        // Item names: lines starting with * / ＊
        if (/^[＊*]/.test(line) && !skipLine.test(line)) {
          const name = line.replace(/^[＊*]\s*/, "").trim();
          if (!isGarbage(name)) itemNames.push(name);
        }
        // Item prices: ¥ lines that are NOT totals or tax/service lines
        if (!totalLine.test(line) && !skipLine.test(line)) {
          const val = extractYen(line);
          if (val !== null) itemPrices.push(val);
        }
      }

      // Zip names and prices (trim to shorter list)
      const count = Math.min(itemNames.length, itemPrices.length);
      for (let i = 0; i < count; i++) {
        items.push({ name: itemNames[i], price: itemPrices[i] });
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

// ─── POST /api/push/subscribe ────────────────────────────────────────────────
app.post("/api/push/subscribe", async (req, res) => {
  const { subscription, tripId, userId } = req.body;
  if (!subscription || !tripId || !userId) {
    return res.status(400).json({ message: "Missing subscription, tripId or userId" });
  }
  try {
    if (db) {
      // Save to Firestore — persists across Railway restarts
      await db.collection("pushSubscriptions").doc(`${tripId}_${userId}`).set({
        tripId, userId, subscription, updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`Push subscription saved to Firestore: trip=${tripId} user=${userId}`);
    } else {
      return res.status(500).json({ message: "Firestore not available" });
    }
    res.json({ success: true });
  } catch (e) {
    console.error("Subscribe error:", e);
    res.status(500).json({ message: e.message });
  }
});

// ─── POST /api/push/send ─────────────────────────────────────────────────────
app.post("/api/push/send", async (req, res) => {
  const { tripId, senderUserId, senderName, message } = req.body;
  if (!tripId || !message) {
    return res.status(400).json({ message: "Missing tripId or message" });
  }
  if (!db) return res.status(500).json({ message: "Firestore not available" });

  try {
    // Load all subscriptions for this trip from Firestore
    const snap = await db.collection("pushSubscriptions")
      .where("tripId", "==", tripId)
      .get();

    const subs = snap.docs
      .map(d => d.data())
      .filter(s => s.userId !== senderUserId);

    if (subs.length === 0) return res.json({ sent: 0 });

    const payload = JSON.stringify({
      title: senderName || "MateTrip",
      body: message,
      url: "/trip/",
    });

    let sent = 0;
    const deadDocs = [];

    await Promise.allSettled(
      subs.map(async ({ userId, subscription }) => {
        try {
          await webpush.sendNotification(subscription, payload);
          sent++;
        } catch (err) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            deadDocs.push(`${tripId}_${userId}`);
          }
          console.warn(`Push failed for user ${userId}:`, err.statusCode || err.message);
        }
      })
    );

    // Clean up expired subscriptions from Firestore
    if (deadDocs.length > 0) {
      const batch = db.batch();
      deadDocs.forEach(id => batch.delete(db.collection("pushSubscriptions").doc(id)));
      await batch.commit();
    }

    console.log(`Push sent: trip=${tripId} sent=${sent}/${subs.length}`);
    res.json({ sent, total: subs.length });
  } catch (e) {
    console.error("Send push error:", e);
    res.status(500).json({ message: e.message });
  }
});

// ─── Health ───────────────────────────────────────────────────────────────────
app.get("/health", (req, res) => res.json({ status: "ok", storage: "cloudinary" }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
