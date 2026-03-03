// pushService.js — Web Push subscription management
import { db } from "./firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export async function registerSW() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register("/trip/sw.js");
    return reg;
  } catch (e) {
    console.warn("SW register failed:", e);
    return null;
  }
}

export async function subscribePush(tripId, userId) {
  if (!VAPID_PUBLIC_KEY) { console.warn("No VAPID key"); return null; }
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    // Save directly to Firestore from frontend — no backend needed
    await setDoc(doc(db, "pushSubscriptions", `${tripId}_${userId}`), {
      tripId,
      userId,
      subscription: JSON.parse(JSON.stringify(sub)),
      updatedAt: serverTimestamp(),
    });
    console.log("Push subscription saved to Firestore");
    return sub;
  } catch (e) {
    console.warn("Push subscribe failed:", e);
    return null;
  }
}

export async function unsubscribePush(tripId, userId) {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
  } catch {}
}

export function isPushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window;
}
