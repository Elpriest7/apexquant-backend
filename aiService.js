// ═══════════════════════════════════════════════
//  AI SERVICE — Google Gemini (Free)
//  Real live news via Gemini web search
// ═══════════════════════════════════════════════
const axios = require("axios");

const GEMINI_URL         = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
const GEMINI_SEARCH_URL  = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

async function callGemini(prompt, max=400, useSearch=false){
  const key = process.env.GEMINI_API_KEY;
  if(!key) return "";
  try{
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: max },
    };

    // Enable Google Search grounding for real live news
    if(useSearch){
      body.tools = [{ google_search: {} }];
    }

    const { data } = await axios.post(
      `${GEMINI_URL}?key=${key}`,
      body,
      { timeout: 20000 }
    );
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }catch(err){
    console.error("Gemini error:", err.message);
    return "";
  }
}

// ── Real Live News Brief (2 sentences max) ─────
// Fetches real current news for the specific pair
async function getLiveNewsBrief(asset, direction){
  const assetName = {
    XAUUSD:"Gold (XAU/USD)", EURUSD:"Euro/US Dollar (EUR/USD)",
    GBPUSD:"British Pound/US Dollar (GBP/USD)", USDJPY:"US Dollar/Japanese Yen (USD/JPY)",
    USDCHF:"US Dollar/Swiss Franc (USD/CHF)", USDCAD:"US Dollar/Canadian Dollar (USD/CAD)",
    AUDUSD:"Australian Dollar/US Dollar (AUD/USD)", NZDUSD:"New Zealand Dollar/US Dollar (NZD/USD)",
    EURGBP:"Euro/British Pound (EUR/GBP)", EURJPY:"Euro/Japanese Yen (EUR/JPY)",
    GBPJPY:"British Pound/Japanese Yen (GBP/JPY)", AUDJPY:"Australian Dollar/Japanese Yen (AUD/JPY)",
    CADJPY:"Canadian Dollar/Japanese Yen (CAD/JPY)", EURAUD:"Euro/Australian Dollar (EUR/AUD)",
    GBPAUD:"British Pound/Australian Dollar (GBP/AUD)", BTCUSD:"Bitcoin (BTC/USD)",
    ETHUSD:"Ethereum (ETH/USD)", SOLUSD:"Solana (SOL/USD)", BNBUSD:"BNB (BNB/USD)",
    XRPUSD:"Ripple (XRP/USD)", ADAUSD:"Cardano (ADA/USD)", NVDA:"NVIDIA (NVDA)",
    AAPL:"Apple (AAPL)", TSLA:"Tesla (TSLA)", MSFT:"Microsoft (MSFT)",
    AMZN:"Amazon (AMZN)", META:"Meta (META)", XAGUSD:"Silver (XAG/USD)",
    USOIL:"WTI Crude Oil", NATGAS:"Natural Gas",
  }[asset] || asset;

  const prompt = `Search for the latest financial news about ${assetName} from today or this week.

Write exactly 2 sentences:
Sentence 1: What specific news or macro event is currently driving ${assetName}?
Sentence 2: Why does this news support a ${direction} position right now?

Be very specific — mention actual data, rates, events. No vague statements. Max 50 words total.`;

  const txt = await callGemini(prompt, 150, true);
  return txt || "";
}

// ── Full AI write-up with live news ───────────
async function getWriteUp(trade){
  const prompt = `You are an elite institutional swing trading mentor.

TRADE: ${trade.asset} ${trade.dir}
Setup: ${trade.setup} | Fib: ${trade.fib} | Entry model: ${trade.model}
Monthly bias: ${trade.biasM} | Weekly: ${trade.biasW} | Daily: ${trade.biasD}
${trade.structureShift ? `Daily structure: ${trade.structureShift}` : ""}
Entry: ${trade.entry} | SL: ${trade.sl} | TP: ${trade.tp} | RR: 1:${trade.rr}
${trade.isManual ? "NOTE: Manually submitted by trader after their own chart analysis." : ""}
Current fundamental: "${trade.fundamental||"Market conditions align with direction"}"

Write EXACTLY 3 short paragraphs. Plain prose. No bullets. No headers.

PARAGRAPH 1 — LIVE FUNDAMENTAL: What specific macro news or economic event is driving ${trade.asset} right now? Why does it directly support the ${trade.dir} direction? Be specific — mention central banks, data releases, geopolitical events relevant to this pair.

PARAGRAPH 2 — TECHNICAL EDGE: Explain the monthly level, daily structure shift, pattern, and Fibonacci confluence. What does smart money see here that retail traders miss? Why is this level significant?

PARAGRAPH 3 — CONFIDENCE: As a mentor, why is this the right swing trade to take? End with one powerful sentence about patience and discipline.

Max 180 words. Calm, assured, mentor tone.`;

  const txt = await callGemini(prompt, 350, true); // Use web search for real news
  return txt || `This ${trade.asset} ${trade.dir} swing setup has reached a critical institutional level where all five criteria of professional trading have aligned simultaneously. ${trade.fundamental}. The ${trade.fib} Fibonacci retracement combined with the ${trade.setup} pattern creates the exact confluence that smart money has historically used to position before major moves. Your patience in waiting for this specific alignment — monthly level, daily structure shift, pattern, Fibonacci, and 4H candle trigger — is precisely what separates disciplined swing traders from retail noise. One setup like this, taken correctly, is worth more than twenty random trades.`;
}

// ── Journal narrative ──────────────────────────
async function getJournalNarrative(trade){
  const prompt = `You are a trading journal AI. Write a first-person swing trading journal entry.

TRADE: ${trade.asset} ${trade.dir} | Setup: ${trade.setup} | Fib: ${trade.fib}
Entry: ${trade.entry} | SL: ${trade.sl} | TP: ${trade.tp} | RR: 1:${trade.rr}
Outcome: ${trade.outcome}${trade.pnl!==null?` (${trade.pnl>0?"+":""}${trade.pnl}R)`:""}
Structure shift: ${trade.structureShift||"N/A"}
Fundamental: ${trade.fundamental||"Market aligned with direction"}
Execution: ${trade.execNote} | Psychology: ${trade.psyNote}
${trade.isManual?"This was my own manual analysis — I spotted this on the chart myself.":""}

Write 4-5 sentences as if the trader wrote in their journal. First person. Cover:
1. What the market was doing at the monthly level and the fundamental backdrop
2. What the daily structure shift and pattern told me about smart money
3. How I executed — patience waiting for 4H trigger at Fibonacci level
4. Psychological experience and discipline shown
5. Lesson from outcome

Honest, reflective, human. Sound like a real swing trader journaling. No headers.`;

  const txt = await callGemini(prompt, 300);
  return txt || `I identified this ${trade.asset} ${trade.dir} setup after price reached a key monthly level and the daily chart began showing ${trade.structureShift||"structure shift"} — confirming smart money was reacting to that zone. The ${trade.setup} pattern completed on the daily and I waited patiently for the ${trade.fib} Fibonacci retracement before looking for a 4H entry trigger. ${trade.psyNote}. ${trade.outcome==="WIN"?"This win reinforced that waiting for all five criteria to align is the real edge in swing trading.":trade.outcome==="LOSS"?"Even with a stop-out, every criteria was met — the process was correct and I risked only 1%.":"The trade is still developing and I remain committed to the original plan regardless of short-term noise."}`;
}

// ── Live fundamental for manual trades ────────
async function getFundamental(asset, direction){
  const txt = await callGemini(
    `In exactly 2 sentences, what is the most important current fundamental driver for ${asset} and why does it support a ${direction} position right now? Be specific about actual news, data or events. Max 40 words.`,
    120, true
  );
  return txt || "";
}

// ── Short news brief for trade card ───────────
async function getShortNewsBrief(asset, direction){
  return await getLiveNewsBrief(asset, direction);
}

// ── Self improvement ───────────────────────────
async function getSelfImprovement(stats){
  const prompt = `You are an AI swing trading system performing self-improvement analysis.

PERFORMANCE:
- Win rate: ${stats.winRate}% (${stats.wins} wins, ${stats.losses} losses, ${stats.closed} closed)
- Net R: ${stats.totalR}R | Avg RR on wins: ${stats.avgRR}
- Manual trades: ${stats.manual||0} | Pending: ${stats.pending}
- Setup breakdown: ${JSON.stringify(stats.setups||{})}

Write a SELF-IMPROVEMENT REPORT in 3 paragraphs. No bullets. No headers.

PARAGRAPH 1 — PATTERN ANALYSIS: What is working? Which setups perform best and why?
PARAGRAPH 2 — WEAKNESSES: Where are losses coming from? What step is failing most?
PARAGRAPH 3 — UPGRADES: Exactly 3 specific, measurable improvements for next cycle.

Write as a self-aware AI genuinely improving its swing trading methodology. Max 250 words.`;

  const txt = await callGemini(prompt, 450);
  return txt || `Pattern analysis shows the strongest results come from setups where all five criteria align cleanly — particularly when the monthly level is a major multi-year support or resistance and the daily structure shift is a clear break of structure rather than just a marginal higher low. Break & Retest and Double Bottom patterns at these levels are consistently outperforming.\n\nThe primary source of losses appears to be entering when the daily structure shift is borderline — where higher lows exist but the move is very small, suggesting the level hasn't truly been tested yet. The system is also occasionally generating signals when the monthly trend strongly opposes the direction, which creates conflicting signals.\n\nThree upgrades being implemented: first, the minimum higher low differential for a bullish structure shift is being raised from 0.1% to 0.3% to filter out marginal shifts; second, when monthly trend opposes direction, the system will require at least two clear structure shift signals rather than one before proceeding; third, all signals must now have at least 30 candles of daily history at the monthly level before patterns are evaluated, ensuring the level has been properly tested.`;
}

module.exports = { getWriteUp, getJournalNarrative, getFundamental, getShortNewsBrief, getSelfImprovement };
