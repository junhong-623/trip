import { useState, useEffect } from "react";
import { useTrip } from "../../contexts/TripContext";
import { subscribeReceipts, subscribePeople, deleteReceipt } from "../../services/firestore";
import { formatAmount, formatDateShort } from "../../utils/utils";
import ReceiptModal from "./ReceiptModal";
import ReceiptCard from "./ReceiptCard";
import "./ReceiptsPage.css";

export default function ReceiptsPage({ toast }) {
  const { activeTrip } = useTrip();
  const [receipts, setReceipts] = useState([]);
  const [people, setPeople] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editReceipt, setEditReceipt] = useState(null);

  useEffect(() => {
    if (!activeTrip?.id) return;
    const u1 = subscribeReceipts(activeTrip.id, setReceipts);
    const u2 = subscribePeople(activeTrip.id, setPeople);
    return () => { u1(); u2(); };
  }, [activeTrip?.id]);

  const totalSpend = receipts.reduce((s, r) => s + (r.totalAmount || 0), 0);

  const handleDelete = async (receipt) => {
    if (!confirm("Delete this receipt?")) return;
    await deleteReceipt(activeTrip.id, receipt.id);
    toast.show("Receipt deleted");
  };

  if (!activeTrip) return (
    <div className="empty-state">
      <div className="empty-state-icon">✈️</div>
      <div className="empty-state-title">No trip selected</div>
    </div>
  );

  return (
    <div>
      <div className="receipts-header">
        <div>
          <h1 className="page-title">Receipts</h1>
          <p className="page-subtitle">{receipts.length} receipt{receipts.length!==1?"s":""} · {formatAmount(totalSpend, activeTrip.baseCurrency)} total</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditReceipt(null); setShowModal(true); }}>
          + Add
        </button>
      </div>

      {receipts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🧾</div>
          <div className="empty-state-title">No receipts yet</div>
          <div className="empty-state-text">Add your first expense or upload a receipt photo.</div>
          <button className="btn btn-primary" style={{marginTop:16}} onClick={() => setShowModal(true)}>
            Add First Receipt
          </button>
        </div>
      ) : (
        <div className="receipts-list">
          {receipts.map(r => (
            <ReceiptCard
              key={r.id}
              receipt={r}
              people={people}
              currency={activeTrip.baseCurrency}
              onEdit={() => { setEditReceipt(r); setShowModal(true); }}
              onDelete={() => handleDelete(r)}
            />
          ))}
        </div>
      )}

      {showModal && (
        <ReceiptModal
          receipt={editReceipt}
          people={people}
          tripId={activeTrip.id}
          currency={activeTrip.baseCurrency}
          driveFolderId={activeTrip.driveFolderId}
          onClose={() => { setShowModal(false); setEditReceipt(null); }}
          toast={toast}
        />
      )}
    </div>
  );
}
