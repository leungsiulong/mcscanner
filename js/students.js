/* ===== students.js — STUDENT TABS / LIST ===== */
function renderStudentList(){
    const box=document.getElementById('studentListBox');if(!box)return;
    const years=Object.keys(studentDB).sort();
    if(!years.length){box.innerHTML='<div class="empty-msg">尚未匯入學生資料。</div>';return;}
    let h='<div class="tab-section"><div class="tab-label">學年</div><div class="tab-row wrap">';
    years.forEach(y=>{const cnt=(studentDB[y]||[]).length;h+=`<div class="tab-pill${stuTabYear===y?' active':''}" onclick="setStuTab('year','${escQ(y)}')">${y}<span class="tc">(${cnt})</span></div>`;});
    h+='</div></div>';
    if(stuTabYear&&studentDB[stuTabYear]){
      const classes=[...new Set(studentDB[stuTabYear].map(s=>s.class))].sort();
      if(classes.length){h+='<div class="tab-section"><div class="tab-label">班別（請選擇班別以顯示名單）</div><div class="tab-row wrap">';classes.forEach(c=>{const cnt=studentDB[stuTabYear].filter(s=>s.class===c).length;h+=`<div class="tab-pill${stuTabClass===c?' active':''}" onclick="setStuTab('class','${escQ(c)}')">${c}<span class="tc">(${cnt})</span></div>`;});h+='</div></div>';}
      /* 學生名單：必須同時選擇「學年」及「班別」後，下方才會顯示名單。
         若該班別為選修科班別，名單會顯示每位學生「原本的班別」及「原本的學號」
         （origClass / origNumber），並先按原班別、再按原學號排序。
         一律顯示「班別、學號、姓名」三欄。 */
      if(stuTabClass){
        let students=studentDB[stuTabYear].filter(s=>s.class===stuTabClass);
        students.sort((a,b)=>{
          const ca=(a.origClass!=null?a.origClass:(a.class||'')),cb=(b.origClass!=null?b.origClass:(b.class||''));
          if(ca!==cb)return ca.localeCompare(cb,'zh-TW');
          const na=(a.origNumber!=null?a.origNumber:(a.number||0)),nb=(b.origNumber!=null?b.origNumber:(b.number||0));
          return na-nb;
        });
        if(students.length){
          h+='<div style="margin-top:8px;border:1px solid var(--border);border-radius:var(--radius-sm);overflow:auto;max-height:600px"><table class="stu-table"><thead><tr><th style="width:96px">班別</th><th style="width:54px">學號</th><th>姓名</th><th style="width:40px"></th></tr></thead><tbody>';
          students.forEach(s=>{const dispCls=(s.origClass!=null?s.origClass:(s.class||'')),dispNum=(s.origNumber!=null?s.origNumber:s.number);h+=`<tr><td>${dispCls}</td><td>${dispNum}</td><td>${s.name}</td><td><span class="del-btn" onclick="event.stopPropagation();deleteStudent('${escQ(stuTabYear)}','${escQ(s.name)}','${escQ(s.class)}')">🗑️</span></td></tr>`;});
          h+='</tbody></table></div>';
        }else{h+='<div class="empty-msg">無學生資料。</div>';}
      }else{
        h+='<div style="text-align:center;padding:20px;font-size:.82em;color:var(--text3)">👆 請選擇班別以顯示學生名單</div>';
      }
    }else{h+='<div style="text-align:center;padding:20px;font-size:.82em;color:var(--text3)">👆 請選擇學年</div>';}
    box.innerHTML=h;
  }
  function setStuTab(level,val){if(level==='year'){stuTabYear=stuTabYear===val?'':val;stuTabClass='';}else if(level==='class'){stuTabClass=stuTabClass===val?'':val;}renderStudentList();}
  
  /* ===== STUDENT IMPORT / MANAGEMENT ===== */
  function onStudentFile(e){const f=e.target.files[0];if(f)processStudentFile(f);e.target.value='';}
  function processStudentFile(file){if(typeof XLSX==='undefined'){showMsg('⚠️ XLSX 函式庫載入失敗');return;}const reader=new FileReader();reader.onload=function(e){try{const data=new Uint8Array(e.target.result);const wb=XLSX.read(data,{type:'array'});const result={};wb.SheetNames.forEach(sn=>{const sheet=wb.Sheets[sn];const rows=XLSX.utils.sheet_to_json(sheet,{header:1});let currentYear=yearCodeToFull(sn.trim());let foundHeader=false;const students=[];for(const row of rows){if(!row||row.length<1)continue;const c0=String(row[0]||'').trim();if(!c0)continue;if(/^\d{4}$/.test(c0)&&(!row[1]||String(row[1]).trim()==='')){currentYear=yearCodeToFull(c0);foundHeader=false;continue;}if(c0==='姓名'){foundHeader=true;continue;}if(foundHeader&&c0&&row.length>=3){students.push({name:c0,class:String(row[1]||'').trim(),number:Math.round(parseFloat(row[2]))||0});}}if(students.length>0){if(!result[currentYear])result[currentYear]=[];result[currentYear].push(...students);}});if(!Object.keys(result).length){showMsg('⚠️ 未能讀取到學生資料');return;}stuPreviewData=result;showStudentPreview(result);}catch(err){showMsg('⚠️ 讀取失敗：'+err.message);}};reader.readAsArrayBuffer(file);}
  function showStudentPreview(data){document.getElementById('stuPreviewArea').classList.remove('hidden');const summary=document.getElementById('stuPreviewSummary');summary.innerHTML='';Object.keys(data).sort().forEach(year=>{const cnt=data[year].length;const classes=[...new Set(data[year].map(s=>s.class))].sort();const chip=document.createElement('span');chip.className='stu-preview-chip';chip.textContent=`${year}: ${cnt}人 (${classes.join(', ')})`;summary.appendChild(chip);});const wrap=document.getElementById('stuPreviewContent');wrap.innerHTML='';Object.keys(data).sort().forEach(year=>{const yh=document.createElement('div');yh.style.cssText='padding:10px 14px;font-size:.82em;font-weight:700;color:var(--p2);background:rgba(var(--p),.06);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:2';yh.textContent=`📅 ${year} — ${data[year].length} 位學生`;wrap.appendChild(yh);const tbl=document.createElement('table');tbl.className='stu-table';tbl.innerHTML='<thead><tr><th>學號</th><th>姓名</th><th>班別</th></tr></thead>';const tbody=document.createElement('tbody');data[year].sort((a,b)=>a.class===b.class?(a.number||0)-(b.number||0):a.class.localeCompare(b.class)).forEach(s=>{const tr=document.createElement('tr');tr.innerHTML=`<td>${s.number}</td><td>${s.name}</td><td>${s.class}</td>`;tbody.appendChild(tr);});tbl.appendChild(tbody);wrap.appendChild(tbl);});}
  function confirmStudentImport(){if(!stuPreviewData)return;let added=0;Object.keys(stuPreviewData).forEach(year=>{if(!studentDB[year])studentDB[year]=[];stuPreviewData[year].forEach(s=>{if(!studentDB[year].some(e=>e.name===s.name&&e.class===s.class&&e.number===s.number)){studentDB[year].push(s);added++;}});});stuPreviewData=null;document.getElementById('stuPreviewArea').classList.add('hidden');renderStudentList();saveStudentsToDB();toast(`✅ 已匯入 ${added} 位學生`);}
  function cancelStudentPreview(){stuPreviewData=null;document.getElementById('stuPreviewArea').classList.add('hidden');}
  function addStudentManual(){const year=document.getElementById('stuManYear').value,name=document.getElementById('stuManName').value.trim(),cls=document.getElementById('stuManClass').value.trim(),num=parseInt(document.getElementById('stuManNumber').value)||0;if(!name||!cls||!year){showMsg('⚠️ 請填寫所有欄位');return;}if(!studentDB[year])studentDB[year]=[];if(studentDB[year].some(s=>s.name===name&&s.class===cls)){showMsg('⚠️ 該學生已存在');return;}studentDB[year].push({name,class:cls,number:num||studentDB[year].length+1});renderStudentList();saveStudentsToDB();document.getElementById('stuManName').value='';document.getElementById('stuManNumber').value='';toast(`✅ 已新增 ${name}`);}
  function deleteStudent(year,name,cls){if(!studentDB[year])return;studentDB[year]=studentDB[year].filter(s=>!(s.name===name&&s.class===cls));if(!studentDB[year].length)delete studentDB[year];renderStudentList();saveStudentsToDB();}
  function clearAllStudents(){showConfirm('⚠️ 確定要清除所有學生資料嗎？',()=>{studentDB={};stuTabYear='';stuTabClass='';renderStudentList();saveStudentsToDB();toast('🗑️ 已清除');});}

  /* ===== ELECTIVE SUBJECT CLASS (選修科班別) =====
     選修科學生來自同級不同班別。此功能可建立新的選修科班別，
     並從現有學生名單「直接點選」加入（無需勾選方格）。
     系統會自動按「原班別 → 原班號」排序並依序編配班號。
     同一學生可同時屬於原班別與選修科班別。
     注意：加入選修科班別的學生會額外記錄「原班別 origClass」及
     「原學號 origNumber」，於學生名單中顯示其原本的班別及學號。 */
  let electiveSelections=[];
  function elecKey(s){return (s.class||'')+'||'+(s.name||'')+'||'+(s.number||0);}
  function findElecSel(key){return electiveSelections.findIndex(e=>e.key===key);}
  function openElectiveModal(){
    const years=Object.keys(studentDB).sort();
    if(!years.length){showMsg('⚠️ 請先匯入或新增學生資料，才能建立選修科班別。');return;}
    const sel=document.getElementById('elecYear');sel.innerHTML='';
    years.forEach(y=>{const o=document.createElement('option');o.value=y;o.textContent=y;sel.appendChild(o);});
    if(stuTabYear&&years.includes(stuTabYear))sel.value=stuTabYear;
    document.getElementById('elecClassName').value='';
    document.getElementById('elecSearch').value='';
    electiveSelections=[];
    renderElecSourceList();
    document.getElementById('elecOverlay').classList.add('show');
    document.getElementById('elecPanel').classList.add('show');
  }
  function closeElectiveModal(){document.getElementById('elecOverlay').classList.remove('show');document.getElementById('elecPanel').classList.remove('show');electiveSelections=[];}
  function onElecYearChange(){electiveSelections=[];renderElecSourceList();}
  function renderElecSourceList(){
    const box=document.getElementById('elecSourceList');if(!box)return;
    const year=document.getElementById('elecYear').value;
    const search=(document.getElementById('elecSearch').value||'').trim().toLowerCase();
    const students=(studentDB[year]||[]).slice().sort((a,b)=>a.class===b.class?(a.number||0)-(b.number||0):(a.class||'').localeCompare(b.class||''));
    const filtered=students.filter(s=>!search||(s.name||'').toLowerCase().includes(search)||(s.class||'').toLowerCase().includes(search));
    if(!filtered.length){box.innerHTML='<div class="empty-msg">沒有符合的學生。</div>';updateElecCount();return;}
    const groups={};filtered.forEach(s=>{(groups[s.class]=groups[s.class]||[]).push(s);});
    let h='';
    Object.keys(groups).sort().forEach(cls=>{
      h+=`<div class="elec-cls-hd">${cls}（${groups[cls].length}）</div>`;
      groups[cls].forEach(s=>{
        const key=elecKey(s);const idx=findElecSel(key);const checked=idx>=0;
        h+=`<div class="elec-stu-row${checked?' sel':''}" onclick="toggleElecStu('${escQ(key)}','${escQ(s.name)}','${escQ(s.class)}',${s.number||0})"><span class="esr-check">${checked?'✓':''}</span><span class="esr-name">${s.name}</span><span class="esr-orig">原：${s.class} #${s.number||'-'}</span></div>`;
      });
    });
    box.innerHTML=h;updateElecCount();
  }
  function toggleElecStu(key,name,srcClass,origNumber){const idx=findElecSel(key);if(idx>=0)electiveSelections.splice(idx,1);else electiveSelections.push({key,name,srcClass,origNumber:origNumber||0});renderElecSourceList();}
  function elecSelectAllVisible(){const year=document.getElementById('elecYear').value;const search=(document.getElementById('elecSearch').value||'').trim().toLowerCase();const students=(studentDB[year]||[]).filter(s=>!search||(s.name||'').toLowerCase().includes(search)||(s.class||'').toLowerCase().includes(search));students.forEach(s=>{const key=elecKey(s);if(findElecSel(key)<0)electiveSelections.push({key,name:s.name,srcClass:s.class,origNumber:s.number||0});});renderElecSourceList();}
  function elecClearSelection(){electiveSelections=[];renderElecSourceList();}
  function updateElecCount(){const el=document.getElementById('elecCount');if(el)el.textContent=`已選 ${electiveSelections.length} 位`;}
  function saveElectiveClass(){
    const year=document.getElementById('elecYear').value;
    const className=document.getElementById('elecClassName').value.trim();
    if(!className){showMsg('⚠️ 請輸入選修科班別名稱（例如：中四經濟）。');return;}
    if(!electiveSelections.length){showMsg('⚠️ 請至少選擇一位學生加入此選修科班別。');return;}
    // 按「原班別 → 原班號」排序，再依序自動編配班號；
    // 同時保留每位學生的「原班別 origClass」及「原學號 origNumber」，
    // 以便在學生名單中顯示其原本的班別及學號。
    const ordered=electiveSelections.slice().sort((a,b)=>a.srcClass===b.srcClass?(a.origNumber||0)-(b.origNumber||0):(a.srcClass||'').localeCompare(b.srcClass||''));
    if(!studentDB[year])studentDB[year]=[];
    let added=0,skipped=0,n=0;
    ordered.forEach(e=>{if(studentDB[year].some(s=>s.name===e.name&&s.class===className)){skipped++;return;}n++;studentDB[year].push({name:e.name,class:className,number:n,origClass:e.srcClass,origNumber:e.origNumber||0});added++;});
    closeElectiveModal();stuTabYear=year;stuTabClass=className;renderStudentList();saveStudentsToDB();
    toast(`✅ 已建立選修科班別「${className}」，新增 ${added} 位`+(skipped?`，略過 ${skipped} 位重複`:''));
  }
  
  /* ===== SCAN CLASS / STUDENT DROPDOWN ===== */
  function getYearFromPaper(){if(!selectedPaperId)return null;const p=papers.find(x=>x.id===selectedPaperId);return p?p.year:null;}
  function populateScanClassDropdown(year){const area=document.getElementById('classSelectArea'),sel=document.getElementById('scanClassSelect'),info=document.getElementById('classSelectInfo');sel.innerHTML='<option value="">請選擇班別</option>';selectedScanClass='';if(!year){area.classList.add('hidden');return;}const students=studentDB[year]||[];if(!students.length){area.classList.remove('hidden');info.classList.remove('hidden');info.innerHTML=`⚠️ 學年 <strong>${year}</strong> 尚未匯入學生資料。`;return;}[...new Set(students.map(s=>s.class))].sort().forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=`${c} (${students.filter(s=>s.class===c).length}人)`;sel.appendChild(o);});area.classList.remove('hidden');info.classList.add('hidden');}
  function onScanClassChange(){selectedScanClass=document.getElementById('scanClassSelect').value;const info=document.getElementById('classSelectInfo'),year=getYearFromPaper();if(selectedScanClass&&year){const cnt=(studentDB[year]||[]).filter(s=>s.class===selectedScanClass).length;info.classList.remove('hidden');info.innerHTML=`✅ 已選擇 <strong>${selectedScanClass}</strong> 班，共 <strong>${cnt}</strong> 位學生`;}else info.classList.add('hidden');updatePaperBar();}
  function populateStudentDropdown(){const sel=document.getElementById('studentSelect');sel.innerHTML='';const year=getYearFromPaper();if(!year||!selectedScanClass){sel.innerHTML='<option value="">請先選擇試卷及班別</option>';return;}const students=(studentDB[year]||[]).filter(s=>s.class===selectedScanClass).sort((a,b)=>(a.number||0)-(b.number||0));if(!students.length){sel.innerHTML='<option value="">該班別無學生資料</option>';return;}sel.innerHTML='<option value="">— 選擇學生 —</option>';students.forEach(s=>{const o=document.createElement('option');o.value=s.name;const used=usedStudentsInBatch.has(s.name);o.textContent=`${s.number}. ${s.name}${used?' ✓':''}`;if(used)o.style.color='rgb(var(--teal))';sel.appendChild(o);});if(batchMode&&batchResults[currentBatchIdx]){const bn=batchResults[currentBatchIdx].studentName;if(bn){sel.value=bn;document.getElementById('studentName').value=bn;}}}
  function onStudentSelect(){const v=document.getElementById('studentSelect').value;document.getElementById('studentName').value=v;if(batchMode&&batchResults[currentBatchIdx])batchResults[currentBatchIdx].studentName=v;}