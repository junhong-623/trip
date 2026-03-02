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
  updatePassword as firebaseUpdatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
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

  const loginGoogle = async () => {
    const cred = await signInWithPopup(auth, googleProvider);
    const u = cred.user;
    try {
      // Only set username if not already set (don't overwrite user's custom username)
      const existing = await getDoc(doc(db, "usernames", u.uid));
      if (!existing.exists()) {
        // Generate username from Google display name
        const baseUsername = (u.displayName || u.email?.split("@")[0] || "user")
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, "")
          .slice(0, 20) || "user";
        await setDoc(doc(db, "usernames", u.uid), {
          username: baseUsername,
          displayName: u.displayName || baseUsername,
          email: u.email || "",
          uid: u.uid,
        });
      } else {
        // Always keep email up to date
        await setDoc(doc(db, "usernames", u.uid), {
          email: u.email || "",
          uid: u.uid,
        }, { merge: true });
      }
    } catch (_) {}
    return cred;
  };
  const updateUsername = async (newUsername) => {
    const trimmed = newUsername.trim();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(trimmed)) {
      throw new Error("Username must be 3-20 characters (letters, numbers, underscore only).");
    }
    // Check not taken by someone else
    const q = query(
      collection(db, "usernames"),
      where("username", "==", trimmed.toLowerCase())
    );
    const snap = await getDocs(q);
    const taken = snap.docs.find(d => d.id !== user.uid);
    if (taken) throw new Error("Username already taken. Please choose another.");

    // Update Firestore and Auth profile
    await setDoc(doc(db, "usernames", user.uid), {
      username: trimmed.toLowerCase(),
      displayName: trimmed,
    }, { merge: true });
    await updateProfile(user, { displayName: trimmed });
  };

  const updateUserPassword = async (currentPassword, newPassword) => {
    // Re-authenticate first
    const isGoogle = user.providerData.some(p => p.providerId === "google.com");
    if (isGoogle) {
      await reauthenticateWithPopup(user, googleProvider);
    } else {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
    }
    await firebaseUpdatePassword(user, newPassword);
  };

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, loading, loginEmail, loginGoogle, register, logout, updateUsername, updateUserPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
