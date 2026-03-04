<div align="center">

<img src="public/icons/icon-192.png" width="96" height="96" style="border-radius: 20px" />

# MateTrip 伴旅

### Settle every expense. Capture every moment.

*算清一路琐碎，存下全程风景。*

[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore-FFCA28?style=flat-square&logo=firebase)](https://firebase.google.com)
[![Railway](https://img.shields.io/badge/Backend-Railway-0B0D0E?style=flat-square&logo=railway)](https://railway.app)
[![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?style=flat-square&logo=pwa)](https://web.dev/progressive-web-apps/)

[中文 README](README.md)

</div>

---

## About

**MateTrip** is a Progressive Web App (PWA) built for group travel. No installation needed — open it in any mobile browser and get a full travel companion: shared expense tracking, photo memories, collaborative itineraries, and real-time group chat, all in one place.

---

## Features

### 🗺 Trip Management
- Create trips with name, destination, currency, and dates
- Invite members via a 6-character join code
- Trip owner can remove members and **transfer ownership**
- Multi-currency support (JPY, MYR, USD, THB, and more)

### 🧾 Receipts
- 📷 OCR receipt scanning — auto-extracts amount, date, and merchant name (Google Vision)
- Manual entry with payer, participants, and item breakdown
- Category tagging (food, transport, accommodation, etc.)
- Photo evidence upload for receipt validation

### 💰 Settlement
- Real-time balance calculation per person
- Optimized debt simplification — minimizes the number of transfers
- One-tap settlement with undo support
- Trip total, per-person breakdown, and pending count

### 📷 Gallery
- Shared photo album — any member can upload
- Photo captions and comments
- Chronological grouping by date
- Owner can delete any photo; uploaders can delete their own

### 📅 Plan
- Collaborative itinerary — add events with time, place, and notes
- Attach Google Maps links to events
- Export any event as an `.ics` file (opens in phone calendar / reminders)
- Real-time group chat
- 🔔 Background push notifications (iOS 16.4+ requires PWA mode)
- Link your chat identity to a travel companion profile — show their avatar and name

### 👥 People
- Custom avatars via DiceBear (14 styles) or photo upload
- Link user accounts to travel companion profiles for chat identity
- Trip owner can manage all member links

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite, deployed on GitHub Pages |
| Backend | Node.js + Express, deployed on Railway |
| Database | Firebase Firestore (real-time sync) |
| Auth | Firebase Authentication (Email + Google OAuth) |
| Media | Cloudinary (photo upload & optimization) |
| OCR | Google Cloud Vision API |
| Push | Web Push API + VAPID |

---

## Data Model

All trip data lives under the Firestore path `trips/{tripId}/` with subcollections:

```
trips/{tripId}/
├── receipts/      bills (amount, items, participants)
├── people/        travel companion profiles (name, avatar, linkedUserId)
├── photos/        gallery entries (Cloudinary URL, caption, uploader)
├── settlements/   settlement records per receipt/person pair
├── schedule/      itinerary events (date, time, place, mapLink)
└── messages/      group chat (text, uid, timestamp)

pushSubscriptions/{tripId}_{userId}   push subscriptions (top-level collection)
```

---

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/drive/upload` | Upload photo to Cloudinary |
| `DELETE /api/drive/file/:id` | Delete photo from Cloudinary |
| `POST /api/ocr/receipt` | Scan receipt via Google Vision |
| `POST /api/push/subscribe` | Register push subscription (frontend writes directly to Firestore) |
| `POST /api/push/send` | Send push notification to trip members |

---

## Environment Setup

### Frontend `.env`

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_API_BASE_URL=          # Railway backend URL
VITE_VAPID_PUBLIC_KEY=      # Generated via: npx web-push generate-vapid-keys
```

### Backend (Railway) Environment Variables

```env
GOOGLE_SERVICE_ACCOUNT_JSON=   # Full JSON of Google service account
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_EMAIL=                   # mailto:your@email.com
CLIENT_ORIGIN=                 # Allowed frontend origins, comma-separated
```

---

## Deployment

### Frontend — GitHub Pages

```bash
# Set in vite.config.js
base: '/trip/'

# Build and deploy
npm run build
# Deploy the dist/ folder to GitHub Pages
```

> PWA files: `public/manifest.json`, `public/sw.js` (background push), `public/icons/`

### Backend — Railway

```bash
# Push the server/ directory to GitHub
# Connect the repo to Railway and configure all environment variables
# Railway auto-deploys on every git push
```

---

## PWA & Push Notifications

> Add to your home screen for a native app experience.

**iOS**
- Requires iOS 16.4 or later
- Install via Safari → Share → Add to Home Screen
- Push notifications only work in PWA mode — not inside Safari browser

**Android**
- Chrome on Android supports Web Push without PWA mode
- Recommended: add to home screen via Chrome for the best experience

---

## Screenshots

> *(Add screenshots here)*

---

<div align="center">

**MateTrip 伴旅** · Settle every expense. Capture every moment.

Built with React · Firebase · Railway · Cloudinary

</div>
