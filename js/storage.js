// Local persistence layer. Everything lives in localStorage — no server, no accounts,
// so there is nothing here to breach except the device itself.

const STORAGE_KEY = "zensho1kyu_v1";

function defaultState() {
  return {
    profile: {
      examDate: "2026-09-06",
      startDate: null, // set on first launch
      weekdayHours: 3,
      weekendHours: 5,
      diagnosticDone: false,
      diagnosticResult: null, // { vocabPct, grammarPct, readingPct, level }
    },
    vocab: {}, // wordId -> { ef, interval, reps, due, lastResult, history: [] }
    vocabIntroduced: [], // ordered list of wordIds already shown at least once
    practiceAttempts: [], // { ts, category, questionId, correct }
    mockExams: [], // { ts, sectionScores: {vocab,grammar,reading,writing}, totalPct }
    studyLog: {}, // "YYYY-MM-DD" -> minutesStudied
    scheduleAdjustments: {}, // "YYYY-MM-DD" -> { skipped: bool, note: string }
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const fresh = defaultState();
      fresh.profile.startDate = todayISO();
      save(fresh);
      return fresh;
    }
    const parsed = JSON.parse(raw);
    // Fill in any keys added by later versions of the app.
    return { ...defaultState(), ...parsed, profile: { ...defaultState().profile, ...parsed.profile } };
  } catch (e) {
    console.error("Failed to load state, starting fresh.", e);
    const fresh = defaultState();
    fresh.profile.startDate = todayISO();
    save(fresh);
    return fresh;
  }
}

function save(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function exportJSON(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `zensho1kyu_backup_${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importJSON(file, onDone) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      save(parsed);
      onDone(null, parsed);
    } catch (err) {
      onDone(err, null);
    }
  };
  reader.readAsText(file);
}

function logMinutes(state, minutes) {
  const key = todayISO();
  state.studyLog[key] = (state.studyLog[key] || 0) + minutes;
  save(state);
}

export { load, save, todayISO, exportJSON, importJSON, logMinutes, defaultState };
