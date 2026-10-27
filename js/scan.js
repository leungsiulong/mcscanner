/* ===== scan.js — FILE / CAMERA / PDF / GRID / SCAN ===== */

/*
 * 批量掃描工作編號。
 * 重新掃描或離開批量模式後，
 * 舊的背景工作不會覆寫新的結果。
 */
let batchScanRunId = 0;

/* ===== 共用工具 ===== */

function cloneHeaderOffsets(source) {
  const result = {};

  ['no1', 'no2', 'cls'].forEach(key => {
    const off = source && source[key]
      ? source[key]
      : { dx: 0, dy: 0 };

    result[key] = {
      dx: Number(off.dx) || 0,
      dy: Number(off.dy) || 0
    };
  });

  return result;
}

function getAnswerFromScanResult(result) {
  if (!result) return '';

  return result.manual !== undefined
    ? result.manual
    : (result.auto || '');
}

function refreshScanStudentDropdown() {
  const input = document.getElementById('studentName');
  const select = document.getElementById('studentSelect');

  const previousName =
    (input && input.value) ||
    (select && select.value) ||
    '';

  populateStudentDropdown();

  /*
   * 單張模式重新繪製答案時，
   * 保留老師已選擇／輸入的學生。
   */
  if (!batchMode && previousName) {
    if (input) {
      input.value = previousName;
    }

    if (select) {
      select.value = previousName;
    }
  }
}

/* ===== FILE / CAMERA ===== */

function onFile(e) {
  const file = e.target.files[0];

  if (file) {
    loadFile(file);
  }

  e.target.value = '';
}

function loadFile(file) {
  if (
    file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf')
  ) {
    loadPDF(file);
    return;
  }

  closePdfControls();
  showUploadProgress(0, '讀取圖片中…');

  const reader = new FileReader();

  reader.onprogress = e => {
    if (e.lengthComputable) {
      showUploadProgress(
        e.loaded / e.total * 90,
        '讀取圖片中…'
      );
    }
  };

  reader.onload = e => {
    showUploadProgress(95, '載入圖片…');

    const image = new Image();

    image.onload = () => {
      showUploadProgress(100, '✅ 完成！');

      setTimeout(hideUploadProgress, 250);
      processImg(image);
    };

    image.onerror = () => {
      hideUploadProgress();
      showMsg('⚠️ 無法載入圖片');
    };

    image.src = e.target.result;
  };

  reader.onerror = () => {
    hideUploadProgress();
    showMsg('⚠️ 無法讀取檔案');
  };

  reader.readAsDataURL(file);
}

function toggleCam() {
  const box = document.getElementById('camBox');
  const video = document.getElementById('camVid');

  if (camStream) {
    camStream.getTracks().forEach(track => track.stop());
    camStream = null;
    box.classList.add('hidden');
    return;
  }

  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {
    showMsg('此瀏覽器無法使用相機');
    return;
  }

  navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: 'environment',
      width: {
        ideal: 1920
      }
    }
  }).then(stream => {
    camStream = stream;
    video.srcObject = stream;
    box.classList.remove('hidden');
  }).catch(() => {
    showMsg('無法開啟相機');
  });
}

function capture() {
  const video = document.getElementById('camVid');

  if (!video.videoWidth || !video.videoHeight) {
    showMsg('請先等待相機畫面載入');
    return;
  }

  const canvas = document.createElement('canvas');

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  canvas.getContext('2d').drawImage(video, 0, 0);

  toggleCam();
  closePdfControls();

  const image = new Image();

  image.onload = () => {
    processImg(image);
  };

  image.src = canvas.toDataURL('image/jpeg', 0.92);
}

function closePdfControls() {
  document.getElementById('pdfControls')
    .classList.add('hidden');

  pdfDoc = null;
  totalPdfPages = 0;
  currentPdfPage = 1;
  pdfRenderedImg = null;
}

/* ===== 上載進度 ===== */

function showUploadProgress(pct, status) {
  const box = document.getElementById('uploadProgress');
  if (!box) return;

  box.classList.remove('hidden');

  pct = Math.max(
    0,
    Math.min(100, Math.round(pct))
  );

  const ring = document.getElementById('upRing');
  const percentage = document.getElementById('upPct');
  const bar = document.getElementById('upBarFill');
  const statusElement = document.getElementById('upStatus');

  if (ring) {
    ring.style.setProperty('--upct', pct);
  }

  if (percentage) {
    percentage.textContent = pct + '%';
  }

  if (bar) {
    bar.style.width = pct + '%';
  }

  if (status !== undefined && statusElement) {
    statusElement.textContent = status;
  }
}

function hideUploadProgress() {
  const box = document.getElementById('uploadProgress');

  if (box) {
    box.classList.add('hidden');
  }
}

/* ===== PDF ===== */

async function loadPDF(file) {
  if (typeof pdfjsLib === 'undefined') {
    showMsg('⚠️ PDF.js 載入失敗');
    return;
  }

  document.getElementById('pdfControls')
    .classList.remove('hidden');

  document.getElementById('pdfLoading')
    .classList.add('hidden');

  showUploadProgress(5, '讀取 PDF 檔案中…');

  try {
    const arrayBuffer = await file.arrayBuffer();

    showUploadProgress(15, '解析 PDF 文件…');

    pdfDoc = await pdfjsLib.getDocument({
      data: arrayBuffer
    }).promise;

    totalPdfPages = pdfDoc.numPages;
    currentPdfPage = 1;

    document.getElementById('pdfPageInfo')
      .textContent = `1/${totalPdfPages}`;

    showUploadProgress(
      28,
      `共 ${totalPdfPages} 頁 · 產生縮圖中…`
    );

    await buildPdfThumbnails(fraction => {
      showUploadProgress(
        28 + Math.round(fraction * 42),
        `產生縮圖中… ${Math.round(fraction * 100)}%`
      );
    });

    showUploadProgress(75, '渲染第 1 頁…');

    await renderPdfPage(1);

    showUploadProgress(100, '✅ 載入完成！');

    toast(
      `📄 PDF ${totalPdfPages} 頁，已自動載入第 1 頁`
    );

    setTimeout(hideUploadProgress, 400);

    usePdfPage();
  } catch (error) {
    hideUploadProgress();

    showMsg(
      '⚠️ 無法讀取 PDF：' +
      escAttr(error.message)
    );
  }
}

async function buildPdfThumbnails(onProgress) {
  const strip = document.getElementById('pdfThumbStrip');

  strip.innerHTML = '';

  if (!pdfDoc) return;

  const total = Math.min(totalPdfPages, 30);

  for (let pageNumber = 1; pageNumber <= total; pageNumber++) {
    try {
      const page = await pdfDoc.getPage(pageNumber);
      const viewport = page.getViewport({
        scale: 0.15
      });

      const canvas = document.createElement('canvas');

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvasContext: canvas.getContext('2d'),
        viewport
      }).promise;

      const image = document.createElement('img');

      image.src = canvas.toDataURL();
      image.className =
        'pdf-thumb' +
        (pageNumber === currentPdfPage ? ' active' : '');

      image.dataset.page = pageNumber;

      image.onclick = () => {
        pdfGoPage(pageNumber);
      };

      strip.appendChild(image);
    } catch (error) {
      /* 單張縮圖失敗不阻止載入其餘頁面 */
    }

    if (onProgress) {
      onProgress(pageNumber / total);
    }
  }
}

async function renderPdfPage(pageNumber) {
  if (
    !pdfDoc ||
    pageNumber < 1 ||
    pageNumber > totalPdfPages
  ) {
    return;
  }

  currentPdfPage = pageNumber;

  document.getElementById('pdfPageInfo')
    .textContent = `${pageNumber}/${totalPdfPages}`;

  document.querySelectorAll('.pdf-thumb').forEach(thumb => {
    thumb.classList.toggle(
      'active',
      +thumb.dataset.page === pageNumber
    );
  });

  const dpi =
    +document.getElementById('pdfDpiSel').value || 300;

  const page = await pdfDoc.getPage(pageNumber);

  const viewport = page.getViewport({
    scale: dpi / 72
  });

  const canvas = document.getElementById('cPdfPreview');

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const context = canvas.getContext('2d');

  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({
    canvasContext: context,
    viewport
  }).promise;

  const image = new Image();

  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => {
      reject(new Error('PDF 頁面圖片載入失敗'));
    };

    image.src = canvas.toDataURL('image/png');
  });

  pdfRenderedImg = image;
}

async function pdfGoPage(pageNumber) {
  if (!pdfDoc) return;

  pageNumber = Math.max(
    1,
    Math.min(pageNumber, totalPdfPages)
  );

  document.getElementById('pdfLoading')
    .classList.remove('hidden');

  try {
    await renderPdfPage(pageNumber);
  } catch (error) {
    showMsg('⚠️ 無法載入此頁');
  }

  document.getElementById('pdfLoading')
    .classList.add('hidden');
}

function usePdfPage() {
  if (!pdfRenderedImg) {
    showMsg('請先等待 PDF 渲染完成');
    return;
  }

  if (!pdfRenderedImg.complete) {
    const image = pdfRenderedImg;

    image.onload = () => {
      processImg(image);
    };

    return;
  }

  processImg(pdfRenderedImg);
}

function processImg(image) {
  batchScanRunId++;

  batchMode = false;
  batchResults = [];
  currentBatchIdx = 0;

  srcImg = image;
  corrCanvas = null;
  corrGray = null;
  scanResults = [];
  detectedHeaderInfo = null;

  resetHeaderAutoOffsets();

  const nameInput = document.getElementById('studentName');
  const studentSelect = document.getElementById('studentSelect');

  if (nameInput) nameInput.value = '';
  if (studentSelect) studentSelect.value = '';

  const canvas = document.getElementById('cCorner');

  const maximumWidth = Math.max(
    1,
    Math.min(780, window.innerWidth - 40)
  );

  cScale = Math.min(
    1,
    maximumWidth / image.width
  );

  canvas.width = Math.round(image.width * cScale);
  canvas.height = Math.round(image.height * cScale);

  if (cornerRatios && cornerRatios.length === 4) {
    corners = cornerRatios.map(corner => ({
      x: corner.rx * image.width,
      y: corner.ry * image.height
    }));

    document.getElementById('cornerSavedHint')
      .textContent = '（已載入上次位置）';
  } else {
    corners = [
      { x: image.width * 0.04, y: image.height * 0.02 },
      { x: image.width * 0.96, y: image.height * 0.02 },
      { x: image.width * 0.96, y: image.height * 0.98 },
      { x: image.width * 0.04, y: image.height * 0.98 }
    ];

    autoCorners();

    document.getElementById('cornerSavedHint')
      .textContent = '';
  }

  drawCorners();
  setupCornerDrag();

  maxReachedStep = 2;
  showScanStep(2);
}

/* ===== 四角定位 ===== */

function autoCorners() {
  if (!srcImg) return;

  const canvas = document.createElement('canvas');

  const width = srcImg.width;
  const height = srcImg.height;

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  context.drawImage(srcImg, 0, 0);

  const data = context.getImageData(
    0,
    0,
    width,
    height
  ).data;

  const gray = new Uint8Array(width * height);

  for (let i = 0; i < width * height; i++) {
    gray[i] = Math.round(
      data[i * 4] * 0.299 +
      data[i * 4 + 1] * 0.587 +
      data[i * 4 + 2] * 0.114
    );
  }

  const threshold = otsu(gray, width * height);
  const binary = new Uint8Array(width * height);

  for (let i = 0; i < gray.length; i++) {
    binary[i] = gray[i] < threshold ? 1 : 0;
  }

  const regionWidth = Math.floor(width * 0.12);
  const regionHeight = Math.floor(height * 0.08);

  const regions = [
    {
      sx: 0,
      sy: 0,
      ex: regionWidth,
      ey: regionHeight,
      c: 0
    },
    {
      sx: width - regionWidth,
      sy: 0,
      ex: width,
      ey: regionHeight,
      c: 1
    },
    {
      sx: width - regionWidth,
      sy: height - regionHeight,
      ex: width,
      ey: height,
      c: 2
    },
    {
      sx: 0,
      sy: height - regionHeight,
      ex: regionWidth,
      ey: height,
      c: 3
    }
  ];

  regions.forEach(region => {
    const points = [];

    for (
      let y = region.sy;
      y < Math.min(region.ey, height);
      y++
    ) {
      for (
        let x = region.sx;
        x < Math.min(region.ex, width);
        x++
      ) {
        if (binary[y * width + x]) {
          points.push({ x, y });
        }
      }
    }

    if (points.length < 20) return;

    points.forEach(point => {
      switch (region.c) {
        case 0:
          point.score = -(point.x + point.y);
          break;

        case 1:
          point.score = point.x - point.y;
          break;

        case 2:
          point.score = point.x + point.y;
          break;

        case 3:
          point.score = point.y - point.x;
          break;
      }
    });

    points.sort((a, b) => b.score - a.score);

    const count = Math.max(
      3,
      Math.floor(points.length * 0.03)
    );

    let sumX = 0;
    let sumY = 0;

    for (let i = 0; i < count; i++) {
      sumX += points[i].x;
      sumY += points[i].y;
    }

    corners[region.c] = {
      x: sumX / count,
      y: sumY / count
    };
  });

  drawCorners();
}

function drawCorners() {
  if (!srcImg) return;

  const canvas = document.getElementById('cCorner');
  const context = canvas.getContext('2d');

  context.clearRect(0, 0, canvas.width, canvas.height);

  context.drawImage(
    srcImg,
    0,
    0,
    canvas.width,
    canvas.height
  );

  context.beginPath();
  context.strokeStyle = 'rgba(139,92,246,.5)';
  context.lineWidth = 2;

  corners.forEach((point, index) => {
    const x = point.x * cScale;
    const y = point.y * cScale;

    if (index) {
      context.lineTo(x, y);
    } else {
      context.moveTo(x, y);
    }
  });

  context.closePath();
  context.stroke();

  ['TL', 'TR', 'BR', 'BL'].forEach((label, index) => {
    const x = corners[index].x * cScale;
    const y = corners[index].y * cScale;

    context.beginPath();
    context.arc(x, y, 10, 0, Math.PI * 2);

    context.fillStyle =
      dragIdx === index
        ? '#fbbf24'
        : 'rgb(139,92,246)';

    context.fill();

    context.strokeStyle = '#fff';
    context.lineWidth = 2;
    context.stroke();

    context.fillStyle = '#fff';
    context.font = 'bold 11px Inter,sans-serif';
    context.fillText(label, x + 13, y + 4);
  });
}

function setupCornerDrag() {
  const canvas = document.getElementById('cCorner');

  function getPoint(e) {
    const rect = canvas.getBoundingClientRect();

    const clientX = e.touches
      ? e.touches[0].clientX
      : e.clientX;

    const clientY = e.touches
      ? e.touches[0].clientY
      : e.clientY;

    return {
      x:
        (clientX - rect.left) *
        canvas.width / rect.width / cScale,

      y:
        (clientY - rect.top) *
        canvas.height / rect.height / cScale
    };
  }

  let dragging = false;

  function down(e) {
    e.preventDefault();

    const point = getPoint(e);
    let nearestDistance = Infinity;

    corners.forEach((corner, index) => {
      const distance = Math.hypot(
        corner.x - point.x,
        corner.y - point.y
      );

      if (distance < nearestDistance) {
        nearestDistance = distance;
        dragIdx = index;
      }
    });

    if (nearestDistance > 40 / cScale) {
      dragIdx = -1;
    } else {
      dragging = true;
    }

    drawCorners();
  }

  function move(e) {
    if (!dragging || dragIdx < 0) return;

    e.preventDefault();

    corners[dragIdx] = getPoint(e);
    drawCorners();
  }

  function up() {
    dragging = false;
    dragIdx = -1;
    drawCorners();
  }

  canvas.onmousedown = down;
  canvas.onmousemove = move;
  canvas.onmouseup = up;
  canvas.onmouseleave = up;

  canvas.ontouchstart = down;
  canvas.ontouchmove = move;
  canvas.ontouchend = up;
}

/* ===== 透視校正 ===== */

function solveLS(A, b) {
  const n = b.length;

  const matrix = A.map((row, index) => {
    return [...row, b[index]];
  });

  for (let column = 0; column < n; column++) {
    let maximum = Math.abs(matrix[column][column]);
    let maximumRow = column;

    for (let row = column + 1; row < n; row++) {
      if (Math.abs(matrix[row][column]) > maximum) {
        maximum = Math.abs(matrix[row][column]);
        maximumRow = row;
      }
    }

    if (maximum < 1e-12) {
      throw new Error('四角位置無效，請重新定位');
    }

    if (maximumRow !== column) {
      [matrix[column], matrix[maximumRow]] =
        [matrix[maximumRow], matrix[column]];
    }

    for (let row = column + 1; row < n; row++) {
      const factor =
        matrix[row][column] /
        matrix[column][column];

      for (let j = column; j <= n; j++) {
        matrix[row][j] -= factor * matrix[column][j];
      }
    }
  }

  const result = new Array(n);

  for (let i = n - 1; i >= 0; i--) {
    result[i] = matrix[i][n];

    for (let j = i + 1; j < n; j++) {
      result[i] -= matrix[i][j] * result[j];
    }

    result[i] /= matrix[i][i];
  }

  return result;
}

function computeH(src, dst) {
  const A = [];
  const b = [];

  for (let i = 0; i < 4; i++) {
    const u = dst[i].x;
    const v = dst[i].y;
    const x = src[i].x;
    const y = src[i].y;

    A.push([
      u, v, 1,
      0, 0, 0,
      -u * x, -v * x
    ]);

    b.push(x);

    A.push([
      0, 0, 0,
      u, v, 1,
      -u * y, -v * y
    ]);

    b.push(y);
  }

  const h = solveLS(A, b);

  return (dx, dy) => {
    const w = h[6] * dx + h[7] * dy + 1;

    return {
      x:
        (h[0] * dx + h[1] * dy + h[2]) /
        w,

      y:
        (h[3] * dx + h[4] * dy + h[5]) /
        w
    };
  };
}

function otsu(gray, length) {
  const histogram = new Array(256).fill(0);

  for (let i = 0; i < length; i++) {
    histogram[gray[i]]++;
  }

  let sum = 0;

  for (let i = 0; i < 256; i++) {
    sum += i * histogram[i];
  }

  let backgroundSum = 0;
  let backgroundWeight = 0;
  let maximumVariance = 0;
  let threshold = 128;

  for (let i = 0; i < 256; i++) {
    backgroundWeight += histogram[i];

    if (!backgroundWeight) continue;

    const foregroundWeight =
      length - backgroundWeight;

    if (!foregroundWeight) break;

    backgroundSum += i * histogram[i];

    const backgroundMean =
      backgroundSum / backgroundWeight;

    const foregroundMean =
      (sum - backgroundSum) / foregroundWeight;

    const variance =
      backgroundWeight *
      foregroundWeight *
      (backgroundMean - foregroundMean) *
      (backgroundMean - foregroundMean);

    if (variance > maximumVariance) {
      maximumVariance = variance;
      threshold = i;
    }
  }

  /*
   * 偵測程式使用 gray < threshold。
   * 閾值最低為 1，避免純黑像素值 0 被排除。
   */
  return Math.max(1, threshold);
}

function perspectiveTransformImg(image) {
  const sourceCanvas = document.createElement('canvas');

  sourceCanvas.width = image.width;
  sourceCanvas.height = image.height;

  const sourceContext = sourceCanvas.getContext('2d');
  sourceContext.drawImage(image, 0, 0);

  const sourceData = sourceContext.getImageData(
    0,
    0,
    sourceCanvas.width,
    sourceCanvas.height
  );

  const canvas = document.createElement('canvas');

  canvas.width = CW;
  canvas.height = CH;

  const context = canvas.getContext('2d');
  const destinationData = context.createImageData(CW, CH);

  /*
   * 校正範圍之外使用白色，
   * 避免透明黑色影響閾值。
   */
  destinationData.data.fill(255);

  const imageCorners = cornerRatios.map(corner => ({
    x: corner.rx * image.width,
    y: corner.ry * image.height
  }));

  const destinationCorners = [
    { x: 0, y: 0 },
    { x: CW, y: 0 },
    { x: CW, y: CH },
    { x: 0, y: CH }
  ];

  const map = computeH(
    imageCorners,
    destinationCorners
  );

  for (let dy = 0; dy < CH; dy++) {
    for (let dx = 0; dx < CW; dx++) {
      const source = map(dx, dy);

      const ix = Math.round(source.x);
      const iy = Math.round(source.y);

      if (
        ix >= 0 &&
        ix < sourceCanvas.width &&
        iy >= 0 &&
        iy < sourceCanvas.height
      ) {
        const sourceIndex =
          (iy * sourceCanvas.width + ix) * 4;

        const destinationIndex =
          (dy * CW + dx) * 4;

        destinationData.data[destinationIndex] =
          sourceData.data[sourceIndex];

        destinationData.data[destinationIndex + 1] =
          sourceData.data[sourceIndex + 1];

        destinationData.data[destinationIndex + 2] =
          sourceData.data[sourceIndex + 2];

        destinationData.data[destinationIndex + 3] = 255;
      }
    }
  }

  context.putImageData(destinationData, 0, 0);

  const gray = new Uint8Array(CW * CH);

  for (let i = 0; i < CW * CH; i++) {
    gray[i] = Math.round(
      destinationData.data[i * 4] * 0.299 +
      destinationData.data[i * 4 + 1] * 0.587 +
      destinationData.data[i * 4 + 2] * 0.114
    );
  }

  return {
    canvas,
    gray,
    otsuVal: otsu(gray, CW * CH)
  };
}

function doPerspective() {
  if (!srcImg) return;

  cornerRatios = corners.map(corner => ({
    rx: corner.x / srcImg.width,
    ry: corner.y / srcImg.height
  }));

  try {
    const result = perspectiveTransformImg(srcImg);

    corrCanvas = result.canvas;
    corrGray = result.gray;
    computedOtsu = result.otsuVal;

    resetHeaderAutoOffsets();

    saveSettings();

    const canvas = document.getElementById('cGrid');

    const cap = window.innerWidth >= 1200
      ? 1000
      : 780;

    const maximumWidth = Math.max(
      1,
      Math.min(cap, window.innerWidth - 40)
    );

    const scale = Math.min(1, maximumWidth / CW);

    canvas.width = Math.round(CW * scale);
    canvas.height = Math.round(CH * scale);

    syncSliders();
    syncDetSliders();
    syncHeaderSliders();

    updHdrColDisp();
    updateHdrColSelOptions();

    setGridKeyboardTarget('group');

    drawGrid();
    setupGridEvents();

    showScanStep(3);
  } catch (error) {
    showMsg(
      '⚠️ 校正失敗：' +
      escAttr(error.message)
    );
  }
}

/* ===== 氣泡讀取 ===== */

function getFillRatioFrom(gray, cx, cy, thr) {
  const hw = Math.floor(G.bw / 2);
  const hh = Math.floor(G.bh / 2);

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

function getFillRatio(cx, cy, thr) {
  return getFillRatioFrom(corrGray, cx, cy, thr);
}

function readBubblesFrom(gray, otsuVal) {
  const threshold = darkThr > 0 ? darkThr : otsuVal;
  const minimum = fillMin / 100;

  const results = [];

  for (let question = 1; question <= currentTotalQ; question++) {
    const ratios = [];

    for (let option = 0; option < 4; option++) {
      const point = getBubblePos(question, option);

      ratios.push(
        getFillRatioFrom(
          gray,
          point.x,
          point.y,
          threshold
        )
      );
    }

    const filled = [];

    for (let option = 0; option < 4; option++) {
      if (ratios[option] >= minimum) {
        filled.push(option);
      }
    }

    let auto = '';

    if (filled.length === 1) {
      auto = 'ABCD'[filled[0]];
    } else if (filled.length > 1) {
      auto = null;
    }

    results.push({
      ratios,
      filled,
      auto,
      manual: undefined
    });
  }

  return results;
}

async function pdfPageToImage(pageNumber) {
  const dpi =
    +document.getElementById('pdfDpiSel').value || 300;

  const page = await pdfDoc.getPage(pageNumber);

  const viewport = page.getViewport({
    scale: dpi / 72
  });

  const canvas = document.createElement('canvas');

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const context = canvas.getContext('2d');

  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({
    canvasContext: context,
    viewport
  }).promise;

  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);

    image.onerror = () => {
      reject(new Error('PDF 頁面圖片載入失敗'));
    };

    image.src = canvas.toDataURL('image/png');
  });
}

/* ===== 組別位置及微調 ===== */

function getGroupIdx(question) {
  return (
    Math.floor((question - 1) / 20) * 4 +
    Math.floor(((question - 1) % 20) / 5)
  );
}

function getGroupLabel(groupIndex) {
  const column = Math.floor(groupIndex / 4) + 1;
  const group = groupIndex % 4;

  const firstQuestion =
    (column - 1) * 20 +
    group * 5 +
    1;

  return (
    `欄${column} ` +
    `Q${firstQuestion}-` +
    Math.min(firstQuestion + 4, currentTotalQ)
  );
}

function buildGrpSel() {
  const select = document.getElementById('grpSel');
  select.innerHTML = '';

  const groupCount = Math.ceil(currentTotalQ / 5);

  for (let i = 0; i < groupCount; i++) {
    const option = document.createElement('option');

    option.value = i;
    option.textContent = getGroupLabel(i);

    select.appendChild(option);
  }

  if (selectedGrp >= groupCount) {
    selectedGrp = 0;
  }

  select.value = selectedGrp;
}

function selGrp(groupIndex) {
  selectedGrp = Number(groupIndex);

  document.getElementById('grpSel').value = selectedGrp;

  setGridKeyboardTarget('group');

  updGrpDisp();
  drawGrid();
}

function updGrpDisp() {
  const off = groupOffsets[selectedGrp] || {
    dx: 0,
    dy: 0,
    drs: 0,
    dos: 0
  };

  document.getElementById('grpDxV')
    .textContent = (off.dx || 0).toFixed(1);

  document.getElementById('grpDyV')
    .textContent = (off.dy || 0).toFixed(1);

  document.getElementById('grpDrsV')
    .textContent = (off.drs || 0).toFixed(1);

  document.getElementById('grpDosV')
    .textContent = (off.dos || 0).toFixed(1);

  document.getElementById('grpRsEff')
    .textContent =
      `(=${(G.rs + (off.drs || 0)).toFixed(1)})`;

  document.getElementById('grpOsEff')
    .textContent =
      `(=${(G.os + (off.dos || 0)).toFixed(1)})`;
}

function nudgeGrp(axis, dir) {
  if (!['dx', 'dy', 'drs', 'dos'].includes(axis)) {
    return;
  }

  setGridKeyboardTarget('group');

  const step =
    +document.getElementById('stepSz').value || 1;

  if (!groupOffsets[selectedGrp]) {
    groupOffsets[selectedGrp] = {
      dx: 0,
      dy: 0,
      drs: 0,
      dos: 0
    };
  }

  groupOffsets[selectedGrp][axis] =
    (groupOffsets[selectedGrp][axis] || 0) +
    dir * step;

  updGrpDisp();
  drawGrid();
  saveSettings();
}

function resetGrp() {
  setGridKeyboardTarget('group');

  groupOffsets[selectedGrp] = {
    dx: 0,
    dy: 0,
    drs: 0,
    dos: 0
  };

  updGrpDisp();
  drawGrid();
  saveSettings();
}

function copyToCol() {
  setGridKeyboardTarget('group');

  const column = Math.floor(selectedGrp / 4);
  const off = { ...groupOffsets[selectedGrp] };

  for (
    let i = column * 4;
    i < column * 4 + 4 && i < 16;
    i++
  ) {
    groupOffsets[i] = { ...off };
  }

  drawGrid();
  saveSettings();
}

function copyToAllBelow() {
  setGridKeyboardTarget('group');

  const off = { ...groupOffsets[selectedGrp] };

  for (let i = selectedGrp + 1; i < 16; i++) {
    groupOffsets[i] = { ...off };
  }

  drawGrid();
  saveSettings();
}

function resetAllGrp() {
  for (let i = 0; i < 16; i++) {
    groupOffsets[i] = {
      dx: 0,
      dy: 0,
      drs: 0,
      dos: 0
    };
  }

  updGrpDisp();
  drawGrid();
  saveSettings();
}

function getBubblePos(question, optionIndex) {
  const column = Math.floor((question - 1) / 20);
  const rowInColumn = (question - 1) % 20;

  const group = Math.floor(rowInColumn / 5);
  const rowInGroup = rowInColumn % 5;

  const groupIndex = column * 4 + group;

  const off = groupOffsets[groupIndex] || {
    dx: 0,
    dy: 0,
    drs: 0,
    dos: 0
  };

  const sectionHeight = 5 * G.rs + G.gg;

  return {
    x:
      G.ox +
      column * G.cs +
      optionIndex * (G.os + (off.dos || 0)) +
      (off.dx || 0),

    y:
      G.oy +
      group * sectionHeight +
      rowInGroup * (G.rs + (off.drs || 0)) +
      (off.dy || 0)
  };
}

/* ===== 自動對齊 ===== */

function autoAlignAll() {
  if (!corrGray) {
    showMsg('請先完成步驟 2');
    return;
  }

  const button = document.getElementById('autoAlignBtn');

  button.disabled = true;
  button.textContent = '⏳ 對齊中...';

  setTimeout(() => {
    try {
      doAutoAlignAll();
    } catch (error) {
      showMsg(
        '⚠️ 自動對齊失敗：' +
        escAttr(error.message)
      );
    } finally {
      button.disabled = false;
      button.textContent = '🎯 自動對齊';
    }
  }, 30);
}

function doAutoAlignAll() {
  const threshold =
    darkThr > 0 ? darkThr : computedOtsu;

  const groupCount = Math.ceil(currentTotalQ / 5);

  let alignedCount = 0;

  for (let i = 0; i < groupCount; i++) {
    if (alignOneGroup(i, threshold)) {
      alignedCount++;
    }
  }

  if (alignedCount > 1) {
    const used = groupOffsets.slice(0, groupCount);

    const averageDx =
      used.reduce((sum, off) => {
        return sum + (off.dx || 0);
      }, 0) / groupCount;

    const averageDy =
      used.reduce((sum, off) => {
        return sum + (off.dy || 0);
      }, 0) / groupCount;

    if (
      Math.abs(averageDx) > 2 ||
      Math.abs(averageDy) > 2
    ) {
      const roundedX = Math.round(averageDx * 2) / 2;
      const roundedY = Math.round(averageDy * 2) / 2;

      G.ox += roundedX;
      G.oy += roundedY;

      for (let i = 0; i < groupCount; i++) {
        groupOffsets[i].dx =
          (groupOffsets[i].dx || 0) - roundedX;

        groupOffsets[i].dy =
          (groupOffsets[i].dy || 0) - roundedY;
      }
    }
  }

  if (HG.enabled) {
    resetHeaderAutoOffsets();
    autoAlignHeader(corrGray, computedOtsu);
    applyHdrAutoToPersistent();
    updHdrColDisp();
  }

  updGrpDisp();
  syncSliders();
  drawGrid();
  saveSettings();

  toast(
    `✅ 自動對齊完成（${alignedCount} 組` +
    (HG.enabled ? ' + 班號' : '') +
    '）'
  );
}

function alignOneGroup(groupIndex, threshold) {
  const column = Math.floor(groupIndex / 4);
  const group = groupIndex % 4;

  const firstQuestion =
    column * 20 + group * 5 + 1;

  const lastQuestion = Math.min(
    firstQuestion + 4,
    currentTotalQ
  );

  if (firstQuestion > currentTotalQ) return null;

  if (!groupOffsets[groupIndex]) {
    groupOffsets[groupIndex] = {
      dx: 0,
      dy: 0,
      drs: 0,
      dos: 0
    };
  }

  const originalDx = groupOffsets[groupIndex].dx || 0;
  const originalDy = groupOffsets[groupIndex].dy || 0;

  groupOffsets[groupIndex].dx = 0;
  groupOffsets[groupIndex].dy = 0;

  const basePoints = [];

  for (
    let question = firstQuestion;
    question <= lastQuestion;
    question++
  ) {
    for (let option = 0; option < 4; option++) {
      basePoints.push(
        getBubblePos(question, option)
      );
    }
  }

  groupOffsets[groupIndex].dx = originalDx;
  groupOffsets[groupIndex].dy = originalDy;

  const hw = Math.floor(G.bw / 2);
  const hh = Math.floor(G.bh / 2);

  function score(dx, dy) {
    const ratios = [];

    for (const point of basePoints) {
      const cx = Math.round(point.x + dx);
      const cy = Math.round(point.y + dy);

      let dark = 0;
      let count = 0;

      for (let iy = -hh; iy <= hh; iy++) {
        const py = cy + iy;

        if (py < 0 || py >= CH) continue;

        const rowOffset = py * CW;

        for (let ix = -hw; ix <= hw; ix++) {
          const px = cx + ix;

          if (px >= 0 && px < CW) {
            count++;

            if (corrGray[rowOffset + px] < threshold) {
              dark++;
            }
          }
        }
      }

      ratios.push(count > 0 ? dark / count : 0);
    }

    const mean =
      ratios.reduce((sum, value) => sum + value, 0) /
      ratios.length;

    return ratios.reduce((sum, value) => {
      return sum + (value - mean) * (value - mean);
    }, 0) / ratios.length;
  }

  function isBetter(
    value,
    dx,
    dy,
    bestValue,
    bx,
    by
  ) {
    const epsilon = 1e-12;

    if (value > bestValue + epsilon) {
      return true;
    }

    if (Math.abs(value - bestValue) <= epsilon) {
      const distance =
        (dx - originalDx) * (dx - originalDx) +
        (dy - originalDy) * (dy - originalDy);

      const bestDistance =
        (bx - originalDx) * (bx - originalDx) +
        (by - originalDy) * (by - originalDy);

      return distance < bestDistance;
    }

    return false;
  }

  let bestDx = originalDx;
  let bestDy = originalDy;
  let bestScore = score(originalDx, originalDy);

  for (
    let dx = originalDx - 16;
    dx <= originalDx + 16;
    dx += 2
  ) {
    for (
      let dy = originalDy - 16;
      dy <= originalDy + 16;
      dy += 2
    ) {
      const value = score(dx, dy);

      if (
        isBetter(
          value,
          dx,
          dy,
          bestScore,
          bestDx,
          bestDy
        )
      ) {
        bestScore = value;
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
      const value = score(dx, dy);

      if (
        isBetter(
          value,
          dx,
          dy,
          finalScore,
          finalDx,
          finalDy
        )
      ) {
        finalScore = value;
        finalDx = dx;
        finalDy = dy;
      }
    }
  }

  groupOffsets[groupIndex].dx = finalDx;
  groupOffsets[groupIndex].dy = finalDy;

  return {
    dx: finalDx - originalDx,
    dy: finalDy - originalDy
  };
}

function autoAlignSelected() {
  if (!corrGray) return;

  setGridKeyboardTarget('group');

  const threshold =
    darkThr > 0 ? darkThr : computedOtsu;

  alignOneGroup(selectedGrp, threshold);

  updGrpDisp();
  drawGrid();
  saveSettings();
}

/* ===== 滑桿 ===== */

function syncSliders() {
  document.getElementById('sOX').value = G.ox;
  document.getElementById('sOY').value = G.oy;
  document.getElementById('sOS').value = G.os;
  document.getElementById('sRS').value = G.rs;
  document.getElementById('sCS').value = G.cs;
  document.getElementById('sGG').value = G.gg;
  document.getElementById('sBW').value = G.bw;
  document.getElementById('sBH').value = G.bh;

  updSliderVals();
}

function updSliderVals() {
  [
    'OX', 'OY', 'OS', 'RS',
    'CS', 'GG', 'BW', 'BH'
  ].forEach(key => {
    document.getElementById('v' + key).textContent =
      document.getElementById('s' + key).value;
  });
}

function onSlider() {
  G.ox = +document.getElementById('sOX').value;
  G.oy = +document.getElementById('sOY').value;
  G.os = +document.getElementById('sOS').value;
  G.rs = +document.getElementById('sRS').value;
  G.cs = +document.getElementById('sCS').value;
  G.gg = +document.getElementById('sGG').value;
  G.bw = +document.getElementById('sBW').value;
  G.bh = +document.getElementById('sBH').value;

  setGridKeyboardTarget('group');

  updSliderVals();
  updGrpDisp();
  drawGrid();
  saveSettings();
}

function syncDetSliders() {
  document.getElementById('sFR').value = fillMin;
  document.getElementById('sDT').value = darkThr;

  updDetVals();
}

function updDetVals() {
  document.getElementById('vFR')
    .textContent = fillMin + '%';

  document.getElementById('vDT')
    .textContent =
      darkThr === 0
        ? '自動(' + computedOtsu + ')'
        : darkThr;
}

function onDetSlider() {
  fillMin = +document.getElementById('sFR').value;
  darkThr = +document.getElementById('sDT').value;

  updDetVals();
  saveSettings();
}

function resetGridDefaults() {
  G = {
    ox: 75,
    oy: 505,
    os: 24.5,
    rs: 27.5,
    cs: 232,
    gg: 14,
    bw: 16,
    bh: 10
  };

  resetAllGrp();
  syncSliders();

  setGridKeyboardTarget('group');

  drawGrid();
  saveSettings();
}

/* ===== 格線繪圖 ===== */

function drawRR(context, cx, cy, width, height) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  const radius = Math.min(
    halfWidth,
    halfHeight
  ) * 0.3;

  const x = cx - halfWidth;
  const y = cy - halfHeight;

  context.beginPath();

  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);

  context.quadraticCurveTo(
    x + width,
    y,
    x + width,
    y + radius
  );

  context.lineTo(
    x + width,
    y + height - radius
  );

  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - radius,
    y + height
  );

  context.lineTo(x + radius, y + height);

  context.quadraticCurveTo(
    x,
    y + height,
    x,
    y + height - radius
  );

  context.lineTo(x, y + radius);

  context.quadraticCurveTo(
    x,
    y,
    x + radius,
    y
  );

  context.closePath();
}

function drawGrid() {
  if (!corrCanvas) return;

  const canvas = document.getElementById('cGrid');
  const context = canvas.getContext('2d');

  const scale = canvas.width / CW;

  context.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  context.drawImage(
    corrCanvas,
    0,
    0,
    canvas.width,
    canvas.height
  );

  if (HG.enabled) {
    const columns = [];

    if (electiveScanMode) {
      columns.push({
        key: 'cls',
        count: HDR_COL_COUNTS.cls,
        labels: ELEC_CLASS_LETTERS,
        color: 'rgba(168,85,247,'
      });
    }

    columns.push(
      {
        key: 'no1',
        count: HDR_COL_COUNTS.no1,
        labels: ['0','1','2','3','4','5','6','7','8','9'],
        color: 'rgba(16,185,129,'
      },
      {
        key: 'no2',
        count: HDR_COL_COUNTS.no2,
        labels: ['0','1','2','3','4','5','6','7','8','9'],
        color: 'rgba(34,211,238,'
      }
    );

    columns.forEach(column => {
      const selected = column.key === selectedHdrCol;

      for (let row = 0; row < column.count; row++) {
        const point = getHeaderBubblePos(
          column.key,
          row,
          false
        );

        drawRR(
          context,
          point.x * scale,
          point.y * scale,
          HG.hbw * scale,
          HG.hbh * scale
        );

        context.strokeStyle =
          column.color + (selected ? '1)' : '0.7)');

        context.lineWidth = selected ? 2.5 : 1.5;
        context.stroke();

        if (selected) {
          context.fillStyle = column.color + '0.08)';
          context.fill();
        }

        context.fillStyle = column.color + '0.7)';

        context.font =
          `${Math.max(6, 7 * scale)}px sans-serif`;

        context.fillText(
          column.labels[row],
          point.x * scale + HG.hbw * scale * 0.6,
          point.y * scale + 3
        );
      }
    });

    const labels = [
      {
        key: 'no1',
        text: '十位',
        x: HG.no1X,
        color: 'rgba(16,185,129,.9)'
      },
      {
        key: 'no2',
        text: '個位',
        x: HG.no2X,
        color: 'rgba(34,211,238,.9)'
      }
    ];

    if (electiveScanMode) {
      labels.unshift({
        key: 'cls',
        text: '班別',
        x: HG.clsX,
        color: 'rgba(168,85,247,.9)'
      });
    }

    context.font =
      `bold ${Math.max(8, 9 * scale)}px sans-serif`;

    labels.forEach(label => {
      const off = headerColOffsets[label.key] || {
        dx: 0,
        dy: 0
      };

      context.fillStyle = label.color;

      context.fillText(
        label.text,
        (label.x - 10 + (off.dx || 0)) * scale,
        (HG.startY - 14 + (off.dy || 0)) * scale
      );
    });
  }

  for (let question = 1; question <= currentTotalQ; question++) {
    const groupIndex = getGroupIdx(question);
    const selected = groupIndex === selectedGrp;

    for (let option = 0; option < 4; option++) {
      const point = getBubblePos(question, option);

      drawRR(
        context,
        point.x * scale,
        point.y * scale,
        G.bw * scale,
        G.bh * scale
      );

      context.strokeStyle = selected
        ? 'rgba(139,92,246,.95)'
        : 'rgba(96,165,250,.55)';

      context.lineWidth = selected ? 2.5 : 1.5;
      context.stroke();
    }

    const firstPoint = getBubblePos(question, 0);

    context.fillStyle = selected
      ? 'rgba(139,92,246,.85)'
      : 'rgba(139,92,246,.4)';

    context.font =
      `${Math.max(7, 8 * scale)}px sans-serif`;

    context.fillText(
      question,
      firstPoint.x * scale - 20 * scale,
      firstPoint.y * scale + 3
    );
  }

  if (mouseOnGrid.x > 0) {
    const size = Math.min(140, canvas.width - 16);

    const sourceX = mouseOnGrid.x / scale;
    const sourceY = mouseOnGrid.y / scale;

    const sourceSize = size / (4 * scale);

    const magnifierX = canvas.width - size - 8;
    const magnifierY = 8;

    context.save();

    context.beginPath();
    context.rect(
      magnifierX,
      magnifierY,
      size,
      size
    );

    context.clip();

    context.drawImage(
      corrCanvas,
      sourceX - sourceSize / 2,
      sourceY - sourceSize / 2,
      sourceSize,
      sourceSize,
      magnifierX,
      magnifierY,
      size,
      size
    );

    context.restore();

    context.strokeStyle = 'rgba(139,92,246,.6)';
    context.lineWidth = 2;

    context.strokeRect(
      magnifierX,
      magnifierY,
      size,
      size
    );
  }

  if (calibActive) {
    calibPts.forEach((point, index) => {
      context.beginPath();

      context.arc(
        point.x * scale,
        point.y * scale,
        7,
        0,
        Math.PI * 2
      );

      context.fillStyle = 'rgb(52,211,153)';
      context.fill();

      context.strokeStyle = '#fff';
      context.lineWidth = 2;
      context.stroke();

      context.fillStyle = '#fff';
      context.font = 'bold 10px sans-serif';

      context.fillText(
        calibLabels[index],
        point.x * scale + 10,
        point.y * scale + 4
      );
    });
  }

  if (hdrCalibActive) {
    hdrCalibPts.forEach((point, index) => {
      context.beginPath();

      context.arc(
        point.x * scale,
        point.y * scale,
        7,
        0,
        Math.PI * 2
      );

      context.fillStyle = 'rgb(34,211,238)';
      context.fill();

      context.strokeStyle = '#fff';
      context.lineWidth = 2;
      context.stroke();

      context.fillStyle = '#fff';
      context.font = 'bold 10px sans-serif';

      context.fillText(
        HDR_CALIB_LABELS[index],
        point.x * scale + 10,
        point.y * scale + 4
      );
    });
  }
}

/* ===== 點擊選取答案組／班號欄 ===== */

function setupGridEvents() {
  const canvas = document.getElementById('cGrid');

  canvas.tabIndex = 0;
  canvas.setAttribute(
    'aria-label',
    '格線校準畫布，點擊答案或班號氣泡後可使用方向鍵移動'
  );

  canvas.onmousemove = e => {
    const rect = canvas.getBoundingClientRect();

    mouseOnGrid = {
      x:
        (e.clientX - rect.left) *
        canvas.width / rect.width,

      y:
        (e.clientY - rect.top) *
        canvas.height / rect.height
    };

    drawGrid();
  };

  canvas.onmouseleave = () => {
    mouseOnGrid = {
      x: 0,
      y: 0
    };

    drawGrid();
  };

  canvas.onclick = e => {
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / CW;

    const cx =
      (e.clientX - rect.left) *
      canvas.width / rect.width / scale;

    const cy =
      (e.clientY - rect.top) *
      canvas.height / rect.height / scale;

    if (hdrCalibActive) {
      handleHeaderCalibClick(cx, cy);
      return;
    }

    if (calibActive) {
      handleCalibClick(cx, cy);
      return;
    }

    let nearestHeader = null;
    let headerDistance = Infinity;

    if (HG.enabled) {
      const keys = electiveScanMode
        ? ['cls', 'no1', 'no2']
        : ['no1', 'no2'];

      keys.forEach(key => {
        for (
          let row = 0;
          row < HDR_COL_COUNTS[key];
          row++
        ) {
          const point = getHeaderBubblePos(
            key,
            row,
            false
          );

          const distance = Math.hypot(
            point.x - cx,
            point.y - cy
          );

          if (distance < headerDistance) {
            headerDistance = distance;
            nearestHeader = key;
          }
        }
      });
    }

    let nearestGroup = 0;
    let answerDistance = Infinity;

    for (
      let question = 1;
      question <= currentTotalQ;
      question++
    ) {
      for (let option = 0; option < 4; option++) {
        const point = getBubblePos(question, option);

        const distance = Math.hypot(
          point.x - cx,
          point.y - cy
        );

        if (distance < answerDistance) {
          answerDistance = distance;
          nearestGroup = getGroupIdx(question);
        }
      }
    }

    const headerClickRadius = Math.max(
      18,
      HG.hbw,
      HG.hbh
    );

    if (
      nearestHeader &&
      headerDistance <= headerClickRadius &&
      headerDistance < answerDistance
    ) {
      selHdrCol(nearestHeader);
    } else {
      selGrp(nearestGroup);
    }

    /*
     * 讓方向鍵由畫布接收，
     * 不再操作之前取得焦點的輸入框。
     */
    canvas.focus({
      preventScroll: true
    });
  };
}

/* ===== 三點校準 ===== */

function startCalib() {
  hdrCalibActive = false;
  hdrCalibStep = 0;
  hdrCalibPts = [];

  calibActive = true;
  calibStep = 0;
  calibPts = [];

  setGridKeyboardTarget('group');

  const button = document.getElementById('calibBtn');

  button.textContent = '❌ 取消';
  button.onclick = cancelCalib;

  const status = document.getElementById('calibStatus');

  status.innerHTML =
    '🎯 校準 [1/3]：點擊 <strong>' +
    calibLabels[0] +
    '</strong> 的氣泡中心';

  status.style.cssText =
    'background:rgba(52,211,153,.08);' +
    'border-color:rgba(52,211,153,.15);' +
    'color:rgb(52,211,153)';

  drawGrid();
}

function cancelCalib() {
  calibActive = false;
  calibStep = 0;
  calibPts = [];

  const button = document.getElementById('calibBtn');

  button.textContent = '📐 三點校準';
  button.onclick = startCalib;

  const status = document.getElementById('calibStatus');

  status.innerHTML = '💡 校準已取消。';
  status.style.cssText = '';

  drawGrid();
}

function handleCalibClick(cx, cy) {
  calibPts.push({
    x: cx,
    y: cy
  });

  calibStep++;

  if (calibStep < 3) {
    document.getElementById('calibStatus').innerHTML =
      `🎯 校準 [${calibStep + 1}/3]：` +
      '點擊 <strong>' +
      calibLabels[calibStep] +
      '</strong> 的氣泡中心';
  } else {
    finishCalib();
  }

  drawGrid();
}

function finishCalib() {
  calibActive = false;

  const [p1, p2, p3] = calibPts;

  if (!p1 || !p2 || !p3) return;

  G.os = (p2.x - p1.x) / 3;
  G.rs = (p2.y - p1.y) / 4;

  G.ox = p1.x;
  G.oy = p1.y;

  G.cs = p3.x - p1.x;
  G.gg = G.rs * 0.5;

  resetAllGrp();
  syncSliders();

  drawGrid();
  saveSettings();

  const button = document.getElementById('calibBtn');

  button.textContent = '📐 三點校準';
  button.onclick = startCalib;

  const status = document.getElementById('calibStatus');

  status.innerHTML = '✅ 校準完成！';

  status.style.cssText =
    'background:rgba(52,211,153,.08);' +
    'border-color:rgba(52,211,153,.15);' +
    'color:rgb(52,211,153)';
}

/* ===== 掃描結果：格線調整視窗 ===== */

function openGridAdjust() {
  if (!corrCanvas || !corrGray) {
    showMsg('⚠️ 此頁尚未完成掃描，無法調整格線。');
    return;
  }

  if (gridAdjustMode) return;

  const columns = document.getElementById('gridCalibCols');
  const body = document.getElementById('gridAdjustBody');

  if (!columns || !body) return;

  /*
   * 把結果預覽使用的班號自動偏移轉為手動偏移。
   * 這樣打開調整視窗時，格線與剛才看到的位置一致。
   */
  if (HG.enabled) {
    applyHdrAutoToPersistent();
  }

  resetHeaderAutoOffsets();

  gridAdjustOrigParent = columns.parentNode;
  gridAdjustOrigNext = columns.nextSibling;

  body.appendChild(columns);

  document.getElementById('gridAdjustOverlay')
    .classList.add('show');

  document.getElementById('gridAdjustPanel')
    .classList.add('show');

  gridAdjustMode = true;

  const canvas = document.getElementById('cGrid');

  const maximumWidth = Math.max(
    1,
    Math.min(880, window.innerWidth - 90)
  );

  const scale = Math.min(1, maximumWidth / CW);

  canvas.width = Math.round(CW * scale);
  canvas.height = Math.round(CH * scale);

  buildGrpSel();

  syncSliders();
  syncDetSliders();
  syncHeaderSliders();

  updGrpDisp();
  updHdrColDisp();
  updateHdrColSelOptions();

  setGridKeyboardTarget(gridKeyboardTarget);

  setupGridEvents();
  drawGrid();
}

function closeGridAdjust() {
  if (!gridAdjustMode) return;

  gridAdjustMode = false;

  if (calibActive) {
    cancelCalib();
  }

  if (hdrCalibActive) {
    hdrCalibActive = false;
    hdrCalibStep = 0;
    hdrCalibPts = [];
  }

  document.getElementById('gridAdjustOverlay')
    .classList.remove('show');

  document.getElementById('gridAdjustPanel')
    .classList.remove('show');

  const columns = document.getElementById('gridCalibCols');

  if (columns && gridAdjustOrigParent) {
    if (
      gridAdjustOrigNext &&
      gridAdjustOrigNext.parentNode === gridAdjustOrigParent
    ) {
      gridAdjustOrigParent.insertBefore(
        columns,
        gridAdjustOrigNext
      );
    } else {
      gridAdjustOrigParent.appendChild(columns);
    }
  }

  const canvas = document.getElementById('cGrid');

  const cap = window.innerWidth >= 1200
    ? 1000
    : 780;

  const maximumWidth = Math.max(
    1,
    Math.min(cap, window.innerWidth - 40)
  );

  const scale = Math.min(1, maximumWidth / CW);

  canvas.width = Math.round(CW * scale);
  canvas.height = Math.round(CH * scale);

  rereadCurrentAfterAdjust();
}

function rereadCurrentAfterAdjust() {
  if (!corrGray) return;

  /*
   * 按老師調整後的實際格線讀取，
   * 不再疊加舊的班號自動偏移。
   */
  resetHeaderAutoOffsets();

  detectedHeaderInfo = readHeaderBubblesFrom(
    corrGray,
    computedOtsu
  );

  const results = readBubblesFrom(
    corrGray,
    computedOtsu
  );

  scanResults = results;

  if (batchMode && batchResults[currentBatchIdx]) {
    const page = batchResults[currentBatchIdx];

    page.scanResults = results;
    page.headerInfo = detectedHeaderInfo;

    page.pageGroupOffsets = groupOffsets.map(off => ({
      ...off
    }));

    page.pageHeaderColOffsets =
      cloneHeaderOffsets(headerColOffsets);

    page.headerAutoOffsets =
      cloneHeaderOffsets(headerAutoOffsets);
  }

  if (detectedHeaderInfo) {
    applyHeaderDetection();
  }

  saveSettings();
  renderResultsUI();

  toast('🔧 已套用新格線並重新讀取');
}

/* ===== 問題整理：漏填／多填 ===== */

function getScanReviewIssues(results) {
  const issues = {
    blank: [],
    multiple: []
  };

  for (let index = 0; index < currentTotalQ; index++) {
    const result = results[index];

    if (!result) {
      issues.blank.push(index + 1);
      continue;
    }

    const unresolvedMultiple =
      result.auto === null &&
      result.manual === undefined;

    if (unresolvedMultiple) {
      issues.multiple.push(index + 1);
      continue;
    }

    if (!getAnswerFromScanResult(result)) {
      issues.blank.push(index + 1);
    }
  }

  return issues;
}

function scanReviewQuestionList(numbers) {
  return numbers.map(number => {
    return `Q${number}`;
  }).join('、');
}

function scanReviewReportHTML(reports) {
  return `
    <div style="
      max-height:280px;
      overflow:auto;
      margin:12px 0;
      text-align:left;
      line-height:1.9;
      overflow-wrap:anywhere
    ">
      ${reports.map(report => {
        const issues = report.issues;
        const blocks = [];

        if (issues.multiple.length) {
          blocks.push(`
            <div style="color:rgb(var(--amber))">
              <strong>
                多填／未處理
                （${issues.multiple.length} 題）
              </strong>
              <br>
              ${scanReviewQuestionList(issues.multiple)}
            </div>
          `);
        }

        if (issues.blank.length) {
          blocks.push(`
            <div style="color:rgb(var(--rose))">
              <strong>
                漏填／留空
                （${issues.blank.length} 題）
              </strong>
              <br>
              ${scanReviewQuestionList(issues.blank)}
            </div>
          `);
        }

        if (!blocks.length) return '';

        return `
          <div style="
            padding:10px 12px;
            margin-bottom:10px;
            border:1px solid var(--border);
            border-radius:10px
          ">
            <div style="font-weight:700;margin-bottom:6px">
              ${escAttr(report.label)}
            </div>

            ${blocks.join(
              '<div style="height:8px"></div>'
            )}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function confirmScanReviewSave(results, label, onSave) {
  const issues = getScanReviewIssues(results);

  const report = scanReviewReportHTML([
    {
      label,
      issues
    }
  ]);

  if (issues.multiple.length) {
    showMsg(
      '⚠️ 以下題目需要核對：' +
      report +
      '請先在掃描預覽或答案列表中處理多填題目，再儲存。'
    );

    return;
  }

  if (issues.blank.length) {
    showConfirm(
      '⚠️ 以下題目沒有答案，請確認是否確實留空：' +
      report +
      '確定仍要儲存此記錄嗎？',
      onSave
    );

    return;
  }

  onSave();
}

/* ===== 掃描預覽：漏填及多填高亮 ===== */

function drawScanReviewHighlights(context, scale) {
  const issues = getScanReviewIssues(scanResults);

  const canvas = document.getElementById('cPreview');

  let legend = document.getElementById('scanReviewLegend');

  if (!legend && canvas && canvas.parentNode) {
    legend = document.createElement('div');
    legend.id = 'scanReviewLegend';

    legend.style.cssText =
      'margin:8px 0 12px;font-size:.78em;' +
      'line-height:1.8;color:var(--text2)';

    canvas.parentNode.insertBefore(legend, canvas);
  }

  if (legend) {
    legend.innerHTML = `
      <span style="color:#f43f5e;font-weight:700">
        ▧ 紅色框：漏填／留空
        （${issues.blank.length} 題）
      </span>

      &nbsp;&nbsp;

      <span style="color:#f59e0b;font-weight:700">
        ▧ 橙色框：多填，尚待核對
        （${issues.multiple.length} 題）
      </span>
    `;
  }

  function markQuestion(question, multiple) {
    const first = getBubblePos(question, 0);
    const last = getBubblePos(question, 3);

    const color = multiple
      ? '#f59e0b'
      : '#f43f5e';

    const left =
      (Math.min(first.x, last.x) - G.bw / 2 - 5) *
      scale;

    const top =
      (first.y - G.bh / 2 - 5) *
      scale;

    const width =
      (Math.abs(last.x - first.x) + G.bw + 10) *
      scale;

    const height =
      (G.bh + 10) *
      scale;

    context.save();

    context.fillStyle = multiple
      ? 'rgba(245,158,11,.10)'
      : 'rgba(244,63,94,.10)';

    context.fillRect(
      left,
      top,
      width,
      height
    );

    context.strokeStyle = color;
    context.lineWidth = Math.max(1.5, 2 * scale);

    context.setLineDash([
      5 * scale,
      3 * scale
    ]);

    context.strokeRect(
      left,
      top,
      width,
      height
    );

    context.setLineDash([]);

    /*
     * 漏填時，四個選項都加紅色外框，
     * 不只標示整題範圍。
     */
    if (!multiple) {
      for (let option = 0; option < 4; option++) {
        const point = getBubblePos(question, option);

        drawRR(
          context,
          point.x * scale,
          point.y * scale,
          G.bw * scale,
          G.bh * scale
        );

        context.stroke();
      }
    }

    context.font =
      `bold ${Math.max(8, 10 * scale)}px sans-serif`;

    context.textBaseline = 'middle';

    const text =
      `Q${question} ${multiple ? '多填' : '漏填'}`;

    const textWidth = context.measureText(text).width;
    const padding = Math.max(2, 3 * scale);

    let textX = left + width + 6 * scale;

    if (
      canvas &&
      textX + textWidth + padding > canvas.width
    ) {
      textX = Math.max(
        padding,
        left - textWidth - 6 * scale
      );
    }

    const textY = first.y * scale;
    const textHeight = Math.max(12, 14 * scale);

    context.fillStyle = 'rgba(255,255,255,.90)';

    context.fillRect(
      textX - padding,
      textY - textHeight / 2,
      textWidth + padding * 2,
      textHeight
    );

    context.fillStyle = color;
    context.fillText(text, textX, textY);

    context.restore();
  }

  issues.blank.forEach(question => {
    markQuestion(question, false);
  });

  issues.multiple.forEach(question => {
    markQuestion(question, true);
  });
}

/* ===== SCAN & GRADE ===== */

function readAndGrade() {
  if (!corrGray) {
    showMsg('請先完成步驟 2');
    return;
  }

  batchScanRunId++;

  batchMode = false;
  batchResults = [];
  currentBatchIdx = 0;

  scanResults = readBubblesFrom(
    corrGray,
    computedOtsu
  );

  resetHeaderAutoOffsets();
  autoAlignHeader(corrGray, computedOtsu);

  detectedHeaderInfo = readHeaderBubblesFrom(
    corrGray,
    computedOtsu
  );

  if (detectedHeaderInfo) {
    applyHeaderDetection();
  }

  renderResultsUI();
  showScanStep(4);
}

function getFinalAnswer(questionIndex) {
  return getAnswerFromScanResult(
    scanResults[questionIndex]
  );
}

function onPreviewClick(e) {
  if (!scanResults.length) return;

  const canvas = document.getElementById('cPreview');

  if (!canvas || !canvas.width) return;

  const rect = canvas.getBoundingClientRect();
  const scale = canvas.width / CW;

  const cx =
    (e.clientX - rect.left) *
    canvas.width / rect.width / scale;

  const cy =
    (e.clientY - rect.top) *
    canvas.height / rect.height / scale;

  let nearestDistance = Infinity;
  let bestQuestion = -1;
  let bestOption = -1;

  for (let question = 1; question <= currentTotalQ; question++) {
    for (let option = 0; option < 4; option++) {
      const point = getBubblePos(question, option);

      const distance = Math.hypot(
        point.x - cx,
        point.y - cy
      );

      if (distance < nearestDistance) {
        nearestDistance = distance;
        bestQuestion = question;
        bestOption = option;
      }
    }
  }

  const clickThreshold = Math.max(G.os, G.rs);

  if (
    bestQuestion > 0 &&
    nearestDistance <= clickThreshold
  ) {
    setManual(
      bestQuestion - 1,
      'ABCD'[bestOption]
    );
  }
}

function scrollToPreview() {
  const details = document.getElementById(
    'scanPreviewDetails'
  );

  if (!details) return;

  if (details.tagName === 'DETAILS') {
    details.open = true;
  }

  setTimeout(() => {
    try {
      details.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    } catch (error) {
      /* 不影響掃描結果 */
    }
  }, 80);
}

function drawResultPreview() {
  const canvas = document.getElementById('cPreview');

  if (!corrCanvas) {
    canvas.width = 0;

    const legend = document.getElementById(
      'scanReviewLegend'
    );

    if (legend) legend.innerHTML = '';

    return;
  }

  const cap = window.innerWidth >= 1200
    ? 1000
    : 780;

  const maximumWidth = Math.max(
    1,
    Math.min(cap, window.innerWidth - 40)
  );

  const scale = Math.min(1, maximumWidth / CW);

  canvas.width = Math.round(CW * scale);
  canvas.height = Math.round(CH * scale);

  const context = canvas.getContext('2d');

  context.drawImage(
    corrCanvas,
    0,
    0,
    canvas.width,
    canvas.height
  );

  const answerKey = currentAnswerKey;
  const hasKey = answerKey.some(answer => answer !== '');

  if (detectedHeaderInfo && HG.enabled) {
    const columns = [];
    const ratioArrays = [];

    if (electiveScanMode) {
      columns.push({
        key: 'cls',
        count: HDR_COL_COUNTS.cls
      });

      ratioArrays.push(
        detectedHeaderInfo.clsRatios || []
      );
    }

    columns.push(
      {
        key: 'no1',
        count: HDR_COL_COUNTS.no1
      },
      {
        key: 'no2',
        count: HDR_COL_COUNTS.no2
      }
    );

    ratioArrays.push(
      detectedHeaderInfo.no1Ratios || [],
      detectedHeaderInfo.no2Ratios || []
    );

    const minimum = fillMin / 100;

    columns.forEach((column, columnIndex) => {
      const ratios = ratioArrays[columnIndex] || [];

      for (let row = 0; row < column.count; row++) {
        const point = getHeaderBubblePos(
          column.key,
          row,
          true
        );

        const filled = ratios[row] >= minimum;

        drawRR(
          context,
          point.x * scale,
          point.y * scale,
          HG.hbw * scale,
          HG.hbh * scale
        );

        if (filled) {
          context.fillStyle = 'rgba(34,211,238,.45)';
          context.fill();

          context.strokeStyle = 'rgb(34,211,238)';
          context.lineWidth = 2.5;
        } else {
          context.strokeStyle = 'rgba(34,211,238,.45)';
          context.lineWidth = 1;
        }

        context.stroke();
      }
    });
  }

  for (let question = 1; question <= currentTotalQ; question++) {
    const result = scanResults[question - 1] || {
      ratios: [],
      filled: [],
      auto: '',
      manual: undefined
    };

    const finalAnswer = getFinalAnswer(question - 1);
    const key = answerKey[question - 1];

    const correct =
      hasKey &&
      key &&
      isAnswerCorrect(finalAnswer, key);

    const incorrect =
      hasKey &&
      key &&
      finalAnswer &&
      !isAnswerCorrect(finalAnswer, key);

    const unresolvedMultiple =
      result.auto === null &&
      result.manual === undefined;

    for (let option = 0; option < 4; option++) {
      const point = getBubblePos(question, option);

      const letter = 'ABCD'[option];

      const filled = result.filled.includes(option);
      const finalSelected = finalAnswer === letter;

      drawRR(
        context,
        point.x * scale,
        point.y * scale,
        G.bw * scale,
        G.bh * scale
      );

      if (finalSelected && correct) {
        context.fillStyle = 'rgba(52,211,153,.55)';
        context.fill();

        context.strokeStyle = 'rgb(52,211,153)';
        context.lineWidth = 2.5;
      } else if (finalSelected && incorrect) {
        context.fillStyle = 'rgba(244,63,94,.55)';
        context.fill();

        context.strokeStyle = 'rgb(244,63,94)';
        context.lineWidth = 2.5;
      } else if (unresolvedMultiple && filled) {
        context.fillStyle = 'rgba(251,191,36,.45)';
        context.fill();

        context.strokeStyle = 'rgb(251,191,36)';
        context.lineWidth = 2;
      } else if (finalSelected || filled) {
        context.fillStyle = 'rgba(96,165,250,.45)';
        context.fill();

        context.strokeStyle = 'rgb(96,165,250)';
        context.lineWidth = 2;
      } else {
        context.strokeStyle = 'rgba(96,165,250,.5)';
        context.lineWidth = 1;
      }

      context.stroke();
    }
  }

  drawScanReviewHighlights(context, scale);

  canvas.classList.add('preview-clickable');
  canvas.onclick = onPreviewClick;
}

function renderResultsUI() {
  const grid = document.getElementById('resGrid');

  grid.innerHTML = '';

  const answerKey = currentAnswerKey;
  const hasKey = answerKey.some(answer => answer !== '');

  let correctCount = 0;
  let answeredCount = 0;
  let originalMultipleCount = 0;

  for (let index = 0; index < currentTotalQ; index++) {
    const result = scanResults[index] || {
      ratios: [],
      filled: [],
      auto: '',
      manual: undefined
    };

    const finalAnswer = getFinalAnswer(index);
    const key = answerKey[index];

    const multiple = result.auto === null;
    const hasManual = result.manual !== undefined;

    if (multiple) originalMultipleCount++;
    if (finalAnswer) answeredCount++;

    const correct =
      hasKey &&
      key &&
      isAnswerCorrect(finalAnswer, key);

    const incorrect =
      hasKey &&
      key &&
      finalAnswer &&
      !isAnswerCorrect(finalAnswer, key);

    if (correct) correctCount++;

    let itemClass = 'ritem ';

    if (multiple && !hasManual) {
      itemClass += 'multi';
    } else if (multiple && hasManual) {
      itemClass += 'multi-ok';
    } else if (correct) {
      itemClass += 'ok';
    } else if (incorrect) {
      itemClass += 'ng';
    } else {
      itemClass += 'blank';
    }

    const item = document.createElement('div');
    item.className = itemClass;

    if (!finalAnswer && !(multiple && !hasManual)) {
      item.style.borderColor = 'rgba(244,63,94,.45)';
      item.style.background = 'rgba(244,63,94,.06)';
    }

    let html = multiple && !hasManual
      ? `<span class="qn warn">⚠️${index + 1}</span>`
      : `<span class="qn">Q${index + 1}</span>`;

    for (let option = 0; option < 4; option++) {
      const letter = 'ABCD'[option];

      const filled = result.filled.includes(option);
      const finalSelected = finalAnswer === letter;

      let optionClass = 'ro';

      if (finalSelected && correct) {
        optionClass += ' grn';
      } else if (finalSelected && incorrect) {
        optionClass += ' red';
      } else if (finalSelected && !hasKey) {
        optionClass += ' blu';
      } else if (filled && !finalSelected) {
        optionClass += ' det';
      }

      if (hasManual && result.manual === letter) {
        optionClass += ' mansel';
      }

      const percentage = Math.round(
        (result.ratios[option] || 0) * 100
      );

      html += `
        <span
          class="${optionClass}"
          title="${percentage}%"
          onclick="setManual(${index},'${letter}')"
        >${letter}</span>
      `;
    }

    if (multiple && !hasManual) {
      html += '<span class="rtag rev">需檢查</span>';
    } else if (hasManual) {
      html += `
        <span class="rtag man">
          手動→${result.manual || '空'}
        </span>
      `;
    } else if (!finalAnswer) {
      html += `
        <span
          class="rtag"
          style="color:#f43f5e"
        >漏填</span>
      `;
    }

    item.innerHTML = html;
    grid.appendChild(item);
  }

  const scoreDisplay = document.getElementById('scoreDisp');

  if (hasKey) {
    const keyCount = answerKey
      .slice(0, currentTotalQ)
      .filter(answer => answer !== '')
      .length;

    const percentage = keyCount > 0
      ? Math.round(correctCount / keyCount * 100)
      : 0;

    scoreDisplay.innerHTML = `
      <div class="score-display">
        <div class="score-big">
          ${correctCount} / ${keyCount}
        </div>

        <div class="score-sub">
          ${percentage}% · 已作答 ${answeredCount} 題
        </div>
      </div>
    `;
  } else {
    scoreDisplay.innerHTML = `
      <div class="score-display">
        <div
          class="score-big"
          style="
            font-size:1.4em;
            -webkit-text-fill-color:var(--text2)
          "
        >
          已讀取 ${answeredCount} / ${currentTotalQ} 題
        </div>
      </div>
    `;
  }

  const issues = getScanReviewIssues(scanResults);
  const warning = document.getElementById('multiWarn');

  const warnings = [];

  if (issues.multiple.length) {
    warnings.push(
      '<div style="color:rgb(var(--amber))">' +
      `⚠️ 多填／待核對 ${issues.multiple.length} 題：` +
      scanReviewQuestionList(issues.multiple) +
      '</div>'
    );
  }

  if (issues.blank.length) {
    warnings.push(
      '<div style="color:rgb(var(--rose))">' +
      `⚠️ 漏填／留空 ${issues.blank.length} 題：` +
      scanReviewQuestionList(issues.blank) +
      '</div>'
    );
  }

  if (warnings.length) {
    warning.classList.remove('hidden');

    warning.innerHTML =
      warnings.join('') +
      '<div style="margin-top:5px">' +
      '可直接點擊下方掃描預覽或答案列表修改。' +
      '</div>';
  } else if (originalMultipleCount > 0) {
    warning.classList.remove('hidden');

    warning.innerHTML =
      `✅ ${originalMultipleCount} 題多填已完成手動處理`;
  } else {
    warning.classList.add('hidden');
  }

  document.getElementById('batchNav')
    .classList.toggle('hidden', !batchMode);

  document.getElementById('saveAllBtn')
    .classList.toggle('hidden', !batchMode);

  if (batchMode) {
    document.getElementById('step4Desc').textContent =
      `第 ${currentBatchIdx + 1} / ${batchResults.length} 份`;

    updateBatchNav();
  } else {
    document.getElementById('step4Desc').textContent =
      '確認掃描結果並儲存';
  }

  renderHeaderDetectUI();
  refreshScanStudentDropdown();
  drawResultPreview();
}

function setManual(questionIndex, option) {
  const result = scanResults[questionIndex];
  if (!result) return;

  result.manual =
    result.manual === option
      ? undefined
      : option;

  if (batchMode && batchResults[currentBatchIdx]) {
    batchResults[currentBatchIdx].scanResults = scanResults;
  }

  renderResultsUI();
}

function updateBatchBtn() {
  const button = document.getElementById('batchScanBtn');

  if (totalPdfPages > 1 && corrCanvas) {
    button.classList.remove('hidden');

    button.textContent =
      `📄 批量掃描 (${totalPdfPages}頁)`;
  } else {
    button.classList.add('hidden');
  }
}

/* ===== BATCH SCAN ===== */

async function batchScanAllPages() {
  if (!pdfDoc || !cornerRatios || !corrGray) return;

  const runId = ++batchScanRunId;

  batchMode = true;
  batchResults = [];
  currentBatchIdx = 0;
  usedStudentsInBatch = new Set();

  const baseGroupOffsets = groupOffsets.map(off => ({
    ...off
  }));

  const baseHeaderOffsets =
    cloneHeaderOffsets(headerColOffsets);

  for (let pageNumber = 1; pageNumber <= totalPdfPages; pageNumber++) {
    batchResults.push({
      pageNum: pageNumber,
      corrCanvas: null,
      corrGray: null,
      computedOtsu: 128,
      scanResults: [],
      headerInfo: null,

      headerAutoOffsets: cloneHeaderOffsets(null),

      pageGroupOffsets: null,

      pageHeaderColOffsets:
        cloneHeaderOffsets(baseHeaderOffsets),

      studentName: '',
      saved: false,
      pending: true,
      error: false
    });
  }

  document.getElementById('modalBtns').innerHTML = '';

  document.getElementById('modal')
    .classList.add('show');

  const firstCount = Math.min(1, totalPdfPages);

  for (let index = 0; index < firstCount; index++) {
    document.getElementById('modalMsg').innerHTML = `
      <div style="
        display:inline-block;
        width:28px;
        height:28px;
        border:3px solid rgba(var(--p),.2);
        border-top-color:var(--p1);
        border-radius:50%;
        animation:spin .7s linear infinite
      "></div>

      <br>

      自動對齊並掃描第 ${index + 1}/${totalPdfPages} 頁
    `;

    await new Promise(resolve => {
      setTimeout(resolve, 30);
    });

    if (!batchMode || runId !== batchScanRunId) return;

    await processBatchPage(
      index,
      baseGroupOffsets,
      runId
    );
  }

  if (!batchMode || runId !== batchScanRunId) return;

  closeModal();

  currentBatchIdx = 0;

  loadBatchPage(0);
  showScanStep(4);

  if (totalPdfPages > firstCount) {
    toast(
      `✅ 已掃描前 ${firstCount} 頁，` +
      `其餘 ${totalPdfPages - firstCount} 頁背景處理中…`
    );

    backgroundProcessRemaining(
      firstCount,
      baseGroupOffsets,
      runId
    );
  } else {
    toast(`✅ 已批量掃描 ${totalPdfPages} 頁`);
  }
}

async function processBatchPage(
  index,
  baseGroupOffsets,
  runId = batchScanRunId
) {
  const originalPage = batchResults[index];

  if (
    !batchMode ||
    runId !== batchScanRunId ||
    !originalPage
  ) {
    return;
  }

  const pageNumber = originalPage.pageNum;

  const pageHeaderBase = cloneHeaderOffsets(
    originalPage.pageHeaderColOffsets ||
    headerColOffsets
  );

  let transformed;

  try {
    const image = await pdfPageToImage(pageNumber);

    if (
      !batchMode ||
      runId !== batchScanRunId ||
      batchResults[index] !== originalPage
    ) {
      return;
    }

    transformed = perspectiveTransformImg(image);
  } catch (error) {
    if (
      batchMode &&
      runId === batchScanRunId &&
      batchResults[index] === originalPage
    ) {
      batchResults[index] = {
        ...originalPage,
        pending: false,
        error: true,
        errorMessage: error.message || '處理失敗'
      };
    }

    return;
  }

  const savedGroupOffsets = groupOffsets;
  const savedGray = corrGray;
  const savedOtsu = computedOtsu;

  const savedHeaderAutoOffsets = headerAutoOffsets;
  const savedHeaderColOffsets = headerColOffsets;

  try {
    groupOffsets = baseGroupOffsets.map(off => ({
      ...off
    }));

    headerColOffsets =
      cloneHeaderOffsets(pageHeaderBase);

    corrGray = transformed.gray;
    computedOtsu = transformed.otsuVal;

    const threshold = darkThr > 0
      ? darkThr
      : transformed.otsuVal;

    const groupCount = Math.ceil(currentTotalQ / 5);

    for (let group = 0; group < groupCount; group++) {
      alignOneGroup(group, threshold);
    }

    resetHeaderAutoOffsets();

    autoAlignHeader(
      transformed.gray,
      transformed.otsuVal
    );

    const results = readBubblesFrom(
      transformed.gray,
      transformed.otsuVal
    );

    const headerInfo = readHeaderBubblesFrom(
      transformed.gray,
      transformed.otsuVal
    );

    let studentName = '';

    if (headerInfo) {
      const student = autoDetectStudentFromInfo(
        headerInfo
      );

      headerInfo.matchedStudent = student;

      if (student) {
        studentName = student.name;
      }
    }

    batchResults[index] = {
      pageNum: pageNumber,

      corrCanvas: transformed.canvas,
      corrGray: transformed.gray,
      computedOtsu: transformed.otsuVal,

      scanResults: results,
      headerInfo,

      headerAutoOffsets:
        cloneHeaderOffsets(headerAutoOffsets),

      pageGroupOffsets: groupOffsets.map(off => ({
        ...off
      })),

      pageHeaderColOffsets:
        cloneHeaderOffsets(headerColOffsets),

      studentName,
      saved: false,
      pending: false,
      error: false
    };
  } catch (error) {
    batchResults[index] = {
      ...originalPage,
      pending: false,
      error: true,
      errorMessage: error.message || '處理失敗'
    };
  } finally {
    groupOffsets = savedGroupOffsets;
    corrGray = savedGray;
    computedOtsu = savedOtsu;

    headerAutoOffsets = savedHeaderAutoOffsets;
    headerColOffsets = savedHeaderColOffsets;
  }
}

async function backgroundProcessRemaining(
  startIndex,
  baseGroupOffsets,
  runId = batchScanRunId
) {
  for (
    let index = startIndex;
    index < batchResults.length;
    index++
  ) {
    if (!batchMode || runId !== batchScanRunId) return;

    await new Promise(resolve => {
      setTimeout(resolve, 0);
    });

    if (!batchMode || runId !== batchScanRunId) return;

    await processBatchPage(
      index,
      baseGroupOffsets,
      runId
    );

    if (!batchMode || runId !== batchScanRunId) return;

    updateBatchNav();

    if (currentBatchIdx === index) {
      loadBatchPage(index);
    }
  }

  if (batchMode && runId === batchScanRunId) {
    const failures = batchResults.filter(page => {
      return page.error;
    }).length;

    toast(
      failures
        ? `⚠️ 背景掃描完成，${failures} 頁處理失敗`
        : '✅ 全部頁面已完成自動對齊及掃描'
    );
  }
}

function renderBatchPlaceholder(message) {
  document.getElementById('batchNav')
    .classList.remove('hidden');

  document.getElementById('saveAllBtn')
    .classList.remove('hidden');

  document.getElementById('resGrid').innerHTML =
    `<div class="empty-msg">${escAttr(message)}</div>`;

  document.getElementById('scoreDisp').innerHTML = '';

  document.getElementById('multiWarn')
    .classList.add('hidden');

  document.getElementById('headerDetectBar')
    .classList.add('hidden');

  document.getElementById('hdrOverrideNote')
    .classList.add('hidden');

  const canvas = document.getElementById('cPreview');

  if (canvas) {
    canvas.width = 0;
  }

  const legend = document.getElementById('scanReviewLegend');

  if (legend) {
    legend.innerHTML = '';
  }

  document.getElementById('step4Desc').textContent =
    `第 ${currentBatchIdx + 1} / ${batchResults.length} 份`;

  updateBatchNav();
}

function autoDetectStudentFromInfo(headerInfo) {
  return autoDetectStudent(headerInfo);
}

function loadBatchPage(index) {
  if (index < 0 || index >= batchResults.length) return;

  /*
   * 調整視窗開啟時先完成目前頁面的重新讀取，
   * 再切換頁面。
   */
  if (gridAdjustMode) {
    closeGridAdjust();
  }

  currentBatchIdx = index;

  const page = batchResults[index];

  if (
    page.pending ||
    page.error ||
    !page.scanResults ||
    !page.scanResults.length
  ) {
    scanResults = [];
    corrCanvas = null;
    corrGray = null;
    detectedHeaderInfo = null;

    document.getElementById('studentName').value =
      page.studentName || '';

    document.getElementById('studentSelect').value =
      page.studentName || '';

    renderBatchPlaceholder(
      page.error
        ? '⚠️ 此頁處理失敗，請手動重新掃描。'
        : '⏳ 此頁正在背景自動對齊及掃描中，請稍候…'
    );

    return;
  }

  scanResults = page.scanResults;
  corrCanvas = page.corrCanvas;
  corrGray = page.corrGray;
  computedOtsu = page.computedOtsu;

  detectedHeaderInfo = page.headerInfo || null;

  headerAutoOffsets =
    cloneHeaderOffsets(page.headerAutoOffsets);

  if (page.pageHeaderColOffsets) {
    headerColOffsets =
      cloneHeaderOffsets(page.pageHeaderColOffsets);
  }

  if (page.pageGroupOffsets) {
    groupOffsets = page.pageGroupOffsets.map(off => ({
      ...off
    }));
  }

  document.getElementById('studentName').value =
    page.studentName || '';

  document.getElementById('studentSelect').value =
    page.studentName || '';

  renderResultsUI();
}

function batchGo(index) {
  if (!batchResults.length) return;

  if (index < 0) {
    index = batchResults.length - 1;
  }

  if (index >= batchResults.length) {
    index = 0;
  }

  loadBatchPage(index);
}

function updateBatchNav() {
  const total = batchResults.length;

  const saved = batchResults.filter(page => {
    return page.saved;
  }).length;

  document.getElementById('batchInfo').textContent =
    `${currentBatchIdx + 1} / ${total}`;

  document.getElementById('batchSavedTag').textContent =
    `已儲存 ${saved}/${total}`;

  const strip = document.getElementById('batchThumbStrip');

  strip.innerHTML = '';

  batchResults.forEach((page, index) => {
    const item = document.createElement('div');

    item.className =
      'bt2' +
      (index === currentBatchIdx ? ' act' : '') +
      (page.saved ? ' saved' : '');

    item.textContent = index + 1;

    if (page.pending) {
      item.style.opacity = '0.4';
      item.title = '處理中…';
    } else if (page.error) {
      item.style.opacity = '0.5';
      item.title = '處理失敗';
    } else {
      const issues = getScanReviewIssues(
        page.scanResults
      );

      const details = [];

      if (issues.blank.length) {
        details.push(
          `漏填：${scanReviewQuestionList(issues.blank)}`
        );
      }

      if (issues.multiple.length) {
        details.push(
          `多填：${scanReviewQuestionList(issues.multiple)}`
        );
      }

      item.title =
        (page.studentName || `第 ${index + 1} 頁`) +
        (details.length ? '\n' + details.join('\n') : '');
    }

    item.onclick = () => {
      loadBatchPage(index);
    };

    strip.appendChild(item);
  });
}

/* ===== 記錄建立及儲存 ===== */

function getStudentDisplayName() {
  return (
    document.getElementById('studentSelect').value ||
    document.getElementById('studentName').value.trim() ||
    '—'
  );
}

function buildFinalAnswerStringFrom(results) {
  const answers = [];

  for (let index = 0; index < currentTotalQ; index++) {
    answers.push(
      getAnswerFromScanResult(results[index]) || '-'
    );
  }

  return answers.join('');
}

function buildFinalAnswerString() {
  return buildFinalAnswerStringFrom(scanResults);
}

function createScanRecord(results, student, batchPage) {
  const answerKey = currentAnswerKey;
  const hasKey = answerKey.some(answer => answer !== '');

  const answerString =
    buildFinalAnswerStringFrom(results);

  let correct = 0;
  let keyCount = 0;

  for (let index = 0; index < currentTotalQ; index++) {
    const answer = answerString[index] === '-'
      ? ''
      : answerString[index];

    if (hasKey && answerKey[index]) {
      keyCount++;

      if (isAnswerCorrect(answer, answerKey[index])) {
        correct++;
      }
    }
  }

  const selectedPaper = papers.find(paper => {
    return paper.id === selectedPaperId;
  });

  let id = Date.now();

  while (records.some(record => {
    return String(record.id) === String(id);
  })) {
    id++;
  }

  const record = {
    id,
    student,
    class: selectedScanClass || '',
    ans: answerString,
    totalQ: currentTotalQ,

    sc: hasKey && keyCount
      ? `${correct}/${keyCount}`
      : '-',

    pct: hasKey && keyCount
      ? Math.round(correct / keyCount * 100) + '%'
      : '-',

    paperId: selectedPaperId || '',

    paperLabel: selectedPaper
      ? paperLabel(selectedPaper)
      : '（未選擇試卷）',

    time: new Date().toLocaleString('zh-TW')
  };

  if (batchPage !== undefined && batchPage !== null) {
    record.batchPage = batchPage;
  }

  return record;
}

function appendScanRecord(record) {
  records.push(record);

  if (fbConnected && db) {
    db.collection('records').add({
      ...record,
      createdAt:
        firebase.firestore.FieldValue.serverTimestamp()
    }).catch(() => {});
  }
}

function resetScanWorkingState() {
  srcImg = null;
  corrCanvas = null;
  corrGray = null;

  scanResults = [];
  detectedHeaderInfo = null;

  calibActive = false;
  calibStep = 0;
  calibPts = [];

  hdrCalibActive = false;
  hdrCalibStep = 0;
  hdrCalibPts = [];

  mouseOnGrid = {
    x: 0,
    y: 0
  };

  resetHeaderAutoOffsets();

  const button = document.getElementById('calibBtn');

  button.textContent = '📐 三點校準';
  button.onclick = startCalib;

  document.getElementById('studentName').value = '';
  document.getElementById('studentSelect').value = '';

  const legend = document.getElementById('scanReviewLegend');

  if (legend) {
    legend.innerHTML = '';
  }
}

function finishBatchSession(runId) {
  if (
    !batchMode ||
    runId !== batchScanRunId
  ) {
    return;
  }

  batchScanRunId++;

  batchMode = false;
  batchResults = [];
  currentBatchIdx = 0;

  usedStudentsInBatch = new Set();

  resetScanWorkingState();

  maxReachedStep = 0;
  showScanStep(0);
}

function saveRec() {
  if (!scanResults.length) {
    showMsg('請先掃描答案');
    return;
  }

  if (batchMode) {
    saveBatchCurrent();
    return;
  }

  const student = getStudentDisplayName();

  if (!student || student === '—') {
    showMsg(
      '⚠️ 請先選擇或輸入對應的學生，才能儲存記錄。'
    );

    return;
  }

  confirmScanReviewSave(
    scanResults,
    '此試卷',
    () => doSaveRec(student)
  );
}

function doSaveRec(student) {
  if (!scanResults.length || batchMode) return;

  const record = createScanRecord(
    scanResults,
    student
  );

  appendScanRecord(record);

  renderRecs();
  saveSettings();

  showSyncBadge(
    '✅ 已成功儲存記錄',
    'saved',
    2200
  );

  toast('✅ 記錄已儲存，準備掃描下一張');

  usedStudentsInBatch.add(student);

  const currentImage = srcImg;
  const runId = batchScanRunId;

  setTimeout(() => {
    if (
      batchMode ||
      runId !== batchScanRunId ||
      srcImg !== currentImage
    ) {
      return;
    }

    resetScanWorkingState();

    maxReachedStep = 0;
    showScanStep(1);
  }, 700);
}

function saveBatchCurrent() {
  const index = currentBatchIdx;
  const page = batchResults[index];
  const runId = batchScanRunId;

  if (
    !page ||
    page.pending ||
    page.error ||
    !page.scanResults.length ||
    page.saved
  ) {
    return;
  }

  const student = getStudentDisplayName();

  if (!student || student === '—') {
    showMsg(
      `⚠️ 第 ${page.pageNum} 頁尚未對應學生。` +
      '<br>請先選擇或輸入對應的學生才能儲存。'
    );

    return;
  }

  confirmScanReviewSave(
    page.scanResults,
    `第 ${page.pageNum} 頁`,
    () => {
      if (
        !batchMode ||
        runId !== batchScanRunId ||
        batchResults[index] !== page ||
        page.saved
      ) {
        return;
      }

      if (currentBatchIdx !== index) {
        loadBatchPage(index);
      }

      doSaveBatchCurrent(student);
    }
  );
}

function doSaveBatchCurrent(student) {
  const index = currentBatchIdx;
  const page = batchResults[index];

  if (
    !page ||
    page.pending ||
    page.error ||
    page.saved ||
    !page.scanResults.length
  ) {
    return;
  }

  const record = createScanRecord(
    page.scanResults,
    student,
    page.pageNum
  );

  appendScanRecord(record);

  page.saved = true;
  page.studentName = student;

  usedStudentsInBatch.add(student);

  renderRecs();
  saveSettings();
  updateBatchNav();

  showSyncBadge(
    '✅ 已成功儲存記錄',
    'saved',
    2200
  );

  toast(`✅ 第 ${page.pageNum} 頁已儲存`);

  const runId = batchScanRunId;

  const allSaved = batchResults.every(item => {
    return item.saved || item.error;
  });

  if (allSaved) {
    setTimeout(() => {
      if (
        !batchMode ||
        runId !== batchScanRunId
      ) {
        return;
      }

      toast('🎉 所有可處理試卷已儲存完成！返回選擇試卷…');

      finishBatchSession(runId);
    }, 800);

    return;
  }

  const nextAfterCurrent = batchResults.findIndex(
    (item, itemIndex) => {
      return (
        itemIndex > index &&
        !item.saved &&
        !item.error &&
        !item.pending
      );
    }
  );

  const nextReady = nextAfterCurrent >= 0
    ? nextAfterCurrent
    : batchResults.findIndex(item => {
        return (
          !item.saved &&
          !item.error &&
          !item.pending
        );
      });

  const target = nextReady >= 0
    ? nextReady
    : batchResults.findIndex(item => {
        return !item.saved && !item.error;
      });

  if (target >= 0) {
    setTimeout(() => {
      if (
        !batchMode ||
        runId !== batchScanRunId ||
        currentBatchIdx !== index
      ) {
        return;
      }

      loadBatchPage(target);
      scrollToPreview();
    }, 400);
  }
}

/* ===== 全部儲存：先核對頁碼及題號 ===== */

function saveAllBatch() {
  if (!batchMode || !batchResults.length) return;

  const remaining = batchResults.filter(page => {
    return !page.saved && !page.error;
  });

  if (!remaining.length) {
    toast('目前沒有需要儲存的頁面');
    return;
  }

  const pending = remaining.filter(page => {
    return (
      page.pending ||
      !page.scanResults ||
      !page.scanResults.length
    );
  });

  if (pending.length) {
    showMsg(
      '⏳ 以下頁面尚未完成掃描：' +
      '<br><strong>' +
      pending.map(page => {
        return `第 ${page.pageNum} 頁`;
      }).join('、') +
      '</strong>' +
      '<br>請等待背景掃描完成後再全部儲存。'
    );

    return;
  }

  const missingStudents = remaining.filter(page => {
    const name = String(page.studentName || '').trim();

    return !name || name === '—';
  });

  if (missingStudents.length) {
    showMsg(
      '⚠️ 以下頁面尚未對應學生：' +
      '<br><strong>' +
      missingStudents.map(page => {
        return `第 ${page.pageNum} 頁`;
      }).join('、') +
      '</strong>' +
      '<br>請先選擇學生後再全部儲存。'
    );

    return;
  }

  const reports = remaining.map(page => ({
    label: `第 ${page.pageNum} 頁`,
    issues: getScanReviewIssues(page.scanResults)
  }));

  const hasMultiple = reports.some(report => {
    return report.issues.multiple.length > 0;
  });

  const hasBlank = reports.some(report => {
    return report.issues.blank.length > 0;
  });

  const reportHTML = scanReviewReportHTML(reports);

  if (hasMultiple) {
    showMsg(
      '⚠️ 以下頁面有需要核對的題目：' +
      reportHTML +
      '請先處理所有尚未確認的多填題目，再全部儲存。'
    );

    return;
  }

  if (hasBlank) {
    const runId = batchScanRunId;

    showConfirm(
      '⚠️ 以下頁面有漏填／留空題目：' +
      reportHTML +
      '確認以上留空沒有問題，仍要全部儲存嗎？',
      () => {
        if (
          batchMode &&
          runId === batchScanRunId
        ) {
          saveAllBatchConfirmed();
        }
      }
    );

    return;
  }

  saveAllBatchConfirmed();
}

function saveAllBatchConfirmed() {
  if (!batchMode || !batchResults.length) return;

  const remaining = batchResults.filter(page => {
    return !page.saved && !page.error;
  });

  if (!remaining.length) return;

  /*
   * 確認後再檢查一次，防止狀態已改變。
   * 留空已由上一層確認，不重複詢問。
   */
  const invalid = remaining.some(page => {
    const name = String(page.studentName || '').trim();

    return (
      page.pending ||
      !page.scanResults ||
      !page.scanResults.length ||
      !name ||
      name === '—' ||
      getScanReviewIssues(page.scanResults)
        .multiple.length > 0
    );
  });

  if (invalid) {
    saveAllBatch();
    return;
  }

  let savedCount = 0;

  remaining.forEach(page => {
    const student = String(
      page.studentName || ''
    ).trim();

    const record = createScanRecord(
      page.scanResults,
      student,
      page.pageNum
    );

    appendScanRecord(record);

    page.saved = true;
    usedStudentsInBatch.add(student);

    savedCount++;
  });

  renderRecs();
  saveSettings();

  updateBatchNav();
  renderResultsUI();

  const allSaved = batchResults.every(page => {
    return page.saved || page.error;
  });

  if (allSaved && savedCount > 0) {
    showSyncBadge(
      '✅ 已全部成功儲存',
      'saved',
      2500
    );

    const failedCount = batchResults.filter(page => {
      return page.error;
    }).length;

    toast(
      `🎉 已儲存 ${savedCount} 份！` +
      (
        failedCount
          ? `另有 ${failedCount} 頁處理失敗，未儲存。`
          : '返回選擇試卷…'
      )
    );

    const runId = batchScanRunId;

    setTimeout(() => {
      finishBatchSession(runId);
    }, 1000);
  } else {
    toast(`✅ 已儲存 ${savedCount} 份`);
  }
}

/* ===== 返回及重設 ===== */

function goBackFromStep4() {
  if (gridAdjustMode) {
    closeGridAdjust();
  }

  if (!corrCanvas || !corrGray) {
    showMsg('⚠️ 此頁尚未完成掃描，請先選擇已完成的頁面。');
    return;
  }

  if (batchMode) {
    batchScanRunId++;

    batchMode = false;
    batchResults = [];
    currentBatchIdx = 0;
  }

  /*
   * 把結果預覽的班號位置帶回校準畫面。
   */
  if (HG.enabled) {
    applyHdrAutoToPersistent();
  }

  resetHeaderAutoOffsets();

  syncSliders();
  syncDetSliders();
  syncHeaderSliders();

  updGrpDisp();
  updHdrColDisp();
  updateHdrColSelOptions();

  setupGridEvents();

  setGridKeyboardTarget(gridKeyboardTarget);

  showScanStep(3);
}

function resetScan() {
  if (gridAdjustMode) {
    closeGridAdjust();
  }

  batchScanRunId++;

  batchMode = false;
  batchResults = [];
  currentBatchIdx = 0;

  usedStudentsInBatch = new Set();

  resetScanWorkingState();

  maxReachedStep = 0;
  showScanStep(1);
}