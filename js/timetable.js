// Converts the abstract "X minutes of listening today" plan from schedule.js
// into a concrete clock-time timetable, by fitting study blocks into the
// gaps around the user's real fixed commitments (school, job, sleep, etc.).
//
// Also closes the loop the user asked for: every generated timetable is
// logged with which blocks actually got marked done, and that history
// nudges future allocations away from block types that keep getting
// skipped (see computeCompletionWeights()) -- a simple, explainable form of
// "learn from what actually happened" rather than a opaque model.

import { blocksForDayIndex, planPosition } from "./schedule.js";
import { save, todayISO } from "./storage.js";

const MIN_CHUNK_MINUTES = 10;
const BREAK_MINUTES = 10;
const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function toHHMM(mins) {
  const m = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function dayOfWeek(dateISO) {
  return new Date(dateISO + "T00:00:00").getDay();
}

function getFixedEventsForDate(state, dateISO) {
  const dow = dayOfWeek(dateISO);
  const events = (state.fixedSchedule[dow] || []).map((e) => ({ ...e, startMin: toMinutes(e.start), endMin: toMinutes(e.end) }));
  return events.sort((a, b) => a.startMin - b.startMin);
}

// Free gaps within [dayStart, dayEnd], chronological, excluding fixed events.
function computeFreeGaps(state, dateISO) {
  const dayStart = toMinutes(state.profile.dayStart || "06:30");
  const dayEnd = toMinutes(state.profile.dayEnd || "23:30");
  const events = getFixedEventsForDate(state, dateISO);

  const gaps = [];
  let cursor = dayStart;
  for (const ev of events) {
    const s = Math.max(ev.startMin, dayStart);
    const e = Math.min(ev.endMin, dayEnd);
    if (s > cursor) gaps.push({ start: cursor, end: Math.min(s, dayEnd) });
    cursor = Math.max(cursor, e);
  }
  if (cursor < dayEnd) gaps.push({ start: cursor, end: dayEnd });
  return gaps.filter((g) => g.end - g.start >= MIN_CHUNK_MINUTES);
}

// Priority order study blocks get scheduled in. vocab_review is first because
// SRS due cards actively decay the longer they're left; mock_exam is handled
// separately since it needs one uninterrupted slot, not a fill-in-the-gaps one.
const PRIORITY_ORDER = ["vocab_review", "listening", "grammar", "reading", "vocab_new", "accent"];

// Reads the last 14 days of timetableLog and returns a per-block-type
// multiplier (0.7-1.2) based on how often that block type actually got
// checked off. A type that's consistently skipped gets scaled down (so the
// freed-up time flows to types that are actually getting done) rather than
// the app stubbornly re-assigning the same ignored slot every day.
function computeCompletionWeights(state) {
  const cutoff = Date.now() - 14 * 86400000;
  const counts = {}; // type -> { planned, done }
  for (const [dateISO, log] of Object.entries(state.timetableLog)) {
    const t = new Date(dateISO + "T00:00:00").getTime();
    if (t < cutoff) continue;
    for (const b of log.blocks || []) {
      if (b.type === "mock_exam" || b.fixed || b.isBreak) continue;
      if (!counts[b.type]) counts[b.type] = { planned: 0, done: 0 };
      counts[b.type].planned++;
      if (b.done) counts[b.type].done++;
    }
  }
  const weights = {};
  for (const [type, c] of Object.entries(counts)) {
    if (c.planned < 3) continue; // not enough samples yet -- stay neutral
    const rate = c.done / c.planned;
    // Map completion rate [0,1] onto a multiplier [0.7, 1.2] centered on 0.6
    // (a modest bias, not a cliff -- one bad week shouldn't zero out a skill).
    weights[type] = clamp(0.7 + (rate - 0.3) * 0.7, 0.7, 1.2);
  }
  return weights;
}

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

// Greedily fills chronological gaps from a priority-ordered queue of blocks.
// Mock exams (if present) are pulled out first and placed whole into the
// single largest gap, since a timed mock can't be split across separate
// sit-downs the way flashcard review or reading practice can.
function packBlocksIntoGaps(gaps, blocks) {
  const scheduled = [];
  let workingGaps = gaps.map((g) => ({ ...g }));

  const mock = blocks.find((b) => b.type === "mock_exam");
  const divisible = blocks.filter((b) => b.type !== "mock_exam").sort((a, b) => PRIORITY_ORDER.indexOf(a.type) - PRIORITY_ORDER.indexOf(b.type));

  if (mock) {
    workingGaps.sort((a, b) => b.end - b.start - (a.end - a.start));
    const biggest = workingGaps[0];
    if (biggest) {
      const minutes = Math.min(mock.minutes, biggest.end - biggest.start);
      scheduled.push({ type: mock.type, label: mock.label, start: biggest.start, end: biggest.start + minutes, minutes });
      biggest.start += minutes;
    }
  }

  workingGaps = workingGaps.filter((g) => g.end - g.start >= MIN_CHUNK_MINUTES).sort((a, b) => a.start - b.start);

  const queue = divisible.map((b) => ({ ...b, remaining: b.minutes }));
  let qi = 0;
  for (const gap of workingGaps) {
    let cursor = gap.start;
    while (cursor < gap.end && qi < queue.length) {
      const item = queue[qi];
      if (item.remaining <= 0) {
        qi++;
        continue;
      }
      const gapLeft = gap.end - cursor;
      if (gapLeft < MIN_CHUNK_MINUTES) break;
      const take = Math.min(item.remaining, gapLeft);
      if (take < MIN_CHUNK_MINUTES && item.remaining > take) {
        // Not enough room left in this gap for even a minimal chunk of this
        // block and there's more of it queued -- leave the rest for a later
        // gap instead of creating a too-small sliver.
        break;
      }
      scheduled.push({ type: item.type, label: item.label, start: cursor, end: cursor + take, minutes: take });
      cursor += take;
      item.remaining -= take;
      if (item.remaining <= 0) qi++;

      // A short break before the next activity -- studying different
      // subjects back-to-back with zero pause isn't realistic or
      // sustainable, even when the clock time is technically free.
      const moreToSchedule = item.remaining > 0 || qi < queue.length;
      if (moreToSchedule && cursor + BREAK_MINUTES <= gap.end) {
        scheduled.push({ type: "break", label: "休憩", start: cursor, end: cursor + BREAK_MINUTES, minutes: BREAK_MINUTES, isBreak: true });
        cursor += BREAK_MINUTES;
      }
    }
  }
  return scheduled;
}

// Builds (and persists) the concrete timetable for a given date: fixed
// events + study blocks, time-sorted. Reuses any `done` flags already
// recorded for that date so re-rendering doesn't reset checkboxes.
function generateTimetable(state, dateISO) {
  const { dayIndex, totalDays } = planPosition(state, dateISO);
  if (dayIndex < 0 || dayIndex >= totalDays) {
    return { blocks: [], outOfRange: true };
  }

  const gaps = computeFreeGaps(state, dateISO);
  const totalFreeMinutes = gaps.reduce((s, g) => s + (g.end - g.start), 0);

  // Free time can vastly exceed the user's actual study budget (e.g. a
  // school-free Sunday isn't meant to become 12 hours of studying). Cap the
  // minutes actually planned to the weekday/weekend hours from Settings --
  // the fixed-schedule gaps only decide WHEN inside the day study happens,
  // not how MUCH. Any leftover free time is just left open.
  const weekend = dayOfWeek(dateISO) === 0 || dayOfWeek(dateISO) === 6;
  const budgetMinutes = Math.round((weekend ? state.profile.weekendHours : state.profile.weekdayHours) * 60);
  const plannedMinutes = Math.min(totalFreeMinutes, budgetMinutes);

  const weights = computeCompletionWeights(state);
  const { phaseLabel, blocks: targets } = blocksForDayIndex(dayIndex, totalDays, plannedMinutes, weights);
  const studyBlocks = packBlocksIntoGaps(gaps, targets);

  const fixedEvents = getFixedEventsForDate(state, dateISO).map((e) => ({
    type: "fixed",
    label: e.label,
    start: e.startMin,
    end: e.endMin,
    minutes: e.endMin - e.startMin,
    fixed: true,
  }));

  const existingLog = state.timetableLog[dateISO];
  const merged = [...fixedEvents, ...studyBlocks].sort((a, b) => a.start - b.start);
  const withDone = merged.map((b) => {
    if (b.fixed || b.isBreak) return b;
    const prior = existingLog?.blocks?.find((p) => !p.fixed && !p.isBreak && p.type === b.type && p.start === b.start);
    return { ...b, done: prior?.done || false };
  });

  state.timetableLog[dateISO] = { blocks: withDone, phaseLabel, totalFreeMinutes, plannedMinutes };
  save(state);

  return { blocks: withDone, phaseLabel, totalFreeMinutes, plannedMinutes, outOfRange: false };
}

function toggleDone(state, dateISO, blockStart, blockType) {
  const log = state.timetableLog[dateISO];
  if (!log) return;
  const b = log.blocks.find((x) => x.start === blockStart && x.type === blockType);
  if (b) {
    b.done = !b.done;
    save(state);
  }
}

export { WEEKDAY_LABELS, toMinutes, toHHMM, getFixedEventsForDate, computeFreeGaps, generateTimetable, toggleDone, computeCompletionWeights, dayOfWeek };
