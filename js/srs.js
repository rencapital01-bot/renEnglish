// Spaced-repetition engine (SM-2, the algorithm behind SuperMemo/Anki).
// Why SM-2 and not plain flashcard re-reading: spaced repetition is one of the
// few study techniques with strong, replicated evidence for long-term retention
// (Cepeda et al. 2006; Dunlosky et al. 2013 rated it "high utility"). Combined
// with active recall (typing the answer, not just recognizing it) it is the
// most time-efficient way to bank a large word list in a short window.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function newCard() {
  return { ef: 2.5, interval: 0, reps: 0, due: todayISO(), lastResult: null, history: [] };
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso, days) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + Math.round(days));
  return d.toISOString().slice(0, 10);
}

// quality: 0=完全に忘れた(again), 3=思い出せた(good), 5=即答できた(easy)
function review(card, quality) {
  const c = { ...card, history: [...(card.history || [])] };
  c.history.push({ ts: Date.now(), quality });
  if (c.history.length > 50) c.history.shift();

  if (quality < 3) {
    c.reps = 0;
    c.interval = 1;
  } else {
    if (c.reps === 0) c.interval = 1;
    else if (c.reps === 1) c.interval = 6;
    else c.interval = Math.round(c.interval * c.ef);
    c.reps += 1;
  }

  c.ef = Math.max(1.3, c.ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
  c.due = addDays(todayISO(), c.interval);
  c.lastResult = quality < 3 ? "again" : quality === 3 ? "good" : "easy";
  return c;
}

function isDue(card) {
  return !card.due || card.due <= todayISO();
}

function isMastered(card) {
  // Interval of 21+ days with at least 2 successful reps ≈ committed to long-term memory.
  return card.interval >= 21 && card.reps >= 2;
}

function dueCards(vocabState, wordIds) {
  return wordIds.filter((id) => {
    const c = vocabState[id];
    return !c || isDue(c);
  });
}

function masteredCount(vocabState) {
  return Object.values(vocabState).filter(isMastered).length;
}

export { newCard, review, isDue, isMastered, dueCards, masteredCount, addDays, todayISO };
