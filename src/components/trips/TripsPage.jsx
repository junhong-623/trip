import { useState } from "react";
import { useTrip } from "../../contexts/TripContext";
import { useAuth } from "../../contexts/AuthContext";
import { useLang } from "../../contexts/LangContext";
import { formatDate } from "../../utils/utils";
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
          <div className="empty-state-icon">✈️</div>
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
                      <span className="trip-member-count">
                        👥 {memberCount(trip)} {tr.membersCount}
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
