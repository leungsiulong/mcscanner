/* ===== config.js — GLOBAL STATE & CONSTANTS ===== */
const CW=1000,CH=1414,LS_KEY='omrV6',LS_IMG='omrV6_img';
let srcImg=null,corrCanvas=null,corrGray=null;
let corners=[{x:50,y:50},{x:750,y:50},{x:750,y:1050},{x:50,y:1050}];
let cornerRatios=null,dragIdx=-1,cScale=1;
let scanResults=[],camStream=null;
let G={ox:75,oy:505,os:24.5,rs:27.5,cs:232,gg:14,bw:16,bh:10};
let fillMin=50,darkThr=0;
let groupOffsets=[];for(let i=0;i<16;i++)groupOffsets.push({dx:0,dy:0,drs:0,dos:0});
let selectedGrp=0,calibActive=false,calibStep=0,calibPts=[];
const calibLabels=['Q1 的 A','Q5 的 D','Q21 的 A'];
let mouseOnGrid={x:0,y:0},computedOtsu=128;
let pdfDoc=null,currentPdfPage=1,totalPdfPages=0,pdfRenderedImg=null;
let papers=[],selectedPaperId=null,currentAnswerKey=new Array(80).fill(''),currentTotalQ=80;
let editingPaperId=null,paperFormAK=new Array(80).fill(''),paperFormMulti=new Array(80).fill(false),records=[];
let currentScanStep=0,maxReachedStep=0;
let batchMode=false,batchResults=[],currentBatchIdx=0;
let studentDB={},selectedScanClass='',stuPreviewData=null,usedStudentsInBatch=new Set();
let recordImages={};
let editingRecId=null,editingRecAnswers=[];
let recViewingStudent=null;
let paperTabYear='',paperTabSubject='',paperTabGrade='',paperTabTerm='',paperTabSet='';
let stuTabYear='',stuTabClass='';
let recTabYear='',recTabTerm='',recTabSubject='',recTabClass='';
let scanTabYear='',scanTabSubject='',scanTabGrade='',scanTabTerm='',scanTabSet='';

/* ===== 班號 + 選修科「掃描班別」格線設定 =====
   HG.clsX：選修科「掃描班別」欄（A–S）的 X 座標，預設位於班號十位左方。 */
let HG={no1X:288,no2X:324,startY:167,rowS:27.5,hbw:14,hbh:10,enabled:true,clsX:252};
let headerColOffsets={no1:{dx:0,dy:0},no2:{dx:0,dy:0},cls:{dx:0,dy:0}};
let headerAutoOffsets={no1:{dx:0,dy:0},no2:{dx:0,dy:0},cls:{dx:0,dy:0}};
let selectedHdrCol='no1';
let detectedHeaderInfo=null;
let hdrCalibActive=false,hdrCalibStep=0,hdrCalibPts=[];
const HDR_CALIB_LABELS=['班號十位 0 氣泡中心','班號十位 9 氣泡中心','班號個位 0 氣泡中心'];
const HDR_COL_COUNTS={no1:10,no2:10,cls:9};
/* 選修科「掃描班別」欄的選項字母（A–H 加 S，共 9 個） */
const ELEC_CLASS_LETTERS=['A','B','C','D','E','F','G','H','S'];
/* 目前所選班別是否為選修科班別（啟用掃描班別欄偵測） */
let electiveScanMode=false;
/* 掃描結果步驟「調整格線」視窗的狀態 */
let gridAdjustMode=false,gridAdjustOrigParent=null,gridAdjustOrigNext=null;

const FIREBASE_CONFIG={apiKey:"AIzaSyA70BqWnpIlNi7XoOugAIAsy3uvBmESpUI",authDomain:"mc-checker-9375e.firebaseapp.com",projectId:"mc-checker-9375e",storageBucket:"mc-checker-9375e.firebasestorage.app",messagingSenderId:"1092571434878",appId:"1:1092571434878:web:d7cc0df7423b9f00ff2d2f"};
let db=null,fbConnected=false,fbSaveTimer=null;
/* YEARS and SUBJECTS are now mutable so teachers can add custom values */
let YEARS=['2025/2026','2026/2027','2027/2028','2028/2029'];
const GRADES=['中一','中二','中三','中四','中五','中六'];
/* 級別 → 班別數字（用於選修科：級別數字 + 掃描班別字母 = 原班別，例如 中四 + D = 4D） */
const GRADE_NUM_MAP={'中一':'1','中二':'2','中三':'3','中四':'4','中五':'5','中六':'6'};
let SUBJECTS=['English','中文','數學','通識/公社','綜合科學','物理','化學','生物','地理','歷史','經濟','BAFS','ICT','體育','其他'];
const STEP_LABELS=['選擇試卷','上載圖片','四角定位','格線校準','掃描結果'];
if(typeof pdfjsLib!=='undefined')pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
function yearCodeToFull(c){const s=String(c).trim();if(/^\d{4}$/.test(s))return'20'+s.substring(0,2)+'/20'+s.substring(2,4);return s.includes('/')?s:s;}
function escQ(s){return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'");}
function escAttr(s){return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
/* 判斷學生答案是否正確：支援多選答案鍵（例如 "AC"），學生答中任一個即得分 */
function isAnswerCorrect(ans,key){if(!key||!ans)return false;return String(key).indexOf(ans)>=0;}