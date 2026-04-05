// ═══════════════════════════════════════════════
//  MARKET DATA — Yahoo Finance (Free, No Key)
//  Real OHLC candle data for all 8 assets
// ═══════════════════════════════════════════════
const axios = require("axios");

const SYMBOLS = {
  XAUUSD: "GC=F",
  EURUSD: "EURUSD=X",
  GBPUSD: "GBPUSD=X",
  USDJPY: "JPY=X",
  BTCUSD: "BTC-USD",
  ETHUSD: "ETH-USD",
  NVDA:   "NVDA",
  USOIL:  "CL=F",
};

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Accept": "application/json",
};

// Fetch real OHLC candles from Yahoo Finance
async function getCandles(apexSymbol, interval="1d", range="3mo") {
  const yahooSymbol = SYMBOLS[apexSymbol];
  if (!yahooSymbol) return null;

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=${interval}&range=${range}`;
    const { data } = await axios.get(url, { headers: HEADERS, timeout: 10000 });

    const result = data?.chart?.result?.[0];
    if (!result) return null;

    const timestamps = result.timestamp || [];
    const ohlc       = result.indicators?.quote?.[0] || {};
    const closes     = ohlc.close  || [];
    const opens      = ohlc.open   || [];
    const highs      = ohlc.high   || [];
    const lows       = ohlc.low    || [];
    const volumes    = ohlc.volume || [];

    const candles = timestamps.map((ts, i) => ({
      time:   ts,
      open:   opens[i],
      high:   highs[i],
      low:    lows[i],
      close:  closes[i],
      volume: volumes[i],
    })).filter(c => c.open && c.high && c.low && c.close);

    return candles;
  } catch (err) {
    console.warn(`Yahoo Finance error for ${apexSymbol}: ${err.message}`);
    return null;
  }
}

// Get current price
async function getPrice(apexSymbol) {
  const candles = await getCandles(apexSymbol, "1d", "5d");
  if (!candles || candles.length === 0) return null;
  return candles[candles.length - 1].close;
}

// Get all current prices
async function getAllPrices() {
  const prices = {};
  const tasks  = Object.keys(SYMBOLS).map(async (sym) => {
    const price = await getPrice(sym);
    if (price) prices[sym] = +price.toFixed(sym === "USDJPY" ? 2 : sym === "BTCUSD" || sym === "ETHUSD" || sym === "NVDA" ? 2 : 4);
  });
  await Promise.allSettled(tasks);
  return prices;
}

// Get daily candles (HTF analysis)
async function getDailyCandles(apexSymbol) {
  return await getCandles(apexSymbol, "1d", "6mo");
}

// Get weekly candles (monthly bias)
async function getWeeklyCandles(apexSymbol) {
  return await getCandles(apexSymbol, "1wk", "2y");
}

module.exports = { getAllPrices, getCandles, getDailyCandles, getWeeklyCandles, SYMBOLS };
