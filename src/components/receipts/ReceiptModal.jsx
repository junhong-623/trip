import { useState, useEffect, useRef } from "react";
import { addReceipt, updateReceipt } from "../../services/firestore";
import { analyzeReceipt } from "../../services/api";
import { dicebearUrl, formatAmount, generateId, parseAmount } from "../../utils/utils";
import ItemEatersModal from "./ItemEatersModal";
import "./ReceiptModal.css";

export default function ReceiptModal({ receipt, people, tripId, currency, driveFolderId, onClose, toast }) {
  const [step, setStep] = useState("form"); // form | items
  const [ocr, setOcr] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrFile, setOcrFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const [form, setForm] = useState({
    restaurantName: "", date: new Date().toISOString().slice(0,10),
    totalAmount: "", payerId: people[0]?.id || "",
    participants: people.map(p => p.id),
    googleMapLink: "", lat: "", lng: "",
    items: [], ocrRawText: "",
  });

  useEffect(() => {
    if (receipt) {
      setForm({
        restaurantName: receipt.restaurantName || "",
        date: receipt.date || new Date().toISOString().slice(0,10),
        totalAmount: receipt.totalAmount || "",
        payerId: receipt.payerId || people[0]?.id || "",
        participants: receipt.participants || people.map(p => p.id),
        googleMapLink: receipt.googleMapLink || "",
        lat: receipt.lat || "", lng: receipt.lng || "",
        items: receipt.items || [],
        ocrRawText: receipt.ocrRawText || "",
      });
    }
  }, [receipt]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // OCR
  const handleOCRUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrFile(file);
    setOcrLoading(true);
    try {
      const result = await analyzeReceipt(file);
      setOcr(result);
      // Pre-fill form with OCR data
      if (result.restaurantName) set("restaurantName", result.restaurantName);
      if (result.date) set("date", result.date);
      if (result.totalAmount) set("totalAmount", result.totalAmount);
      if (result.rawText) set("ocrRawText", result.rawText);
      if (result.items?.length) {
        set("items", result.items.map(item => ({
          id: generateId(), name: item.name, price: item.price, eaters: []
        })));
      }
      toast.show("Receipt analyzed! Please review.", "success");
    } catch (err) {
      toast.show("OCR failed — please fill in manually", "error");
    } finally {
      setOcrLoading(false);
    }
  };

  // Items management
  const addItem = () => {
    set("items", [...form.items, { id: generateId(), name: "", price: "", eaters: [] }]);
  };
  const removeItem = (id) => set("items", form.items.filter(i => i.id !== id));
  const updateItem = (id, k, v) => set("items", form.items.map(i => i.id === id ? { ...i, [k]: v } : i));

  const toggleParticipant = (pid) => {
    set("participants", form.participants.includes(pid)
      ? form.participants.filter(i => i !== pid)
      : [...form.participants, pid]);
  };

  const handleSave = async () => {
    if (!form.restaurantName || !form.totalAmount || !form.payerId) {
      toast.show("Please fill in required fields");
      return;
    }
    setSaving(true);
    try {
      const data = {
        ...form,
        totalAmount: parseAmount(form.totalAmount),
        items: form.items.map(i => ({ ...i, price: parseAmount(i.price) })),
        lat: form.lat ? Number(form.lat) : null,
        lng: form.lng ? Number(form.lng) : null,
      };
      if (receipt) {
        await updateReceipt(tripId, receipt.id, data);
        toast.show("Receipt updated ✓", "success");
      } else {
        await addReceipt(tripId, data);
        toast.show("Receipt saved ✓", "success");
      }
      onClose();
    } catch (e) {
      toast.show(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const itemsTotal = form.items.reduce((s, i) => s + parseAmount(i.price), 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet receipt-modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-header">
          <h2 className="modal-title">{receipt ? "Edit Receipt" : "Add Receipt"}</h2>
          <button className="btn btn-icon" onClick={onClose}>✕</button>
        </div>

        {/* OCR Upload Banner */}
        {!receipt && (
          <div className="ocr-banner">
            <div className="ocr-banner-text">
              <span className="ocr-icon">📷</span>
              <div>
                <div style={{fontWeight:600,fontSize:14}}>Upload receipt photo</div>
                <div style={{fontSize:12,color:"var(--ink-muted)"}}>Auto-fill with OCR analysis</div>
              </div>
            </div>
            <label className="btn btn-secondary btn-sm" style={{cursor:"pointer"}}>
              {ocrLoading ? "Analyzing…" : "Upload"}
              <input type="file" accept="image/*" onChange={handleOCRUpload} style={{display:"none"}} disabled={ocrLoading} />
            </label>
          </div>
        )}

        {ocrLoading && (
          <div className="ocr-loading">
            <div className="loading-spinner" />
            <span>Analyzing receipt with Vision API…</span>
          </div>
        )}

        <div className="receipt-form">
          {/* Basic Info */}
          <div className="form-section">
            <div className="form-group">
              <label className="form-label">Restaurant / Place *</label>
              <input className="form-input" value={form.restaurantName}
                onChange={e => set("restaurantName", e.target.value)}
                placeholder="Ichiran Ramen" />
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input className="form-input" type="date" value={form.date}
                  onChange={e => set("date", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Total ({currency}) *</label>
                <input className="form-input" type="number" step="0.01" value={form.totalAmount}
                  onChange={e => set("totalAmount", e.target.value)} placeholder="0.00" />
              </div>
            </div>
          </div>

          {/* Payer */}
          <div className="form-section">
            <div className="section-title">Who Paid?</div>
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

          {/* Items */}
          <div className="form-section">
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <div className="section-title" style={{marginBottom:0}}>Items</div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={addItem}>+ Add Item</button>
            </div>

            {form.items.length === 0 ? (
              <div style={{textAlign:"center",padding:"16px",color:"var(--ink-muted)",fontSize:13,background:"var(--sand)",borderRadius:8}}>
                No items — total will be split among participants
              </div>
            ) : (
              <div className="items-list">
                {form.items.map(item => (
                  <div key={item.id} className="item-row">
                    <input className="form-input item-name-input" value={item.name}
                      onChange={e => updateItem(item.id, "name", e.target.value)}
                      placeholder="Item name" />
                    <input className="form-input item-price-input" type="number" step="0.01"
                      value={item.price} onChange={e => updateItem(item.id, "price", e.target.value)}
                      placeholder="0.00" />
                    <button type="button" className="item-eaters-btn"
                      onClick={() => setEditingItem(item)}>
                      <div style={{display:"flex",alignItems:"center"}}>
                        {item.eaters.length === 0 ? (
                          <span style={{fontSize:12,color:"var(--ink-muted)"}}>👥</span>
                        ) : item.eaters.slice(0,3).map(eid => {
                          const p = people.find(x => x.id === eid);
                          return p ? <img key={eid} src={p.avatarUrl || dicebearUrl(p.name)} alt={p.name}
                            className="avatar" style={{width:22,height:22,marginLeft:-4,border:"2px solid white"}} /> : null;
                        })}
                        {item.eaters.length > 3 && <span style={{fontSize:10,marginLeft:2}}>+{item.eaters.length-3}</span>}
                      </div>
                    </button>
                    <button type="button" className="btn btn-icon btn-sm" onClick={() => removeItem(item.id)}>✕</button>
                  </div>
                ))}
                {itemsTotal > 0 && (
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"6px 0",borderTop:"1px dashed var(--sand-deep)"}}>
                    <span style={{color:"var(--ink-muted)"}}>Items total</span>
                    <span className="amount">{formatAmount(itemsTotal, currency)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Participants (when no items) */}
          {form.items.length === 0 && (
            <div className="form-section">
              <div className="section-title">Split Among</div>
              <div className="participants-row">
                <button type="button" className="chip"
                  style={{background:"var(--terracotta-pale)",color:"var(--terracotta)"}}
                  onClick={() => set("participants", people.map(p => p.id))}>
                  All
                </button>
                {people.map(p => (
                  <button key={p.id} type="button"
                    className={`chip ${form.participants.includes(p.id) ? "selected" : ""}`}
                    onClick={() => toggleParticipant(p.id)}>
                    <img src={p.avatarUrl || dicebearUrl(p.name)} alt={p.name}
                      style={{width:16,height:16,borderRadius:"50%"}} />
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Map / Location */}
          <div className="form-section">
            <div className="section-title">Location (optional)</div>
            <div className="form-group">
              <input className="form-input" value={form.googleMapLink}
                onChange={e => set("googleMapLink", e.target.value)}
                placeholder="Google Maps link" />
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <input className="form-input" type="number" step="any" value={form.lat}
                onChange={e => set("lat", e.target.value)} placeholder="Latitude" />
              <input className="form-input" type="number" step="any" value={form.lng}
                onChange={e => set("lng", e.target.value)} placeholder="Longitude" />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div style={{padding:"12px 0 4px",display:"flex",gap:10}}>
          <button className="btn btn-secondary" style={{flex:1}} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{flex:2}} onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : receipt ? "Save Changes" : "Save Receipt"}
          </button>
        </div>

        {editingItem && (
          <ItemEatersModal
            item={editingItem}
            people={people}
            onSave={(eaters) => {
              updateItem(editingItem.id, "eaters", eaters);
              setEditingItem(null);
            }}
            onClose={() => setEditingItem(null)}
          />
        )}
      </div>
    </div>
  );
}
