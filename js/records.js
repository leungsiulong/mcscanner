/* =========================================================
   records.js

   成績查詢 / 學生詳情 / 記錄編輯 / CSV 匯出

   選項分佈：
   1. 成績查詢提供獨立頁面入口。
   2. 每題一列，ABCD 各佔一欄。
   3. 正確選項整格綠色高亮並顯示 ✓。
   4. 格內顯示百分比、人數及比例橫條。
   5. 支援本班 / 全級及試卷選擇。
   6. 同一學生同一試卷只計最新記錄。
   7. 固定表頭與題號，支援橫向捲動。

   沿用現有專案的共用變數及函式。
   新頁面、入口按鈕及 CSS 由本檔案建立。
   ========================================================= */


/* =========================================================
   共用工具
   ========================================================= */

function recHTML(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function recFindById(id) {
  return records.find(rec => {
    return String(rec.id) === String(id);
  }) || null;
}

function recGetQuestionCount(rec) {
  const declared = parseInt(rec && rec.totalQ, 10);

  if (Number.isFinite(declared) && declared > 0) {
    return Math.min(80, declared);
  }

  return Math.min(
    80,
    String((rec && rec.ans) || '').length
  );
}

function recScoreAnswers(answers, answerKey) {
  let correct = 0;
  let keyCount = 0;

  const keys = answerKey || [];

  for (let i = 0; i < answers.length; i++) {
    const key = keys[i] || '';

    if (!key) continue;

    keyCount++;

    if (isAnswerCorrect(answers[i] || '', key)) {
      correct++;
    }
  }

  return {
    correct,
    keyCount,
    score: keyCount ? `${correct}/${keyCount}` : '-',
    percentage: keyCount
      ? Math.round(correct / keyCount * 100) + '%'
      : '-'
  };
}

function recCSVCell(value) {
  return '"' +
    String(value == null ? '' : value)
      .replace(/"/g, '""') +
    '"';
}

function recDownloadCSV(content, filename) {
  const blob = new Blob([content], {
    type: 'text/csv;charset=utf-8;'
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1500);
}


/* =========================================================
   選項分佈：頁面狀態
   ========================================================= */

const REC_DISTRIBUTION_PAGE_ID = 'recordDistributionPage';

let recDistributionContext = null;
let recDistributionPaperId = '';
let recDistributionScope = 'class';


/* =========================================================
   選項分佈：CSS
   ========================================================= */

function installRecDistributionStyles() {
  if (document.getElementById('recDistributionStyles')) {
    return;
  }

  const style = document.createElement('style');

  style.id = 'recDistributionStyles';

  style.textContent = `
    #recTabsArea button.tab-pill {
      font-family: var(--font);
    }

    /* ===== 獨立頁面 ===== */

    #recordDistributionPage .rd-body {
      max-width: 1320px;
      min-width: 0;
      padding-bottom: 48px;
    }

    #recordDistributionPage .rd-intro {
      background:
        linear-gradient(
          135deg,
          rgba(var(--p), .055),
          transparent 55%
        ),
        var(--bg1);
    }

    #recordDistributionPage .rd-heading {
      display: flex;
      align-items: center;
      gap: 13px;
      margin-bottom: 22px;
    }

    #recordDistributionPage .rd-heading-icon {
      width: 46px;
      height: 46px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 15px;
      font-size: 1.3em;
      background: rgba(var(--p), .12);
      border: 1px solid rgba(var(--p), .2);
    }

    #recordDistributionPage .rd-heading-title {
      color: var(--text);
      font-size: 1.14em;
      font-weight: 800;
      letter-spacing: -.025em;
    }

    #recordDistributionPage .rd-heading-desc {
      margin-top: 4px;
      color: var(--text3);
      font-size: .74em;
      line-height: 1.7;
    }

    /* ===== 工具列 ===== */

    #recordDistributionPage .rd-toolbar {
      display: flex;
      align-items: flex-end;
      flex-wrap: wrap;
      gap: 14px;
      margin-bottom: 14px;
    }

    #recordDistributionPage .rd-field {
      flex: 1;
      min-width: 240px;
    }

    #recordDistributionPage .rd-field label {
      display: block;
      padding-left: 2px;
      margin-bottom: 7px;
      color: var(--text3);
      font-size: .7em;
      font-weight: 700;
    }

    #recordDistributionPage .rd-field select {
      width: 100%;
      min-width: 0;
      text-overflow: ellipsis;
    }

    #recordDistributionPage .rd-scope {
      display: flex;
      gap: 4px;
      padding: 4px;
      max-width: 100%;
      background: var(--dark-fill);
      border: 1px solid var(--border);
      border-radius: 12px;
    }

    #recordDistributionPage .rd-scope button {
      padding: 10px 17px;
      border: none;
      border-radius: 9px;
      background: transparent;
      color: var(--text3);
      font-family: var(--font);
      font-size: .77em;
      font-weight: 700;
      white-space: nowrap;
      cursor: pointer;
      transition: all .22s var(--ease);
    }

    #recordDistributionPage .rd-scope button:hover:not(:disabled) {
      background: var(--white-alpha-04);
      color: var(--text);
    }

    #recordDistributionPage .rd-scope button.active {
      background: var(--grad1);
      color: #fff;
      box-shadow: 0 4px 15px rgba(var(--p), .24);
    }

    #recordDistributionPage .rd-scope button:disabled {
      opacity: .4;
      cursor: not-allowed;
    }

    #recordDistributionPage .rd-context {
      padding: 12px 15px;
      margin-bottom: 16px;
      background: rgba(var(--blue), .05);
      border: 1px solid rgba(var(--blue), .12);
      border-radius: 12px;
      color: var(--text2);
      font-size: .75em;
      line-height: 1.8;
      overflow-wrap: anywhere;
    }

    /* ===== 統計摘要 ===== */

    #recordDistributionPage .rd-summary {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }

    #recordDistributionPage .rd-metric {
      padding: 18px 12px;
      text-align: center;
      border-radius: 14px;
      border: 1px solid var(--border);
      background: var(--glass);
    }

    #recordDistributionPage .rd-metric strong {
      display: block;
      color: var(--text);
      font-size: 1.85em;
      font-weight: 900;
      letter-spacing: -.05em;
      line-height: 1.2;
      font-variant-numeric: tabular-nums;
    }

    #recordDistributionPage .rd-metric:first-child strong {
      color: var(--p2);
    }

    #recordDistributionPage .rd-metric:last-child strong {
      color: rgb(var(--teal));
    }

    #recordDistributionPage .rd-metric span {
      display: block;
      margin-top: 7px;
      color: var(--text3);
      font-size: .68em;
      font-weight: 600;
      line-height: 1.5;
    }

    /* ===== 圖例 ===== */

    #recordDistributionPage .rd-legend {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      margin: 20px 2px 12px;
      color: var(--text3);
      font-size: .72em;
      line-height: 1.8;
    }

    #recordDistributionPage .rd-legend-correct {
      color: rgb(var(--teal));
      font-weight: 700;
    }

    /* ===== 表格容器 ===== */

    #recordDistributionPage .rd-grid {
      display: block;
      min-width: 0;
    }

    #recordDistributionPage .rd-table-scroll {
      width: 100%;
      max-height: 70vh;
      overflow: auto;
      box-sizing: border-box;
      border: 1px solid var(--border2);
      border-radius: 14px;
      background: var(--bg1);
      -webkit-overflow-scrolling: touch;
    }

    #recordDistributionPage .rd-table-scroll:focus-visible {
      outline: 2px solid rgb(var(--p));
      outline-offset: 3px;
    }

    /* ===== 表格 ===== */

    #recordDistributionPage .rd-data-table {
      width: 100%;
      min-width: 880px;
      table-layout: fixed;
      border-collapse: separate;
      border-spacing: 0;
      color: var(--text2);
      font-size: .82em;
      font-variant-numeric: tabular-nums;
    }

    #recordDistributionPage .rd-col-question {
      width: 86px;
    }

    #recordDistributionPage .rd-col-blank {
      width: 145px;
    }

    #recordDistributionPage .rd-col-sample {
      width: 100px;
    }

    #recordDistributionPage .rd-data-table th,
    #recordDistributionPage .rd-data-table td {
      box-sizing: border-box;
      padding: 15px 13px;
      border-right: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
      vertical-align: middle;
    }

    #recordDistributionPage .rd-data-table tr > :last-child {
      border-right: none;
    }

    #recordDistributionPage .rd-data-table tbody tr:last-child > * {
      border-bottom: none;
    }

    /* ===== 固定表頭 ===== */

    #recordDistributionPage .rd-data-table thead th {
      position: sticky;
      top: 0;
      z-index: 3;
      background: var(--bg1);
      color: var(--text);
      text-align: center;
      font-size: .95em;
      font-weight: 800;
      box-shadow: 0 1px 0 var(--border2);
    }

    #recordDistributionPage .rd-data-table thead th:first-child {
      left: 0;
      z-index: 5;
    }

    /* ===== 固定左側題號 ===== */

    #recordDistributionPage .rd-data-table tbody .rd-table-qnum {
      position: sticky;
      left: 0;
      z-index: 2;
      background: var(--bg1);
      color: var(--text);
      text-align: center;
      font-weight: 900;
      box-shadow: 1px 0 0 var(--border);
    }

    #recordDistributionPage .rd-table-key-note {
      display: block;
      margin-top: 5px;
      color: var(--text3);
      font-size: .7em;
      font-weight: 400;
      line-height: 1.5;
    }

    /* ===== 交錯底色及滑鼠提示 ===== */

    #recordDistributionPage .rd-data-table tbody tr:nth-child(even)
    td:not(.rd-table-correct) {
      background: rgba(var(--p), .025);
    }

    #recordDistributionPage .rd-data-table tbody tr:hover
    td:not(.rd-table-correct) {
      background: rgba(var(--p), .065);
    }

    /* ===== 選項數值 ===== */

    #recordDistributionPage .rd-table-value {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 6px;
      white-space: nowrap;
    }

    #recordDistributionPage .rd-table-value strong {
      color: var(--text2);
      font-size: 1em;
      font-weight: 800;
    }

    #recordDistributionPage .rd-table-value small {
      color: var(--text3);
      font-size: .8em;
    }

    /* ===== 格內比例橫條 ===== */

    #recordDistributionPage .rd-table-bar {
      height: 5px;
      margin-top: 9px;
      overflow: hidden;
      border-radius: 99px;
      background: rgba(var(--p), .1);
    }

    #recordDistributionPage .rd-table-bar > span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: rgba(var(--p), .55);
    }

    /* ===== 正確選項：整格高亮 ===== */

    #recordDistributionPage .rd-data-table td.rd-table-correct {
      background: rgba(var(--teal), .095);
      box-shadow: inset 3px 0 0 rgb(var(--teal));
    }

    #recordDistributionPage .rd-table-correct .rd-table-value strong {
      color: rgb(var(--teal));
      font-weight: 900;
    }

    #recordDistributionPage .rd-table-correct .rd-table-value small {
      color: rgb(var(--teal));
    }

    #recordDistributionPage .rd-table-correct .rd-table-bar {
      background: rgba(var(--teal), .12);
    }

    #recordDistributionPage .rd-table-correct .rd-table-bar > span {
      background: rgb(var(--teal));
    }

    /* ===== 留空／無效 ===== */

    #recordDistributionPage .rd-table-blank.has-blank
    .rd-table-value strong {
      color: rgb(var(--amber));
    }

    #recordDistributionPage .rd-table-blank .rd-table-bar {
      background: rgba(var(--amber), .1);
    }

    #recordDistributionPage .rd-table-blank .rd-table-bar > span {
      background: rgba(var(--amber), .7);
    }

    /* ===== 樣本人數 ===== */

    #recordDistributionPage .rd-table-sample {
      color: var(--text2);
      text-align: center;
      white-space: nowrap;
    }

    #recordDistributionPage .rd-table-sample strong {
      color: var(--text);
      font-weight: 800;
    }

    /* ===== 備註及空白狀態 ===== */

    #recordDistributionPage .rd-note {
      margin-top: 20px;
      padding: 16px 18px;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: var(--white-alpha-018);
      color: var(--text3);
      font-size: .71em;
      line-height: 1.95;
      overflow-wrap: anywhere;
    }

    #recordDistributionPage .rd-empty {
      padding: 48px 20px;
      border: 1px dashed var(--border2);
      border-radius: 17px;
      color: var(--text3);
      text-align: center;
      font-size: .85em;
      line-height: 1.9;
      background: var(--glass);
    }

    /* ===== 手機版 ===== */

    @media (max-width: 600px) {
      #recordDistributionPage .rd-body {
        padding: 12px 12px 32px;
      }

      #recordDistributionPage .rd-heading {
        gap: 10px;
        margin-bottom: 18px;
      }

      #recordDistributionPage .rd-heading-icon {
        width: 39px;
        height: 39px;
        border-radius: 13px;
        font-size: 1.15em;
      }

      #recordDistributionPage .rd-heading-title {
        font-size: 1em;
      }

      #recordDistributionPage .rd-heading-desc {
        font-size: .68em;
      }

      #recordDistributionPage .rd-toolbar {
        align-items: stretch;
        gap: 10px;
      }

      #recordDistributionPage .rd-field {
        flex-basis: 100%;
        min-width: 0;
      }

      #recordDistributionPage .rd-scope {
        width: 100%;
      }

      #recordDistributionPage .rd-scope button {
        flex: 1;
        min-width: 0;
        padding: 10px 8px;
        font-size: .72em;
        white-space: normal;
      }

      #recordDistributionPage .rd-summary {
        gap: 7px;
      }

      #recordDistributionPage .rd-metric {
        padding: 14px 7px;
      }

      #recordDistributionPage .rd-metric strong {
        font-size: 1.45em;
      }

      #recordDistributionPage .rd-metric span {
        font-size: .6em;
      }

      #recordDistributionPage .rd-legend {
        font-size: .67em;
      }

      #recordDistributionPage .rd-data-table {
        min-width: 800px;
        font-size: .77em;
      }

      #recordDistributionPage .rd-data-table th,
      #recordDistributionPage .rd-data-table td {
        padding: 13px 10px;
      }

      #recordDistributionPage .rd-col-question {
        width: 76px;
      }

      #recordDistributionPage .rd-col-blank {
        width: 130px;
      }

      #recordDistributionPage .rd-col-sample {
        width: 90px;
      }

      #recordDistributionPage .rd-note {
        padding: 13px 15px;
        font-size: .67em;
      }

      #recordDistributionPage .page-topbar .back-btn {
        padding: 7px 10px;
        font-size: .72em;
      }
    }
  `;

  document.head.appendChild(style);
}


/* =========================================================
   選項分佈：自動建立入口按鈕及獨立頁面
   ========================================================= */

function ensureRecDistributionUI() {
  installRecDistributionStyles();

  /* ===== 成績查詢入口按鈕 ===== */

  if (!document.getElementById('recDistributionOpenBtn')) {
    const exportButton = document.getElementById('exportScoreBtn');

    if (exportButton && exportButton.parentNode) {
      const button = document.createElement('button');

      button.type = 'button';
      button.id = 'recDistributionOpenBtn';
      button.className = 'btn btn-p btn-sm';
      button.textContent = '📊 選項分佈';
      button.disabled = true;

      button.addEventListener(
        'click',
        openRecDistributionPage
      );

      exportButton.parentNode.insertBefore(
        button,
        exportButton
      );
    }
  }

  /* ===== 獨立頁面 ===== */

  let page = document.getElementById(
    REC_DISTRIBUTION_PAGE_ID
  );

  if (!page) {
    page = document.createElement('div');

    page.id = REC_DISTRIBUTION_PAGE_ID;
    page.className = 'page';

    page.innerHTML = `
      <div class="page-topbar">
        <button
          type="button"
          class="back-btn"
          id="rdBackBtn"
        >← 成績查詢</button>

        <h2>選項分佈</h2>

        <button
          type="button"
          class="theme-toggle"
          onclick="toggleTheme()"
          title="切換主題"
          aria-label="切換主題"
        >🌙</button>

        <span class="fb-badge off" id="rdFirebaseBadge">
          <span class="fb-dot"></span>
          <span class="fbRecTxt">離線</span>
        </span>
      </div>

      <div class="page-body rd-body">
        <section class="card rd-intro">
          <div class="rd-heading">
            <div class="rd-heading-icon">📊</div>

            <div>
              <div class="rd-heading-title">
                每題選項分佈總覽
              </div>

              <div class="rd-heading-desc">
                以表格比較各題 ABCD 選擇比例，
                正確選項直接在對應儲存格高亮顯示。
              </div>
            </div>
          </div>

          <div class="rd-toolbar">
            <div class="rd-field">
              <label for="rdPaperSelect">分析試卷</label>
              <select id="rdPaperSelect"></select>
            </div>

            <div
              class="rd-scope"
              role="group"
              aria-label="統計範圍"
            >
              <button
                type="button"
                id="rdClassBtn"
                class="active"
                aria-pressed="true"
              >本班</button>

              <button
                type="button"
                id="rdGradeBtn"
                aria-pressed="false"
              >全級</button>
            </div>
          </div>

          <div
            class="rd-context"
            id="rdContext"
            aria-live="polite"
          ></div>

          <div class="rd-summary">
            <div class="rd-metric">
              <strong id="rdStudentCount">0</strong>
              <span>已交卷學生</span>
            </div>

            <div class="rd-metric">
              <strong id="rdQuestionCount">0</strong>
              <span>分析題目</span>
            </div>

            <div class="rd-metric">
              <strong id="rdOverallAccuracy">—</strong>
              <span>整體正答率</span>
            </div>
          </div>
        </section>

        <div class="rd-legend">
          <span class="rd-legend-correct">
            ✓ 綠色高亮為正確選項
          </span>

          <span>
            每格顯示：選擇比例 · 人數；窄螢幕可左右滑動
          </span>
        </div>

        <div
          class="rd-grid"
          id="rdQuestionGrid"
          aria-label="每題 ABCD 選擇分佈表"
        ></div>

        <div
          class="rd-note"
          id="rdStatisticsNote"
        ></div>
      </div>
    `;

    document.body.appendChild(page);

    document.getElementById('rdBackBtn')
      .addEventListener(
        'click',
        closeRecDistributionPage
      );

    document.getElementById('rdPaperSelect')
      .addEventListener('change', function () {
        recDistributionPaperId = this.value;
        renderRecDistributionPage();
      });

    document.getElementById('rdClassBtn')
      .addEventListener('click', function () {
        recDistributionScope = 'class';
        renderRecDistributionPage();
      });

    document.getElementById('rdGradeBtn')
      .addEventListener('click', function () {
        recDistributionScope = 'grade';
        renderRecDistributionPage();
      });
  }

  /* ===== 雲端狀態 ===== */

  const badge = document.getElementById('rdFirebaseBadge');

  if (badge) {
    badge.className = 'fb-badge ' +
      (fbConnected ? 'on' : 'off');

    const text = badge.querySelector('.fbRecTxt');

    if (text) {
      text.textContent = fbConnected ? '雲端' : '離線';
    }
  }

  if (typeof updateThemeButtons === 'function') {
    updateThemeButtons();
  }

  return page;
}


/* =========================================================
   選項分佈：跳轉及返回
   ========================================================= */

function openRecDistributionPage() {
  const ready = !!(
    recTabYear &&
    recTabTerm &&
    recTabSubject &&
    recTabClass
  );

  if (!ready) {
    showMsg(
      '⚠️ 請先選擇學年、學期、科目及班別，' +
      '再查看選項分佈。'
    );

    return;
  }

  const nextContext = {
    year: recTabYear,
    term: recTabTerm,
    subject: recTabSubject,
    className: recTabClass
  };

  const changed =
    JSON.stringify(recDistributionContext) !==
    JSON.stringify(nextContext);

  if (changed) {
    recDistributionPaperId = '';
    recDistributionScope = 'class';
  }

  recDistributionContext = nextContext;

  ensureRecDistributionUI();

  navigateTo(REC_DISTRIBUTION_PAGE_ID);
  renderRecDistributionPage();
}

function closeRecDistributionPage() {
  /*
   * 保留原本成績查詢的篩選及學生詳情狀態。
   */
  navigateTo('recordPage');
}


/* =========================================================
   選項分佈：資料整理
   ========================================================= */

function recDistributionPercent(count, total) {
  if (!total) return '—';

  return Number(
    (count / total * 100).toFixed(1)
  ) + '%';
}

function recDistributionPaperTitle(paper) {
  return [
    String(paper.name || '').trim() ||
      paper.subject ||
      '未命名試卷',

    getPaperGrade(paper) || '未設定級別',

    paper.set || '不分 Set',

    `${paper.totalQ || 0} 題`
  ].join(' · ');
}

function recDistributionMatchesContext(rec, paper) {
  const context = recDistributionContext;

  if (!context || !paper) {
    return false;
  }

  return (
    paper.year === context.year &&
    paper.term === context.term &&
    paper.subject === context.subject
  );
}

function recDistributionAvailablePapers() {
  const context = recDistributionContext;

  if (!context) return [];

  const result = new Map();

  records.forEach(rec => {
    const paper = getRecPaperData(rec);

    if (
      recDistributionMatchesContext(rec, paper) &&
      rec.class === context.className
    ) {
      result.set(String(paper.id), paper);
    }
  });

  return [...result.values()].sort((a, b) => {
    return recDistributionPaperTitle(a).localeCompare(
      recDistributionPaperTitle(b),
      'zh-TW',
      { numeric: true }
    );
  });
}

function recDistributionRosterMap(year) {
  const map = new Map();

  (studentDB[year] || []).forEach(student => {
    const key = JSON.stringify([
      String(student.class || '').trim(),
      String(student.name || '').trim()
    ]);

    if (!map.has(key)) {
      map.set(key, student);
    }
  });

  return map;
}

function recDistributionStudentIdentity(rec, rosterMap) {
  const name = String(rec.student || '').trim();

  if (!name || name === '—') {
    return null;
  }

  const cls = String(rec.class || '').trim();

  const student = rosterMap.get(
    JSON.stringify([cls, name])
  );

  let originalClass = cls;
  let originalNumber = 0;

  if (student) {
    originalClass = String(
      student.origClass != null
        ? student.origClass
        : student.class || cls
    ).trim();

    originalNumber = Number(
      student.origNumber != null
        ? student.origNumber
        : student.number || 0
    ) || 0;
  }

  /*
   * 原班及選修班如有 origClass / origNumber，
   * 會以原班資料辨識同一學生。
   */
  return JSON.stringify([
    String(rec.paperId || ''),
    originalClass,
    originalNumber > 0 ? originalNumber : '',
    name
  ]);
}

function recDistributionIsNewer(
  newRec,
  newIndex,
  oldRec,
  oldIndex
) {
  const newId = Number(newRec.id);
  const oldId = Number(oldRec.id);

  const newValid = Number.isFinite(newId) && newId > 0;
  const oldValid = Number.isFinite(oldId) && oldId > 0;

  /*
   * 沿用記錄 ID 由 Date.now() 建立的資料格式。
   * 沒有有效數值 ID 時，以陣列較後的記錄為準。
   */
  if (newValid && oldValid && newId !== oldId) {
    return newId > oldId;
  }

  return newIndex > oldIndex;
}

function recDistributionLatestRecords(source, paper) {
  const rosterMap = recDistributionRosterMap(paper.year);

  const latest = new Map();

  let duplicates = 0;
  let unnamed = 0;

  source.forEach((rec, index) => {
    const identity = recDistributionStudentIdentity(
      rec,
      rosterMap
    );

    if (!identity) {
      unnamed++;
      return;
    }

    const previous = latest.get(identity);

    if (!previous) {
      latest.set(identity, { rec, index });
      return;
    }

    duplicates++;

    if (
      recDistributionIsNewer(
        rec,
        index,
        previous.rec,
        previous.index
      )
    ) {
      latest.set(identity, { rec, index });
    }
  });

  return {
    list: [...latest.values()].map(item => item.rec),
    duplicates,
    unnamed
  };
}

function recDistributionNormalizeKey(value) {
  return [...new Set(
    String(value || '')
      .toUpperCase()
      .split('')
      .filter(letter => 'ABCD'.includes(letter))
  )].sort().join('');
}

function recDistributionBuildStatistics(
  paper,
  studentRecords
) {
  let totalQ = parseInt(paper.totalQ, 10);

  if (!Number.isFinite(totalQ) || totalQ < 1) {
    totalQ = Array.isArray(paper.answerKey)
      ? paper.answerKey.length
      : 0;
  }

  totalQ = Math.max(0, Math.min(80, totalQ));

  const answerKey = paper.answerKey || [];

  const questions = Array.from(
    { length: totalQ },
    (_, index) => ({
      number: index + 1,

      key: recDistributionNormalizeKey(
        answerKey[index]
      ),

      counts: {
        A: 0,
        B: 0,
        C: 0,
        D: 0
      },

      blank: 0,
      sample: 0,
      correct: 0
    })
  );

  studentRecords.forEach(rec => {
    const answers = String(rec.ans || '');
    const recordTotalQ = recGetQuestionCount(rec);

    questions.forEach((question, index) => {
      /*
       * 舊記錄沒有該題時，不列入該題分母。
       * 避免增加試卷題數後，把舊記錄不存在的題目當成留空。
       */
      if (index >= recordTotalQ) {
        return;
      }

      question.sample++;

      const answer = answers.charAt(index).toUpperCase();

      if (answer && 'ABCD'.includes(answer)) {
        question.counts[answer]++;

        if (
          question.key &&
          isAnswerCorrect(answer, question.key)
        ) {
          question.correct++;
        }
      } else {
        question.blank++;
      }
    });
  });

  let overallCorrect = 0;
  let overallSamples = 0;

  questions.forEach(question => {
    if (!question.key) return;

    overallCorrect += question.correct;
    overallSamples += question.sample;
  });

  return {
    totalQ,
    questions,
    overallCorrect,
    overallSamples
  };
}


/* =========================================================
   選項分佈：表格
   ========================================================= */

function recDistributionTable(questions) {
  const rows = questions.map(question => {
    const sample = question.sample;

    /* ===== ABCD 四個選項儲存格 ===== */

    const optionCells = ['A', 'B', 'C', 'D']
      .map(letter => {
        const count = question.counts[letter];

        const percentage = recDistributionPercent(
          count,
          sample
        );

        const width = sample
          ? Math.max(
              0,
              Math.min(100, count / sample * 100)
            )
          : 0;

        const correct = String(question.key || '')
          .includes(letter);

        const accessibleText = [
          letter,
          correct ? '正確選項' : '',
          percentage,
          `${count} 人`
        ].filter(Boolean).join('，');

        return `
          <td
            class="rd-table-option${correct ? ' rd-table-correct' : ''}"
            aria-label="${recHTML(accessibleText)}"
            title="${recHTML(accessibleText)}"
          >
            <div class="rd-table-value">
              <strong>
                ${correct ? '<span aria-hidden="true">✓ </span>' : ''}
                ${percentage}
              </strong>

              <small>${count} 人</small>
            </div>

            <div class="rd-table-bar" aria-hidden="true">
              <span style="width:${width.toFixed(2)}%"></span>
            </div>
          </td>
        `;
      }).join('');

    /* ===== 留空／無效儲存格 ===== */

    const blankPercentage = recDistributionPercent(
      question.blank,
      sample
    );

    const blankWidth = sample
      ? Math.max(
          0,
          Math.min(100, question.blank / sample * 100)
        )
      : 0;

    return `
      <tr>
        <th scope="row" class="rd-table-qnum">
          Q${question.number}

          ${question.key ? '' : `
            <small class="rd-table-key-note">
              未設答案
            </small>
          `}
        </th>

        ${optionCells}

        <td
          class="rd-table-blank${question.blank > 0 ? ' has-blank' : ''}"
          aria-label="留空或無效，${blankPercentage}，${question.blank} 人"
        >
          <div class="rd-table-value">
            <strong>${blankPercentage}</strong>
            <small>${question.blank} 人</small>
          </div>

          <div class="rd-table-bar" aria-hidden="true">
            <span style="width:${blankWidth.toFixed(2)}%"></span>
          </div>
        </td>

        <td class="rd-table-sample">
          <strong>${sample}</strong> 人
        </td>
      </tr>
    `;
  }).join('');

  return `
    <div
      class="rd-table-scroll"
      role="region"
      tabindex="0"
      aria-label="每題選項分佈，可上下及左右捲動"
    >
      <table
        class="rd-data-table"
        aria-label="每題 ABCD 選擇比例、人數及正確選項"
      >
        <colgroup>
          <col class="rd-col-question">
          <col span="4">
          <col class="rd-col-blank">
          <col class="rd-col-sample">
        </colgroup>

        <thead>
          <tr>
            <th scope="col">題目</th>
            <th scope="col">A</th>
            <th scope="col">B</th>
            <th scope="col">C</th>
            <th scope="col">D</th>
            <th scope="col">留空／無效</th>
            <th scope="col">樣本人數</th>
          </tr>
        </thead>

        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}


/* =========================================================
   選項分佈：主渲染
   ========================================================= */

function renderRecDistributionPage() {
  ensureRecDistributionUI();

  const context = recDistributionContext;

  const select = document.getElementById('rdPaperSelect');
  const classButton = document.getElementById('rdClassBtn');
  const gradeButton = document.getElementById('rdGradeBtn');
  const grid = document.getElementById('rdQuestionGrid');
  const contextBox = document.getElementById('rdContext');
  const note = document.getElementById('rdStatisticsNote');

  document.getElementById('rdStudentCount')
    .textContent = '0';

  document.getElementById('rdQuestionCount')
    .textContent = '0';

  document.getElementById('rdOverallAccuracy')
    .textContent = '—';

  const availablePapers = recDistributionAvailablePapers();

  /* ===== 沒有可分析試卷 ===== */

  if (!context || !availablePapers.length) {
    select.innerHTML =
      '<option value="">沒有可分析的試卷</option>';

    select.disabled = true;
    classButton.disabled = true;
    gradeButton.disabled = true;

    contextBox.textContent = context
      ? (
          `${context.year} · ${context.term} · ` +
          `${context.subject} · ${context.className} 班`
        )
      : '請先返回成績查詢，選擇學年、學期、科目及班別。';

    grid.innerHTML = `
      <div class="rd-empty">
        📋 暫時沒有可分析的試卷記錄。<br>
        請返回成績查詢，確認篩選條件或先儲存掃描結果。
      </div>
    `;

    note.textContent =
      '💡 只有已儲存、具名並且仍能對應試卷的記錄會列入分析。';

    return;
  }

  select.disabled = false;
  classButton.disabled = false;
  gradeButton.disabled = false;

  let paper = availablePapers.find(item => {
    return String(item.id) === String(recDistributionPaperId);
  });

  if (!paper) {
    paper = availablePapers[0];
    recDistributionPaperId = String(paper.id);
  }

  /* ===== 重建試卷選單 ===== */

  select.innerHTML = '';

  const titleCounts = new Map();

  availablePapers.forEach(item => {
    const title = recDistributionPaperTitle(item);

    titleCounts.set(
      title,
      (titleCounts.get(title) || 0) + 1
    );
  });

  availablePapers.forEach(item => {
    const option = document.createElement('option');

    let title = recDistributionPaperTitle(item);

    if (titleCounts.get(title) > 1) {
      title += ' · #' + String(item.id).slice(-5);
    }

    option.value = String(item.id);
    option.textContent = title;

    select.appendChild(option);
  });

  select.value = String(paper.id);

  /* ===== 統計範圍切換 ===== */

  const gradeLabel = getPaperGrade(paper) || '未設定級別';

  classButton.textContent = `本班 · ${context.className}`;
  gradeButton.textContent = `全級 · ${gradeLabel}`;

  classButton.classList.toggle(
    'active',
    recDistributionScope === 'class'
  );

  gradeButton.classList.toggle(
    'active',
    recDistributionScope === 'grade'
  );

  classButton.setAttribute(
    'aria-pressed',
    String(recDistributionScope === 'class')
  );

  gradeButton.setAttribute(
    'aria-pressed',
    String(recDistributionScope === 'grade')
  );

  /* ===== 取得相同試卷的記錄 ===== */

  const sourceRecords = records.filter(rec => {
    const recPaper = getRecPaperData(rec);

    if (!recDistributionMatchesContext(rec, recPaper)) {
      return false;
    }

    if (String(recPaper.id) !== String(paper.id)) {
      return false;
    }

    if (
      recDistributionScope === 'class' &&
      rec.class !== context.className
    ) {
      return false;
    }

    return true;
  });

  /* ===== 排除同一學生較舊記錄 ===== */

  const latest = recDistributionLatestRecords(
    sourceRecords,
    paper
  );

  const statistics = recDistributionBuildStatistics(
    paper,
    latest.list
  );

  const classes = [
    ...new Set(
      latest.list
        .map(rec => String(rec.class || '').trim())
        .filter(Boolean)
    )
  ].sort((a, b) => {
    return a.localeCompare(
      b,
      'zh-TW',
      { numeric: true }
    );
  });

  const paperName =
    String(paper.name || '').trim() ||
    paper.subject ||
    '未命名試卷';

  const metadata = [
    context.year,
    context.term,
    context.subject,
    gradeLabel,
    paperName
  ];

  if (paper.set) {
    metadata.push(paper.set);
  }

  /* ===== 顯示分析範圍 ===== */

  if (recDistributionScope === 'class') {
    contextBox.textContent =
      `目前分析：${context.className} 班 · ` +
      metadata.join(' · ');
  } else {
    contextBox.textContent =
      `目前分析：${gradeLabel} 全級 · ` +
      metadata.join(' · ') +
      `；合併 ${classes.length} 個班別` +
      (
        classes.length
          ? `：${classes.join('、')}`
          : ''
      );
  }

  /* ===== 統計摘要 ===== */

  document.getElementById('rdStudentCount')
    .textContent = latest.list.length;

  document.getElementById('rdQuestionCount')
    .textContent = statistics.totalQ;

  document.getElementById('rdOverallAccuracy')
    .textContent = recDistributionPercent(
      statistics.overallCorrect,
      statistics.overallSamples
    );

  /* ===== 題目分佈表 ===== */

  if (!statistics.totalQ) {
    grid.innerHTML = `
      <div class="rd-empty">
        此試卷尚未設定有效題數。
      </div>
    `;
  } else if (!latest.list.length) {
    grid.innerHTML = `
      <div class="rd-empty">
        📋 尚無可分析的學生記錄。<br>
        請先完成掃描並儲存對應學生的成績。
      </div>
    `;
  } else {
    grid.innerHTML = recDistributionTable(
      statistics.questions
    );
  }

  /* ===== 統計說明 ===== */

  const notes = [
    '各選項百分比以每題有該題的已交卷學生為分母，包含留空／無效答案；未交卷學生不計入。',
    '綠色高亮及 ✓ 表示正確選項，該格直接顯示選擇此答案的百分比及人數。',
    '若一題有多個可接受答案，所有正確選項均會高亮，並分別列出各自比例。',
    '同一學生同一試卷只計最新記錄；有原班與選修班對照資料時會合併辨識。',
    '全級只合併同一份試卷，不混合其他試卷或 Set。',
    '整體正答率＝所有已設答案題目的答對次數 ÷ 對應樣本總數。百分比四捨五入至小數一位。'
  ];

  if (
    latest.list.some(rec => {
      return recGetQuestionCount(rec) < statistics.totalQ;
    })
  ) {
    notes.push(
      '部分歷史記錄題數較少，因此不同題目的樣本人數可能不同。'
    );
  }

  if (latest.duplicates > 0) {
    notes.push(
      `本次已排除 ${latest.duplicates} 筆較舊或重複記錄。`
    );
  }

  if (latest.unnamed > 0) {
    notes.push(
      `${latest.unnamed} 筆未具名記錄未計入統計。`
    );
  }

  note.textContent = '💡 ' + notes.join(' ');
}


/* =========================================================
   成績查詢：分頁及篩選
   ========================================================= */

function recBuildTabSection(
  label,
  values,
  current,
  level
) {
  let html = `
    <div class="tab-section">
      <div class="tab-label">
        ${recHTML(label)}
      </div>

      <div class="tab-row">
  `;

  values.forEach(value => {
    html += `
      <button
        type="button"
        class="tab-pill${current === value ? ' active' : ''}"
        data-rec-level="${recHTML(level)}"
        data-rec-value="${recHTML(value)}"
      >${recHTML(value)}</button>
    `;
  });

  html += '</div></div>';

  return html;
}

function renderRecTabs() {
  const area = document.getElementById('recTabsArea');

  if (!area) return;

  ensureRecDistributionUI();

  const available = records
    .map(rec => ({
      rec,
      paper: getRecPaperData(rec)
    }))
    .filter(item => item.paper);

  const sortedYears = [
    ...new Set(
      available
        .map(item => item.paper.year)
        .filter(Boolean)
    )
  ].sort().reverse();

  /* ===== 清除已不存在的學年篩選 ===== */

  if (
    recTabYear &&
    !sortedYears.includes(recTabYear)
  ) {
    recTabYear = '';
    recTabTerm = '';
    recTabSubject = '';
    recTabClass = '';
    recViewingStudent = null;
  }

  let html = '';

  /* ===== 學年 ===== */

  if (!sortedYears.length) {
    html += `
      <div class="tab-section">
        <div class="tab-label">學年</div>

        <div class="tab-row">
          <span
            style="
              font-size:.78em;
              color:var(--text3);
              padding:6px
            "
          >無記錄</span>
        </div>
      </div>
    `;
  } else {
    html += recBuildTabSection(
      '學年',
      sortedYears,
      recTabYear,
      'year'
    );
  }

  /* ===== 學期 ===== */

  if (recTabYear) {
    const terms = [
      ...new Set(
        available
          .filter(item => {
            return item.paper.year === recTabYear;
          })
          .map(item => item.paper.term)
          .filter(Boolean)
      )
    ].sort();

    if (
      recTabTerm &&
      !terms.includes(recTabTerm)
    ) {
      recTabTerm = '';
      recTabSubject = '';
      recTabClass = '';
      recViewingStudent = null;
    }

    if (terms.length) {
      html += recBuildTabSection(
        '學期',
        terms,
        recTabTerm,
        'term'
      );
    }
  }

  /* ===== 科目 ===== */

  if (recTabYear && recTabTerm) {
    const subjects = [
      ...new Set(
        available
          .filter(item => {
            return (
              item.paper.year === recTabYear &&
              item.paper.term === recTabTerm
            );
          })
          .map(item => item.paper.subject)
          .filter(Boolean)
      )
    ].sort();

    if (
      recTabSubject &&
      !subjects.includes(recTabSubject)
    ) {
      recTabSubject = '';
      recTabClass = '';
      recViewingStudent = null;
    }

    if (subjects.length) {
      html += recBuildTabSection(
        '科目',
        subjects,
        recTabSubject,
        'subject'
      );
    }
  }

  /* ===== 班別 ===== */

  if (
    recTabYear &&
    recTabTerm &&
    recTabSubject
  ) {
    const classes = [
      ...new Set(
        available
          .filter(item => {
            return (
              item.paper.year === recTabYear &&
              item.paper.term === recTabTerm &&
              item.paper.subject === recTabSubject
            );
          })
          .map(item => item.rec.class)
          .filter(Boolean)
      )
    ].sort();

    if (
      recTabClass &&
      !classes.includes(recTabClass)
    ) {
      recTabClass = '';
      recViewingStudent = null;
    }

    if (classes.length) {
      html += recBuildTabSection(
        '班別',
        classes,
        recTabClass,
        'class'
      );
    }
  }

  area.innerHTML = html;

  /* ===== 綁定分頁按鈕 ===== */

  area.querySelectorAll('[data-rec-level]')
    .forEach(button => {
      button.addEventListener('click', () => {
        setRecTab(
          button.dataset.recLevel,
          button.dataset.recValue
        );
      });
    });

  const ready = !!(
    recTabYear &&
    recTabTerm &&
    recTabSubject &&
    recTabClass
  );

  [
    'recDistributionOpenBtn',
    'exportScoreBtn',
    'exportAnsBtn',
    'deleteFilteredBtn'
  ].forEach(id => {
    const button = document.getElementById(id);

    if (button) {
      button.disabled = !ready;
    }
  });

  const hint = document.getElementById('exportHint');

  if (hint) {
    hint.style.display = ready ? 'none' : 'block';

    hint.textContent =
      '💡 請先選擇學年、學期、科目及班別，' +
      '即可查看選項分佈、匯出或刪除記錄。';
  }

  /* ===== 顯示對應內容 ===== */

  if (ready) {
    if (recViewingStudent) {
      showStudentDetail(recViewingStudent);
    } else {
      showClassView();
    }
  } else {
    hideRecViews();
  }

  /*
   * 選項分佈頁正開啟時，同步重新計算。
   */
  const distributionPage = document.getElementById(
    REC_DISTRIBUTION_PAGE_ID
  );

  if (
    distributionPage &&
    distributionPage.classList.contains('page-active')
  ) {
    renderRecDistributionPage();
  }
}

function setRecTab(level, value) {
  if (level === 'year') {
    recTabYear = recTabYear === value ? '' : value;

    recTabTerm = '';
    recTabSubject = '';
    recTabClass = '';
  } else if (level === 'term') {
    recTabTerm = recTabTerm === value ? '' : value;

    recTabSubject = '';
    recTabClass = '';
  } else if (level === 'subject') {
    recTabSubject = recTabSubject === value ? '' : value;

    recTabClass = '';
  } else if (level === 'class') {
    recTabClass = recTabClass === value ? '' : value;
  }

  recViewingStudent = null;

  renderRecTabs();
}

function hideRecViews() {
  document.getElementById('recStatsArea')
    .classList.add('hidden');

  document.getElementById('recClassArea')
    .classList.add('hidden');

  document.getElementById('recStudentArea')
    .classList.add('hidden');

  document.getElementById('recEmptyMsg')
    .classList.remove('hidden');

  recViewingStudent = null;
}

function resetRecFilters() {
  recTabYear = '';
  recTabTerm = '';
  recTabSubject = '';
  recTabClass = '';

  recViewingStudent = null;

  recDistributionContext = null;
  recDistributionPaperId = '';
  recDistributionScope = 'class';

  renderRecTabs();
}

function getFilteredRecords() {
  return records.filter(rec => {
    const paper = getRecPaperData(rec);

    if (!paper) return false;

    if (
      recTabYear &&
      paper.year !== recTabYear
    ) {
      return false;
    }

    if (
      recTabTerm &&
      paper.term !== recTabTerm
    ) {
      return false;
    }

    if (
      recTabSubject &&
      paper.subject !== recTabSubject
    ) {
      return false;
    }

    if (
      recTabClass &&
      rec.class !== recTabClass
    ) {
      return false;
    }

    return true;
  });
}

function getStudentNumber(name, year, cls) {
  const student = (studentDB[year] || [])
    .find(item => {
      return (
        item.name === name &&
        item.class === cls
      );
    });

  return student
    ? (student.number || 0)
    : 9999;
}


/* =========================================================
   成績查詢：班別列表
   ========================================================= */

function getRecStudentEntries() {
  const year = recTabYear;
  const cls = recTabClass;

  const matchRecords = getFilteredRecords();

  const dbStudents = (studentDB[year] || [])
    .filter(student => {
      return student.class === cls;
    })
    .sort((a, b) => {
      return (a.number || 0) - (b.number || 0);
    });

  const studentMap = new Map();

  dbStudents.forEach(student => {
    studentMap.set(student.name, {
      dbInfo: student,
      records: []
    });
  });

  matchRecords.forEach(rec => {
    const name = rec.student || '—';

    if (!studentMap.has(name)) {
      studentMap.set(name, {
        dbInfo: null,
        records: []
      });
    }

    studentMap.get(name).records.push(rec);
  });

  return [...studentMap.entries()]
    .sort((a, b) => {
      const numberA = a[1].dbInfo
        ? (a[1].dbInfo.number || 0)
        : 9999;

      const numberB = b[1].dbInfo
        ? (b[1].dbInfo.number || 0)
        : 9999;

      if (numberA !== numberB) {
        return numberA - numberB;
      }

      return a[0].localeCompare(
        b[0],
        'zh-TW'
      );
    });
}

function showClassView() {
  const cls = recTabClass;
  const subject = recTabSubject;
  const term = recTabTerm;

  const matchRecords = getFilteredRecords();

  document.getElementById('recStatsArea')
    .classList.remove('hidden');

  document.getElementById('recClassArea')
    .classList.remove('hidden');

  document.getElementById('recStudentArea')
    .classList.add('hidden');

  document.getElementById('recEmptyMsg')
    .classList.add('hidden');

  recViewingStudent = null;

  const percentages = matchRecords
    .map(rec => {
      const value = String(rec.pct || '')
        .replace('%', '');

      if (!value || value === '-') {
        return null;
      }

      const number = parseInt(value, 10);

      return Number.isFinite(number)
        ? number
        : null;
    })
    .filter(value => value !== null);

  document.getElementById('statTotal')
    .textContent = matchRecords.length;

  if (percentages.length) {
    const average =
      percentages.reduce(
        (sum, value) => sum + value,
        0
      ) / percentages.length;

    document.getElementById('statAvg')
      .textContent = Math.round(average) + '%';

    document.getElementById('statHigh')
      .textContent = Math.max(...percentages) + '%';

    document.getElementById('statLow')
      .textContent = Math.min(...percentages) + '%';
  } else {
    document.getElementById('statAvg')
      .textContent = '—';

    document.getElementById('statHigh')
      .textContent = '—';

    document.getElementById('statLow')
      .textContent = '—';
  }

  document.getElementById('recClassTitle')
    .textContent = `📋 ${cls} 班成績 — ${subject} ${term}`;

  const entries = getRecStudentEntries();

  const box = document.getElementById('recStudentListBox');

  box.innerHTML = '';

  if (!entries.length) {
    box.innerHTML = `
      <div class="empty-msg">
        沒有學生資料或記錄。
      </div>
    `;

    return;
  }

  entries.forEach(([name, data], index) => {
    const number = data.dbInfo
      ? (data.dbInfo.number || index + 1)
      : index + 1;

    const hasRecord = data.records.length > 0;

    const row = document.createElement('div');

    row.className = 'rec-stu-row' +
      (hasRecord ? '' : ' no-rec');

    if (hasRecord) {
      const latest = data.records[data.records.length - 1];

      row.innerHTML = `
        <div class="rec-stu-num">
          ${number}
        </div>

        <div class="rec-stu-name">
          ${recHTML(name)}
        </div>

        <div class="rec-stu-score">
          ${recHTML(latest.sc)}
        </div>

        <div class="rec-stu-pct">
          ${recHTML(latest.pct)}
        </div>
      `;

      row.onclick = () => {
        showStudentDetail(name);
      };
    } else {
      row.innerHTML = `
        <div
          class="rec-stu-num"
          style="opacity:.4"
        >${number}</div>

        <div
          class="rec-stu-name"
          style="opacity:.5"
        >${recHTML(name)}</div>

        <div class="rec-stu-tag">
          未交卷
        </div>
      `;
    }

    box.appendChild(row);
  });
}


/* =========================================================
   成績查詢：學生詳情及導航
   ========================================================= */

function getNavStudentList() {
  return getRecStudentEntries()
    .filter(([, data]) => {
      return data.records.length > 0;
    })
    .map(([name]) => name);
}

function navStudent(direction) {
  const list = getNavStudentList();

  const index = list.indexOf(recViewingStudent);

  if (index < 0) return;

  const nextIndex = index + direction;

  if (
    nextIndex < 0 ||
    nextIndex >= list.length
  ) {
    return;
  }

  showStudentDetail(list[nextIndex]);

  const area = document.getElementById('recStudentArea');

  if (area) {
    area.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }
}

function showStudentDetail(studentName) {
  const year = recTabYear;
  const term = recTabTerm;
  const subject = recTabSubject;
  const cls = recTabClass;

  recViewingStudent = studentName;

  const matchRecords = records.filter(rec => {
    const paper = getRecPaperData(rec);

    return (
      paper &&
      paper.year === year &&
      paper.term === term &&
      paper.subject === subject &&
      rec.class === cls &&
      rec.student === studentName
    );
  });

  document.getElementById('recStatsArea')
    .classList.remove('hidden');

  document.getElementById('recClassArea')
    .classList.add('hidden');

  document.getElementById('recStudentArea')
    .classList.remove('hidden');

  document.getElementById('recEmptyMsg')
    .classList.add('hidden');

  document.getElementById('recStudentTitle')
    .textContent = `👤 ${studentName}`;

  /* ===== 上一位 / 下一位 ===== */

  const navList = getNavStudentList();
  const navIndex = navList.indexOf(studentName);

  const previousButton = document.getElementById('recPrevStuBtn');
  const nextButton = document.getElementById('recNextStuBtn');
  const navInfo = document.getElementById('recStuNavInfo');

  if (previousButton) {
    previousButton.disabled = !(navIndex > 0);
  }

  if (nextButton) {
    nextButton.disabled = !(
      navIndex >= 0 &&
      navIndex < navList.length - 1
    );
  }

  if (navInfo) {
    navInfo.textContent = navIndex >= 0
      ? (
          `第 ${navIndex + 1} / ${navList.length} 位` +
          '（有記錄學生）'
        )
      : '';
  }

  const box = document.getElementById('recStudentDetailBox');

  const dbStudent = (studentDB[year] || [])
    .find(student => {
      return (
        student.name === studentName &&
        student.class === cls
      );
    });

  let html = `
    <div class="rec-stu-detail-header">
      <div class="rec-stu-detail-avatar">👤</div>

      <div>
        <div class="rec-stu-detail-name">
          ${recHTML(studentName)}
        </div>

        <div class="rec-stu-detail-meta">
          ${recHTML(cls)} 班
          ${dbStudent ? ' · 學號 ' + recHTML(dbStudent.number) : ''}
          · ${recHTML(subject)}
          · ${recHTML(term)}
        </div>
      </div>
    </div>
  `;

  if (!matchRecords.length) {
    box.innerHTML =
      html +
      '<div class="empty-msg">無記錄</div>';

    return;
  }

  /* ===== 各筆記錄 ===== */

  matchRecords.forEach((rec, recordIndex) => {
    const paper = getRecPaperData(rec);

    const answerKey = paper
      ? paper.answerKey || []
      : [];

    const answers = String(rec.ans || '');
    const totalQ = recGetQuestionCount(rec);

    html += `
      <div class="rec-detail-info">
        <div class="rec-detail-item">
          <div class="rdl">分數</div>

          <div
            class="rdv"
            style="
              font-size:1.4em;
              background:var(--grad1);
              -webkit-background-clip:text;
              -webkit-text-fill-color:transparent
            "
          >${recHTML(rec.sc)}</div>
        </div>

        <div class="rec-detail-item">
          <div class="rdl">百分比</div>

          <div
            class="rdv"
            style="font-size:1.4em"
          >${recHTML(rec.pct)}</div>
        </div>

        <div class="rec-detail-item">
          <div class="rdl">試卷</div>

          <div
            class="rdv"
            style="font-size:.72em"
          >${recHTML(rec.paperLabel || '—')}</div>
        </div>

        <div class="rec-detail-item">
          <div class="rdl">時間</div>

          <div
            class="rdv"
            style="font-size:.76em"
          >${recHTML(rec.time)}</div>
        </div>
      </div>
    `;

    const image = recordImages[rec.id];

    if (image) {
      html += `
        <details>
          <summary>📷 掃描圖片</summary>

          <div class="rec-img-wrap">
            <img
              src="${recHTML(image)}"
              alt="掃描圖片"
            >
          </div>
        </details>
      `;
    }

    html += `
      <div
        style="
          font-size:.84em;
          font-weight:700;
          color:var(--text);
          margin:14px 0 8px
        "
      >📝 答題記錄</div>

      <div class="result-grid">
    `;

    for (let qi = 0; qi < totalQ; qi++) {
      const rawAnswer = answers.charAt(qi);
      const answer = rawAnswer === '-' ? '' : rawAnswer;

      const key = answerKey[qi] || '';

      const correct =
        key && isAnswerCorrect(answer, key);

      const incorrect =
        key &&
        answer &&
        !isAnswerCorrect(answer, key);

      const itemClass = 'ritem ' +
        (
          correct
            ? 'ok'
            : incorrect
              ? 'ng'
              : 'blank'
        );

      let itemHTML = `
        <span
          class="qn"
          ${incorrect ? 'style="color:rgb(var(--rose))"' : ''}
        >Q${qi + 1}</span>
      `;

      ['A', 'B', 'C', 'D'].forEach(option => {
        let optionClass = 'ro';

        if (answer === option && correct) {
          optionClass += ' grn';
        } else if (
          answer === option &&
          incorrect
        ) {
          optionClass += ' red';
        } else if (answer === option) {
          optionClass += ' blu';
        } else if (
          incorrect &&
          String(key).indexOf(option) >= 0
        ) {
          optionClass += ' grnb';
        }

        itemHTML += `
          <span class="${optionClass}">
            ${option}
          </span>
        `;
      });

      html += `
        <div class="${itemClass}">
          ${itemHTML}
        </div>
      `;
    }

    html += `
      </div>

      <div
        style="
          margin-top:14px;
          text-align:center
        "
      >
        <button
          type="button"
          class="btn btn-s btn-sm"
          data-rec-detail-index="${recordIndex}"
        >✏️ 編輯此記錄</button>
      </div>

      <hr class="divider">
    `;
  });

  box.innerHTML = html;

  box.querySelectorAll('[data-rec-detail-index]')
    .forEach(button => {
      button.addEventListener('click', () => {
        const rec = matchRecords[
          Number(button.dataset.recDetailIndex)
        ];

        if (rec) {
          openRecordDetail(rec.id);
        }
      });
    });
}

function backToClassView() {
  recViewingStudent = null;
  showClassView();
}

function renderRecs() {
  renderRecTabs();
}


/* =========================================================
   CSV 匯出
   ========================================================= */

function exportCSV() {
  if (!recTabClass) {
    showMsg('請先選擇班別才能匯出');
    return;
  }

  const filtered = getFilteredRecords();

  if (!filtered.length) {
    showMsg('沒有記錄可匯出');
    return;
  }

  let csv =
    '\ufeff#,學生,班別,答案,分數,百分比,試卷,時間\n';

  filtered.forEach((rec, index) => {
    const row = [
      index + 1,

      recCSVCell(rec.student || ''),

      recCSVCell(rec.class || ''),

      recCSVCell(rec.ans || ''),

      /*
       * 保留分數格式，避免 Excel 將 25/40
       * 之類的內容自動轉成日期。
       */
      recCSVCell(
        '="' + String(rec.sc || '-') + '"'
      ),

      recCSVCell(rec.pct || '-'),

      recCSVCell(rec.paperLabel || ''),

      recCSVCell(rec.time || '')
    ];

    csv += row.join(',') + '\n';
  });

  recDownloadCSV(
    csv,
    'OMR_成績_' +
      recTabClass +
      '_' +
      new Date().toISOString().slice(0, 10) +
      '.csv'
  );
}

function exportAnswersCSV() {
  if (!recTabClass) {
    showMsg('請先選擇班別才能匯出');
    return;
  }

  const filtered = getFilteredRecords();

  if (!filtered.length) {
    showMsg('沒有記錄可匯出');
    return;
  }

  const year = recTabYear;

  let maxQ = 0;

  filtered.forEach(rec => {
    maxQ = Math.max(
      maxQ,
      recGetQuestionCount(rec)
    );
  });

  const headers = ['班別', '班號', '姓名'];

  for (let q = 1; q <= maxQ; q++) {
    headers.push(q);
  }

  let csv = '\ufeff' + headers.join(',') + '\n';

  const sorted = [...filtered].sort((a, b) => {
    const numberA = getStudentNumber(
      a.student,
      year,
      a.class
    );

    const numberB = getStudentNumber(
      b.student,
      year,
      b.class
    );

    if (numberA !== numberB) {
      return numberA - numberB;
    }

    return String(a.student || '').localeCompare(
      String(b.student || ''),
      'zh-TW'
    );
  });

  sorted.forEach(rec => {
    const number = getStudentNumber(
      rec.student,
      year,
      rec.class
    );

    const answers = String(rec.ans || '');

    const row = [
      recCSVCell(rec.class || ''),

      number === 9999 ? '' : number,

      recCSVCell(rec.student || '')
    ];

    for (let q = 0; q < maxQ; q++) {
      const answer = answers.charAt(q);

      row.push(
        recCSVCell(answer === '-' ? '' : answer)
      );
    }

    csv += row.join(',') + '\n';
  });

  recDownloadCSV(
    csv,
    'OMR_答案_' +
      recTabClass +
      '_' +
      new Date().toISOString().slice(0, 10) +
      '.csv'
  );
}


/* =========================================================
   刪除記錄
   ========================================================= */

function clearRecs() {
  showConfirm(
    '確定要清除所有記錄嗎？',
    () => {
      records = [];
      recordImages = {};

      saveRecordImages();
      saveSettings();
      resetRecFilters();

      toast('🗑️ 已清除');
    }
  );
}

function deleteFilteredRecs() {
  if (!recTabClass) {
    showMsg('請先選擇班別才能刪除記錄');
    return;
  }

  const filtered = getFilteredRecords();

  if (!filtered.length) {
    showMsg('沒有符合的記錄可刪除');
    return;
  }

  const label = [
    recTabYear || '',
    recTabTerm || '',
    recTabSubject || '',
    recTabClass + ' 班'
  ].join(' · ');

  showConfirm(
    `⚠️ 確定要刪除 <strong>${recHTML(label)}</strong>` +
    ` 的全部 <strong>${filtered.length}</strong> 筆記錄嗎？` +
    '<br>此操作無法復原。',
    () => {
      const ids = new Set(
        filtered.map(rec => String(rec.id))
      );

      records = records.filter(rec => {
        return !ids.has(String(rec.id));
      });

      ids.forEach(id => {
        delete recordImages[id];
      });

      saveRecordImages();

      recViewingStudent = null;

      renderRecs();
      saveSettings();

      toast(`🗑️ 已刪除 ${filtered.length} 筆記錄`);
    }
  );
}


/* =========================================================
   記錄詳情編輯器
   ========================================================= */

function getRecPaperData(rec) {
  if (
    !rec ||
    rec.paperId == null ||
    rec.paperId === ''
  ) {
    return null;
  }

  return papers.find(paper => {
    return String(paper.id) === String(rec.paperId);
  }) || null;
}

function openRecordDetail(recId) {
  const rec = recFindById(recId);

  if (!rec) return;

  editingRecId = rec.id;

  const totalQ = recGetQuestionCount(rec) || 40;
  const answers = String(rec.ans || '');

  editingRecAnswers = [];

  for (let i = 0; i < totalQ; i++) {
    const answer = answers.charAt(i);

    editingRecAnswers.push(
      answer && 'ABCD'.includes(answer)
        ? answer
        : ''
    );
  }

  renderRecordDetailPanel(rec);

  document.getElementById('recOverlay')
    .classList.add('show');

  document.getElementById('recPanel')
    .classList.add('show');
}

function closeRecDetail() {
  document.getElementById('recOverlay')
    .classList.remove('show');

  document.getElementById('recPanel')
    .classList.remove('show');

  editingRecId = null;
  editingRecAnswers = [];
}

function renderRecordDetailPanel(rec) {
  const paper = getRecPaperData(rec);

  const answerKey = paper
    ? paper.answerKey || []
    : [];

  const score = recScoreAnswers(
    editingRecAnswers,
    answerKey
  );

  const body = document.getElementById('recDetailBody');

  let html = `
    <div class="rec-detail-info">
      <div class="rec-detail-item">
        <div class="rdl">學生</div>

        <div class="rdv">
          ${recHTML(rec.student || '—')}
          ${rec.class ? ' (' + recHTML(rec.class) + ')' : ''}
        </div>
      </div>

      <div class="rec-detail-item">
        <div class="rdl">分數</div>

        <div
          class="rdv"
          id="recDetailLiveScore"
          style="
            font-size:1.2em;
            background:var(--grad1);
            -webkit-background-clip:text;
            -webkit-text-fill-color:transparent
          "
        >
          ${recHTML(
            score.keyCount
              ? score.score
              : rec.sc
          )}
        </div>
      </div>

      <div class="rec-detail-item">
        <div class="rdl">試卷</div>

        <div
          class="rdv"
          style="font-size:.75em"
        >${recHTML(rec.paperLabel || '—')}</div>
      </div>

      <div class="rec-detail-item">
        <div class="rdl">時間</div>

        <div
          class="rdv"
          style="font-size:.78em"
        >${recHTML(rec.time)}</div>
      </div>
    </div>
  `;

  const image = recordImages[rec.id];

  if (image) {
    html += `
      <details open>
        <summary>📷 掃描圖片</summary>

        <div class="rec-img-wrap">
          <img
            src="${recHTML(image)}"
            alt="掃描圖片"
          >
        </div>
      </details>
    `;
  } else {
    html += `
      <div class="rec-no-img">
        📷 掃描圖片不可用
      </div>
    `;
  }

  html += `
    <div
      style="
        font-size:.88em;
        font-weight:700;
        color:var(--text);
        margin:16px 0 8px
      "
    >
      ✏️ 答案編輯

      <span
        style="
          font-size:.72em;
          color:var(--text3);
          font-weight:500
        "
      >（點擊選項修改，再次點擊可清空）</span>
    </div>

    <div
      class="rec-edit-grid"
      id="recEditGrid"
    ></div>

    <div
      id="recEditChanged"
      class="rec-edit-changed hidden"
    ></div>
  `;

  body.innerHTML = html;

  renderRecEditGrid(answerKey);
}

function renderRecEditGrid(answerKey) {
  const grid = document.getElementById('recEditGrid');

  if (!grid) return;

  grid.innerHTML = '';

  const totalQ = editingRecAnswers.length;

  for (let qi = 0; qi < totalQ; qi++) {
    const answer = editingRecAnswers[qi];
    const key = answerKey[qi] || '';

    const correct =
      key && isAnswerCorrect(answer, key);

    const incorrect =
      key &&
      answer &&
      !isAnswerCorrect(answer, key);

    const item = document.createElement('div');

    item.className = 'aitem';

    if (correct) {
      item.style.borderColor = 'rgba(var(--teal),.25)';
    } else if (incorrect) {
      item.style.borderColor = 'rgba(var(--rose),.2)';
    }

    let html = `
      <span
        class="qn"
        ${incorrect ? 'style="color:rgb(var(--rose))"' : ''}
      >${qi + 1}</span>
    `;

    ['A', 'B', 'C', 'D'].forEach(option => {
      let optionClass = 'o';

      if (answer === option && correct) {
        optionClass += ' sel-ok';
      } else if (
        answer === option &&
        incorrect
      ) {
        optionClass += ' sel-ng';
      } else if (answer === option) {
        optionClass += ' sel';
      } else if (
        String(key).indexOf(option) >= 0 &&
        answer !== option
      ) {
        optionClass += ' key-mark';
      }

      html += `
        <span
          class="${optionClass}"
          onclick="editRecAns(${qi},'${option}')"
        >${option}</span>
      `;
    });

    item.innerHTML = html;
    grid.appendChild(item);
  }

  /* ===== 檢查是否已修改 ===== */

  const rec = recFindById(editingRecId);

  if (!rec) return;

  const originalAnswers = String(rec.ans || '');

  let changed = false;

  for (let i = 0; i < totalQ; i++) {
    const rawOriginal = originalAnswers.charAt(i);

    const original = rawOriginal === '-'
      ? ''
      : rawOriginal;

    if (editingRecAnswers[i] !== original) {
      changed = true;
      break;
    }
  }

  const changedBox = document.getElementById('recEditChanged');

  changedBox.classList.toggle('hidden', !changed);

  /* ===== 即時更新分數 ===== */

  const paper = getRecPaperData(rec);

  const currentKey = paper
    ? paper.answerKey || []
    : [];

  const score = recScoreAnswers(
    editingRecAnswers,
    currentKey
  );

  const liveScore = document.getElementById('recDetailLiveScore');

  if (liveScore) {
    liveScore.textContent = score.keyCount
      ? score.score
      : rec.sc;
  }

  if (changed) {
    changedBox.innerHTML = score.keyCount
      ? (
          '⚠️ 答案已修改 — 新分數：' +
          `<strong>${score.score}</strong>` +
          ` (${score.percentage})`
        )
      : (
          '⚠️ 答案已修改 — ' +
          '此試卷未設定可計分答案'
        );
  }
}

function editRecAns(questionIndex, option) {
  editingRecAnswers[questionIndex] =
    editingRecAnswers[questionIndex] === option
      ? ''
      : option;

  const rec = recFindById(editingRecId);

  const paper = rec
    ? getRecPaperData(rec)
    : null;

  renderRecEditGrid(
    paper ? paper.answerKey || [] : []
  );
}

function saveRecordEdits() {
  const rec = recFindById(editingRecId);

  if (!rec) return;

  rec.ans = editingRecAnswers
    .map(answer => answer || '-')
    .join('');

  const paper = getRecPaperData(rec);

  const answerKey = paper
    ? paper.answerKey || []
    : [];

  const score = recScoreAnswers(
    editingRecAnswers,
    answerKey
  );

  if (score.keyCount) {
    rec.sc = score.score;
    rec.pct = score.percentage;
  }

  saveSettings();
  closeRecDetail();
  renderRecs();

  toast('✅ 記錄已更新');
}

function deleteOneRec() {
  if (editingRecId == null) return;

  const targetId = editingRecId;

  showConfirm(
    '⚠️ 確定要刪除此記錄嗎？',
    () => {
      records = records.filter(rec => {
        return String(rec.id) !== String(targetId);
      });

      delete recordImages[targetId];

      saveRecordImages();

      recViewingStudent = null;

      closeRecDetail();
      renderRecs();
      saveSettings();

      toast('🗑️ 已刪除');
    }
  );
}