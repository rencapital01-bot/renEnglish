import { ACCENT_QUESTIONS, VOCAB_QUESTIONS, GRAMMAR_QUESTIONS, LISTENING_QUESTIONS, READING_PASSAGES } from "../data/questions.js";
import { SECTIONS } from "../data/examInfo.js";
import { save } from "../storage.js";

// The real exam is 90 min / 60 questions (1.5 min/question). This mock scales
// that ratio down to 40 questions (~60 min) so the current question bank can
// fill it without repeats, while keeping each section's share of the test
// proportional to its real point-weight in SECTIONS.
const MOCK_SIZE = 40;
const TIME_LIMIT_SEC = 60 * 60;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildMock() {
  const readingQs = shuffle(READING_PASSAGES.flatMap((p) => p.questions.map((q) => ({ ...q, passage: p }))));
  const pools = {
    accent: shuffle(ACCENT_QUESTIONS),
    listening: shuffle(LISTENING_QUESTIONS),
    vocab: shuffle(VOCAB_QUESTIONS),
    grammar: shuffle(GRAMMAR_QUESTIONS),
    reading: readingQs,
  };
  const picks = [];
  for (const s of SECTIONS) {
    const n = Math.max(1, Math.round(MOCK_SIZE * s.weight));
    picks.push(...pools[s.id].slice(0, n));
  }
  return shuffle(picks).slice(0, MOCK_SIZE);
}

function render(container, ctx) {
  const { state } = ctx;

  container.innerHTML = `
    <h2>模擬試験</h2>
    <div class="card">
      <p>本番と同じ12問構成の配点比率に基づき、${MOCK_SIZE}問・約${Math.round(TIME_LIMIT_SEC / 60)}分の模試を生成します。時間内にできるだけ多く解答してください。制限時間を過ぎると自動的に採点されます。</p>
      <p class="disclaimer">問題そのものはオリジナル作成です(過去問そのままではありません)。リスニングはブラウザの音声読み上げで代用しています。あくまで実力の目安として使ってください。</p>
      <button class="primary" id="startBtn">模擬試験を開始する</button>
    </div>
  `;

  container.querySelector("#startBtn").addEventListener("click", startExam);

  function startExam() {
    const questions = buildMock();
    let idx = 0;
    const answers = new Array(questions.length).fill(null);
    let remaining = TIME_LIMIT_SEC;
    let timerId = null;

    function fmtTime(sec) {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return `${m}:${String(s).padStart(2, "0")}`;
    }

    function drawQuestion() {
      const q = questions[idx];
      const passageHtml = q.passage ? `<div class="card"><p>${q.passage.text}</p></div>` : "";
      const audioHtml = q.audioText ? `<button class="secondary" data-action="play">🔊 音声を再生</button>` : "";

      container.innerHTML = `
        <h2>模擬試験 <span class="tag">${idx + 1} / ${questions.length}</span> <span class="tag warn" id="timer">${fmtTime(remaining)}</span></h2>
        ${passageHtml}
        <div class="card question-block">
          ${audioHtml}
          <p style="white-space:pre-line; font-size:16px; margin-top:${q.audioText ? "14px" : "0"};">${q.prompt}</p>
          <div id="choices"></div>
        </div>
        <div style="display:flex; gap:10px;">
          <button class="secondary" id="prevBtn" ${idx === 0 ? "disabled" : ""}>前へ</button>
          <button class="primary" id="nextBtn">${idx === questions.length - 1 ? "採点する" : "次へ"}</button>
        </div>
      `;

      const choicesEl = container.querySelector("#choices");
      q.choices.forEach((choice, i) => {
        const btn = document.createElement("button");
        btn.className = "choice";
        if (answers[idx] === i) btn.classList.add("selected");
        btn.textContent = choice;
        btn.addEventListener("click", () => {
          answers[idx] = i;
          Array.from(choicesEl.children).forEach((c) => c.classList.remove("selected"));
          btn.classList.add("selected");
        });
        choicesEl.appendChild(btn);
      });

      if (q.audioText) {
        container.querySelector("[data-action='play']").addEventListener("click", () => {
          if (!("speechSynthesis" in window)) return;
          window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(q.audioText);
          u.lang = "en-US";
          u.rate = 0.95;
          window.speechSynthesis.speak(u);
        });
      }

      container.querySelector("#prevBtn").addEventListener("click", () => {
        idx--;
        drawQuestion();
      });
      container.querySelector("#nextBtn").addEventListener("click", () => {
        if (idx === questions.length - 1) {
          finish();
        } else {
          idx++;
          drawQuestion();
        }
      });
    }

    timerId = setInterval(() => {
      remaining--;
      const t = container.querySelector("#timer");
      if (t) t.textContent = fmtTime(Math.max(0, remaining));
      if (remaining <= 0) {
        clearInterval(timerId);
        finish();
      }
    }, 1000);

    function finish() {
      clearInterval(timerId);
      const sectionTotals = {};
      const sectionCorrect = {};
      questions.forEach((q, i) => {
        sectionTotals[q.category] = (sectionTotals[q.category] || 0) + 1;
        if (answers[i] === q.answerIndex) sectionCorrect[q.category] = (sectionCorrect[q.category] || 0) + 1;
        state.practiceAttempts.push({ ts: Date.now(), category: q.category, questionId: q.id, correct: answers[i] === q.answerIndex });
      });
      const sectionScores = {};
      for (const s of SECTIONS) {
        sectionScores[s.id] = sectionTotals[s.id] ? Math.round((100 * (sectionCorrect[s.id] || 0)) / sectionTotals[s.id]) : null;
      }
      const totalCorrect = questions.filter((q, i) => answers[i] === q.answerIndex).length;
      const totalPct = Math.round((100 * totalCorrect) / questions.length);

      state.mockExams.push({ ts: Date.now(), totalPct, sectionScores });
      if (state.practiceAttempts.length > 2000) state.practiceAttempts.splice(0, state.practiceAttempts.length - 2000);
      save(state);

      container.innerHTML = `
        <h2>模擬試験 結果</h2>
        <div class="card">
          <div class="stat"><div class="num">${totalPct}%</div><div class="label">総合正答率 (合格ライン目安: 70%)</div></div>
        </div>
        <div class="card">
          <h3>分野別</h3>
          <table>
            <thead><tr><th>分野</th><th>正答率</th></tr></thead>
            <tbody>
              ${SECTIONS.map((s) => `<tr><td>${s.label}</td><td>${sectionScores[s.id] === null ? "-" : sectionScores[s.id] + "%"}</td></tr>`).join("")}
            </tbody>
          </table>
        </div>
        <button class="primary" data-goto="dashboard">ダッシュボードに戻る</button>
      `;
      container.querySelector("[data-goto]").addEventListener("click", () => ctx.goto("dashboard"));
    }

    drawQuestion();
  }
}

export { render };
