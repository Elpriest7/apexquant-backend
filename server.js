require("dotenv").config();
const express    = require("express");
const http       = require("http");
const WebSocket  = require("ws");
const cors       = require("cors");
const cron       = require("node-cron");
const { createClient } = require("@supabase/supabase-js");

const marketData   = require("./marketData");
const signalEngine = require("./signalEngine");
const aiService    = require("./aiService");

const app    = express();
const server = http.createServer(app);
app.use(cors({ origin:"*" }));
app.use(express.json());

// ── Supabase ───────────────────────────────────
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

function toRow(t) {
  return {
    id: t.id, asset: t.asset, dir: t.dir, setup: t.setup||"",
    model: t.model||"", fib: t.fib||"N/A", conf: t.conf||9,
    entry: t.entry||0, sl: t.sl||0, tp: t.tp||0, rr: t.rr||0,
    bias_m: t.biasM||"", bias_w: t.biasW||"", bias_d: t.biasD||"",
    fundamental: t.fundamental||"",
    confluence: JSON.stringify(t.confluence||[]),
    exec_note: t.execNote||"", psy_note: t.psyNote||"",
    is_manual: t.isManual||false, outcome: t.outcome||"PENDING",
    pnl: t.pnl||null, ai_write_up: t.aiWriteUp||"",
    journal_narrative: t.journalNarrative||"",
    structure_shift: t.structureShift||null,
  };
}

function fromRow(r) {
  let confluence = [];
  try { confluence = typeof r.confluence==="string" ? JSON.parse(r.confluence) : r.confluence||[]; } catch(_){}
  return {
    id:r.id, asset:r.asset, dir:r.dir, setup:r.setup, model:r.model,
    fib:r.fib, conf:r.conf, entry:r.entry, sl:r.sl, tp:r.tp, rr:r.rr,
    biasM:r.bias_m, biasW:r.bias_w, biasD:r.bias_d,
    fundamental:r.fundamental, confluence,
    execNote:r.exec_note, psyNote:r.psy_note,
    isManual:r.is_manual, outcome:r.outcome, pnl:r.pnl,
    aiWriteUp:r.ai_write_up, journalNarrative:r.journal_narrative,
    structureShift:r.structure_shift, ts:r.created_at, closedAt:r.closed_at,
  };
}

async function dbGetAll() {
  const { data, error } = await sb.from("trades").select("*").order("created_at",{ascending:false}).limit(200);
  if(error) { console.error("dbGetAll error:", error.message); return []; }
  return (data||[]).map(fromRow);
}

async function dbAdd(trade) {
  const { error } = await sb.from("trades").insert(toRow(trade));
  if(error) console.error("dbAdd error:", error.message);
  return trade;
}

async function dbGetById(id) {
  const { data, error } = await sb.from("trades").select("*").eq("id",id).limit(1);
  if(error||!data||!data.length) return null;
  return fromRow(data[0]);
}

async function dbUpdateOutcome(id, outcome) {
  const trade = await dbGetById(id);
  if(!trade) return null;
  const pnl = outcome==="WIN" ? +trade.rr.toFixed(2) : outcome==="LOSS" ? -1 : null;
  const { error } = await sb.from("trades").update({ outcome, pnl, closed_at:new Date().toISOString() }).eq("id",id);
  if(error) { console.error("dbUpdateOutcome error:", error.message); return null; }
  return await dbGetById(id);
}

async function dbUpdate(id, fields) {
  const { error } = await sb.from("trades").update(fields).eq("id",id);
  if(error) console.error("dbUpdate error:", error.message);
}

async function dbGetStats() {
  const trades  = await dbGetAll();
  const closed  = trades.filter(t=>t.outcome!=="PENDING");
  const wins    = closed.filter(t=>t.outcome==="WIN");
  const losses  = closed.filter(t=>t.outcome==="LOSS");
  const pending = trades.filter(t=>t.outcome==="PENDING");
  const totalR  = closed.reduce((s,t)=>s+(t.pnl||0),0);
  const avgRR   = wins.length ? wins.reduce((s,t)=>s+t.rr,0)/wins.length : 0;
  const setups  = {};
  closed.forEach(t=>{
    if(!setups[t.setup]) setups[t.setup]={wins:0,total:0};
    setups[t.setup].total++;
    if(t.outcome==="WIN") setups[t.setup].wins++;
  });
  return {
    total:trades.length, closed:closed.length, pending:pending.length,
    wins:wins.length, losses:losses.length, manual:trades.filter(t=>t.isManual).length,
    winRate:closed.length?+(wins.length/closed.length*100).toFixed(1):0,
    totalR:+totalR.toFixed(2), avgRR:+avgRR.toFixed(2), setups,
  };
}

// ── WebSocket ──────────────────────────────────
const wss     = new WebSocket.Server({ server });
const clients = new Set();

wss.on("connection", async(ws) => {
  clients.add(ws);
  console.log(`Client connected. Total: ${clients.size}`);
  try {
    const [trades, stats] = await Promise.all([dbGetAll(), dbGetStats()]);
    ws.send(JSON.stringify({ type:"INIT", trades, stats }));
  } catch(err) {
    ws.send(JSON.stringify({ type:"INIT", trades:[], stats:{} }));
  }
  ws.on("close", ()=>clients.delete(ws));
  ws.on("error", ()=>clients.delete(ws));
});

function broadcast(data) {
  const msg = JSON.stringify(data);
  clients.forEach(c=>{ if(c.readyState===WebSocket.OPEN) c.send(msg); });
}

// ── Routes ─────────────────────────────────────
app.get("/", async(req,res)=>{
  const trades = await dbGetAll();
  res.json({ status:"APEX QUANT LIVE", mode:"Swing Trading", schedule:"Daily 22:00 GMT + Weekly Friday 21:55 GMT", markets:"31 assets", clients:clients.size, trades:trades.length, uptime:process.uptime().toFixed(0)+"s" });
});

app.get("/api/trades", async(req,res)=>{
  try {
    const trades = await dbGetAll();
    res.setHeader("Content-Type","application/json");
    res.end(JSON.stringify(trades));
  } catch(err) {
    res.setHeader("Content-Type","application/json");
    res.end("[]");
  }
});

app.get("/api/stats", async(req,res)=>{
  try {
    const stats = await dbGetStats();
    res.setHeader("Content-Type","application/json");
    res.end(JSON.stringify(stats));
  } catch(err) {
    res.setHeader("Content-Type","application/json");
    res.end(JSON.stringify({total:0,closed:0,pending:0,wins:0,losses:0,winRate:0,totalR:0,avgRR:0,setups:{}}));
  }
});

app.get("/api/prices", async(req,res)=>{
  try { res.json(await marketData.getAllPrices()); }
  catch(err) { res.status(500).json({error:err.message}); }
});

app.get("/api/debug", async(req,res)=>{
  const { data, error } = await sb.from("trades").select("id,asset,dir").limit(5);
  res.setHeader("Content-Type","application/json");
  res.end(JSON.stringify({ error:error?.message, isArray:Array.isArray(data), length:data?.length, raw:data }));
});

let lastScanLog=[], lastScanTime=null;
app.get("/api/scan", async(req,res)=>{
  const trades = await dbGetAll();
  res.json({ log:lastScanLog, trades:trades.length, lastScan:lastScanTime });
});

app.post("/api/scan", async(req,res)=>{
  res.json({ message:"Swing scan started" });
  await runScan("Manual");
});

app.post("/api/manual-trade", async(req,res)=>{
  try {
    const { asset,dir,setup,entry,sl,tp,biasM,biasW,biasD,fib,notes } = req.body;
    if(!asset||!dir||!entry||!sl||!tp) return res.status(400).json({error:"Missing required fields"});
    const rr = +((Math.abs(+tp-+entry)/Math.abs(+sl-+entry)).toFixed(2));
    if(rr<2) return res.status(400).json({error:`RR is 1:${rr} — minimum is 1:2`,rr});
    if(biasM&&biasW){
      if(dir==="LONG"&&(biasM==="Bearish"||biasW==="Bearish")) return res.status(400).json({error:"LONG rejected — HTF bias is Bearish"});
      if(dir==="SHORT"&&(biasM==="Bullish"||biasW==="Bullish")) return res.status(400).json({error:"SHORT rejected — HTF bias is Bullish"});
    }
    const trade = {
      id:`MANUAL-${asset}-${Date.now()}`, asset, dir,
      setup:setup||"Manual Setup", model:fib&&fib!=="N/A"?`Fib ${fib} + Manual`:"Manual Structure",
      fib:fib||"N/A", conf:9, entry:+entry, sl:+sl, tp:+tp, rr,
      biasM:biasM||"Bullish", biasW:biasW||"Bullish", biasD:biasD||"Bullish",
      fundamental:"", confluence:["Manually submitted","HTF validated","AI journaled"],
      execNote:notes||"Manual trade", psyNote:"Disciplined manual analysis",
      isManual:true, outcome:"PENDING", pnl:null,
      ts:new Date().toISOString(), aiWriteUp:"", journalNarrative:"",
    };
    await dbAdd(trade);
    Promise.all([aiService.getWriteUp(trade), aiService.getFundamental(asset,dir)]).then(async([wu,fund])=>{
      if(wu)   await dbUpdate(trade.id,{ai_write_up:wu});
      if(fund) await dbUpdate(trade.id,{fundamental:fund});
      const updated = await dbGetById(trade.id);
      if(updated) broadcast({type:"TRADE_UPDATED",trade:updated});
    });
    broadcast({type:"NEW_SIGNAL",trade});
    res.json({success:true, message:`✅ ${asset} ${dir} accepted — RR 1:${rr}. AI generating…`, trade});
  } catch(err) {
    res.status(500).json({error:err.message});
  }
});

app.patch("/api/trades/:id", async(req,res)=>{
  const updated = await dbUpdateOutcome(req.params.id, req.body.outcome);
  if(!updated) return res.status(404).json({error:"Trade not found"});
  broadcast({type:"TRADE_UPDATED",trade:updated});
  res.json(updated);
});

app.post("/api/trades/:id/writeup", async(req,res)=>{
  const trade = await dbGetById(req.params.id);
  if(!trade) return res.status(404).json({error:"Not found"});
  const writeUp = await aiService.getWriteUp(trade);
  await dbUpdate(req.params.id,{ai_write_up:writeUp});
  const updated = await dbGetById(req.params.id);
  broadcast({type:"TRADE_UPDATED",trade:updated});
  res.json({writeUp});
});

app.post("/api/trades/:id/journal", async(req,res)=>{
  const trade = await dbGetById(req.params.id);
  if(!trade) return res.status(404).json({error:"Not found"});
  const journalNarrative = await aiService.getJournalNarrative(trade);
  await dbUpdate(req.params.id,{journal_narrative:journalNarrative});
  const updated = await dbGetById(req.params.id);
  broadcast({type:"TRADE_UPDATED",trade:updated});
  res.json({journalNarrative});
});

app.get("/api/improve", async(req,res)=>{
  const stats  = await dbGetStats();
  const report = await aiService.getSelfImprovement(stats);
  res.json({report});
});

// ── Scanner ────────────────────────────────────
async function runScan(trigger="Auto") {
  lastScanLog=[]; lastScanTime=new Date().toISOString();
  const log=(msg)=>{ lastScanLog.push(msg); console.log(msg); };
  log(`🔍 Swing scan: ${trigger} — ${new Date().toUTCString()}`);
  broadcast({type:"SCAN_START",ts:new Date().toISOString(),trigger});
  try {
    const prices  = await marketData.getAllPrices();
    log(`📡 Prices: ${Object.keys(prices).length} markets`);
    const signals = await signalEngine.scan(prices, log);
    for(const signal of signals) {
      await dbAdd(signal);
      Promise.all([aiService.getWriteUp(signal), aiService.getShortNewsBrief(signal.asset,signal.dir)]).then(async([wu,news])=>{
        if(wu)   await dbUpdate(signal.id,{ai_write_up:wu});
        if(news) await dbUpdate(signal.id,{fundamental:news});
        const updated = await dbGetById(signal.id);
        if(updated) broadcast({type:"TRADE_UPDATED",trade:updated});
      });
      broadcast({type:"NEW_SIGNAL",trade:signal});
      log(`✅ ${signal.asset} ${signal.dir} | ${signal.setup} | Fib ${signal.fib} | RR 1:${signal.rr}`);
    }
    const stats = await dbGetStats();
    broadcast({type:"SCAN_COMPLETE",ts:new Date().toISOString(),found:signals.length,scanned:Object.keys(prices).length,stats});
    log(`✅ Done. ${signals.length} signal(s) found.`);
  } catch(err) {
    log(`❌ Error: ${err.message}`);
    broadcast({type:"SCAN_ERROR",error:err.message});
  }
}

// ── Cron ───────────────────────────────────────
cron.schedule("0 22 * * *",  ()=>runScan("Daily Close"),  {timezone:"UTC"});
cron.schedule("55 21 * * 5", ()=>runScan("Weekly Close"), {timezone:"UTC"});
cron.schedule("*/5 * * * *", async()=>{
  try { broadcast({type:"PRICES",data:await marketData.getAllPrices()}); } catch(_){}
});

// ── Start ──────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, ()=>{
  console.log(`\n🚀 APEX QUANT Swing Trading Backend — Port ${PORT}`);
  console.log(`   Supabase: ${process.env.SUPABASE_URL?.slice(0,40)}`);
  setTimeout(()=>runScan("Startup"), 8000);
});
