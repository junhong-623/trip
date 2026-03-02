import { createContext, useContext, useState, useEffect } from "react";
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, query, where, orderBy, serverTimestamp, arrayUnion, arrayRemove, getDocs
} from "firebase/firestore";
import { db } from "../services/firebase";
import { deleteTripSubcollections } from "../services/firestore";
import { deleteFromDrive } from "../services/api";
import { useAuth } from "./AuthContext";

const TripContext = createContext(null);

function generateJoinCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export function TripProvider({ children }) {
  const { user } = useAuth();
  const [trips, setTrips] = useState([]);
  const [activeTrip, setActiveTrip] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setTrips([]); setActiveTrip(null); setLoading(false); return; }

    const q1 = query(
      collection(db, "trips"),
      where("createdBy", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    const q2 = query(
      collection(db, "trips"),
      where("memberIds", "array-contains", user.uid),
      orderBy("createdAt", "desc")
    );

    let myTrips = [];
    let joinedTrips = [];
    let loaded1 = false, loaded2 = false;

    const merge = () => {
      const all = [...myTrips];
      joinedTrips.forEach(t => { if (!all.find(a => a.id === t.id)) all.push(t); });
      all.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setTrips(all);
      if (loaded1 && loaded2) setLoading(false);
      setActiveTrip(prev => {
        if (prev) {
          const updated = all.find(t => t.id === prev.id);
          return updated || all[0] || null;
        }
        return all[0] || null;
      });
    };

    const unsub1 = onSnapshot(q1, snap => {
      myTrips = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      loaded1 = true;
      merge();
    });

    const unsub2 = onSnapshot(q2, snap => {
      joinedTrips = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      loaded2 = true;
      merge();
    });

    return () => { unsub1(); unsub2(); };
  }, [user]);

  const createTrip = async (data) => {
    let joinCode;
    let attempts = 0;
    while (attempts < 10) {
      joinCode = generateJoinCode();
      const q = query(collection(db, "trips"), where("joinCode", "==", joinCode));
      const snap = await getDocs(q);
      if (snap.empty) break;
      attempts++;
    }
    const ref = await addDoc(collection(db, "trips"), {
      ...data,
      createdBy: user.uid,
      memberIds: [],
      joinCode,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  };

  const joinTrip = async (code) => {
    const upperCode = code.toUpperCase().trim();
    const q = query(collection(db, "trips"), where("joinCode", "==", upperCode));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error("Trip not found. Please check the code.");
    const tripDoc = snap.docs[0];
    const tripData = { id: tripDoc.id, ...tripDoc.data() };
    if (tripData.createdBy === user.uid) throw new Error("You created this trip.");
    if ((tripData.memberIds || []).includes(user.uid)) throw new Error("You already joined this trip.");
    await updateDoc(doc(db, "trips", tripDoc.id), {
      memberIds: arrayUnion(user.uid),
    });
    return tripData;
  };

  const updateTrip = async (tripId, data) => {
    await updateDoc(doc(db, "trips", tripId), data);
  };

  const deleteTrip = async (tripId) => {
    // 1. Delete all sub-collections (receipts, people, photos, settlements)
    //    and get back any Drive fileIds that need to be deleted
    const fileIds = await deleteTripSubcollections(tripId);

    // 2. Delete Drive files (photos/videos) in parallel, silently ignore failures
    if (fileIds.length > 0) {
      await Promise.allSettled(fileIds.map(id => deleteFromDrive(id)));
    }

    // 3. Delete the trip document itself
    await deleteDoc(doc(db, "trips", tripId));

    if (activeTrip?.id === tripId) setActiveTrip(trips.find(t => t.id !== tripId) || null);
  };

  const leaveTrip = async (tripId) => {
    await updateDoc(doc(db, "trips", tripId), {
      memberIds: arrayRemove(user.uid),
    });
    if (activeTrip?.id === tripId) setActiveTrip(trips.find(t => t.id !== tripId) || null);
  };

  const selectTrip = (trip) => setActiveTrip(trip);

  return (
    <TripContext.Provider value={{
      trips, activeTrip, loading,
      createTrip, updateTrip, deleteTrip, selectTrip,
      joinTrip, leaveTrip,
    }}>
      {children}
    </TripContext.Provider>
  );
}

export const useTrip = () => useContext(TripContext);
