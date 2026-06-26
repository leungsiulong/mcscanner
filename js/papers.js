/* ===== papers.js — PAPER MANAGEMENT PAGE ===== */
function getPaperGrade(p){return p.grade||p.className||'';}
function renderPaperTabs(){
    const area=document.getElementById('paperTabsArea');
    const box=document.getElementById('paperListBox');
    if(!area||!box)return;
    if(!papers.length){area.innerHTML='';area.className='';box.className='';box.innerHTML='<div class="empty-msg">沒有試卷。點擊「＋ 新增」建立。</div>';return;}
    const years=[...new Set(papers.map(p=>p.year).filter(Boolean))].sort().reverse();
    let h='';
    h+=`<div class="sf-item"><label class="sf-label">學年</label><select onchange="onPaperFilterChange('year',this.value)"><option value="">請選擇學年</option>${years.map(y=>`<option value="${escAttr(y)}"${paperTabYear===y?' selected':''}>${y}</option>`).join('')}</select></div>`;
    let filtered=papers;
    if(paperTabYear){
      filtered=filtered.filter(p=>p.year===paperTabYear);
      const subjects=[...new Set(filtered.map(p=>p.subject).filter(Boolean))].sort();
      h+=`<div class="sf-item"><label class="sf-label">科目</label><select onchange="onPaperFilterChange('subject',this.value)"><option value="">全部科目</option>${subjects.map(s=>`<option value="${escAttr(s)}"${paperTabSubject===s?' selected':''}>${s}</option>`).join('')}</select></div>`;
      if(paperTabSubject)filtered=filtered.filter(p=>p.subject===paperTabSubject);
      const grades=[...new Set(filtered.map(p=>getPaperGrade(p)).filter(Boolean))].sort();
      h+=`<div class="sf-item"><label class="sf-label">級別</label><select onchange="onPaperFilterChange('grade',this.value)"><option value="">全部級別</option>${grades.map(g=>`<option value="${escAttr(g)}"${paperTabGrade===g?' selected':''}>${g}</option>`).join('')}</select></div>`;
      if(paperTabGrade)filtered=filtered.filter(p=>getPaperGrade(p)===paperTabGrade);
      const terms=[...new Set(filtered.map(p=>p.term).filter(Boolean))].sort();
      h+=`<div class="sf-item"><label class="sf-label">學期</label><select onchange="onPaperFilterChange('term',this.value)"><option value="">全部學期</option>${terms.map(t=>`<option value="${escAttr(t)}"${paperTabTerm===t?' selected':''}>${t}</option>`).join('')}</select></div>`;
      if(paperTabTerm)filtered=filtered.filter(p=>p.term===paperTabTerm);
      const sets=[...new Set(filtered.map(p=>p.set||'').filter(Boolean))].sort();
      if(sets.length){
        h+=`<div class="sf-item"><label class="sf-label">調適</label><select onchange="onPaperFilterChange('set',this.value)"><option value="">全部調適</option>${sets.map(s=>`<option value="${escAttr(s)}"${paperTabSet===s?' selected':''}>${s}</option>`).join('')}</select></div>`;
        if(paperTabSet)filtered=filtered.filter(p=>p.set===paperTabSet);
      }
    }
    area.className='scan-filter-bar';
    area.innerHTML=h;
    box.innerHTML='';
    if(!paperTabYear){box.className='';box.innerHTML='<div style="text-align:center;padding:20px;font-size:.82em;color:var(--text3)">👆 請選擇學年以查看試卷</div>';return;}
    if(!filtered.length){box.className='';box.innerHTML='<div class="empty-msg">沒有符合的試卷。</div>';return;}
    box.className='pm-card-grid';
    filtered.forEach(p=>box.appendChild(mkLeaf(p)));
  }
  function onPaperFilterChange(level,val){
    if(level==='year'){paperTabYear=val;paperTabSubject='';paperTabGrade='';paperTabTerm='';paperTabSet='';}
    else if(level==='subject'){paperTabSubject=val;paperTabGrade='';paperTabTerm='';paperTabSet='';}
    else if(level==='grade'){paperTabGrade=val;paperTabTerm='';paperTabSet='';}
    else if(level==='term'){paperTabTerm=val;paperTabSet='';}
    else if(level==='set'){paperTabSet=val;}
    renderPaperTabs();
  }
  function mkLeaf(p){
    const card=document.createElement('div');
    card.className='pm-card';
    const grade=getGradeDisplay(p);
    let tags=`<span class="pm-chip pm-chip-grade">${grade}</span>`;
    tags+=`<span class="pm-chip pm-chip-term">${p.term||''}</span>`;
    if(p.set)tags+=`<span class="pm-chip pm-chip-set">${p.set}</span>`;
    const date=p.createdAt?new Date(p.createdAt).toLocaleDateString('zh-TW'):'';
    const multiCnt=Array.isArray(p.multi)?p.multi.filter(Boolean).length:(p.answerKey||[]).filter(a=>a&&a.length>1).length;
    const multiTag=multiCnt>0?`<span class="pm-chip pm-chip-multi">多選 ${multiCnt}</span>`:'';
    card.innerHTML=`<div class="pm-card-top"><div class="pm-card-subject">${p.subject||'—'}</div><div class="pm-card-actions"><button class="btn-icon" onclick="event.stopPropagation();openPaperModal('${p.id}')" title="編輯">✏️</button><button class="btn-icon" onclick="event.stopPropagation();deletePaper('${p.id}')" title="刪除" style="color:rgb(var(--rose))">🗑️</button></div></div><div class="pm-card-tags">${tags}${multiTag}</div><div class="pm-card-footer"><span class="pm-card-q">📝 ${p.totalQ} 題</span><span class="pm-card-date">${date}</span></div>`;
    return card;
  }
  
  /* ===== PAPER MANAGEMENT (CREATE / EDIT) ===== */
  function openPaperModal(editId){editingPaperId=editId||null;paperFormAK=new Array(80).fill('');paperFormMulti=new Array(80).fill(false);if(editId){const p=papers.find(x=>x.id===editId);if(!p)return;ensureYearOption(p.year);ensureSubjectOption(p.subject);document.getElementById('pmTitle').innerHTML='<span class="card-icon ci-purple" style="width:28px;height:28px;font-size:.8em">✏️</span> 編輯試卷';document.getElementById('savePaperBtn').textContent='💾 更新試卷';document.getElementById('pYear').value=p.year;document.getElementById('pGrade').value=p.grade||p.className||GRADES[0];document.getElementById('pTerm').value=p.term;document.getElementById('pSet').value=p.set||'';document.getElementById('pSubject').value=p.subject||SUBJECTS[0];document.getElementById('pTotalQ').value=p.totalQ;if(p.answerKey)p.answerKey.forEach((a,i)=>paperFormAK[i]=a||'');if(p.multi)p.multi.forEach((m,i)=>paperFormMulti[i]=!!m);else paperFormAK.forEach((a,i)=>{if(a&&a.length>1)paperFormMulti[i]=true;});document.getElementById('pQuickInput').value=paperFormAK.slice(0,p.totalQ).map(a=>(a||'').length>1?a.charAt(0):(a||'')).join('');}else{document.getElementById('pmTitle').innerHTML='<span class="card-icon ci-purple" style="width:28px;height:28px;font-size:.8em">📝</span> 新增試卷';document.getElementById('savePaperBtn').textContent='💾 儲存試卷';document.getElementById('pSet').value='';document.getElementById('pQuickInput').value='';}document.getElementById('pYear').dataset.prev=document.getElementById('pYear').value;document.getElementById('pSubject').dataset.prev=document.getElementById('pSubject').value;buildPaperAKGrid();document.getElementById('soOverlay').classList.add('show');document.getElementById('soPanel').classList.add('show');}
  function closePaperModal(){document.getElementById('soOverlay').classList.remove('show');document.getElementById('soPanel').classList.remove('show');editingPaperId=null;}
  function openDuplicateModal(id){const p=papers.find(x=>x.id===id);if(!p)return;editingPaperId=null;paperFormAK=new Array(80).fill('');paperFormMulti=new Array(80).fill(false);ensureYearOption(p.year);ensureSubjectOption(p.subject);if(p.answerKey)p.answerKey.forEach((a,i)=>paperFormAK[i]=a||'');if(p.multi)p.multi.forEach((m,i)=>paperFormMulti[i]=!!m);else paperFormAK.forEach((a,i)=>{if(a&&a.length>1)paperFormMulti[i]=true;});document.getElementById('pmTitle').innerHTML='<span class="card-icon ci-purple" style="width:28px;height:28px;font-size:.8em">📋</span> 複製試卷';document.getElementById('savePaperBtn').textContent='💾 儲存試卷';document.getElementById('pYear').value=p.year;document.getElementById('pGrade').value=p.grade||p.className||GRADES[0];document.getElementById('pTerm').value=p.term;document.getElementById('pSet').value=p.set||'';document.getElementById('pSubject').value=p.subject||SUBJECTS[0];document.getElementById('pTotalQ').value=p.totalQ;document.getElementById('pQuickInput').value=paperFormAK.slice(0,p.totalQ).map(a=>(a||'').length>1?a.charAt(0):(a||'')).join('');document.getElementById('pYear').dataset.prev=document.getElementById('pYear').value;document.getElementById('pSubject').dataset.prev=document.getElementById('pSubject').value;buildPaperAKGrid();document.getElementById('soOverlay').classList.add('show');document.getElementById('soPanel').classList.add('show');}
  function getPaperTotalQ(){let v=parseInt(document.getElementById('pTotalQ').value);if(isNaN(v)||v<1)v=1;if(v>80)v=80;return v;}
  function onTotalQChange(){buildPaperAKGrid();}
  function buildPaperAKGrid(){const tq=getPaperTotalQ(),g=document.getElementById('paperAKGrid');g.innerHTML='';for(let q=1;q<=tq;q++){const d=document.createElement('div');d.className='aitem';const cur=paperFormAK[q-1]||'';const isMulti=!!paperFormMulti[q-1];let h=`<span class="qn">Q${q}</span>`;['A','B','C','D'].forEach(o=>{h+=`<span class="o ${cur.indexOf(o)>=0?'sel':''}" onclick="setPaperAK(${q},'${o}')">${o}</span>`;});h+=`<label class="ak-multi-toggle${isMulti?' on':''}" title="多選答案：可選多個正確答案，學生答中任一即得分"><input type="checkbox" ${isMulti?'checked':''} onchange="togglePaperMulti(${q})">多選</label>`;d.innerHTML=h;g.appendChild(d);}}
  function setPaperAK(q,o){const i=q-1;const cur=paperFormAK[i]||'';if(paperFormMulti[i]){if(cur.indexOf(o)>=0)paperFormAK[i]=cur.split('').filter(c=>c!==o).join('');else paperFormAK[i]=(cur+o).split('').filter(c=>'ABCD'.indexOf(c)>=0).sort().join('');}else{paperFormAK[i]=cur===o?'':o;}buildPaperAKGrid();}
  function togglePaperMulti(q){const i=q-1;paperFormMulti[i]=!paperFormMulti[i];if(!paperFormMulti[i]){const cur=paperFormAK[i]||'';if(cur.length>1)paperFormAK[i]=cur.charAt(0);}buildPaperAKGrid();}
  function applyPaperQK(){const v=document.getElementById('pQuickInput').value.toUpperCase().replace(/[^ABCD]/g,'');for(let i=0;i<80;i++){paperFormAK[i]=i<v.length?v[i]:'';paperFormMulti[i]=false;}buildPaperAKGrid();}
  function clearPaperAK(){paperFormAK=new Array(80).fill('');paperFormMulti=new Array(80).fill(false);document.getElementById('pQuickInput').value='';buildPaperAKGrid();}
  function savePaper(){const year=document.getElementById('pYear').value,grade=document.getElementById('pGrade').value,term=document.getElementById('pTerm').value,paperSet=document.getElementById('pSet').value,subject=document.getElementById('pSubject').value,tq=getPaperTotalQ();if(year==='__add__'||subject==='__add__'){showMsg('⚠️ 請選擇有效的學年及科目');return;}const ak=paperFormAK.slice(0,tq);if(!ak.some(a=>a!=='')){showMsg('⚠️ 請先輸入正確答案');return;}const multi=paperFormMulti.slice(0,tq);const paper={year,grade,term,set:paperSet,subject,totalQ:tq,answerKey:ak,multi,createdAt:new Date().toISOString()};let recalcCount=0;if(editingPaperId){paper.id=editingPaperId;const idx=papers.findIndex(p=>p.id===editingPaperId);if(idx>=0)papers[idx]={...papers[idx],...paper};recalcCount=recalcRecordsForPaper(paper);if(editingPaperId===selectedPaperId){currentTotalQ=tq;currentAnswerKey=new Array(80).fill('');ak.forEach((a,i)=>currentAnswerKey[i]=a||'');}}else{paper.id='local_'+Date.now();papers.push(paper);}savePaperToFB(paper,()=>{renderPaperTabs();renderPaperSelectList();populateSubjectFilter();if(recalcCount>0){renderRecs();saveSettings();}saveToLS();toast(recalcCount>0?`✅ 試卷已儲存，已更新 ${recalcCount} 筆掃描記錄分數`:'✅ 試卷已儲存');closePaperModal();});}
  function recalcRecordsForPaper(paper){if(!paper||!paper.id)return 0;const ak=paper.answerKey||[];const lbl=paperLabel(paper);let updated=0;records.forEach(r=>{if(r.paperId!==paper.id)return;const ans=r.ans||'';const totalQ=r.totalQ||ans.length;let c=0,kc=0;for(let i=0;i<totalQ;i++){const key=ak[i]||'';if(!key)continue;kc++;const f=(i<ans.length&&ans[i]!=='-')?ans[i]:'';if(isAnswerCorrect(f,key))c++;}r.sc=kc?`${c}/${kc}`:'-';r.pct=kc?Math.round(c/kc*100)+'%':'-';r.paperLabel=lbl;updated++;});return updated;}
  function deletePaper(id){showConfirm('⚠️ 確定要刪除此試卷嗎？',()=>{papers=papers.filter(p=>p.id!==id);deletePaperFromFB(id,()=>{if(selectedPaperId===id)clearPaperSelection();renderPaperTabs();renderPaperSelectList();populateSubjectFilter();saveToLS();toast('🗑️ 已刪除');});});}
  function filterPaperList(){renderPaperSelectList();}
  
  /* ===== SCAN PAGE: DROPDOWN-BASED PAPER SELECTION ===== */
  function renderScanPaperFilters(){
    const area=document.getElementById('scanPaperFilters');
    if(!area)return null;
    if(!papers.length){area.innerHTML='<div class="empty-msg">沒有試卷，請先到「試卷管理」新增試卷。</div>';return null;}
    const years=[...new Set(papers.map(p=>p.year).filter(Boolean))].sort().reverse();
    let h='';
    h+=`<div class="sf-item"><label class="sf-label">學年</label><select onchange="onScanFilterChange('year',this.value)"><option value="">請選擇學年</option>${years.map(y=>`<option value="${escAttr(y)}"${scanTabYear===y?' selected':''}>${y}</option>`).join('')}</select></div>`;
    let filtered=papers;
    if(scanTabYear){
      filtered=filtered.filter(p=>p.year===scanTabYear);
      const subjects=[...new Set(filtered.map(p=>p.subject).filter(Boolean))].sort();
      h+=`<div class="sf-item"><label class="sf-label">科目</label><select onchange="onScanFilterChange('subject',this.value)"><option value="">全部科目</option>${subjects.map(s=>`<option value="${escAttr(s)}"${scanTabSubject===s?' selected':''}>${s}</option>`).join('')}</select></div>`;
      if(scanTabSubject)filtered=filtered.filter(p=>p.subject===scanTabSubject);
      const grades=[...new Set(filtered.map(p=>getPaperGrade(p)).filter(Boolean))].sort();
      h+=`<div class="sf-item"><label class="sf-label">級別</label><select onchange="onScanFilterChange('grade',this.value)"><option value="">全部級別</option>${grades.map(g=>`<option value="${escAttr(g)}"${scanTabGrade===g?' selected':''}>${g}</option>`).join('')}</select></div>`;
      if(scanTabGrade)filtered=filtered.filter(p=>getPaperGrade(p)===scanTabGrade);
      const terms=[...new Set(filtered.map(p=>p.term).filter(Boolean))].sort();
      h+=`<div class="sf-item"><label class="sf-label">學期</label><select onchange="onScanFilterChange('term',this.value)"><option value="">全部學期</option>${terms.map(t=>`<option value="${escAttr(t)}"${scanTabTerm===t?' selected':''}>${t}</option>`).join('')}</select></div>`;
      if(scanTabTerm)filtered=filtered.filter(p=>p.term===scanTabTerm);
      const sets=[...new Set(filtered.map(p=>p.set||'').filter(Boolean))].sort();
      if(sets.length){
        h+=`<div class="sf-item"><label class="sf-label">調適</label><select onchange="onScanFilterChange('set',this.value)"><option value="">全部調適</option>${sets.map(s=>`<option value="${escAttr(s)}"${scanTabSet===s?' selected':''}>${s}</option>`).join('')}</select></div>`;
        if(scanTabSet)filtered=filtered.filter(p=>p.set===scanTabSet);
      }
    }
    area.innerHTML=h;
    return filtered;
  }
  function onScanFilterChange(level,val){
    if(level==='year'){scanTabYear=val;scanTabSubject='';scanTabGrade='';scanTabTerm='';scanTabSet='';}
    else if(level==='subject'){scanTabSubject=val;scanTabGrade='';scanTabTerm='';scanTabSet='';}
    else if(level==='grade'){scanTabGrade=val;scanTabTerm='';scanTabSet='';}
    else if(level==='term'){scanTabTerm=val;scanTabSet='';}
    else if(level==='set'){scanTabSet=val;}
    renderPaperSelectList();
  }
  function renderPaperSelectList(){
    const box=document.getElementById('paperSelectList');if(!box)return;
    const filtered=renderScanPaperFilters();
    box.className='';
    box.innerHTML='';
    if(filtered===null)return;
    if(!scanTabYear){box.innerHTML='<div style="text-align:center;padding:20px;font-size:.82em;color:var(--text3)">👆 請先選擇學年以查看試卷</div>';return;}
    if(!filtered.length){box.innerHTML='<div class="empty-msg">沒有符合的試卷。</div>';return;}
    box.className='paper-select-grid';
    filtered.forEach(p=>{
      const d=document.createElement('div');
      d.className='paper-item'+(selectedPaperId===p.id?' selected':'');
      d.innerHTML=`<div class="pi-check">✓</div><div class="pi-head"><span class="pi-subject">${p.subject||'—'}</span><span class="pi-grade">${getGradeDisplay(p)}</span></div><div class="pi-tags"><span class="pi-chip pi-chip-term">${p.term||''}</span>${p.set?`<span class="pi-chip pi-chip-set">${p.set}</span>`:''}<span class="pi-chip pi-chip-q">${p.totalQ} 題</span></div>`;
      d.onclick=()=>selectPaper(p.id);
      box.appendChild(d);
    });
  }
  function selectPaper(id){const p=papers.find(x=>x.id===id);if(!p)return;selectedPaperId=id;currentTotalQ=p.totalQ;currentAnswerKey=new Array(80).fill('');if(p.answerKey)p.answerKey.forEach((a,i)=>currentAnswerKey[i]=a||'');buildGrpSel();document.getElementById('selectedPaperInfo').classList.remove('hidden');document.getElementById('selectedPaperInfo').className='selected-bar';document.getElementById('selectedPaperInfo').innerHTML=`✅ 已選擇：<strong>${paperLabel(p)}</strong>`;renderPaperSelectList();updatePaperBar();populateScanClassDropdown(p.year);toast('📋 已選擇試卷');}
  function clearPaperSelection(){selectedPaperId=null;selectedScanClass='';electiveScanMode=false;currentAnswerKey=new Array(80).fill('');currentTotalQ=80;document.getElementById('selectedPaperInfo').classList.add('hidden');document.getElementById('classSelectArea').classList.add('hidden');document.getElementById('classSelectInfo').classList.add('hidden');renderPaperSelectList();updatePaperBar();}