import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useTrip } from "../../contexts/TripContext";
import { useLang, LANGUAGES } from "../../contexts/LangContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../services/firebase";

export default function SettingsPage({ toast }) {
  const { user, logout, updateUsername, updateUserPassword } = useAuth();
  const { activeTrip } = useTrip();
  const { tr, lang, changeLang } = useLang();

  // Username edit
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);
  const [currentUsername, setCurrentUsername] = useState("");

  // Password edit
  const [editingPassword, setEditingPassword] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const isGoogle = user?.providerData?.some(p => p.providerId === "google.com");

  // Load current username from Firestore
  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "usernames", user.uid)).then(snap => {
      if (snap.exists()) setCurrentUsername(snap.data().username || snap.data().displayName || "");
    });
  }, [user]);

  const handleSaveUsername = async () => {
    if (!newUsername.trim()) return;
    setSavingUsername(true);
    try {
      await updateUsername(newUsername.trim());
      setCurrentUsername(newUsername.trim().toLowerCase());
      setNewUsername("");
      setEditingUsername(false);
      toast.show(tr.usernameUpdated, "success");
    } catch (err) {
      toast.show(err.message, "error");
    } finally {
      setSavingUsername(false);
    }
  };

  const handleSavePassword = async () => {
    if (newPw !== confirmPw) { toast.show(tr.passwordMismatch, "error"); return; }
    if (newPw.length < 6) { toast.show(tr.passwordTooShort, "error"); return; }
    setSavingPassword(true);
    try {
      await updateUserPassword(currentPw, newPw);
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      setEditingPassword(false);
      toast.show(tr.passwordUpdated, "success");
    } catch (err) {
      toast.show(err.message.replace("Firebase: ", "").replace(/\(auth\/.*\)\.?/, "").trim(), "error");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">{tr.settingsTitle}</h1>
      <p className="page-subtitle" style={{marginBottom:20}}> </p>

      {/* Account */}
      <div className="card" style={{marginBottom:12}}>
        <div className="section-title">{tr.account}</div>
        <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0 16px"}}>
          <div style={{
            width:48,height:48,borderRadius:"50%",
            background:"var(--terracotta-pale)",
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:20,fontWeight:700,color:"var(--terracotta)",flexShrink:0
          }}>
            {user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
          </div>
          <div style={{minWidth:0}}>
            <div style={{fontWeight:600}}>{user?.displayName || "User"}</div>
            {currentUsername && currentUsername !== user?.displayName && (
              <div style={{fontSize:12,color:"var(--ink-muted)"}}>@{currentUsername}</div>
            )}
            <div style={{fontSize:13,color:"var(--ink-muted)"}}>{user?.email}</div>
            {isGoogle && <div style={{fontSize:11,color:"var(--ink-muted)",marginTop:2}}>🔗 Google</div>}
          </div>
        </div>

        {/* Change Username */}
        {!editingUsername ? (
          <button className="btn btn-secondary" style={{width:"100%",marginBottom:8}}
            onClick={() => { setEditingUsername(true); setNewUsername(currentUsername); }}>
            ✏ {tr.changeUsername}
          </button>
        ) : (
          <div style={{marginBottom:8}}>
            <div className="form-group" style={{marginBottom:8}}>
              <label className="form-label">{tr.newUsername}</label>
              <input className="form-input" value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                placeholder="traveler123"
                maxLength={20}
                autoFocus
                onKeyDown={e => e.key === "Enter" && handleSaveUsername()}
              />
              <p className="form-hint">3-20 characters, letters/numbers/underscore</p>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button className="btn btn-secondary" style={{flex:1}}
                onClick={() => { setEditingUsername(false); setNewUsername(""); }}>
                {tr.cancel}
              </button>
              <button className="btn btn-primary" style={{flex:1}}
                onClick={handleSaveUsername} disabled={savingUsername || !newUsername.trim()}>
                {savingUsername ? tr.saving : tr.saveChanges2}
              </button>
            </div>
          </div>
        )}

        {/* Change Password */}
        {!editingPassword ? (
          <button className="btn btn-secondary" style={{width:"100%",marginBottom:8}}
            onClick={() => setEditingPassword(true)}>
            🔑 {tr.changePassword}
          </button>
        ) : (
          <div style={{marginBottom:8}}>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {isGoogle ? (
                <p className="form-hint" style={{background:"var(--sand)",padding:"8px 12px",borderRadius:8}}>
                  ℹ {tr.googleAccountNote}
                </p>
              ) : (
                <div className="form-group">
                  <label className="form-label">{tr.currentPassword}</label>
                  <input className="form-input" type="password" value={currentPw}
                    onChange={e => setCurrentPw(e.target.value)}
                    placeholder="••••••••" autoFocus />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">{tr.newPassword}</label>
                <input className="form-input" type="password" value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  placeholder="••••••••" />
              </div>
              <div className="form-group">
                <label className="form-label">{tr.confirmNewPassword}</label>
                <input className="form-input" type="password" value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  placeholder="••••••••"
                  onKeyDown={e => e.key === "Enter" && handleSavePassword()} />
              </div>
            </div>
            <div style={{display:"flex",gap:8,marginTop:8}}>
              <button className="btn btn-secondary" style={{flex:1}}
                onClick={() => { setEditingPassword(false); setCurrentPw(""); setNewPw(""); setConfirmPw(""); }}>
                {tr.cancel}
              </button>
              <button className="btn btn-primary" style={{flex:1}}
                onClick={handleSavePassword} disabled={savingPassword || !newPw}>
                {savingPassword ? tr.saving : tr.saveChanges2}
              </button>
            </div>
          </div>
        )}

        <button className="btn btn-danger" style={{width:"100%",marginTop:4}} onClick={logout}>
          🚪 {tr.signOut}
        </button>
      </div>

      {/* Language */}
      <div className="card" style={{marginBottom:12}}>
        <div className="section-title" style={{marginBottom:10}}>{tr.language}</div>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {LANGUAGES.map(l => (
            <button key={l.code}
              onClick={() => changeLang(l.code)}
              style={{
                display:"flex",alignItems:"center",gap:12,padding:"10px 12px",
                borderRadius:10,border: lang===l.code ? "2px solid var(--terracotta)" : "2px solid var(--sand-dark)",
                background: lang===l.code ? "var(--terracotta-pale)" : "white",
                cursor:"pointer",transition:"all 0.15s",textAlign:"left",fontFamily:"var(--font-body)"
              }}>
              <span style={{fontSize:20}}>{l.flag}</span>
              <span style={{fontWeight: lang===l.code ? 600 : 400, color: lang===l.code ? "var(--terracotta)" : "var(--ink)"}}>
                {l.label}
              </span>
              {lang===l.code && <span style={{marginLeft:"auto",color:"var(--terracotta)"}}>✓</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Current Trip */}
      {activeTrip && (
        <div className="card" style={{marginBottom:12}}>
          <div className="section-title" style={{marginBottom:10}}>{tr.currentTrip}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:13}}>
            <div style={{color:"var(--ink-muted)"}}>Name</div>
            <div style={{fontWeight:500}}>{activeTrip.name}</div>
            <div style={{color:"var(--ink-muted)"}}>{tr.currency}</div>
            <div style={{fontWeight:500}}>{activeTrip.baseCurrency}</div>
            <div style={{color:"var(--ink-muted)"}}>{tr.driveFolder}</div>
            <div style={{fontWeight:500,wordBreak:"break-all",fontSize:11}}>
              {activeTrip.driveFolderId || tr.notSet}
            </div>
          </div>
        </div>
      )}

      {/* Install App */}
      <div className="card" style={{marginBottom:12}}>
        <div className="section-title" style={{marginBottom:8}}>📲 {tr.installApp}</div>
        <p style={{fontSize:13,color:"var(--ink-muted)",marginBottom:14,lineHeight:1.6}}>
          {tr.installAppDesc}
        </p>
        <div style={{marginBottom:12}}>
          <div style={{fontWeight:600,fontSize:13,marginBottom:6}}>🍎 {tr.installIOS}</div>
          <div style={{fontSize:13,color:"var(--ink-muted)",lineHeight:1.8,whiteSpace:"pre-line",
            background:"var(--sand)",borderRadius:8,padding:"10px 12px"}}>
            {tr.installIOSSteps}
          </div>
        </div>
        <div>
          <div style={{fontWeight:600,fontSize:13,marginBottom:6}}>🤖 {tr.installAndroid}</div>
          <div style={{fontSize:13,color:"var(--ink-muted)",lineHeight:1.8,whiteSpace:"pre-line",
            background:"var(--sand)",borderRadius:8,padding:"10px 12px"}}>
            {tr.installAndroidSteps}
          </div>
        </div>
      </div>

      {/* About */}
      <div className="card">
        <div className="section-title" style={{marginBottom:12}}>{tr.about}</div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,marginBottom:14}}>
          <img src="/trip/icons/icon-192.png" alt="MateTrip"
            style={{width:64,height:64,borderRadius:16,boxShadow:"0 4px 16px rgba(0,0,0,0.1)"}} />
          <div style={{textAlign:"center"}}>
            <div style={{fontFamily:"var(--font-display)",fontSize:18,fontWeight:800,color:"var(--ink)"}}>
              MateTrip <span style={{color:"var(--terracotta)"}}>伴旅</span>
            </div>
            <div style={{fontSize:14,color:"var(--ink-muted)",marginTop:2}}>
              算清一路琐碎，存下全程风景。
            </div>
          </div>
        </div>
        <p style={{fontSize:12,color:"var(--ink-muted)",lineHeight:1.7,whiteSpace:"pre-line",textAlign:"center"}}>
          {tr.aboutText}
        </p>
      </div>
    </div>
  );
}
