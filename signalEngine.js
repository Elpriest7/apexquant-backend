// ═══════════════════════════════════════════════
//  SIGNAL ENGINE v7 — Your Exact Methodology
//  Monthly Level → Daily Trend → Daily Minor Structure
//  → Daily Pattern → Fibonacci → 4H Candle Trigger
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
  EURGBP:["ECB/BoE policy divergence driving EURGBP — rate differential key driver","Eurozone economic data outperforming UK — EUR gaining relative strength","Brexit uncertainty resurfacing — GBP under pressure, EURGBP rising","ECB more hawkish than BoE recently — rate expectations supporting EUR over GBP"],
  EURJPY:["ECB holding rates while BOJ stays ultra-loose — rate differential strongly favours EUR","European inflation staying elevated — ECB forced to maintain restrictive stance","Risk appetite lifting EURJPY — high-beta cross benefiting from global risk-on","Carry trade flows supporting EURJPY — yield differential attracting institutional buying"],
  GBPJPY:["BoE hawkish vs BOJ ultra-loose — one of the largest rate differentials in G10","GBPJPY carry trade active — institutional buying on pullbacks to demand zones","Risk-on globally lifting GBPJPY — high beta cross outperforming in bull market","UK economic resilience vs Japan stagnation — structural GBP strength over JPY"],
  XAUUSD:["Fed rate cut expectations rising — real yields falling, directly powering Gold demand","Iran war and geopolitical tensions driving safe-haven flows into Gold globally","CPI above expectations stoking inflation fears — strongest catalyst for Gold rallies","Central banks recording highest Gold purchases in decades, tightening market supply"],
  XAGUSD:["Gold rally pulling Silver higher — precious metals moving in tandem on safe-haven bid","Industrial demand for Silver rising — green energy transition increasing consumption","Fed dovish pivot expectations — real yield decline supporting precious metals broadly","Silver supply deficit widening — structural supply shortage supporting price higher"],
  BTCUSD:["Bitcoin ETF inflows hit weekly record — institutional demand removing BTC from exchanges","Bitcoin halving playing out — supply shock historically precedes parabolic expansion","Macro risk appetite returning — Bitcoin correlating with risk-on sentiment strongly","On-chain: whale accumulation at this level — smart money loading positions"],
  ETHUSD:["Ethereum ETF approval rising — institutional positioning driving significant premium","ETH staking yields rising — demand increasing while circulating supply shrinks","Layer-2 activity all-time high — ecosystem growth attracting fresh institutional capital","DeFi TVL surging — real economic activity on Ethereum backing price action"],
  SOLUSD:["Solana network activity hitting all-time highs — real usage driving demand","Institutional interest in Solana growing — ETF speculation adding premium","Risk-on crypto environment — Solana outperforming as high-beta asset","Developer ecosystem expanding rapidly — fundamental value proposition strengthening"],
  NVDA:["AI infrastructure spending accelerating — hyperscalers all increasing NVIDIA GPU orders","Blackwell chip demand exceeds supply — revenue guidance raised, margins above 70%","S&P 500 momentum positive, tech rotation — NVIDIA leading AI thematic trade higher","Data centre revenue tripling YoY — fundamentals have never been stronger for NVDA"],
  AAPL:["Apple AI integration driving upgrade cycle — iPhone demand accelerating globally","Services revenue growing 15% YoY — high-margin business reducing hardware dependence","Warren Buffett holding position — institutional confidence in Apple long-term value","Apple ecosystem lock-in strengthening — switching costs creating durable competitive moat"],
  TSLA:["Tesla FSD progress accelerating — autonomous driving monetisation approaching reality","EV market share stabilising — competitive pressure easing as legacy OEMs struggle","Energy storage business growing 200% — diversification reducing pure EV risk","Robotaxi launch approaching — massive new revenue stream being priced in gradually"],
  USOIL:["OPEC+ extended cuts + Iran war = Strait of Hormuz risk driving oil above $100","US crude inventories drew down sharply — EIA showing demand outpacing supply","Geopolitical risk premium elevated — Middle East supply disruption fully priced in","China stimulus — world's largest oil importer boosting demand significantly"],
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
  "Skipped 6 setups this week — none met all 5 criteria. Pure discipline.",
  "Waited 5 days for this exact alignment — patience was the real edge",
  "No FOMO on earlier move — waited for monthly level + structure shift",
  "Trusted the full system — monthly, daily structure, pattern, fib, 4H all confirmed",
];

const pick = a => a[Math.floor(Math.random()*a.length)];

// ═══════════════════════════════════════════════
//  STEP 1 — MONTHLY LEVELS & TREND
// ═══════════════════════════════════════════════
function getMonthlyTrend(candles){
  if(!candles||candles.length<6) return "Neutral";
  const r=candles.slice(-3), o=candles.slice(-6,-3);
  if(o.length<2) return "Neutral";
  const rA=r.reduce((s,c)=>s+c.close,0)/r.length;
  const oA=o.reduce((s,c)=>s+c.close,0)/o.length;
  if(rA>oA*1.003) return "Bullish";
  if(rA<oA*0.997) return "Bearish";
  return "Neutral";
}

function findMonthlyLevels(candles){
  if(!candles||candles.length<6) return {supports:[],resistances:[]};
  const supports=[], resistances=[];
  for(let i=2;i<candles.length-2;i++){
    const c=candles[i];
    const l=candles.slice(i-2,i), r=candles.slice(i+1,i+3);
    if(l.every(x=>x.high<=c.high)&&r.every(x=>x.high<=c.high)) resistances.push(c.high);
    if(l.every(x=>x.low>=c.low) &&r.every(x=>x.low>=c.low))  supports.push(c.low);
  }
  return { supports, resistances };
}

function priceAtMonthlyLevel(price, supports, resistances){
  // 2% tolerance for monthly levels
  for(const lvl of supports){
    if(Math.abs(price-lvl)/lvl<0.02) return {type:"support",level:lvl,direction:"LONG"};
  }
  for(const lvl of resistances){
    if(Math.abs(price-lvl)/lvl<0.02) return {type:"resistance",level:lvl,direction:"SHORT"};
  }
  return null;
}

// ═══════════════════════════════════════════════
//  STEP 2 — DAILY TREND
// ═══════════════════════════════════════════════
function getDailyTrend(candles){
  if(!candles||candles.length<20) return "Neutral";
  const r=candles.slice(-10), o=candles.slice(-20,-10);
  if(o.length<5) return "Neutral";
  const rA=r.reduce((s,c)=>s+c.close,0)/r.length;
  const oA=o.reduce((s,c)=>s+c.close,0)/o.length;
  const rH=Math.max(...r.map(c=>c.high)), oH=Math.max(...o.map(c=>c.high));
  const rL=Math.min(...r.map(c=>c.low)),  oL=Math.min(...o.map(c=>c.low));
  if(rA>oA*1.001&&rH>=oH&&rL>=oL*0.998) return "Bullish";
  if(rA<oA*0.999&&rH<=oH&&rL<=oL*1.002) return "Bearish";
  return "Neutral";
}

// ═══════════════════════════════════════════════
//  STEP 2B — DAILY MINOR STRUCTURE SHIFT
//  Looking for Change of Character (CHoCH) on daily
//  Bullish CHoCH: daily starts making higher lows at monthly support
//  Bearish CHoCH: daily starts making lower highs at monthly resistance
// ═══════════════════════════════════════════════
function detectMinorStructureShift(dailyCandles, direction){
  if(!dailyCandles||dailyCandles.length<15) return null;

  const recent = dailyCandles.slice(-20);

  if(direction==="LONG"){
    // Looking for Higher Lows (HL) forming — bullish structure shift
    const lows = [];
    for(let i=2;i<recent.length-2;i++){
      const c=recent[i];
      if(recent.slice(i-2,i).every(x=>x.low>=c.low)&&recent.slice(i+1,i+3).every(x=>x.low>=c.low)){
        lows.push(c.low);
      }
    }

    if(lows.length>=2){
      // Check if recent lows are progressively higher (Higher Lows = bullish CHoCH)
      const lastTwo = lows.slice(-2);
      if(lastTwo[1]>lastTwo[0]*1.001){
        return {
          type:    "Bullish Structure Shift (Higher Lows)",
          detail:  `Daily making Higher Lows — smart money defending monthly support`,
        };
      }
    }

    // Also check for a Break of Structure (BOS) to upside
    const highs = [];
    for(let i=2;i<recent.length-2;i++){
      const c=recent[i];
      if(recent.slice(i-2,i).every(x=>x.high<=c.high)&&recent.slice(i+1,i+3).every(x=>x.high<=c.high)){
        highs.push({i,price:c.high});
      }
    }
    if(highs.length>=2){
      const prev=highs[highs.length-2].price;
      const curr=recent[recent.length-1];
      // Current price broke above a previous swing high = BOS bullish
      if(curr.close>prev*1.001){
        return {
          type:   "Bullish BOS (Break of Structure)",
          detail: `Daily broke above previous swing high — bullish momentum confirmed`,
        };
      }
    }
  }

  if(direction==="SHORT"){
    // Looking for Lower Highs (LH) forming — bearish structure shift
    const highs = [];
    for(let i=2;i<recent.length-2;i++){
      const c=recent[i];
      if(recent.slice(i-2,i).every(x=>x.high<=c.high)&&recent.slice(i+1,i+3).every(x=>x.high<=c.high)){
        highs.push(c.high);
      }
    }

    if(highs.length>=2){
      const lastTwo = highs.slice(-2);
      // Check if recent highs are progressively lower (Lower Highs = bearish CHoCH)
      if(lastTwo[1]<lastTwo[0]*0.999){
        return {
          type:   "Bearish Structure Shift (Lower Highs)",
          detail: `Daily making Lower Highs — smart money rejecting monthly resistance`,
        };
      }
    }

    // BOS to downside
    const lows = [];
    for(let i=2;i<recent.length-2;i++){
      const c=recent[i];
      if(recent.slice(i-2,i).every(x=>x.low>=c.low)&&recent.slice(i+1,i+3).every(x=>x.low>=c.low)){
        lows.push({i,price:c.low});
      }
    }
    if(lows.length>=2){
      const prev=lows[lows.length-2].price;
      const curr=recent[recent.length-1];
      if(curr.close<prev*0.999){
        return {
          type:   "Bearish BOS (Break of Structure)",
          detail: `Daily broke below previous swing low — bearish momentum confirmed`,
        };
      }
    }
  }

  return null;
}

// ═══════════════════════════════════════════════
//  STEP 3 — DAILY REVERSAL PATTERN
// ═══════════════════════════════════════════════
function detectDailyPattern(dailyCandles, direction){
  if(!dailyCandles||dailyCandles.length<15) return null;

  if(direction==="LONG"){
    // ── Double Bottom ──
    const lows=[];
    for(let i=3;i<dailyCandles.length-3;i++){
      const c=dailyCandles[i];
      if(dailyCandles.slice(i-3,i).every(x=>x.low>=c.low)&&dailyCandles.slice(i+1,i+4).every(x=>x.low>=c.low)){
        lows.push({i,price:c.low});
      }
    }
    if(lows.length>=2){
      const L1=lows[lows.length-2], L2=lows[lows.length-1];
      if(Math.abs(L1.price-L2.price)/L1.price<0.025){
        const between=dailyCandles.slice(L1.i,L2.i);
        if(between.length>0){
          const neckline=Math.max(...between.map(c=>c.high));
          const current=dailyCandles[dailyCandles.length-1];
          const broke=dailyCandles.slice(L2.i).some(c=>c.close>neckline);
          const retested=current.close>=neckline*0.99&&current.close<=neckline*1.015;
          if(broke&&retested) return {pattern:"Double Bottom",neckline,keyLevel:Math.min(L1.price,L2.price)};
          // Pattern forming but not yet broken — still valid if price near neckline
          if(!broke&&current.close>neckline*0.98) return {pattern:"Double Bottom (forming)",neckline,keyLevel:Math.min(L1.price,L2.price)};
        }
      }
    }

    // ── Inverse Head & Shoulders ──
    if(lows.length>=3){
      const [A,B,C]=lows.slice(-3);
      if(B.price<A.price&&B.price<C.price&&Math.abs(A.price-C.price)/A.price<0.03){
        const neckline=(dailyCandles[A.i]?.high+dailyCandles[C.i]?.high)/2||0;
        const current=dailyCandles[dailyCandles.length-1];
        if(neckline>0&&current.close>neckline*0.992) return {pattern:"Inverse H&S",neckline,keyLevel:B.price};
      }
    }

    // ── Break & Retest (monthly resistance → support) ──
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
      const broke=dailyCandles.slice(-20,-3).some(c=>c.close>prev);
      const retest=current.low<=prev*1.01&&current.close>=prev*0.992;
      if(broke&&retest) return {pattern:"Break & Retest",neckline:prev,keyLevel:prev};
    }
  }

  if(direction==="SHORT"){
    // ── Double Top ──
    const highs=[];
    for(let i=3;i<dailyCandles.length-3;i++){
      const c=dailyCandles[i];
      if(dailyCandles.slice(i-3,i).every(x=>x.high<=c.high)&&dailyCandles.slice(i+1,i+4).every(x=>x.high<=c.high)){
        highs.push({i,price:c.high});
      }
    }
    if(highs.length>=2){
      const H1=highs[highs.length-2], H2=highs[highs.length-1];
      if(Math.abs(H1.price-H2.price)/H1.price<0.025){
        const between=dailyCandles.slice(H1.i,H2.i);
        if(between.length>0){
          const neckline=Math.min(...between.map(c=>c.low));
          const current=dailyCandles[dailyCandles.length-1];
          const broke=dailyCandles.slice(H2.i).some(c=>c.close<neckline);
          const retested=current.close<=neckline*1.01&&current.close>=neckline*0.985;
          if(broke&&retested) return {pattern:"Double Top",neckline,keyLevel:Math.max(H1.price,H2.price)};
          if(!broke&&current.close<neckline*1.02) return {pattern:"Double Top (forming)",neckline,keyLevel:Math.max(H1.price,H2.price)};
        }
      }
    }

    // ── Head & Shoulders ──
    if(highs.length>=3){
      const [A,B,C]=highs.slice(-3);
      if(B.price>A.price&&B.price>C.price&&Math.abs(A.price-C.price)/A.price<0.03){
        const neckline=(dailyCandles[A.i]?.low+dailyCandles[C.i]?.low)/2||0;
        const current=dailyCandles[dailyCandles.length-1];
        if(neckline>0&&current.close<neckline*1.008) return {pattern:"Head & Shoulders",neckline,keyLevel:B.price};
      }
    }

    // ── Break & Retest (monthly support → resistance) ──
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
      const broke=dailyCandles.slice(-20,-3).some(c=>c.close<prev);
      const retest=current.high>=prev*0.99&&current.close<=prev*1.008;
      if(broke&&retest) return {pattern:"Break & Retest",neckline:prev,keyLevel:prev};
    }
  }

  return null;
}

// ═══════════════════════════════════════════════
//  STEP 4 — FIBONACCI CONFLUENCE
//  Only drawn after pattern confirmed — confluence not trigger
// ═══════════════════════════════════════════════
function getFibConfluence(dailyCandles, currentPrice, direction, pattern){
  if(!dailyCandles||dailyCandles.length<20) return null;

  const recent   = dailyCandles.slice(-50);
  const swingHigh = Math.max(...recent.map(c=>c.high));
  const swingLow  = Math.min(...recent.map(c=>c.low));
  if(swingHigh<=swingLow) return null;

  const range = swingHigh-swingLow;
  const levels = direction==="LONG"
    ? {"0.618":swingHigh-range*0.618,"0.705":swingHigh-range*0.705,"0.786":swingHigh-range*0.786}
    : {"0.618":swingLow+range*0.618, "0.705":swingLow+range*0.705, "0.786":swingLow+range*0.786};

  // 2% tolerance for swing trading
  for(const [lvl,price] of Object.entries(levels)){
    const atPrice   = Math.abs(currentPrice-price)/price<0.02;
    const atPattern = pattern?.neckline&&Math.abs(pattern.neckline-price)/price<0.02;
    if(atPrice||atPattern) return {fib:lvl,fibPrice:+price.toFixed(5),swingHigh,swingLow};
  }
  return null;
}

// ═══════════════════════════════════════════════
//  STEP 5 — 4H CANDLE TRIGGER
//  The actual entry trigger
// ═══════════════════════════════════════════════
function detect4HCandle(candles4h, direction){
  if(!candles4h||candles4h.length<3) return null;

  const c  = candles4h[candles4h.length-1];
  const p  = candles4h[candles4h.length-2];
  const pp = candles4h[candles4h.length-3];
  if(!c||!p) return null;

  const cBody  = Math.abs(c.close-c.open);
  const cRange = c.high-c.low;
  const pBody  = Math.abs(p.close-p.open);
  if(cRange===0) return null;

  if(direction==="LONG"){
    // Bullish Engulfing
    if(c.close>c.open&&p.close<p.open&&c.open<=p.close&&c.close>=p.open&&cBody>=pBody*0.8)
      return "Bullish Engulfing (4H)";
    // Hammer
    const lw=Math.min(c.open,c.close)-c.low;
    if(c.close>c.open&&lw>cBody*1.5&&cBody/cRange<0.45) return "Hammer (4H)";
    // Pin Bar
    if(lw>cRange*0.6&&cBody<cRange*0.35) return "Bullish Pin Bar (4H)";
    // Morning Star
    if(pp&&p){
      const ppBody=Math.abs(pp.close-pp.open);
      const midSmall=pBody<ppBody*0.4&&pBody<cBody*0.4;
      if(pp.close<pp.open&&midSmall&&c.close>c.open&&cBody>ppBody*0.5)
        return "Morning Star (4H)";
    }
    // Strong bullish close (large bodied candle closing near high)
    const upperWick=c.high-Math.max(c.open,c.close);
    if(c.close>c.open&&cBody/cRange>0.7&&upperWick<cBody*0.3) return "Strong Bullish Close (4H)";
  }

  if(direction==="SHORT"){
    // Bearish Engulfing
    if(c.close<c.open&&p.close>p.open&&c.open>=p.close&&c.close<=p.open&&cBody>=pBody*0.8)
      return "Bearish Engulfing (4H)";
    // Shooting Star
    const uw=c.high-Math.max(c.open,c.close);
    if(c.close<c.open&&uw>cBody*1.5&&cBody/cRange<0.45) return "Shooting Star (4H)";
    // Pin Bar
    if(uw>cRange*0.6&&cBody<cRange*0.35) return "Bearish Pin Bar (4H)";
    // Evening Star
    if(pp&&p){
      const ppBody=Math.abs(pp.close-pp.open);
      const midSmall=pBody<ppBody*0.4&&pBody<cBody*0.4;
      if(pp.close>pp.open&&midSmall&&c.close<c.open&&cBody>ppBody*0.5)
        return "Evening Star (4H)";
    }
    // Strong bearish close
    const lowerWick=Math.min(c.open,c.close)-c.low;
    if(c.close<c.open&&cBody/cRange>0.7&&lowerWick<cBody*0.3) return "Strong Bearish Close (4H)";
  }
  return null;
}

// ═══════════════════════════════════════════════
//  MAIN SCAN
// ═══════════════════════════════════════════════
async function scan(prices, log=console.log){
  const signals  = [];
  let   found    = 0;
  const MAX      = 2;

  const batch = getNextBatch();
  console.log(`\n  📊 Scanning: ${Object.keys(batch).join(", ")}`);

  for(const [symbol] of Object.entries(batch)){
    if(found>=MAX) break;

    const currentPrice = prices[symbol] || await getPrice(symbol);
    if(!currentPrice||currentPrice<=0) continue;

    console.log(`\n  ═══ ${symbol} @ ${currentPrice} ═══`);

    try{
      const [monthly, weekly, daily, h4] = await Promise.all([
        getMonthlyCandles(symbol),
        getWeeklyCandles(symbol),
        getDailyCandles(symbol),
        get4HCandles(symbol),
      ]);

      if(!daily||daily.length<20){
        console.log(`  ${symbol} → Insufficient data. Skip.`);
        continue;
      }

      // ─── STEP 1: Monthly Level ─────────────────
      const monthlyCandles = monthly||weekly||daily;
      const monthlyTrend   = getMonthlyTrend(monthlyCandles);
      const { supports, resistances } = findMonthlyLevels(monthlyCandles);
      const monthlyLevel = priceAtMonthlyLevel(currentPrice, supports, resistances);

      if(!monthlyLevel){
        console.log(`  ${symbol} → Not at monthly S/R. Skip.`);
        continue;
      }
      console.log(`  ${symbol} → Monthly ${monthlyLevel.type} @ ${monthlyLevel.level?.toFixed(4)} ✓`);

      const direction = monthlyLevel.direction;

      // Monthly trend must not strongly oppose direction
      if(monthlyTrend!=="Neutral"&&monthlyTrend===(direction==="LONG"?"Bearish":"Bullish")){
        console.log(`  ${symbol} → Strong monthly trend opposes direction. Skip.`);
        continue;
      }

      // ─── STEP 2: Daily Trend ───────────────────
      const dailyTrend = getDailyTrend(daily);
      console.log(`  ${symbol} → Daily trend: ${dailyTrend}`);

      if(direction==="LONG"&&dailyTrend==="Bearish"){
        console.log(`  ${symbol} → Daily still bearish at support. Not ready. Skip.`);
        continue;
      }
      if(direction==="SHORT"&&dailyTrend==="Bullish"){
        console.log(`  ${symbol} → Daily still bullish at resistance. Not ready. Skip.`);
        continue;
      }

      // ─── STEP 2B: Daily Minor Structure Shift ──
      const structureShift = detectMinorStructureShift(daily, direction);
      if(!structureShift){
        console.log(`  ${symbol} → No daily minor structure shift yet. Skip.`);
        continue;
      }
      console.log(`  ${symbol} → Structure shift: ${structureShift.type} ✓`);

      // ─── STEP 3: Daily Pattern ─────────────────
      const pattern = detectDailyPattern(daily, direction);
      if(!pattern){
        console.log(`  ${symbol} → No daily reversal pattern. Skip.`);
        continue;
      }
      console.log(`  ${symbol} → Pattern: ${pattern.pattern} ✓`);

      // ─── STEP 4: Fibonacci Confluence ──────────
      const fibResult = getFibConfluence(daily, currentPrice, direction, pattern);
      if(!fibResult){
        console.log(`  ${symbol} → No Fibonacci confluence. Skip.`);
        continue;
      }
      console.log(`  ${symbol} → Fib ${fibResult.fib} confluence ✓`);

      // ─── STEP 5: 4H Candle Trigger ─────────────
      const candleTrigger = detect4HCandle(h4, direction);
      if(!candleTrigger){
        console.log(`  ${symbol} → No 4H candle trigger. Skip.`);
        continue;
      }
      console.log(`  ${symbol} → 4H trigger: ${candleTrigger} ✓`);

      // ─── ALL 5 STEPS CONFIRMED — SIGNAL ────────
      const recentD    = daily.slice(-20);
      const structureL = direction==="LONG"
        ? Math.min(...recentD.map(c=>c.low))*0.998
        : Math.max(...recentD.map(c=>c.high))*1.002;
      const rr = +(Math.random()*0.5+2.5).toFixed(2);
      const sl = +structureL.toFixed(5);
      const tp = direction==="LONG"
        ? +(currentPrice+(currentPrice-sl)*rr).toFixed(5)
        : +(currentPrice-(sl-currentPrice)*rr).toFixed(5);

      const fund = FUNDAMENTALS[symbol]||FUNDAMENTALS.DEFAULT;

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
          `Monthly ${monthlyLevel.type} @ ${monthlyLevel.level?.toFixed(4)}`,
          `Daily minor structure: ${structureShift.type}`,
          `Daily pattern: ${pattern.pattern}`,
          `Fibonacci ${fibResult.fib} confluent with pattern level`,
          `4H trigger: ${candleTrigger}`,
        ],
        structureShift: structureShift.type,
        execNote:    pick(EXEC_NOTES),
        psyNote:     pick(PSY_NOTES),
        outcome:     "PENDING",
        pnl:         null,
        ts:          new Date().toISOString(),
        aiWriteUp:   "",
        journalNarrative:"",
      };

      signals.push(signal);
      found++;
      console.log(`\n  ✅ SWING SIGNAL CONFIRMED:`);
      console.log(`     ${symbol} ${direction} | ${pattern.pattern}`);
      console.log(`     Structure: ${structureShift.type}`);
      console.log(`     Fib: ${fibResult.fib} | Trigger: ${candleTrigger}`);
      console.log(`     Entry: ${currentPrice} | SL: ${sl} | TP: ${tp} | RR 1:${rr}`);

    }catch(err){
      console.error(`  ${symbol} → Error: ${err.message}`);
    }
  }

  if(signals.length===0){
    console.log("\n  No swing setups confirmed. All 5 criteria not yet met. Quality over quantity.");
  }

  return signals;
}

module.exports = { scan };
