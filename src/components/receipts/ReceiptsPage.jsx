import { useState, useEffect } from "react";
import { useTrip } from "../../contexts/TripContext";
import { useLang } from "../../contexts/LangContext";
import { subscribeReceipts, subscribePeople, deleteReceipt } from "../../services/firestore";
import { formatAmount } from "../../utils/utils";
import ReceiptModal from "./ReceiptModal";
import ReceiptCard from "./ReceiptCard";
import "./ReceiptsPage.css";

export default function ReceiptsPage({ toast }) {
  const { activeTrip } = useTrip();
  const { tr, t } = useLang();
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
    if (!confirm(tr.confirmDeleteReceipt)) return;
    await deleteReceipt(activeTrip.id, receipt.id);
    toast.show(tr.receiptDeleted);
  };

  if (!activeTrip) return (
    <div className="empty-state">
      <div className="empty-state-icon"><img src="/trip/icons/icon-192.png" alt="MateTrip" style={{width:64,height:64,borderRadius:16,opacity:0.85}} /></div>
      <div className="empty-state-title">{tr.noTripSelected}</div>
    </div>
  );

  const subtitle = receipts.length === 1
    ? t(tr.receiptsSubtitle, receipts.length, formatAmount(totalSpend, activeTrip.baseCurrency))
    : t(tr.receiptsSubtitlePlural, receipts.length, formatAmount(totalSpend, activeTrip.baseCurrency));

  return (
    <div>
      <div className="receipts-header">
        <div>
          <h1 className="page-title">{tr.receiptsTitle}</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditReceipt(null); setShowModal(true); }}>
          + {tr.addReceipt}
        </button>
      </div>

      {receipts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🧾</div>
          <div className="empty-state-title">{tr.noReceiptsYet}</div>
          <div className="empty-state-text">{tr.addFirstExpense}</div>
          <button className="btn btn-primary" style={{marginTop:16}} onClick={() => setShowModal(true)}>
            {tr.addFirstReceipt}
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
