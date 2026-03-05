// ── admin.js ─────────────────────────────────────────────────────────────────
// Add this file to your Railway backend as routes/admin.js
// Then in your main server.js: app.use("/api/admin", require("./routes/admin"));
//
// Required env vars on Railway (already set):
//   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
//
// Required npm package (already installed if you use firebase-admin for push):
//   npm install firebase-admin

const express = require("express");
const router  = express.Router();
const admin   = require("firebase-admin");

// Re-use existing admin app if already initialized
let adminApp;
try {
  adminApp = admin.app();
} catch {
  adminApp = admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    }),
  });
}

const adminAuth = admin.auth(adminApp);
const adminDb   = admin.firestore(adminApp);

// ── Simple admin key check ───────────────────────────────────────────────────
// Set ADMIN_SECRET in Railway env vars — use a long random string
const checkSecret = (req, res, next) => {
  const secret = req.headers["x-admin-secret"];
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
};

// ── DELETE USER ──────────────────────────────────────────────────────────────
// DELETE /api/admin/user/:uid
router.delete("/user/:uid", checkSecret, async (req, res) => {
  const { uid } = req.params;
  try {
    // 1. Delete from Firebase Auth
    await adminAuth.deleteUser(uid);

    // 2. Delete from usernames collection
    await adminDb.collection("usernames").doc(uid).delete();

    // 3. Remove from any trips they're a member of
    const tripsSnap = await adminDb.collection("trips")
      .where("memberIds", "array-contains", uid).get();
    const batch = adminDb.batch();
    tripsSnap.docs.forEach(doc => {
      batch.update(doc.ref, {
        memberIds: admin.firestore.FieldValue.arrayRemove(uid),
      });
    });
    await batch.commit();

    res.json({ success: true, uid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CHANGE PASSWORD ──────────────────────────────────────────────────────────
// POST /api/admin/user/:uid/password
// Body: { newPassword: "..." }
router.post("/user/:uid/password", checkSecret, async (req, res) => {
  const { uid } = req.params;
  const { newPassword } = req.body || {};

  console.log("[admin] change password for uid:", uid, "| body:", req.body);

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  try {
    // Get current user to check providers
    const userRecord = await adminAuth.getUser(uid);
    const providers = userRecord.providerData.map(p => p.providerId);
    console.log("[admin] providers for uid", uid, ":", providers);

    // Update password — works for email/password users AND adds password to Google users
    await adminAuth.updateUser(uid, {
      password: newPassword,
      // If Google-only user, also set email so they can use email/password login
      ...(userRecord.email && { email: userRecord.email }),
    });

    res.json({ success: true, uid, providers });
  } catch (err) {
    console.error("[admin] change password error:", err.code, err.message);
    res.status(500).json({ error: err.message, code: err.code });
  }
});

// ── GET USER INFO (optional, for verification) ───────────────────────────────
// GET /api/admin/user/:uid
router.get("/user/:uid", checkSecret, async (req, res) => {
  try {
    const user = await adminAuth.getUser(req.params.uid);
    res.json({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      disabled: user.disabled,
      createdAt: user.metadata.creationTime,
      lastSignIn: user.metadata.lastSignInTime,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
