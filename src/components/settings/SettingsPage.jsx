import { useAuth } from "../../contexts/AuthContext";
import { useTrip } from "../../contexts/TripContext";
import { useLang, LANGUAGES } from "../../contexts/LangContext";

export default function SettingsPage({ toast }) {
  const { user, logout } = useAuth();
  const { activeTrip } = useTrip();
  const { tr, lang, changeLang } = useLang();

  return (
    <div>
      <h1 className="page-title">{tr.settingsTitle}</h1>
      <p className="page-subtitle" style={{marginBottom:20}}> </p>

      {/* Account */}
      <div className="card" style={{marginBottom:12}}>
        <div className="section-title">{tr.account}</div>
        <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0"}}>
          <div style={{
            width:48,height:48,borderRadius:"50%",
            background:"var(--terracotta-pale)",
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:20,fontWeight:700,color:"var(--terracotta)"
          }}>
            {user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
          </div>
          <div>
            <div style={{fontWeight:600}}>{user?.displayName || "User"}</div>
            <div style={{fontSize:13,color:"var(--ink-muted)"}}>{user?.email}</div>
          </div>
        </div>
        <button className="btn btn-danger" style={{width:"100%"}} onClick={logout}>
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
        <div className="section-title" style={{marginBottom:8}}>{tr.about}</div>
        <p style={{fontSize:13,color:"var(--ink-muted)",lineHeight:1.6,whiteSpace:"pre-line"}}>
          {tr.aboutText}
        </p>
      </div>
    </div>
  );
}
