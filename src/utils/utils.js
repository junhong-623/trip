// utils.js

// ─── Currency ─────────────────────────────────────────────────────────────────
export function formatAmount(amount, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount || 0);
}

export function parseAmount(str) {
  const n = parseFloat(String(str).replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

// ─── Dates ────────────────────────────────────────────────────────────────────
export function formatDate(date) {
  if (!date) return "";
  const d = date?.toDate ? date.toDate() : new Date(date);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateShort(date) {
  if (!date) return "";
  const d = date?.toDate ? date.toDate() : new Date(date);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function toInputDate(date) {
  if (!date) return "";
  const d = date?.toDate ? date.toDate() : new Date(date);
  return d.toISOString().slice(0, 10);
}

// ─── Avatars ──────────────────────────────────────────────────────────────────
export function dicebearUrl(seed, style = "notionists") {
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=transparent`;
}

// ─── Settlement Math ──────────────────────────────────────────────────────────
/**
 * Compute balances from receipts.
 * Returns: Map<personId, { paid, owed, net }>
 * net > 0 = person is owed money; net < 0 = person owes money
 */
export function computeBalances(receipts, people) {
  const bal = {};
  people.forEach(p => { bal[p.id] = { paid: 0, owed: 0, net: 0 }; });

  receipts.forEach(receipt => {
    const payerId = receipt.payerId;
    const items = receipt.items || [];

    // If no items, split total equally among participants
    if (items.length === 0) {
      const parts = receipt.participants || [];
      if (parts.length === 0) return;
      const share = (receipt.totalAmount || 0) / parts.length;
      if (bal[payerId]) bal[payerId].paid += receipt.totalAmount || 0;
      parts.forEach(pid => {
        if (bal[pid]) bal[pid].owed += share;
      });
    } else {
      if (bal[payerId]) bal[payerId].paid += receipt.totalAmount || 0;
      items.forEach(item => {
        const eaters = item.eaters || [];
        if (eaters.length === 0) return;
        const share = (item.price || 0) / eaters.length;
        eaters.forEach(pid => {
          if (bal[pid]) bal[pid].owed += share;
        });
      });
    }
  });

  Object.keys(bal).forEach(id => {
    bal[id].net = bal[id].paid - bal[id].owed;
  });

  return bal;
}

/**
 * Compute who owes whom (simple, no optimization).
 * Returns: [{ fromId, toId, amount }]
 */
export function computeDebts(balances) {
  const creditors = [];
  const debtors = [];

  Object.entries(balances).forEach(([id, b]) => {
    if (b.net > 0.01) creditors.push({ id, amount: b.net });
    else if (b.net < -0.01) debtors.push({ id, amount: -b.net });
  });

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const debts = [];
  let ci = 0, di = 0;
  const c = creditors.map(x => ({ ...x }));
  const d = debtors.map(x => ({ ...x }));

  while (ci < c.length && di < d.length) {
    const amount = Math.min(c[ci].amount, d[di].amount);
    if (amount > 0.01) {
      debts.push({ fromId: d[di].id, toId: c[ci].id, amount: +amount.toFixed(2) });
    }
    c[ci].amount -= amount;
    d[di].amount -= amount;
    if (c[ci].amount < 0.01) ci++;
    if (d[di].amount < 0.01) di++;
  }

  return debts;
}

// ─── Misc ─────────────────────────────────────────────────────────────────────
export function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

export function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}
