import { useState } from "react";
import { useLang } from "../../contexts/LangContext";
import { dicebearUrl } from "../../utils/utils";

export default function ItemEatersModal({ item, people, onSave, onClose }) {
  const { tr, t } = useLang();
  const [selected, setSelected] = useState(item.eaters || []);

  const toggle = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  return (
    <div className="modal-overlay" style={{zIndex:110}} onClick={onClose}>
      <div className="modal-sheet" style={{maxHeight:"70vh"}} onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-header">
          <h2 className="modal-title">{t(tr.whoAte, item.name)}</h2>
          <button className="btn btn-icon" onClick={onClose}>✕</button>
        </div>

        <div style={{display:"flex",gap:8,marginBottom:16}}>
          <button className="btn btn-secondary btn-sm" onClick={() => setSelected(people.map(p => p.id))}>
            {tr.selectAll}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setSelected([])}>
            {tr.clear}
          </button>
          <span style={{marginLeft:"auto",fontSize:13,color:"var(--ink-muted)",alignSelf:"center"}}>
            {t(tr.selected, selected.length)}
          </span>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
          {people.map(p => {
            const isSelected = selected.includes(p.id);
            return (
              <button key={p.id} type="button" onClick={() => toggle(p.id)}
                style={{
                  display:"flex", alignItems:"center", gap:12, padding:"12px 14px",
                  borderRadius:14, border: isSelected ? "2px solid var(--terracotta)" : "2px solid var(--sand-dark)",
                  background: isSelected ? "var(--terracotta-pale)" : "white",
                  cursor:"pointer", transition:"all 0.15s", textAlign:"left"
                }}>
                <img src={p.avatarUrl || dicebearUrl(p.name)} alt={p.name} className="avatar avatar-sm" />
                <span style={{fontWeight:500,flex:1}}>{p.name}</span>
                <span style={{fontSize:18}}>{isSelected ? "✓" : ""}</span>
              </button>
            );
          })}
        </div>

        <button className="btn btn-primary" style={{width:"100%"}}
          onClick={() => onSave(selected)}>
          {selected.length === 1 ? t(tr.confirm, selected.length) : t(tr.confirmPlural, selected.length)}
        </button>
      </div>
    </div>
  );
}
