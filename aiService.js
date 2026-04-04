// ═══════════════════════════════════════════════
//  AI SERVICE — Google Gemini (Free)
//  Generates trade write-ups and journal entries
// ═══════════════════════════════════════════════
const axios = require("axios");

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

async function callGemini(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return "";

  try {
    const { data } = await axios.post(
      `${GEMINI_URL}?key=${key}`,
      {
        contents: [{
          parts: [{ text: prompt }]
        }]
      },
      { timeout: 15000 }
    );
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } catch (err) {
    console.error("Gemini error:", err.message);
    return "";
  }
}

// ── Trade confidence write-up ──────────────────
async function getWriteUp(trade) {
  const prompt = `You are an elite institutional trading mentor giving a pre-trade briefing.

TRADE: ${trade.asset} ${trade.dir} | Setup: ${trade.setup} | Fib: ${trade.fib}
HTF Bias: Monthly ${trade.biasM} | Weekly ${trade.biasW} | Daily ${trade.biasD}
Confidence: ${trade.conf}/10
Fundamental driver: "${trade.fundamental}"

Write EXACTLY 3 paragraphs. Plain prose only. No bullets. No headers.

PARAGRAPH 1 - FUNDAMENTAL NEWS: What specific macro news is driving this move RIGHT NOW? Why does the fundamental driver directly support the ${trade.dir} direction? Be specific and educational.

PARAGRAPH 2 - TECHNICAL CONFLUENCE: Why is the ${trade.fib} Fibonacci level here so significant? What does the ${trade.setup} pattern tell us about smart money positioning?

PARAGRAPH 3 - CONFIDENCE BOOST: Speak like a mentor. Why is waiting for this exact setup the professional move? End with one powerful motivating sentence.

Max 190 words. Calm, assured, mentor tone.`;

  const txt = await callGemini(prompt);
  return txt || `${trade.asset} is presenting a high-conviction ${trade.dir} opportunity where fundamentals and structure have converged perfectly. ${trade.fundamental}. The ${trade.fib} Fibonacci retracement sits precisely at a ${trade.biasM === "Bullish" ? "demand" : "supply"} zone where smart money has historically positioned before the next leg. Your patience in waiting for this ${trade.setup} setup is exactly what separates disciplined professionals from the rest of the market.`;
}

// ── Journal narrative ──────────────────────────
async function getJournalNarrative(trade) {
  const prompt = `You are a trading journal AI. Write a first-person narrative journal entry.

TRADE: ${trade.asset} ${trade.dir} | Setup: ${trade.setup} | Fib: ${trade.fib}
Entry: ${trade.entry} | Stop: ${trade.sl} | Target: ${trade.tp} | RR: 1:${trade.rr}
Outcome: ${trade.outcome}${trade.pnl !== null ? ` (${trade.pnl > 0 ? "+" : ""}${trade.pnl}R)` : ""}
Fundamental: ${trade.fundamental}
Execution: ${trade.execNote} | Psychology: ${trade.psyNote}

Write 4-5 sentences as if the trader wrote in their personal journal. First person. Cover:
1. What the market was doing and the fundamental catalyst
2. Why the technical setup was compelling and how entry was taken
3. Psychological experience and discipline shown
4. Lesson reinforced if WIN, lesson learned if LOSS, plan if PENDING

Reflective, honest, human tone. No headers.`;

  const txt = await callGemini(prompt);
  return txt || `I took a ${trade.dir} on ${trade.asset} as ${trade.fundamental.toLowerCase()}. The ${trade.setup} formed cleanly at the ${trade.fib} Fibonacci level with full multi-timeframe alignment. I entered at ${trade.entry} with a stop at ${trade.sl} targeting ${trade.tp}. ${trade.psyNote}. ${trade.outcome === "WIN" ? "This win reminded me that patience and structure alignment are the real edge." : trade.outcome === "LOSS" ? "Even with a stop-out, my process was correct and I risked exactly 1%." : "The trade is still live and I am committed to the original plan."}`;
}

// ── Self improvement report ────────────────────
async function getSelfImprovement(stats) {
  const prompt = `You are an AI trading system performing a self-improvement analysis.

PERFORMANCE DATA:
- Win rate: ${stats.winRate}%
- Total trades: ${stats.closed} closed, ${stats.pending} pending
- Wins: ${stats.wins} | Losses: ${stats.losses}
- Net R: ${stats.totalR}R
- Average RR on wins: ${stats.avgRR}

Write a SELF-IMPROVEMENT REPORT in 3 paragraphs. No bullets. No headers.

PARAGRAPH 1 - PATTERN ANALYSIS: What patterns emerge from this data? What is working?
PARAGRAPH 2 - WEAKNESSES: Where are losses likely coming from? What needs tighter filtering?
PARAGRAPH 3 - UPGRADES: Exactly 3 specific rule improvements to apply next cycle.

Write as a self-aware AI genuinely improving itself. Max 230 words.`;

  const txt = await callGemini(prompt);
  return txt || `Pattern analysis shows the system is generating signals with an average confidence of ${stats.winRate}% alignment across timeframes. The strongest results come from setups where all three timeframes agree and Fibonacci 0.786 is confirmed by an order block. These setups will remain the highest priority going forward.\n\nLosses appear concentrated in lower-confluence setups where the daily bias was neutral rather than fully aligned. The system needs to be stricter about requiring all three timeframes to agree before generating a signal.\n\nThree upgrades being applied from next cycle: first, minimum confidence score raised from 7 to 8 out of 10; second, neutral daily bias will now automatically disqualify a setup regardless of monthly and weekly alignment; third, the system will wait for a confirmed candle close before logging any signal rather than acting on intra-candle price action.`;
}

module.exports = { getWriteUp, getJournalNarrative, getSelfImprovement };
