// ═══════════════════════════════════════════════
//  MARKET DATA — Yahoo Finance (Free, No Key)
//  31 markets — batched to avoid timeouts
//  Swing Trading: Daily + Weekly + Monthly candles
// ═══════════════════════════════════════════════
const axios = require("axios");

// All 31 markets grouped into batches of 8
const ALL_SYMBOLS = {
  // Forex
  EURUSD: "EURUSD=X", GBPUSD: "GBPUSD=X", USDJPY: "USDJPY=X",
  USDCHF: "USDCHF=X", USDCAD: "USDCAD=X", AUDUSD: "AUDUSD=X",
  NZDUSD: "NZDUSD=X", EURGBP: "EURGBP=X", EURJPY: "EURJPY=X",
  GBPJPY: "GBPJPY=X", AUDJPY: "AUDJPY=X", CADJPY: "CADJPY=X",
  EURAUD: "EURAUD=X", GBPAUD: "GBPAUD=X",
  // Crypto
  BTCUSD: "BTC-USD",  ETHUSD: "ETH-USD",  SOLUSD: "SOL-USD",
  BNBUSD: "BNB-USD",  XRPUSD: "XRP-USD",  ADAUSD: "ADA-USD",
  // Stocks
  NVDA: "NVDA", AAPL: "AAPL", TSLA: "TSLA",
  MSFT: "MSFT", AMZN: "AMZN", META: "META",
  // Commodities
  XAUUSD: "GC=F",    XAGUSD: "SI=F",
  USOIL:  "CL=F",    NATGAS: "NG=F",
};

// Split into batches of 8
const BATCHES = [];
const entries = Object.entries(ALL_SYMBOLS);
for(let i=0; i<entries.length; i+=8){
  BATCHES.push(Object.fromEntries(entries.slice(i,i+8)));
}

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Accept": "application/json",
};

// Track which batch to scan next
let currentBatch = 0;

async function fetchCandles(yahooSymbol, interval, range){
  const urls = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=${interval}&range=${range}&includePrePost=false`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=${interval}&range=${range}&includePrePost=false`,
  ];
  for(const url of urls){
    try{
      const { data } = await axios.get(url, { headers: HEADERS, timeout: 12000 });
      const result = data?.chart?.result?.[0];
      if(!result) continue;
      const ts   = result.timestamp || [];
      const q    = result.indicators?.quote?.[0] || {};
      const candles = ts.map((t,i)=>({
        time:  t,
        open:  q.open?.[i],
        high:  q.high?.[i],
        low:   q.low?.[i],
        close: q.close?.[i],
        volume:q.volume?.[i]||0,
      })).filter(c=>c.open!=null&&c.close!=null&&!isNaN(c.close)&&c.close>0);
      if(candles.length>0) return candles;
    }catch(_){}
  }
  return null;
}

// Get next batch of symbols to scan (rotates through all 31)
function getNextBatch(){
  const batch = BATCHES[currentBatch];
  currentBatch = (currentBatch+1) % BATCHES.length;
  return batch;
}

// Get all current prices (full list for display)
async function getAllPrices(){
  const prices = {};
  // Only fetch first 2 batches for price display (keeps it fast)
  const displaySymbols = Object.fromEntries(entries.slice(0,16));
  const tasks = Object.entries(displaySymbols).map(async([sym,yahoo])=>{
    try{
      const c = await fetchCandles(yahoo,"1d","5d");
      if(c&&c.length>0){
        const price = c[c.length-1].close;
        let d = 4;
        if(["BTCUSD","NVDA","AAPL","TSLA","MSFT","AMZN","META","XAUUSD","XAGUSD","USOIL","NATGAS"].includes(sym)) d=2;
        if(["USDJPY","EURJPY","GBPJPY","AUDJPY","CADJPY"].includes(sym)) d=3;
        prices[sym] = +price.toFixed(d);
      }
    }catch(_){}
  });
  await Promise.allSettled(tasks);
  return prices;
}

// Get monthly candles (2+ years of weekly = monthly equivalent)
async function getMonthlyCandles(apexSymbol){
  const yahoo = ALL_SYMBOLS[apexSymbol];
  if(!yahoo) return null;
  return await fetchCandles(yahoo,"1mo","5y");
}

// Get weekly candles
async function getWeeklyCandles(apexSymbol){
  const yahoo = ALL_SYMBOLS[apexSymbol];
  if(!yahoo) return null;
  return await fetchCandles(yahoo,"1wk","2y");
}

// Get daily candles
async function getDailyCandles(apexSymbol){
  const yahoo = ALL_SYMBOLS[apexSymbol];
  if(!yahoo) return null;
  return await fetchCandles(yahoo,"1d","1y");
}

// Get 4H candles (for entry trigger)
async function get4HCandles(apexSymbol){
  const yahoo = ALL_SYMBOLS[apexSymbol];
  if(!yahoo) return null;
  return await fetchCandles(yahoo,"4h","60d");
}

// Get current price
async function getPrice(apexSymbol){
  const daily = await getDailyCandles(apexSymbol);
  if(!daily||daily.length===0) return null;
  return daily[daily.length-1].close;
}

module.exports = { getAllPrices, getMonthlyCandles, getWeeklyCandles, getDailyCandles, get4HCandles, getPrice, getNextBatch, ALL_SYMBOLS };
