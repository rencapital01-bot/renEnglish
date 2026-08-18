// Day-by-day study plan generator.
//
// Pedagogy behind the phase structure (all evidence-based, not just habit):
//  - Distributed practice beats cramming (Cepeda et al. 2006) → daily small
//    sessions across the whole 19 days, not marathon sessions at the end.
//  - New vocabulary intake is capped per day. Piling on new words faster than
//    they can be reviewed just produces forgetting, not learning — SRS only
//    pays off if review volume stays sane.
//  - Interleaving question types (vocab/grammar/reading mixed, not blocked)
//    improves discrimination between similar items (Rohrer & Taylor 2007).
//  - The final week shifts from new material to full timed mock exams,
//    because retrieval practice under real conditions (testing effect,
//    Roediger & Karpicke 2006) is the best predictor of exam-day performance,
//    and cramming brand-new vocab in the last 72 hours has poor payoff.

import { todayISO, addDays } from "./srs.js";

function buildPhases(startISO, examISO) {
  const start = new Date(startISO + "T00:00:00");
  const end = new Date(examISO + "T00:00:00");
  const totalDays = Math.max(1, Math.round((end - start) / 86400000));
  const foundationEnd = Math.round(totalDays * 0.4);
  const buildEnd = Math.round(totalDays * 0.8);
  return { totalDays, foundationEnd, buildEnd };
}

function phaseFor(dayIndex, phases) {
  if (dayIndex < phases.foundationEnd) return "foundation";
  if (dayIndex < phases.buildEnd) return "build";
  return "final";
}

const PHASE_LABELS = {
  foundation: "基礎固め",
  build: "応用・読解強化",
  final: "仕上げ・本番シミュレーション",
};

// Minute ratios per phase, per block type (non-mock days). Ratios sum to 1.0.
// Weighted against the VERIFIED scoring breakdown in data/examInfo.js:
// listening is 35% of the real exam's points -- the single biggest block --
// so it gets heavy time from day one even though it's the least familiar
// skill. Accent is only 5% of points and cheap to drill, so it gets a thin
// but constant slice rather than a dedicated phase.
const PHASE_MIX = {
  foundation: { vocab_review: 0.15, vocab_new: 0.3, grammar: 0.2, reading: 0.1, listening: 0.2, accent: 0.05 },
  build: { vocab_review: 0.2, vocab_new: 0.1, grammar: 0.2, reading: 0.2, listening: 0.25, accent: 0.05 },
  final: { vocab_review: 0.25, vocab_new: 0, grammar: 0.15, reading: 0.15, listening: 0.4, accent: 0.05 },
};

// On mock-exam days most of the session is the timed mock itself; the rest
// is just enough SRS review to keep due cards from piling up.
const MOCK_DAY_MIX = { mock_exam: 0.7, vocab_review: 0.3 };

const BLOCK_LABELS = {
  vocab_review: "単語復習(SRS)",
  vocab_new: "新出単語",
  grammar: "文法・会話表現・語順整序",
  reading: "長文読解",
  listening: "リスニング",
  accent: "発音・アクセント",
  mock_exam: "模擬試験",
};

function isWeekend(date) {
  const d = date.getDay();
  return d === 0 || d === 6;
}

// Given a date's position in the overall plan and how many study minutes are
// actually available that day, return the block-type breakdown. Pulled out
// of generateSchedule() so timetable.js can drive it off real free time
// (computed from the user's fixed weekly commitments) instead of the flat
// weekdayHours/weekendHours profile setting.
//
// `weightMultipliers` (optional, {type: number}) lets the adaptive layer in
// timetable.js nudge allocations based on which block types actually get
// completed historically — see timetable.js's computeCompletionWeights().
function blocksForDayIndex(dayIndex, totalDays, totalMinutes, weightMultipliers) {
  const phases = { totalDays, foundationEnd: Math.round(totalDays * 0.4), buildEnd: Math.round(totalDays * 0.8) };
  const phase = phaseFor(dayIndex, phases);
  const mockDay = phase === "final" ? dayIndex % 3 === 0 : phase === "build" ? dayIndex % 5 === 0 : false;
  const baseMix = mockDay ? MOCK_DAY_MIX : PHASE_MIX[phase];

  let mix = baseMix;
  if (weightMultipliers) {
    const adjusted = Object.fromEntries(Object.entries(baseMix).map(([type, ratio]) => [type, ratio * (weightMultipliers[type] ?? 1)]));
    const sum = Object.values(adjusted).reduce((a, b) => a + b, 0) || 1;
    mix = Object.fromEntries(Object.entries(adjusted).map(([type, v]) => [type, v / sum]));
  }

  const blocks = Object.entries(mix)
    .map(([type, ratio]) => ({ type, label: BLOCK_LABELS[type], minutes: Math.round(totalMinutes * ratio) }))
    .filter((b) => b.minutes > 0);

  return { phase, phaseLabel: PHASE_LABELS[phase], mockDay, blocks };
}

function generateSchedule(state) {
  const startISO = state.profile.startDate || todayISO();
  const examISO = state.profile.examDate;
  const phases = buildPhases(startISO, examISO);
  const { weekdayHours, weekendHours } = state.profile;

  const days = [];
  for (let i = 0; i < phases.totalDays; i++) {
    const dateISO = addDays(startISO, i);
    const dateObj = new Date(dateISO + "T00:00:00");
    const weekend = isWeekend(dateObj);
    const hours = weekend ? weekendHours : weekdayHours;
    const totalMinutes = Math.round(hours * 60);
    const { phase, phaseLabel, mockDay, blocks } = blocksForDayIndex(i, phases.totalDays, totalMinutes);

    days.push({
      date: dateISO,
      isWeekend: weekend,
      phase,
      phaseLabel,
      totalMinutes,
      blocks,
      isMockDay: mockDay,
      isExamDay: dateISO === examISO,
    });
  }
  return days;
}

function todayPlan(state) {
  const schedule = generateSchedule(state);
  const today = todayISO();
  return schedule.find((d) => d.date === today) || null;
}

// Day index (0 = startDate) and total plan length for an arbitrary date,
// used by timetable.js to call blocksForDayIndex() with real free minutes.
function planPosition(state, dateISO) {
  const startISO = state.profile.startDate || todayISO();
  const examISO = state.profile.examDate;
  const { totalDays } = buildPhases(startISO, examISO);
  const start = new Date(startISO + "T00:00:00");
  const d = new Date(dateISO + "T00:00:00");
  const dayIndex = Math.round((d - start) / 86400000);
  return { dayIndex, totalDays };
}

export { generateSchedule, todayPlan, blocksForDayIndex, planPosition, PHASE_LABELS, BLOCK_LABELS };
