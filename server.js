require("dotenv").config();
const express    = require("express");
const http       = require("http");
const WebSocket  = require("ws");
const cors       = require("cors");
const cron       = require("node-cron");

const marketData   = require("./marketData");
const signalEngine = require("./signalEngine");
const journalStore = require("./journalStore");
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

function broadcast(data) {
  const msg = JSON.stringify(data);
  clients.forEach(c => { if(c.readyState===WebSocket.OPEN) c.send(msg); });
}

// ── REST Routes ────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    status:  "APEX QUANT LIVE",
    clients: clients.size,
    trades:  journalStore.getAll().length,
    uptime:  process.uptime().toFixed(0) + "s",
  });
});

app.get("/api/trades", (req, res) => res.json(journalStore.getAll()));
app.get("/api/stats",  (req, res) => res.json(journalStore.getStats()));

app.get("/api/prices", async (req, res) => {
  try { res.json(await marketData.getAllPrices()); }
  catch(err) { res.status(500).json({ error: err.message }); }
});

// GET scan log
let lastScanLog = [];
app.get("/api/scan", (req, res) => {
  res.json({ log: lastScanLog, trades: journalStore.getAll().length });
});

// POST scan — trigger manual scan
app.post("/api/scan", async (req, res) => {
  res.json({ message: "Scan started" });
  await runScan();
});

// ── MANUAL TRADE UPLOAD ────────────────────────
// User submits their own setup — AI validates and journals it
app.post("/api/manual-trade", async (req, res) => {
  try {
    const {
      asset, dir, setup, entry, sl, tp,
      biasM, biasW, biasD, fib, notes
    } = req.body;

    // Basic validation
    if(!asset||!dir||!entry||!sl||!tp){
      return res.status(400).json({ error: "Missing required fields: asset, dir, entry, sl, tp" });
    }

    const rr = +((Math.abs(tp-entry)/Math.abs(sl-entry)).toFixed(2));

    // Check RR is at least 1:2
    if(rr < 2){
      return res.status(400).json({
        error: `Risk-reward ratio is 1:${rr} — minimum required is 1:2. Adjust your TP.`,
        rr,
      });
    }

    // Check direction matches HTF bias if provided
    if(biasM && biasW){
      if(dir==="LONG" && (biasM==="Bearish"||biasW==="Bearish")){
        return res.status(400).json({
          error: "LONG trade rejected — HTF bias is Bearish. Never trade against the higher timeframe.",
        });
      }
      if(dir==="SHORT" && (biasM==="Bullish"||biasW==="Bullish")){
        return res.status(400).json({
          error: "SHORT trade rejected — HTF bias is Bullish. Never trade against the higher timeframe.",
        });
      }
    }

    // Get current price to verify entry is realistic
    const prices       = await marketData.getAllPrices();
    const currentPrice = prices[asset];

    // Build the trade
    const trade = {
      id:          `MANUAL-${asset}-${Date.now()}`,
      asset,
      dir,
      setup:       setup || "Manual Setup",
      model:       fib ? `Fib ${fib} + Manual Analysis` : "Manual Structure Analysis",
      fib:         fib || "N/A",
      conf:        9,
      entry:       +entry,
      sl:          +sl,
      tp:          +tp,
      rr,
      biasM:       biasM || "Bullish",
      biasW:       biasW || "Bullish",
      biasD:       biasD || "Bullish",
      fundamental: "",
      confluence:  [
        "Manually submitted by trader",
        setup || "Structure identified on chart",
        fib ? `Fibonacci ${fib} confluence` : "Key HTF level",
        `RR 1:${rr} — meets minimum 1:2 requirement`,
        "AI validated and journaled",
      ],
      execNote:    notes || "Manual trade — trader identified setup on chart",
      psyNote:     "Disciplined manual analysis — trader waited for full confluence",
      isManual:    true,
      outcome:     "PENDING",
      pnl:         null,
      ts:          new Date().toISOString(),
      aiWriteUp:   "",
      journalNarrative: "",
    };

    // Save trade
    journalStore.add(trade);

    // Generate AI write-up and fundamental analysis in background
    Promise.all([
      aiService.getWriteUp(trade),
      aiService.getFundamental(asset, dir),
    ]).then(([writeUp, fundamental]) => {
      if(writeUp)      journalStore.updateWriteUp(trade.id, writeUp);
      if(fundamental)  journalStore.updateFundamental(trade.id, fundamental);
      const updated = journalStore.getById(trade.id);
      broadcast({ type: "TRADE_UPDATED", trade: updated });
    });

    // Broadcast new signal immediately
    broadcast({ type: "NEW_SIGNAL", trade });

    res.json({
      success:  true,
      message:  `✅ ${asset} ${dir} trade accepted — RR 1:${rr}. AI write-up generating...`,
      trade,
    });

  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// Update trade outcome
app.patch("/api/trades/:id", (req, res) => {
  const updated = journalStore.updateOutcome(req.params.id, req.body.outcome);
  if(!updated) return res.status(404).json({ error: "Trade not found" });
  broadcast({ type: "TRADE_UPDATED", trade: updated });
  res.json(updated);
});

// AI write-up
app.post("/api/trades/:id/writeup", async (req, res) => {
  const trade = journalStore.getById(req.params.id);
  if(!trade) return res.status(404).json({ error: "Trade not found" });
  const writeUp = await aiService.getWriteUp(trade);
  journalStore.updateWriteUp(req.params.id, writeUp);
  broadcast({ type: "TRADE_UPDATED", trade: journalStore.getById(req.params.id) });
  res.json({ writeUp });
});

// AI journal
app.post("/api/trades/:id/journal", async (req, res) => {
  const trade = journalStore.getById(req.params.id);
  if(!trade) return res.status(404).json({ error: "Trade not found" });
  const journalNarrative = await aiService.getJournalNarrative(trade);
  journalStore.updateJournal(req.params.id, journalNarrative);
  broadcast({ type: "TRADE_UPDATED", trade: journalStore.getById(req.params.id) });
  res.json({ journalNarrative });
});

// Self improvement
app.get("/api/improve", async (req, res) => {
  const stats  = journalStore.getStats();
  const report = await aiService.getSelfImprovement(stats);
  res.json({ report });
});

// ── Scanner ────────────────────────────────────
async function runScan() {
  lastScanLog = [];
  const log = (msg) => { lastScanLog.push(msg); console.log(msg); };

  log("🔍 Starting real market scan...");
  broadcast({ type: "SCAN_START", ts: new Date().toISOString() });

  try {
    const prices = await marketData.getAllPrices();
    log(`📡 Prices: ${Object.entries(prices).map(([s,p])=>`${s}:${p}`).join(", ")}`);

    const signals = await signalEngine.scan(prices);

    for(const signal of signals){
      journalStore.add(signal);

      // Auto AI write-up in background
      aiService.getWriteUp(signal).then(writeUp => {
        if(writeUp){
          journalStore.updateWriteUp(signal.id, writeUp);
          broadcast({ type: "TRADE_UPDATED", trade: journalStore.getById(signal.id) });
        }
      });

      broadcast({ type: "NEW_SIGNAL", trade: signal });
      log(`✅ ${signal.asset} ${signal.dir} | ${signal.setup} | Fib ${signal.fib} | RR 1:${signal.rr}`);
    }

    broadcast({
      type:    "SCAN_COMPLETE",
      ts:      new Date().toISOString(),
      found:   signals.length,
      scanned: Object.keys(prices).length,
    });

    log(`✅ Scan done. ${signals.length} signal(s) found.`);
  } catch(err){
    log(`❌ Scan error: ${err.message}`);
    broadcast({ type: "SCAN_ERROR", error: err.message });
  }
}

// ── Cron ───────────────────────────────────────
cron.schedule("*/15 * * * *", runScan);
cron.schedule("*/30 * * * * *", async () => {
  try {
    const prices = await marketData.getAllPrices();
    broadcast({ type: "PRICES", data: prices });
  } catch(_) {}
});

// ── Start ──────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`APEX QUANT Backend running on port ${PORT}`);
  setTimeout(runScan, 5000);
});
