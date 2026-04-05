// ═══════════════════════════════════════════════
//  MARKET DATA — Yahoo Finance (Free, No Key)
//  Real OHLC candle data for all 8 assets
// ═══════════════════════════════════════════════
const axios = require("axios");

// Verified working Yahoo Finance symbols
const SYMBOLS = {
  XAUUSD: "GC=F",       // Gold Futures (correct — $4700 is real in 2026)
  EURUSD: "EURUSD=X",   // Euro/USD
  GBPUSD: "GBPUSD=X",   // GBP/USD
  USDJPY: "USDJPY=X",   // USD/JPY
  BTCUSD: "BTC-USD",    // Bitcoin
  ETHUSD: "ETH-USD",    // Ethereum
  NVDA:   "NVDA",       // NVIDIA
  USOIL:  "CL=F",       // WTI Crude Oil Futures
};

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json",
  "Accept-Language": "en-US,en;q=0.9",
};

// Try multiple Yahoo Finance endpoints for reliability
async function fetchFromYahoo(yahooSymbol, interval, range) {
  const endpoints = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=${interval}&range=${range}&includePrePost=false`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=${interval}&range=${range}&includePrePost=false`,
  ];

  for (const url of endpoints) {
    try {
      const { data } = await axios.get(url, { headers: HEADERS, timeout: 12000 });
      const result   = data?.chart?.result?.[0];
      if (result) return result;
    } catch (_) {}
  }
  return null;
}

// Fetch real OHLC candles
async function getCandles(apexSymbol, interval="1d", range="3mo") {
  const yahooSymbol = SYMBOLS[apexSymbol];
  if (!yahooSymbol) return null;

  try {
    const result = await fetchFromYahoo(yahooSymbol, interval, range);
    if (!result) return null;

    const timestamps = result.timestamp || [];
    const ohlc       = result.indicators?.quote?.[0] || {};

    const candles = timestamps.map((ts, i) => ({
      time:   ts,
      open:   ohlc.open?.[i],
      high:   ohlc.high?.[i],
      low:    ohlc.low?.[i],
      close:  ohlc.close?.[i],
      volume: ohlc.volume?.[i] || 0,
    })).filter(c =>
      c.open  != null && c.high  != null &&
      c.low   != null && c.close != null &&
      !isNaN(c.open)  && !isNaN(c.close) &&
      c.close > 0
    );

    return candles;
  } catch (err) {
    console.warn(`Candle fetch error for ${apexSymbol}: ${err.message}`);
    return null;
  }
}

// Get current live price
async function getPrice(apexSymbol) {
  const candles = await getCandles(apexSymbol, "1d", "5d");
  if (!candles || candles.length === 0) return null;
  return candles[candles.length - 1].close;
}

// Get all prices in parallel
async function getAllPrices() {
  const prices = {};
  const tasks  = Object.keys(SYMBOLS).map(async (sym) => {
    try {
      const price = await getPrice(sym);
      if (price && !isNaN(price) && price > 0) {
        let decimals = 4;
        if (["BTCUSD","NVDA","XAUUSD","USOIL","ETHUSD"].includes(sym)) decimals = 2;
        if (sym === "USDJPY") decimals = 3;
        prices[sym] = +price.toFixed(decimals);
      }
    } catch (err) {
      console.warn(`Price failed for ${sym}: ${err.message}`);
    }
  });
  await Promise.allSettled(tasks);
  return prices;
}

// Get daily candles for technical analysis
async function getDailyCandles(apexSymbol) {
  return await getCandles(apexSymbol, "1d", "6mo");
}

// Get weekly candles for HTF bias
async function getWeeklyCandles(apexSymbol) {
  return await getCandles(apexSymbol, "1wk", "2y");
}

module.exports = { getAllPrices, getCandles, getDailyCandles, getWeeklyCandles, SYMBOLS };
