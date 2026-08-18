import { generateSchedule } from "../schedule.js";
import { todayISO } from "../srs.js";

function fmtDate(iso) {
  const d = new Date(iso + "T00:00:00");
  const wd = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()}(${wd})`;
}

function render(container, ctx) {
  const { state } = ctx;
  const schedule = generateSchedule(state);
  const today = todayISO();

  container.innerHTML = `
    <h2>学習スケジュール</h2>
    <p class="muted">開始日から試験日(2026-09-06)までの全${schedule.length}日分。フェーズは「基礎固め → 応用・読解強化 → 仕上げ・本番シミュレーション」の3段階です。</p>
    <div id="days"></div>
  `;

  const daysEl = container.querySelector("#days");
  schedule.forEach((day) => {
    const isToday = day.date === today;
    const card = document.createElement("div");
    card.className = "card";
    if (isToday) card.style.borderColor = "var(--accent)";
    card.innerHTML = `
      <h3>${fmtDate(day.date)} ${isToday ? '<span class="tag good">今日</span>' : ""} ${day.isExamDay ? '<span class="tag bad">試験当日</span>' : ""}
        <span class="tag">${day.phaseLabel}</span> <span class="tag">${day.isWeekend ? "休日" : "平日"} ${Math.round(day.totalMinutes / 60)}h</span>
      </h3>
      ${day.blocks.map((b) => `<div class="day-block"><span>${b.label}</span><span>${b.minutes}分</span></div>`).join("")}
    `;
    daysEl.appendChild(card);
  });
}

export { render };
