/* ===== scan.js — FILE / CAMERA / PDF ===== */
function onFile(e){const f=e.target.files[0];if(f)loadFile(f);}
function loadFile(f){if(f.type==='application/pdf'||f.name.toLowerCase().endsWith('.pdf')){loadPDF(f);return;}closePdfControls();showUploadProgress(0,'讀取圖片中…');const r=new FileReader();r.onprogress=e=>{if(e.lengthComputable)showUploadProgress(e.loaded/e.total*90,'讀取圖片中…');};r.onload=e=>{showUploadProgress(95,'載入圖片…');const img=new Image();img.onload=()=>{showUploadProgress(100,'✅ 完成！');setTimeout(()=>hideUploadProgress(),250);processImg(img);};img.onerror=()=>{hideUploadProgress();showMsg('⚠️ 無法載入圖片');};img.src=e.target.result;};r.onerror=()=>{hideUploadProgress();showMsg('⚠️ 無法讀取檔案');};r.readAsDataURL(f);}
function toggleCam(){const box=document.getElementById('camBox'),vid=document.getElementById('camVid');if(camStream){camStream.getTracks().forEach(t=>t.stop());camStream=null;box.classList.add('hidden');return;}navigator.mediaDevices.getUserMedia({video:{facingMode:'environment',width:{ideal:1920}}}).then(s=>{camStream=s;vid.srcObject=s;box.classList.remove('hidden');}).catch(()=>showMsg('無法開啟相機'));}
function capture(){const v=document.getElementById('camVid'),c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d').drawImage(v,0,0);toggleCam();closePdfControls();const img=new Image();img.onload=()=>processImg(img);img.src=c.toDataURL('image/jpeg',.92);}
function closePdfControls(){document.getElementById('pdfControls').classList.add('hidden');pdfDoc=null;totalPdfPages=0;currentPdfPage=1;pdfRenderedImg=null;}

/* ===== 上載進度顯示（環形 + 進度條） =====
   pct：0–100；status：狀態文字。供圖片讀取與 PDF 解析/縮圖/渲染各階段呼叫。 */
function showUploadProgress(pct,status){const box=document.getElementById('uploadProgress');if(!box)return;box.classList.remove('hidden');pct=Math.max(0,Math.min(100,Math.round(pct)));const ring=document.getElementById('upRing');if(ring)ring.style.setProperty('--upct',pct);const pe=document.getElementById('upPct');if(pe)pe.textContent=pct+'%';const bf=document.getElementById('upBarFill');if(bf)bf.style.width=pct+'%';if(status!==undefined){const st=document.getElementById('upStatus');if(st)st.textContent=status;}}
function hideUploadProgress(){const box=document.getElementById('uploadProgress');if(box)box.classList.add('hidden');}

/* PDF 載入後自動使用第一頁進入下一步，老師無需按「使用此頁」。
   （多頁 PDF 仍可於步驟 3 按「批量掃描」一次處理所有頁面）
   載入過程以漂亮的環形進度顯示各階段進度。 */
async function loadPDF(file){
  if(typeof pdfjsLib==='undefined'){showMsg('⚠️ PDF.js 載入失敗');return;}
  document.getElementById('pdfControls').classList.remove('hidden');
  document.getElementById('pdfLoading').classList.add('hidden');
  showUploadProgress(5,'讀取 PDF 檔案中…');
  try{
    const ab=await file.arrayBuffer();
    showUploadProgress(15,'解析 PDF 文件…');
    pdfDoc=await pdfjsLib.getDocument({data:ab}).promise;
    totalPdfPages=pdfDoc.numPages;currentPdfPage=1;
    document.getElementById('pdfPageInfo').textContent=`1/${totalPdfPages}`;
    showUploadProgress(28,`共 ${totalPdfPages} 頁 · 產生縮圖中…`);
    await buildPdfThumbnails(frac=>showUploadProgress(28+Math.round(frac*42),`產生縮圖中… ${Math.round(frac*100)}%`));
    showUploadProgress(75,'渲染第 1 頁…');
    await renderPdfPage(1);
    showUploadProgress(100,'✅ 載入完成！');
    toast(`📄 PDF ${totalPdfPages} 頁，已自動載入第 1 頁`);
    setTimeout(()=>hideUploadProgress(),400);
    usePdfPage();
  }catch(err){
    hideUploadProgress();
    showMsg('⚠️ 無法讀取 PDF：'+err.message);
  }
}
async function buildPdfThumbnails(onProg){const strip=document.getElementById('pdfThumbStrip');strip.innerHTML='';if(!pdfDoc)return;const total=Math.min(totalPdfPages,30);for(let p=1;p<=total;p++){try{const page=await pdfDoc.getPage(p);const vp=page.getViewport({scale:.15});const tc=document.createElement('canvas');tc.width=vp.width;tc.height=vp.height;await page.render({canvasContext:tc.getContext('2d'),viewport:vp}).promise;const ti=document.createElement('img');ti.src=tc.toDataURL();ti.className='pdf-thumb'+(p===currentPdfPage?' active':'');ti.dataset.page=p;ti.onclick=()=>pdfGoPage(p);strip.appendChild(ti);}catch(e){}if(onProg)onProg(p/total);}}
async function renderPdfPage(pn){if(!pdfDoc||pn<1||pn>totalPdfPages)return;currentPdfPage=pn;document.getElementById('pdfPageInfo').textContent=`${pn}/${totalPdfPages}`;document.querySelectorAll('.pdf-thumb').forEach(t=>t.classList.toggle('active',+t.dataset.page===pn));const dpi=+(document.getElementById('pdfDpiSel').value)||300,scale=dpi/72;const page=await pdfDoc.getPage(pn),vp=page.getViewport({scale});const pc=document.getElementById('cPdfPreview');pc.width=vp.width;pc.height=vp.height;const pctx=pc.getContext('2d');pctx.fillStyle='#fff';pctx.fillRect(0,0,pc.width,pc.height);await page.render({canvasContext:pctx,viewport:vp}).promise;pdfRenderedImg=new Image();pdfRenderedImg.src=pc.toDataURL('image/png');}
async function pdfGoPage(pn){if(!pdfDoc)return;pn=Math.max(1,Math.min(pn,totalPdfPages));document.getElementById('pdfLoading').classList.remove('hidden');try{await renderPdfPage(pn);}catch(e){}document.getElementById('pdfLoading').classList.add('hidden');}
function usePdfPage(){if(!pdfRenderedImg){showMsg('請先等待 PDF 渲染完成');return;}if(!pdfRenderedImg.complete){pdfRenderedImg.onload=()=>processImg(pdfRenderedImg);return;}processImg(pdfRenderedImg);}
function processImg(img){srcImg=img;const cnv=document.getElementById('cCorner');const maxW=Math.min(780,window.innerWidth-40);cScale=Math.min(1,maxW/img.width);cnv.width=Math.round(img.width*cScale);cnv.height=Math.round(img.height*cScale);if(cornerRatios&&cornerRatios.length===4){corners=cornerRatios.map(c=>({x:c.rx*img.width,y:c.ry*img.height}));document.getElementById('cornerSavedHint').textContent='（已載入上次位置）';}else{corners=[{x:img.width*.04,y:img.height*.02},{x:img.width*.96,y:img.height*.02},{x:img.width*.96,y:img.height*.98},{x:img.width*.04,y:img.height*.98}];autoCorners();document.getElementById('cornerSavedHint').textContent='';}drawCorners();setupCornerDrag();showScanStep(2);}

/* ===== PERSPECTIVE & GRID ===== */
function autoCorners(){if(!srcImg)return;const tc=document.createElement('canvas'),w=srcImg.width,h=srcImg.height;tc.width=w;tc.height=h;const tctx=tc.getContext('2d');tctx.drawImage(srcImg,0,0);const d=tctx.getImageData(0,0,w,h).data;const gray=new Uint8Array(w*h);for(let i=0;i<w*h;i++)gray[i]=Math.round(d[i*4]*.299+d[i*4+1]*.587+d[i*4+2]*.114);const thr=otsu(gray,w*h);const bin=new Uint8Array(w*h);for(let i=0;i<gray.length;i++)bin[i]=gray[i]<thr?1:0;const rw=Math.floor(w*.12),rh=Math.floor(h*.08);[{sx:0,sy:0,ex:rw,ey:rh,c:0},{sx:w-rw,sy:0,ex:w,ey:rh,c:1},{sx:w-rw,sy:h-rh,ex:w,ey:h,c:2},{sx:0,sy:h-rh,ex:w,ey:h,c:3}].forEach(r=>{const pts=[];for(let y=r.sy;y<Math.min(r.ey,h);y++)for(let x=r.sx;x<Math.min(r.ex,w);x++)if(bin[y*w+x])pts.push({x,y});if(pts.length<20)return;pts.forEach(p=>{switch(r.c){case 0:p.s=-(p.x+p.y);break;case 1:p.s=p.x-p.y;break;case 2:p.s=p.x+p.y;break;case 3:p.s=p.y-p.x;break;}});pts.sort((a,b)=>b.s-a.s);const n=Math.max(3,Math.floor(pts.length*.03));let sx=0,sy=0;for(let i=0;i<n;i++){sx+=pts[i].x;sy+=pts[i].y;}corners[r.c]={x:sx/n,y:sy/n};});drawCorners();}
function drawCorners(){const cnv=document.getElementById('cCorner'),ctx=cnv.getContext('2d');ctx.clearRect(0,0,cnv.width,cnv.height);ctx.drawImage(srcImg,0,0,cnv.width,cnv.height);ctx.beginPath();ctx.strokeStyle='rgba(139,92,246,.5)';ctx.lineWidth=2;corners.forEach((p,i)=>{const x=p.x*cScale,y=p.y*cScale;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();ctx.stroke();['TL','TR','BR','BL'].forEach((lb,i)=>{const x=corners[i].x*cScale,y=corners[i].y*cScale;ctx.beginPath();ctx.arc(x,y,10,0,Math.PI*2);ctx.fillStyle=dragIdx===i?'#fbbf24':'rgb(139,92,246)';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#fff';ctx.font='bold 11px Inter,sans-serif';ctx.fillText(lb,x+13,y+4);});}
function setupCornerDrag(){const cnv=document.getElementById('cCorner');function gp(e){const r=cnv.getBoundingClientRect();const cx=e.touches?e.touches[0].clientX:e.clientX,cy=e.touches?e.touches[0].clientY:e.clientY;return{x:(cx-r.left)/cScale,y:(cy-r.top)/cScale};}let dragging=false;function dn(e){e.preventDefault();const p=gp(e);let mn=1e9;corners.forEach((c,i)=>{const d=Math.hypot(c.x-p.x,c.y-p.y);if(d<mn){mn=d;dragIdx=i;}});if(mn>40/cScale)dragIdx=-1;else dragging=true;drawCorners();}function mv(e){if(!dragging||dragIdx<0)return;e.preventDefault();corners[dragIdx]=gp(e);drawCorners();}function up(){dragging=false;dragIdx=-1;drawCorners();}cnv.onmousedown=dn;cnv.onmousemove=mv;cnv.onmouseup=up;cnv.onmouseleave=up;cnv.ontouchstart=dn;cnv.ontouchmove=mv;cnv.ontouchend=up;}
function solveLS(A,b){const n=b.length;const M=A.map((r,i)=>[...r,b[i]]);for(let c=0;c<n;c++){let mx=Math.abs(M[c][c]),mr=c;for(let r=c+1;r<n;r++)if(Math.abs(M[r][c])>mx){mx=Math.abs(M[r][c]);mr=r;}if(mr!==c)[M[c],M[mr]]=[M[mr],M[c]];for(let r=c+1;r<n;r++){const f=M[r][c]/M[c][c];for(let j=c;j<=n;j++)M[r][j]-=f*M[c][j];}}const x=new Array(n);for(let i=n-1;i>=0;i--){x[i]=M[i][n];for(let j=i+1;j<n;j++)x[i]-=M[i][j]*x[j];x[i]/=M[i][i];}return x;}
function computeH(src,dst){const A=[],b=[];for(let i=0;i<4;i++){const u=dst[i].x,v=dst[i].y,x=src[i].x,y=src[i].y;A.push([u,v,1,0,0,0,-u*x,-v*x]);b.push(x);A.push([0,0,0,u,v,1,-u*y,-v*y]);b.push(y);}const h=solveLS(A,b);return(dx,dy)=>{const w=h[6]*dx+h[7]*dy+1;return{x:(h[0]*dx+h[1]*dy+h[2])/w,y:(h[3]*dx+h[4]*dy+h[5])/w};};}
function otsu(gray,len){const hist=new Array(256).fill(0);for(let i=0;i<len;i++)hist[gray[i]]++;let total=len,sum=0;for(let i=0;i<256;i++)sum+=i*hist[i];let sB=0,wB=0,maxV=0,thr=128;for(let i=0;i<256;i++){wB+=hist[i];if(!wB)continue;const wF=total-wB;if(!wF)break;sB+=i*hist[i];const mB=sB/wB,mF=(sum-sB)/wF,v=wB*wF*(mB-mF)*(mB-mF);if(v>maxV){maxV=v;thr=i;}}return thr;}
function perspectiveTransformImg(img){const sc=document.createElement('canvas');sc.width=img.width;sc.height=img.height;const sctx=sc.getContext('2d');sctx.drawImage(img,0,0);const sData=sctx.getImageData(0,0,sc.width,sc.height);const cc=document.createElement('canvas');cc.width=CW;cc.height=CH;const dctx=cc.getContext('2d');const dData=dctx.createImageData(CW,CH);const imgCorners=cornerRatios.map(c=>({x:c.rx*img.width,y:c.ry*img.height}));const dstC=[{x:0,y:0},{x:CW,y:0},{x:CW,y:CH},{x:0,y:CH}];const mapFn=computeH(imgCorners,dstC);for(let dy=0;dy<CH;dy++)for(let dx=0;dx<CW;dx++){const s=mapFn(dx,dy);const ix=Math.round(s.x),iy=Math.round(s.y);if(ix>=0&&ix<sc.width&&iy>=0&&iy<sc.height){const si=(iy*sc.width+ix)*4,di=(dy*CW+dx)*4;dData.data[di]=sData.data[si];dData.data[di+1]=sData.data[si+1];dData.data[di+2]=sData.data[si+2];dData.data[di+3]=255;}}dctx.putImageData(dData,0,0);const cg=new Uint8Array(CW*CH);for(let i=0;i<CW*CH;i++)cg[i]=Math.round(dData.data[i*4]*.299+dData.data[i*4+1]*.587+dData.data[i*4+2]*.114);return{canvas:cc,gray:cg,otsuVal:otsu(cg,CW*CH)};}
function getFillRatioFrom(gray,cx,cy,thr){const hw=Math.floor(G.bw/2),hh=Math.floor(G.bh/2);let dark=0,cnt=0;const icx=Math.round(cx),icy=Math.round(cy);for(let dy=-hh;dy<=hh;dy++)for(let dx=-hw;dx<=hw;dx++){const px=icx+dx,py=icy+dy;if(px>=0&&px<CW&&py>=0&&py<CH){cnt++;if(gray[py*CW+px]<thr)dark++;}}return cnt>0?dark/cnt:0;}
function readBubblesFrom(gray,otsuVal){const thr=darkThr>0?darkThr:otsuVal,fmin=fillMin/100;const results=[];for(let q=1;q<=currentTotalQ;q++){const ratios=[];for(let o=0;o<4;o++){const p=getBubblePos(q,o);ratios.push(getFillRatioFrom(gray,p.x,p.y,thr));}const filled=[];for(let o=0;o<4;o++)if(ratios[o]>=fmin)filled.push(o);let auto='';if(filled.length===1)auto='ABCD'[filled[0]];else if(filled.length>1)auto=null;results.push({ratios,filled,auto,manual:undefined});}return results;}
async function pdfPageToImage(pn){const dpi=+(document.getElementById('pdfDpiSel').value)||300,scale=dpi/72;const page=await pdfDoc.getPage(pn),vp=page.getViewport({scale});const tc=document.createElement('canvas');tc.width=vp.width;tc.height=vp.height;const tctx=tc.getContext('2d');tctx.fillStyle='#fff';tctx.fillRect(0,0,tc.width,tc.height);await page.render({canvasContext:tctx,viewport:vp}).promise;return new Promise(r=>{const img=new Image();img.onload=()=>r(img);img.src=tc.toDataURL('image/png');});}
function doPerspective(){if(!srcImg)return;cornerRatios=corners.map(c=>({rx:c.x/srcImg.width,ry:c.y/srcImg.height}));saveSettings();const r=perspectiveTransformImg(srcImg);corrCanvas=r.canvas;corrGray=r.gray;computedOtsu=r.otsuVal;const gc=document.getElementById('cGrid');const cap=window.innerWidth>=1200?1000:780;const maxW=Math.min(cap,window.innerWidth-40);const gs=Math.min(1,maxW/CW);gc.width=Math.round(CW*gs);gc.height=Math.round(CH*gs);syncSliders();syncDetSliders();syncHeaderSliders();updHdrColDisp();updateHdrColSelOptions();drawGrid();setupGridEvents();showScanStep(3);}
function getGroupIdx(q){return Math.floor((q-1)/20)*4+Math.floor(((q-1)%20)/5);}
function getGroupLabel(gi){const col=Math.floor(gi/4)+1,grp=gi%4,q1=(col-1)*20+grp*5+1;return`欄${col} Q${q1}-${Math.min(q1+4,currentTotalQ)}`;}
function buildGrpSel(){const sel=document.getElementById('grpSel');sel.innerHTML='';const ng=Math.ceil(currentTotalQ/5);for(let i=0;i<ng;i++){const o=document.createElement('option');o.value=i;o.textContent=getGroupLabel(i);sel.appendChild(o);}if(selectedGrp>=ng)selectedGrp=0;sel.value=selectedGrp;}
function selGrp(gi){selectedGrp=gi;document.getElementById('grpSel').value=gi;updGrpDisp();drawGrid();}
function updGrpDisp(){const off=groupOffsets[selectedGrp]||{dx:0,dy:0,drs:0,dos:0};document.getElementById('grpDxV').textContent=(off.dx||0).toFixed(1);document.getElementById('grpDyV').textContent=(off.dy||0).toFixed(1);document.getElementById('grpDrsV').textContent=(off.drs||0).toFixed(1);document.getElementById('grpDosV').textContent=(off.dos||0).toFixed(1);document.getElementById('grpRsEff').textContent=`(=${(G.rs+(off.drs||0)).toFixed(1)})`;document.getElementById('grpOsEff').textContent=`(=${(G.os+(off.dos||0)).toFixed(1)})`;}
function nudgeGrp(axis,dir){const step=+(document.getElementById('stepSz').value);if(!groupOffsets[selectedGrp])groupOffsets[selectedGrp]={dx:0,dy:0,drs:0,dos:0};groupOffsets[selectedGrp][axis]=(groupOffsets[selectedGrp][axis]||0)+dir*step;updGrpDisp();drawGrid();saveSettings();}
function resetGrp(){groupOffsets[selectedGrp]={dx:0,dy:0,drs:0,dos:0};updGrpDisp();drawGrid();saveSettings();}
function copyToCol(){const col=Math.floor(selectedGrp/4),off={...groupOffsets[selectedGrp]};for(let i=col*4;i<col*4+4&&i<16;i++)groupOffsets[i]={...off};drawGrid();saveSettings();}
function copyToAllBelow(){const off={...groupOffsets[selectedGrp]};for(let i=selectedGrp+1;i<16;i++)groupOffsets[i]={...off};drawGrid();saveSettings();}
function resetAllGrp(){for(let i=0;i<16;i++)groupOffsets[i]={dx:0,dy:0,drs:0,dos:0};updGrpDisp();drawGrid();saveSettings();}
function getBubblePos(q,optIdx){const col=Math.floor((q-1)/20),ric=(q-1)%20,grp=Math.floor(ric/5),rig=ric%5,gi=col*4+grp,off=groupOffsets[gi]||{dx:0,dy:0,drs:0,dos:0};const secH=5*G.rs+G.gg;return{x:G.ox+col*G.cs+optIdx*(G.os+(off.dos||0))+(off.dx||0),y:G.oy+grp*secH+rig*(G.rs+(off.drs||0))+(off.dy||0)};}
function autoAlignAll(){if(!corrGray){showMsg('請先完成步驟 2');return;}const btn=document.getElementById('autoAlignBtn');btn.disabled=true;btn.textContent='⏳ 對齊中...';setTimeout(()=>{try{doAutoAlignAll();}catch(e){}btn.disabled=false;btn.textContent='🎯 自動對齊';},30);}
function doAutoAlignAll(){const thr=darkThr>0?darkThr:computedOtsu,ng=Math.ceil(currentTotalQ/5);let cnt=0;for(let gi=0;gi<ng;gi++){if(alignOneGroup(gi,thr))cnt++;}if(cnt>1){const used=groupOffsets.slice(0,ng),mDx=used.reduce((s,o)=>s+(o.dx||0),0)/ng,mDy=used.reduce((s,o)=>s+(o.dy||0),0)/ng;if(Math.abs(mDx)>2||Math.abs(mDy)>2){const rx=Math.round(mDx*2)/2,ry=Math.round(mDy*2)/2;G.ox+=rx;G.oy+=ry;for(let i=0;i<ng;i++){groupOffsets[i].dx=(groupOffsets[i].dx||0)-rx;groupOffsets[i].dy=(groupOffsets[i].dy||0)-ry;}}}if(HG.enabled){resetHeaderAutoOffsets();autoAlignHeader(corrGray,computedOtsu);applyHdrAutoToPersistent();updHdrColDisp();}updGrpDisp();syncSliders();drawGrid();saveSettings();toast(`✅ 自動對齊完成（${cnt} 組${HG.enabled?' + 班號':''}）`);}
function alignOneGroup(gi,thr){const col=Math.floor(gi/4),grp=gi%4,q1=col*20+grp*5+1,q2=Math.min(q1+4,currentTotalQ);if(q1>currentTotalQ)return null;const svDx=groupOffsets[gi].dx||0,svDy=groupOffsets[gi].dy||0;groupOffsets[gi].dx=0;groupOffsets[gi].dy=0;const bp=[];for(let q=q1;q<=q2;q++)for(let o=0;o<4;o++)bp.push(getBubblePos(q,o));groupOffsets[gi].dx=svDx;groupOffsets[gi].dy=svDy;const hw=Math.floor(G.bw/2),hh=Math.floor(G.bh/2);function sc(dx,dy){const r=[];for(const b of bp){const cx=Math.round(b.x+dx),cy=Math.round(b.y+dy);let dk=0,n=0;for(let iy=-hh;iy<=hh;iy++){const py=cy+iy;if(py<0||py>=CH)continue;const ro=py*CW;for(let ix=-hw;ix<=hw;ix++){const px=cx+ix;if(px>=0&&px<CW){n++;if(corrGray[ro+px]<thr)dk++;}}}r.push(n>0?dk/n:0);}const m=r.reduce((a,v)=>a+v,0)/r.length;return r.reduce((a,v)=>a+(v-m)*(v-m),0)/r.length;}let best=-1,bx=svDx,by=svDy;for(let dx=svDx-16;dx<=svDx+16;dx+=2)for(let dy=svDy-16;dy<=svDy+16;dy+=2){const s=sc(dx,dy);if(s>best){best=s;bx=dx;by=dy;}}let fx=bx,fy=by,fs=best;for(let dx=bx-2.5;dx<=bx+2.5;dx+=.5)for(let dy=by-2.5;dy<=by+2.5;dy+=.5){const s=sc(dx,dy);if(s>fs){fs=s;fx=dx;fy=dy;}}groupOffsets[gi].dx=fx;groupOffsets[gi].dy=fy;return{dx:fx-svDx,dy:fy-svDy};}
function autoAlignSelected(){if(!corrGray)return;const thr=darkThr>0?darkThr:computedOtsu;alignOneGroup(selectedGrp,thr);updGrpDisp();drawGrid();saveSettings();}
function syncSliders(){document.getElementById('sOX').value=G.ox;document.getElementById('sOY').value=G.oy;document.getElementById('sOS').value=G.os;document.getElementById('sRS').value=G.rs;document.getElementById('sCS').value=G.cs;document.getElementById('sGG').value=G.gg;document.getElementById('sBW').value=G.bw;document.getElementById('sBH').value=G.bh;updSliderVals();}
function updSliderVals(){['OX','OY','OS','RS','CS','GG','BW','BH'].forEach(k=>document.getElementById('v'+k).textContent=document.getElementById('s'+k).value);}
function onSlider(){G.ox=+document.getElementById('sOX').value;G.oy=+document.getElementById('sOY').value;G.os=+document.getElementById('sOS').value;G.rs=+document.getElementById('sRS').value;G.cs=+document.getElementById('sCS').value;G.gg=+document.getElementById('sGG').value;G.bw=+document.getElementById('sBW').value;G.bh=+document.getElementById('sBH').value;updSliderVals();updGrpDisp();drawGrid();saveSettings();}
function syncDetSliders(){document.getElementById('sFR').value=fillMin;document.getElementById('sDT').value=darkThr;updDetVals();}
function updDetVals(){document.getElementById('vFR').textContent=fillMin+'%';document.getElementById('vDT').textContent=darkThr===0?'自動('+computedOtsu+')':darkThr;}
function onDetSlider(){fillMin=+document.getElementById('sFR').value;darkThr=+document.getElementById('sDT').value;updDetVals();saveSettings();}
function resetGridDefaults(){G={ox:75,oy:505,os:24.5,rs:27.5,cs:232,gg:14,bw:16,bh:10};resetAllGrp();syncSliders();drawGrid();saveSettings();}
function drawRR(ctx,cx,cy,w,h){const hw=w/2,hh=h/2,r=Math.min(hw,hh)*.3,x=cx-hw,y=cy-hh;ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();}
function drawGrid(){if(!corrCanvas)return;const gc=document.getElementById('cGrid'),ctx=gc.getContext('2d'),s=gc.width/CW;ctx.clearRect(0,0,gc.width,gc.height);ctx.drawImage(corrCanvas,0,0,gc.width,gc.height);if(HG.enabled){const hdrCols=[];if(electiveScanMode)hdrCols.push({key:'cls',count:9,labels:ELEC_CLASS_LETTERS,color:'rgba(168,85,247,'});hdrCols.push({key:'no1',count:10,labels:['0','1','2','3','4','5','6','7','8','9'],color:'rgba(16,185,129,'},{key:'no2',count:10,labels:['0','1','2','3','4','5','6','7','8','9'],color:'rgba(34,211,238,'});hdrCols.forEach(col=>{const isSel=col.key===selectedHdrCol;for(let r=0;r<col.count;r++){const p=getHeaderBubblePos(col.key,r,false);drawRR(ctx,p.x*s,p.y*s,HG.hbw*s,HG.hbh*s);ctx.strokeStyle=isSel?col.color+'1)':col.color+'0.7)';ctx.lineWidth=isSel?2.5:1.5;ctx.stroke();if(isSel){ctx.fillStyle=col.color+'0.08)';ctx.fill();}ctx.fillStyle=col.color+'0.7)';ctx.font=`${Math.max(6,7*s)}px sans-serif`;ctx.fillText(col.labels[r],p.x*s+HG.hbw*s*.6,p.y*s+3);}});const topY=(HG.startY-14)*s;ctx.font=`bold ${Math.max(8,9*s)}px sans-serif`;if(electiveScanMode){ctx.fillStyle='rgba(168,85,247,.9)';ctx.fillText('班別',HG.clsX*s-10*s+(headerColOffsets.cls.dx||0)*s,topY+(headerColOffsets.cls.dy||0)*s);}ctx.fillStyle='rgba(16,185,129,.9)';ctx.fillText('十位',HG.no1X*s-10*s+(headerColOffsets.no1.dx||0)*s,topY+(headerColOffsets.no1.dy||0)*s);ctx.fillStyle='rgba(34,211,238,.9)';ctx.fillText('個位',HG.no2X*s-10*s+(headerColOffsets.no2.dx||0)*s,topY+(headerColOffsets.no2.dy||0)*s);}for(let q=1;q<=currentTotalQ;q++){const gi=getGroupIdx(q),isSel=gi===selectedGrp;for(let o=0;o<4;o++){const p=getBubblePos(q,o);drawRR(ctx,p.x*s,p.y*s,G.bw*s,G.bh*s);ctx.strokeStyle=isSel?'rgba(139,92,246,.95)':'rgba(96,165,250,.55)';ctx.lineWidth=isSel?2.5:1.5;ctx.stroke();}const p0=getBubblePos(q,0);ctx.fillStyle=gi===selectedGrp?'rgba(139,92,246,.85)':'rgba(139,92,246,.4)';ctx.font=`${Math.max(7,8*s)}px sans-serif`;ctx.fillText(q,p0.x*s-20*s,p0.y*s+3);}if(mouseOnGrid.x>0){const sz=140,mx=mouseOnGrid.x,my=mouseOnGrid.y,srcX=mx/s,srcY=my/s,srcSz=sz/(4*s),mgX=gc.width-sz-8,mgY=8;ctx.save();ctx.beginPath();ctx.roundRect(mgX,mgY,sz,sz,10);ctx.clip();ctx.drawImage(corrCanvas,srcX-srcSz/2,srcY-srcSz/2,srcSz,srcSz,mgX,mgY,sz,sz);ctx.restore();ctx.strokeStyle='rgba(139,92,246,.6)';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(mgX,mgY,sz,sz,10);ctx.stroke();}if(calibActive)calibPts.forEach((cp,i)=>{ctx.beginPath();ctx.arc(cp.x*s,cp.y*s,7,0,Math.PI*2);ctx.fillStyle='rgb(52,211,153)';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#fff';ctx.font='bold 10px sans-serif';ctx.fillText(calibLabels[i],cp.x*s+10,cp.y*s+4);});if(hdrCalibActive)hdrCalibPts.forEach((cp,i)=>{ctx.beginPath();ctx.arc(cp.x*s,cp.y*s,7,0,Math.PI*2);ctx.fillStyle='rgb(34,211,238)';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#fff';ctx.font='bold 10px sans-serif';ctx.fillText(HDR_CALIB_LABELS[i],cp.x*s+10,cp.y*s+4);});}
function setupGridEvents(){const gc=document.getElementById('cGrid');gc.onmousemove=e=>{const r=gc.getBoundingClientRect();const sx=gc.width/r.width,sy=gc.height/r.height;mouseOnGrid={x:(e.clientX-r.left)*sx,y:(e.clientY-r.top)*sy};drawGrid();};gc.onmouseleave=()=>{mouseOnGrid={x:0,y:0};drawGrid();};gc.onclick=e=>{const r=gc.getBoundingClientRect(),scaleX=gc.width/r.width,scaleY=gc.height/r.height,s=gc.width/CW,cx=(e.clientX-r.left)*scaleX/s,cy=(e.clientY-r.top)*scaleY/s;if(hdrCalibActive){handleHeaderCalibClick(cx,cy);return;}if(calibActive){handleCalibClick(cx,cy);return;}let minD=1e9,bestG=0;for(let q=1;q<=currentTotalQ;q++){const p=getBubblePos(q,1.5);const d=Math.hypot(p.x-cx,p.y-cy);if(d<minD){minD=d;bestG=getGroupIdx(q);}}selGrp(bestG);};}
function startCalib(){calibActive=true;calibStep=0;calibPts=[];document.getElementById('calibBtn').textContent='❌ 取消';document.getElementById('calibBtn').onclick=cancelCalib;document.getElementById('calibStatus').innerHTML=`🎯 校準 [1/3]：點擊 <strong>${calibLabels[0]}</strong> 的氣泡中心`;document.getElementById('calibStatus').style.cssText='background:rgba(52,211,153,.08);border-color:rgba(52,211,153,.15);color:rgb(52,211,153)';}
function cancelCalib(){calibActive=false;calibStep=0;calibPts=[];document.getElementById('calibBtn').textContent='📐 三點校準';document.getElementById('calibBtn').onclick=startCalib;document.getElementById('calibStatus').innerHTML='💡 校準已取消。';document.getElementById('calibStatus').style.cssText='';drawGrid();}
function handleCalibClick(cx,cy){calibPts.push({x:cx,y:cy});calibStep++;if(calibStep<3)document.getElementById('calibStatus').innerHTML=`🎯 校準 [${calibStep+1}/3]：點擊 <strong>${calibLabels[calibStep]}</strong> 的氣泡中心`;else finishCalib();drawGrid();}
function finishCalib(){calibActive=false;const[p1,p2,p3]=calibPts;G.os=(p2.x-p1.x)/3;G.rs=(p2.y-p1.y)/4;G.ox=p1.x;G.oy=p1.y;G.cs=p3.x-p1.x;G.gg=G.rs*.5;resetAllGrp();syncSliders();drawGrid();saveSettings();document.getElementById('calibBtn').textContent='📐 三點校準';document.getElementById('calibBtn').onclick=startCalib;document.getElementById('calibStatus').innerHTML='✅ 校準完成！';document.getElementById('calibStatus').style.cssText='background:rgba(52,211,153,.08);border-color:rgba(52,211,153,.15);color:rgb(52,211,153)';}
function getFillRatio(cx,cy,thr){return getFillRatioFrom(corrGray,cx,cy,thr);}

/* ===== STEP 4 GRID ADJUSTMENT POPUP ===== */
function openGridAdjust(){
  if(!corrCanvas||!corrGray){showMsg('⚠️ 此頁尚未完成掃描，無法調整格線。');return;}
  const cols=document.getElementById('gridCalibCols');
  const body=document.getElementById('gridAdjustBody');
  if(!cols||!body)return;
  gridAdjustOrigParent=cols.parentNode;
  gridAdjustOrigNext=cols.nextSibling;
  body.appendChild(cols);
  document.getElementById('gridAdjustOverlay').classList.add('show');
  document.getElementById('gridAdjustPanel').classList.add('show');
  gridAdjustMode=true;
  const gc=document.getElementById('cGrid');
  const maxW=Math.min(880,window.innerWidth-90);const gs=Math.min(1,maxW/CW);gc.width=Math.round(CW*gs);gc.height=Math.round(CH*gs);
  buildGrpSel();syncSliders();syncDetSliders();syncHeaderSliders();updGrpDisp();updHdrColDisp();updateHdrColSelOptions();
  setupGridEvents();drawGrid();
}
function closeGridAdjust(){
  if(!gridAdjustMode)return;
  gridAdjustMode=false;
  if(calibActive)cancelCalib();
  if(hdrCalibActive){hdrCalibActive=false;hdrCalibStep=0;hdrCalibPts=[];}
  document.getElementById('gridAdjustOverlay').classList.remove('show');
  document.getElementById('gridAdjustPanel').classList.remove('show');
  const cols=document.getElementById('gridCalibCols');
  if(cols&&gridAdjustOrigParent){if(gridAdjustOrigNext&&gridAdjustOrigNext.parentNode===gridAdjustOrigParent)gridAdjustOrigParent.insertBefore(cols,gridAdjustOrigNext);else gridAdjustOrigParent.appendChild(cols);}
  rereadCurrentAfterAdjust();
}
function rereadCurrentAfterAdjust(){
  if(!corrGray)return;
  detectedHeaderInfo=readHeaderBubblesFrom(corrGray,computedOtsu);
  const results=readBubblesFrom(corrGray,computedOtsu);
  scanResults=results;
  if(batchMode&&batchResults[currentBatchIdx]){
    const b=batchResults[currentBatchIdx];
    b.scanResults=results;
    b.headerInfo=detectedHeaderInfo;
    b.pageGroupOffsets=groupOffsets.map(o=>({...o}));
    b.headerAutoOffsets=JSON.parse(JSON.stringify(headerAutoOffsets));
  }
  if(detectedHeaderInfo)applyHeaderDetection();
  renderResultsUI();
  toast('🔧 已套用新格線並重新讀取');
}

/* ===== SCAN & GRADE ===== */
function readAndGrade(){if(!corrGray){showMsg('請先完成步驟 2');return;}batchMode=false;batchResults=[];const thr=darkThr>0?darkThr:computedOtsu,fmin=fillMin/100;scanResults=[];for(let q=1;q<=currentTotalQ;q++){const ratios=[];for(let o=0;o<4;o++){const p=getBubblePos(q,o);ratios.push(getFillRatio(p.x,p.y,thr));}const filled=[];for(let o=0;o<4;o++)if(ratios[o]>=fmin)filled.push(o);let auto='';if(filled.length===1)auto='ABCD'[filled[0]];else if(filled.length>1)auto=null;scanResults.push({ratios,filled,auto,manual:undefined});}resetHeaderAutoOffsets();autoAlignHeader(corrGray,computedOtsu);detectedHeaderInfo=readHeaderBubblesFrom(corrGray,computedOtsu);if(detectedHeaderInfo)applyHeaderDetection();renderResultsUI();showScanStep(4);}
function getFinalAnswer(qi){const r=scanResults[qi];if(!r)return'';if(r.manual!==undefined)return r.manual;return r.auto||'';}
function onPreviewClick(e){if(!scanResults.length)return;const pc=document.getElementById('cPreview');if(!pc||!pc.width)return;const r=pc.getBoundingClientRect();const s=pc.width/CW;const cx=(e.clientX-r.left)*(pc.width/r.width)/s;const cy=(e.clientY-r.top)*(pc.height/r.height)/s;let minD=1e9,bestQ=-1,bestO=-1;for(let q=1;q<=currentTotalQ;q++){for(let o=0;o<4;o++){const p=getBubblePos(q,o);const d=Math.hypot(p.x-cx,p.y-cy);if(d<minD){minD=d;bestQ=q;bestO=o;}}}const thr=Math.max(G.os,G.rs)*1.0;if(bestQ>0&&minD<=thr){setManual(bestQ-1,'ABCD'[bestO]);}}
function scrollToPreview(){const d=document.getElementById('scanPreviewDetails');if(d){if(d.tagName==='DETAILS')d.open=true;setTimeout(()=>{try{d.scrollIntoView({behavior:'smooth',block:'start'});}catch(e){}},80);}}
/* 預覽：除掃描結果外，所有氣泡（含班號、選修科掃描班別欄）一律繪製清晰格線外框，
   方便老師直接檢視格線是否對齊。 */
function drawResultPreview(){const pc=document.getElementById('cPreview');if(!corrCanvas){pc.width=0;return;}const cap=window.innerWidth>=1200?1000:780;const maxW=Math.min(cap,window.innerWidth-40),s=Math.min(1,maxW/CW);pc.width=Math.round(CW*s);pc.height=Math.round(CH*s);const ctx=pc.getContext('2d');ctx.drawImage(corrCanvas,0,0,pc.width,pc.height);const ak=currentAnswerKey,hasKey=ak.some(a=>a!=='');if(detectedHeaderInfo&&HG.enabled){const hdrCols=[];const ratioArrays=[];if(electiveScanMode){hdrCols.push({key:'cls',count:9});ratioArrays.push(detectedHeaderInfo.clsRatios||[]);}hdrCols.push({key:'no1',count:10},{key:'no2',count:10});ratioArrays.push(detectedHeaderInfo.no1Ratios,detectedHeaderInfo.no2Ratios);const fmin=fillMin/100;hdrCols.forEach((col,ci)=>{const ratios=ratioArrays[ci]||[];for(let r=0;r<col.count;r++){const p=getHeaderBubblePos(col.key,r,true);const isFilled=ratios[r]>=fmin;drawRR(ctx,p.x*s,p.y*s,HG.hbw*s,HG.hbh*s);if(isFilled){ctx.fillStyle='rgba(34,211,238,.45)';ctx.fill();ctx.strokeStyle='rgb(34,211,238)';ctx.lineWidth=2.5;}else{ctx.strokeStyle='rgba(34,211,238,.45)';ctx.lineWidth=1;}ctx.stroke();}});}for(let q=1;q<=currentTotalQ;q++){const r=scanResults[q-1],final=getFinalAnswer(q-1),key=ak[q-1],isOK=hasKey&&key&&isAnswerCorrect(final,key),isNG=hasKey&&key&&final&&!isAnswerCorrect(final,key);for(let o=0;o<4;o++){const p=getBubblePos(q,o),px=p.x*s,py=p.y*s,opt='ABCD'[o],isFilled=r.filled.includes(o),isFinal=final===opt;drawRR(ctx,px,py,G.bw*s,G.bh*s);if(isFinal&&isOK){ctx.fillStyle='rgba(52,211,153,.55)';ctx.fill();ctx.strokeStyle='rgb(52,211,153)';ctx.lineWidth=2.5;}else if(isFinal&&isNG){ctx.fillStyle='rgba(244,63,94,.55)';ctx.fill();ctx.strokeStyle='rgb(244,63,94)';ctx.lineWidth=2.5;}else if(r.auto===null&&isFilled){ctx.fillStyle='rgba(251,191,36,.45)';ctx.fill();ctx.strokeStyle='rgb(251,191,36)';ctx.lineWidth=2;}else if(isFilled){ctx.fillStyle='rgba(96,165,250,.45)';ctx.fill();ctx.strokeStyle='rgb(96,165,250)';ctx.lineWidth=2;}else{ctx.strokeStyle='rgba(96,165,250,.5)';ctx.lineWidth=1;}ctx.stroke();}}pc.classList.add('preview-clickable');pc.onclick=onPreviewClick;}
function renderResultsUI(){const grid=document.getElementById('resGrid');grid.innerHTML='';const ak=currentAnswerKey,hasKey=ak.some(a=>a!=='');let correct=0,answered=0,multiCount=0,unresolvedMulti=0;for(let qi=0;qi<currentTotalQ;qi++){const r=scanResults[qi],final=getFinalAnswer(qi),key=ak[qi],isMulti=r.auto===null,hasManual=r.manual!==undefined;if(isMulti)multiCount++;if(isMulti&&!hasManual)unresolvedMulti++;if(final)answered++;const isOK=hasKey&&key&&isAnswerCorrect(final,key),isNG=hasKey&&key&&final&&!isAnswerCorrect(final,key);if(isOK)correct++;let cls='ritem ';if(isMulti&&!hasManual)cls+='multi';else if(isMulti&&hasManual)cls+='multi-ok';else if(isOK)cls+='ok';else if(isNG)cls+='ng';else cls+='blank';const div=document.createElement('div');div.className=cls;let h=isMulti&&!hasManual?`<span class="qn warn">⚠️${qi+1}</span>`:`<span class="qn">Q${qi+1}</span>`;for(let o=0;o<4;o++){const opt='ABCD'[o],isFilled=r.filled.includes(o),isFinal=final===opt;let c='ro';if(isFinal&&isOK)c+=' grn';else if(isFinal&&isNG)c+=' red';else if(isFinal&&!hasKey)c+=' blu';else if(isFilled&&!isFinal)c+=' det';if(hasManual&&r.manual===opt)c+=' mansel';h+=`<span class="${c}" title="${Math.round(r.ratios[o]*100)}%" onclick="setManual(${qi},'${opt}')">${opt}</span>`;}if(isMulti&&!hasManual)h+='<span class="rtag rev">需檢查</span>';else if(hasManual)h+=`<span class="rtag man">手動→${r.manual||'空'}</span>`;div.innerHTML=h;grid.appendChild(div);}const sd=document.getElementById('scoreDisp');if(hasKey){const kc=ak.slice(0,currentTotalQ).filter(a=>a!=='').length,pct=kc>0?Math.round(correct/kc*100):0;sd.innerHTML=`<div class="score-display"><div class="score-big">${correct} / ${kc}</div><div class="score-sub">${pct}% · 已作答 ${answered} 題</div></div>`;}else sd.innerHTML=`<div class="score-display"><div class="score-big" style="font-size:1.4em;-webkit-text-fill-color:var(--text2)">已讀取 ${answered} / ${currentTotalQ} 題</div></div>`;const mw=document.getElementById('multiWarn');if(multiCount>0){mw.classList.remove('hidden');mw.innerHTML=`⚠️ ${multiCount} 題多選`+(unresolvedMulti>0?`，${unresolvedMulti} 題待檢查（可點擊下方預覽圖的黃色氣泡來選擇）`:'，已處理');}else mw.classList.add('hidden');document.getElementById('batchNav').classList.toggle('hidden',!batchMode);document.getElementById('saveAllBtn').classList.toggle('hidden',!batchMode);if(batchMode){document.getElementById('step4Desc').textContent=`第 ${currentBatchIdx+1} / ${batchResults.length} 份`;updateBatchNav();}else document.getElementById('step4Desc').textContent='確認掃描結果並儲存';renderHeaderDetectUI();populateStudentDropdown();drawResultPreview();}
function setManual(qi,opt){if(!scanResults[qi])return;scanResults[qi].manual=scanResults[qi].manual===opt?undefined:opt;renderResultsUI();}
function updateBatchBtn(){const btn=document.getElementById('batchScanBtn');if(totalPdfPages>1&&corrCanvas){btn.classList.remove('hidden');btn.textContent=`📄 批量掃描 (${totalPdfPages}頁)`;}else btn.classList.add('hidden');}

/* ===== BATCH SCAN ===== */
async function batchScanAllPages(){
  if(!pdfDoc||!cornerRatios||!corrGray)return;
  batchMode=true;batchResults=[];
  const baseGO=groupOffsets.map(o=>({...o}));
  for(let p=1;p<=totalPdfPages;p++){
    batchResults.push({pageNum:p,corrCanvas:null,corrGray:null,computedOtsu:128,scanResults:[],headerInfo:null,headerAutoOffsets:{no1:{dx:0,dy:0},no2:{dx:0,dy:0},cls:{dx:0,dy:0}},pageGroupOffsets:null,studentName:'',saved:false,pending:true});
  }
  document.getElementById('modalBtns').innerHTML='';
  document.getElementById('modal').classList.add('show');
  const firstCount=Math.min(1,totalPdfPages);
  for(let i=0;i<firstCount;i++){
    document.getElementById('modalMsg').innerHTML=`<div style="display:inline-block;width:28px;height:28px;border:3px solid rgba(var(--p),.2);border-top-color:var(--p1);border-radius:50%;animation:spin .7s linear infinite"></div><br>自動對齊並掃描第 ${i+1}/${totalPdfPages} 頁`;
    await new Promise(r=>setTimeout(r,30));
    await processBatchPage(i,baseGO);
  }
  closeModal();
  currentBatchIdx=0;loadBatchPage(0);showScanStep(4);
  if(totalPdfPages>firstCount){
    toast(`✅ 已掃描前 ${firstCount} 頁，其餘 ${totalPdfPages-firstCount} 頁背景處理中…`);
    backgroundProcessRemaining(firstCount,baseGO);
  }else{
    toast(`✅ 已批量掃描 ${totalPdfPages} 頁`);
  }
}
async function processBatchPage(idx,baseGO){
  const p=idx+1;
  let pt;
  try{const img=await pdfPageToImage(p);pt=perspectiveTransformImg(img);}
  catch(e){batchResults[idx]={pageNum:p,corrCanvas:null,corrGray:null,computedOtsu:128,scanResults:[],headerInfo:null,headerAutoOffsets:{no1:{dx:0,dy:0},no2:{dx:0,dy:0},cls:{dx:0,dy:0}},pageGroupOffsets:null,studentName:'',saved:false,error:true,pending:false};return;}
  const sGO=groupOffsets.map(o=>({...o})),sGray=corrGray,sOtsu=computedOtsu,sHA=JSON.parse(JSON.stringify(headerAutoOffsets));
  try{
    groupOffsets=baseGO.map(o=>({...o}));
    corrGray=pt.gray;computedOtsu=pt.otsuVal;
    const thr=darkThr>0?darkThr:pt.otsuVal;
    const ng=Math.ceil(currentTotalQ/5);
    for(let gi=0;gi<ng;gi++)alignOneGroup(gi,thr);
    resetHeaderAutoOffsets();autoAlignHeader(pt.gray,pt.otsuVal);
    const results=readBubblesFrom(pt.gray,pt.otsuVal);
    const hdrInfo=readHeaderBubblesFrom(pt.gray,pt.otsuVal);
    const pageGO=groupOffsets.map(o=>({...o}));
    const pageHA=JSON.parse(JSON.stringify(headerAutoOffsets));
    let stuName='';
    if(hdrInfo){const stu=autoDetectStudentFromInfo(hdrInfo);if(stu)stuName=stu.name;hdrInfo.matchedStudent=stu;}
    batchResults[idx]={pageNum:p,corrCanvas:pt.canvas,corrGray:pt.gray,computedOtsu:pt.otsuVal,scanResults:results,headerInfo:hdrInfo,headerAutoOffsets:pageHA,pageGroupOffsets:pageGO,studentName:stuName,saved:false,pending:false};
  }finally{
    groupOffsets=sGO;corrGray=sGray;computedOtsu=sOtsu;headerAutoOffsets=sHA;
  }
}
async function backgroundProcessRemaining(startIdx,baseGO){
  for(let i=startIdx;i<batchResults.length;i++){
    if(!batchMode)return;
    await processBatchPage(i,baseGO);
    if(!batchMode)return;
    updateBatchNav();
    if(currentBatchIdx===i)loadBatchPage(i);
  }
  if(batchMode)toast('✅ 全部頁面已完成自動對齊及掃描');
}
function renderBatchPlaceholder(msg){
  document.getElementById('batchNav').classList.remove('hidden');
  document.getElementById('saveAllBtn').classList.remove('hidden');
  document.getElementById('resGrid').innerHTML=`<div class="empty-msg">${msg}</div>`;
  document.getElementById('scoreDisp').innerHTML='';
  document.getElementById('multiWarn').classList.add('hidden');
  document.getElementById('headerDetectBar').classList.add('hidden');
  document.getElementById('hdrOverrideNote').classList.add('hidden');
  const pc=document.getElementById('cPreview');if(pc)pc.width=0;
  document.getElementById('step4Desc').textContent=`第 ${currentBatchIdx+1} / ${batchResults.length} 份`;
  updateBatchNav();
}
function autoDetectStudentFromInfo(hdrInfo){if(!hdrInfo)return null;if(!selectedScanClass)return null;const year=getYearFromPaper();if(!year)return null;const students=(studentDB[year]||[]).filter(s=>s.class===selectedScanClass);if(electiveScanMode){if(!hdrInfo.classLetter||hdrInfo.number===null||hdrInfo.number===0)return null;const gradeNum=getGradeNumFromPaper();if(!gradeNum)return null;const fullClass=gradeNum+hdrInfo.classLetter;return students.find(s=>s.origClass===fullClass&&(s.origNumber||0)===hdrInfo.number)||null;}if(hdrInfo.number===null||hdrInfo.number===0)return null;return students.find(s=>s.number===hdrInfo.number)||null;}
function loadBatchPage(idx){
  if(idx<0||idx>=batchResults.length)return;
  currentBatchIdx=idx;
  const b=batchResults[idx];
  if(b.pending||b.error||!b.scanResults||!b.scanResults.length){
    scanResults=[];corrCanvas=null;corrGray=null;detectedHeaderInfo=null;
    document.getElementById('studentName').value=b.studentName||'';
    document.getElementById('studentSelect').value=b.studentName||'';
    renderBatchPlaceholder(b.error?'⚠️ 此頁處理失敗，請手動重新掃描。':'⏳ 此頁正在背景自動對齊及掃描中，請稍候…');
    return;
  }
  scanResults=b.scanResults;corrCanvas=b.corrCanvas;corrGray=b.corrGray;computedOtsu=b.computedOtsu;detectedHeaderInfo=b.headerInfo||null;headerAutoOffsets=b.headerAutoOffsets||{no1:{dx:0,dy:0},no2:{dx:0,dy:0},cls:{dx:0,dy:0}};if(b.pageGroupOffsets)groupOffsets=b.pageGroupOffsets.map(o=>({...o}));document.getElementById('studentName').value=b.studentName||'';document.getElementById('studentSelect').value=b.studentName||'';renderResultsUI();
}
function batchGo(idx){if(idx<0)idx=batchResults.length-1;if(idx>=batchResults.length)idx=0;loadBatchPage(idx);}
function updateBatchNav(){const total=batchResults.length,saved=batchResults.filter(b=>b.saved).length;document.getElementById('batchInfo').textContent=`${currentBatchIdx+1} / ${total}`;document.getElementById('batchSavedTag').textContent=`已儲存 ${saved}/${total}`;const strip=document.getElementById('batchThumbStrip');strip.innerHTML='';batchResults.forEach((b,i)=>{const d=document.createElement('div');d.className='bt2'+(i===currentBatchIdx?' act':'')+(b.saved?' saved':'');d.textContent=i+1;if(b.pending){d.style.opacity='.4';d.title='處理中…';}else if(b.error){d.style.opacity='.5';d.title='處理失敗';}else d.title=b.studentName||('第'+(i+1)+'頁');d.onclick=()=>loadBatchPage(i);strip.appendChild(d);});}
function getStudentDisplayName(){return document.getElementById('studentSelect').value||document.getElementById('studentName').value.trim()||'—';}
function buildFinalAnswerString(){const finalAns=[];for(let i=0;i<currentTotalQ;i++)finalAns.push(getFinalAnswer(i)||'-');return finalAns.join('');}
function saveRec(){
  if(!scanResults.length){showMsg('請先掃描答案');return;}
  if(batchMode){saveBatchCurrent();return;}
  const unresolved=scanResults.filter(r=>r.auto===null&&r.manual===undefined).length;
  if(unresolved>0){showMsg(`⚠️ 還有 ${unresolved} 題多選未處理。<br>可點擊預覽圖中的黃色氣泡選擇正確答案。`);return;}
  const student=getStudentDisplayName();
  if(!student||student==='—'){showMsg('⚠️ 請先選擇或輸入對應的學生，才能儲存記錄。');return;}
  let blanks=0;for(let i=0;i<currentTotalQ;i++)if(!getFinalAnswer(i))blanks++;
  if(blanks>0){showConfirm(`⚠️ 偵測到有 <strong>${blanks}</strong> 題未作答（留空）。<br>確定沒有問題並儲存此記錄嗎？`,()=>doSaveRec(student));return;}
  doSaveRec(student);
}
function doSaveRec(student){const ak=currentAnswerKey,hasKey=ak.some(a=>a!=='');const ansStr=buildFinalAnswerString();let c=0,kc=0;for(let i=0;i<currentTotalQ;i++){const f=ansStr[i]==='-'?'':ansStr[i];if(hasKey&&ak[i]){kc++;if(isAnswerCorrect(f,ak[i]))c++;}}const selP=papers.find(p=>p.id===selectedPaperId);const rec={id:Date.now(),student,class:selectedScanClass||'',ans:ansStr,totalQ:currentTotalQ,sc:hasKey?`${c}/${kc}`:'-',pct:hasKey&&kc?Math.round(c/kc*100)+'%':'-',paperId:selectedPaperId||'',paperLabel:selP?paperLabel(selP):'（未選擇試卷）',time:new Date().toLocaleString('zh-TW')};records.push(rec);renderRecs();saveSettings();if(fbConnected&&db)db.collection('records').add({...rec,createdAt:firebase.firestore.FieldValue.serverTimestamp()}).catch(()=>{});showSyncBadge('✅ 已成功儲存記錄','saved',2200);toast('✅ 記錄已儲存，準備掃描下一張');usedStudentsInBatch.add(student);setTimeout(()=>{srcImg=null;corrCanvas=null;corrGray=null;scanResults=[];detectedHeaderInfo=null;calibActive=false;calibStep=0;calibPts=[];mouseOnGrid={x:0,y:0};document.getElementById('calibBtn').textContent='📐 三點校準';document.getElementById('calibBtn').onclick=startCalib;document.getElementById('studentName').value='';document.getElementById('studentSelect').value='';maxReachedStep=0;showScanStep(1);},700);}
function saveBatchCurrent(){
  const b=batchResults[currentBatchIdx];if(!b||!b.scanResults.length||b.saved)return;
  const results=b.scanResults;
  const unresolved=results.filter(r=>r.auto===null&&r.manual===undefined).length;
  if(unresolved>0){showMsg(`⚠️ 第 ${currentBatchIdx+1} 頁還有 ${unresolved} 題多選未處理。<br>可點擊預覽圖中的黃色氣泡選擇正確答案。`);return;}
  const student=getStudentDisplayName();
  if(!student||student==='—'){showMsg(`⚠️ 第 ${currentBatchIdx+1} 頁尚未對應學生。<br>請先選擇或輸入對應的學生才能儲存。`);return;}
  let blanks=0;for(let i=0;i<currentTotalQ;i++)if(!getFinalAnswer(i))blanks++;
  if(blanks>0){showConfirm(`⚠️ 第 ${currentBatchIdx+1} 頁偵測到有 <strong>${blanks}</strong> 題未作答（留空）。<br>確定沒有問題並儲存此記錄嗎？`,()=>doSaveBatchCurrent(student));return;}
  doSaveBatchCurrent(student);
}
function doSaveBatchCurrent(student){const b=batchResults[currentBatchIdx];const ak=currentAnswerKey,hasKey=ak.some(a=>a!=='');const ansStr=buildFinalAnswerString();let c=0,kc=0;for(let i=0;i<currentTotalQ;i++){const f=ansStr[i]==='-'?'':ansStr[i];if(hasKey&&ak[i]){kc++;if(isAnswerCorrect(f,ak[i]))c++;}}const selP=papers.find(p=>p.id===selectedPaperId);const rec={id:Date.now()+currentBatchIdx,student,class:selectedScanClass||'',ans:ansStr,totalQ:currentTotalQ,sc:hasKey?`${c}/${kc}`:'-',pct:hasKey&&kc?Math.round(c/kc*100)+'%':'-',paperId:selectedPaperId||'',paperLabel:selP?paperLabel(selP):'（未選擇試卷）',time:new Date().toLocaleString('zh-TW'),batchPage:b.pageNum};records.push(rec);b.saved=true;b.studentName=student;renderRecs();saveSettings();if(fbConnected&&db)db.collection('records').add({...rec,createdAt:firebase.firestore.FieldValue.serverTimestamp()}).catch(()=>{});usedStudentsInBatch.add(student);updateBatchNav();showSyncBadge('✅ 已成功儲存記錄','saved',2200);toast(`✅ 第 ${currentBatchIdx+1} 頁已儲存`);const allSaved=batchResults.every(x=>x.saved||x.error);if(allSaved){setTimeout(()=>{toast('🎉 所有試卷已儲存完成！返回選擇試卷…');batchMode=false;batchResults=[];currentBatchIdx=0;usedStudentsInBatch=new Set();srcImg=null;corrCanvas=null;corrGray=null;scanResults=[];detectedHeaderInfo=null;maxReachedStep=0;showScanStep(0);},800);}else{const next=batchResults.findIndex((x,i)=>i>currentBatchIdx&&!x.saved&&!x.error&&!x.pending);const target=next>=0?next:batchResults.findIndex(x=>!x.saved&&!x.error&&!x.pending);if(target>=0)setTimeout(()=>{loadBatchPage(target);scrollToPreview();},400);}}
function saveAllBatch(){const missing=[];batchResults.forEach((b,i)=>{if(b.saved||b.error||!b.scanResults.length)return;const nm=(b.studentName||'').trim();if(!nm||nm==='—')missing.push(i+1);});if(missing.length){showMsg(`⚠️ 仍有試卷尚未對應學生，無法全部儲存：<br><strong>第 ${missing.join('、')} 頁</strong><br>請先為每張試卷選擇對應的學生後，再按「全部儲存」。`);return;}let saved=0,skipped=0;for(let i=0;i<batchResults.length;i++){const b=batchResults[i];if(b.saved||!b.scanResults.length)continue;if(b.scanResults.filter(r=>r.auto===null&&r.manual===undefined).length>0){skipped++;continue;}currentBatchIdx=i;scanResults=b.scanResults;corrCanvas=b.corrCanvas;corrGray=b.corrGray;detectedHeaderInfo=b.headerInfo||null;headerAutoOffsets=b.headerAutoOffsets||{no1:{dx:0,dy:0},no2:{dx:0,dy:0},cls:{dx:0,dy:0}};if(b.pageGroupOffsets)groupOffsets=b.pageGroupOffsets.map(o=>({...o}));drawResultPreview();const ak=currentAnswerKey,hasKey=ak.some(a=>a!=='');const ansStr=buildFinalAnswerString();let c=0,kc=0;for(let j=0;j<currentTotalQ;j++){const f=ansStr[j]==='-'?'':ansStr[j];if(hasKey&&ak[j]){kc++;if(isAnswerCorrect(f,ak[j]))c++;}}const student=b.studentName||'—',selP=papers.find(p=>p.id===selectedPaperId);const rec={id:Date.now()+i,student,class:selectedScanClass||'',ans:ansStr,totalQ:currentTotalQ,sc:hasKey?`${c}/${kc}`:'-',pct:hasKey&&kc?Math.round(c/kc*100)+'%':'-',paperId:selectedPaperId||'',paperLabel:selP?paperLabel(selP):'（未選擇試卷）',time:new Date().toLocaleString('zh-TW'),batchPage:b.pageNum};records.push(rec);b.saved=true;saved++;if(fbConnected&&db)db.collection('records').add({...rec,createdAt:firebase.firestore.FieldValue.serverTimestamp()}).catch(()=>{});}renderRecs();saveSettings();updateBatchNav();renderResultsUI();const allSaved=batchResults.every(x=>x.saved||x.error);if(allSaved&&saved>0){showSyncBadge('✅ 已全部成功儲存','saved',2500);toast(`🎉 已儲存全部 ${saved} 份！返回選擇試卷…`);setTimeout(()=>{batchMode=false;batchResults=[];currentBatchIdx=0;usedStudentsInBatch=new Set();srcImg=null;corrCanvas=null;corrGray=null;scanResults=[];detectedHeaderInfo=null;maxReachedStep=0;showScanStep(0);},1000);}else{toast(skipped>0?`✅ 已儲存 ${saved} 份，${skipped} 份有未處理多選`:`✅ 已儲存 ${saved} 份`);}}
function goBackFromStep4(){if(batchMode){batchMode=false;batchResults=[];}showScanStep(3);}
function resetScan(){srcImg=null;corrCanvas=null;corrGray=null;scanResults=[];detectedHeaderInfo=null;calibActive=false;calibStep=0;calibPts=[];hdrCalibActive=false;hdrCalibStep=0;hdrCalibPts=[];mouseOnGrid={x:0,y:0};batchMode=false;batchResults=[];currentBatchIdx=0;usedStudentsInBatch=new Set();resetHeaderAutoOffsets();document.getElementById('calibBtn').textContent='📐 三點校準';document.getElementById('calibBtn').onclick=startCalib;document.getElementById('studentName').value='';document.getElementById('studentSelect').value='';maxReachedStep=0;showScanStep(1);}