// Exam calibration constants.
// STATUS: VERIFIED 2026-08-18 against the actual 第75回 (令和7年度, 2025-12-21)
// past exam PDF published by 全国商業高等学校協会 (zensho.or.jp/examination/pastexams/english/),
// plus the official schedule page confirming 第76回 = 2026-09-06.
//
// Structure: 90 minutes, 12 大問 x 5 items = 60 questions, ALL multiple-choice
// (mark-sheet). No essay/writing section, no speaking/interview component,
// no dedicated "business document" section (that's a myth repeated on some
// blogs -- the real paper is general reading/listening/grammar with business-
// flavored topics woven into passages, not a distinct business-correspondence
// question type).
//
// Scoring: 問1-4 = 1pt/item (20 items = 20pts), 問5-12 = 2pt/item (40 items =
// 80pts). Total 100pts. Pass line for 1級 = 70/100 (70%) -- higher than the
// 60% line for 2級/3級.
//
// Listening (問2-6) is 25 of the 60 questions and 35 of the 100 points --
// by far the single biggest chunk, and the one skill this app can't drill
// with real past-exam audio (copyrighted). We substitute the browser's
// built-in Web Speech API (speechSynthesis) for listening practice -- free,
// no server, but a real accent/fluency gap vs. the actual test audio, so
// listening scores from this app should be read with that grain of salt.
//
// VOCAB_TARGET_COUNT (~2,650 words) is cited by one secondary source
// (unofficial, could not verify against a published 全商 word list) -- treated
// here as a working target, not a confirmed number.

const PASS_LINE_PCT = 70;
const VOCAB_TARGET_COUNT = 2650; // unverified secondary-source figure -- working target only
const EXAM_DATE = "2026-09-06";
const EXAM_DURATION_MINUTES = 90;

// Weights = share of the 100-point total, derived directly from the verified
// scoring breakdown above.
const SECTIONS = [
  { id: "accent", label: "発音・アクセント(問1)", weight: 0.05 },
  { id: "listening", label: "リスニング(問2〜6)", weight: 0.35 },
  { id: "vocab", label: "語彙・空所補充(問9)", weight: 0.10 },
  { id: "grammar", label: "文法・会話表現・語順整序(問8,11,12)", weight: 0.30 },
  { id: "reading", label: "長文読解(問7,10)", weight: 0.20 },
];

// The 12 question types in exam order, for building mock-exam layouts that
// mirror the real paper's structure.
const QUESTION_TYPES = [
  { num: 1, id: "accent", label: "発音・アクセント", items: 5, pointsEach: 1 },
  { num: 2, id: "listening", label: "リスニング:応答選択A", items: 5, pointsEach: 1 },
  { num: 3, id: "listening", label: "リスニング:応答選択B", items: 5, pointsEach: 1 },
  { num: 4, id: "listening", label: "リスニング:対話理解", items: 5, pointsEach: 1 },
  { num: 5, id: "listening", label: "リスニング:パッセージ理解", items: 5, pointsEach: 2 },
  { num: 6, id: "listening", label: "リスニング:長い対話理解", items: 5, pointsEach: 2 },
  { num: 7, id: "reading", label: "長文要約の空所補充", items: 5, pointsEach: 2 },
  { num: 8, id: "grammar", label: "対話文完成", items: 5, pointsEach: 2 },
  { num: 9, id: "vocab", label: "語彙空所補充", items: 5, pointsEach: 2 },
  { num: 10, id: "reading", label: "長文の空所補充", items: 5, pointsEach: 2 },
  { num: 11, id: "grammar", label: "同意文書きかえ", items: 5, pointsEach: 2 },
  { num: 12, id: "grammar", label: "語順整序", items: 5, pointsEach: 2 },
];

export { PASS_LINE_PCT, VOCAB_TARGET_COUNT, EXAM_DATE, EXAM_DURATION_MINUTES, SECTIONS, QUESTION_TYPES };
