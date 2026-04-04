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

  ws.on("close", () => {
    clients.delete(ws);
    console.log(`Client disconnected. Total: ${clients.size}`);
  });

  ws.on("error", (err) => {
    clients.delete(ws);
    console.error("WS error:", err.message);
  });
});

function broadcast(data) {
  const msg = JSON.stringify(data);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
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
  try {
    res.json(await marketData.getAllPrices());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/scan", async (req, res) => {
  res.json({ message: "Scan started" });
  await runScan();
});

app.patch("/api/trades/:id", (req, res) => {
  const updated = journalStore.updateOutcome(req.params.id, req.body.outcome);
  if (!updated) return res.status(404).json({ error: "Trade not found" });
  broadcast({ type: "TRADE_UPDATED", trade: updated });
  res.json(updated);
});

// AI write-up for a trade
app.post("/api/trades/:id/writeup", async (req, res) => {
  const trade = journalStore.getById(req.params.id);
  if (!trade) return res.status(404).json({ error: "Trade not found" });
  const writeUp = await aiService.getWriteUp(trade);
  journalStore.updateWriteUp(req.params.id, writeUp);
  broadcast({ type: "TRADE_UPDATED", trade: journalStore.getById(req.params.id) });
  res.json({ writeUp });
});

// AI journal narrative for a trade
app.post("/api/trades/:id/journal", async (req, res) => {
  const trade = journalStore.getById(req.params.id);
  if (!trade) return res.status(404).json({ error: "Trade not found" });
  const journalNarrative = await aiService.getJournalNarrative(trade);
  journalStore.updateJournal(req.params.id, journalNarrative);
  broadcast({ type: "TRADE_UPDATED", trade: journalStore.getById(req.params.id) });
  res.json({ journalNarrative });
});

// Self improvement report
app.get("/api/improve", async (req, res) => {
  const stats  = journalStore.getStats();
  const report = await aiService.getSelfImprovement(stats);
  res.json({ report });
});

// ── Scanner ────────────────────────────────────
async function runScan() {
  console.log("Running market scan...");
  broadcast({ type: "SCAN_START", ts: new Date().toISOString() });

  try {
    const prices  = await marketData.getAllPrices();
    const signals = await signalEngine.scan(prices);

    for (const signal of signals) {
      journalStore.add(signal);

      // Auto-generate AI write-up in background
      aiService.getWriteUp(signal).then((writeUp) => {
        if (writeUp) {
          journalStore.updateWriteUp(signal.id, writeUp);
          broadcast({ type: "TRADE_UPDATED", trade: journalStore.getById(signal.id) });
        }
      });

      broadcast({ type: "NEW_SIGNAL", trade: signal });
      console.log(`Signal: ${signal.asset} ${signal.dir} | RR 1:${signal.rr} | Conf ${signal.conf}/10`);
    }

    broadcast({
      type:    "SCAN_COMPLETE",
      ts:      new Date().toISOString(),
      found:   signals.length,
      scanned: Object.keys(prices).length,
    });

    console.log(`Scan done. ${signals.length} signal(s) found.`);
  } catch (err) {
    console.error("Scan error:", err.message);
    broadcast({ type: "SCAN_ERROR", error: err.message });
  }
}

// ── Cron Jobs ──────────────────────────────────
cron.schedule("*/15 * * * *", runScan);

cron.schedule("*/30 * * * * *", async () => {
  try {
    const prices = await marketData.getAllPrices();
    broadcast({ type: "PRICES", data: prices });
  } catch (_) {}
});

// ── Start ──────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`APEX QUANT Backend running on port ${PORT}`);
  setTimeout(runScan, 5000);
});
