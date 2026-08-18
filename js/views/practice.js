import { ACCENT_QUESTIONS, VOCAB_QUESTIONS, GRAMMAR_QUESTIONS, LISTENING_QUESTIONS, READING_PASSAGES } from "../data/questions.js";
import { save } from "../storage.js";

const CATEGORIES = [
  { id: "accent", label: "発音・アクセント", questions: () => ACCENT_QUESTIONS },
  { id: "vocab", label: "語彙空所補充", questions: () => VOCAB_QUESTIONS },
  { id: "grammar", label: "文法・会話表現・語順整序", questions: () => GRAMMAR_QUESTIONS },
  { id: "listening", label: "リスニング", questions: () => LISTENING_QUESTIONS },
  { id: "reading", label: "長文読解", questions: () => READING_PASSAGES.flatMap((p) => p.questions.map((q) => ({ ...q, passage: p }))) },
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function speak(text) {
  if (!("speechSynthesis" in window)) {
    alert("お使いのブラウザは音声読み上げに対応していません。テキストで代用してください。");
    return;
  }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "en-US";
  utter.rate = 0.95;
  window.speechSynthesis.speak(utter);
}

function render(container, ctx) {
  const { state } = ctx;

  function showMenu() {
    container.innerHTML = `
      <h2>演習問題</h2>
      <div class="grid-2">
        ${CATEGORIES.map(
          (c) => `<div class="card">
            <h3>${c.label}</h3>
            <p class="muted">${c.questions().length}問収録</p>
            <button class="primary" data-cat="${c.id}">この分野を演習する</button>
          </div>`
        ).join("")}
      </div>
      <p class="disclaimer">全12問の出題形式(問1〜12)は実際の全商英検1級の過去問構成に基づいていますが、問題文自体はオリジナルです。リスニングは著作権の関係で実際の試験音声を収録できないため、ブラウザの音声読み上げ機能で代用しています。</p>
    `;
    container.querySelectorAll("[data-cat]").forEach((btn) => {
      btn.addEventListener("click", () => runSession(btn.dataset.cat));
    });
  }

  function runSession(catId) {
    const cat = CATEGORIES.find((c) => c.id === catId);
    const questions = shuffle(cat.questions()).slice(0, 10);
    let idx = 0;
    let correctCount = 0;
    let answered = false;

    function drawQuestion() {
      if (idx >= questions.length) {
        container.innerHTML = `
          <h2>${cat.label} — 結果</h2>
          <div class="card">
            <p>正答: ${correctCount} / ${questions.length}問 (${Math.round((correctCount / questions.length) * 100)}%)</p>
            <button class="primary" data-action="back">分野選択に戻る</button>
          </div>
        `;
        container.querySelector("[data-action='back']").addEventListener("click", showMenu);
        return;
      }

      const q = questions[idx];
      answered = false;

      const passageHtml = q.passage ? `<div class="card"><p>${q.passage.text}</p></div>` : "";
      const audioHtml = q.audioText
        ? `<button class="secondary" data-action="play">🔊 音声を再生</button><p class="muted" style="margin-top:8px;">(テキスト非表示。聞き取れなければ再生ボタンをもう一度押してください)</p>`
        : "";

      container.innerHTML = `
        <h2>${cat.label} <span class="tag">${idx + 1} / ${questions.length}</span></h2>
        ${passageHtml}
        <div class="card question-block">
          ${audioHtml}
          <p style="white-space:pre-line; font-size:16px; margin-top:${q.audioText ? "14px" : "0"};">${q.prompt}</p>
          <div id="choices"></div>
          <div id="explain" class="disclaimer" style="display:none;"></div>
          <button class="primary" id="nextBtn" style="display:none; margin-top:10px;">次の問題へ</button>
        </div>
      `;

      const choicesEl = container.querySelector("#choices");
      q.choices.forEach((choice, i) => {
        const btn = document.createElement("button");
        btn.className = "choice";
        btn.textContent = choice;
        btn.addEventListener("click", () => {
          if (answered) return;
          answered = true;
          const correct = i === q.answerIndex;
          if (correct) correctCount++;
          btn.classList.add(correct ? "correct" : "incorrect");
          if (!correct) {
            choicesEl.children[q.answerIndex].classList.add("correct");
          }
          state.practiceAttempts.push({ ts: Date.now(), category: cat.id, questionId: q.id, correct });
          if (state.practiceAttempts.length > 2000) state.practiceAttempts.shift();
          save(state);
          if (q.explanation) {
            const ex = container.querySelector("#explain");
            ex.style.display = "block";
            ex.textContent = q.explanation;
          }
          container.querySelector("#nextBtn").style.display = "inline-block";
        });
        choicesEl.appendChild(btn);
      });

      if (q.audioText) {
        container.querySelector("[data-action='play']").addEventListener("click", () => speak(q.audioText));
      }
      container.querySelector("#nextBtn").addEventListener("click", () => {
        idx++;
        drawQuestion();
      });
    }

    drawQuestion();
  }

  showMenu();
}

export { render };
