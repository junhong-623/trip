// firestore.js — CRUD operations for all sub-collections
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, onSnapshot, query, orderBy, serverTimestamp, writeBatch
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

export const deleteReceipt = (tripId, receiptId) =>
  deleteDoc(subDoc(tripId, "receipts", receiptId));

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
