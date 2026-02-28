import { useState, useEffect, useCallback } from "react";
import { useLang } from "../../contexts/LangContext";
import { addReceipt, updateReceipt } from "../../services/firestore";
import { analyzeReceipt } from "../../services/api";
import { dicebearUrl, formatAmount, generateId, parseAmount } from "../../utils/utils";
import ItemEatersModal from "./ItemEatersModal";
import "./ReceiptModal.css";

export default function ReceiptModal({ receipt, people, tripId, currency, driveFolderId, onClose, toast }) {
  const { tr, t } = useLang();
  const [ocrLoading, setOcrLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Items in SEPARATE state — prevents typing from losing focus
  const [items, setItems] = useState([]);

  const [form, setForm] = useState({
    restaurantName: "",
    date: new Date().toISOString().slice(0, 10),
    totalAmount: "",
    payerId: people[0]?.id || "",
    participants: people.map(p => p.id),
    googleMapLink: "",
    lat: "",
    lng: "",
    ocrRawText: "",
  });

  useEffect(() => {
    if (receipt) {
      setForm({
        restaurantName: receipt.restaurantName || "",
        date: receipt.date || new Date().toISOString().slice(0, 10),
        totalAmount: receipt.totalAmount || "",
        payerId: receipt.payerId || people[0]?.id || "",
        participants: receipt.participants || people.map(p => p.id),
        googleMapLink: receipt.googleMapLink || "",
        lat: receipt.lat || "",
        lng: receipt.lng || "",
        ocrRawText: receipt.ocrRawText || "",
      });
      setItems(receipt.items || []);
    }
  }, [receipt]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // useCallback = stable function references, child inputs won't re-mount on parent re-render
  const addItem = useCallback(() => {
    setItems(prev => [...prev, { id: generateId(), name: "", price: "", eaters: [] }]);
  }, []);

  const removeItem = useCallback((id) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const updateItemName = useCallback((id, value) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, name: value } : i));
  }, []);

  const updateItemPrice = useCallback((id, value) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, price: value } : i));
  }, []);

  const updateItemEaters = useCallback((id, eaters) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, eaters } : i));
  }, []);

  const toggleParticipant = (pid) => {
    set("participants", form.participants.includes(pid)
      ? form.participants.filter(i => i !== pid)
      : [...form.participants, pid]);
  };

  const handleOCRUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrLoading(true);
    try {
      const result = await analyzeReceipt(file);
      if (result.restaurantName) set("restaurantName", result.restaurantName);
      if (result.date) set("date", result.date);
      if (result.totalAmount) set("totalAmount", result.totalAmount);
      if (result.rawText) set("ocrRawText", result.rawText);
      if (result.items?.length) {
        setItems(result.items.map(item => ({
          id: generateId(), name: item.name, price: item.price, eaters: []
        })));
      }
      toast.show(tr.receiptAnalyzed, "success");
    } catch (err) {
      toast.show(tr.ocrFailed, "error");
    } finally {
      setOcrLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.restaurantName || !form.totalAmount || !form.payerId) {
      toast.show(tr.fillRequired);
      return;
    }
    setSaving(true);
    try {
      const data = {
        ...form,
        totalAmount: parseAmount(form.totalAmount),
        items: items.map(i => ({ ...i, price: parseAmount(i.price) })),
        lat: form.lat ? Number(form.lat) : null,
        lng: form.lng ? Number(form.lng) : null,
      };
      if (receipt) {
        await updateReceipt(tripId, receipt.id, data);
        toast.show(tr.receiptUpdated, "success");
      } else {
        await addReceipt(tripId, data);
        toast.show(tr.receiptSaved, "success");
      }
      onClose();
    } catch (e) {
      toast.show(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const itemsTotal = items.reduce((s, i) => s + parseAmount(i.price), 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet receipt-modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-header">
          <h2 className="modal-title">{receipt ? tr.editReceipt : tr.addReceipt}</h2>
          <button className="btn btn-icon" onClick={onClose}>✕</button>
        </div>

        {!receipt && (
          <div className="ocr-banner">
            <div className="ocr-banner-text">
              <span className="ocr-icon">📷</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{tr.uploadReceiptPhoto}</div>
                <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>{tr.autoFillOCR}</div>
              </div>
            </div>
            <label className="btn btn-secondary btn-sm" style={{ cursor: "pointer" }}>
              {ocrLoading ? tr.analyzing : tr.uploadBtn}
              <input type="file" accept="image/*" onChange={handleOCRUpload}
                style={{ display: "none" }} disabled={ocrLoading} />
            </label>
          </div>
        )}

        {ocrLoading && (
          <div className="ocr-loading">
            <div className="loading-spinner" />
            <span>{tr.analyzingText}</span>
          </div>
        )}

        <div className="receipt-form">
          <div className="form-section">
            <div className="form-group">
              <label className="form-label">{tr.restaurantPlace}</label>
              <input className="form-input" value={form.restaurantName}
                onChange={e => set("restaurantName", e.target.value)}
                placeholder="Ichiran Ramen" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="form-group">
                <label className="form-label">{tr.date}</label>
                <input className="form-input" type="date" value={form.date}
                  onChange={e => set("date", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">{t(tr.total, currency)}</label>
                <input className="form-input" type="number" step="0.01"
                  value={form.totalAmount}
                  onChange={e => set("totalAmount", e.target.value)}
                  placeholder="0.00" />
              </div>
            </div>
          </div>

          <div className="form-section">
            <div className="section-title">{tr.whoPaid}</div>
            <div className="payer-row">
              {people.map(p => (
                <button key={p.id} type="button"
                  className={`payer-btn ${form.payerId === p.id ? "selected" : ""}`}
                  onClick={() => set("payerId", p.id)}>
                  <img src={p.avatarUrl || dicebearUrl(p.name)} alt={p.name} className="avatar avatar-sm" />
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="form-section">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div className="section-title" style={{ marginBottom: 0 }}>{tr.items}</div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={addItem}>
                + {tr.addItem}
              </button>
            </div>

            {items.length === 0 ? (
              <div style={{ textAlign: "center", padding: "16px", color: "var(--ink-muted)", fontSize: 13, background: "var(--sand)", borderRadius: 8 }}>
                {tr.noItemsNote}
              </div>
            ) : (
              <div className="items-list">
                {items.map(item => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    people={people}
                    onNameChange={updateItemName}
                    onPriceChange={updateItemPrice}
                    onRemove={removeItem}
                    onEditEaters={setEditingItem}
                  />
                ))}
                {itemsTotal > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderTop: "1px dashed var(--sand-deep)" }}>
                    <span style={{ color: "var(--ink-muted)" }}>{tr.itemsTotal}</span>
                    <span className="amount">{formatAmount(itemsTotal, currency)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {items.length === 0 && (
            <div className="form-section">
              <div className="section-title">{tr.splitAmong}</div>
              <div className="participants-row">
                <button type="button" className="chip"
                  style={{ background: "var(--terracotta-pale)", color: "var(--terracotta)" }}
                  onClick={() => set("participants", people.map(p => p.id))}>
                  {tr.all}
                </button>
                {people.map(p => (
                  <button key={p.id} type="button"
                    className={`chip ${form.participants.includes(p.id) ? "selected" : ""}`}
                    onClick={() => toggleParticipant(p.id)}>
                    <img src={p.avatarUrl || dicebearUrl(p.name)} alt={p.name}
                      style={{ width: 16, height: 16, borderRadius: "50%" }} />
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="form-section">
            <div className="section-title">{tr.location}</div>
            <div className="form-group">
              <input className="form-input" value={form.googleMapLink}
                onChange={e => set("googleMapLink", e.target.value)}
                placeholder={tr.googleMapsLink} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <input className="form-input" type="number" step="any"
                value={form.lat} onChange={e => set("lat", e.target.value)}
                placeholder={tr.latitude} />
              <input className="form-input" type="number" step="any"
                value={form.lng} onChange={e => set("lng", e.target.value)}
                placeholder={tr.longitude} />
            </div>
          </div>
        </div>

        <div style={{ padding: "12px 0 4px", display: "flex", gap: 10 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>{tr.cancel}</button>
          <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleSave} disabled={saving}>
            {saving ? tr.saving : receipt ? tr.saveChanges : tr.saveReceipt}
          </button>
        </div>

        {editingItem && (
          <ItemEatersModal
            item={editingItem}
            people={people}
            onSave={(eaters) => {
              updateItemEaters(editingItem.id, eaters);
              setEditingItem(null);
            }}
            onClose={() => setEditingItem(null)}
          />
        )}
      </div>
    </div>
  );
}

// Separate component = stable DOM node = inputs keep focus while typing
function ItemRow({ item, people, onNameChange, onPriceChange, onRemove, onEditEaters }) {
  return (
    <div className="item-row">
      <input
        className="form-input item-name-input"
        value={item.name}
        onChange={e => onNameChange(item.id, e.target.value)}
        placeholder="Item name"
      />
      <input
        className="form-input item-price-input"
        type="number"
        step="0.01"
        value={item.price}
        onChange={e => onPriceChange(item.id, e.target.value)}
        placeholder="0.00"
      />
      <button type="button" className="item-eaters-btn" onClick={() => onEditEaters(item)}>
        <div style={{ display: "flex", alignItems: "center", paddingLeft: 4 }}>
          {item.eaters.length === 0 ? (
            <span style={{ fontSize: 16 }}>👥</span>
          ) : (
            item.eaters.slice(0, 3).map(eid => {
              const p = people.find(x => x.id === eid);
              return p ? (
                <img key={eid}
                  src={p.avatarUrl || `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(p.name)}`}
                  alt={p.name}
                  style={{ width: 22, height: 22, borderRadius: "50%", marginLeft: -4, border: "2px solid white" }}
                />
              ) : null;
            })
          )}
          {item.eaters.length > 3 && (
            <span style={{ fontSize: 10, marginLeft: 2 }}>+{item.eaters.length - 3}</span>
          )}
        </div>
      </button>
      <button type="button" className="btn btn-icon btn-sm" onClick={() => onRemove(item.id)}>✕</button>
    </div>
  );
}
