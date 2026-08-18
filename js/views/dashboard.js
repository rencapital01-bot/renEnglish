import { computePassProbability } from "../passProbability.js";
import { generateTimetable } from "../timetable.js";
import { masteredCount, dueCards } from "../srs.js";
import { WORDS } from "../data/words.js";
import { SECTIONS, EXAM_DATE } from "../data/examInfo.js";
import { todayISO } from "../storage.js";
import { timetableListHTML, wireTimetableCheckboxes } from "./timetableRender.js";

function daysUntilExam() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exam = new Date(EXAM_DATE + "T00:00:00");
  return Math.round((exam - today) / 86400000);
}

function confidenceLabel(c) {
  return { low: "低い(演習データがまだ少ない)", medium: "中程度", high: "高い(模試の実績あり)" }[c];
}

function render(container, ctx) {
  const { state } = ctx;
  const days = daysUntilExam();
  const pp = computePassProbability(state);
  const today = todayISO();
  const timetableResult = generateTimetable(state, today);
  const wordIds = WORDS.map((w) => w.id);
  const due = dueCards(state.vocab, wordIds).length;
  const mastered = masteredCount(state.vocab);
  const weakCount = Object.values(state.vocab).filter((c) => c.lastResult === "again").length;

  const pctInt = Math.round(pp.passProbability * 100);
  const barColor = pctInt >= 70 ? "var(--good)" : pctInt >= 45 ? "var(--warn)" : "var(--bad)";

  container.innerHTML = `
    <h2>ダッシュボード</h2>

    <div class="grid-2">
      <div class="card">
        <h3>試験まで</h3>
        <div class="stat"><div class="num">${days}</div><div class="label">日 (2026年9月6日 全商英検1級)</div></div>
      </div>
      <div class="card">
        <h3>合格予測(目安)</h3>
        <div class="stat"><div class="num" style="color:${barColor}">${pctInt}%</div><div class="label">信頼度: ${confidenceLabel(pp.confidence)}</div></div>
        <div class="progress-bar" style="margin-top:10px"><div style="width:${pctInt}%;background:${barColor}"></div></div>
        <p class="disclaimer">これは学習の進み具合から計算した目安の数値であり、本番の合否を保証するものではありません。模試を受けるほど精度が上がります。</p>
      </div>
    </div>

    <div class="card">
      <h3>分野別の状況</h3>
      <div class="table-scroll">
        <table>
          <thead><tr><th>分野</th><th>配点比率</th><th>正答率(直近)</th></tr></thead>
          <tbody>
            ${SECTIONS.map((s) => {
              const acc = pp.breakdown.sectionAcc[s.id];
              const accLabel = acc === null || acc === undefined ? "データなし" : Math.round(acc * 100) + "%";
              return `<tr><td>${s.label}</td><td>${Math.round(s.weight * 100)}%</td><td>${accLabel}</td></tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>

    <div class="grid-4">
      <div class="card stat">
        <div class="num">${mastered}</div>
        <div class="label">単語マスター済み (全${WORDS.length}語中)</div>
      </div>
      <div class="card stat">
        <div class="num">${due}</div>
        <div class="label">本日復習すべき単語</div>
      </div>
      <div class="card stat">
        <div class="num" style="${weakCount > 0 ? "color:var(--bad)" : ""}">${weakCount}</div>
        <div class="label">苦手な単語(優先的に出題)</div>
      </div>
      <div class="card stat">
        <div class="num">${pp.breakdown.mockCount}</div>
        <div class="label">受験した模擬試験の回数</div>
      </div>
    </div>

    <div class="card">
      <h3>今日の時間割 (${timetableResult.phaseLabel || "-"})</h3>
      ${timetableListHTML(timetableResult)}
      <div style="margin-top:14px; display:flex; gap:10px; flex-wrap:wrap;">
        <button class="primary" data-goto="vocab">単語復習を始める (${due}件)</button>
        <button class="secondary" data-goto="practice">演習問題を解く</button>
        <button class="secondary" data-goto="mockexam">模擬試験を受ける</button>
        <button class="secondary" data-goto="timetable">固定予定を編集する</button>
      </div>
    </div>
  `;

  container.querySelectorAll("[data-goto]").forEach((btn) => {
    btn.addEventListener("click", () => ctx.goto(btn.dataset.goto));
  });
  wireTimetableCheckboxes(container, state, today, () => render(container, ctx));
}

export { render };
