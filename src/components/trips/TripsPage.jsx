import { useState } from "react";
import { useTrip } from "../../contexts/TripContext";
import { useLang } from "../../contexts/LangContext";
import { formatDate } from "../../utils/utils";
import TripModal from "./TripModal";
import "./TripsPage.css";

export default function TripsPage({ toast, onNavigate }) {
  const { trips, activeTrip, loading, selectTrip, createTrip, updateTrip, deleteTrip } = useTrip();
  const { tr, t } = useLang();
  const [showModal, setShowModal] = useState(false);
  const [editTrip, setEditTrip] = useState(null);

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

  return (
    <div>
      <div className="trips-header">
        <div>
          <h1 className="page-title">{tr.myTrips}</h1>
          <p className="page-subtitle">{tr.selectOrCreate}</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditTrip(null); setShowModal(true); }}>
          + {tr.newTrip}
        </button>
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
                </div>
                <div className="trip-card-actions">
                  <button className="btn btn-icon btn-sm" onClick={e => handleEdit(trip, e)}>✏</button>
                  <button className="btn btn-icon btn-sm" onClick={e => handleDelete(trip, e)}>🗑</button>
                </div>
              </div>
              <div className="trip-card-footer">
                <span className="badge badge-terracotta">{trip.baseCurrency}</span>
                {activeTrip?.id === trip.id && <span className="badge badge-sage">{tr.active}</span>}
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
