require("dotenv").config();
const express    = require("express");
const http       = require("http");
const WebSocket  = require("ws");
const cors       = require("cors");
const cron       = require("node-cron");

const marketData   = require("./marketData");
const signalEngine = require("./signalEngine");
const journalStore = require("./database");
const aiService    = require("./aiService");

const app    = express();
const server = http.createServer(app);

app.use(cors({ origin: "*" }));
app.use(express.json());

// ── WebSocket ──────────────────────────────────
const wss     = new WebSocket.Server({ server });
const clients = new Set();

wss.on("connection", (ws) => {
  clients.add(ws);
  console.log(`Client connected. Total: ${clients.size}`);
  ws.send(JSON.stringify({
    type:   "INIT",
    trades: journalStore.getAll(),
    stats:  journalStore.getStats(),
  }));
  ws.on("close", () => { clients.delete(ws); });
  ws.on("error", () => { clients.delete(ws); });
});

function broadcast(data){
  const msg = JSON.stringify(data);
  clients.forEach(c=>{ if(c.readyState===WebSocket.OPEN) c.send(msg); });
}

// ── REST Routes ────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    status:   "APEX QUANT LIVE",
    mode:     "Swing Trading",
    schedule: "Daily scan at 22:00 GMT + Weekly scan Friday 21:55 GMT",
    markets:  "31 assets — Forex, Crypto, Stocks, Commodities",
    clients:  clients.size,
    trades:   journalStore.getAll().length,
    uptime:   process.uptime().toFixed(0) + "s",
  });
});

app.get("/api/trades",  (req, res) => res.json(journalStore.getAll()));
app.get("/api/stats",   (req, res) => res.json(journalStore.getStats()));

// Add a test trade to verify DB saving works
app.post("/api/test-trade", async (req, res) => {
  try {
    const testTrade = {
      id: `TEST-${Date.now()}`,
      asset: "XAUUSD", dir: "LONG", setup: "Test Setup",
      model: "Test Model", fib: "0.786", conf: 9,
      entry: 4700, sl: 4650, tp: 4800, rr: 2.0,
      biasM: "Bullish", biasW: "Bullish", biasD: "Bullish",
      fundamental: "Test fundamental", confluence: ["Test confluence"],
      execNote: "Test execution", psyNote: "Test psychology",
      isManual: false, outcome: "PENDING", pnl: null,
      aiWriteUp: "", journalNarrative: "", structureShift: null,
    };
    await journalStore.add(testTrade);
    const all = await journalStore.getAll();
    res.json({ success: true, saved: testTrade.id, totalTrades: all.length });
  } catch(err) {
    res.json({ success: false, error: err.message });
  }
});

// DB connection test
app.get("/api/dbtest", async (req, res) => {
  try {
    const { createClient } = require("@supabase/supabase-js");
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    const { data, error } = await sb.from("trades").select("count").limit(1);
    if(error) return res.json({ connected: false, error: error.message });
    res.json({ connected: true, supabaseUrl: process.env.SUPABASE_URL?.slice(0,30)+"...", data });
  } catch(err) {
    res.json({ connected: false, error: err.message });
  }
});

app.get("/api/prices", async (req, res) => {
  try { res.json(await marketData.getAllPrices()); }
  catch(err) { res.status(500).json({ error: err.message }); }
});

// GET scan — returns full detailed log
let lastScanLog = [];
let lastScanTime = null;
app.get("/api/scan", (req, res) => {
  res.json({
    log:       lastScanLog,
    trades:    journalStore.getAll().length,
    lastScan:  lastScanTime,
  });
});

// POST scan — trigger manual scan
app.post("/api/scan", async (req, res) => {
  res.json({ message: "Swing scan started — check /api/scan for detailed log" });
  await runScan("Manual");
});

// ── Manual Trade Upload ────────────────────────
app.post("/api/manual-trade", async (req, res) => {
  try{
    const { asset, dir, setup, entry, sl, tp, biasM, biasW, biasD, fib, notes } = req.body;

    if(!asset||!dir||!entry||!sl||!tp){
      return res.status(400).json({ error:"Missing required fields: asset, dir, entry, sl, tp" });
    }

    const rr = +((Math.abs(+tp-+entry)/Math.abs(+sl-+entry)).toFixed(2));

    if(rr<2){
      return res.status(400).json({
        error:`RR is 1:${rr} — minimum required is 1:2. Move your TP further.`, rr,
      });
    }

    if(biasM&&biasW){
      if(dir==="LONG"&&(biasM==="Bearish"||biasW==="Bearish")){
        return res.status(400).json({ error:"LONG rejected — Monthly/Weekly bias is Bearish. Never trade against HTF." });
      }
      if(dir==="SHORT"&&(biasM==="Bullish"||biasW==="Bullish")){
        return res.status(400).json({ error:"SHORT rejected — Monthly/Weekly bias is Bullish. Never trade against HTF." });
      }
    }

    const trade = {
      id:          `MANUAL-${asset}-${Date.now()}`,
      asset, dir,
      setup:       setup||"Manual Setup",
      model:       fib&&fib!=="N/A"?`Fib ${fib} + Manual Analysis`:"Manual Structure Analysis",
      fib:         fib||"N/A",
      conf:        9,
      entry:       +entry, sl:+sl, tp:+tp, rr,
      biasM:       biasM||"Bullish",
      biasW:       biasW||"Bullish",
      biasD:       biasD||"Bullish",
      fundamental: "",
      confluence:  [
        "Manually submitted — trader identified setup on chart",
        setup||"Structure pattern confirmed on daily chart",
        fib&&fib!=="N/A"?`Fibonacci ${fib} confluence`:"Key monthly level identified",
        `RR 1:${rr} — meets minimum 1:2 requirement`,
        "AI validated and journaled automatically",
      ],
      execNote:    notes||"Manual trade — trader identified setup independently",
      psyNote:     "Disciplined manual analysis — waited for full HTF confluence before submitting",
      isManual:    true,
      outcome:     "PENDING",
      pnl:         null,
      ts:          new Date().toISOString(),
      aiWriteUp:   "",
      journalNarrative:"",
    };

    journalStore.add(trade);

    Promise.all([
      aiService.getWriteUp(trade),
      aiService.getFundamental(asset, dir),
    ]).then(([writeUp, fundamental])=>{
      if(writeUp)     journalStore.updateWriteUp(trade.id, writeUp);
      if(fundamental) journalStore.updateFundamental(trade.id, fundamental);
      const updated = journalStore.getById(trade.id);
      if(updated) broadcast({ type:"TRADE_UPDATED", trade:updated });
    });

    broadcast({ type:"NEW_SIGNAL", trade });

    res.json({
      success: true,
      message: `✅ ${asset} ${dir} accepted — RR 1:${rr}. AI write-up generating…`,
      trade,
    });

  }catch(err){
    res.status(500).json({ error:err.message });
  }
});

app.patch("/api/trades/:id", (req, res) => {
  const updated = journalStore.updateOutcome(req.params.id, req.body.outcome);
  if(!updated) return res.status(404).json({ error:"Trade not found" });
  broadcast({ type:"TRADE_UPDATED", trade:updated });
  res.json(updated);
});

app.post("/api/trades/:id/writeup", async (req, res) => {
  const trade = journalStore.getById(req.params.id);
  if(!trade) return res.status(404).json({ error:"Trade not found" });
  const writeUp = await aiService.getWriteUp(trade);
  journalStore.updateWriteUp(req.params.id, writeUp);
  broadcast({ type:"TRADE_UPDATED", trade:journalStore.getById(req.params.id) });
  res.json({ writeUp });
});

app.post("/api/trades/:id/journal", async (req, res) => {
  const trade = journalStore.getById(req.params.id);
  if(!trade) return res.status(404).json({ error:"Trade not found" });
  const journalNarrative = await aiService.getJournalNarrative(trade);
  journalStore.updateJournal(req.params.id, journalNarrative);
  broadcast({ type:"TRADE_UPDATED", trade:journalStore.getById(req.params.id) });
  res.json({ journalNarrative });
});

app.get("/api/improve", async (req, res) => {
  const stats  = journalStore.getStats();
  const report = await aiService.getSelfImprovement(stats);
  res.json({ report });
});

// ── Scanner with detailed logging ─────────────
async function runScan(trigger="Auto"){
  lastScanLog  = [];
  lastScanTime = new Date().toISOString();

  const log = (msg) => {
    lastScanLog.push(msg);
    console.log(msg);
  };

  log(`🔍 Swing scan: ${trigger} — ${new Date().toUTCString()}`);
  broadcast({ type:"SCAN_START", ts:new Date().toISOString(), trigger });

  try{
    const prices = await marketData.getAllPrices();
    log(`📡 Prices loaded: ${Object.keys(prices).length} markets`);

    // Pass logger to signal engine
    const signals = await signalEngine.scan(prices, log);

    for(const signal of signals){
      journalStore.add(signal);

      aiService.getWriteUp(signal).then(writeUp=>{
        if(writeUp){
          journalStore.updateWriteUp(signal.id, writeUp);
          broadcast({ type:"TRADE_UPDATED", trade:journalStore.getById(signal.id) });
        }
      });

      broadcast({ type:"NEW_SIGNAL", trade:signal });
      log(`✅ SIGNAL: ${signal.asset} ${signal.dir} | ${signal.setup} | Fib ${signal.fib} | RR 1:${signal.rr}`);
    }

    broadcast({
      type:    "SCAN_COMPLETE",
      ts:      new Date().toISOString(),
      found:   signals.length,
      scanned: Object.keys(prices).length,
    });

    log(`✅ Scan complete. ${signals.length} signal(s) found.`);

  }catch(err){
    log(`❌ Scan error: ${err.message}`);
    broadcast({ type:"SCAN_ERROR", error:err.message });
  }
}

// ── Swing Trading Schedule ─────────────────────
// Daily scan at 22:00 GMT — daily candle close
cron.schedule("0 22 * * *", ()=>runScan("Daily Close"), { timezone:"UTC" });

// Weekly scan Friday 21:55 GMT — weekly candle close
cron.schedule("55 21 * * 5", ()=>runScan("Weekly Close"), { timezone:"UTC" });

// Price update every 5 minutes
cron.schedule("*/5 * * * *", async()=>{
  try{
    const prices = await marketData.getAllPrices();
    broadcast({ type:"PRICES", data:prices });
  }catch(_){}
});

// ── Start ──────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, ()=>{
  console.log(`\n🚀 APEX QUANT — Swing Trading Backend`);
  console.log(`   Port: ${PORT}`);
  console.log(`   Daily scan: 22:00 GMT | Weekly: Friday 21:55 GMT`);
  console.log(`   Markets: 31 assets\n`);
  setTimeout(()=>runScan("Startup"), 8000);
});
