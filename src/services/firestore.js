// firestore.js — CRUD operations for all sub-collections
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, onSnapshot, query, where, orderBy, serverTimestamp, writeBatch
} from "firebase/firestore";
import { db } from "./firebase";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const sub = (tripId, col) => collection(db, "trips", tripId, col);
const subDoc = (tripId, col, id) => doc(db, "trips", tripId, col, id);

// ─── People ───────────────────────────────────────────────────────────────────
export const subscribePeople = (tripId, cb) =>
  onSnapshot(query(sub(tripId, "people"), orderBy("createdAt")), snap =>
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  );

export const addPerson = (tripId, data) =>
  addDoc(sub(tripId, "people"), { ...data, createdAt: serverTimestamp() });

export const updatePerson = (tripId, personId, data) =>
  updateDoc(subDoc(tripId, "people", personId), data);

export const deletePerson = (tripId, personId) =>
  deleteDoc(subDoc(tripId, "people", personId));

// ─── Receipts ─────────────────────────────────────────────────────────────────
export const subscribeReceipts = (tripId, cb) =>
  onSnapshot(query(sub(tripId, "receipts"), orderBy("date", "desc")), snap =>
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  );

export const addReceipt = (tripId, data) =>
  addDoc(sub(tripId, "receipts"), { ...data, createdAt: serverTimestamp() });

export const updateReceipt = (tripId, receiptId, data) =>
  updateDoc(subDoc(tripId, "receipts", receiptId), data);

export const deleteReceipt = async (tripId, receiptId) => {
  // Delete the receipt + all associated settlements in a batch
  const batch = writeBatch(db);
  batch.delete(subDoc(tripId, "receipts", receiptId));
  const settlementsSnap = await getDocs(
    query(sub(tripId, "settlements"), where("receiptId", "==", receiptId))
  );
  settlementsSnap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
};

// ─── Photos ───────────────────────────────────────────────────────────────────
export const subscribePhotos = (tripId, cb) =>
  onSnapshot(query(sub(tripId, "photos"), orderBy("createdAt", "desc")), snap =>
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  );

export const addPhoto = (tripId, data) =>
  addDoc(sub(tripId, "photos"), { ...data, createdAt: serverTimestamp() });

export const deletePhoto = (tripId, photoId) =>
  deleteDoc(subDoc(tripId, "photos", photoId));

// ─── Settlements ──────────────────────────────────────────────────────────────
export const subscribeSettlements = (tripId, cb) =>
  onSnapshot(sub(tripId, "settlements"), snap =>
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  );

export const addSettlement = (tripId, data) =>
  addDoc(sub(tripId, "settlements"), { ...data, createdAt: serverTimestamp() });

export const updateSettlement = (tripId, settlementId, data) =>
  updateDoc(subDoc(tripId, "settlements", settlementId), data);

// NEW: delete a settlement (un-settle)
export const deleteSettlement = (tripId, settlementId) =>
  deleteDoc(subDoc(tripId, "settlements", settlementId));

// ─── Trip cascade delete ──────────────────────────────────────────────────────
// Deletes all sub-collections of a trip in batches (Firestore limit: 500 per batch)
export const deleteTripSubcollections = async (tripId) => {
  const COLS = ["receipts", "people", "photos", "settlements"];
  const fileIds = []; // Collect Drive fileIds for cleanup

  for (const col of COLS) {
    const snap = await getDocs(sub(tripId, col));
    if (snap.empty) continue;

    // Collect fileIds from photos
    if (col === "photos") {
      snap.docs.forEach(d => {
        if (d.data().fileId) fileIds.push(d.data().fileId);
      });
    }

    // Delete in batches of 400 (safe below 500 limit)
    const chunks = [];
    for (let i = 0; i < snap.docs.length; i += 400) {
      chunks.push(snap.docs.slice(i, i + 400));
    }
    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
  }

  return fileIds; // Caller handles Drive deletion
};

// ─── Trip sharing ──────────────────────────────────────────────────────────────
export const getTripByJoinCode = async (joinCode) => {
  const { collection, query, where, getDocs } = await import("firebase/firestore");
  const { db } = await import("./firebase");
  const q = query(collection(db, "trips"), where("joinCode", "==", joinCode.toUpperCase().trim()));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
};
