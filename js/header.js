/* ===== HEADER BUBBLE DETECTION ===== */
/* 班號及選修科掃描班別偵測 */

function resetHeaderAutoOffsets() {
  headerAutoOffsets = {
    no1: { dx: 0, dy: 0 },
    no2: { dx: 0, dy: 0 },
    cls: { dx: 0, dy: 0 }
  };
}

function getHeaderBubblePos(col, row, useAutoOffset) {
  const colOff = headerColOffsets[col] || {
    dx: 0,
    dy: 0
  };

  const autoOff = useAutoOffset
    ? (headerAutoOffsets[col] || { dx: 0, dy: 0 })
    : { dx: 0, dy: 0 };

  let x = 0;

  switch (col) {
    case 'no1':
      x = HG.no1X;
      break;

    case 'no2':
      x = HG.no2X;
      break;

    case 'cls':
      x = HG.clsX;
      break;
  }

  return {
    x: x + colOff.dx + autoOff.dx,
    y:
      HG.startY +
      row * HG.rowS +
      colOff.dy +
      autoOff.dy
  };
}

function getHdrFillRatio(gray, cx, cy, thr) {
  const hw = Math.floor(HG.hbw / 2);
  const hh = Math.floor(HG.hbh / 2);

  const icx = Math.round(cx);
  const icy = Math.round(cy);

  let dark = 0;
  let count = 0;

  for (let dy = -hh; dy <= hh; dy++) {
    for (let dx = -hw; dx <= hw; dx++) {
      const px = icx + dx;
      const py = icy + dy;

      if (px >= 0 && px < CW && py >= 0 && py < CH) {
        count++;

        if (gray[py * CW + px] < thr) {
          dark++;
        }
      }
    }
  }

  return count > 0 ? dark / count : 0;
}

/* 啟用選修科時，同時對齊掃描班別欄 */
function autoAlignHeader(gray, otsuVal) {
  if (!HG.enabled) return;

  const thr = darkThr > 0 ? darkThr : otsuVal;

  const cols = electiveScanMode
    ? ['cls', 'no1', 'no2']
    : ['no1', 'no2'];

  cols.forEach(key => {
    autoAlignOneHeaderCol(
      key,
      HDR_COL_COUNTS[key],
      gray,
      thr
    );
  });
}

function autoAlignOneHeaderCol(colKey, count, gray, thr) {
  if (!gray || !count) return;

  const hw = Math.floor(HG.hbw / 2);
  const hh = Math.floor(HG.hbh / 2);

  const basePoints = [];

  for (let row = 0; row < count; row++) {
    basePoints.push(
      getHeaderBubblePos(colKey, row, false)
    );
  }

  function scoreOffset(dx, dy) {
    const ratios = [];

    for (const point of basePoints) {
      const cx = Math.round(point.x + dx);
      const cy = Math.round(point.y + dy);

      let dark = 0;
      let pixelCount = 0;

      for (let iy = -hh; iy <= hh; iy++) {
        const py = cy + iy;

        if (py < 0 || py >= CH) continue;

        const rowOffset = py * CW;

        for (let ix = -hw; ix <= hw; ix++) {
          const px = cx + ix;

          if (px >= 0 && px < CW) {
            pixelCount++;

            if (gray[rowOffset + px] < thr) {
              dark++;
            }
          }
        }
      }

      ratios.push(
        pixelCount > 0 ? dark / pixelCount : 0
      );
    }

    const mean =
      ratios.reduce((sum, value) => sum + value, 0) /
      ratios.length;

    return ratios.reduce((sum, value) => {
      return sum + (value - mean) * (value - mean);
    }, 0) / ratios.length;
  }

  /*
   * 同分時優先保留較小偏移，
   * 避免完全沒有訊號時仍移動到搜尋邊界。
   */
  function isBetter(score, dx, dy, bestScore, bx, by) {
    const epsilon = 1e-12;

    if (score > bestScore + epsilon) {
      return true;
    }

    if (Math.abs(score - bestScore) <= epsilon) {
      return dx * dx + dy * dy < bx * bx + by * by;
    }

    return false;
  }

  let bestDx = 0;
  let bestDy = 0;
  let bestScore = scoreOffset(0, 0);

  for (let dx = -12; dx <= 12; dx += 2) {
    for (let dy = -12; dy <= 12; dy += 2) {
      const score = scoreOffset(dx, dy);

      if (
        isBetter(
          score,
          dx,
          dy,
          bestScore,
          bestDx,
          bestDy
        )
      ) {
        bestScore = score;
        bestDx = dx;
        bestDy = dy;
      }
    }
  }

  let finalDx = bestDx;
  let finalDy = bestDy;
  let finalScore = bestScore;

  for (
    let dx = bestDx - 2.5;
    dx <= bestDx + 2.5;
    dx += 0.5
  ) {
    for (
      let dy = bestDy - 2.5;
      dy <= bestDy + 2.5;
      dy += 0.5
    ) {
      const score = scoreOffset(dx, dy);

      if (
        isBetter(
          score,
          dx,
          dy,
          finalScore,
          finalDx,
          finalDy
        )
      ) {
        finalScore = score;
        finalDx = dx;
        finalDy = dy;
      }
    }
  }

  headerAutoOffsets[colKey] = {
    dx: finalDx,
    dy: finalDy
  };
}

function applyHdrAutoToPersistent() {
  const keys = electiveScanMode
    ? ['cls', 'no1', 'no2']
    : ['no1', 'no2'];

  keys.forEach(key => {
    if (!headerColOffsets[key]) {
      headerColOffsets[key] = {
        dx: 0,
        dy: 0
      };
    }

    const auto = headerAutoOffsets[key] || {
      dx: 0,
      dy: 0
    };

    headerColOffsets[key].dx += auto.dx || 0;
    headerColOffsets[key].dy += auto.dy || 0;

    headerAutoOffsets[key] = {
      dx: 0,
      dy: 0
    };
  });
}

function selHdrCol(col) {
  if (!Object.prototype.hasOwnProperty.call(
    HDR_COL_COUNTS,
    col
  )) {
    return;
  }

  selectedHdrCol = col;

  const select = document.getElementById('hdrColSel');

  if (select) {
    select.value = col;
  }

  setGridKeyboardTarget('header');
  updHdrColDisp();
  drawGrid();
}

function updHdrColDisp() {
  const off = headerColOffsets[selectedHdrCol] || {
    dx: 0,
    dy: 0
  };

  const dxElement = document.getElementById('hdrColDxV');
  const dyElement = document.getElementById('hdrColDyV');

  if (dxElement) {
    dxElement.textContent = (off.dx || 0).toFixed(1);
  }

  if (dyElement) {
    dyElement.textContent = (off.dy || 0).toFixed(1);
  }
}

function nudgeHdrCol(axis, dir) {
  if (!['dx', 'dy'].includes(axis)) return;

  setGridKeyboardTarget('header');

  const step =
    +document.getElementById('hdrStepSz').value || 1;

  if (!headerColOffsets[selectedHdrCol]) {
    headerColOffsets[selectedHdrCol] = {
      dx: 0,
      dy: 0
    };
  }

  /*
   * 手動微調後，以畫布上的格線位置為準。
   */
  headerAutoOffsets[selectedHdrCol] = {
    dx: 0,
    dy: 0
  };

  headerColOffsets[selectedHdrCol][axis] =
    (headerColOffsets[selectedHdrCol][axis] || 0) +
    dir * step;

  updHdrColDisp();
  drawGrid();
  saveSettings();
}

function resetHdrCol() {
  headerColOffsets[selectedHdrCol] = {
    dx: 0,
    dy: 0
  };

  headerAutoOffsets[selectedHdrCol] = {
    dx: 0,
    dy: 0
  };

  setGridKeyboardTarget('header');
  updHdrColDisp();
  drawGrid();
  saveSettings();
}

function resetAllHdrCols() {
  ['no1', 'no2', 'cls'].forEach(key => {
    headerColOffsets[key] = {
      dx: 0,
      dy: 0
    };
  });

  resetHeaderAutoOffsets();
  updHdrColDisp();
  drawGrid();
  saveSettings();
}

function autoAlignSelectedHdrCol() {
  if (!corrGray) {
    showMsg('請先完成步驟 2');
    return;
  }

  setGridKeyboardTarget('header');

  const thr = darkThr > 0 ? darkThr : computedOtsu;

  autoAlignOneHeaderCol(
    selectedHdrCol,
    HDR_COL_COUNTS[selectedHdrCol],
    corrGray,
    thr
  );

  if (!headerColOffsets[selectedHdrCol]) {
    headerColOffsets[selectedHdrCol] = {
      dx: 0,
      dy: 0
    };
  }

  const auto = headerAutoOffsets[selectedHdrCol] || {
    dx: 0,
    dy: 0
  };

  headerColOffsets[selectedHdrCol].dx += auto.dx || 0;
  headerColOffsets[selectedHdrCol].dy += auto.dy || 0;

  headerAutoOffsets[selectedHdrCol] = {
    dx: 0,
    dy: 0
  };

  updHdrColDisp();
  drawGrid();
  saveSettings();

  toast(`✅ ${selectedHdrCol} 欄已對齊`);
}

function autoAlignAllHdrCols() {
  if (!corrGray) {
    showMsg('請先完成步驟 2');
    return;
  }

  setGridKeyboardTarget('header');

  resetHeaderAutoOffsets();
  autoAlignHeader(corrGray, computedOtsu);
  applyHdrAutoToPersistent();

  updHdrColDisp();
  drawGrid();
  saveSettings();

  toast('✅ 班號欄已對齊');
}

function readHeaderBubbles(gray, otsuVal) {
  return readHeaderBubblesFrom(gray, otsuVal);
}

function readHeaderBubblesFrom(gray, otsuVal) {
  if (!HG.enabled || !gray) return null;

  const thr = darkThr > 0 ? darkThr : otsuVal;
  const minimum = fillMin / 100;

  function readCol(col, count) {
    const ratios = [];

    for (let row = 0; row < count; row++) {
      const point = getHeaderBubblePos(col, row, true);

      ratios.push(
        getHdrFillRatio(
          gray,
          point.x,
          point.y,
          thr
        )
      );
    }

    return ratios;
  }

  function findBest(ratios) {
    const filled = [];

    for (let i = 0; i < ratios.length; i++) {
      if (ratios[i] >= minimum) {
        filled.push(i);
      }
    }

    if (filled.length === 1) {
      return filled[0];
    }

    if (filled.length > 1) {
      let best = -1;
      let bestRatio = -1;

      filled.forEach(index => {
        if (ratios[index] > bestRatio) {
          bestRatio = ratios[index];
          best = index;
        }
      });

      return best >= 0 ? best : null;
    }

    return null;
  }

  const no1Ratios = readCol('no1', HDR_COL_COUNTS.no1);
  const no2Ratios = readCol('no2', HDR_COL_COUNTS.no2);

  const no1Index = findBest(no1Ratios);
  const no2Index = findBest(no2Ratios);

  const number =
    no1Index !== null && no2Index !== null
      ? no1Index * 10 + no2Index
      : null;

  let classLetter = null;
  let clsRatios = null;

  if (electiveScanMode) {
    clsRatios = readCol('cls', HDR_COL_COUNTS.cls);

    const classIndex = findBest(clsRatios);

    classLetter = classIndex !== null
      ? ELEC_CLASS_LETTERS[classIndex]
      : null;
  }

  return {
    number,
    classLetter,
    no1Ratios,
    no2Ratios,
    clsRatios,
    matchedStudent: null
  };
}

/*
 * 一般班別：以班號匹配。
 * 選修班別：以原班別及原班號匹配。
 */
function autoDetectStudent(hdrInfo) {
  if (!hdrInfo || !selectedScanClass) return null;

  const year = getYearFromPaper();
  if (!year) return null;

  const students = (studentDB[year] || []).filter(student => {
    return student.class === selectedScanClass;
  });

  if (
    hdrInfo.number === null ||
    hdrInfo.number === 0
  ) {
    return null;
  }

  if (electiveScanMode) {
    if (!hdrInfo.classLetter) return null;

    const gradeNumber = getGradeNumFromPaper();
    if (!gradeNumber) return null;

    const fullClass = gradeNumber + hdrInfo.classLetter;

    return students.find(student => {
      return (
        student.origClass === fullClass &&
        (student.origNumber || 0) === hdrInfo.number
      );
    }) || null;
  }

  return students.find(student => {
    return student.number === hdrInfo.number;
  }) || null;
}

function applyHeaderDetection() {
  if (!detectedHeaderInfo) return;

  const student = autoDetectStudent(detectedHeaderInfo);

  detectedHeaderInfo.matchedStudent = student;

  if (!student) return;

  /*
   * 即時套用，避免延遲回呼在切換批量頁面後
   * 把上一頁的學生姓名填到下一頁。
   */
  if (batchMode && batchResults[currentBatchIdx]) {
    batchResults[currentBatchIdx].studentName = student.name;
  }

  populateStudentDropdown();

  const select = document.getElementById('studentSelect');
  const input = document.getElementById('studentName');

  if (select) {
    select.value = student.name;
  }

  if (input) {
    input.value = student.name;
  }
}

function renderHeaderDetectUI() {
  const bar = document.getElementById('headerDetectBar');
  const note = document.getElementById('hdrOverrideNote');

  if (!bar || !note) return;

  if (!detectedHeaderInfo || !HG.enabled) {
    bar.classList.add('hidden');
    note.classList.add('hidden');
    return;
  }

  const info = detectedHeaderInfo;
  const student = info.matchedStudent;

  const numberOK =
    info.number !== null &&
    info.number > 0;

  const classOK =
    !electiveScanMode ||
    !!info.classLetter;

  const allOK = !!(numberOK && classOK && student);

  bar.className = 'hdr-bar ' + (
    allOK
      ? 'hdr-found'
      : numberOK && classOK
        ? 'hdr-partial'
        : 'hdr-none'
  );

  let html = allOK
    ? '🎯 學生自動偵測成功 '
    : '⚠️ 班號偵測 ';

  if (electiveScanMode) {
    html += info.classLetter
      ? `
        <span class="hdr-chip hdr-chip-ok">
          掃描班別 ${escAttr(info.classLetter)}
        </span>
      `
      : `
        <span class="hdr-chip hdr-chip-warn">
          掃描班別 ？
        </span>
      `;
  }

  html += numberOK
    ? `
      <span class="hdr-chip hdr-chip-ok">
        班號 ${info.number}
      </span>
    `
    : `
      <span class="hdr-chip hdr-chip-warn">
        班號 ？
      </span>
    `;

  if (electiveScanMode && info.classLetter && numberOK) {
    const gradeNumber = getGradeNumFromPaper();

    if (gradeNumber) {
      html += `
        <span class="hdr-chip hdr-chip-info">
          → ${escAttr(gradeNumber + info.classLetter)}
          #${info.number}
        </span>
      `;
    }
  } else if (selectedScanClass) {
    html += `
      <span class="hdr-chip hdr-chip-info">
        → ${escAttr(selectedScanClass)} 班
      </span>
    `;
  }

  const keys = electiveScanMode
    ? ['cls', 'no1', 'no2']
    : ['no1', 'no2'];

  const hasAutoOffset = keys.some(key => {
    const off = headerAutoOffsets[key];

    return off && (
      Math.abs(off.dx) > 0.1 ||
      Math.abs(off.dy) > 0.1
    );
  });

  if (hasAutoOffset) {
    html += `
      <span class="hdr-auto-tag">
        ⚡ 已自動校準
      </span>
    `;
  }

  if (student) {
    const metaClass = electiveScanMode
      ? (student.origClass || '')
      : selectedScanClass;

    const metaNumber = electiveScanMode
      ? (
          student.origNumber != null
            ? student.origNumber
            : student.number
        )
      : student.number;

    html += `
      <div
        class="hdr-stu-match"
        style="width:100%;margin-top:6px"
      >
        <div style="font-size:1.5em">👤</div>

        <div>
          <div class="hsm-name">
            ${escAttr(student.name)}
          </div>

          <div class="hsm-meta">
            ${escAttr(metaClass)} 班
            · 學號 ${escAttr(metaNumber)}
            ${
              electiveScanMode
                ? ' · 選修：' + escAttr(selectedScanClass)
                : ''
            }
          </div>
        </div>
      </div>
    `;

    note.classList.remove('hidden');
  } else {
    const warningStyle =
      'width:100%;font-size:.76em;' +
      'color:rgb(var(--amber));margin-top:4px';

    if (electiveScanMode && !info.classLetter) {
      html += `
        <div style="${warningStyle}">
          ⚠️ 未能偵測掃描班別，
          請確認已塗滿班別欄（A–H、S）
        </div>
      `;
    } else if (numberOK && selectedScanClass) {
      const gradeNumber = getGradeNumFromPaper();

      const tip =
        electiveScanMode &&
        info.classLetter &&
        gradeNumber
          ? (
              `${gradeNumber}${info.classLetter} 班 ` +
              `學號 ${info.number}`
            )
          : (
              `${selectedScanClass} 班 ` +
              `學號 ${info.number}`
            );

      html += `
        <div style="${warningStyle}">
          ⚠️ 在學生資料庫中找不到 ${escAttr(tip)}
        </div>
      `;
    } else if (numberOK && !selectedScanClass) {
      html += `
        <div style="${warningStyle}">
          ⚠️ 請先選擇班別以匹配學生
        </div>
      `;
    }

    note.classList.add('hidden');
  }

  bar.innerHTML = html;
}

function syncHeaderSliders() {
  document.getElementById('sHN1').value = HG.no1X;
  document.getElementById('sHN2').value = HG.no2X;
  document.getElementById('sHSY').value = HG.startY;
  document.getElementById('sHRS').value = HG.rowS;
  document.getElementById('sHBW').value = HG.hbw;
  document.getElementById('sHBH').value = HG.hbh;
  document.getElementById('hdrEnabled').checked = HG.enabled;

  updHeaderSliderVals();
}

function updHeaderSliderVals() {
  document.getElementById('vHN1').textContent = HG.no1X;
  document.getElementById('vHN2').textContent = HG.no2X;
  document.getElementById('vHSY').textContent = HG.startY;
  document.getElementById('vHRS').textContent = HG.rowS;
  document.getElementById('vHBW').textContent = HG.hbw;
  document.getElementById('vHBH').textContent = HG.hbh;
}

function onHeaderSlider() {
  HG.no1X = +document.getElementById('sHN1').value;
  HG.no2X = +document.getElementById('sHN2').value;
  HG.startY = +document.getElementById('sHSY').value;
  HG.rowS = +document.getElementById('sHRS').value;
  HG.hbw = +document.getElementById('sHBW').value;
  HG.hbh = +document.getElementById('sHBH').value;

  resetHeaderAutoOffsets();
  setGridKeyboardTarget('header');

  updHeaderSliderVals();
  drawGrid();
  saveSettings();
}

function resetHeaderDefaults() {
  HG = {
    no1X: 288,
    no2X: 324,
    startY: 167,
    rowS: 27.5,
    hbw: 14,
    hbh: 10,
    enabled: true,
    clsX: 252
  };

  headerColOffsets = {
    no1: { dx: 0, dy: 0 },
    no2: { dx: 0, dy: 0 },
    cls: { dx: 0, dy: 0 }
  };

  resetHeaderAutoOffsets();

  syncHeaderSliders();
  updHdrColDisp();
  drawGrid();
  saveSettings();
}

function testHeaderRead() {
  if (!corrGray) {
    showMsg('請先完成步驟 2（四角定位）');
    return;
  }

  resetHeaderAutoOffsets();
  autoAlignHeader(corrGray, computedOtsu);

  const info = readHeaderBubbles(corrGray, computedOtsu);
  const box = document.getElementById('headerTestResult');

  box.classList.remove('hidden');

  if (!info) {
    box.className = 'status s-err';
    box.innerHTML = '偵測已停用';
    return;
  }

  const student = autoDetectStudent(info);

  let html = '<strong>偵測結果：</strong><br>';

  if (electiveScanMode && info.clsRatios) {
    html +=
      `掃描班別：${info.classLetter || '？'} ` +
      `[${info.clsRatios.map(r => Math.round(r * 100) + '%').join(', ')}]` +
      '<br>';
  }

  html +=
    `班號十位：${findMaxIdx(info.no1Ratios)} ` +
    `[${info.no1Ratios.map(r => Math.round(r * 100) + '%').join(', ')}]` +
    '<br>';

  html +=
    `班號個位：${findMaxIdx(info.no2Ratios)} ` +
    `[${info.no2Ratios.map(r => Math.round(r * 100) + '%').join(', ')}]` +
    '<br>';

  html +=
    '→ 班號：<strong>' +
    (info.number !== null ? info.number : '？') +
    '</strong>';

  if (
    electiveScanMode &&
    info.classLetter &&
    info.number
  ) {
    const gradeNumber = getGradeNumFromPaper();

    if (gradeNumber) {
      html +=
        ' · 對應原班：<strong>' +
        escAttr(gradeNumber + info.classLetter) +
        ` #${info.number}</strong>`;
    }
  }

  if (selectedScanClass) {
    html +=
      ' · 班別：<strong>' +
      escAttr(selectedScanClass) +
      '</strong>';
  }

  if (student) {
    html +=
      '<br>✅ 匹配學生：<strong>' +
      escAttr(student.name) +
      '</strong>';
  } else if (info.number && selectedScanClass) {
    html += '<br>⚠️ 未能匹配學生';
  } else if (info.number && !selectedScanClass) {
    html += '<br>⚠️ 請先選擇班別';
  }

  const keys = electiveScanMode
    ? ['cls', 'no1', 'no2']
    : ['no1', 'no2'];

  const offsetsText = keys.map(key => {
    const off = headerAutoOffsets[key] || {
      dx: 0,
      dy: 0
    };

    return (
      `${key}(` +
      `${off.dx.toFixed(1)},${off.dy.toFixed(1)})`
    );
  }).join(' ');

  html += `
    <br>
    <span style="font-size:.72em;color:var(--text3)">
      ⚡ 自動校準偏移：${offsetsText}
    </span>
  `;

  box.className = 'status ' + (student ? 's-ok' : 's-info');
  box.innerHTML = html;
}

function findMaxIdx(arr) {
  let maximum = -1;
  let maximumIndex = -1;

  arr.forEach((value, index) => {
    if (value > maximum) {
      maximum = value;
      maximumIndex = index;
    }
  });

  return maximumIndex >= 0
    ? maximumIndex + '(' + Math.round(maximum * 100) + '%)'
    : '?';
}

function startHeaderCalib() {
  if (calibActive) {
    cancelCalib();
  }

  hdrCalibActive = true;
  hdrCalibStep = 0;
  hdrCalibPts = [];

  setGridKeyboardTarget('header');

  const status = document.getElementById('calibStatus');

  status.innerHTML =
    '🔢 班號校準 [1/3]：點擊 <strong>' +
    HDR_CALIB_LABELS[0] +
    '</strong>';

  status.style.cssText =
    'background:rgba(34,211,238,.08);' +
    'border-color:rgba(34,211,238,.15);' +
    'color:rgb(34,211,238)';

  drawGrid();
}

function handleHeaderCalibClick(cx, cy) {
  hdrCalibPts.push({
    x: cx,
    y: cy
  });

  hdrCalibStep++;

  if (hdrCalibStep < 3) {
    document.getElementById('calibStatus').innerHTML =
      `🔢 班號校準 [${hdrCalibStep + 1}/3]：` +
      '<strong>' +
      HDR_CALIB_LABELS[hdrCalibStep] +
      '</strong>';
  } else {
    finishHeaderCalib();
  }

  drawGrid();
}

function finishHeaderCalib() {
  hdrCalibActive = false;

  const [p1, p2, p3] = hdrCalibPts;

  if (!p1 || !p2 || !p3) return;

  HG.no1X = p1.x;
  HG.startY = p1.y;

  const dy = p2.y - p1.y;

  if (dy > 1) {
    HG.rowS = dy / 9;
  }

  HG.no2X = p3.x;

  /*
   * 掃描班別欄放在十位左方，
   * 與十位、個位保持等距。
   */
  HG.clsX = HG.no1X - (HG.no2X - HG.no1X);

  resetAllHdrCols();
  syncHeaderSliders();
  drawGrid();
  saveSettings();

  const status = document.getElementById('calibStatus');

  status.innerHTML = '✅ 班號校準完成！';

  status.style.cssText =
    'background:rgba(52,211,153,.08);' +
    'border-color:rgba(52,211,153,.15);' +
    'color:rgb(52,211,153)';
}

function updateHdrColSelOptions() {
  const select = document.getElementById('hdrColSel');
  if (!select) return;

  const current = selectedHdrCol;

  let options = '';

  if (electiveScanMode) {
    options +=
      '<option value="cls">掃描班別 (A–H、S)</option>';
  }

  options +=
    '<option value="no1">班號十位</option>' +
    '<option value="no2">班號個位</option>';

  select.innerHTML = options;

  const valid = [...select.options].some(option => {
    return option.value === current;
  });

  if (!valid) {
    selectedHdrCol = electiveScanMode ? 'cls' : 'no1';
  }

  select.value = selectedHdrCol;

  updHdrColDisp();
}