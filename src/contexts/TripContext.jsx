import { createContext, useContext, useState, useEffect } from "react";
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, query, where, orderBy, serverTimestamp
} from "firebase/firestore";
import { db } from "../services/firebase";
import { useAuth } from "./AuthContext";

const TripContext = createContext(null);

export function TripProvider({ children }) {
  const { user } = useAuth();
  const [trips, setTrips] = useState([]);
  const [activeTrip, setActiveTrip] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "trips"),
      where("createdBy", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTrips(data);
      setLoading(false);
      // Auto-select first trip if none active
      setActiveTrip(prev => {
        if (prev) {
          const updated = data.find(t => t.id === prev.id);
          return updated || data[0] || null;
        }
        return data[0] || null;
      });
    });
    return unsub;
  }, [user]);

  const createTrip = async (data) => {
    const ref = await addDoc(collection(db, "trips"), {
      ...data,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  };

  const updateTrip = async (tripId, data) => {
    await updateDoc(doc(db, "trips", tripId), data);
  };

  const deleteTrip = async (tripId) => {
    await deleteDoc(doc(db, "trips", tripId));
    if (activeTrip?.id === tripId) setActiveTrip(trips.find(t => t.id !== tripId) || null);
  };

  const selectTrip = (trip) => setActiveTrip(trip);

  return (
    <TripContext.Provider value={{ trips, activeTrip, loading, createTrip, updateTrip, deleteTrip, selectTrip }}>
      {children}
    </TripContext.Provider>
  );
}

export const useTrip = () => useContext(TripContext);
