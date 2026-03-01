import { useState, useEffect } from "react";
import { toInputDate } from "../../utils/utils";

const CURRENCIES = ["USD","EUR","GBP","JPY","CNY","TWD","HKD","SGD","AUD","CAD","KRW","THB","MYR"];
const EMOJIS = ["🌍","🗺","✈️","🏖","🏔","🌸","🗼","🏰","🌴","🎌","🧳","🌊","🏕","🎢"];

export default function TripModal({ trip, onSave, onClose }) {
  const [form, setForm] = useState({
    name: "", startDate: "", endDate: "",
    baseCurrency: "MYR", emoji: "🌍", driveFolderId: "",
  });

  useEffect(() => {
    if (trip) {
      setForm({
        name: trip.name || "",
        startDate: toInputDate(trip.startDate) || "",
        endDate: toInputDate(trip.endDate) || "",
        baseCurrency: trip.baseCurrency || "USD",
        emoji: trip.emoji || "🌍",
        driveFolderId: trip.driveFolderId || "",
      });
    }
  }, [trip]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-header">
          <h2 className="modal-title">{trip ? "Edit Trip" : "New Trip"}</h2>
          <button className="btn btn-icon" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{display:"flex",flexDirection:"column",gap:16}}>
          {/* Emoji picker */}
          <div className="form-group">
            <label className="form-label">Icon</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
              {EMOJIS.map(e => (
                <button key={e} type="button"
                  style={{
                    width:40, height:40, borderRadius:10, border: form.emoji === e ? "2px solid var(--terracotta)" : "2px solid var(--sand-deep)",
                    background: form.emoji === e ? "var(--terracotta-pale)" : "white",
                    fontSize:22, cursor:"pointer", transition:"all 0.15s"
                  }}
                  onClick={() => set("emoji", e)}>{e}</button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Trip Name *</label>
            <input className="form-input" required value={form.name} onChange={e => set("name", e.target.value)} placeholder="Japan Spring 2025" />
          </div>

          <div className="form-group">
            <label className="form-label">Start Date</label>
            <input className="form-input" type="date" value={form.startDate} onChange={e => set("startDate", e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">End Date</label>
            <input className="form-input" type="date" value={form.endDate} onChange={e => set("endDate", e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Base Currency</label>
            <select className="form-select" value={form.baseCurrency} onChange={e => set("baseCurrency", e.target.value)}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <p className="form-hint">All amounts in this trip will use this currency.</p>
          </div>

          <div className="form-group">
            <label className="form-label">Google Drive Folder ID <span style={{color:"var(--ink-muted)",fontWeight:400}}>(optional)</span></label>
            <input className="form-input" value={form.driveFolderId} onChange={e => set("driveFolderId", e.target.value)} placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs" />
            <p className="form-hint">Photos and receipts will be uploaded to this Drive folder.</p>
          </div>

          <div style={{display:"flex",gap:10,marginTop:4}}>
            <button type="button" className="btn btn-secondary" style={{flex:1}} onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" style={{flex:1}} disabled={saving}>
              {saving ? "Saving…" : trip ? "Save Changes" : "Create Trip"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
