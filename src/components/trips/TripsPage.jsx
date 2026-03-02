import { useState, useEffect } from "react";
import { collection, doc, getDocs, getDoc } from "firebase/firestore";
import { db } from "../../services/firebase";
import { useTrip } from "../../contexts/TripContext";
import { useAuth } from "../../contexts/AuthContext";
import { useLang } from "../../contexts/LangContext";
import { formatDate, dicebearUrl } from "../../utils/utils";
import TripModal from "./TripModal";
import "./TripsPage.css";

export default function TripsPage({ toast, onNavigate }) {
  const { trips, activeTrip, loading, selectTrip, createTrip, updateTrip, deleteTrip, joinTrip, leaveTrip } = useTrip();
  const { user } = useAuth();
  const { tr, t } = useLang();
  const [showModal, setShowModal] = useState(false);
  const [editTrip, setEditTrip] = useState(null);
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [showMembers, setShowMembers] = useState(null); // trip object
  const [memberProfiles, setMemberProfiles] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [kicking, setKicking] = useState(null);

  const openMembers = async (trip, e) => {
    e.stopPropagation();
    setShowMembers(trip);
    setMemberProfiles([]);
    if (!trip.memberIds?.length) return;
    setLoadingMembers(true);
    try {
      const profiles = await Promise.all(
        trip.memberIds.map(async (uid) => {
          try {
            const snap = await getDoc(doc(db, "usernames", uid));
            if (snap.exists()) return { uid, ...snap.data() };
            return { uid, displayName: uid.slice(0, 8) + "…", username: "", email: "" };
          } catch {
            return { uid, displayName: uid.slice(0, 8) + "…", username: "", email: "" };
          }
        })
      );
      setMemberProfiles(profiles);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleKick = async (trip, uid) => {
    if (!confirm(`Remove this member from the trip?`)) return;
    setKicking(uid);
    try {
      const { updateDoc, doc: firestoreDoc, arrayRemove } = await import("firebase/firestore");
      await updateDoc(firestoreDoc(db, "trips", trip.id), {
        memberIds: arrayRemove(uid),
      });
      setMemberProfiles(prev => prev.filter(p => p.uid !== uid));
      setShowMembers(prev => prev ? { ...prev, memberIds: (prev.memberIds || []).filter(id => id !== uid) } : prev);
    } finally {
      setKicking(null);
    }
  };

  const handleSave = async (data) => {
    try {
      if (editTrip) {
        await updateTrip(editTrip.id, data);
        toast.show(tr.tripUpdated, "success");
      } else {
        await createTrip(data);
        toast.show(tr.tripCreated, "success");
      }
      setShowModal(false);
      setEditTrip(null);
    } catch (e) {
      toast.show(e.message, "error");
    }
  };

  const handleEdit = (trip, e) => {
    e.stopPropagation();
    setEditTrip(trip);
    setShowModal(true);
  };

  const handleDelete = async (trip, e) => {
    e.stopPropagation();
    if (!confirm(t(tr.confirmDeleteTrip, trip.name))) return;
    await deleteTrip(trip.id);
    toast.show(tr.tripDeleted);
  };

  const handleLeave = async (trip, e) => {
    e.stopPropagation();
    if (!confirm(tr.confirmLeaveTrip)) return;
    try {
      await leaveTrip(trip.id);
      toast.show(tr.tripDeleted);
    } catch (err) {
      toast.show(err.message, "error");
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setJoining(true);
    try {
      const trip = await joinTrip(joinCode);
      toast.show(tr.joinSuccess, "success");
      selectTrip(trip);
      setShowJoin(false);
      setJoinCode("");
      onNavigate?.("receipts");
    } catch (err) {
      toast.show(err.message || tr.joinError, "error");
    } finally {
      setJoining(false);
    }
  };

  const isOwner = (trip) => trip.createdBy === user?.uid;
  const memberCount = (trip) => 1 + (trip.memberIds?.length || 0);

  return (
    <div>
      <div className="trips-header">
        <div>
          <h1 className="page-title">{tr.myTrips}</h1>
          <p className="page-subtitle">{tr.selectOrCreate}</p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button className="btn btn-secondary" onClick={() => setShowJoin(true)}>
            🔗 {tr.joinTrip}
          </button>
          <button className="btn btn-primary" onClick={() => { setEditTrip(null); setShowModal(true); }}>
            + {tr.newTrip}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {[1,2].map(i => <div key={i} className="skeleton" style={{height:110,borderRadius:14}} />)}
        </div>
      ) : trips.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><img src="/trip/icons/icon-192.png" alt="MateTrip" style={{width:64,height:64,borderRadius:16,opacity:0.85}} /></div>
          <div className="empty-state-title">{tr.noTripsYet}</div>
          <div className="empty-state-text">{tr.createFirstTrip}</div>
          <button className="btn btn-primary" style={{marginTop:16}} onClick={() => setShowModal(true)}>
            {tr.createYourFirstTrip}
          </button>
        </div>
      ) : (
        <div className="trips-list">
          {trips.map(trip => (
            <div
              key={trip.id}
              className={`trip-card card card-hover ${activeTrip?.id === trip.id ? "active" : ""}`}
              onClick={() => { selectTrip(trip); onNavigate?.("receipts"); }}
            >
              <div className="trip-card-top">
                <div className="trip-card-icon">{trip.emoji || "🌍"}</div>
                <div className="trip-card-info">
                  <div className="trip-card-name">{trip.name}</div>
                  <div className="trip-card-dates">
                    {formatDate(trip.startDate)} — {formatDate(trip.endDate)}
                  </div>
                  <div className="trip-card-meta">
                    {isOwner(trip) ? (
                      <span className="trip-role-badge owner">👑 {tr.owner}</span>
                    ) : (
                      <span className="trip-role-badge joined">🔗 {tr.youJoined}</span>
                    )}
                    {memberCount(trip) > 1 && (
                      <span
                        className={`trip-member-count ${isOwner(trip) ? "clickable" : ""}`}
                        onClick={isOwner(trip) ? (e) => openMembers(trip, e) : undefined}
                      >
                        👥 {memberCount(trip)} {tr.membersCount}
                        {isOwner(trip) && <span style={{marginLeft:3,opacity:0.5,fontSize:10}}>›</span>}
                      </span>
                    )}
                  </div>
                </div>
                <div className="trip-card-actions">
                  {isOwner(trip) ? (
                    <>
                      <button className="btn btn-icon btn-sm" onClick={e => handleEdit(trip, e)}>✏</button>
                      <button className="btn btn-icon btn-sm" onClick={e => handleDelete(trip, e)}>🗑</button>
                    </>
                  ) : (
                    <button className="btn btn-icon btn-sm" title={tr.leaveTrip}
                      onClick={e => handleLeave(trip, e)}>🚪</button>
                  )}
                </div>
              </div>
              <div className="trip-card-footer">
                <span className="badge badge-terracotta">{trip.baseCurrency}</span>
                {activeTrip?.id === trip.id && <span className="badge badge-sage">{tr.active}</span>}
                {isOwner(trip) && trip.joinCode && (
                  <span className="trip-join-code" onClick={e => {
                    e.stopPropagation();
                    navigator.clipboard?.writeText(trip.joinCode);
                    toast.show(`${tr.tripCode}: ${trip.joinCode} — copied!`, "success");
                  }}>
                    🔑 {trip.joinCode}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Members Modal */}
      {showMembers && (
        <div className="modal-overlay" onClick={() => setShowMembers(null)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-header">
              <h2 className="modal-title">👥 {tr.membersCount} — {showMembers.name}</h2>
              <button className="btn btn-icon" onClick={() => setShowMembers(null)}>✕</button>
            </div>

            {/* Join code */}
            <div style={{
              display:"flex",alignItems:"center",gap:10,
              background:"var(--sand)",borderRadius:10,padding:"10px 14px",marginBottom:16
            }}>
              <span style={{fontSize:12,color:"var(--ink-muted)",flex:1}}>{tr.tripCode}</span>
              <span style={{fontWeight:800,fontSize:20,letterSpacing:"0.18em",color:"var(--terracotta)"}}>
                {showMembers.joinCode}
              </span>
              <button type="button" className="btn btn-secondary btn-sm"
                onClick={() => {
                  navigator.clipboard?.writeText(showMembers.joinCode);
                  toast.show(`Copied: ${showMembers.joinCode}`, "success");
                }}>📋</button>
            </div>

            {/* Creator row */}
            <div className="member-row">
              <div className="member-avatar">
                {user?.displayName?.[0]?.toUpperCase() || "?"}
              </div>
              <div className="member-info">
                <span className="member-name">{user?.displayName || "You"}</span>
                {user?.email && (
                  <span style={{fontSize:11,color:"var(--ink-muted)"}}>{user.email}</span>
                )}
                <span className="member-badge owner">👑 {tr.owner}</span>
              </div>
            </div>

            {/* Members */}
            {loadingMembers ? (
              <div style={{padding:"16px 0",textAlign:"center",color:"var(--ink-muted)",fontSize:13}}>
                Loading...
              </div>
            ) : memberProfiles.length === 0 && !showMembers.memberIds?.length ? (
              <div style={{padding:"16px 0",textAlign:"center",color:"var(--ink-muted)",fontSize:13}}>
                No one has joined yet. Share the code above!
              </div>
            ) : (
              memberProfiles.map(p => (
                <div key={p.uid} className="member-row">
                  <div className="member-avatar member-avatar-joined">
                    {p.displayName?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="member-info">
                    <span className="member-name">{p.displayName}</span>
                    {p.email && (
                      <span style={{fontSize:11,color:"var(--ink-muted)"}}>{p.email}</span>
                    )}
                    <span className="member-badge joined">{tr.youJoined}</span>
                  </div>
                  <button
                    className="btn btn-icon btn-sm"
                    style={{color:"var(--error)",marginLeft:"auto"}}
                    disabled={kicking === p.uid}
                    onClick={() => handleKick(showMembers, p.uid)}
                    title="Remove member"
                  >
                    {kicking === p.uid ? "…" : "✕"}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Join Trip Modal */}
      {showJoin && (
        <div className="modal-overlay" onClick={() => setShowJoin(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-header">
              <h2 className="modal-title">🔗 {tr.joinTrip}</h2>
              <button className="btn btn-icon" onClick={() => setShowJoin(false)}>✕</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <div className="form-group">
                <label className="form-label">{tr.joinCode}</label>
                <input
                  className="form-input"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  placeholder={tr.joinCodePlaceholder}
                  maxLength={6}
                  autoFocus
                  style={{letterSpacing:"0.2em",fontWeight:600,fontSize:18,textAlign:"center"}}
                  onKeyDown={e => e.key === "Enter" && handleJoin()}
                />
              </div>
              <div style={{display:"flex",gap:10}}>
                <button className="btn btn-secondary" style={{flex:1}} onClick={() => setShowJoin(false)}>
                  {tr.cancel}
                </button>
                <button className="btn btn-primary" style={{flex:1}} onClick={handleJoin} disabled={joining || !joinCode.trim()}>
                  {joining ? tr.saving : tr.joinTripBtn}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <TripModal
          trip={editTrip}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditTrip(null); }}
        />
      )}
    </div>
  );
}
