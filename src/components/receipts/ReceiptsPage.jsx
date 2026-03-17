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
  const [selectedTag, setSelectedTag] = useState(null);

  useEffect(() => {
    if (!activeTrip?.id) return;
    const u1 = subscribeReceipts(activeTrip.id, setReceipts);
    const u2 = subscribePeople(activeTrip.id, setPeople);
    return () => { u1(); u2(); };
  }, [activeTrip?.id]);

  const allTags = [...new Set(receipts.flatMap(r => r.tags || []))].sort();
  const filtered = selectedTag ? receipts.filter(r => r.tags?.includes(selectedTag)) : receipts;
  const totalSpend = filtered.reduce((s, r) => s + (r.totalAmount || 0), 0);

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

  const subtitle = filtered.length === 1
    ? t(tr.receiptsSubtitle, filtered.length, formatAmount(totalSpend, activeTrip.baseCurrency))
    : t(tr.receiptsSubtitlePlural, filtered.length, formatAmount(totalSpend, activeTrip.baseCurrency));

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

      {allTags.length > 0 && (
        <div className="tag-filter-bar">
          <button
            className={`tag-filter-chip ${!selectedTag ? "active" : ""}`}
            onClick={() => setSelectedTag(null)}>
            {tr.tabAll || "全部"}
          </button>
          {allTags.map(tag => (
            <button key={tag}
              className={`tag-filter-chip ${selectedTag === tag ? "active" : ""}`}
              onClick={() => setSelectedTag(t => t === tag ? null : tag)}>
              {tag}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
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
          {filtered.map(r => (
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
          allTags={allTags}
        />
      )}
    </div>
  );
}
