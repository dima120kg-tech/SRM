let DATA = {meta:{},tasks:[]};
let currentView = 'searchView';
let previousView = 'searchView';
let selectedTask = null;
let wizard = {step:1, zone:null, structure:null, position:null, damage:null, measurements:{}};
let currentPdfUrl = null;

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

init();

async function init(){
  DATA = await fetch('data/srm-index.json').then(r=>r.json());
  restorePrefs();
  bindUI();
  await updateDocumentStatus();
  renderWizard();
  if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js').catch(()=>{}); }
}

function bindUI(){
  $$('.nav-item').forEach(btn=>btn.addEventListener('click',()=>showView(btn.dataset.view)));
  $('#settingsBtn').addEventListener('click',()=>{ previousView=currentView; showView('settingsView', false); });
  $('#settingsBack').addEventListener('click',()=>showView(previousView,false));
  $('#wizardBack').addEventListener('click',()=>{
    if(wizard.step>1){ wizard.step--; renderWizard(); } else showView('searchView');
  });
  $('#detailBack').addEventListener('click',()=>showView(previousView,false));
  $('#startWizardBtn').addEventListener('click',()=>{ resetWizard(); showView('wizardView'); });
  $('#searchInput').addEventListener('input',e=>search(e.target.value));
  $('#clearSearch').addEventListener('click',()=>{ $('#searchInput').value=''; search(''); $('#searchInput').focus(); });
  $$('.quick-card').forEach(b=>b.addEventListener('click',()=>quickPreset(b.dataset.preset)));
  $('#uploadBtn').addEventListener('click',()=>$('#pdfInput').click());
  $('#pdfInput').addEventListener('change',e=>{ const f=e.target.files?.[0]; if(f) storePdf(f); });
  $('#configSelect').addEventListener('change',e=>{ localStorage.setItem('masterSRM.config',e.target.value); toast('Конфигурация сохранена'); });
  $('#darkToggle').addEventListener('change',e=>{ document.body.classList.toggle('dark',e.target.checked); localStorage.setItem('masterSRM.dark',e.target.checked?'1':'0'); });
  $('#largeToggle').addEventListener('change',e=>{ document.body.classList.toggle('large-text',e.target.checked); localStorage.setItem('masterSRM.large',e.target.checked?'1':'0'); });
}

function restorePrefs(){
  const dark = localStorage.getItem('masterSRM.dark')==='1';
  const large = localStorage.getItem('masterSRM.large')==='1';
  document.body.classList.toggle('dark',dark); document.body.classList.toggle('large-text',large);
  setTimeout(()=>{ if($('#darkToggle')) $('#darkToggle').checked=dark; if($('#largeToggle')) $('#largeToggle').checked=large; if($('#configSelect')) $('#configSelect').value=localStorage.getItem('masterSRM.config')||'unknown'; },0);
}

function showView(id, updateNav=true){
  $$('.view').forEach(v=>v.classList.remove('active'));
  $('#'+id).classList.add('active');
  currentView=id;
  if(updateNav){
    $$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===id));
  }
  window.scrollTo({top:0,behavior:'auto'});
  if(id==='wizardView') renderWizard();
  if(id==='documentView') updateDocumentStatus();
}

function normalize(s=''){
  const replacements={
    'вмятина':'dent','вмятины':'dent','царапина':'scratch','царапины':'scratch','трещина':'crack','коррозия':'corrosion',
    'обшивка':'skin','фюзеляж':'fuselage','багажной':'cargo','багажная':'cargo','багажной двери':'cargo door','двери':'door',
    'слева':'left','справа':'right','рядом':'surround','возле':'surround','вокруг':'surround','повреждение':'damage','повреждения':'damage'
  };
  let x=s.toLowerCase().replace(/ё/g,'е');
  Object.entries(replacements).forEach(([a,b])=>x=x.split(a).join(b));
  return x.replace(/[–—_/]+/g,' ').replace(/[^a-zа-я0-9\s.-]/gi,' ').replace(/\s+/g,' ').trim();
}

function taskText(t){ return normalize([t.ata,t.task,t.title,t.summary,t.config,...(t.aliases||[])].join(' ')); }
function search(q){
  const n=normalize(q);
  const resultsPanel=$('#searchResults'), start=$('#startPanel');
  if(!n){ resultsPanel.classList.add('hidden'); start.classList.remove('hidden'); return; }
  const tokens=n.split(' ').filter(Boolean);
  let scored=DATA.tasks.map(t=>{
    const text=taskText(t); let score=0;
    tokens.forEach(tok=>{ if(text.includes(tok)) score += tok.length>3?3:1; });
    if(text.includes(n)) score+=8;
    if(n.includes('cargo')&&n.includes('door')&&n.includes('skin')&&t.id==='fwd-fuselage-skin-dent') score+=6;
    if(n.includes('cargo')&&n.includes('door')&&n.includes('dent')&&t.id==='cargo-door-dent') score+=5;
    if(n.includes('ice')&&n.includes('shield')&&t.id==='ice-shield-damage') score+=10;
    return {t,score};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,12);
  $('#resultsCount').textContent=scored.length;
  $('#resultsTitle').textContent = n.includes('cargo') && n.includes('door') ? 'Найдено по Cargo Door' : 'Результаты';
  $('#resultsList').innerHTML=scored.length?scored.map(x=>taskCard(x.t)).join(''):`<div class="info-card"><strong>Точного совпадения пока нет</strong><p>Попробуй: “ice shield dent”, “вмятина обшивки возле багажной двери”, “cargo door dent”, “rear fuselage dent”.</p></div>`;
  $('#resultsList').querySelectorAll('[data-task]').forEach(b=>b.addEventListener('click',()=>openTask(b.dataset.task)));
  resultsPanel.classList.remove('hidden'); start.classList.add('hidden');
}

function taskCard(t){
  const label=t.kind==='identification'?'IDENTIFICATION':'ALLOWABLE DAMAGE';
  return `<button class="result-card" data-task="${t.id}"><div class="result-top"><span class="badge">${label}</span><span class="task-code">${t.task}</span></div><h3>${t.title}</h3><p>${t.summary||''}</p><div class="meta-row"><span class="meta-pill">ATA ${t.ata}</span><span class="meta-pill">PDF ${t.page}</span><span class="meta-pill">${t.issue}</span></div></button>`;
}

function quickPreset(type){
  if(type==='ice-shield'){ openTask('ice-shield-damage'); return; }
  if(type==='cargo-door'){ openTask('cargo-door-dent'); return; }
  resetWizard();
  if(type==='cargo-area'){ wizard.zone='cargo-area'; wizard.step=2; }
  if(type==='fuselage'){ wizard.zone='fuselage'; wizard.step=2; }
  showView('wizardView');
}

function resetWizard(){ wizard={step:1,zone:null,structure:null,position:null,damage:null,measurements:{}}; renderWizard(); }

function renderWizard(){
  if(!$('#wizardBody')) return;
  $('#wizardStep').textContent=`${Math.min(wizard.step,4)} / 4`;
  const body=$('#wizardBody');
  if(wizard.step===1){
    body.innerHTML=`<div class="aircraft-card"><strong>ATR 72 · LOCATION</strong><div class="aircraft-side"><div class="fuselage"></div><div class="wing"></div><div class="tail"></div><div class="cargo-door-marker"></div><div class="zone-label">CARGO DOOR AREA</div></div></div><div class="wizard-question">Выбери область</div><div class="choice-grid">${choice('zone','cargo-area','Cargo Door Area','обшивка рядом с багажной дверью')}${choice('zone','ice-shield','Ice Shield','защитный щит фюзеляжа')}${choice('zone','fwd','FWD Fuselage','передняя часть фюзеляжа')}${choice('zone','rear','Rear Fuselage','задняя часть фюзеляжа')}</div>`;
  } else if(wizard.step===2){
    body.innerHTML=`<div class="wizard-question">Что именно повреждено?</div><div class="choice-grid">${choice('structure','skin','Fuselage Skin','обшивка самолёта')}${choice('structure','door','Cargo Door','сама багажная дверь')}${choice('structure','ice','Ice Shield','металлический щит')}${choice('structure','unknown','Не уверен','показать Identification')}</div>${wizard.zone==='cargo-area'?`<div class="panel"><strong>Положение относительно двери</strong><div class="choice-grid" style="margin-top:10px">${choice('position','fwd','FWD','перед дверью')}${choice('position','aft','AFT','за дверью')}${choice('position','above','ABOVE','над дверью')}${choice('position','below','BELOW','под дверью')}</div></div>`:''}`;
  } else if(wizard.step===3){
    body.innerHTML=`<div class="wizard-question">Тип повреждения</div><div class="choice-grid">${choice('damage','dent','Dent','вмятина')}${choice('damage','scratch','Scratch / Score','царапина / риска')}${choice('damage','crack','Crack','трещина')}${choice('damage','corrosion','Corrosion','коррозия')}</div>`;
  } else {
    const target=resolveWizardTask();
    if(!target){
      body.innerHTML=`<div class="info-card"><strong>Для этой комбинации автоматическое правило ещё не настроено</strong><p>Открой поиск SRM по ключевым словам или выбери Identification. В следующих версиях добавим остальные damage types.</p></div><div class="wizard-actions"><button class="secondary-action" id="wizRestart">Сначала</button><button class="primary-action" id="wizSearch">Искать в базе</button></div>`;
      $('#wizRestart').onclick=resetWizard; $('#wizSearch').onclick=()=>{ showView('searchView'); $('#searchInput').value=`${wizard.damage||''} ${wizard.structure||''} ${wizard.zone||''}`; search($('#searchInput').value); };
      return;
    }
    selectedTask=target;
    body.innerHTML=measurementForm(target);
    $('#evaluateBtn').onclick=()=>evaluateFromWizard(target);
    $('#openTaskDirect').onclick=()=>openTask(target.id,true);
  }
  bindChoices();
}

function choice(group,value,title,sub){
  const selected=wizard[group]===value?' selected':'';
  return `<button class="choice${selected}" data-group="${group}" data-value="${value}"><strong>${title}</strong><small>${sub}</small></button>`;
}
function bindChoices(){
  $$('#wizardBody .choice').forEach(b=>b.addEventListener('click',()=>{
    const g=b.dataset.group,v=b.dataset.value; wizard[g]=v;
    if(g==='zone'){ wizard.step=2; }
    else if(g==='structure'){
      if(v==='ice'){ wizard.zone='ice-shield'; wizard.step=3; }
      else wizard.step=wizard.zone==='cargo-area' && !wizard.position ? 2 : 3;
    }
    else if(g==='position'){ wizard.position=v; if(wizard.structure) wizard.step=3; }
    else if(g==='damage'){ wizard.step=4; }
    renderWizard();
  }));
}

function resolveWizardTask(){
  if(wizard.structure==='ice' || wizard.zone==='ice-shield') return DATA.tasks.find(t=>t.id==='ice-shield-damage');
  if(wizard.structure==='door' && wizard.damage==='dent') return DATA.tasks.find(t=>t.id==='cargo-door-dent');
  if(wizard.damage==='dent'){
    if(wizard.zone==='rear') return DATA.tasks.find(t=>t.id==='rear-fuselage-skin-dent');
    return DATA.tasks.find(t=>t.id==='fwd-fuselage-skin-dent');
  }
  return null;
}

function measurementForm(t){
  if(t.rule?.type==='iceShieldDepth') return `<div class="detail-hero"><div class="ata">ATA ${t.ata}</div><h2>${t.title}</h2><div class="task">${t.task}</div></div><div class="panel"><div class="wizard-question">Введи измерение</div><div class="field"><label>Глубина повреждения, mm</label><input id="depthMm" inputmode="decimal" placeholder="например 5.5"></div></div><div class="wizard-actions"><button class="secondary-action" id="openTaskDirect">Условия</button><button class="primary-action" id="evaluateBtn">Проверить</button></div>`;
  return `<div class="detail-hero"><div class="ata">ATA ${t.ata}</div><h2>${t.title}</h2><div class="task">${t.task}</div></div><div class="panel"><div class="wizard-question">Нужны 2 значения</div><div class="measure-grid"><div class="field"><label>A — до ближайшей кромки stiffener, mm</label><input id="aMm" inputmode="decimal" placeholder="например 60"></div><div class="field"><label>Фактическая глубина dent, mm</label><input id="depthMm" inputmode="decimal" placeholder="например 1.0"></div></div><div class="field" style="margin-top:10px"><label>Положение dent относительно stiffener</label><select id="deCond"><option value="unknown">Не уверен</option><option value="valid">D ≥ E — dent не заходит на stiffener</option><option value="invalid">D &lt; E — dent распространяется на stiffener</option></select></div><div class="source-note">Если E нельзя определить, SRM указывает использовать E = 13 mm как reference measuring point для A.</div></div><div class="wizard-actions"><button class="secondary-action" id="openTaskDirect">Условия</button><button class="primary-action" id="evaluateBtn">Проверить</button></div>`;
}

function numVal(id){ const v=parseFloat(($(id)?.value||'').replace(',','.')); return Number.isFinite(v)?v:null; }
function evaluateFromWizard(t){
  const depth=numVal('#depthMm');
  let evalData={depth};
  if(t.rule?.type==='dentFormula') evalData={depth,a:numVal('#aMm'),de:$('#deCond').value};
  openTask(t.id,true,evalData);
}

function openTask(id, fromWizard=false, evalData=null){
  const t=DATA.tasks.find(x=>x.id===id); if(!t) return;
  selectedTask=t; previousView=fromWizard?'wizardView':currentView;
  $('#detailContent').innerHTML=detailHTML(t,evalData);
  showView('detailView',false);
  $('#openPdfBtn')?.addEventListener('click',()=>openPdfAt(t.page));
  $('#openRepairBtn')?.addEventListener('click',()=>toast(`Repair task: ${t.repairTask}`));
  $('#evaluateAgainBtn')?.addEventListener('click',()=>{ wizard.zone=t.id.includes('ice')?'ice-shield':'fwd'; wizard.structure=t.id.includes('cargo-door-dent')?'door':t.id.includes('ice')?'ice':'skin'; wizard.damage='dent'; wizard.step=4; showView('wizardView'); });
  $('#findIdentificationBtn')?.addEventListener('click',()=>openIdentification());
}

function detailHTML(t,evalData){
  const label=t.kind==='identification'?'IDENTIFICATION':'ALLOWABLE DAMAGE';
  return `<div class="detail-hero"><div class="ata">${label} · ATA ${t.ata}</div><h2>${t.title}</h2><div class="task">${t.task}</div></div>${evaluationBlock(t,evalData)}<div class="panel"><div class="section-heading"><span>Условия</span></div>${(t.conditions?.length?`<ul class="condition-list">${t.conditions.map(x=>`<li>${x}</li>`).join('')}</ul>`:`<p class="muted">Используй этот Identification task, чтобы точно определить structural part и effectivity перед применением damage limits.</p>`)}<div class="meta-row"><span class="meta-pill">PDF page ${t.page}</span><span class="meta-pill">${t.issue}</span><span class="meta-pill">${t.config}</span></div></div><div class="detail-actions">${t.kind==='allowable'&&t.rule?`<button class="secondary-action" id="evaluateAgainBtn">Ввести / изменить размеры</button>`:''}${t.id==='fwd-fuselage-skin-dent'?`<button class="secondary-action" id="findIdentificationBtn">Identification · Cargo Door Surround</button>`:''}${t.repairTask?`<button class="secondary-action" id="openRepairBtn">Repair reference · ${t.repairTask}</button>`:''}<button class="primary-action" id="openPdfBtn">Оригинал SRM · PDF ${t.page}</button></div><div class="source-note">Проверь A/C configuration и applicability на оригинальной странице SRM перед использованием результата.</div>`;
}

function evaluationBlock(t,d){
  if(!d) return '';
  if(t.rule?.type==='iceShieldDepth'){
    if(d.depth===null) return status('warn','INSUFFICIENT DATA','Укажи глубину повреждения.');
    const within=d.depth<=t.rule.maxDepthMm;
    const inspect=d.depth>t.rule.inspectSkinAboveMm;
    let html=status(within?'ok':'bad',within?'WITHIN LISTED SRM DEPTH LIMIT':'OUTSIDE LISTED SRM DEPTH LIMIT',within?`Measured depth ${fmt(d.depth)} mm; listed maximum ${t.rule.maxDepthMm} mm.`:`Measured depth ${fmt(d.depth)} mm exceeds listed maximum ${t.rule.maxDepthMm} mm.`);
    html+=`<div class="limit-grid"><div class="limit-box"><small>Measured</small><strong>${fmt(d.depth)} mm</strong></div><div class="limit-box"><small>SRM max</small><strong>8.0 mm</strong></div></div>`;
    if(inspect) html+=status('warn','ADDITIONAL SRM CONDITION','Depth is greater than 6 mm: inspect the fuselage skin below the ice shield for possible impact signs.');
    return html;
  }
  if(t.rule?.type==='dentFormula'){
    if(d.de==='invalid') return status('bad','D < E — AUTOMATIC LIMIT NOT APPLICABLE','The SRM task says the stiffener must be inspected and the manufacturer contacted for further instructions.');
    if(d.depth===null||d.a===null||d.de==='unknown') return status('warn','INSUFFICIENT DATA','Enter A, measured dent depth and confirm the D≥E condition.');
    const max=Math.min(d.a*t.rule.factor,t.rule.capMm); const within=d.depth<=max;
    return status(within?'ok':'bad',within?'WITHIN LISTED DIMENSIONAL LIMIT':'OUTSIDE LISTED DIMENSIONAL LIMIT',`A = ${fmt(d.a)} mm → allowable depth = min(A × 0.02, 2.0) = ${fmt(max)} mm. Measured = ${fmt(d.depth)} mm.`)+`<div class="limit-grid"><div class="limit-box"><small>Measured depth</small><strong>${fmt(d.depth)} mm</strong></div><div class="limit-box"><small>Calculated limit</small><strong>${fmt(max)} mm</strong></div></div>`;
  }
  return '';
}
function status(kind,title,text){ return `<div class="status-card ${kind}"><div class="status-title">${title}</div><p>${text}</p></div>`; }
function fmt(n){ return Number(n).toFixed(2).replace(/\.00$/,''); }

function openIdentification(){
  const config=localStorage.getItem('masterSRM.config')||'unknown';
  let id='cargo-surround-id-af1861';
  if(config==='af5928') id='cargo-surround-id-af5928';
  if(config==='unknown'){ toast('Конфигурация не выбрана — показываю один из applicable candidates'); }
  openTask(id,false);
}

async function openPdfAt(page){
  const rec=await getPdf();
  if(!rec?.blob){ showView('documentView'); toast('Сначала загрузи SRM PDF'); return; }
  if(currentPdfUrl) URL.revokeObjectURL(currentPdfUrl);
  currentPdfUrl=URL.createObjectURL(rec.blob);
  window.open(`${currentPdfUrl}#page=${page}`,'_blank');
}

function openDb(){
  return new Promise((resolve,reject)=>{ const req=indexedDB.open('masterSRM-db',1); req.onupgradeneeded=()=>{ const db=req.result; if(!db.objectStoreNames.contains('docs')) db.createObjectStore('docs'); }; req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error); });
}
async function storePdf(file){
  if(!file.type.includes('pdf')&&!file.name.toLowerCase().endsWith('.pdf')){ toast('Нужен PDF'); return; }
  const db=await openDb(); await new Promise((resolve,reject)=>{ const tx=db.transaction('docs','readwrite'); tx.objectStore('docs').put({blob:file,name:file.name,size:file.size,updated:Date.now()},'srm'); tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error); }); db.close();
  toast('SRM сохранён локально'); updateDocumentStatus();
}
async function getPdf(){ try{ const db=await openDb(); const val=await new Promise((resolve,reject)=>{ const tx=db.transaction('docs','readonly'); const r=tx.objectStore('docs').get('srm'); r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); }); db.close(); return val; }catch{return null;} }
async function updateDocumentStatus(){
  if(!$('#documentStatus')) return; const rec=await getPdf();
  $('#documentStatus').innerHTML=rec?`<div class="status-card ok"><div class="status-title">SRM загружен на устройство</div><p>${rec.name}<br>${(rec.size/1024/1024).toFixed(1)} MB</p></div>`:`<div class="status-card warn"><div class="status-title">SRM PDF ещё не загружен</div><p>Поиск и расчёт работают по встроенному индексу, но для кнопки «Оригинал SRM» нужен твой PDF.</p></div>`;
  const sel=$('#configSelect'); if(sel) sel.value=localStorage.getItem('masterSRM.config')||'unknown';
}
function toast(text){ const el=$('#toast'); el.textContent=text; el.classList.add('show'); clearTimeout(window.__toast); window.__toast=setTimeout(()=>el.classList.remove('show'),2600); }
