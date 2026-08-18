import { WORDS } from "../data/words.js";
import { newCard, review, dueCards } from "../srs.js";
import { save, logMinutes } from "../storage.js";

const NEW_WORDS_PER_SESSION = 10;
const REQUEUE_OFFSET = 4; // how many cards later a missed word resurfaces in the same session
const wordById = Object.fromEntries(WORDS.map((w) => [w.id, w]));

function buildQueue(state) {
  const allIds = WORDS.map((w) => w.id);
  const due = dueCards(state.vocab, allIds).filter((id) => state.vocab[id]); // already-seen cards that are due

  // Words marked "Again" last time are weak spots -- surface them first,
  // ahead of other due reviews and ahead of new words, per the user's ask
  // to have missed words prioritized rather than just cycled in normally.
  const weak = due.filter((id) => state.vocab[id].lastResult === "again");
  const otherDue = due.filter((id) => state.vocab[id].lastResult !== "again");

  const notSeen = allIds.filter((id) => !state.vocab[id]);
  const newBatch = notSeen.slice(0, NEW_WORDS_PER_SESSION);

  // Weak words go in front (still shuffled among themselves so it's not
  // always the exact same order); the rest interleaves review + new cards.
  return [...shuffle(weak), ...shuffle([...otherDue, ...newBatch])];
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
  let typedAnswer = "";

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
    const isWeak = !isNew && state.vocab[w.id].lastResult === "again";

    container.innerHTML = `
      <h2>単語学習(間隔反復) <span class="tag">残り ${queue.length - idx}枚</span> ${
        isWeak ? '<span class="tag bad">苦手</span>' : isNew ? '<span class="tag warn">新出</span>' : '<span class="tag good">復習</span>'
      }</h2>
      <div class="card flashcard">
        <div class="meta">${w.pos}</div>
        <div class="word">${w.en}</div>
        <div class="kana">${w.kana}</div>
        ${
          revealed
            ? `<div class="muted" style="margin-top:6px;">あなたの回答: ${typedAnswer ? typedAnswer : "(未入力)"}</div>
               <div class="answer">${w.ja}</div>
               <div class="muted" style="margin-top:14px;">${w.example}</div>`
            : `<input type="text" id="answerInput" placeholder="意味を日本語で入力(任意)" style="max-width:320px; margin:16px auto 0; display:block;">`
        }
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
      <p class="disclaimer">正解を見る前に、上の欄に意味を入力してから確認すると記憶に残りやすくなります(アクティブリコール)。「もう一度」を選んだ単語は、この後のセッション内でもう一度出題されます。</p>
    `;

    if (revealed) {
      container.querySelectorAll("[data-q]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const quality = Number(btn.dataset.q);
          const prev = state.vocab[w.id] || newCard();
          state.vocab[w.id] = review(prev, quality);
          save(state);
          sessionDone++;

          if (quality < 3) {
            // Missed it -- resurface this word again later in the same
            // session instead of only relying on tomorrow's SRS due date.
            const reinsertAt = Math.min(queue.length, idx + 1 + REQUEUE_OFFSET);
            queue.splice(reinsertAt, 0, w.id);
          }

          idx++;
          revealed = false;
          typedAnswer = "";
          draw();
        });
      });
    } else {
      const input = container.querySelector("#answerInput");
      input.addEventListener("input", () => {
        typedAnswer = input.value;
      });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") container.querySelector("[data-action='reveal']").click();
      });
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
