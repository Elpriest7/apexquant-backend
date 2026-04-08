// ═══════════════════════════════════════════════
//  DATABASE SERVICE — Supabase
//  Permanent storage for all trades
// ═══════════════════════════════════════════════
const { createClient } = require("@supabase/supabase-js");

let supabase = null;

function getClient() {
  if (!supabase) {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
  }
  return supabase;
}

function toRow(trade) {
  return {
    id:                trade.id,
    asset:             trade.asset,
    dir:               trade.dir,
    setup:             trade.setup || "",
    model:             trade.model || "",
    fib:               trade.fib || "N/A",
    conf:              trade.conf || 9,
    entry:             trade.entry || 0,
    sl:                trade.sl || 0,
    tp:                trade.tp || 0,
    rr:                trade.rr || 0,
    bias_m:            trade.biasM || "",
    bias_w:            trade.biasW || "",
    bias_d:            trade.biasD || "",
    fundamental:       trade.fundamental || "",
    confluence:        JSON.stringify(trade.confluence || []),
    exec_note:         trade.execNote || "",
    psy_note:          trade.psyNote || "",
    is_manual:         trade.isManual || false,
    outcome:           trade.outcome || "PENDING",
    pnl:               trade.pnl || null,
    ai_write_up:       trade.aiWriteUp || "",
    journal_narrative: trade.journalNarrative || "",
    structure_shift:   trade.structureShift || null,
  };
}

function fromRow(row) {
  let confluence = [];
  try {
    confluence = typeof row.confluence === "string"
      ? JSON.parse(row.confluence)
      : row.confluence || [];
  } catch(_) {}

  return {
    id:               row.id,
    asset:            row.asset,
    dir:              row.dir,
    setup:            row.setup,
    model:            row.model,
    fib:              row.fib,
    conf:             row.conf,
    entry:            row.entry,
    sl:               row.sl,
    tp:               row.tp,
    rr:               row.rr,
    biasM:            row.bias_m,
    biasW:            row.bias_w,
    biasD:            row.bias_d,
    fundamental:      row.fundamental,
    confluence,
    execNote:         row.exec_note,
    psyNote:          row.psy_note,
    isManual:         row.is_manual,
    outcome:          row.outcome,
    pnl:              row.pnl,
    aiWriteUp:        row.ai_write_up,
    journalNarrative: row.journal_narrative,
    structureShift:   row.structure_shift,
    ts:               row.created_at,
    closedAt:         row.closed_at,
  };
}

async function add(trade) {
  try {
    const sb = getClient();
    const row = toRow(trade);
    const { error } = await sb.from("trades").insert(row);
    if (error) console.error("DB insert error:", error.message);
    else console.log("DB saved:", trade.id);
  } catch(err) {
    console.error("DB add exception:", err.message);
  }
  return trade;
}

async function getAll() {
  try {
    const sb = getClient();
    const { data, error } = await sb
      .from("trades")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) { console.error("DB getAll error:", error.message); return []; }
    if (!data) return [];
    // Force plain array
    const arr = [];
    for (let i = 0; i < data.length; i++) arr.push(fromRow(data[i]));
    return arr;
  } catch(err) {
    console.error("DB getAll exception:", err.message);
    return [];
  }
}

async function getById(id) {
  try {
    const sb = getClient();
    const { data, error } = await sb
      .from("trades")
      .select("*")
      .eq("id", id)
      .limit(1);
    if (error || !data || data.length === 0) return null;
    return fromRow(data[0]);
  } catch(err) {
    return null;
  }
}

async function updateOutcome(id, outcome) {
  try {
    const trade   = await getById(id);
    if (!trade) return null;
    const finalPnl = outcome === "WIN" ? +trade.rr.toFixed(2) : outcome === "LOSS" ? -1 : null;
    const sb = getClient();
    const { error } = await sb.from("trades").update({
      outcome, pnl: finalPnl, closed_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) { console.error("DB updateOutcome error:", error.message); return null; }
    return await getById(id);
  } catch(err) {
    console.error("DB updateOutcome exception:", err.message);
    return null;
  }
}

async function updateWriteUp(id, aiWriteUp) {
  try {
    const sb = getClient();
    await sb.from("trades").update({ ai_write_up: aiWriteUp }).eq("id", id);
  } catch(err) { console.error("updateWriteUp error:", err.message); }
}

async function updateJournal(id, journalNarrative) {
  try {
    const sb = getClient();
    await sb.from("trades").update({ journal_narrative: journalNarrative }).eq("id", id);
  } catch(err) { console.error("updateJournal error:", err.message); }
}

async function updateFundamental(id, fundamental) {
  try {
    const sb = getClient();
    await sb.from("trades").update({ fundamental }).eq("id", id);
  } catch(err) { console.error("updateFundamental error:", err.message); }
}

async function getStats() {
  try {
    const trades  = await getAll();
    const closed  = trades.filter(t => t.outcome !== "PENDING");
    const wins    = closed.filter(t => t.outcome === "WIN");
    const losses  = closed.filter(t => t.outcome === "LOSS");
    const pending = trades.filter(t => t.outcome === "PENDING");
    const totalR  = closed.reduce((s, t) => s + (t.pnl || 0), 0);
    const avgRR   = wins.length ? wins.reduce((s,t)=>s+t.rr,0)/wins.length : 0;
    const setups  = {};
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
      winRate: closed.length ? +(wins.length/closed.length*100).toFixed(1) : 0,
      totalR:  +totalR.toFixed(2),
      avgRR:   +avgRR.toFixed(2),
      setups,
    };
  } catch(err) {
    console.error("getStats error:", err.message);
    return { total:0,closed:0,pending:0,wins:0,losses:0,winRate:0,totalR:0,avgRR:0,setups:{} };
  }
}

module.exports = { add, getAll, getById, updateOutcome, updateWriteUp, updateJournal, updateFundamental, getStats };
