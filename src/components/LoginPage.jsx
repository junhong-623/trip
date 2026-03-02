import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useLang, LANGUAGES } from "../contexts/LangContext";
import "./LoginPage.css";

export default function LoginPage() {
  const { loginEmail, loginGoogle, register } = useAuth();
  const { lang, changeLang, tr } = useLang();
  const [mode, setMode] = useState("login");
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await loginEmail(usernameOrEmail, password);
      } else {
        if (!username.trim()) {
          setError("Please enter a username.");
          setLoading(false);
          return;
        }
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
          setError("Username must be 3-20 characters (letters, numbers, underscore only).");
          setLoading(false);
          return;
        }
        await register(usernameOrEmail, password, username);
      }
    } catch (err) {
      setError(err.message.replace("Firebase: ", "").replace(/\(auth\/.*\)\.?/, "").trim());
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    try {
      await loginGoogle();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg">
        <div className="login-shape s1" />
        <div className="login-shape s2" />
        <div className="login-shape s3" />
      </div>

      <div className="login-card">
        {/* Language Switcher */}
        <div className="lang-switcher">
          {LANGUAGES.map(l => (
            <button
              key={l.code}
              className={`lang-btn ${lang === l.code ? "active" : ""}`}
              onClick={() => changeLang(l.code)}
              type="button"
            >
              <span>{l.flag}</span>
              <span>{l.label}</span>
            </button>
          ))}
        </div>

        <div className="login-header">
          <img src="/trip/icons/icon-192.png" alt="MateTrip" className="login-logo" />
          <h1 className="login-title">
            MateTrip <span className="login-title-zh">伴旅</span>
          </h1>
          <p className="login-slogan">{tr.appSubtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {/* Username (register only) */}
          {mode === "register" && (
            <div className="form-group">
              <label className="form-label">{tr.username}</label>
              <input
                className="form-input"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="traveler123"
                autoComplete="username"
              />
              <p className="form-hint">3-20 characters, letters/numbers/underscore</p>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">
              {mode === "login" ? tr.usernameOrEmail : tr.email}
            </label>
            <input
              className="form-input"
              type={mode === "register" ? "email" : "text"}
              value={usernameOrEmail}
              onChange={e => setUsernameOrEmail(e.target.value)}
              placeholder={mode === "login" ? "username or you@example.com" : "you@example.com"}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label">{tr.password}</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>

          {error && (
            <p className="form-error" style={{ padding: "8px 12px", background: "var(--error-pale)", borderRadius: "8px" }}>
              {error}
            </p>
          )}

          <button className="btn btn-primary btn-lg" type="submit" disabled={loading} style={{ width: "100%" }}>
            {loading ? tr.pleaseWait : mode === "login" ? tr.signIn : tr.createAccount}
          </button>
        </form>

        <div className="login-divider"><span>{tr.or}</span></div>

        <button className="btn btn-secondary btn-lg" onClick={handleGoogle} style={{ width: "100%" }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
          </svg>
          {tr.continueWithGoogle}
        </button>

        <p className="login-toggle">
          {mode === "login" ? tr.dontHaveAccount : tr.alreadyHaveAccount}
          {" "}
          <button className="link-btn" onClick={() => { setMode(m => m === "login" ? "register" : "login"); setError(""); }}>
            {mode === "login" ? tr.signUp : tr.signIn}
          </button>
        </p>
      </div>
    </div>
  );
}
