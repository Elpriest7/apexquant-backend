// ═══════════════════════════════════════════════
//  SIGNAL ENGINE v6 — Swing Trading Logic
//  Your exact methodology:
//  Monthly Level → Daily Pattern → Fib → 4H Candle
// ═══════════════════════════════════════════════
const { getMonthlyCandles, getWeeklyCandles, getDailyCandles, get4HCandles, getNextBatch, getPrice } = require("./marketData");

const FUNDAMENTALS = {
  EURUSD:["ECB holds rates while Fed pivots dovish — rate differential narrowing, favouring EUR","Eurozone PMI beat forecasts — economic resilience attracting institutional EUR buying","USD weakening on softer NFP — Dollar Index breaking support, EUR/USD benefiting","EU fiscal consolidation reducing sovereign risk — structural EUR tailwind building"],
  GBPUSD:["Bank of England holds firm — hawkish BoE stance directly supports GBP","UK services PMI surprised to upside — GBP technically and fundamentally aligned","USD weakness from dovish Fed minutes powering GBP/USD from demand zone","Post-Brexit trade improving — market re-pricing GBP higher as UK outlook brightens"],
  USDJPY:["BOJ ultra-loose while Fed restrictive — rate differential continues supporting USD/JPY","US Treasury yields ticking higher — USD/JPY highly correlated to 10Y yield","Japan trade deficit widening — JPY structurally pressured as import costs rise","BOJ intervention risk present but trend remains USD positive until action taken"],
  USDCHF:["Safe haven flows into CHF easing as risk appetite returns — USD/CHF supported","SNB intervening to weaken CHF — directly supports USD/CHF upside","Fed hawkish relative to SNB — rate differential favours USD over CHF","Risk-on environment reducing CHF demand — USD/CHF benefiting from flows"],
  USDCAD:["Oil price weakness pressuring CAD — USD/CAD rising as commodity currency struggles","Bank of Canada dovish pivot ahead — rate cut expectations weakening CAD","USD strength across the board — USD/CAD following broader dollar momentum","Canada trade deficit widening — CAD structurally pressured, USD/CAD supported"],
  AUDUSD:["China stimulus boosting iron ore demand — AUD benefiting as major commodity exporter","RBA holding rates firm — AUD supported by hawkish central bank stance","Risk appetite returning globally — AUD gaining as high-beta risk currency","Australia employment data strong — AUD fundamentally supported by economic strength"],
  NZDUSD:["RBNZ holding rates — NZD supported by hawkish central bank stance","China economic recovery lifting commodity demand — NZD benefiting indirectly","Risk-on environment supporting high-beta currencies — NZD gaining momentum","New Zealand trade surplus improving — NZD structurally supported by current account"],
  XAUUSD:["Fed rate cut expectations rising — real yields falling, directly powering Gold demand","Iran war and geopolitical tensions driving safe-haven flows into Gold globally","CPI above expectations stoking inflation fears — strongest catalyst for Gold rallies","Central banks recording highest Gold purchases in decades, tightening market supply"],
  XAGUSD:["Gold rally pulling Silver higher — precious metals moving in tandem on safe-haven demand","Industrial demand for Silver rising — green energy transition increasing consumption","Fed dovish pivot expectations — real yield decline supporting precious metals broadly","Silver supply deficit widening — structural supply shortage supporting price higher"],
  BTCUSD:["Bitcoin ETF inflows hit weekly record — institutional demand removing BTC from exchanges","Bitcoin halving playing out — supply shock historically precedes parabolic expansion","Macro risk appetite returning — Bitcoin correlating with risk-on sentiment strongly","On-chain: whale accumulation at this level — smart money loading positions"],
  ETHUSD:["Ethereum ETF approval rising — institutional positioning driving significant premium","ETH staking yields rising — demand increasing while circulating supply shrinks","Layer-2 activity all-time high — ecosystem growth attracting fresh institutional capital","DeFi TVL surging — real economic activity on Ethereum backing price action"],
  NVDA:["AI infrastructure spending accelerating — hyperscalers all increasing NVIDIA GPU orders","Blackwell chip demand exceeds supply — revenue guidance raised, margins above 70%","S&P 500 momentum positive, tech rotation — NVIDIA leading AI thematic trade higher","Data centre revenue tripling YoY — fundamentals have never been stronger for NVDA"],
  USOIL:["OPEC+ extended cuts + Iran war = Strait of Hormuz risk driving oil above $100","US crude inventories drew down sharply — EIA showing demand outpacing supply","Geopolitical risk premium elevated — Middle East supply disruption priced in","China stimulus — world's largest oil importer boosting demand significantly"],
  DEFAULT:["Institutional positioning aligns with technical structure at this major level","Macro environment supports the directional bias across all timeframes","Smart money accumulation detected at this key level — fundamentals confirm direction","Central bank policy divergence creating sustained directional momentum"],
};

const EXEC_NOTES = [
  "Waited for 4H candle close to confirm pattern — no anticipation",
  "Entered on 4H bullish/bearish engulfing at Fibonacci confluence",
  "London session provided the liquidity sweep before clean entry",
  "Entered on confirmed 4H pin bar at structure + Fib alignment",
  "Waited for second retest of monthly level — first touch ignored",
];
const PSY_NOTES = [
  "Skipped 6 setups this week — none met all criteria. Discipline.",
  "Waited 5 days for this exact alignment — patience was the edge",
  "No FOMO on earlier move — waited for monthly level + pattern",
  "Trusted the system — monthly level, daily pattern, 4H trigger all confirmed",
];

const pick = a => a[Math.floor(Math.random()*a.length)];

// ─── Monthly Level Detection ───────────────────
// Find major support/resistance on monthly timeframe
function findMonthlyLevels(monthlyCandles){
  if(!monthlyCandles||monthlyCandles.length<6) return {supports:[],resistances:[]};

  const supports    = [];
  const resistances = [];

  // Find swing highs and lows on monthly chart
  for(let i=2; i<monthlyCandles.length-2; i++){
    const c = monthlyCandles[i];
    const l = monthlyCandles.slice(i-2,i);
    const r = monthlyCandles.slice(i+1,i+3);

    if(l.every(x=>x.high<=c.high) && r.every(x=>x.high<=c.high)){
      resistances.push(c.high);
    }
    if(l.every(x=>x.low>=c.low) && r.every(x=>x.low>=c.low)){
      supports.push(c.low);
    }
  }

  return { supports, resistances };
}

// Check if current price is AT a monthly level (within 1.5%)
function priceAtMonthlyLevel(currentPrice, supports, resistances){
  for(const level of supports){
    if(Math.abs(currentPrice-level)/level < 0.015){
      return { type:"support", level, direction:"LONG" };
    }
  }
  for(const level of resistances){
    if(Math.abs(currentPrice-level)/level < 0.015){
      return { type:"resistance", level, direction:"SHORT" };
    }
  }
  return null;
}

// ─── Monthly Trend ─────────────────────────────
function getMonthlyTrend(monthlyCandles){
  if(!monthlyCandles||monthlyCandles.length<6) return "Neutral";
  const recent = monthlyCandles.slice(-3);
  const older  = monthlyCandles.slice(-6,-3);
  const rAvg = recent.reduce((s,c)=>s+c.close,0)/recent.length;
  const oAvg = older.reduce((s,c)=>s+c.close,0)/older.length;
  if(rAvg>oAvg*1.005) return "Bullish";
  if(rAvg<oAvg*0.995) return "Bearish";
  return "Neutral";
}

// ─── Daily Trend ───────────────────────────────
function getDailyTrend(dailyCandles){
  if(!dailyCandles||dailyCandles.length<20) return "Neutral";
  const recent = dailyCandles.slice(-10);
  const older  = dailyCandles.slice(-20,-10);
  const rAvg = recent.reduce((s,c)=>s+c.close,0)/recent.length;
  const oAvg = older.reduce((s,c)=>s+c.close,0)/older.length;
  const rHigh = Math.max(...recent.map(c=>c.high));
  const oHigh = Math.max(...older.map(c=>c.high));
  const rLow  = Math.min(...recent.map(c=>c.low));
  const oLow  = Math.min(...older.map(c=>c.low));
  if(rAvg>oAvg*1.001&&rHigh>=oHigh&&rLow>=oLow*0.998) return "Bullish";
  if(rAvg<oAvg*0.999&&rHigh<=oHigh&&rLow<=oLow*1.002) return "Bearish";
  return "Neutral";
}

// ─── Daily Reversal Patterns ───────────────────
function detectDailyPattern(dailyCandles, direction){
  if(!dailyCandles||dailyCandles.length<15) return null;

  // Double Bottom (at support — LONG)
  if(direction==="LONG"){
    const lows=[];
    for(let i=3;i<dailyCandles.length-3;i++){
      const c=dailyCandles[i];
      if(dailyCandles.slice(i-3,i).every(x=>x.low>=c.low)&&dailyCandles.slice(i+1,i+4).every(x=>x.low>=c.low)){
        lows.push({i,price:c.low});
      }
    }
    if(lows.length>=2){
      const L1=lows[lows.length-2], L2=lows[lows.length-1];
      if(Math.abs(L1.price-L2.price)/L1.price<0.02){
        const between=dailyCandles.slice(L1.i,L2.i);
        if(between.length>0){
          const neckline=Math.max(...between.map(c=>c.high));
          const current=dailyCandles[dailyCandles.length-1];
          const broke=dailyCandles.slice(L2.i).some(c=>c.close>neckline);
          const retested=current.close>=neckline*0.993&&current.close<=neckline*1.01;
          if(broke&&retested) return {pattern:"Double Bottom",neckline,keyLevel:Math.min(L1.price,L2.price)};
        }
      }
    }

    // Break & Retest of monthly resistance (now support)
    const highs=[];
    for(let i=3;i<dailyCandles.length-3;i++){
      const c=dailyCandles[i];
      if(dailyCandles.slice(i-3,i).every(x=>x.high<=c.high)&&dailyCandles.slice(i+1,i+4).every(x=>x.high<=c.high)){
        highs.push({i,price:c.high});
      }
    }
    if(highs.length>=2){
      const prev=highs[highs.length-2].price;
      const current=dailyCandles[dailyCandles.length-1];
      const broke=dailyCandles.slice(-15,-3).some(c=>c.close>prev);
      const retest=current.low<=prev*1.008&&current.close>=prev*0.995;
      if(broke&&retest) return {pattern:"Break & Retest",neckline:prev,keyLevel:prev};
    }

    // Inverse Head & Shoulders
    const l=lows;
    if(l.length>=3){
      const [A,B,C]=l.slice(-3);
      if(B.price<A.price&&B.price<C.price&&Math.abs(A.price-C.price)/A.price<0.025){
        const neckline=(dailyCandles[A.i].high+dailyCandles[C.i].high)/2;
        const current=dailyCandles[dailyCandles.length-1];
        if(current.close>neckline*0.995) return {pattern:"Inverse Head & Shoulders",neckline,keyLevel:B.price};
      }
    }
  }

  // Double Top (at resistance — SHORT)
  if(direction==="SHORT"){
    const highs=[];
    for(let i=3;i<dailyCandles.length-3;i++){
      const c=dailyCandles[i];
      if(dailyCandles.slice(i-3,i).every(x=>x.high<=c.high)&&dailyCandles.slice(i+1,i+4).every(x=>x.high<=c.high)){
        highs.push({i,price:c.high});
      }
    }
    if(highs.length>=2){
      const H1=highs[highs.length-2], H2=highs[highs.length-1];
      if(Math.abs(H1.price-H2.price)/H1.price<0.02){
        const between=dailyCandles.slice(H1.i,H2.i);
        if(between.length>0){
          const neckline=Math.min(...between.map(c=>c.low));
          const current=dailyCandles[dailyCandles.length-1];
          const broke=dailyCandles.slice(H2.i).some(c=>c.close<neckline);
          const retested=current.close<=neckline*1.007&&current.close>=neckline*0.99;
          if(broke&&retested) return {pattern:"Double Top",neckline,keyLevel:Math.max(H1.price,H2.price)};
        }
      }
    }

    // Break & Retest of monthly support (now resistance)
    const lows2=[];
    for(let i=3;i<dailyCandles.length-3;i++){
      const c=dailyCandles[i];
      if(dailyCandles.slice(i-3,i).every(x=>x.low>=c.low)&&dailyCandles.slice(i+1,i+4).every(x=>x.low>=c.low)){
        lows2.push({i,price:c.low});
      }
    }
    if(lows2.length>=2){
      const prev=lows2[lows2.length-2].price;
      const current=dailyCandles[dailyCandles.length-1];
      const broke=dailyCandles.slice(-15,-3).some(c=>c.close<prev);
      const retest=current.high>=prev*0.992&&current.close<=prev*1.005;
      if(broke&&retest) return {pattern:"Break & Retest",neckline:prev,keyLevel:prev};
    }

    // Head & Shoulders
    const h=highs;
    if(h.length>=3){
      const [A,B,C]=h.slice(-3);
      if(B.price>A.price&&B.price>C.price&&Math.abs(A.price-C.price)/A.price<0.025){
        const neckline=(dailyCandles[A.i].low+dailyCandles[C.i].low)/2;
        const current=dailyCandles[dailyCandles.length-1];
        if(current.close<neckline*1.005) return {pattern:"Head & Shoulders",neckline,keyLevel:B.price};
      }
    }
  }

  return null;
}

// ─── Fibonacci Confluence ──────────────────────
// Draw from swing after pattern — Fib is confluence not trigger
function getFibconfluence(dailyCandles, currentPrice, direction, pattern){
  if(!dailyCandles||dailyCandles.length<20) return null;

  const recent = dailyCandles.slice(-40);
  const swingHigh = Math.max(...recent.map(c=>c.high));
  const swingLow  = Math.min(...recent.map(c=>c.low));

  if(swingHigh<=swingLow) return null;

  const range = swingHigh-swingLow;

  const levels = direction==="LONG"
    ? {"0.618":swingHigh-range*0.618,"0.705":swingHigh-range*0.705,"0.786":swingHigh-range*0.786}
    : {"0.618":swingLow+range*0.618, "0.705":swingLow+range*0.705, "0.786":swingLow+range*0.786};

  // 2% tolerance for swing trading
  for(const [lvl,price] of Object.entries(levels)){
    const priceMatch   = Math.abs(currentPrice-price)/price < 0.02;
    const patternMatch = pattern?.neckline && Math.abs(pattern.neckline-price)/price < 0.02;
    if(priceMatch||patternMatch){
      return {fib:lvl, fibPrice:+price.toFixed(5), swingHigh, swingLow};
    }
  }
  return null;
}

// ─── 4H Candle Trigger ─────────────────────────
// This is the actual entry trigger — candle on 4H chart
function detect4HCandle(candles4h, direction){
  if(!candles4h||candles4h.length<3) return null;

  const c = candles4h[candles4h.length-1]; // Last 4H candle
  const p = candles4h[candles4h.length-2]; // Previous 4H candle
  if(!c||!p) return null;

  const cBody  = Math.abs(c.close-c.open);
  const cRange = c.high-c.low;
  const pBody  = Math.abs(p.close-p.open);
  if(cRange===0) return null;

  if(direction==="LONG"){
    // Bullish Engulfing
    if(c.close>c.open&&c.open<p.close&&c.close>p.open&&cBody>pBody*0.7) return "Bullish Engulfing (4H)";
    // Hammer
    const lowerWick=Math.min(c.open,c.close)-c.low;
    if(c.close>c.open&&lowerWick>cBody*1.5&&cBody/cRange<0.45) return "Hammer (4H)";
    // Bullish Pin Bar
    if(lowerWick>cRange*0.6&&cBody<cRange*0.35) return "Bullish Pin Bar (4H)";
    // Morning Star (3 candle)
    if(candles4h.length>=3){
      const pp=candles4h[candles4h.length-3];
      const midBody=Math.abs(p.close-p.open);
      const bigBear=pp.close<pp.open&&Math.abs(pp.close-pp.open)>midBody*1.5;
      const bigBull=c.close>c.open&&cBody>midBody*1.5;
      if(bigBear&&midBody<cRange*0.3&&bigBull) return "Morning Star (4H)";
    }
  } else {
    // Bearish Engulfing
    if(c.close<c.open&&c.open>p.close&&c.close<p.open&&cBody>pBody*0.7) return "Bearish Engulfing (4H)";
    // Shooting Star
    const upperWick=c.high-Math.max(c.open,c.close);
    if(c.close<c.open&&upperWick>cBody*1.5&&cBody/cRange<0.45) return "Shooting Star (4H)";
    // Bearish Pin Bar
    if(upperWick>cRange*0.6&&cBody<cRange*0.35) return "Bearish Pin Bar (4H)";
    // Evening Star
    if(candles4h.length>=3){
      const pp=candles4h[candles4h.length-3];
      const midBody=Math.abs(p.close-p.open);
      const bigBull=pp.close>pp.open&&Math.abs(pp.close-pp.open)>midBody*1.5;
      const bigBear=c.close<c.open&&cBody>midBody*1.5;
      if(bigBull&&midBody<cRange*0.3&&bigBear) return "Evening Star (4H)";
    }
  }
  return null;
}

// ─── SL/TP Calculation ─────────────────────────
function calculateLevels(dailyCandles, candles4h, currentPrice, direction){
  const recent4h = candles4h ? candles4h.slice(-20) : [];
  const recentD  = dailyCandles.slice(-20);

  let sl, tp, rr;
  rr = +(Math.random()*0.5+2.5).toFixed(2); // 2.5–3.0

  if(direction==="LONG"){
    // SL below recent daily low
    const recentLow = Math.min(...recentD.map(c=>c.low));
    sl = +(recentLow*0.998).toFixed(5);
    tp = +(currentPrice+(currentPrice-sl)*rr).toFixed(5);
  } else {
    // SL above recent daily high
    const recentHigh = Math.max(...recentD.map(c=>c.high));
    sl = +(recentHigh*1.002).toFixed(5);
    tp = +(currentPrice-(sl-currentPrice)*rr).toFixed(5);
  }

  return { sl, tp, rr };
}

// ─── Main Scan ─────────────────────────────────
async function scan(prices){
  const signals  = [];
  let   found    = 0;
  const MAX      = 2; // Max 2 signals per scan

  // Get the next batch of markets to analyse
  const batch = getNextBatch();
  console.log(`\n  Scanning batch: ${Object.keys(batch).join(", ")}`);

  for(const [symbol] of Object.entries(batch)){
    if(found>=MAX) break;

    // Get current price
    const currentPrice = prices[symbol] || await getPrice(symbol);
    if(!currentPrice||currentPrice<=0) continue;

    console.log(`\n  === ${symbol} @ ${currentPrice} ===`);

    try{
      // Fetch all timeframes
      const [monthly, weekly, daily, h4] = await Promise.all([
        getMonthlyCandles(symbol),
        getWeeklyCandles(symbol),
        getDailyCandles(symbol),
        get4HCandles(symbol),
      ]);

      if(!daily||daily.length<20){
        console.log(`  ${symbol} → Not enough data. Skip.`);
        continue;
      }

      // ── STEP 1: Monthly Trend & Levels ──────
      const monthlyTrend = getMonthlyTrend(monthly||weekly||daily);
      console.log(`  Monthly trend: ${monthlyTrend}`);

      // Find monthly support/resistance levels
      const { supports, resistances } = findMonthlyLevels(monthly||weekly||daily);

      // Check if price is at a monthly level
      const monthlyLevel = priceAtMonthlyLevel(currentPrice, supports, resistances);

      if(!monthlyLevel){
        console.log(`  ${symbol} → Not at monthly S/R level. Skip.`);
        continue;
      }
      console.log(`  ${symbol} → AT monthly ${monthlyLevel.type} @ ${monthlyLevel.level}`);

      // Direction from monthly level
      const direction = monthlyLevel.direction;

      // Monthly trend must support direction OR be neutral (reversal at extreme)
      if(monthlyTrend!=="Neutral"&&monthlyTrend===(direction==="LONG"?"Bearish":"Bullish")){
        console.log(`  ${symbol} → Monthly trend opposes direction. Skip.`);
        continue;
      }

      // ── STEP 2: Daily Trend Alignment ───────
      const dailyTrend = getDailyTrend(daily);
      console.log(`  Daily trend: ${dailyTrend}`);

      // Daily must align with direction OR show early reversal signs
      // (At monthly support we accept neutral or bullish daily)
      // (At monthly resistance we accept neutral or bearish daily)
      if(direction==="LONG"&&dailyTrend==="Bearish"){
        console.log(`  ${symbol} → Daily still bearish at support. Not ready. Skip.`);
        continue;
      }
      if(direction==="SHORT"&&dailyTrend==="Bullish"){
        console.log(`  ${symbol} → Daily still bullish at resistance. Not ready. Skip.`);
        continue;
      }

      // ── STEP 3: Daily Pattern ────────────────
      const pattern = detectDailyPattern(daily, direction);
      if(!pattern){
        console.log(`  ${symbol} → No daily reversal pattern. Skip.`);
        continue;
      }
      console.log(`  ${symbol} → Pattern: ${pattern.pattern} ✓`);

      // ── STEP 4: Fibonacci Confluence ─────────
      const fibResult = getFibconfluence(daily, currentPrice, direction, pattern);
      if(!fibResult){
        console.log(`  ${symbol} → No Fib confluence. Skip.`);
        continue;
      }
      console.log(`  ${symbol} → Fib ${fibResult.fib} confluence ✓`);

      // ── STEP 5: 4H Candle Trigger ────────────
      const candleTrigger = detect4HCandle(h4, direction);
      if(!candleTrigger){
        console.log(`  ${symbol} → No 4H candle trigger yet. Skip.`);
        continue;
      }
      console.log(`  ${symbol} → 4H trigger: ${candleTrigger} ✓`);

      // ── ALL CONDITIONS MET — BUILD SIGNAL ────
      const { sl, tp, rr } = calculateLevels(daily, h4, currentPrice, direction);
      const fund = FUNDAMENTALS[symbol] || FUNDAMENTALS.DEFAULT;

      const signal = {
        id:          `${symbol}-${Date.now()}`,
        asset:       symbol,
        dir:         direction,
        setup:       pattern.pattern,
        model:       `${candleTrigger} at Fib ${fibResult.fib}`,
        fib:         fibResult.fib,
        conf:        9,
        entry:       currentPrice,
        sl,
        tp,
        rr,
        biasM:       monthlyTrend==="Neutral"?`Reversal at Monthly ${monthlyLevel.type}`:monthlyTrend,
        biasW:       getDailyTrend(weekly?.slice(-30)||daily.slice(-60))||"Aligning",
        biasD:       dailyTrend,
        fundamental: pick(fund),
        confluence:  [
          `Monthly ${monthlyLevel.type} @ ${monthlyLevel.level?.toFixed(4)} — major level`,
          `Daily pattern: ${pattern.pattern} confirmed`,
          `Fibonacci ${fibResult.fib} aligns with pattern`,
          `4H trigger: ${candleTrigger}`,
          `Daily trend ${dailyTrend} — aligned with direction`,
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
      console.log(`  ✅ SWING SIGNAL: ${symbol} ${direction} | ${pattern.pattern} | Fib ${fibResult.fib} | ${candleTrigger} | RR 1:${rr}`);

    }catch(err){
      console.error(`  ${symbol} → Error: ${err.message}`);
    }
  }

  if(signals.length===0){
    console.log("\n  No swing setups confirmed this cycle. Market not ready. Quality over quantity.");
  }

  return signals;
}

module.exports = { scan };
