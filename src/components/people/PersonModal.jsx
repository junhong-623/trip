import { useState, useEffect } from "react";
import { dicebearUrl } from "../../utils/utils";

const STYLES = ["notionists","adventurer","avataaars","big-ears","croodles","fun-emoji","icons","identicon","lorelei","micah","miniavs","open-peeps","personas","pixel-art"];

export default function PersonModal({ person, onSave, onClose }) {
  const [form, setForm] = useState({ name: "", gender: "other", avatarUrl: "", dicebearSeed: "", dicebearStyle: "notionists" });
  const [preview, setPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("dicebear"); // dicebear | upload

  useEffect(() => {
    if (person) {
      setForm({
        name: person.name || "",
        gender: person.gender || "other",
        avatarUrl: person.avatarUrl || "",
        dicebearSeed: person.dicebearSeed || person.name || "",
        dicebearStyle: person.dicebearStyle || "notionists",
      });
      if (person.avatarUrl) {
        setPreview(person.avatarUrl);
        setTab("upload");
      }
    }
  }, [person]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const computedAvatar = tab === "upload" && form.avatarUrl
    ? form.avatarUrl
    : dicebearUrl(form.dicebearSeed || form.name || "traveler", form.dicebearStyle);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Preview locally; actual upload happens via Drive API when trip has folder
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPreview(ev.target.result);
      set("avatarUrl", ev.target.result); // local data URL as fallback
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) return;
    setSaving(true);
    const avatarUrl = tab === "dicebear"
      ? dicebearUrl(form.dicebearSeed || form.name, form.dicebearStyle)
      : (preview || dicebearUrl(form.name));
    await onSave({ ...form, avatarUrl, dicebearSeed: form.dicebearSeed || form.name });
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-header">
          <h2 className="modal-title">{person ? "Edit Person" : "Add Person"}</h2>
          <button className="btn btn-icon" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{display:"flex",flexDirection:"column",gap:16}}>
          {/* Avatar preview */}
          <div style={{display:"flex",justifyContent:"center",marginBottom:4}}>
            <img src={computedAvatar} alt="avatar" className="avatar avatar-xl"
              style={{border:"3px solid var(--sand-deep)"}} />
          </div>

          {/* Avatar tabs */}
          <div style={{display:"flex",gap:4,background:"var(--sand)",borderRadius:10,padding:4}}>
            {["dicebear","upload"].map(t => (
              <button key={t} type="button"
                style={{flex:1,padding:"7px",borderRadius:8,border:"none",cursor:"pointer",
                  background: tab===t ? "white" : "transparent",
                  fontWeight: tab===t ? 600 : 400,
                  fontSize:13, color: tab===t ? "var(--ink)" : "var(--ink-muted)",
                  boxShadow: tab===t ? "var(--shadow-sm)" : "none",
                  transition:"all 0.15s"}}
                onClick={() => setTab(t)}>
                {t === "dicebear" ? "🎲 Generate" : "📷 Upload"}
              </button>
            ))}
          </div>

          {tab === "dicebear" ? (
            <>
              <div className="form-group">
                <label className="form-label">Seed (name or phrase)</label>
                <input className="form-input" value={form.dicebearSeed}
                  onChange={e => set("dicebearSeed", e.target.value)}
                  placeholder="Enter any text to generate avatar" />
              </div>
              <div className="form-group">
                <label className="form-label">Style</label>
                <select className="form-select" value={form.dicebearStyle}
                  onChange={e => set("dicebearStyle", e.target.value)}>
                  {STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </>
          ) : (
            <div className="form-group">
              <label className="form-label">Upload Image</label>
              <input type="file" accept="image/*" onChange={handleFileChange}
                style={{fontSize:14,padding:"8px 0"}} />
            </div>
          )}

          <div className="divider" />

          <div className="form-group">
            <label className="form-label">Name *</label>
            <input className="form-input" required value={form.name}
              onChange={e => { set("name", e.target.value); if (!form.dicebearSeed) set("dicebearSeed", e.target.value); }}
              placeholder="Alice" />
          </div>

          <div className="form-group">
            <label className="form-label">Gender</label>
            <select className="form-select" value={form.gender} onChange={e => set("gender", e.target.value)}>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other / Prefer not to say</option>
            </select>
          </div>

          <div style={{display:"flex",gap:10}}>
            <button type="button" className="btn btn-secondary" style={{flex:1}} onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" style={{flex:1}} disabled={saving}>
              {saving ? "Saving…" : person ? "Save Changes" : "Add Person"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
