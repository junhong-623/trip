import { useState, useEffect, useCallback } from "react";
import { useLang } from "../../contexts/LangContext";
import { addReceipt, updateReceipt } from "../../services/firestore";
import { analyzeReceipt } from "../../services/api";
import { dicebearUrl, formatAmount, generateId, parseAmount, roundMoney } from "../../utils/utils";
import ItemEatersModal from "./ItemEatersModal";
import "./ReceiptModal.css";


  const scrollOnFocus = (e) => {
    const el = e.target;
    setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
  };

export default function ReceiptModal({ receipt, people, tripId, currency, driveFolderId, onClose, toast }) {
  const { tr, t } = useLang();
  const isExisting = !!receipt?.id; // lock financial fields for existing receipts
  const [ocrLoading, setOcrLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
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
    locationName: "",
    tags: [],
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
        locationName: receipt.locationName || "",
        tags: receipt.tags || [],
        ocrRawText: receipt.ocrRawText || "",
      });
      setItems(receipt.items || []);
    }
  }, [receipt]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const totalAmount = parseAmount(form.totalAmount);
  const itemsTotal = roundMoney(items.reduce((s, i) => s + parseAmount(i.price), 0));
  const itemsOverBudget = totalAmount > 0 && itemsTotal > totalAmount + 0.01;
  // If items exist, they must sum exactly to totalAmount
  const itemsMismatch = !isExisting && items.length > 0 && totalAmount > 0 && Math.abs(itemsTotal - totalAmount) > 0.01;

  const addItem = useCallback(() => {
    setItems(prev => [...prev, { id: generateId(), name: "", price: "", eaters: [] }]);
  }, []);
  const removeItem = useCallback((id) => { setItems(prev => prev.filter(i => i.id !== id)); }, []);
  const updateItemName = useCallback((id, v) => { setItems(prev => prev.map(i => i.id === id ? { ...i, name: v } : i)); }, []);
  const updateItemPrice = useCallback((id, v) => { setItems(prev => prev.map(i => i.id === id ? { ...i, price: v } : i)); }, []);
  const updateItemEaters = useCallback((id, eaters) => { setItems(prev => prev.map(i => i.id === id ? { ...i, eaters } : i)); }, []);

  const toggleParticipant = (pid) => {
    if (isExisting) return;
    set("participants", form.participants.includes(pid)
      ? form.participants.filter(i => i !== pid)
      : [...form.participants, pid]);
  };

  const allSelected = people.length > 0 && people.every(p => form.participants.includes(p.id));
  const toggleAll = () => {
    if (isExisting) return;
    set("participants", allSelected ? [] : people.map(p => p.id));
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
    if (itemsMismatch) {
      toast.show(`明细合计 ${formatAmount(itemsTotal, currency)} 必须等于总金额 ${formatAmount(totalAmount, currency)}`, "error"); return;
    }
    setSaving(true);
    try {
      const data = {
        ...form,
        totalAmount: parseAmount(form.totalAmount),
        items: items.map(i => ({ ...i, price: parseAmount(i.price) })),

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

  const handleGetLocation = () => {
    if (!navigator.geolocation) { toast.show(tr.locationFailed, "error"); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const link = `https://www.google.com/maps?q=${latitude},${longitude}`;
        set("googleMapLink", link);
        // Reverse geocode via OpenStreetMap Nominatim (free, no key needed)
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
            { headers: { "Accept-Language": "zh-CN,zh,en", "User-Agent": "MateTrip/1.0" } }
          );
          const data = await res.json();
          // Pick the most useful name: shop/amenity > road+house > suburb
          const a = data.address || {};
          const placeName =
            a.shop || a.restaurant || a.cafe || a.amenity || a.tourism ||
            a.leisure || a.building ||
            (a.road ? (a.house_number ? `${a.road} ${a.house_number}` : a.road) : null) ||
            a.suburb || a.neighbourhood ||
            data.display_name?.split(",")[0] ||
            "";
          if (placeName) set("locationName", placeName);
        } catch {}
        setLocating(false);
        toast.show(tr.locationAdded, "success");
      },
      () => { toast.show(tr.locationFailed, "error"); setLocating(false); }
    );
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
                  onChange={e => set("restaurantName", e.target.value)} 
                  onFocus={scrollOnFocus}
                  placeholder="Ichiran Ramen" />
              </div>

              {/* FIX: date on its own row (smaller), amount full width below */}
              <div className="form-group">
                <label className="form-label">{tr.date}</label>
                <input className="form-input date-input-compact" type="date" value={form.date}
                  onChange={e => set("date", e.target.value)} />
                  onFocus={scrollOnFocus} />
              </div>
              <div className="form-group">
                <label className="form-label">{t(tr.total, currency)}</label>
                <input className="form-input" type="number" step="0.01"
                  inputMode="decimal"
                  value={form.totalAmount}
                  onChange={e => !isExisting && set("totalAmount", e.target.value)}
                  onFocus={scrollOnFocus}
                  placeholder="0.00"
                  disabled={isExisting}
                  style={isExisting ? { opacity: 0.6, cursor: "not-allowed" } : {}} />
                {isExisting && <div className="form-hint">账单已建立，金额不可更改</div>}
              </div>
            </div>

            <div className="form-section">
              <div className="section-title">{tr.whoPaid}</div>
              {isExisting && <div className="form-hint" style={{marginBottom:8}}>账单已建立，付款人不可更改</div>}
              <div className="payer-row">
                {people.map(p => (
                  <button key={p.id} type="button"
                    className={`payer-btn ${form.payerId === p.id ? "selected" : ""}`}
                    onClick={() => !isExisting && set("payerId", p.id)}
                    disabled={isExisting}
                    style={isExisting ? { opacity: form.payerId === p.id ? 1 : 0.4, cursor: "not-allowed" } : {}}>
                    <img src={p.avatarUrl || dicebearUrl(p.name)} alt={p.name} className="avatar avatar-sm" />
                    <span>{p.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-section">
              <div className="items-section-header">
                <div className="section-title" style={{ marginBottom: 0 }}>{tr.items}</div>
                {!isExisting && (
                  <button type="button"
                    className={`btn btn-secondary btn-sm items-edit-btn`}
                    onClick={() => {
                      if (!totalAmount) { toast.show("请先填写总金额", "error"); return; }
                      setShowItemEditor(true);
                    }}
                    style={!totalAmount ? { opacity: 0.4 } : {}}>
                    ✏ {tr.addItem || "Edit Items"}
                    {items.length > 0 && <span className="items-count-badge">{items.length}</span>}
                  </button>
                )}
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
                  <div className={`items-total-row ${itemsOverBudget ? "over-budget" : itemsMismatch ? "over-budget" : ""}`}>
                    <span>{tr.itemsTotal}</span>
                    <span className="amount">{formatAmount(itemsTotal, currency)}</span>
                    {totalAmount > 0 && (
                      <span className="items-budget-hint">
                        {itemsOverBudget
                          ? `⚠ ${tr.exceeds || "Exceeds"} ${formatAmount(itemsTotal - totalAmount, currency)}`
                          : itemsMismatch
                            ? `⚠ 还差 ${formatAmount(totalAmount - itemsTotal, currency)}`
                            : `✓ ${tr.remaining || "Matched"}`}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {items.length === 0 && (
              <div className="form-section">
                <div className="section-title">{tr.splitAmong}</div>
                {isExisting && <div className="form-hint" style={{marginBottom:8}}>账单已建立，分摊不可更改</div>}
                <div className="participants-row">
                  <button type="button"
                    className={`chip ${allSelected ? "selected" : ""}`}
                    style={allSelected
                      ? { background: "var(--terracotta)", color: "white" }
                      : { background: "var(--terracotta-pale)", color: "var(--terracotta)" }}
                    disabled={isExisting}
                    onClick={toggleAll}>{tr.all}</button>
                  {people.map(p => (
                    <button key={p.id} type="button"
                      className={`chip ${form.participants.includes(p.id) ? "selected" : ""}`}
                      disabled={isExisting}
                      style={isExisting ? { opacity: form.participants.includes(p.id) ? 1 : 0.4, cursor: "not-allowed" } : {}}
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
              <div className="section-title">{tr.receiptTags}</div>
              <div className="tags-input-wrap">
                {form.tags.map((tag, i) => (
                  <span key={i} className="receipt-tag">
                    {tag}
                    <button type="button" className="tag-remove"
                      onClick={() => set("tags", form.tags.filter((_, j) => j !== i))}>×</button>
                  </span>
                ))}
                <input
                  className="tags-input"
                  placeholder={form.tags.length === 0 ? tr.tagPlaceholder : "+"}
                  onFocus={scrollOnFocus}
                  onKeyDown={e => {
                    if ((e.key === "Enter" || e.key === ",") && e.target.value.trim()) {
                      e.preventDefault();
                      const val = e.target.value.trim().replace(/,$/, "");
                      if (val && !form.tags.includes(val)) set("tags", [...form.tags, val]);
                      e.target.value = "";
                    }
                  }}
                  onBlur={e => {
                    if (e.target.value.trim()) {
                      const val = e.target.value.trim();
                      if (!form.tags.includes(val)) set("tags", [...form.tags, val]);
                      e.target.value = "";
                    }
                  }}
                />
              </div>
            </div>

            <div className="form-section">
              <div className="section-title">{tr.location}</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <button type="button" className="btn btn-secondary btn-sm"
                  onClick={handleGetLocation} disabled={locating}
                  style={{ whiteSpace: "nowrap" }}>
                  {locating ? tr.locating : "📍 " + (tr.getLocation || "获取当前位置")}
                </button>
                {form.locationName && (
                  <span style={{ fontSize: 13, color: "var(--ink)", alignSelf: "center",
                    flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {form.locationName}
                  </span>
                )}
              </div>
              <input className="form-input" value={form.googleMapLink}
                onChange={e => set("googleMapLink", e.target.value)}
                onFocus={scrollOnFocus}
                placeholder="https://maps.app.goo.gl/..."
                style={{ fontSize: 13 }} />
              {form.googleMapLink && (
                <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center" }}>
                  <a href={form.googleMapLink} target="_blank" rel="noopener"
                    className="receipt-map-link" style={{ fontSize: 13 }}>
                    ✓ {tr.viewOnMap || "查看地图"}
                  </a>
                  <button type="button" className="btn btn-icon btn-sm"
                    style={{ color: "var(--ink-muted)", marginLeft: "auto" }}
                    onClick={() => { set("googleMapLink", ""); set("locationName", ""); }}>✕</button>
                </div>
              )}
            </div>
          </div>

          <div style={{ padding: "12px 0 4px", display: "flex", gap: 10 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>{tr.cancel}</button>
            <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleSave} disabled={saving || itemsOverBudget || itemsMismatch}>
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
          onFocus={scrollOnFocus}
          placeholder="Item name" style={{ flex: 1 }} />
        <div className="item-price-wrap">
          <input className={`form-input item-price-field ${isOver ? "price-over" : ""}`}
            type="number" step="0.01" inputMode="decimal"
            value={item.price}
            onChange={e => onPriceChange(item.id, e.target.value)}
            onFocus={scrollOnFocus}
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
