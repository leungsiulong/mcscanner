/* ===== INIT & GLOBAL EVENT LISTENERS ===== */
document.addEventListener('DOMContentLoaded',()=>{
  initTheme();
  loadFromLS();populateDropdowns();loadRecordImages();buildGrpSel();updGrpDisp();syncDetSliders();buildPaperAKGrid();renderPaperTabs();renderPaperSelectList();renderStudentList();buildStepProgress();updateStepProgress();syncHeaderSliders();updHdrColDisp();
  const dz=document.getElementById('dropZone');
  dz.addEventListener('dragover',e=>{e.preventDefault();dz.style.borderColor='rgba(var(--p),.6)';dz.style.background='rgba(var(--p),.06)';});
  dz.addEventListener('dragleave',()=>{dz.style.borderColor='';dz.style.background='';});
  dz.addEventListener('drop',e=>{e.preventDefault();dz.style.borderColor='';dz.style.background='';if(e.dataTransfer.files.length)loadFile(e.dataTransfer.files[0]);});
  const sdz=document.getElementById('studentDropZone');
  sdz.addEventListener('dragover',e=>{e.preventDefault();sdz.style.borderColor='rgba(var(--amber),.6)';sdz.style.background='rgba(var(--amber),.06)';});
  sdz.addEventListener('dragleave',()=>{sdz.style.borderColor='';sdz.style.background='';});
  sdz.addEventListener('drop',e=>{e.preventDefault();sdz.style.borderColor='';sdz.style.background='';if(e.dataTransfer.files.length){const f=e.dataTransfer.files[0];if(f.name.match(/\.xlsx?$/i))processStudentFile(f);}});
  document.getElementById('studentName').addEventListener('input',function(){if(batchMode&&batchResults[currentBatchIdx])batchResults[currentBatchIdx].studentName=this.value;});
  initFirebase();
});
document.addEventListener('keydown',e=>{if(!corrCanvas)return;const s3=document.getElementById('scanStep3');if(!s3||!s3.classList.contains('step-active'))return;const ae=document.activeElement;if(ae&&(ae.tagName==='INPUT'||ae.tagName==='SELECT'||ae.tagName==='TEXTAREA'))return;let h=false;if(e.shiftKey){switch(e.key){case'ArrowUp':nudgeGrp('drs',-1);h=true;break;case'ArrowDown':nudgeGrp('drs',1);h=true;break;case'ArrowLeft':nudgeGrp('dos',-1);h=true;break;case'ArrowRight':nudgeGrp('dos',1);h=true;break;}}else{switch(e.key){case'ArrowLeft':nudgeGrp('dx',-1);h=true;break;case'ArrowRight':nudgeGrp('dx',1);h=true;break;case'ArrowUp':nudgeGrp('dy',-1);h=true;break;case'ArrowDown':nudgeGrp('dy',1);h=true;break;}}if(h)e.preventDefault();});