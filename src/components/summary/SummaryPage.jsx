import { useState, useEffect } from "react";
import { useTrip } from "../../contexts/TripContext";
import { useLang } from "../../contexts/LangContext";
import {
  subscribeReceipts, subscribePeople, subscribeSettlements,
  addSettlement, deleteSettlement
} from "../../services/firestore";
import { formatAmount, formatDateShort, dicebearUrl, parseAmount, roundMoney } from "../../utils/utils";
import "./SummaryPage.css";

// ─── Compute per-receipt what each person owes the payer ──────────────────────
function computeReceiptDebts(receipt, people) {
  // Returns [{ debtorId, creditorId, amount, receiptId, receiptName }]
  const debts = [];
  const payerId = receipt.payerId;
  if (!payerId) return debts;

  const items = receipt.items || [];
  const total = parseAmount(receipt.totalAmount);

  if (items.length === 0) {
    // Equal split among participants
    const parts = (receipt.participants || []).filter(id => id !== payerId);
    if (parts.length === 0) return debts;
    const each = roundMoney(total / (parts.length + 1));
    parts.forEach(pid => {
      if (pid !== payerId) {
        debts.push({ debtorId: pid, creditorId: payerId, amount: each });
      }
    });
  } else {
    // Item-level split
    items.forEach(item => {
      const eaters = (item.eaters || []);
      if (eaters.length === 0) return;
      const itemPrice = parseAmount(item.price);
      const each = roundMoney(itemPrice / eaters.length);
      eaters.forEach(eid => {
        if (eid !== payerId) {
          debts.push({ debtorId: eid, creditorId: payerId, amount: each });
        }
      });
    });
  }

  // Merge same debtor pairs within this receipt
  const merged = {};
  debts.forEach(d => {
    const key = `${d.debtorId}-${d.creditorId}`;
    merged[key] = roundMoney((merged[key] || 0) + d.amount);
  });

  return Object.entries(merged).map(([key, amount]) => {
    const [debtorId, creditorId] = key.split("-");
    return { debtorId, creditorId, amount, receiptId: receipt.id, receiptName: receipt.restaurantName || "Expense" };
  });
}

export default function SummaryPage({ toast }) {
  const { activeTrip } = useTrip();
  const { tr, t } = useLang();
  const [receipts, setReceipts] = useState([]);
  const [people, setPeople] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [expandedReceipt, setExpandedReceipt] = useState(null);

  useEffect(() => {
    if (!activeTrip?.id) return;
    const u1 = subscribeReceipts(activeTrip.id, setReceipts);
    const u2 = subscribePeople(activeTrip.id, setPeople);
    const u3 = subscribeSettlements(activeTrip.id, setSettlements);
    return () => { u1(); u2(); u3(); };
  }, [activeTrip?.id]);

  const currency = activeTrip?.baseCurrency || "USD";
  const getPerson = id => people.find(p => p.id === id);

  // Build settlement lookup: { receiptId+debtorId+creditorId → [settlement docs] }
  const settleMap = {};
  settlements.forEach(s => {
    const key = `${s.receiptId}|${s.debtorId}|${s.creditorId}`;
    if (!settleMap[key]) settleMap[key] = [];
    settleMap[key].push(s);
  });

  const isSettled = (receiptId, debtorId, creditorId) => {
    const key = `${receiptId}|${debtorId}|${creditorId}`;
    return (settleMap[key] || []).some(s => s.cleared);
  };

  const getSettlementDoc = (receiptId, debtorId, creditorId) => {
    const key = `${receiptId}|${debtorId}|${creditorId}`;
    return (settleMap[key] || []).find(s => s.cleared);
  };

  const handleSettle = async (debt) => {
    try {
      await addSettlement(activeTrip.id, {
        receiptId: debt.receiptId,
        receiptName: debt.receiptName,
        debtorId: debt.debtorId,
        creditorId: debt.creditorId,
        amount: debt.amount,
        cleared: true,
      });
      toast.show(tr.settled, "success");
    } catch (e) {
      toast.show(e.message, "error");
    }
  };

  const handleUnsettle = async (debt) => {
    const doc = getSettlementDoc(debt.receiptId, debt.debtorId, debt.creditorId);
    if (!doc) return;
    try {
      await deleteSettlement(activeTrip.id, doc.id);
      toast.show(tr.unsettled || "Settlement undone", "success");
    } catch (e) {
      toast.show(e.message, "error");
    }
  };

  if (!activeTrip) return (
    <div className="empty-state">
      <div className="empty-state-icon">✈️</div>
      <div className="empty-state-title">{tr.noTripSelected}</div>
    </div>
  );

  const totalSpend = receipts.reduce((s, r) => s + parseAmount(r.totalAmount), 0);

  // Per-person totals
  const personAdvanced = {};  // 垫付 = receipts they paid as payer
  const personOwes = {};      // 应付 = total they owe others (fixed, never changes)
  const personSettled = {};   // 结清已付 = settlements they've made as debtor
  people.forEach(p => { personAdvanced[p.id] = 0; personOwes[p.id] = 0; personSettled[p.id] = 0; });

  receipts.forEach(r => {
    if (r.payerId && personAdvanced[r.payerId] !== undefined)
      personAdvanced[r.payerId] = roundMoney(personAdvanced[r.payerId] + parseAmount(r.totalAmount));
    computeReceiptDebts(r, people).forEach(d => {
      if (personOwes[d.debtorId] !== undefined)
        personOwes[d.debtorId] = roundMoney(personOwes[d.debtorId] + d.amount);
    });
  });

  // Settlements: track how much debtor has paid back
  settlements.filter(s => s.cleared).forEach(s => {
    if (personSettled[s.debtorId] !== undefined)
      personSettled[s.debtorId] = roundMoney(personSettled[s.debtorId] + s.amount);
  });

  // Count pending debts across all receipts
  const allReceiptDebts = receipts.flatMap(r => computeReceiptDebts(r, people));
  const pendingCount = allReceiptDebts.filter(d => !isSettled(d.receiptId, d.debtorId, d.creditorId)).length;

  return (
    <div>
      <h1 className="page-title">{tr.summaryTitle}</h1>
      <p className="page-subtitle">{activeTrip.name}</p>

      {/* Trip total */}
      <div className="summary-total-card card" style={{ marginBottom: 16 }}>
        <div className="summary-total-label">{tr.totalTripSpend}</div>
        <div className="summary-total-amount">{formatAmount(totalSpend, currency)}</div>
        <div className="summary-total-sub">
          {t(tr.receiptsCount, receipts.length, people.length)}
          {pendingCount > 0 && <span className="pending-badge"> · {pendingCount} pending</span>}
        </div>
      </div>

      {/* Per-person balances */}
      <div className="section-title" style={{ marginBottom: 10 }}>{tr.individualBalances}</div>
      <div className="balance-list" style={{ marginBottom: 20 }}>
        {people.map(person => {
          const advanced = personAdvanced[person.id] || 0;  // 垫付
          const owes = personOwes[person.id] || 0;           // 应付
          const settled = personSettled[person.id] || 0;     // 结清已付
          // 进度条 = 结清已付 / 应付
          const progress = owes > 0 ? Math.min(1, settled / owes) : (advanced > 0 ? 1 : 0);
          return (
            <div key={person.id} className="balance-card card">
              <div className="balance-card-top">
                <img src={person.avatarUrl || dicebearUrl(person.name)} alt={person.name} className="avatar avatar-md" />
                <div className="balance-card-info">
                  <div className="balance-name">{person.name}</div>
                  <div className="balance-details">
                    {tr.paid} {formatAmount(settled, currency)}
                    <span className="balance-sep">·</span>
                    {tr.owes} {formatAmount(owes, currency)}
                    {advanced > 0 && (
                      <span className="balance-advanced">
                        <span className="balance-sep">·</span>
                        垫付 {formatAmount(advanced, currency)}
                      </span>
                    )}
                  </div>
                </div>
                <div className={`balance-net amount ${settled >= owes && owes > 0 ? "amount-positive" : owes > settled ? "amount-negative" : ""}`}>
                  {owes > 0
                    ? (settled >= owes ? "✓" : `-${formatAmount(roundMoney(owes - settled), currency)}`)
                    : (advanced > 0 ? `+${formatAmount(advanced, currency)}` : "—")
                  }
                </div>
              </div>
              <div className="balance-bar-wrap">
                <div className="balance-bar" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Per-receipt breakdown */}
      <div className="section-title" style={{ marginBottom: 10 }}>{tr.whoOwesWhom}</div>

      {receipts.length === 0 ? (
        <div className="empty-state" style={{ padding: "24px" }}>
          <div className="empty-state-icon">🧾</div>
          <div className="empty-state-title">{tr.noReceiptsYet}</div>
        </div>
      ) : (
        <div className="receipt-debts-list">
          {receipts.map(receipt => {
            const debts = computeReceiptDebts(receipt, people);
            if (debts.length === 0) return null;

            const payer = getPerson(receipt.payerId);
            const allCleared = debts.every(d => isSettled(d.receiptId, d.debtorId, d.creditorId));
            const isOpen = expandedReceipt === receipt.id;

            const settledCount = debts.filter(d => isSettled(d.receiptId, d.debtorId, d.creditorId)).length;

            return (
              <div key={receipt.id} className={`receipt-debt-card card ${allCleared ? "all-cleared" : ""}`}>
                {/* Header — tap to expand/collapse */}
                <div className="receipt-debt-header" onClick={() => setExpandedReceipt(isOpen ? null : receipt.id)}>
                  <div className="receipt-debt-header-left">
                    <div className="receipt-debt-name">{receipt.restaurantName || "Expense"}</div>
                    <div className="receipt-debt-meta">
                      {formatDateShort(receipt.date)}
                      {payer && <span> · {tr.paid} by <strong>{payer.name}</strong></span>}
                    </div>
                  </div>
                  <div className="receipt-debt-header-right">
                    <span className="amount" style={{ fontSize: 15, fontWeight: 600 }}>
                      {formatAmount(parseAmount(receipt.totalAmount), currency)}
                    </span>
                    {allCleared
                      ? <span className="cleared-badge">✓ {tr.cleared}</span>
                      : <span className="pending-count-badge">{settledCount}/{debts.length}</span>
                    }
                    <span className="expand-chevron">{isOpen ? "▲" : "▼"}</span>
                  </div>
                </div>

                {/* Expanded debt rows */}
                {isOpen && (
                  <div className="receipt-debt-rows">
                    {debts.map((debt, i) => {
                      const debtor = getPerson(debt.debtorId);
                      const creditor = getPerson(debt.creditorId);
                      const settled = isSettled(debt.receiptId, debt.debtorId, debt.creditorId);
                      if (!debtor || !creditor) return null;

                      return (
                        <div key={i} className={`debt-row ${settled ? "debt-row-settled" : ""}`}>
                          <div className="debt-row-people">
                            <div className="debt-person">
                              <img src={debtor.avatarUrl || dicebearUrl(debtor.name)} alt={debtor.name}
                                className="avatar" style={{ width: 36, height: 36 }} />
                              <span className="debt-person-name">{debtor.name}</span>
                            </div>
                            <span className="debt-row-arrow">→</span>
                            <div className="debt-person">
                              <img src={creditor.avatarUrl || dicebearUrl(creditor.name)} alt={creditor.name}
                                className="avatar" style={{ width: 36, height: 36 }} />
                              <span className="debt-person-name">{creditor.name}</span>
                            </div>
                          </div>
                          <div className="debt-row-right">
                            <span className={`amount ${settled ? "amount-settled" : "amount-negative"}`} style={{ fontWeight: 600 }}>
                              {formatAmount(debt.amount, currency)}
                            </span>
                            {settled ? (
                              <button
                                className="btn btn-ghost btn-sm unsettle-btn"
                                onClick={() => handleUnsettle(debt)}
                              >
                                ↩ {tr.unsettle || "Undo"}
                              </button>
                            ) : (
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => handleSettle(debt)}
                              >
                                {tr.settled}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
