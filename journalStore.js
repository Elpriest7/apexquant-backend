// ═══════════════════════════════════════════════
//  JOURNAL STORE — In-memory trade storage
//  Step 4 will upgrade this to Supabase DB
// ═══════════════════════════════════════════════
let trades = [];

function add(trade) {
  trades.unshift(trade);
  if(trades.length > 500) trades = trades.slice(0,500);
  return trade;
}

function getAll()      { return trades; }
function getById(id)   { return trades.find(t=>t.id===id)||null; }

function updateOutcome(id, outcome) {
  const t = trades.find(t=>t.id===id);
  if(!t) return null;
  t.outcome   = outcome;
  t.pnl       = outcome==="WIN"?+t.rr.toFixed(2):outcome==="LOSS"?-1:null;
  t.closedAt  = new Date().toISOString();
  return t;
}

function updateWriteUp(id, aiWriteUp) {
  const t = trades.find(t=>t.id===id);
  if(!t) return null;
  t.aiWriteUp = aiWriteUp;
  return t;
}

function updateJournal(id, journalNarrative) {
  const t = trades.find(t=>t.id===id);
  if(!t) return null;
  t.journalNarrative = journalNarrative;
  return t;
}

function updateFundamental(id, fundamental) {
  const t = trades.find(t=>t.id===id);
  if(!t) return null;
  t.fundamental = fundamental;
  return t;
}

function getStats() {
  const closed  = trades.filter(t=>t.outcome!=="PENDING");
  const wins    = closed.filter(t=>t.outcome==="WIN");
  const losses  = closed.filter(t=>t.outcome==="LOSS");
  const pending = trades.filter(t=>t.outcome==="PENDING");
  const totalR  = closed.reduce((s,t)=>s+(t.pnl||0),0);
  const avgRR   = wins.length ? wins.reduce((s,t)=>s+t.rr,0)/wins.length : 0;

  const setups = {};
  closed.forEach(t=>{
    if(!setups[t.setup]) setups[t.setup]={wins:0,total:0};
    setups[t.setup].total++;
    if(t.outcome==="WIN") setups[t.setup].wins++;
  });

  const manual = trades.filter(t=>t.isManual).length;

  return {
    total:   trades.length,
    closed:  closed.length,
    pending: pending.length,
    wins:    wins.length,
    losses:  losses.length,
    manual,
    winRate: closed.length?+(wins.length/closed.length*100).toFixed(1):0,
    totalR:  +totalR.toFixed(2),
    avgRR:   +avgRR.toFixed(2),
    setups,
  };
}

module.exports = { add, getAll, getById, updateOutcome, updateWriteUp, updateJournal, updateFundamental, getStats };
