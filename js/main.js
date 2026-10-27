/* ===== INIT & GLOBAL EVENT LISTENERS ===== */

/* ===== 格線鍵盤控制 ===== */

/*
 * group：答案組別
 * header：班號／掃描班別欄
 */
let gridKeyboardTarget = 'group';

function setGridKeyboardTarget(target) {
  gridKeyboardTarget =
    target === 'header' ? 'header' : 'group';

  const canvas = document.getElementById('cGrid');
  if (!canvas || !canvas.parentNode) return;

  let hint = document.getElementById('gridKeyboardHint');

  if (!hint) {
    hint = document.createElement('div');
    hint.id = 'gridKeyboardHint';
    hint.setAttribute('aria-live', 'polite');

    hint.style.cssText = [
      'padding:10px 12px',
      'margin-bottom:10px',
      'border:1px solid var(--border)',
      'border-radius:10px',
      'background:rgba(var(--p),.06)',
      'color:var(--text2)',
      'font-size:.78em',
      'line-height:1.8'
    ].join(';');

    canvas.parentNode.insertBefore(hint, canvas);
  }

  if (gridKeyboardTarget === 'header') {
    const labels = {
      no1: '班號十位',
      no2: '班號個位',
      cls: '掃描班別'
    };

    hint.textContent =
      `⌨️ 目前控制：${labels[selectedHdrCol] || '班號欄'}。` +
      '使用 ↑ ↓ ← → 移動；步長沿用班號微調設定。' +
      '點擊答案氣泡可切換至答案組別。';
  } else {
    hint.textContent =
      `⌨️ 目前控制：${getGroupLabel(selectedGrp)}。` +
      '使用 ↑ ↓ ← → 移動；Shift＋上下調整行距，' +
      'Shift＋左右調整選項距。' +
      '點擊班號氣泡可切換至班號欄。';
  }
}

function initGridKeyboardTargets() {
  const controls = [
    ['grpSel', 'group'],
    ['stepSz', 'group'],
    ['hdrColSel', 'header'],
    ['hdrStepSz', 'header']
  ];

  controls.forEach(([id, target]) => {
    const element = document.getElementById(id);
    if (!element) return;

    element.addEventListener('focus', () => {
      setGridKeyboardTarget(target);
    });

    element.addEventListener('pointerdown', () => {
      setGridKeyboardTarget(target);
    });

    element.addEventListener('change', () => {
      setGridKeyboardTarget(target);

      /*
       * 選好組別或班號欄後移除焦點，
       * 讓方向鍵立即用於移動格線。
       */
      if (id === 'grpSel' || id === 'hdrColSel') {
        element.blur();
      }
    });
  });

  setGridKeyboardTarget('group');
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();

  loadFromLS();
  populateDropdowns();
  loadRecordImages();

  buildGrpSel();
  updGrpDisp();
  syncDetSliders();

  buildPaperAKGrid();
  renderPaperTabs();
  renderPaperSelectList();
  renderStudentList();

  buildStepProgress();
  updateStepProgress();

  syncHeaderSliders();
  updHdrColDisp();
  updateHdrColSelOptions();

  const dz = document.getElementById('dropZone');

  if (dz) {
    dz.addEventListener('dragover', e => {
      e.preventDefault();
      dz.style.borderColor = 'rgba(var(--p),.6)';
      dz.style.background = 'rgba(var(--p),.06)';
    });

    dz.addEventListener('dragleave', () => {
      dz.style.borderColor = '';
      dz.style.background = '';
    });

    dz.addEventListener('drop', e => {
      e.preventDefault();

      dz.style.borderColor = '';
      dz.style.background = '';

      if (e.dataTransfer.files.length) {
        loadFile(e.dataTransfer.files[0]);
      }
    });
  }

  const sdz = document.getElementById('studentDropZone');

  if (sdz) {
    sdz.addEventListener('dragover', e => {
      e.preventDefault();
      sdz.style.borderColor = 'rgba(var(--amber),.6)';
      sdz.style.background = 'rgba(var(--amber),.06)';
    });

    sdz.addEventListener('dragleave', () => {
      sdz.style.borderColor = '';
      sdz.style.background = '';
    });

    sdz.addEventListener('drop', e => {
      e.preventDefault();

      sdz.style.borderColor = '';
      sdz.style.background = '';

      if (e.dataTransfer.files.length) {
        const file = e.dataTransfer.files[0];

        if (file.name.match(/\.xlsx?$/i)) {
          processStudentFile(file);
        }
      }
    });
  }

  const studentNameInput = document.getElementById('studentName');

  if (studentNameInput) {
    studentNameInput.addEventListener('input', function () {
      const select = document.getElementById('studentSelect');

      /*
       * 手動輸入姓名時同步下拉選單，
       * 避免下拉選單仍保留上一位學生。
       */
      if (select) {
        const name = this.value.trim();

        const exists = [...select.options].some(option => {
          return option.value === name;
        });

        select.value = exists ? name : '';
      }

      if (batchMode && batchResults[currentBatchIdx]) {
        batchResults[currentBatchIdx].studentName = this.value;
      }
    });
  }

  initGridKeyboardTargets();
  initFirebase();
});

/* ===== 方向鍵控制 ===== */

document.addEventListener('keydown', e => {
  if (
    e.defaultPrevented ||
    !corrCanvas ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey
  ) {
    return;
  }

  const arrows = [
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown'
  ];

  if (!arrows.includes(e.key)) return;

  const scanPage = document.getElementById('scanPage');
  const step3 = document.getElementById('scanStep3');

  const calibrationVisible = !!(
    scanPage &&
    scanPage.classList.contains('page-active') &&
    step3 &&
    step3.classList.contains('step-active')
  );

  /*
   * 支援：
   * 1. 格線校準步驟
   * 2. 掃描結果內的格線調整視窗
   */
  if (!calibrationVisible && !gridAdjustMode) return;

  /*
   * 三點校準時避免方向鍵意外移動格線。
   */
  if (calibActive || hdrCalibActive) return;

  /*
   * 提示或其他編輯視窗開啟時，
   * 不操作背後的格線。
   */
  if (
    document.querySelector(
      '#modal.show, #soOverlay.show, ' +
      '#elecOverlay.show, #recOverlay.show'
    )
  ) {
    return;
  }

  const activeElement = document.activeElement;

  /*
   * 輸入框、滑桿及下拉選單保留原有鍵盤操作。
   * 點擊畫布上的氣泡後即可操作格線。
   */
  if (
    activeElement &&
    (
      ['INPUT', 'SELECT', 'TEXTAREA'].includes(
        activeElement.tagName
      ) ||
      activeElement.isContentEditable
    )
  ) {
    return;
  }

  if (gridKeyboardTarget === 'header' && !HG.enabled) {
    return;
  }

  e.preventDefault();

  if (gridKeyboardTarget === 'header') {
    switch (e.key) {
      case 'ArrowLeft':
        nudgeHdrCol('dx', -1);
        break;

      case 'ArrowRight':
        nudgeHdrCol('dx', 1);
        break;

      case 'ArrowUp':
        nudgeHdrCol('dy', -1);
        break;

      case 'ArrowDown':
        nudgeHdrCol('dy', 1);
        break;
    }

    return;
  }

  if (e.shiftKey) {
    switch (e.key) {
      case 'ArrowUp':
        nudgeGrp('drs', -1);
        break;

      case 'ArrowDown':
        nudgeGrp('drs', 1);
        break;

      case 'ArrowLeft':
        nudgeGrp('dos', -1);
        break;

      case 'ArrowRight':
        nudgeGrp('dos', 1);
        break;
    }
  } else {
    switch (e.key) {
      case 'ArrowLeft':
        nudgeGrp('dx', -1);
        break;

      case 'ArrowRight':
        nudgeGrp('dx', 1);
        break;

      case 'ArrowUp':
        nudgeGrp('dy', -1);
        break;

      case 'ArrowDown':
        nudgeGrp('dy', 1);
        break;
    }
  }
});