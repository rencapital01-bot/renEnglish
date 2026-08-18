// Shared rendering for a generated timetable's block list (fixed events,
// breaks, and checkable study blocks). Used by both the dashboard's "today"
// summary and the full 時間割 view so they always show the same thing.

import { toHHMM, toggleDone } from "../timetable.js";
import { save } from "../storage.js";

function timetableListHTML(result) {
  if (result.outOfRange) return `<p class="muted">学習期間の範囲外です。</p>`;
  if (result.blocks.length === 0) return `<p class="muted">空き時間が見つかりませんでした。学習可能時間帯や固定予定を「時間割」画面で見直してください。</p>`;

  return result.blocks
    .map((b) => {
      if (b.fixed) {
        return `<div class="day-block"><span class="tag">${toHHMM(b.start)}-${toHHMM(b.end)}</span> <span class="muted">${b.label}(固定)</span></div>`;
      }
      if (b.isBreak) {
        return `<div class="day-block"><span class="tag">${toHHMM(b.start)}-${toHHMM(b.end)}</span> <span class="muted">☕ ${b.label}</span></div>`;
      }
      return `<div class="day-block">
        <label style="display:flex; align-items:center; gap:10px; cursor:pointer; width:100%;">
          <input type="checkbox" data-toggle="${b.start}|${b.type}" ${b.done ? "checked" : ""}>
          <span class="tag">${toHHMM(b.start)}-${toHHMM(b.end)}</span>
          <span style="${b.done ? "text-decoration:line-through;opacity:.6;" : ""}">${b.label} (${b.minutes}分)</span>
        </label>
      </div>`;
    })
    .join("");
}

function wireTimetableCheckboxes(container, state, dateISO, onChange) {
  container.querySelectorAll("[data-toggle]").forEach((cb) => {
    cb.addEventListener("change", () => {
      const [start, type] = cb.dataset.toggle.split("|");
      toggleDone(state, dateISO, Number(start), type);
      save(state);
      if (onChange) onChange();
    });
  });
}

export { timetableListHTML, wireTimetableCheckboxes };
