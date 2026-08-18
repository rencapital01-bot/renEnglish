import { load, save } from "./storage.js";
import * as dashboard from "./views/dashboard.js";
import * as vocab from "./views/vocab.js";
import * as practice from "./views/practice.js";
import * as mockExam from "./views/mockExam.js";
import * as scheduleView from "./views/scheduleView.js";
import * as timetableView from "./views/timetableView.js";
import * as settings from "./views/settings.js";
import { EXAM_DATE } from "./data/examInfo.js";

const VIEWS = {
  dashboard: { label: "ダッシュボード", mod: dashboard },
  vocab: { label: "単語(SRS)", mod: vocab },
  practice: { label: "演習問題", mod: practice },
  mockexam: { label: "模擬試験", mod: mockExam },
  timetable: { label: "時間割", mod: timetableView },
  schedule: { label: "学習スケジュール", mod: scheduleView },
  settings: { label: "設定・バックアップ", mod: settings },
};

const state = load();
const main = document.getElementById("main");
const sidebar = document.getElementById("sidebar");
const navButtons = document.getElementById("nav-buttons");
let currentView = "dashboard";

function updateCountdown() {
  const el = document.getElementById("countdown");
  if (!el) return;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exam = new Date(EXAM_DATE + "T00:00:00");
  const days = Math.round((exam - today) / 86400000);
  el.innerHTML = `試験まで<strong>${days}日</strong>`;
}

function goto(view) {
  currentView = view;
  navButtons.querySelectorAll("button[data-view]").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === view);
  });
  window.scrollTo(0, 0);
  const ctx = { state, save: () => save(state), goto };
  VIEWS[view].mod.render(main, ctx);
}

document.addEventListener("DOMContentLoaded", () => {
  Object.entries(VIEWS).forEach(([id, v]) => {
    const btn = document.createElement("button");
    btn.dataset.view = id;
    btn.textContent = v.label;
    btn.addEventListener("click", () => goto(id));
    navButtons.appendChild(btn);
  });
  updateCountdown();
  setInterval(updateCountdown, 60 * 60 * 1000);
  goto("dashboard");
});
