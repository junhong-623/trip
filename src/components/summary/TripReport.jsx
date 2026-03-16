import { useState, useMemo, useRef } from "react";
import { useTrip } from "../../contexts/TripContext";
import { useAuth } from "../../contexts/AuthContext";
import { useLang } from "../../contexts/LangContext";
import { dicebearUrl, formatAmount, parseAmount, roundMoney } from "../../utils/utils";
import "./TripReport.css";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function computePersonSpend(receipts, people) {
  // Returns { personId: { paid, share } }
  const spend = {};
  people.forEach(p => { spend[p.id] = { paid: 0, share: 0 }; });

  receipts.forEach(r => {
    const total = parseAmount(r.totalAmount);
    const payerId = r.payerId;
    if (payerId && spend[payerId] != null) {
      spend[payerId].paid = roundMoney(spend[payerId].paid + total);
    }

    const items = r.items || [];
    if (items.length === 0) {
      const parts = r.participants || people.map(p => p.id);
      if (parts.length === 0) return;
      const each = roundMoney(total / parts.length);
      parts.forEach(pid => {
        if (spend[pid] != null) spend[pid].share = roundMoney(spend[pid].share + each);
      });
    } else {
      items.forEach(item => {
        const eaters = item.eaters || [];
        if (!eaters.length) return;
        const each = roundMoney(parseAmount(item.price) / eaters.length);
        eaters.forEach(eid => {
          if (spend[eid] != null) spend[eid].share = roundMoney(spend[eid].share + each);
        });
      });
    }
  });

  return spend;
}

function computeTagSpend(receipts) {
  // Returns { tagName: totalAmount }
  const tags = {};
  receipts.forEach(r => {
    const total = parseAmount(r.totalAmount);
    if (!r.tags?.length) {
      tags["其他"] = roundMoney((tags["其他"] || 0) + total);
    } else {
      // Split evenly across tags if multiple
      const each = roundMoney(total / r.tags.length);
      r.tags.forEach(tag => {
        tags[tag] = roundMoney((tags[tag] || 0) + each);
      });
    }
  });
  return tags;
}

// Apply merge groups — treat a group as one entity
function applyMerges(spend, mergeGroups, people) {
  // mergeGroups: [{ id, name, memberIds, avatars }]
  const result = {};
  const mergedIds = new Set(mergeGroups.flatMap(g => g.memberIds));

  // Add merge groups
  mergeGroups.forEach(g => {
    result[g.id] = {
      name: g.name,
      avatarUrl: null,
      memberIds: g.memberIds,
      isGroup: true,
      paid:  roundMoney(g.memberIds.reduce((s, id) => s + (spend[id]?.paid  || 0), 0)),
      share: roundMoney(g.memberIds.reduce((s, id) => s + (spend[id]?.share || 0), 0)),
    };
  });

  // Add individuals not in any group
  people.forEach(p => {
    if (!mergedIds.has(p.id)) {
      result[p.id] = {
        name: p.name,
        avatarUrl: p.avatarUrl,
        memberIds: [p.id],
        isGroup: false,
        paid:  spend[p.id]?.paid  || 0,
        share: spend[p.id]?.share || 0,
      };
    }
  });

  return result;
}

const PALETTE = [
  "#c97b4b","#e8a87c","#4a9b8f","#7bc8c0","#8b6fb5",
  "#b5a0d0","#e6b85c","#f0d090","#6b8fb5","#a0c0e0",
];

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TripReport({ receipts, people, toast }) {
  const { activeTrip } = useTrip();
  const { user } = useAuth();
  const { lang } = useLang();
  const isOwner = activeTrip?.createdBy === user?.uid;
  const currency = activeTrip?.baseCurrency || "USD";

  // Merge groups state: [{ id, name, memberIds }]
  const [mergeGroups, setMergeGroups] = useState([]);
  const [mergingMode, setMergingMode] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [activeSection, setActiveSection] = useState("spend"); // spend | region | report
  const reportRef = useRef(null);

  const totalSpend = receipts.reduce((s, r) => s + parseAmount(r.totalAmount), 0);
  const personSpend = useMemo(() => computePersonSpend(receipts, people), [receipts, people]);
  const tagSpend    = useMemo(() => computeTagSpend(receipts), [receipts]);
  const mergedSpend = useMemo(() => applyMerges(personSpend, mergeGroups, people), [personSpend, mergeGroups, people]);

  const tagEntries = Object.entries(tagSpend).sort((a, b) => b[1] - a[1]);
  const spendEntries = Object.entries(mergedSpend).sort((a, b) => b[1].share - a[1].share);

  // ── Merge group management ──────────────────────────────────────────────────
  const toggleMergeSelect = (id) => {
    setSelectedForMerge(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  };

  const createGroup = () => {
    if (selectedForMerge.length < 2) return;
    const names = selectedForMerge.map(id => {
      const p = people.find(x => x.id === id);
      return p?.name || id;
    });
    const defaultName = names.join(" & ");
    const name = groupName.trim() || defaultName;
    const newGroup = {
      id: `group_${Date.now()}`,
      name,
      memberIds: [...selectedForMerge],
    };
    setMergeGroups(prev => [...prev, newGroup]);
    setSelectedForMerge([]);
    setGroupName("");
    setMergingMode(false);
  };

  const removeGroup = (id) => {
    setMergeGroups(prev => prev.filter(g => g.id !== id));
  };

  const mergedPersonIds = new Set(mergeGroups.flatMap(g => g.memberIds));

  return (
    <div className="tripreport-wrap">
      {/* ── Section Tabs ── */}
      <div className="tripreport-tabs">
        {[
          { id: "spend",  icon: "👤", label: lang === "zh" ? "个人消费" : "By Person" },
          { id: "region", icon: "📍", label: lang === "zh" ? "地区消费" : "By Region" },
          { id: "report", icon: "📊", label: lang === "zh" ? "旅途报告" : "Report"    },
        ].map(tab => (
          <button key={tab.id}
            className={`tripreport-tab ${activeSection === tab.id ? "active" : ""}`}
            onClick={() => setActiveSection(tab.id)}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ══ PERSONAL SPEND ══════════════════════════════════════════════════ */}
      {activeSection === "spend" && (
        <div>
          {/* Merge controls */}
          <div className="merge-section">
            <div className="merge-header">
              <div>
                <div className="merge-title">{lang === "zh" ? "合并计算" : "Merge Groups"}</div>
                <div className="merge-sub">{lang === "zh" ? "把情侣/家人的消费合并显示" : "Combine couples or families together"}</div>
              </div>
              {!mergingMode ? (
                <button className="btn-merge-add" onClick={() => setMergingMode(true)}>
                  + {lang === "zh" ? "新建合并" : "New Group"}
                </button>
              ) : (
                <button className="btn-merge-cancel" onClick={() => { setMergingMode(false); setSelectedForMerge([]); setGroupName(""); }}>
                  {lang === "zh" ? "取消" : "Cancel"}
                </button>
              )}
            </div>

            {/* Existing groups */}
            {mergeGroups.length > 0 && (
              <div className="merge-groups-list">
                {mergeGroups.map(g => (
                  <div key={g.id} className="merge-group-chip">
                    <span className="merge-group-icon">🔗</span>
                    <span className="merge-group-name">{g.name}</span>
                    <span className="merge-group-members">
                      {g.memberIds.map(id => people.find(p => p.id === id)?.name).filter(Boolean).join(" & ")}
                    </span>
                    <button className="merge-group-remove" onClick={() => removeGroup(g.id)}>✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* Merge selection UI */}
            {mergingMode && (
              <div className="merge-picker">
                <div className="merge-picker-hint">
                  {lang === "zh" ? "选择要合并的旅伴（至少2人）" : "Select at least 2 people to merge"}
                </div>
                <div className="merge-people-grid">
                  {people.map(p => {
                    const inOtherGroup = mergeGroups.some(g => g.memberIds.includes(p.id));
                    const isSelected = selectedForMerge.includes(p.id);
                    return (
                      <button key={p.id}
                        className={`merge-person-btn ${isSelected ? "selected" : ""} ${inOtherGroup ? "in-group" : ""}`}
                        onClick={() => !inOtherGroup && toggleMergeSelect(p.id)}
                        disabled={inOtherGroup}>
                        <img src={p.avatarUrl || dicebearUrl(p.name)} alt={p.name} />
                        <span>{p.name}</span>
                        {inOtherGroup && <span className="merge-in-group-tag">已合并</span>}
                        {isSelected && <span className="merge-check">✓</span>}
                      </button>
                    );
                  })}
                </div>
                {selectedForMerge.length >= 2 && (
                  <div className="merge-confirm-row">
                    <input
                      className="merge-name-input"
                      placeholder={lang === "zh" ? "组合名称（选填）" : "Group name (optional)"}
                      value={groupName}
                      onChange={e => setGroupName(e.target.value)}
                    />
                    <button className="btn-merge-confirm" onClick={createGroup}>
                      {lang === "zh" ? "确认合并" : "Merge"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Personal spend bars */}
          <div className="spend-list">
            {spendEntries.map(([id, data], i) => {
              const pct = totalSpend > 0 ? (data.share / totalSpend) * 100 : 0;
              const color = PALETTE[i % PALETTE.length];
              return (
                <div key={id} className="spend-row">
                  <div className="spend-row-top">
                    {data.isGroup ? (
                      <div className="spend-group-avatars">
                        {data.memberIds.slice(0, 3).map(mid => {
                          const p = people.find(x => x.id === mid);
                          return p ? (
                            <img key={mid} src={p.avatarUrl || dicebearUrl(p.name)} alt={p.name}
                              className="spend-avatar spend-avatar-stack" />
                          ) : null;
                        })}
                      </div>
                    ) : (
                      <img src={data.avatarUrl || dicebearUrl(data.name)} alt={data.name}
                        className="spend-avatar" />
                    )}
                    <div className="spend-info">
                      <div className="spend-name">{data.name}</div>
                      {data.isGroup && (
                        <div className="spend-members">
                          {data.memberIds.map(id => people.find(p => p.id === id)?.name).filter(Boolean).join(" & ")}
                        </div>
                      )}
                    </div>
                    <div className="spend-amounts">
                      <div className="spend-share">{formatAmount(data.share, currency)}</div>
                      <div className="spend-pct">{pct.toFixed(1)}%</div>
                    </div>
                  </div>
                  <div className="spend-bar-track">
                    <div className="spend-bar-fill" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <div className="spend-row-meta">
                    <span className="spend-paid-label">
                      {lang === "zh" ? "垫付" : "Paid"}: <strong>{formatAmount(data.paid, currency)}</strong>
                    </span>
                    <span className="spend-net" style={{ color: data.paid >= data.share ? "#4a9b8f" : "#c97b4b" }}>
                      {data.paid >= data.share
                        ? `+${formatAmount(roundMoney(data.paid - data.share), currency)}`
                        : `-${formatAmount(roundMoney(data.share - data.paid), currency)}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ REGION SPEND ════════════════════════════════════════════════════ */}
      {activeSection === "region" && (
        <div>
          {tagEntries.length === 0 ? (
            <div className="tripreport-empty">
              <div>📍</div>
              <div>{lang === "zh" ? "账单还没有地区标签" : "No region tags on receipts yet"}</div>
              <div style={{ fontSize: 12 }}>{lang === "zh" ? "在账单上加标签（如：东京、大阪）" : "Add tags like city names to your receipts"}</div>
            </div>
          ) : (
            <>
              {/* Donut chart (CSS-based) */}
              <div className="region-chart-wrap">
                <DonutChart entries={tagEntries} total={totalSpend} currency={currency} />
              </div>
              {/* Region bars */}
              <div className="region-list">
                {tagEntries.map(([tag, amount], i) => {
                  const pct = totalSpend > 0 ? (amount / totalSpend) * 100 : 0;
                  const color = PALETTE[i % PALETTE.length];
                  return (
                    <div key={tag} className="region-row">
                      <div className="region-dot" style={{ background: color }} />
                      <div className="region-name">{tag}</div>
                      <div className="region-bar-track">
                        <div className="region-bar-fill" style={{ width: `${pct}%`, background: color }} />
                      </div>
                      <div className="region-amount">{formatAmount(amount, currency)}</div>
                      <div className="region-pct">{pct.toFixed(1)}%</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ══ REPORT ══════════════════════════════════════════════════════════ */}
      {activeSection === "report" && (
        <div>
          {!isOwner && (
            <div className="report-owner-notice">
              🔒 {lang === "zh" ? "只有群主可以生成旅途报告" : "Only the trip owner can finalise the report"}
            </div>
          )}

          <div className="report-card" ref={reportRef}>
            {/* Header */}
            <div className="report-header">
              <div className="report-logo">🧳</div>
              <div className="report-trip-name">{activeTrip?.name || "Trip"}</div>
              <div className="report-trip-dates">
                {activeTrip?.startDate} → {activeTrip?.endDate}
              </div>
              <div className="report-divider" />
            </div>

            {/* Total */}
            <div className="report-total-row">
              <div className="report-total-label">{lang === "zh" ? "旅途总消费" : "Total Spent"}</div>
              <div className="report-total-amount">{formatAmount(totalSpend, currency)}</div>
              <div className="report-total-meta">
                {receipts.length} {lang === "zh" ? "笔账单" : "receipts"} · {people.length} {lang === "zh" ? "位旅伴" : "people"}
              </div>
            </div>

            <div className="report-section-divider" />

            {/* Region breakdown */}
            {tagEntries.length > 0 && (
              <>
                <div className="report-section-title">📍 {lang === "zh" ? "地区消费" : "By Region"}</div>
                <div className="report-region-rows">
                  {tagEntries.map(([tag, amount], i) => (
                    <div key={tag} className="report-region-row">
                      <div className="report-region-dot" style={{ background: PALETTE[i % PALETTE.length] }} />
                      <span className="report-region-name">{tag}</span>
                      <span className="report-region-bar-bg">
                        <span className="report-region-bar-fill"
                          style={{ width: `${totalSpend > 0 ? (amount/totalSpend*100) : 0}%`, background: PALETTE[i % PALETTE.length] }} />
                      </span>
                      <span className="report-region-amount">{formatAmount(amount, currency)}</span>
                    </div>
                  ))}
                </div>
                <div className="report-section-divider" />
              </>
            )}

            {/* Personal breakdown */}
            <div className="report-section-title">👤 {lang === "zh" ? "个人消费" : "Per Person"}</div>
            <div className="report-person-rows">
              {spendEntries.map(([id, data], i) => (
                <div key={id} className="report-person-row">
                  {data.isGroup ? (
                    <div className="report-person-group-avatars">
                      {data.memberIds.slice(0, 2).map(mid => {
                        const p = people.find(x => x.id === mid);
                        return p ? <img key={mid} src={p.avatarUrl || dicebearUrl(p.name)} alt={p.name} className="report-avatar-sm" /> : null;
                      })}
                    </div>
                  ) : (
                    <img src={data.avatarUrl || dicebearUrl(data.name)} alt={data.name} className="report-avatar-sm" />
                  )}
                  <span className="report-person-name">{data.name}</span>
                  <span className="report-person-bar-bg">
                    <span className="report-person-bar-fill"
                      style={{ width: `${totalSpend > 0 ? (data.share/totalSpend*100) : 0}%`, background: PALETTE[i % PALETTE.length] }} />
                  </span>
                  <span className="report-person-amount">{formatAmount(data.share, currency)}</span>
                </div>
              ))}
            </div>

            <div className="report-section-divider" />

            {/* Footer */}
            <div className="report-footer">
              <span>🧳 MateTrip</span>
              <span>{new Date().toLocaleDateString(lang === "zh" ? "zh-CN" : "en-GB")}</span>
            </div>
          </div>

          {isOwner && (
            <div className="report-actions">
              <button className="btn-report-share" onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: activeTrip?.name, text: `总消费 ${formatAmount(totalSpend, currency)}` });
                } else {
                  toast?.show(lang === "zh" ? "截图分享给朋友吧！" : "Take a screenshot to share!", "success");
                }
              }}>
                📤 {lang === "zh" ? "分享报告" : "Share Report"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Donut Chart (SVG) ────────────────────────────────────────────────────────
function DonutChart({ entries, total, currency }) {
  const size = 200;
  const r    = 70;
  const cx   = size / 2;
  const cy   = size / 2;
  const circ = 2 * Math.PI * r;
  const [hovered, setHovered] = useState(null);

  let cumPct = 0;
  const slices = entries.map(([tag, amount], i) => {
    const pct   = total > 0 ? amount / total : 0;
    const start = cumPct;
    cumPct += pct;
    return { tag, amount, pct, start, color: PALETTE[i % PALETTE.length] };
  });

  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((s, i) => {
          const dashArr    = `${s.pct * circ} ${circ}`;
          const rotation   = s.start * 360 - 90;
          const isHovered  = hovered === i;
          return (
            <circle key={s.tag}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={isHovered ? 22 : 18}
              strokeDasharray={dashArr}
              strokeDashoffset={0}
              transform={`rotate(${rotation} ${cx} ${cy})`}
              style={{ cursor: "pointer", transition: "stroke-width 0.15s" }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
          );
        })}
        {/* Center text */}
        <text x={cx} y={cy - 8} textAnchor="middle" fontSize="12" fill="#888" fontFamily="sans-serif">
          {hovered !== null ? slices[hovered].tag : "Total"}
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="14" fontWeight="700" fill="#333" fontFamily="sans-serif">
          {hovered !== null
            ? `${(slices[hovered].pct * 100).toFixed(1)}%`
            : `${slices.length} 地区`}
        </text>
      </svg>
    </div>
  );
}
