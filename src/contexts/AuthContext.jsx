import { createContext, useContext, useState, useEffect } from "react";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import {
  doc, setDoc, getDoc, collection, query, where, getDocs
} from "firebase/firestore";
import { app } from "../services/firebase";
import { db } from "../services/firebase";

const AuthContext = createContext(null);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  // ── Login: accepts username OR email ────────────────────────────────────────
  const loginEmail = async (usernameOrEmail, password) => {
    let email = usernameOrEmail;

    // If no @ sign, treat as username → look up email in Firestore
    if (!usernameOrEmail.includes("@")) {
      const q = query(
        collection(db, "usernames"),
        where("username", "==", usernameOrEmail.toLowerCase().trim())
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        throw new Error("Username not found. Please check and try again.");
      }
      email = snap.docs[0].data().email;
    }

    return signInWithEmailAndPassword(auth, email, password);
  };

  // ── Register: saves username to Firestore ───────────────────────────────────
  const register = async (email, password, username) => {
    // Check username not taken
    if (username) {
      const q = query(
        collection(db, "usernames"),
        where("username", "==", username.toLowerCase().trim())
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        throw new Error("Username already taken. Please choose another.");
      }
    }

    const cred = await createUserWithEmailAndPassword(auth, email, password);

    // Save display name
    if (username) {
      await updateProfile(cred.user, { displayName: username });
      // Save username → email mapping for login lookup
      await setDoc(doc(db, "usernames", cred.user.uid), {
        username: username.toLowerCase().trim(),
        displayName: username,
        email: email,
        uid: cred.user.uid,
      });
    }

    return cred;
  };

  const loginGoogle = () => signInWithPopup(auth, googleProvider);
  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, loading, loginEmail, loginGoogle, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
