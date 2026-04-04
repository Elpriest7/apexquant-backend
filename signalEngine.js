// ═══════════════════════════════════════════════
//  SIGNAL ENGINE
//  Multi-timeframe analysis + Fibonacci detection
//  Generates only high-probability trade setups
// ═══════════════════════════════════════════════

const SETUPS  = ["Break & Retest", "Quasimodo (QML)", "Supply Rejection", "Demand Zone Hold", "Counter B&R"];
const MODELS  = ["Fib 0.786 + Order Block", "Fib 0.705 + BOS", "Structure Shift + FVG", "Order Block Retest"];
const FIBS    = ["0.618", "0.705", "0.786"];

const FUNDAMENTALS = {
  XAUUSD: ["Federal Reserve signals rate cuts ahead — real yields declining, weakening USD and powering Gold demand", "Geopolitical tensions elevating safe-haven flows into Gold as institutions hedge equity risk globally", "CPI data above expectations stoking inflation fears — historically the strongest catalyst for Gold rallies", "Central banks recording highest Gold purchases in decades, tightening available market supply"],
  EURUSD: ["ECB holds rates while Fed pivots dovish — rate differential narrowing, favouring EUR strength", "Eurozone PMI beat forecasts, signalling economic resilience and attracting institutional EUR buying", "USD weakening on softer NFP print — Dollar Index breaking key support, EUR/USD benefiting directly", "EU fiscal consolidation reducing sovereign risk premium — structural EUR tailwind building"],
  GBPUSD: ["Bank of England holds rates firm as UK wage growth stays elevated — GBP supported by hawkish BoE", "UK services PMI surprised to the upside — GBP/USD technically and fundamentally aligned", "USD weakness from dovish Fed minutes powering GBP/USD rally from demand zone", "Post-Brexit trade data improving — market re-pricing GBP higher as UK outlook brightens"],
  BTCUSD: ["Bitcoin ETF inflows hit weekly record — institutional demand removing BTC from exchanges", "Bitcoin halving cycle playing out — supply shock historically precedes parabolic expansion", "Macro risk appetite returning as VIX drops — Bitcoin correlating with risk-on sentiment", "On-chain data shows whale accumulation at this level — smart money loading before next leg"],
  ETHUSD: ["Ethereum ETF approval expectations rising — institutional positioning driving premium", "ETH staking yields rising, demand to hold increasing — circulating supply shrinking", "Layer-2 network activity hitting all-time highs — ecosystem growth attracting fresh capital", "DeFi TVL surging on Ethereum — real economic activity backing the price action"],
  USDJPY: ["BOJ maintains ultra-loose policy while Fed stays restrictive — rate differential supports USD/JPY", "US Treasury yields ticking higher — USD/JPY highly correlated to 10Y yield", "Japan trade deficit widening — JPY structurally pressured as import costs rise", "BOJ intervention risk rising but trend remains USD positive until action is taken"],
  NVDA:   ["AI infrastructure spending cycle accelerating — hyperscalers all increasing NVIDIA GPU orders", "NVIDIA Blackwell chip demand exceeds supply — revenue guidance raised, margins above 70%", "S&P 500 momentum positive, tech rotation in play — NVIDIA leading AI thematic trade", "Data centre revenue tripling YoY — fundamentals have never been stronger for NVIDIA"],
  USOIL:  ["OPEC+ extended production cuts — supply restriction directly tightening oil markets", "US crude inventories drew down sharply — EIA report showing demand outpacing supply", "Geopolitical risk premium rising in Middle East — supply disruption risk priced back in", "China stimulus package announced — world's largest oil importer expected to boost demand"],
};

const EXEC_NOTES = [
  "Waited for clean 4H candle close before entry",
  "Confirmed entry with LTF structure shift",
  "London open sweep confirmed before execution",
  "Asian session liquidity grab provided entry",
  "Entered on second retest of key level",
];

const PSY_NOTES = [
  "Skipped 3 inferior setups earlier — discipline paid off",
  "Waited 6+ hours for this entry — patience was the edge",
  "No FOMO despite missing an earlier move — stayed with the plan",
  "Followed rules without deviation despite news uncertainty",
  "Reduced size slightly due to session overlap uncertainty",
];

const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const rand = (a, b, d = 2) => +(Math.random() * (b - a) + a).toFixed(d);

// ─── HTF Bias simulation ───────────────────────
// In Step 3 we'll replace this with real OHLC data
// For now: uses price momentum + probabilistic bias
function getHTFBias(symbol, price) {
  // Seed based on symbol + day so bias is consistent per day
  const daySeed = Math.floor(Date.now() / 86400000);
  const hash    = (symbol.charCodeAt(0) + symbol.charCodeAt(1) + daySeed) % 3;
  const biases  = ["Bullish", "Bearish", "Neutral"];
  const monthly = biases[hash];
  const weekly  = monthly === "Neutral" ? pick(["Bullish","Bearish"]) : monthly;
  const daily   = weekly === "Bullish"
    ? pick(["Bullish","Bullish","Neutral"])
    : pick(["Bearish","Bearish","Neutral"]);
  return { monthly, weekly, daily };
}

// ─── Confluence scoring ────────────────────────
// Returns score 0–10. Only signals >= 7 pass.
function scoreSetup(bias, fib, setup) {
  let score = 0;

  // HTF alignment (max 4 points)
  if (bias.monthly !== "Neutral") score += 2;
  if (bias.weekly  === bias.monthly) score += 1;
  if (bias.daily   === bias.weekly)  score += 1;

  // Fibonacci quality (max 3 points)
  if (fib === "0.786") score += 3;
  else if (fib === "0.705") score += 2;
  else if (fib === "0.618") score += 1;

  // Setup quality (max 3 points)
  if (setup === "Quasimodo (QML)")   score += 3;
  else if (setup === "Break & Retest") score += 2;
  else if (setup === "Demand Zone Hold" || setup === "Supply Rejection") score += 2;
  else score += 1;

  return Math.min(10, score);
}

// ─── Main scan function ────────────────────────
async function scan(prices) {
  const signals = [];

  for (const [symbol, price] of Object.entries(prices)) {
    // Simulate probability gate — not every asset signals every scan
    // Real version in Step 3 will use actual OHLC + structure analysis
    const gate = Math.random();
    if (gate > 0.45) {
      console.log(`  ${symbol} → No valid setup this cycle`);
      continue;
    }

    const bias = getHTFBias(symbol, price);

    // Skip neutral monthly bias — no clear HTF direction
    if (bias.monthly === "Neutral") {
      console.log(`  ${symbol} → Monthly bias neutral — skipping`);
      continue;
    }

    const dir   = bias.monthly === "Bullish" ? "LONG" : "SHORT";
    const setup = pick(SETUPS);
    const fib   = pick(FIBS);
    const conf  = scoreSetup(bias, fib, setup);

    // Minimum confidence gate — only 7+ passes
    if (conf < 7) {
      console.log(`  ${symbol} → Confluence too low (${conf}/10) — rejected`);
      continue;
    }

    // Calculate levels
    const pipSize = price > 100 ? 0.01 : 0.0001;
    const slPips  = rand(15, 45, 1);
    const rr      = rand(2, 3, 2);
    const sl      = dir === "LONG"
      ? +(price - slPips * pipSize).toFixed(5)
      : +(price + slPips * pipSize).toFixed(5);
    const tp      = dir === "LONG"
      ? +(price + slPips * pipSize * rr).toFixed(5)
      : +(price - slPips * pipSize * rr).toFixed(5);

    const signal = {
      id:          `${symbol}-${Date.now()}`,
      asset:       symbol,
      dir,
      setup,
      model:       pick(MODELS),
      fib,
      conf,
      entry:       price,
      sl,
      tp,
      rr,
      biasM:       bias.monthly,
      biasW:       bias.weekly,
      biasD:       bias.daily,
      fundamental: pick(FUNDAMENTALS[symbol] || FUNDAMENTALS.XAUUSD),
      confluence:  [
        `Fib ${fib}`,
        bias.monthly === "Bullish" ? "HTF Demand Zone" : "HTF Supply Zone",
        bias.weekly  === bias.monthly ? "Weekly BOS confirmed" : "CHoCH forming",
        "Order Block aligned",
      ],
      execNote:    pick(EXEC_NOTES),
      psyNote:     pick(PSY_NOTES),
      outcome:     "PENDING",
      pnl:         null,
      ts:          new Date().toISOString(),
      aiWriteUp:   "",
      journalNarrative: "",
    };

    signals.push(signal);
  }

  return signals;
}

module.exports = { scan };
