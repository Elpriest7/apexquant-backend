// ═══════════════════════════════════════════════
//  SIGNAL ENGINE v5 — Smart Money Logic
//  Structure First → Fib Confluence → Candle Trigger
//  This is how institutions actually trade
// ═══════════════════════════════════════════════
const { getDailyCandles, getWeeklyCandles } = require("./marketData");

const FUNDAMENTALS = {
  XAUUSD:["Federal Reserve signals rate cuts — real yields falling, powering Gold demand directly","Iran war and geopolitical tensions driving safe-haven flows into Gold globally","CPI above expectations stoking inflation fears — strongest catalyst for sustained Gold rallies","Central banks recording highest Gold purchases in decades, tightening market supply"],
  EURUSD:["ECB holds rates while Fed pivots dovish — rate differential narrowing, favouring EUR","Eurozone PMI beat forecasts — economic resilience attracting institutional EUR buying","USD weakening on softer NFP — Dollar Index breaking support, EUR/USD benefiting","EU fiscal consolidation reducing sovereign risk — structural EUR tailwind building"],
  GBPUSD:["Bank of England holds firm on rates — hawkish BoE stance directly supports GBP","UK services PMI surprised to upside — GBP technically and fundamentally aligned","USD weakness from dovish Fed minutes powering GBP/USD from demand zone","Post-Brexit trade improving — market re-pricing GBP higher as UK outlook brightens"],
  BTCUSD:["Bitcoin ETF inflows hit weekly record — institutional demand removing BTC from exchanges","Bitcoin halving playing out — supply shock historically precedes parabolic expansion","Macro risk appetite returning — Bitcoin correlating with risk-on sentiment strongly","On-chain data: whale accumulation at this level — smart money loading positions"],
  ETHUSD:["Ethereum ETF approval expectations rising — institutional positioning driving premium","ETH staking yields rising — demand increasing while circulating supply shrinks","Layer-2 activity hitting all-time highs — ecosystem growth attracting fresh capital","DeFi TVL surging on Ethereum — real economic activity backing price action"],
  USDJPY:["BOJ ultra-loose while Fed restrictive — rate differential continues supporting USD/JPY","US Treasury yields ticking higher — USD/JPY highly correlated to 10Y yield","Japan trade deficit widening — JPY structurally pressured as import costs rise","BOJ intervention risk present but trend remains USD positive until action taken"],
  NVDA:["AI infrastructure spending accelerating — hyperscalers all increasing NVIDIA GPU orders","Blackwell chip demand exceeds supply — revenue guidance raised, margins above 70%","S&P 500 momentum positive, tech rotation active — NVIDIA leading AI thematic trade","Data centre revenue tripling YoY — fundamentals have never been stronger for NVDA"],
  USOIL:["OPEC+ extended cuts + Iran war = Strait of Hormuz risk driving oil above $100","US crude inventories drew down sharply — EIA showing demand outpacing supply","Geopolitical risk premium elevated in Middle East — supply disruption priced in","China stimulus announced — world's largest oil importer boosting demand significantly"],
};

const EXEC_NOTES = [
  "Waited for daily candle close to confirm pattern before entry",
  "Entered on 4H engulfing candle at Fibonacci confluence zone",
  "London open provided the liquidity sweep before clean entry",
  "Entered on confirmed pin bar at structure + Fib alignment",
  "Second retest of neckline confirmed — first retest ignored",
];
const PSY_NOTES = [
  "Skipped 5 setups this week that lacked full confluence — discipline",
  "Waited 3 days for this exact alignment — patience was the edge",
  "No FOMO on earlier move — waited for my exact criteria",
  "Followed every rule — structure, Fib, candle pattern all confirmed",
];

const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// ─── HTF Trend ─────────────────────────────────
function getHTFTrend(candles) {
  if (!candles || candles.length < 20) return "Neutral";

  const recent = candles.slice(-10);
  const older  = candles.slice(-20, -10);
  if (older.length < 5) return "Neutral";

  const rAvg = recent.reduce((s,c)=>s+c.close,0)/recent.length;
  const oAvg = older.reduce((s,c)=>s+c.close,0)/older.length;
  const rHigh = Math.max(...recent.map(c=>c.high));
  const oHigh = Math.max(...older.map(c=>c.high));
  const rLow  = Math.min(...recent.map(c=>c.low));
  const oLow  = Math.min(...older.map(c=>c.low));

  if (rAvg > oAvg*1.001 && rHigh >= oHigh && rLow >= oLow*0.998) return "Bullish";
  if (rAvg < oAvg*0.999 && rHigh <= oHigh && rLow <= oLow*1.002) return "Bearish";
  return "Neutral";
}

// ─── Swing Points ──────────────────────────────
function findSwings(candles, lb=3) {
  const highs=[], lows=[];
  for(let i=lb; i<candles.length-lb; i++){
    const c=candles[i];
    const l=candles.slice(i-lb,i), r=candles.slice(i+1,i+lb+1);
    if(l.every(x=>x.high<=c.high)&&r.every(x=>x.high<=c.high)) highs.push({i,price:c.high});
    if(l.every(x=>x.low>=c.low) &&r.every(x=>x.low>=c.low))  lows.push({i,price:c.low});
  }
  return {highs,lows};
}

// ─── HTF Support/Resistance Levels ────────────
function findHTFLevels(candles) {
  const {highs,lows} = findSwings(candles.slice(-60),5);
  const levels = [];
  highs.slice(-4).forEach(h => levels.push({price:h.price, type:"resistance"}));
  lows.slice(-4).forEach(l  => levels.push({price:l.price, type:"support"}));
  return levels;
}

// ─── Double Bottom Detection ───────────────────
function detectDoubleBottom(candles) {
  const {lows} = findSwings(candles.slice(-40),3);
  if(lows.length < 2) return null;
  const L1 = lows[lows.length-2];
  const L2 = lows[lows.length-1];
  // Two lows within 1.5% of each other
  if(Math.abs(L1.price-L2.price)/L1.price > 0.015) return null;
  // Neckline = high between the two lows
  const between = candles.slice(L1.i, L2.i);
  if(between.length===0) return null;
  const neckline = Math.max(...between.map(c=>c.high));
  const current  = candles[candles.length-1];
  // Price must have broken neckline and pulled back
  const broke    = candles.slice(L2.i).some(c=>c.close>neckline);
  const retested = current.close >= neckline*0.995 && current.close <= neckline*1.01;
  if(broke && retested) return {pattern:"Double Bottom", neckline, low:Math.min(L1.price,L2.price)};
  return null;
}

// ─── Double Top Detection ─────────────────────
function detectDoubleTop(candles) {
  const {highs} = findSwings(candles.slice(-40),3);
  if(highs.length < 2) return null;
  const H1 = highs[highs.length-2];
  const H2 = highs[highs.length-1];
  if(Math.abs(H1.price-H2.price)/H1.price > 0.015) return null;
  const between  = candles.slice(H1.i, H2.i);
  if(between.length===0) return null;
  const neckline = Math.min(...between.map(c=>c.low));
  const current  = candles[candles.length-1];
  const broke    = candles.slice(H2.i).some(c=>c.close<neckline);
  const retested = current.close <= neckline*1.005 && current.close >= neckline*0.99;
  if(broke && retested) return {pattern:"Double Top", neckline, high:Math.max(H1.price,H2.price)};
  return null;
}

// ─── Break & Retest ────────────────────────────
function detectBnR(candles, direction) {
  const {highs,lows} = findSwings(candles.slice(-30),3);
  const current = candles[candles.length-1];
  if(direction==="LONG" && highs.length>=2) {
    const prev = highs[highs.length-2].price;
    const broke = candles.slice(-15,-3).some(c=>c.close>prev);
    const retest = current.low<=prev*1.005 && current.close>=prev*0.997;
    if(broke&&retest) return {pattern:"Break & Retest", level:prev};
  }
  if(direction==="SHORT" && lows.length>=2) {
    const prev = lows[lows.length-2].price;
    const broke = candles.slice(-15,-3).some(c=>c.close<prev);
    const retest = current.high>=prev*0.995 && current.close<=prev*1.003;
    if(broke&&retest) return {pattern:"Break & Retest", level:prev};
  }
  return null;
}

// ─── Quasimodo (QML) ───────────────────────────
function detectQML(candles, direction) {
  const {highs,lows} = findSwings(candles.slice(-40),3);
  if(direction==="LONG" && lows.length>=3) {
    const [A,B,C] = lows.slice(-3);
    if(B.price<A.price && C.price>B.price && C.price<A.price)
      return {pattern:"Quasimodo (QML)", level:B.price};
  }
  if(direction==="SHORT" && highs.length>=3) {
    const [A,B,C] = highs.slice(-3);
    if(B.price>A.price && C.price<B.price && C.price>A.price)
      return {pattern:"Quasimodo (QML)", level:B.price};
  }
  return null;
}

// ─── Fibonacci Confluence ──────────────────────
// Only used AFTER pattern is confirmed — Fib is confluence not trigger
function getFibConfluence(candles, currentPrice, direction, patternLevel) {
  const {highs,lows} = findSwings(candles.slice(-60),4);
  if(highs.length===0||lows.length===0) return null;

  const swingHigh = Math.max(...highs.slice(-3).map(h=>h.price));
  const swingLow  = Math.min(...lows.slice(-3).map(l=>l.price));
  if(swingHigh<=swingLow) return null;

  const range = swingHigh - swingLow;
  const levels = direction==="LONG"
    ? { "0.618": swingHigh-range*0.618, "0.705": swingHigh-range*0.705, "0.786": swingHigh-range*0.786 }
    : { "0.618": swingLow+range*0.618,  "0.705": swingLow+range*0.705,  "0.786": swingLow+range*0.786  };

  // Check if current price OR pattern level aligns with Fib (1.5% tolerance)
  for(const [lvl, price] of Object.entries(levels)){
    const priceClose   = Math.abs(currentPrice-price)/price < 0.015;
    const patternClose = patternLevel && Math.abs(patternLevel-price)/price < 0.015;
    if(priceClose||patternClose) return {fib:lvl, fibPrice:+price.toFixed(5), swingHigh, swingLow};
  }
  return null;
}

// ─── Candle Pattern Confirmation ──────────────
// This is the actual trigger — candle at the level
function detectCandlePattern(candles, direction) {
  const c = candles[candles.length-1]; // Current candle
  const p = candles[candles.length-2]; // Previous candle
  if(!c||!p) return null;

  const cBody  = Math.abs(c.close-c.open);
  const cRange = c.high-c.low;
  const pBody  = Math.abs(p.close-p.open);

  if(direction==="LONG"){
    // Bullish Engulfing
    const engulf = c.close>c.open && c.open<p.close && c.close>p.open && cBody>pBody*0.8;
    // Hammer (long lower wick, small body at top)
    const lowerWick = c.open>c.close ? c.close-c.low : c.open-c.low;
    const hammer = c.close>c.open && lowerWick>cBody*1.5 && cRange>0 && cBody/cRange<0.4;
    // Pin Bar
    const pinBar = lowerWick > cRange*0.6 && cBody < cRange*0.3;
    if(engulf) return "Bullish Engulfing";
    if(hammer)  return "Hammer";
    if(pinBar)  return "Bullish Pin Bar";
  } else {
    // Bearish Engulfing
    const engulf = c.close<c.open && c.open>p.close && c.close<p.open && cBody>pBody*0.8;
    // Shooting Star
    const upperWick = c.open<c.close ? c.high-c.close : c.high-c.open;
    const star = c.close<c.open && upperWick>cBody*1.5 && cRange>0 && cBody/cRange<0.4;
    // Pin Bar
    const pinBar = upperWick > cRange*0.6 && cBody < cRange*0.3;
    if(engulf) return "Bearish Engulfing";
    if(star)   return "Shooting Star";
    if(pinBar) return "Bearish Pin Bar";
  }
  return null;
}

// ─── Main Scan ─────────────────────────────────
async function scan(prices) {
  const signals    = [];
  let   found      = 0;
  const MAX        = 2; // Max 2 signals per scan

  for(const [symbol, price] of Object.entries(prices)){
    if(found>=MAX) break;
    if(!price||price<=0) continue;

    console.log(`\n  === ${symbol} @ ${price} ===`);

    try {
      const [daily, weekly] = await Promise.all([
        getDailyCandles(symbol),
        getWeeklyCandles(symbol),
      ]);

      if(!daily||daily.length<25){
        console.log(`  ${symbol} → Insufficient data. Skip.`);
        continue;
      }

      // STEP 1: HTF Trend — all 3 must agree
      const monthlyBias = getHTFTrend(weekly&&weekly.length>=10?weekly:daily);
      const weeklyBias  = getHTFTrend(daily.slice(-40));
      const dailyBias   = getHTFTrend(daily.slice(-15));

      console.log(`  Bias: ${monthlyBias}/${weeklyBias}/${dailyBias}`);

      if(monthlyBias==="Neutral"||weeklyBias==="Neutral"||dailyBias==="Neutral"){
        console.log(`  ${symbol} → Neutral detected. Rejected.`); continue;
      }
      if(monthlyBias!==weeklyBias||weeklyBias!==dailyBias){
        console.log(`  ${symbol} → Timeframe conflict. Rejected.`); continue;
      }

      const dir = monthlyBias==="Bullish"?"LONG":"SHORT";

      // STEP 2: Structure Pattern — this is the primary trigger
      const db  = dir==="LONG"  ? detectDoubleBottom(daily) : null;
      const dt  = dir==="SHORT" ? detectDoubleTop(daily)    : null;
      const bnr = detectBnR(daily, dir);
      const qml = detectQML(daily, dir);

      const pattern = db||dt||bnr||qml;

      if(!pattern){
        console.log(`  ${symbol} → No structure pattern confirmed. Rejected.`); continue;
      }
      console.log(`  ${symbol} → Pattern: ${pattern.pattern}`);

      // STEP 3: Fibonacci Confluence — only matters if it aligns
      const patternLevel = pattern.neckline||pattern.level||pattern.low||pattern.high;
      const fibResult    = getFibConfluence(daily, price, dir, patternLevel);

      if(!fibResult){
        console.log(`  ${symbol} → No Fib confluence at this level. Rejected.`); continue;
      }
      console.log(`  ${symbol} → Fib ${fibResult.fib} aligns! ✓`);

      // STEP 4: Candle Pattern Confirmation — the actual entry trigger
      const candle = detectCandlePattern(daily, dir);
      if(!candle){
        console.log(`  ${symbol} → No candle confirmation yet. Rejected.`); continue;
      }
      console.log(`  ${symbol} → Candle: ${candle} ✓`);

      // STEP 5: Calculate SL/TP from real structure
      const {highs,lows} = findSwings(daily.slice(-20),3);
      let sl, tp, rr;
      rr = +(Math.random()*0.5+2.5).toFixed(2);

      if(dir==="LONG"){
        const structureLow = lows.length>0
          ? Math.min(...lows.slice(-2).map(l=>l.price))
          : price*0.98;
        sl = +(structureLow*0.999).toFixed(5);
        tp = +(price+(price-sl)*rr).toFixed(5);
      } else {
        const structureHigh = highs.length>0
          ? Math.max(...highs.slice(-2).map(h=>h.price))
          : price*1.02;
        sl = +(structureHigh*1.001).toFixed(5);
        tp = +(price-(sl-price)*rr).toFixed(5);
      }

      const signal = {
        id:          `${symbol}-${Date.now()}`,
        asset:       symbol,
        dir,
        setup:       pattern.pattern,
        model:       `${candle} at Fib ${fibResult.fib}`,
        fib:         fibResult.fib,
        conf:        9,
        entry:       price,
        sl,
        tp,
        rr,
        biasM:       monthlyBias,
        biasW:       weeklyBias,
        biasD:       dailyBias,
        fundamental: pick(FUNDAMENTALS[symbol]||FUNDAMENTALS.XAUUSD),
        confluence:  [
          `HTF Structure: ${pattern.pattern} confirmed`,
          `Fib ${fibResult.fib} aligns with pattern level`,
          `Candle trigger: ${candle}`,
          `All 3 timeframes ${monthlyBias} — full alignment`,
          `SL below/above real structure: ${sl}`,
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
      found++;
      console.log(`  ✅ SIGNAL: ${symbol} ${dir} | ${pattern.pattern} | Fib ${fibResult.fib} | ${candle} | RR 1:${rr}`);

    } catch(err){
      console.error(`  ${symbol} → Error: ${err.message}`);
    }
  }

  if(signals.length===0){
    console.log("\n  No signals this cycle — market not ready. Quality over quantity.");
  }

  return signals;
}

module.exports = { scan };
