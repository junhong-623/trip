import { useAuth } from "../../contexts/AuthContext";
import { useTrip } from "../../contexts/TripContext";

export default function SettingsPage({ toast }) {
  const { user, logout } = useAuth();
  const { activeTrip } = useTrip();

  return (
    <div>
      <h1 className="page-title">Settings</h1>
      <p className="page-subtitle">Account & trip preferences</p>

      <div className="card" style={{marginBottom:12}}>
        <div className="section-title">Account</div>
        <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0"}}>
          <div style={{
            width:48, height:48, borderRadius:"50%",
            background:"var(--terracotta-pale)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:20, fontWeight:700, color:"var(--terracotta)"
          }}>
            {user?.displayName?.[0] || user?.email?.[0]?.toUpperCase() || "U"}
          </div>
          <div>
            <div style={{fontWeight:600}}>{user?.displayName || "User"}</div>
            <div style={{fontSize:13,color:"var(--ink-muted)"}}>{user?.email}</div>
          </div>
        </div>
        <button className="btn btn-danger" style={{width:"100%"}} onClick={logout}>
          Sign Out
        </button>
      </div>

      {activeTrip && (
        <div className="card" style={{marginBottom:12}}>
          <div className="section-title" style={{marginBottom:10}}>Current Trip</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:13}}>
            <div style={{color:"var(--ink-muted)"}}>Name</div>
            <div style={{fontWeight:500}}>{activeTrip.name}</div>
            <div style={{color:"var(--ink-muted)"}}>Currency</div>
            <div style={{fontWeight:500}}>{activeTrip.baseCurrency}</div>
            <div style={{color:"var(--ink-muted)"}}>Drive Folder</div>
            <div style={{fontWeight:500,wordBreak:"break-all",fontSize:11}}>
              {activeTrip.driveFolderId || "Not set"}
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="section-title" style={{marginBottom:8}}>About</div>
        <p style={{fontSize:13,color:"var(--ink-muted)",lineHeight:1.6}}>
          Wandersplit — Travel Expense Tracker<br />
          Built with React + Firebase + Google Drive API
        </p>
      </div>
    </div>
  );
}
