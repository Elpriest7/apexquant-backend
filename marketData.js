// ═══════════════════════════════════════════════
//  MARKET DATA SERVICE
//  Fetches real prices from free APIs:
//  - CoinGecko  (Crypto  — no key needed)
//  - Twelve Data (Forex/Commodities — free tier)
//  - Alpha Vantage (Stocks — free tier)
// ═══════════════════════════════════════════════
const axios = require("axios");

// Cache prices to avoid hitting rate limits
let priceCache = {};
let lastFetch  = 0;
const CACHE_TTL = 30000; // 30 seconds

// ─── Asset definitions ─────────────────────────
const ASSETS = {
  // Crypto — via CoinGecko (free, no key)
  BTCUSD: { type: "crypto", id: "bitcoin",  base: 67450 },
  ETHUSD: { type: "crypto", id: "ethereum", base: 3412  },

  // Forex/Commodities — via Twelve Data (free key)
  EURUSD: { type: "forex",  symbol: "EUR/USD", base: 1.0812 },
  GBPUSD: { type: "forex",  symbol: "GBP/USD", base: 1.2643 },
  USDJPY: { type: "forex",  symbol: "USD/JPY", base: 151.42 },
  XAUUSD: { type: "forex",  symbol: "XAU/USD", base: 2318   },
  USOIL:  { type: "forex",  symbol: "WTI/USD", base: 82.3   },

  // Stock — via Alpha Vantage (free key)
  NVDA:   { type: "stock",  symbol: "NVDA",    base: 875    },
};

// ─── Fetch crypto prices from CoinGecko ────────
async function fetchCryptoPrices() {
  try {
    const ids = Object.values(ASSETS)
      .filter(a => a.type === "crypto")
      .map(a => a.id)
      .join(",");

    const { data } = await axios.get(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
      { timeout: 8000 }
    );

    const result = {};
    Object.entries(ASSETS).forEach(([symbol, asset]) => {
      if (asset.type === "crypto" && data[asset.id]) {
        result[symbol] = data[asset.id].usd;
      }
    });
    return result;
  } catch (err) {
    console.warn("CoinGecko fetch failed:", err.message);
    return {};
  }
}

// ─── Fetch forex prices from Twelve Data ───────
async function fetchForexPrices() {
  const key = process.env.TWELVE_DATA_KEY;

  // No key = use simulated prices (still realistic)
  if (!key || key === "your_twelvedata_key_here") {
    return simulatePrices("forex");
  }

  try {
    const symbols = Object.entries(ASSETS)
      .filter(([, a]) => a.type === "forex")
      .map(([, a]) => a.symbol)
      .join(",");

    const { data } = await axios.get(
      `https://api.twelvedata.com/price?symbol=${symbols}&apikey=${key}`,
      { timeout: 8000 }
    );

    const result = {};
    Object.entries(ASSETS).forEach(([sym, asset]) => {
      if (asset.type === "forex") {
        // Twelve Data returns single or batch differently
        const val = data[asset.symbol]?.price || data.price;
        if (val) result[sym] = parseFloat(val);
      }
    });
    return result;
  } catch (err) {
    console.warn("Twelve Data fetch failed:", err.message);
    return simulatePrices("forex");
  }
}

// ─── Fetch stock price from Alpha Vantage ──────
async function fetchStockPrices() {
  const key = process.env.ALPHA_VANTAGE_KEY;

  if (!key || key === "your_alphavantage_key_here") {
    return simulatePrices("stock");
  }

  try {
    const result = {};
    for (const [sym, asset] of Object.entries(ASSETS)) {
      if (asset.type !== "stock") continue;
      const { data } = await axios.get(
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${asset.symbol}&apikey=${key}`,
        { timeout: 8000 }
      );
      const price = data["Global Quote"]?.["05. price"];
      if (price) result[sym] = parseFloat(price);
    }
    return result;
  } catch (err) {
    console.warn("Alpha Vantage fetch failed:", err.message);
    return simulatePrices("stock");
  }
}

// ─── Simulate realistic prices (fallback) ──────
function simulatePrices(type) {
  const result = {};
  Object.entries(ASSETS).forEach(([sym, asset]) => {
    if (asset.type !== type) return;
    const drift = (Math.random() - 0.5) * 0.004;
    const price = +(asset.base * (1 + drift));
    result[sym] = asset.base > 100
      ? +price.toFixed(2)
      : +price.toFixed(4);
  });
  return result;
}

// ─── Main: get all prices ──────────────────────
async function getAllPrices() {
  const now = Date.now();

  // Return cache if fresh
  if (now - lastFetch < CACHE_TTL && Object.keys(priceCache).length > 0) {
    return priceCache;
  }

  // Fetch all in parallel
  const [crypto, forex, stocks] = await Promise.all([
    fetchCryptoPrices(),
    fetchForexPrices(),
    fetchStockPrices(),
  ]);

  priceCache = { ...crypto, ...forex, ...stocks };
  lastFetch  = now;

  // Fill any missing assets with simulated prices
  Object.entries(ASSETS).forEach(([sym, asset]) => {
    if (!priceCache[sym]) {
      const drift = (Math.random() - 0.5) * 0.003;
      priceCache[sym] = asset.base > 100
        ? +(asset.base * (1 + drift)).toFixed(2)
        : +(asset.base * (1 + drift)).toFixed(4);
    }
  });

  return priceCache;
}

// ─── Get asset list ────────────────────────────
function getAssets() {
  return Object.entries(ASSETS).map(([symbol, a]) => ({
    symbol,
    type: a.type,
    base: a.base,
  }));
}

module.exports = { getAllPrices, getAssets, ASSETS };
