import { save, exportJSON, importJSON, defaultState } from "../storage.js";

function render(container, ctx) {
  const { state } = ctx;

  container.innerHTML = `
    <h2>設定・バックアップ</h2>

    <div class="card">
      <h3>学習時間の設定</h3>
      <p class="muted">平日・休日それぞれ1日に使える学習時間(時間)。変更するとスケジュールが再計算されます。</p>
      <div class="grid-2">
        <div>
          <label class="muted">平日(時間/日)</label>
          <input type="text" id="weekdayHours" value="${state.profile.weekdayHours}">
        </div>
        <div>
          <label class="muted">休日(時間/日)</label>
          <input type="text" id="weekendHours" value="${state.profile.weekendHours}">
        </div>
      </div>
      <button class="primary" id="saveProfile" style="margin-top:12px;">保存</button>
    </div>

    <div class="card">
      <h3>データのバックアップ</h3>
      <p class="muted">このアプリのデータはブラウザ内(localStorage)にのみ保存されます。別の端末やブラウザで使う場合や、うっかりデータを消してしまった場合に備えて、定期的にバックアップをおすすめします。</p>
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <button class="secondary" id="exportBtn">JSONでエクスポート</button>
        <label class="secondary" style="display:inline-flex; align-items:center; cursor:pointer;">
          JSONをインポート
          <input type="file" id="importInput" accept="application/json" style="display:none;">
        </label>
      </div>
      <p class="disclaimer" id="importMsg"></p>
    </div>

    <div class="card">
      <h3>公開先について</h3>
      <p class="muted">このアプリはサーバーもログインも使わない「静的サイト」なので、公開してもデータが外部に送信されることはありません(進捗はあなたの端末のブラウザだけに保存されます)。スマホなど別端末から使う場合、進捗はその端末のブラウザ内に別々に保存される点にご注意ください(端末間で自動同期はしません)。端末を変える場合は上のエクスポート/インポートで手動移行してください。</p>
    </div>

    <div class="card">
      <h3>データを初期化</h3>
      <p class="muted">すべての学習データ(単語の進捗・演習履歴・模試結果)を削除して最初からやり直します。元に戻せません。</p>
      <button class="secondary" id="resetBtn" style="color:var(--bad); border-color:var(--bad);">初期化する</button>
    </div>
  `;

  container.querySelector("#saveProfile").addEventListener("click", () => {
    const wd = parseFloat(container.querySelector("#weekdayHours").value);
    const we = parseFloat(container.querySelector("#weekendHours").value);
    if (!isNaN(wd) && wd > 0) state.profile.weekdayHours = wd;
    if (!isNaN(we) && we > 0) state.profile.weekendHours = we;
    save(state);
    ctx.goto("dashboard");
  });

  container.querySelector("#exportBtn").addEventListener("click", () => exportJSON(state));

  container.querySelector("#importInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    importJSON(file, (err) => {
      const msg = container.querySelector("#importMsg");
      if (err) {
        msg.textContent = "インポートに失敗しました。ファイルが壊れている可能性があります。";
      } else {
        msg.textContent = "インポートしました。反映するため再読み込みします...";
        setTimeout(() => window.location.reload(), 800);
      }
    });
  });

  container.querySelector("#resetBtn").addEventListener("click", () => {
    if (!confirm("本当にすべてのデータを削除しますか？この操作は元に戻せません。")) return;
    const fresh = defaultState();
    fresh.profile.startDate = state.profile.startDate;
    save(fresh);
    window.location.reload();
  });
}

export { render };
