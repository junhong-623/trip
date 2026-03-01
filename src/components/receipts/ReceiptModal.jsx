import { useState, useEffect, useCallback } from "react";
import { useLang } from "../../contexts/LangContext";
import { addReceipt, updateReceipt } from "../../services/firestore";
import { analyzeReceipt } from "../../services/api";
import { dicebearUrl, formatAmount, generateId, parseAmount, roundMoney } from "../../utils/utils";
import ItemEatersModal from "./ItemEatersModal";
import "./ReceiptModal.css";

export default function ReceiptModal({ receipt, people, tripId, currency, driveFolderId, onClose, toast }) {
  const { tr, t } = useLang();
  const [ocrLoading, setOcrLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingEatersItem, setEditingEatersItem] = useState(null);
  const [showItemEditor, setShowItemEditor] = useState(false);

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

  const totalAmount = parseAmount(form.totalAmount);
  const itemsTotal = items.reduce((s, i) => s + parseAmount(i.price), 0);
  const itemsOverBudget = totalAmount > 0 && itemsTotal > totalAmount + 0.01;

  const addItem = useCallback(() => {
    setItems(prev => [...prev, { id: generateId(), name: "", price: "", eaters: [] }]);
  }, []);
  const removeItem = useCallback((id) => { setItems(prev => prev.filter(i => i.id !== id)); }, []);
  const updateItemName = useCallback((id, v) => { setItems(prev => prev.map(i => i.id === id ? { ...i, name: v } : i)); }, []);
  const updateItemPrice = useCallback((id, v) => { setItems(prev => prev.map(i => i.id === id ? { ...i, price: v } : i)); }, []);
  const updateItemEaters = useCallback((id, eaters) => { setItems(prev => prev.map(i => i.id === id ? { ...i, eaters } : i)); }, []);

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
        setItems(result.items.map(item => ({ id: generateId(), name: item.name, price: item.price, eaters: [] })));
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
      toast.show(tr.fillRequired); return;
    }
    if (itemsOverBudget) {
      toast.show(tr.itemsOverBudget || "Items total exceeds receipt amount", "error"); return;
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="receipt-modal-wrap" onClick={e => e.stopPropagation()}>

        {/* ── Main form panel ── */}
        <div className={`receipt-panel main-panel ${showItemEditor ? "slide-left" : ""}`}>
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
                  onChange={e => set("restaurantName", e.target.value)} placeholder="Ichiran Ramen" />
              </div>

              {/* FIX: date on its own row (smaller), amount full width below */}
              <div className="form-group">
                <label className="form-label">{tr.date}</label>
                <input className="form-input date-input-compact" type="date" value={form.date}
                  onChange={e => set("date", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">{t(tr.total, currency)}</label>
                {/* inputmode="decimal" triggers numeric keypad on mobile */}
                <input className="form-input" type="number" step="0.01"
                  inputMode="decimal"
                  value={form.totalAmount}
                  onChange={e => set("totalAmount", e.target.value)}
                  placeholder="0.00" />
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
              <div className="items-section-header">
                <div className="section-title" style={{ marginBottom: 0 }}>{tr.items}</div>
                <button type="button" className="btn btn-secondary btn-sm items-edit-btn"
                  onClick={() => setShowItemEditor(true)}>
                  ✏ {tr.addItem || "Edit Items"}
                  {items.length > 0 && <span className="items-count-badge">{items.length}</span>}
                </button>
              </div>

              {items.length === 0 ? (
                <div className="items-empty-display">
                  <span>—</span>
                  <span>{tr.noItemsNote}</span>
                </div>
              ) : (
                <div className="items-display-list">
                  {items.map(item => (
                    <div key={item.id} className="item-display-row">
                      <span className="item-display-name">{item.name || "—"}</span>
                      <span className="item-display-price amount">
                        {item.price ? formatAmount(parseAmount(item.price), currency) : "—"}
                      </span>
                      <div className="item-display-eaters">
                        {(item.eaters || []).map(eid => {
                          const p = people.find(x => x.id === eid);
                          return p ? <img key={eid} src={p.avatarUrl || dicebearUrl(p.name)} alt={p.name}
                            style={{ width: 20, height: 20, borderRadius: "50%", marginLeft: -4, border: "2px solid white" }} /> : null;
                        })}
                        {item.eaters?.length === 0 && <span style={{ fontSize: 11, color: "var(--ink-muted)" }}>👥</span>}
                      </div>
                    </div>
                  ))}
                  <div className={`items-total-row ${itemsOverBudget ? "over-budget" : ""}`}>
                    <span>{tr.itemsTotal}</span>
                    <span className="amount">{formatAmount(itemsTotal, currency)}</span>
                    {totalAmount > 0 && (
                      <span className="items-budget-hint">
                        {itemsOverBudget
                          ? `⚠ ${tr.exceeds || "Exceeds"} ${formatAmount(itemsTotal - totalAmount, currency)}`
                          : `✓ ${formatAmount(totalAmount - itemsTotal, currency)} ${tr.remaining || "remaining"}`}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {items.length === 0 && (
              <div className="form-section">
                <div className="section-title">{tr.splitAmong}</div>
                <div className="participants-row">
                  <button type="button" className="chip"
                    style={{ background: "var(--terracotta-pale)", color: "var(--terracotta)" }}
                    onClick={() => set("participants", people.map(p => p.id))}>{tr.all}</button>
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
                <input className="form-input" type="number" step="any" inputMode="decimal"
                  value={form.lat} onChange={e => set("lat", e.target.value)} placeholder={tr.latitude} />
                <input className="form-input" type="number" step="any" inputMode="decimal"
                  value={form.lng} onChange={e => set("lng", e.target.value)} placeholder={tr.longitude} />
              </div>
            </div>
          </div>

          <div style={{ padding: "12px 0 4px", display: "flex", gap: 10 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>{tr.cancel}</button>
            <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleSave} disabled={saving || itemsOverBudget}>
              {saving ? tr.saving : receipt ? tr.saveChanges : tr.saveReceipt}
            </button>
          </div>
        </div>

        {/* ── Item editor slide panel ── */}
        <div className={`receipt-panel item-editor-panel ${showItemEditor ? "slide-in" : ""}`}>
          <div className="modal-handle" />
          <div className="modal-header">
            <button className="btn btn-icon" onClick={() => setShowItemEditor(false)}>←</button>
            <h2 className="modal-title">{tr.items}</h2>
            <button type="button" className="btn btn-ghost btn-sm" onClick={addItem}>
              + {tr.addItem}
            </button>
          </div>

          {totalAmount > 0 && (
            <div className="budget-bar-wrap">
              <div className="budget-bar-track">
                <div className={`budget-bar-fill ${itemsOverBudget ? "over" : ""}`}
                  style={{ width: `${Math.min(100, (itemsTotal / totalAmount) * 100)}%` }} />
              </div>
              <div className={`budget-bar-label ${itemsOverBudget ? "over" : ""}`}>
                {itemsOverBudget
                  ? `⚠ ${formatAmount(itemsTotal, currency)} / ${formatAmount(totalAmount, currency)}`
                  : `${formatAmount(itemsTotal, currency)} / ${formatAmount(totalAmount, currency)} — ${formatAmount(totalAmount - itemsTotal, currency)} ${tr.remaining || "left"}`
                }
              </div>
            </div>
          )}

          <div className="item-editor-list">
            {items.length === 0 ? (
              <div className="empty-state" style={{ padding: "32px 0" }}>
                <div className="empty-state-icon">🍱</div>
                <div className="empty-state-title">No items yet</div>
                <div className="empty-state-text">Tap "+ Add Item" to start adding dishes.</div>
              </div>
            ) : (
              items.map(item => (
                <ItemEditorRow key={item.id} item={item} people={people} currency={currency}
                  totalAmount={totalAmount} itemsTotal={itemsTotal}
                  onNameChange={updateItemName} onPriceChange={updateItemPrice}
                  onRemove={removeItem} onEditEaters={setEditingEatersItem} />
              ))
            )}
          </div>

          <div style={{ padding: "12px 0 4px" }}>
            <button className="btn btn-primary" style={{ width: "100%" }}
              onClick={() => setShowItemEditor(false)}>Done ✓</button>
          </div>
        </div>
      </div>

      {editingEatersItem && (
        <ItemEatersModal item={editingEatersItem} people={people}
          onSave={(eaters) => { updateItemEaters(editingEatersItem.id, eaters); setEditingEatersItem(null); }}
          onClose={() => setEditingEatersItem(null)} />
      )}
    </div>
  );
}

function ItemEditorRow({ item, people, currency, totalAmount, itemsTotal, onNameChange, onPriceChange, onRemove, onEditEaters }) {
  const itemPrice = parseAmount(item.price);
  const otherTotal = roundMoney(itemsTotal - itemPrice);
  const isOver = totalAmount > 0 && roundMoney(otherTotal + itemPrice) > totalAmount + 0.01;

  return (
    <div className="item-editor-row">
      <div className="item-editor-fields">
        <input className="form-input" value={item.name}
          onChange={e => onNameChange(item.id, e.target.value)}
          placeholder="Item name" style={{ flex: 1 }} />
        <div className="item-price-wrap">
          <input className={`form-input item-price-field ${isOver ? "price-over" : ""}`}
            type="number" step="0.01" inputMode="decimal"
            value={item.price}
            onChange={e => onPriceChange(item.id, e.target.value)}
            placeholder="0.00" />
          {isOver && <span className="price-over-hint">Over</span>}
        </div>
      </div>
      <div className="item-editor-bottom">
        <button type="button" className="item-eaters-selector" onClick={() => onEditEaters(item)}>
          {item.eaters.length === 0 ? (
            <span className="eaters-placeholder">👥 Tap to assign people</span>
          ) : (
            <div className="eaters-avatars">
              {item.eaters.slice(0, 5).map(eid => {
                const p = people.find(x => x.id === eid);
                return p ? <img key={eid}
                  src={p.avatarUrl || `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(p.name)}`}
                  alt={p.name} title={p.name}
                  style={{ width: 26, height: 26, borderRadius: "50%", marginLeft: -6, border: "2px solid white" }} /> : null;
              })}
              {item.eaters.length > 5 && <span style={{ fontSize: 11, color: "var(--ink-muted)", marginLeft: 4 }}>+{item.eaters.length - 5}</span>}
              <span style={{ fontSize: 12, color: "var(--ink-muted)", marginLeft: 6 }}>
                {item.eaters.length === 1 ? "1 person" : `${item.eaters.length} people`}
                {itemPrice > 0 && item.eaters.length > 0 && ` · ${formatAmount(roundMoney(itemPrice / item.eaters.length), currency)} each`}
              </span>
            </div>
          )}
        </button>
        <button type="button" className="btn btn-danger btn-sm item-remove-btn" onClick={() => onRemove(item.id)}>🗑</button>
      </div>
    </div>
  );
}
