import { useState, useEffect, useRef } from "react";
import { useTrip } from "../../contexts/TripContext";
import { useAuth } from "../../contexts/AuthContext";
import { useLang } from "../../contexts/LangContext";
import {
  subscribeSchedule, addScheduleItem, updateScheduleItem, deleteScheduleItem,
  subscribeMessages, addMessage, deleteMessage,
  subscribePeople,
} from "../../services/firestore";
import "./PlanPage.css";
import { dicebearUrl } from "../../utils/utils";
import { registerSW, subscribePush, isPushSupported } from "../../services/pushService";

const API = (import.meta.env.VITE_API_BASE_URL || "http://localhost:3001").replace(/\/$/, "");

// ─── Browser notifications ────────────────────────────────────────────────────
async function requestNotifPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

function sendNotif(title, body, icon = "/trip/icons/icon-192.png") {
  if (Notification.permission !== "granted") return;
  try { new Notification(title, { body, icon, badge: icon }); } catch {}
}

// Per-trip last-read timestamp stored in localStorage
function getLastRead(tripId) {
  try { return parseInt(localStorage.getItem(`lastread_${tripId}`) || "0", 10); } catch { return 0; }
}
function setLastRead(tripId) {
  try { localStorage.setItem(`lastread_${tripId}`, Date.now().toString()); } catch {}
}

// ─── ICS calendar export ───────────────────────────────────────────────────────
function downloadICS(event) {
  const pad = n => String(n).padStart(2, "0");
  const toICSDate = (dateStr, timeStr) => {
    const [y, m, d] = dateStr.split("-");
    if (!timeStr) return `${y}${m}${d}`;
    const [h, min] = timeStr.split(":");
    return `${y}${m}${d}T${h}${min}00`;
  };
  const start = toICSDate(event.date, event.time);
  const isAllDay = !event.time;
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MateTrip//EN",
    "BEGIN:VEVENT",
    `UID:${event.id}@matetrip`,
    `SUMMARY:${event.title}`,
    event.place ? `LOCATION:${event.place}` : "",
    event.notes ? `DESCRIPTION:${event.notes}` : "",
    isAllDay ? `DTSTART;VALUE=DATE:${start}` : `DTSTART:${start}`,
    isAllDay ? `DTEND;VALUE=DATE:${start}` : `DTEND:${start}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${event.title.replace(/\s+/g, "_")}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
function formatEventDate(dateStr, tr) {
  if (!dateStr) return "";
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (dateStr === today) return tr.today;
  if (dateStr === tomorrow) return tr.tomorrow;
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", weekday: "short" });
}

function groupByDate(items) {
  const map = {};
  items.forEach(item => {
    const key = item.date || "undated";
    if (!map[key]) map[key] = [];
    map[key].push(item);
  });
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
}

// ─── Event Modal ──────────────────────────────────────────────────────────────
function EventModal({ event, onSave, onClose, onDelete, tr }) {
  const [form, setForm] = useState({
    title: event?.title || "",
    date: event?.date || new Date().toISOString().slice(0, 10),
    time: event?.time || "",
    place: event?.place || "",
    notes: event?.notes || "",
    mapLink: event?.mapLink || "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.title.trim() || !form.date) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-header">
          <h2 className="modal-title">{event ? tr.editEvent : tr.addEvent}</h2>
          <button className="btn btn-icon" onClick={onClose}>✕</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div className="form-group">
            <label className="form-label">{tr.eventTitle} *</label>
            <input className="form-input" value={form.title}
              onChange={e => set("title", e.target.value)}
              placeholder="e.g. 富士山一日游" autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">{tr.eventDate} *</label>
            <input className="form-input" type="date" value={form.date}
              onChange={e => set("date", e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">{tr.eventTime}</label>
            <input className="form-input" type="time" value={form.time}
              onChange={e => set("time", e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">🗺 Google Maps</label>
            <input className="form-input" value={form.mapLink}
              onChange={e => set("mapLink", e.target.value)}
              placeholder="https://maps.app.goo.gl/..." />
          </div>
          <div className="form-group">
            <label className="form-label">📍 {tr.eventPlace}</label>
            <input className="form-input" value={form.place}
              onChange={e => set("place", e.target.value)}
              placeholder="e.g. 新宿站" />
          </div>
          <div className="form-group">
            <label className="form-label">📝 {tr.eventNotes}</label>
            <textarea className="form-input form-textarea" value={form.notes}
              onChange={e => set("notes", e.target.value)}
              placeholder="备注…" rows={2} />
          </div>
          <div style={{display:"flex",gap:8,marginTop:4}}>
            {event && (
              <button className="btn btn-danger" onClick={onDelete} style={{flex:"0 0 auto"}}>
                🗑
              </button>
            )}
            <button className="btn btn-secondary" style={{flex:1}} onClick={onClose}>{tr.cancel}</button>
            <button className="btn btn-primary" style={{flex:2}} onClick={handleSave}
              disabled={saving || !form.title.trim() || !form.date}>
              {saving ? tr.saving : tr.saveEvent}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main PlanPage ─────────────────────────────────────────────────────────────
export default function PlanPage({ toast }) {
  const { activeTrip } = useTrip();
  const { user } = useAuth();
  const { tr } = useLang();
  const [activeTab, setActiveTab] = useState("schedule");

  const markRead = () => {
    if (!activeTrip?.id) return;
    setLastRead(activeTrip.id);
    setLastReadTime(Date.now());
  };
  const [events, setEvents] = useState([]);
  const [people, setPeople] = useState([]);
  const [messages, setMessages] = useState([]);

  // Resolve display info from linked person (runs at render time, always fresh)
  const getLinkedPerson = (uid) => people.find(p => p.linkedUserId === uid) || null;
  const [lastReadTime, setLastReadTime] = useState(() => getLastRead(activeTrip?.id || ""));
  const [showEventModal, setShowEventModal] = useState(false);
  const [editEvent, setEditEvent] = useState(null);
  const [msgText, setMsgText] = useState("");
  const [sending, setSending] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(Notification?.permission === "granted");
  const [pushEnabled, setPushEnabled] = useState(false);
  const msgEndRef = useRef(null);
  const inputRef = useRef(null);
  const initializedRef = useRef(false);

  useEffect(() => { registerSW(); }, []);

  useEffect(() => {
    if (!activeTrip?.id) return;
    const u1 = subscribeSchedule(activeTrip.id, setEvents);
    const u0 = subscribePeople(activeTrip.id, setPeople);
    const lastRead = getLastRead(activeTrip.id);
    const u2 = subscribeMessages(activeTrip.id, msgs => {
      setMessages(msgs);
      if (!initializedRef.current) {
        // First load — mark everything as read, don't notify
        initializedRef.current = true;
        return;
      }
      // Only notify about messages newer than lastRead and not from me
      msgs.forEach(m => {
        const msgTime = m.createdAt?.toMillis?.() || m.createdAt?.seconds * 1000 || 0;
        if (
          m.uid !== user?.uid &&
          msgTime > lastRead &&
          (activeTab !== "chat" || document.hidden)
        ) {
          sendNotif(m.displayName || "MateTrip", m.text);
        }
      });
    });
    return () => { u0(); u1(); u2(); };
  }, [activeTrip?.id, user?.uid, activeTab]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (activeTab === "chat") {
      msgEndRef.current?.scrollIntoView({ behavior: "smooth" });
      markRead();
    }
  }, [messages, activeTab]);

  const handleSaveEvent = async (form) => {
    try {
      if (editEvent) {
        await updateScheduleItem(activeTrip.id, editEvent.id, form);
        toast.show("已更新 ✓", "success");
      } else {
        await addScheduleItem(activeTrip.id, { ...form, createdBy: user.uid });
        toast.show("已添加 ✓", "success");
      }
      setShowEventModal(false);
      setEditEvent(null);
    } catch (e) { toast.show(e.message, "error"); }
  };

  const handleDeleteEvent = async () => {
    if (!confirm(tr.confirmDeleteEvent)) return;
    await deleteScheduleItem(activeTrip.id, editEvent.id);
    setShowEventModal(false);
    setEditEvent(null);
    toast.show("已删除");
  };

  const handleSendMessage = async () => {
    const text = msgText.trim();
    if (!text || sending) return;
    setSending(true);
    setMsgText("");
    const fallbackName = user.displayName || user.email || "User";
    try {
      await addMessage(activeTrip.id, {
        text,
        uid: user.uid,
        displayName: fallbackName, // fallback only; render uses linked person
      });
      // Trigger push to other members
      fetch(`${API}/api/push/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId: activeTrip.id,
          senderUserId: user.uid,
          senderName: fallbackName,
          message: text,
        }),
      }).catch(() => {}); // fire and forget
    } catch (e) { toast.show(e.message, "error"); }
    finally { setSending(false); }
  };

  const handleDeleteMsg = async (msg) => {
    if (msg.uid !== user.uid) return;
    await deleteMessage(activeTrip.id, msg.id);
  };

  if (!activeTrip) return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <img src="/trip/icons/icon-192.png" alt="MateTrip"
          style={{width:64,height:64,borderRadius:16,opacity:0.85}} />
      </div>
      <div className="empty-state-title">{tr.noTripSelected}</div>
    </div>
  );

  const grouped = groupByDate(events);

  return (
    <div className="plan-page">
      {/* Sub-tabs */}
      <div className="plan-tabs">
        <button className={`plan-tab ${activeTab === "schedule" ? "active" : ""}`}
          onClick={() => setActiveTab("schedule")}>
          📅 {tr.schedule}
        </button>
        <button className={`plan-tab ${activeTab === "chat" ? "active" : ""}`}
          onClick={() => { setActiveTab("chat"); markRead(); }}>
          💬 {tr.chat}
          {(() => {
            const unread = messages.filter(m => {
              const t = m.createdAt?.toMillis?.() || (m.createdAt?.seconds * 1000) || 0;
              return m.uid !== user?.uid && t > lastReadTime;
            }).length;
            return unread > 0 && activeTab !== "chat"
              ? <span className="chat-badge">{unread}</span>
              : null;
          })()}
        </button>
      </div>

      {/* ── Schedule Tab ── */}
      {activeTab === "schedule" && (
        <div className="schedule-content">
          {events.length === 0 ? (
            <div className="empty-state" style={{paddingTop:40}}>
              <div className="empty-state-icon">📅</div>
              <div className="empty-state-title">{tr.noEvents}</div>
              <div className="empty-state-text">{tr.noEventsHint}</div>
              <button className="btn btn-primary" style={{marginTop:16}}
                onClick={() => setShowEventModal(true)}>
                + {tr.addEvent}
              </button>
            </div>
          ) : (
            <div className="schedule-list">
              {grouped.map(([date, items]) => (
                <div key={date} className="schedule-day">
                  <div className="schedule-day-label">
                    {formatEventDate(date, tr)}
                    <span className="schedule-day-date">{date !== "undated" ? date : ""}</span>
                  </div>
                  {items.map(item => (
                    <div key={item.id} className="event-card"
                      onClick={() => { setEditEvent(item); setShowEventModal(true); }}>
                      <div className="event-time-col">
                        {item.time ? (
                          <>
                            <span className="event-time">{item.time}</span>
                            <div className="event-timeline-dot" />
                          </>
                        ) : (
                          <span className="event-time" style={{opacity:0.3}}>—</span>
                        )}
                      </div>
                      <div className="event-body">
                        <div className="event-title">{item.title}</div>
                        {item.place && <div className="event-place">📍 {item.place}</div>}
                        {item.notes && <div className="event-notes">{item.notes}</div>}
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:4,alignItems:"center"}}>
                      {item.mapLink && (
                        <a href={item.mapLink} target="_blank" rel="noopener noreferrer"
                          className="event-cal-btn"
                          onClick={e => e.stopPropagation()}
                          title="Google Maps">
                          🗺
                        </a>
                      )}
                      <button className="event-cal-btn"
                        onClick={e => { e.stopPropagation(); downloadICS(item); toast.show(tr.addToCalendar + " ✓", "success"); }}
                        title={tr.addToCalendar}>
                        📲
                      </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              {/* Add event card at bottom */}
              <button className="event-add-card"
                onClick={() => { setEditEvent(null); setShowEventModal(true); }}>
                <span className="event-add-icon">＋</span>
                <span>{tr.addEvent}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Chat Tab ── */}
      {activeTab === "chat" && (
        <div className="chat-content">
          {/* Notification permission banner */}
          {!notifEnabled && Notification?.permission !== "denied" && (
            <div className="notif-banner">
              <span>🔔 开启通知，收到新消息时提醒你</span>
              <button className="btn btn-sm btn-secondary" onClick={async () => {
                const ok = await requestNotifPermission();
                setNotifEnabled(ok);
                if (ok) {
                  toast.show("通知已开启 ✓", "success");
                  // Also subscribe to push for background notifications
                  if (isPushSupported()) {
                    const sub = await subscribePush(activeTrip.id, user.uid);
                    if (sub) setPushEnabled(true);
                  }
                } else {
                  toast.show("请在系统设置中允许通知", "error");
                }
              }}>开启</button>
            </div>
          )}
          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="chat-empty">
                <div style={{fontSize:40,marginBottom:8}}>💬</div>
                <div style={{fontWeight:600,marginBottom:4}}>{tr.noMessages}</div>
                <div style={{fontSize:13,color:"var(--ink-muted)"}}>{tr.noMessagesHint}</div>
              </div>
            ) : (
              messages.map(msg => {
                const isMe = msg.uid === user.uid;
                const linked = getLinkedPerson(msg.uid);
                const shownName = linked?.name || msg.displayName || "?";
                const shownAvatar = linked?.avatarUrl || "";
                return (
                  <div key={msg.id} className={`msg-row ${isMe ? "msg-me" : "msg-other"}`}>
                    {!isMe && (
                      <div className="msg-avatar">
                        {shownAvatar
                          ? <img src={shownAvatar} alt={shownName}
                              style={{width:"100%",height:"100%",borderRadius:"50%",objectFit:"cover"}} />
                          : shownName[0]?.toUpperCase() || "?"}
                      </div>
                    )}
                    <div className="msg-bubble-wrap">
                      {!isMe && <div className="msg-name">{shownName}</div>}
                      <div className={`msg-bubble ${isMe ? "bubble-me" : "bubble-other"}`}>
                        {msg.text}
                        {isMe && (
                          <button className="msg-delete-btn"
                            onClick={() => handleDeleteMsg(msg)}>✕</button>
                        )}
                      </div>
                      <div className="msg-time">
                        {msg.createdAt?.toDate
                          ? msg.createdAt.toDate().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})
                          : ""}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={msgEndRef} />
          </div>

          <div className="chat-input-bar">
            <input
              ref={inputRef}
              className="chat-input"
              value={msgText}
              onChange={e => setMsgText(e.target.value)}
              placeholder={tr.typeMessage}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
              onFocus={e => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 300)}
            />
            <button className="chat-send-btn" onClick={handleSendMessage}
              disabled={!msgText.trim() || sending}>
              {tr.send}
            </button>
          </div>
        </div>
      )}

      {showEventModal && (
        <EventModal
          event={editEvent}
          onSave={handleSaveEvent}
          onClose={() => { setShowEventModal(false); setEditEvent(null); }}
          onDelete={handleDeleteEvent}
          tr={tr}
        />
      )}
    </div>
  );
}
