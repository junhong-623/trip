import { useState, useEffect } from "react";
import { useTrip } from "../../contexts/TripContext";
import { useLang } from "../../contexts/LangContext";
import { subscribeReceipts, subscribePeople, subscribeSettlements, addSettlement } from "../../services/firestore";
import { computeBalances, computeDebts, formatAmount, dicebearUrl, parseAmount, roundMoney } from "../../utils/utils";
import "./SummaryPage.css";

export default function SummaryPage({ toast }) {
  const { activeTrip } = useTrip();
  const { tr, t } = useLang();
  const [receipts, setReceipts] = useState([]);
  const [people, setPeople] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [payAmount, setPayAmount] = useState({});

  useEffect(() => {
    if (!activeTrip?.id) return;
    const u1 = subscribeReceipts(activeTrip.id, setReceipts);
    const u2 = subscribePeople(activeTrip.id, setPeople);
    const u3 = subscribeSettlements(activeTrip.id, setSettlements);
    return () => { u1(); u2(); u3(); };
  }, [activeTrip?.id]);

  const balances = computeBalances(receipts, people);
  const debts = computeDebts(balances);
  const currency = activeTrip?.baseCurrency || "USD";
  const getPerson = (id) => people.find(p => p.id === id);

  const handleSettle = async (debt, amount) => {
    try {
      await addSettlement(activeTrip.id, {
        fromId: debt.fromId, toId: debt.toId,
        amount: parseAmount(amount) || debt.amount,
        cleared: true,
      });
      toast.show(tr.settled, "success");
      setPayAmount(p => ({ ...p, [`${debt.fromId}-${debt.toId}`]: "" }));
    } catch (e) {
      toast.show(e.message, "error");
    }
  };

  const settledMap = {};
  settlements.filter(s => s.cleared).forEach(s => {
    const key = `${s.fromId}-${s.toId}`;
    settledMap[key] = roundMoney((settledMap[key] || 0) + s.amount);
  });

  const activeDebts = debts.map(d => {
    const key = `${d.fromId}-${d.toId}`;
    return { ...d, remaining: roundMoney(Math.max(0, d.amount - (settledMap[key] || 0))) };
  }).filter(d => d.remaining > 0.01);

  const clearedDebts = debts.filter(d => {
    const key = `${d.fromId}-${d.toId}`;
    return roundMoney(Math.max(0, d.amount - (settledMap[key] || 0))) <= 0.01;
  });

  if (!activeTrip) return (
    <div className="empty-state">
      <div className="empty-state-icon">✈️</div>
      <div className="empty-state-title">{tr.noTripSelected}</div>
    </div>
  );

  const totalSpend = receipts.reduce((s, r) => s + (r.totalAmount || 0), 0);

  return (
    <div>
      <h1 className="page-title">{tr.summaryTitle}</h1>
      <p className="page-subtitle">{activeTrip.name}</p>

      <div className="summary-total-card card" style={{marginBottom:16}}>
        <div className="summary-total-label">{tr.totalTripSpend}</div>
        <div className="summary-total-amount">{formatAmount(totalSpend, currency)}</div>
        <div className="summary-total-sub">{t(tr.receiptsCount, receipts.length, people.length)}</div>
      </div>

      <div className="section-title" style={{marginBottom:10}}>{tr.individualBalances}</div>
      <div className="balance-list" style={{marginBottom:20}}>
        {people.map(person => {
          const b = balances[person.id] || { paid: 0, owed: 0, net: 0 };
          return (
            <div key={person.id} className="balance-card card">
              <div className="balance-card-top">
                <img src={person.avatarUrl || dicebearUrl(person.name)} alt={person.name}
                  className="avatar avatar-md" />
                <div className="balance-card-info">
                  <div className="balance-name">{person.name}</div>
                  <div className="balance-details">
                    {tr.paid} {formatAmount(b.paid, currency)} · {tr.owes} {formatAmount(b.owed, currency)}
                  </div>
                </div>
                <div className={`balance-net amount ${b.net >= 0 ? "amount-positive" : "amount-negative"}`}>
                  {b.net >= 0 ? "+" : ""}{formatAmount(b.net, currency)}
                </div>
              </div>
              <div className="balance-bar-wrap">
                <div className="balance-bar" style={{
                  width: totalSpend > 0 ? `${Math.min(100, (b.paid / totalSpend) * 100)}%` : "0%"
                }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="section-title" style={{marginBottom:10}}>{tr.whoOwesWhom}</div>
      {activeDebts.length === 0 ? (
        <div className="empty-state" style={{padding:"24px"}}>
          <div className="empty-state-icon">🎉</div>
          <div className="empty-state-title">{tr.allSettled}</div>
          <div className="empty-state-text">{tr.noOutstanding}</div>
        </div>
      ) : (
        <div className="debt-list" style={{marginBottom:20}}>
          {activeDebts.map((debt, i) => {
            const from = getPerson(debt.fromId);
            const to = getPerson(debt.toId);
            const key = `${debt.fromId}-${debt.toId}`;
            if (!from || !to) return null;
            return (
              <div key={i} className="debt-card card">
                <div className="debt-top">
                  <div className="debt-people">
                    <img src={from.avatarUrl || dicebearUrl(from.name)} alt={from.name} className="avatar avatar-sm" />
                    <div className="debt-arrow">→</div>
                    <img src={to.avatarUrl || dicebearUrl(to.name)} alt={to.name} className="avatar avatar-sm" />
                  </div>
                  <div className="debt-amount-wrap">
                    <span className="debt-text">
                      <strong>{from.name}</strong> → <strong>{to.name}</strong>
                    </span>
                    <span className="amount amount-negative" style={{fontSize:18,fontWeight:600}}>
                      {formatAmount(debt.remaining, currency)}
                    </span>
                  </div>
                </div>
                <div className="debt-actions">
                  <input className="form-input" type="number" step="0.01"
                    value={payAmount[key] || ""}
                    onChange={e => setPayAmount(p => ({...p, [key]: e.target.value}))}
                    placeholder={`${debt.remaining.toFixed(2)}`}
                    style={{flex:1,height:36}} />
                  <button className="btn btn-secondary btn-sm"
                    onClick={() => handleSettle(debt, payAmount[key] || debt.remaining)}>
                    {tr.record}
                  </button>
                  <button className="btn btn-primary btn-sm"
                    onClick={() => handleSettle({...debt, amount: debt.remaining}, debt.remaining)}>
                    {tr.settled}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {clearedDebts.length > 0 && (
        <>
          <div className="section-title" style={{marginBottom:10,opacity:0.6}}>{tr.cleared}</div>
          <div className="debt-list">
            {clearedDebts.map((debt, i) => {
              const from = getPerson(debt.fromId);
              const to = getPerson(debt.toId);
              if (!from || !to) return null;
              return (
                <div key={i} className="debt-card card" style={{opacity:0.5}}>
                  <div className="debt-top">
                    <div className="debt-people">
                      <img src={from.avatarUrl || dicebearUrl(from.name)} alt={from.name} className="avatar avatar-sm" />
                      <div className="debt-arrow">→</div>
                      <img src={to.avatarUrl || dicebearUrl(to.name)} alt={to.name} className="avatar avatar-sm" />
                    </div>
                    <div>
                      <span style={{fontSize:13,color:"var(--ink-muted)"}}>{from.name} → {to.name}</span>
                      <span className="amount" style={{marginLeft:8,fontSize:14}}>{formatAmount(debt.amount, currency)} ✓</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
