import { WEEKDAY_LABELS, toHHMM, generateTimetable, toggleDone, computeCompletionWeights, dayOfWeek } from "../timetable.js";
import { BLOCK_LABELS } from "../schedule.js";
import { save, todayISO } from "../storage.js";

function uid() {
  return "e" + Math.random().toString(36).slice(2, 9);
}

function render(container, ctx) {
  const { state } = ctx;
  let selectedDow = dayOfWeek(todayISO());

  function draw() {
    const events = (state.fixedSchedule[selectedDow] || []).slice().sort((a, b) => a.start.localeCompare(b.start));
    const today = todayISO();
    const result = generateTimetable(state, today);
    const weights = computeCompletionWeights(state);
    const worst = Object.entries(weights).sort((a, b) => a[1] - b[1])[0];

    container.innerHTML = `
      <h2>時間割</h2>

      <div class="card">
        <h3>学習可能時間帯</h3>
        <p class="muted">この範囲の中の空き時間に学習ブロックを自動で当てはめます。</p>
        <div class="grid-2">
          <div>
            <label class="muted">起床(学習開始できる最早時刻)</label>
            <input type="time" id="dayStart" value="${state.profile.dayStart}">
          </div>
          <div>
            <label class="muted">就寝(学習を終える最終時刻)</label>
            <input type="time" id="dayEnd" value="${state.profile.dayEnd}">
          </div>
        </div>
        <button class="secondary" id="saveDayRange" style="margin-top:10px;">保存</button>
      </div>

      <div class="card">
        <h3>毎週の固定予定</h3>
        <p class="muted">学校・部活・アルバイトなど、決まった時間に必ずある予定を曜日ごとに登録してください。</p>
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px;">
          ${WEEKDAY_LABELS.map((label, i) => `<button class="secondary dow-btn" data-dow="${i}" style="${i === selectedDow ? "background:var(--accent);color:white;border-color:var(--accent);" : ""}">${label}</button>`).join("")}
        </div>
        <div id="eventList">
          ${
            events.length === 0
              ? `<p class="muted">${WEEKDAY_LABELS[selectedDow]}曜日の固定予定はまだ登録されていません。</p>`
              : events
                  .map(
                    (e) => `<div class="day-block">
                      <span>${e.start} - ${e.end} ${e.label}</span>
                      <button class="secondary" data-del="${e.id}" style="padding:4px 10px;">削除</button>
                    </div>`
                  )
                  .join("")
          }
        </div>
        <div class="grid-2" style="margin-top:14px;">
          <div>
            <label class="muted">予定名(例: 学校, 部活, バイト)</label>
            <input type="text" id="evLabel" placeholder="学校">
          </div>
          <div style="display:flex; gap:8px;">
            <div style="flex:1;">
              <label class="muted">開始</label>
              <input type="time" id="evStart" value="08:00">
            </div>
            <div style="flex:1;">
              <label class="muted">終了</label>
              <input type="time" id="evEnd" value="15:00">
            </div>
          </div>
        </div>
        <button class="primary" id="addEvent" style="margin-top:10px;">${WEEKDAY_LABELS[selectedDow]}曜日に追加</button>
      </div>

      <div class="card">
        <h3>今日の時間割 (${today})</h3>
        ${
          result.outOfRange
            ? `<p class="muted">学習期間の範囲外です。</p>`
            : result.blocks.length === 0
              ? `<p class="muted">空き時間が見つかりませんでした。学習可能時間帯や固定予定を見直してください。</p>`
              : result.blocks
                  .map((b) => {
                    if (b.fixed) {
                      return `<div class="day-block"><span class="tag">${toHHMM(b.start)}-${toHHMM(b.end)}</span> <span class="muted">${b.label}(固定)</span></div>`;
                    }
                    return `<div class="day-block">
                      <label style="display:flex; align-items:center; gap:10px; cursor:pointer; width:100%;">
                        <input type="checkbox" data-toggle="${b.start}|${b.type}" ${b.done ? "checked" : ""}>
                        <span class="tag">${toHHMM(b.start)}-${toHHMM(b.end)}</span>
                        <span style="${b.done ? "text-decoration:line-through;opacity:.6;" : ""}">${b.label} (${b.minutes}分)</span>
                      </label>
                    </div>`;
                  })
                  .join("")
        }
        ${
          worst
            ? `<p class="disclaimer">直近2週間の記録では「${BLOCK_LABELS[worst[0]] || worst[0]}」の実行率が低めです。今後の時間割ではこの分野の配分をやや減らし、他の分野に回しています。時間帯を変えてみるのも効果的です。</p>`
            : `<p class="disclaimer">チェックを付けた記録が増えると、実際にこなせている分野・こなせていない分野を見て、次回以降の時間配分を自動調整します。</p>`
        }
      </div>
    `;

    container.querySelectorAll(".dow-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedDow = Number(btn.dataset.dow);
        draw();
      });
    });

    container.querySelector("#saveDayRange").addEventListener("click", () => {
      state.profile.dayStart = container.querySelector("#dayStart").value || state.profile.dayStart;
      state.profile.dayEnd = container.querySelector("#dayEnd").value || state.profile.dayEnd;
      save(state);
      draw();
    });

    container.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.fixedSchedule[selectedDow] = state.fixedSchedule[selectedDow].filter((e) => e.id !== btn.dataset.del);
        save(state);
        draw();
      });
    });

    container.querySelector("#addEvent").addEventListener("click", () => {
      const label = container.querySelector("#evLabel").value.trim();
      const start = container.querySelector("#evStart").value;
      const end = container.querySelector("#evEnd").value;
      if (!label || !start || !end || start >= end) {
        alert("予定名・開始時刻・終了時刻を正しく入力してください(終了は開始より後にしてください)。");
        return;
      }
      if (!state.fixedSchedule[selectedDow]) state.fixedSchedule[selectedDow] = [];
      state.fixedSchedule[selectedDow].push({ id: uid(), label, start, end });
      save(state);
      draw();
    });

    container.querySelectorAll("[data-toggle]").forEach((cb) => {
      cb.addEventListener("change", () => {
        const [start, type] = cb.dataset.toggle.split("|");
        toggleDone(state, today, Number(start), type);
        draw();
      });
    });
  }

  draw();
}

export { render };
