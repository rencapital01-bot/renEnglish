// Rough, transparent estimate of pass likelihood — NOT a scientific guarantee.
// It exists to keep motivation and schedule pressure honest, not to predict
// the real exam with precision. Every number it's built from is visible in
// the dashboard so it never feels like a black box.

import { masteredCount } from "./srs.js";
import { PASS_LINE_PCT, VOCAB_TARGET_COUNT, SECTIONS } from "./data/examInfo.js";

function rollingAccuracy(attempts, category, n = 40) {
  const filtered = attempts.filter((a) => a.category === category).slice(-n);
  if (filtered.length === 0) return null;
  const correct = filtered.filter((a) => a.correct).length;
  return correct / filtered.length;
}

function computePassProbability(state) {
  const vocabMastered = masteredCount(state.vocab);
  const vocabPct = Math.min(1, vocabMastered / VOCAB_TARGET_COUNT);

  // One rolling accuracy per real exam section (accent/listening/vocab/grammar/reading).
  const sectionAcc = {};
  for (const s of SECTIONS) {
    sectionAcc[s.id] = rollingAccuracy(state.practiceAttempts, s.id);
  }

  const mocks = state.mockExams.slice(-3);
  const mockAvg = mocks.length ? mocks.reduce((s, m) => s + m.totalPct, 0) / mocks.length / 100 : null;

  // Proxy estimate from section practice, weighted exactly like the real
  // exam's point distribution. Sections with no attempts yet fall back to
  // vocabPct (the only signal available before any practice is done) so an
  // untouched section doesn't silently drop out of the average.
  const proxy = SECTIONS.reduce((sum, s) => sum + s.weight * (sectionAcc[s.id] ?? vocabPct), 0);

  let raw;
  let confidence; // how much to trust this number, shown to the user
  if (mockAvg !== null) {
    // Real mock-exam evidence dominates once it exists — it's the only
    // signal that actually mirrors exam conditions (timed, interleaved,
    // full-length).
    raw = 0.65 * mockAvg + 0.35 * proxy;
    confidence = mocks.length >= 2 ? "high" : "medium";
  } else {
    // No direct exam evidence yet — discount the proxy because per-question
    // untimed practice tends to overstate real exam performance.
    raw = proxy * 0.7;
    confidence = "low";
  }

  // Map raw mastery onto pass probability using the exam's pass line: scoring
  // right at the pass line is treated as a coin flip, not a lock.
  const margin = raw - PASS_LINE_PCT / 100;
  const passProbability = clamp(0.5 + margin * 1.8, 0.01, 0.98);

  return {
    passProbability,
    confidence,
    breakdown: {
      vocabPct,
      vocabMastered,
      vocabTarget: VOCAB_TARGET_COUNT,
      sectionAcc,
      mockAvg,
      mockCount: state.mockExams.length,
    },
  };
}

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

export { computePassProbability, rollingAccuracy };
