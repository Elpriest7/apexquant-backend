// ═══════════════════════════════════════════════
//  DATABASE SERVICE — Supabase
//  Permanent storage for all trades
//  Replaces in-memory journalStore
// ═══════════════════════════════════════════════
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ── Convert trade object to DB row ─────────────
function toRow(trade) {
  return {
    id:                 trade.id,
    asset:              trade.asset,
    dir:                trade.dir,
    setup:              trade.setup,
    model:              trade.model,
    fib:                trade.fib,
    conf:               trade.conf,
    entry:              trade.entry,
    sl:                 trade.sl,
    tp:                 trade.tp,
    rr:                 trade.rr,
    bias_m:             trade.biasM,
    bias_w:             trade.biasW,
    bias_d:             trade.biasD,
    fundamental:        trade.fundamental,
    confluence:         trade.confluence,
    exec_note:          trade.execNote,
    psy_note:           trade.psyNote,
    is_manual:          trade.isManual || false,
    outcome:            trade.outcome,
    pnl:                trade.pnl,
    ai_write_up:        trade.aiWriteUp,
    journal_narrative:  trade.journalNarrative,
    structure_shift:    trade.structureShift,
  };
}

// ── Convert DB row to trade object ─────────────
function fromRow(row) {
  return {
    id:                 row.id,
    asset:              row.asset,
    dir:                row.dir,
    setup:              row.setup,
    model:              row.model,
    fib:                row.fib,
    conf:               row.conf,
    entry:              row.entry,
    sl:                 row.sl,
    tp:                 row.tp,
    rr:                 row.rr,
    biasM:              row.bias_m,
    biasW:              row.bias_w,
    biasD:              row.bias_d,
    fundamental:        row.fundamental,
    confluence:         row.confluence,
    execNote:           row.exec_note,
    psyNote:            row.psy_note,
    isManual:           row.is_manual,
    outcome:            row.outcome,
    pnl:                row.pnl,
    aiWriteUp:          row.ai_write_up,
    journalNarrative:   row.journal_narrative,
    structureShift:     row.structure_shift,
    ts:                 row.created_at,
    closedAt:           row.closed_at,
  };
}

// ── Add trade ──────────────────────────────────
async function add(trade) {
  const { error } = await supabase
    .from("trades")
    .insert(toRow(trade));
  if (error) console.error("DB insert error:", error.message);
  return trade;
}

// ── Get all trades ─────────────────────────────
async function getAll() {
  const { data, error } = await supabase
    .from("trades")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) { console.error("DB getAll error:", error.message); return []; }
  return (data || []).map(fromRow);
}

// ── Get trade by ID ────────────────────────────
async function getById(id) {
  const { data, error } = await supabase
    .from("trades")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return data ? fromRow(data) : null;
}

// ── Update outcome ─────────────────────────────
async function updateOutcome(id, outcome) {
  const pnl = outcome === "WIN" ? null : outcome === "LOSS" ? -1 : null;

  // Get RR first for WIN pnl
  const trade = await getById(id);
  if (!trade) return null;
  const finalPnl = outcome === "WIN" ? +trade.rr.toFixed(2) : outcome === "LOSS" ? -1 : null;

  const { error } = await supabase
    .from("trades")
    .update({
      outcome,
      pnl:       finalPnl,
      closed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) { console.error("DB updateOutcome error:", error.message); return null; }
  return await getById(id);
}

// ── Update AI write-up ─────────────────────────
async function updateWriteUp(id, aiWriteUp) {
  const { error } = await supabase
    .from("trades")
    .update({ ai_write_up: aiWriteUp })
    .eq("id", id);
  if (error) console.error("DB updateWriteUp error:", error.message);
  return await getById(id);
}

// ── Update journal narrative ───────────────────
async function updateJournal(id, journalNarrative) {
  const { error } = await supabase
    .from("trades")
    .update({ journal_narrative: journalNarrative })
    .eq("id", id);
  if (error) console.error("DB updateJournal error:", error.message);
  return await getById(id);
}

// ── Update fundamental ─────────────────────────
async function updateFundamental(id, fundamental) {
  const { error } = await supabase
    .from("trades")
    .update({ fundamental })
    .eq("id", id);
  if (error) console.error("DB updateFundamental error:", error.message);
  return await getById(id);
}

// ── Get stats ──────────────────────────────────
async function getStats() {
  const trades  = await getAll();
  const closed  = trades.filter(t => t.outcome !== "PENDING");
  const wins    = closed.filter(t => t.outcome === "WIN");
  const losses  = closed.filter(t => t.outcome === "LOSS");
  const pending = trades.filter(t => t.outcome === "PENDING");
  const totalR  = closed.reduce((s, t) => s + (t.pnl || 0), 0);
  const avgRR   = wins.length ? wins.reduce((s,t)=>s+t.rr,0)/wins.length : 0;

  const setups = {};
  closed.forEach(t => {
    if (!setups[t.setup]) setups[t.setup] = { wins: 0, total: 0 };
    setups[t.setup].total++;
    if (t.outcome === "WIN") setups[t.setup].wins++;
  });

  return {
    total:   trades.length,
    closed:  closed.length,
    pending: pending.length,
    wins:    wins.length,
    losses:  losses.length,
    manual:  trades.filter(t => t.isManual).length,
    winRate: closed.length ? +(wins.length / closed.length * 100).toFixed(1) : 0,
    totalR:  +totalR.toFixed(2),
    avgRR:   +avgRR.toFixed(2),
    setups,
  };
}

module.exports = { add, getAll, getById, updateOutcome, updateWriteUp, updateJournal, updateFundamental, getStats };
