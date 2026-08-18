import { WORDS } from "../data/words.js";
import { newCard, review, dueCards, isDue } from "../srs.js";
import { save, logMinutes } from "../storage.js";

const NEW_WORDS_PER_SESSION = 20;
const wordById = Object.fromEntries(WORDS.map((w) => [w.id, w]));

function buildQueue(state) {
  const allIds = WORDS.map((w) => w.id);
  const due = dueCards(state.vocab, allIds).filter((id) => state.vocab[id]); // already-seen cards that are due
  const notSeen = allIds.filter((id) => !state.vocab[id]);
  const newBatch = notSeen.slice(0, NEW_WORDS_PER_SESSION);
  // Interleave: review due cards mixed with a few new ones rather than all-new-then-all-review.
  return shuffle([...due, ...newBatch]);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function render(container, ctx) {
  const { state } = ctx;
  const queue = buildQueue(state);
  let idx = 0;
  let revealed = false;
  let sessionDone = 0;

  function currentWord() {
    return wordById[queue[idx]];
  }

  function draw() {
    if (idx >= queue.length) {
      container.innerHTML = `
        <h2>単語学習(間隔反復)</h2>
        <div class="card">
          <p>今回のセッションは完了しました。お疲れさまでした。${sessionDone}枚のカードを学習しました。</p>
          <button class="primary" data-action="restart">もう一度セッションを開始</button>
        </div>
      `;
      container.querySelector("[data-action='restart']").addEventListener("click", () => render(container, ctx));
      return;
    }

    const w = currentWord();
    const isNew = !state.vocab[w.id];

    container.innerHTML = `
      <h2>単語学習(間隔反復) <span class="tag">残り ${queue.length - idx}枚</span> ${isNew ? '<span class="tag warn">新出</span>' : '<span class="tag good">復習</span>'}</h2>
      <div class="card flashcard">
        <div class="meta">${w.pos}</div>
        <div class="word">${w.en}</div>
        <div class="kana">${w.kana}</div>
        <div class="answer">${revealed ? w.ja : "&nbsp;"}</div>
        <div class="muted" style="margin-top:14px;">${revealed ? w.example : ""}</div>
        ${
          revealed
            ? `<div class="srs-buttons">
                 <button class="again" data-q="2">もう一度<br><span style="font-size:11px;opacity:.8">Again</span></button>
                 <button class="good" data-q="4">できた<br><span style="font-size:11px;opacity:.8">Good</span></button>
                 <button class="easy" data-q="5">簡単<br><span style="font-size:11px;opacity:.8">Easy</span></button>
               </div>`
            : `<button class="primary" data-action="reveal" style="margin-top:20px;">答えを見る</button>`
        }
      </div>
      <p class="disclaimer">意味を声に出す・紙に書くなど、見る前に自分で思い出そうとする(アクティブリコール)ことが記憶定着に最も効果的です。</p>
    `;

    if (revealed) {
      container.querySelectorAll("[data-q]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const quality = Number(btn.dataset.q);
          const prev = state.vocab[w.id] || newCard();
          state.vocab[w.id] = review(prev, quality);
          save(state);
          sessionDone++;
          idx++;
          revealed = false;
          draw();
        });
      });
    } else {
      container.querySelector("[data-action='reveal']").addEventListener("click", () => {
        revealed = true;
        draw();
      });
    }
  }

  draw();
  logMinutes(state, 0); // touch studyLog key for today so streak tracking has an entry
}

export { render };
