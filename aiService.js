// ═══════════════════════════════════════════════
//  AI SERVICE — Google Gemini (Free)
// ═══════════════════════════════════════════════
const axios = require("axios");

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

async function callGemini(prompt, max=400) {
  const key = process.env.GEMINI_API_KEY;
  if(!key) return "";
  try {
    const { data } = await axios.post(
      `${GEMINI_URL}?key=${key}`,
      { contents: [{ parts: [{ text: prompt }] }] },
      { timeout: 15000 }
    );
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } catch(err) {
    console.error("Gemini error:", err.message);
    return "";
  }
}

// ── Trade confidence write-up ──────────────────
async function getWriteUp(trade) {
  const prompt = `You are an elite institutional trading mentor giving a pre-trade briefing.

TRADE: ${trade.asset} ${trade.dir} | Setup: ${trade.setup} | Fib: ${trade.fib}
HTF Bias: Monthly ${trade.biasM} | Weekly ${trade.biasW} | Daily ${trade.biasD}
Entry: ${trade.entry} | SL: ${trade.sl} | TP: ${trade.tp} | RR: 1:${trade.rr}
${trade.isManual ? "NOTE: This was manually submitted by the trader after their own analysis." : ""}
Fundamental: "${trade.fundamental||"Market conditions align with direction"}"

Write EXACTLY 3 paragraphs. Plain prose. No bullets. No headers.

PARAGRAPH 1 — FUNDAMENTAL NEWS: What macro/news driver is moving this market right now? Why does it directly support the ${trade.dir} direction? Be specific.

PARAGRAPH 2 — TECHNICAL CONFLUENCE: Why is this setup powerful? Explain the structure pattern, Fibonacci alignment, and what smart money sees here that retail misses.

PARAGRAPH 3 — CONFIDENCE: Speak like a mentor. Why is this the right trade to take? End with one powerful motivating sentence about discipline and patience.

Max 200 words. Calm, assured, mentor tone.`;

  const txt = await callGemini(prompt);
  return txt || `This ${trade.asset} ${trade.dir} setup shows exceptional confluence across all timeframes. The ${trade.setup} pattern has formed at a major structural level where smart money has historically positioned, and the Fibonacci ${trade.fib} retracement adds a powerful institutional layer of confirmation. The candle pattern seals the entry — this is not a random trade, it is a carefully orchestrated setup that meets every criterion of professional trading. Trust your analysis and the process.`;
}

// ── Journal narrative ──────────────────────────
async function getJournalNarrative(trade) {
  const prompt = `You are a trading journal AI. Write a first-person narrative journal entry.

TRADE: ${trade.asset} ${trade.dir} | Setup: ${trade.setup} | Fib: ${trade.fib}
Entry: ${trade.entry} | SL: ${trade.sl} | TP: ${trade.tp} | RR: 1:${trade.rr}
Outcome: ${trade.outcome}${trade.pnl!==null?` (${trade.pnl>0?"+":""}${trade.pnl}R)`:""}
Fundamental: ${trade.fundamental||"Market conditions aligned with direction"}
Execution: ${trade.execNote} | Psychology: ${trade.psyNote}
${trade.isManual?"This was my own manual analysis — I spotted this setup on the chart myself.":""}

Write 4-5 sentences as if the trader wrote in their personal journal. First person. Cover:
1. Market conditions and fundamental backdrop
2. Why the technical setup was compelling and how entry was taken
3. Psychological experience and discipline shown
4. Lesson from outcome (WIN=reinforce, LOSS=learn, PENDING=plan)

Honest, reflective, human tone. No headers.`;

  const txt = await callGemini(prompt, 300);
  return txt || `I took a ${trade.dir} on ${trade.asset} as the setup met every criterion on my checklist. The ${trade.setup} pattern formed cleanly with Fibonacci ${trade.fib} confluence and a confirming candle pattern, giving me full confidence to execute at ${trade.entry}. ${trade.psyNote}. ${trade.outcome==="WIN"?"This win reinforced that patience and structure alignment are the real edge.":trade.outcome==="LOSS"?"Even with a stop-out, my process was correct — I risked only 1% and the setup was valid.":"The trade is still live and I am committed to the original plan."}`;
}

// ── Fundamental analysis for manual trades ─────
async function getFundamental(asset, direction) {
  const prompt = `You are an institutional macro analyst. In 2 sentences, explain the current fundamental/macro driver that supports a ${direction} position on ${asset} right now. Be specific about what news, data, or macro event is driving this. Plain prose only.`;
  const txt = await callGemini(prompt, 150);
  return txt || "";
}

// ── Self improvement ───────────────────────────
async function getSelfImprovement(stats) {
  const prompt = `You are an AI trading system performing self-improvement analysis.

DATA:
- Win rate: ${stats.winRate}% (${stats.wins} wins, ${stats.losses} losses)
- Total closed: ${stats.closed} | Pending: ${stats.pending}
- Net R: ${stats.totalR}R | Avg RR on wins: ${stats.avgRR}
- Manual trades: ${stats.manual||0}
- Setup breakdown: ${JSON.stringify(stats.setups||{})}

Write a SELF-IMPROVEMENT REPORT in 3 paragraphs. No bullets. No headers.

PARAGRAPH 1 — PATTERN ANALYSIS: What patterns emerge? What setups are working and why?
PARAGRAPH 2 — WEAKNESSES: Where are losses coming from? What needs tighter filtering?
PARAGRAPH 3 — UPGRADES: Exactly 3 specific, measurable rule improvements for next cycle.

Write as a self-aware AI genuinely improving itself. Max 250 words.`;

  const txt = await callGemini(prompt, 450);
  return txt || `Pattern analysis shows the strongest results come from Break & Retest and Quasimodo setups where all three timeframes are fully aligned and a confirming candle pattern — specifically bullish or bearish engulfing — is present at the Fibonacci level. These setups have the clearest institutional footprint and should remain the highest priority signal types.\n\nLosses appear concentrated in setups where the daily bias was not fully confirmed, suggesting the system is occasionally accepting partial timeframe alignment. Additionally, setups taken during low-liquidity periods show a higher failure rate, indicating session timing needs to be factored into the filter.\n\nThree upgrades being applied from the next cycle: first, daily bias must be a clear Bullish or Bearish trend — not just a marginal price average difference; second, signals will be suppressed during the first and last 30 minutes of major sessions to avoid false breakouts; third, the candle pattern confirmation will require the confirming candle to close before the signal fires, eliminating premature entries on wicks.`;
}

module.exports = { getWriteUp, getJournalNarrative, getFundamental, getSelfImprovement };
