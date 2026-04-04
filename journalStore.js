// ═══════════════════════════════════════════════
//  JOURNAL STORE
//  In-memory trade storage for Step 1
//  Step 4 will replace this with Supabase DB
// ═══════════════════════════════════════════════

let trades = [];

function add(trade) {
  trades.unshift(trade); // newest first
  // Keep max 500 trades in memory
  if (trades.length > 500) trades = trades.slice(0, 500);
  return trade;
}

function getAll() {
  return trades;
}

function getById(id) {
  return trades.find(t => t.id === id) || null;
}

function updateOutcome(id, outcome) {
  const trade = trades.find(t => t.id === id);
  if (!trade) return null;

  trade.outcome = outcome;
  trade.pnl     = outcome === "WIN"  ? +trade.rr.toFixed(2)
                : outcome === "LOSS" ? -1
                : null;
  trade.closedAt = new Date().toISOString();
  return trade;
}

function updateWriteUp(id, aiWriteUp) {
  const trade = trades.find(t => t.id === id);
  if (!trade) return null;
  trade.aiWriteUp = aiWriteUp;
  return trade;
}

function updateJournal(id, journalNarrative) {
  const trade = trades.find(t => t.id === id);
  if (!trade) return null;
  trade.journalNarrative = journalNarrative;
  return trade;
}

function getStats() {
  const closed  = trades.filter(t => t.outcome !== "PENDING");
  const wins    = closed.filter(t => t.outcome === "WIN");
  const losses  = closed.filter(t => t.outcome === "LOSS");
  const pending = trades.filter(t => t.outcome === "PENDING");

  const totalR  = closed.reduce((s, t) => s + (t.pnl || 0), 0);
  const avgRR   = wins.length
    ? wins.reduce((s, t) => s + t.rr, 0) / wins.length
    : 0;

  // Setup breakdown
  const setups = {};
  closed.forEach(t => {
    if (!setups[t.setup]) setups[t.setup] = { wins: 0, total: 0 };
    setups[t.setup].total++;
    if (t.outcome === "WIN") setups[t.setup].wins++;
  });

  // Asset breakdown
  const assets = {};
  closed.forEach(t => {
    if (!assets[t.asset]) assets[t.asset] = { wins: 0, total: 0 };
    assets[t.asset].total++;
    if (t.outcome === "WIN") assets[t.asset].wins++;
  });

  return {
    total:   trades.length,
    closed:  closed.length,
    pending: pending.length,
    wins:    wins.length,
    losses:  losses.length,
    winRate: closed.length ? +(wins.length / closed.length * 100).toFixed(1) : 0,
    totalR:  +totalR.toFixed(2),
    avgRR:   +avgRR.toFixed(2),
    setups,
    assets,
  };
}

module.exports = { add, getAll, getById, updateOutcome, updateWriteUp, updateJournal, getStats };
