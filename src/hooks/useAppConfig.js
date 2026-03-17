import { useContext, createContext, useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../services/firebase";
import { useTrip } from "../contexts/TripContext";

const DEFAULT = {
  ocrEnabled:       false,
  photosEnabled:    false,
  photosMaxPerTrip: 5,
  chatEnabled:      false,
};

const AppConfigContext = createContext(DEFAULT);

export function AppConfigProvider({ children }) {
  const { activeTrip } = useTrip();
  const [config, setConfig] = useState(DEFAULT);

  useEffect(() => {
    if (!activeTrip?.id) {
      console.log("[AppConfig] no activeTrip, using defaults:", DEFAULT);
      setConfig(DEFAULT);
      return;
    }

    console.log("[AppConfig] subscribing to trip:", activeTrip.id);

    const unsub = onSnapshot(
      doc(db, "trips", activeTrip.id),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const features = data.features || {};
          console.log("[AppConfig] trip doc received, features field:", features);
          console.log("[AppConfig] full trip data keys:", Object.keys(data));
          const merged = { ...DEFAULT, ...features };
          console.log("[AppConfig] final config:", merged);
          setConfig(merged);
        } else {
          console.log("[AppConfig] trip doc does not exist, using defaults");
          setConfig(DEFAULT);
        }
      },
      (err) => {
        console.error("[AppConfig] onSnapshot error:", err);
        setConfig(DEFAULT);
      }
    );

    return unsub;
  }, [activeTrip?.id]);

  return (
    <AppConfigContext.Provider value={config}>
      {children}
    </AppConfigContext.Provider>
  );
}

export function useAppConfig() {
  return useContext(AppConfigContext);
}
