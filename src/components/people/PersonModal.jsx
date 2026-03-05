import { useState, useEffect } from "react";
import { useLang } from "../../contexts/LangContext";
import { useTrip } from "../../contexts/TripContext";
import { db } from "../../services/firebase";
import { doc, getDoc, getDocs, collection, writeBatch } from "firebase/firestore";
import { updatePerson } from "../../services/firestore";
import { dicebearUrl } from "../../utils/utils";

const STYLES = ["notionists","adventurer","avataaars","big-ears","croodles","fun-emoji","icons","identicon","lorelei","micah","miniavs","open-peeps","personas","pixel-art"];

export default function PersonModal({ person, onSave, onClose, currentUserId, isOwner, people = [] }) {
  const { tr } = useLang();
  const { activeTrip } = useTrip();
  const [tripMembers, setTripMembers] = useState([]); // [{uid, displayName}]
  const [form, setForm] = useState({ name: "", gender: "other", avatarUrl: "", dicebearSeed: "", dicebearStyle: "notionists", linkedUserId: "" });
  const [preview, setPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("dicebear");

  useEffect(() => {
    if (!isOwner || !activeTrip) return;
    const fetchMembers = async () => {
      const allUids = [activeTrip.createdBy, ...(activeTrip.memberIds || [])].filter(Boolean);
      const unique = [...new Set(allUids)];
      const profiles = await Promise.all(unique.map(async uid => {
        try {
          const snap = await getDoc(doc(db, "usernames", uid));
          const data = snap.data() || {};
          return { uid, displayName: data.username || data.email || uid };
        } catch { return { uid, displayName: uid }; }
      }));
      setTripMembers(profiles);
    };
    fetchMembers();
  }, [isOwner, activeTrip?.id]);

  useEffect(() => {
    if (person) {
      setForm({
        name: person.name || "",
        gender: person.gender || "other",
        avatarUrl: person.avatarUrl || "",
        dicebearSeed: person.dicebearSeed || person.name || "",
        dicebearStyle: person.dicebearStyle || "notionists",
        linkedUserId: person.linkedUserId || "",
      });
      if (person.avatarUrl && !person.avatarUrl.includes("dicebear")) {
        setPreview(person.avatarUrl);
        setTab("upload");
      }
    }
  }, [person]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const computedAvatar = tab === "upload" && (preview || form.avatarUrl)
    ? (preview || form.avatarUrl)
    : dicebearUrl(form.dicebearSeed || form.name || "traveler", form.dicebearStyle);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPreview(ev.target.result);
      set("avatarUrl", ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) return;
    setSaving(true);
    try {
      const avatarUrl = tab === "dicebear"
        ? dicebearUrl(form.dicebearSeed || form.name, form.dicebearStyle)
        : (preview || form.avatarUrl || dicebearUrl(form.name));

      const newLinkedUserId = form.linkedUserId;

      // One-user-one-companion: if linking a user, unlink them from any other person first
      if (newLinkedUserId) {
        const currentPersonId = person?.id;
        const othersLinked = people.filter(
          p => p.linkedUserId === newLinkedUserId && p.id !== currentPersonId
        );
        for (const other of othersLinked) {
          await updatePerson(activeTrip.id, other.id, { ...other, linkedUserId: "" });
        }
      }

      await onSave({ ...form, avatarUrl, dicebearSeed: form.dicebearSeed || form.name });
    } catch (err) {
      console.error("PersonModal save error:", err);
    }
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-header">
          <h2 className="modal-title">{person ? tr.editPerson : tr.addPerson}</h2>
          <button className="btn btn-icon" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{display:"flex",flexDirection:"column",gap:16}}>
          <div style={{display:"flex",justifyContent:"center",marginBottom:4}}>
            <img src={computedAvatar} alt="avatar" className="avatar avatar-xl"
              style={{border:"3px solid var(--sand-deep)"}} />
          </div>

          <div style={{display:"flex",gap:4,background:"var(--sand)",borderRadius:10,padding:4}}>
            {[["dicebear", tr.generate], ["upload", tr.upload]].map(([t, label]) => (
              <button key={t} type="button"
                style={{
                  flex:1, padding:"7px", borderRadius:8, border:"none", cursor:"pointer",
                  background: tab===t ? "white" : "transparent",
                  fontWeight: tab===t ? 600 : 400,
                  fontSize:13, color: tab===t ? "var(--ink)" : "var(--ink-muted)",
                  boxShadow: tab===t ? "var(--shadow-sm)" : "none",
                  transition:"all 0.15s"
                }}
                onClick={() => setTab(t)}>
                {label}
              </button>
            ))}
          </div>

          {tab === "dicebear" ? (
            <>
              <div className="form-group">
                <label className="form-label">{tr.seed}</label>
                <input className="form-input" value={form.dicebearSeed}
                  onChange={e => set("dicebearSeed", e.target.value)}
                  placeholder={tr.seedPlaceholder} />
              </div>
              <div className="form-group">
                <label className="form-label">{tr.style}</label>
                <select className="form-select" value={form.dicebearStyle}
                  onChange={e => set("dicebearStyle", e.target.value)}>
                  {STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </>
          ) : (
            <div className="form-group">
              <label className="form-label">{tr.uploadImage}</label>
              <input type="file" accept="image/*" onChange={handleFileChange}
                style={{fontSize:14,padding:"8px 0"}} />
            </div>
          )}

          {/* Link to user account */}
          {(isOwner || !person?.linkedUserId || person?.linkedUserId === currentUserId) && (
            <div className="form-group">
              <label className="form-label">🔗 {tr.linkUser || "关联用户账号"}</label>
              <select className="form-select" value={form.linkedUserId}
                onChange={e => set("linkedUserId", e.target.value)}>
                <option value="">{tr.noLink || "— 不关联 —"}</option>
                {isOwner ? (
                  // Owner sees all trip members
                  tripMembers.map(m => (
                    <option key={m.uid} value={m.uid}>{m.displayName}</option>
                  ))
                ) : (
                  // Non-owner can only link themselves
                  <option value={currentUserId}>{tr.linkMyself || "关联我自己"}</option>
                )}
              </select>
              <p className="form-hint" style={{marginTop:4}}>
                {tr.linkUserHint || "关联后，聊天中会显示此旅伴的头像和名字"}
              </p>
            </div>
          )}

          <div className="divider" />

          <div className="form-group">
            <label className="form-label">{tr.name} *</label>
            <input className="form-input" required value={form.name}
              onChange={e => { set("name", e.target.value); if (!form.dicebearSeed) set("dicebearSeed", e.target.value); }}
              placeholder="Alice" />
          </div>

          <div className="form-group">
            <label className="form-label">{tr.gender}</label>
            <select className="form-select" value={form.gender} onChange={e => set("gender", e.target.value)}>
              <option value="male">{tr.male}</option>
              <option value="female">{tr.female}</option>
              <option value="other">{tr.other}</option>
            </select>
          </div>

          <div style={{display:"flex",gap:10}}>
            <button type="button" className="btn btn-secondary" style={{flex:1}} onClick={onClose}>{tr.cancel}</button>
            <button type="submit" className="btn btn-primary" style={{flex:1}} disabled={saving}>
              {saving ? tr.saving : person ? tr.saveChanges : tr.addPerson}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
