import { useState, useEffect } from "react";
import { useLang } from "../../contexts/LangContext";
import { toInputDate } from "../../utils/utils";

const CURRENCIES = ["USD","EUR","GBP","JPY","CNY","TWD","HKD","SGD","AUD","CAD","KRW","THB","MYR"];
const EMOJIS = ["🌍","🗺","✈️","🏖","🏔","🌸","🗼","🏰","🌴","🎌","🧳","🌊","🏕","🎢"];


// Pin modal-sheet to visual viewport when keyboard opens
function useModalKeyboard() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const sheet = document.querySelector(".modal-overlay .modal-sheet");
      if (!sheet) return;
      const bottom = window.innerHeight - (vv.offsetTop + vv.height);
      sheet.style.marginBottom = `${Math.max(0, bottom)}px`;
      sheet.style.maxHeight    = `${vv.height * 0.92}px`;
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      const sheet = document.querySelector(".modal-overlay .modal-sheet");
      if (sheet) { sheet.style.marginBottom = ""; sheet.style.maxHeight = ""; }
    };
  }, []);
}

const scrollOnFocus = (e) => {
  const el = e.target;
  setTimeout(() => {
    const sheet = el.closest(".modal-sheet");
    if (!sheet) return;
    const elRect    = el.getBoundingClientRect();
    const sheetRect = sheet.getBoundingClientRect();
    const overflow  = elRect.bottom - (sheetRect.bottom - 16);
    if (overflow > 0) sheet.scrollBy({ top: overflow + 24, behavior: "smooth" });
  }, 350);
};

export default function TripModal({ trip, onSave, onClose }) {
  const { tr } = useLang();
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
  useModalKeyboard();

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
          <h2 className="modal-title">{trip ? tr.editTrip : tr.newTrip}</h2>
          <button className="btn btn-icon" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{display:"flex",flexDirection:"column",gap:16}}>
          {/* Join Code — show for existing trips */}
          {trip?.joinCode && (
            <div className="form-group">
              <label className="form-label">{tr.tripCode}</label>
              <div style={{
                display:"flex",alignItems:"center",gap:10,
                background:"var(--sand)",borderRadius:10,padding:"10px 14px"
              }}>
                <span style={{
                  fontWeight:800,fontSize:22,letterSpacing:"0.2em",
                  color:"var(--terracotta)",flex:1,textAlign:"center"
                }}>{trip.joinCode}</span>
                <button type="button" className="btn btn-secondary btn-sm"
                  onClick={() => {
                    navigator.clipboard?.writeText(trip.joinCode);
                  }}>
                  📋
                </button>
              </div>
              <p className="form-hint">{tr.tripCodeHint}</p>
            </div>
          )}


          {/* Emoji picker */}
          <div className="form-group">
            <label className="form-label">{tr.icon}</label>
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
            <label className="form-label">{tr.tripName} *</label>
            <input className="form-input" required value={form.name} onChange={e => set("name", e.target.value)} onFocus={scrollOnFocus} placeholder="Japan Spring 2025" />
          </div>

          <div className="form-group">
            <label className="form-label">{tr.startDate}</label>
            <input className="form-input" type="date" value={form.startDate} onChange={e => set("startDate", e.target.value)} onFocus={scrollOnFocus} />
          </div>
          <div className="form-group">
            <label className="form-label">{tr.endDate}</label>
            <input className="form-input" type="date" value={form.endDate} onChange={e => set("endDate", e.target.value)} onFocus={scrollOnFocus} />
          </div>

          <div className="form-group">
            <label className="form-label">{tr.baseCurrency}</label>
            <select className="form-select" value={form.baseCurrency} onChange={e => set("baseCurrency", e.target.value)}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <p className="form-hint">{tr.currencyHint}</p>
          </div>

          <div className="form-group">
            <label className="form-label">{tr.driveFolderID} <span style={{color:"var(--ink-muted)",fontWeight:400}}>({tr.optional || "optional"})</span></label>
            <input className="form-input" value={form.driveFolderId} onChange={e => set("driveFolderId", e.target.value)} onFocus={scrollOnFocus} placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs" />
            <p className="form-hint">{tr.driveFolderHint}</p>
          </div>

          <div style={{display:"flex",gap:10,marginTop:4}}>
            <button type="button" className="btn btn-secondary" style={{flex:1}} onClick={onClose}>{tr.cancel}</button>
            <button type="submit" className="btn btn-primary" style={{flex:1}} disabled={saving}>
              {saving ? tr.saving : trip ? tr.saveChanges : tr.createTrip}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
