import { useState } from "react";
import { useTrip } from "../../contexts/TripContext";
import { formatDate } from "../../utils/utils";
import TripModal from "./TripModal";
import "./TripsPage.css";

export default function TripsPage({ toast, onNavigate }) {
  const { trips, activeTrip, loading, selectTrip, createTrip, updateTrip, deleteTrip } = useTrip();
  const [showModal, setShowModal] = useState(false);
  const [editTrip, setEditTrip] = useState(null);

  const handleSave = async (data) => {
    try {
      if (editTrip) {
        await updateTrip(editTrip.id, data);
        toast.show("Trip updated ✓", "success");
      } else {
        await createTrip(data);
        toast.show("Trip created ✓", "success");
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
    if (!confirm(`Delete "${trip.name}"? This cannot be undone.`)) return;
    await deleteTrip(trip.id);
    toast.show("Trip deleted");
  };

  return (
    <div>
      <div className="trips-header">
        <div>
          <h1 className="page-title">My Trips</h1>
          <p className="page-subtitle">Select or create a trip to get started</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditTrip(null); setShowModal(true); }}>
          + New Trip
        </button>
      </div>

      {loading ? (
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {[1,2].map(i => <div key={i} className="skeleton" style={{height:110,borderRadius:14}} />)}
        </div>
      ) : trips.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">✈️</div>
          <div className="empty-state-title">No trips yet</div>
          <div className="empty-state-text">Create your first trip to start tracking expenses together.</div>
          <button className="btn btn-primary" style={{marginTop:16}} onClick={() => setShowModal(true)}>
            Create Your First Trip
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
                <div className="trip-card-icon">
                  {trip.emoji || "🌍"}
                </div>
                <div className="trip-card-info">
                  <div className="trip-card-name">{trip.name}</div>
                  <div className="trip-card-dates">
                    {formatDate(trip.startDate)} — {formatDate(trip.endDate)}
                  </div>
                </div>
                <div className="trip-card-actions">
                  <button className="btn btn-icon btn-sm" onClick={e => handleEdit(trip, e)} title="Edit">✏</button>
                  <button className="btn btn-icon btn-sm" onClick={e => handleDelete(trip, e)} title="Delete">🗑</button>
                </div>
              </div>
              <div className="trip-card-footer">
                <span className="badge badge-terracotta">{trip.baseCurrency}</span>
                {activeTrip?.id === trip.id && (
                  <span className="badge badge-sage">Active</span>
                )}
              </div>
            </div>
          ))}
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
