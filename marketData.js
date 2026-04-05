// ═══════════════════════════════════════════════
//  MARKET DATA — Yahoo Finance (Free, No Key)
//  Real OHLC candle data for all 8 assets
// ═══════════════════════════════════════════════
const axios = require("axios");

const SYMBOLS = {
  XAUUSD: "XAUUSD=X",   // Gold Spot vs USD
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
  "Accept": "application/json,text/html",
  "Accept-Language": "en-US,en;q=0.9",
};

// Fetch real OHLC candles from Yahoo Finance
async function getCandles(apexSymbol, interval="1d", range="3mo") {
  const yahooSymbol = SYMBOLS[apexSymbol];
  if (!yahooSymbol) return null;

  try {
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=${interval}&range=${range}&includePrePost=false`;
    const { data } = await axios.get(url, {
      headers: HEADERS,
      timeout: 12000,
    });

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
      volume: volumes[i] || 0,
    })).filter(c =>
      c.open != null && c.high != null &&
      c.low  != null && c.close != null &&
      !isNaN(c.open) && !isNaN(c.close)
    );

    return candles;
  } catch (err) {
    console.warn(`Yahoo Finance error for ${apexSymbol}: ${err.message}`);
    return null;
  }
}

// Get current live price
async function getPrice(apexSymbol) {
  const candles = await getCandles(apexSymbol, "1d", "5d");
  if (!candles || candles.length === 0) return null;
  return candles[candles.length - 1].close;
}

// Get all current prices
async function getAllPrices() {
  const prices = {};
  const tasks  = Object.keys(SYMBOLS).map(async (sym) => {
    try {
      const price = await getPrice(sym);
      if (price && !isNaN(price)) {
        let decimals = 4;
        if (sym === "BTCUSD" || sym === "NVDA" || sym === "XAUUSD" || sym === "USOIL" || sym === "ETHUSD") decimals = 2;
        if (sym === "USDJPY") decimals = 3;
        prices[sym] = +price.toFixed(decimals);
      }
    } catch (err) {
      console.warn(`Price fetch failed for ${sym}: ${err.message}`);
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
