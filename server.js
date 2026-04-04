// ═══════════════════════════════════════════════
//  APEX QUANT — Backend Server
//  Express + WebSocket + Auto Signal Scanner
// ═══════════════════════════════════════════════
require("dotenv").config();
const express   = require("express");
const http      = require("http");
const WebSocket = require("ws");
const cors      = require("cors");
const cron      = require("node-cron");

const marketData  = require("./services/marketData");
const signalEngine = require("./services/signalEngine");
const journalStore = require("./services/journalStore");

const app    = express();
const server = http.createServer(app);

// ─── Middleware ────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json());

// ─── WebSocket Server ──────────────────────────
const wss = new WebSocket.Server({ server });
const clients = new Set();

wss.on("connection", (ws) => {
  clients.add(ws);
  console.log(`✅ Client connected. Total: ${clients.size}`);

  // Send current journal on connect
  ws.send(JSON.stringify({
    type: "INIT",
    trades: journalStore.getAll(),
    stats:  journalStore.getStats(),
  }));

  ws.on("close", () => {
    clients.delete(ws);
    console.log(`❌ Client disconnected. Total: ${clients.size}`);
  });

  ws.on("error", (err) => {
    console.error("WS error:", err.message);
    clients.delete(ws);
  });
});

// Broadcast to all connected clients
function broadcast(data) {
  const msg = JSON.stringify(data);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

// ─── REST API Routes ───────────────────────────

// Health check — Railway uses this
app.get("/", (req, res) => {
  res.json({
    status:  "APEX QUANT LIVE",
    clients: clients.size,
    trades:  journalStore.getAll().length,
    uptime:  process.uptime().toFixed(0) + "s",
  });
});

// Get all trades
app.get("/api/trades", (req, res) => {
  res.json(journalStore.getAll());
});

// Get stats
app.get("/api/stats", (req, res) => {
  res.json(journalStore.getStats());
});

// Get live prices
app.get("/api/prices", async (req, res) => {
  try {
    const prices = await marketData.getAllPrices();
    res.json(prices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manually trigger a scan (useful for testing)
app.post("/api/scan", async (req, res) => {
  try {
    res.json({ message: "Scan started" });
    await runScan(); // run after responding
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update trade outcome
app.patch("/api/trades/:id", (req, res) => {
  const { id }     = req.params;
  const { outcome } = req.body;
  const updated    = journalStore.updateOutcome(id, outcome);
  if (!updated) return res.status(404).json({ error: "Trade not found" });
  broadcast({ type: "TRADE_UPDATED", trade: updated });
  res.json(updated);
});

// ─── Signal Scanner ────────────────────────────
async function runScan() {
  console.log("\n🔍 Running autonomous market scan...");
  broadcast({ type: "SCAN_START", ts: new Date().toISOString() });

  try {
    const prices  = await marketData.getAllPrices();
    const signals = await signalEngine.scan(prices);

    for (const signal of signals) {
      journalStore.add(signal);
      broadcast({ type: "NEW_SIGNAL", trade: signal });
      console.log(`⚡ Signal: ${signal.asset} ${signal.dir} | RR 1:${signal.rr} | Conf ${signal.conf}/10`);
    }

    broadcast({
      type:    "SCAN_COMPLETE",
      ts:      new Date().toISOString(),
      found:   signals.length,
      scanned: Object.keys(prices).length,
    });

    console.log(`✅ Scan complete. ${signals.length} signal(s) found.\n`);
  } catch (err) {
    console.error("Scan error:", err.message);
    broadcast({ type: "SCAN_ERROR", error: err.message });
  }
}

// ─── Cron Jobs ─────────────────────────────────

// Full scan every 15 minutes
cron.schedule("*/15 * * * *", runScan);

// Price broadcast every 30 seconds
cron.schedule("*/30 * * * * *", async () => {
  try {
    const prices = await marketData.getAllPrices();
    broadcast({ type: "PRICES", data: prices });
  } catch (err) {
    // silently skip on error
  }
});

// ─── Start ─────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🚀 APEX QUANT Backend running on port ${PORT}`);
  console.log(`📡 WebSocket ready`);
  console.log(`⏰ Scanner runs every 15 minutes\n`);

  // Run first scan after 5 seconds on startup
  setTimeout(runScan, 5000);
});
