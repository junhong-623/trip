# ✈ Wandersplit — Travel Expense Tracker

A React + Firebase travel expense splitting app.

## Features

- 🗺 **Multi-Trip Management** — Create and switch between trips
- 🧾 **Receipt Tracking** — Manual entry or OCR upload (Google Vision API)
- 🍱 **Item-level Splitting** — Assign individual food items to specific people
- 💰 **Auto Settlement** — Calculate who owes whom with one click
- 📷 **Photo Gallery** — Upload to Google Drive, browse with lightbox
- 👥 **People Management** — Dicebear-generated avatars, custom upload

---

## Project Structure

```
wandersplit/
├── src/
│   ├── App.jsx               # Root component
│   ├── App.css               # Global design system
│   ├── main.jsx              # React entry
│   ├── contexts/
│   │   ├── AuthContext.jsx   # Firebase Auth
│   │   └── TripContext.jsx   # Active trip state
│   ├── services/
│   │   ├── firebase.js       # Firebase init
│   │   ├── firestore.js      # CRUD helpers
│   │   └── api.js            # Backend API calls
│   ├── hooks/
│   │   └── useToast.js       # Toast notifications
│   ├── utils/
│   │   └── utils.js          # Formatters, balance math
│   └── components/
│       ├── LoginPage.jsx
│       ├── MainLayout.jsx
│       ├── trips/            # Trip CRUD
│       ├── people/           # People management
│       ├── receipts/         # Receipts + OCR
│       ├── gallery/          # Photo gallery
│       ├── summary/          # Settlement calculator
│       └── settings/
├── server/
│   ├── server.js             # Express backend
│   └── package.json
├── firestore.rules
├── .env.example
└── vite.config.js
```

---

## Setup Guide

### 1. Firebase (use your existing project)

Copy your Firebase config into `.env`:
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Deploy Firestore rules:
```bash
firebase deploy --only firestore:rules
```

Enable in Firebase Console:
- Authentication → Sign-in methods → Email/Password + Google
- Firestore Database → Create database

### 2. Google Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Enable APIs: **Google Drive API**, **Cloud Vision API**
3. Create a Service Account → Download JSON key
4. Share your Google Drive folder with the service account email (`xxx@project.iam.gserviceaccount.com`) — give **Editor** access

### 3. Backend Server

```bash
cd server
cp ../.env.example .env   # fill in GOOGLE_SERVICE_ACCOUNT_KEY_PATH
npm install
npm start                  # runs on :3001
```

### 4. Frontend

```bash
npm install
npm run dev                # runs on :5173
```

---

## Database Structure

```
trips/{tripId}
  name, startDate, endDate, baseCurrency, emoji, driveFolderId
  createdBy, createdAt

trips/{tripId}/people/{personId}
  name, gender, avatarUrl, dicebearSeed, dicebearStyle, createdAt

trips/{tripId}/receipts/{receiptId}
  restaurantName, date, totalAmount, payerId
  participants[]           ← used when no items
  items[]: { id, name, price, eaters[] }
  googleMapLink, lat, lng
  ocrRawText, createdAt

trips/{tripId}/photos/{photoId}
  imageUrl, fileId, note
  googleMapLink, lat, lng, createdAt

trips/{tripId}/settlements/{settlementId}
  fromId, toId, amount, cleared, createdAt
```

---

## Backend API Reference

### Drive Upload
```
POST /api/drive/upload
Content-Type: multipart/form-data
{ file, folderId, fileName? }
→ { fileId, imageUrl }
```

### Drive Delete
```
DELETE /api/drive/file/:fileId
→ { success: true }
```

### Create Drive Folder
```
POST /api/drive/folder
{ name, parentFolderId? }
→ { folderId }
```

### Receipt OCR
```
POST /api/ocr/receipt
Content-Type: multipart/form-data
{ file }
→ { restaurantName, date, totalAmount, items[{ name, price }], rawText }
```

---

## Settlement Algorithm

1. Compute each person's `paid` (sum of receipts they paid) and `owed` (sum of item shares assigned to them)
2. `net = paid - owed` (positive = owed money back, negative = owes money)
3. Match creditors with debtors greedily (no round-trip optimization — kept simple per spec)
4. Settlements stored in Firestore, subtracted from remaining balance

---

## Deploying

**Frontend:** Netlify / Vercel — build with `npm run build`

**Backend:** Railway / Render / Fly.io
- Set `GOOGLE_SERVICE_ACCOUNT_JSON` env var (paste JSON string)
- Set `CLIENT_ORIGIN` to your frontend URL
