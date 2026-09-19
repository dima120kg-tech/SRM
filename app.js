let DATA = {meta:{},tasks:[]};
let currentView = 'searchView';
let previousView = 'searchView';
let selectedTask = null;
let wizard = {step:1, side:'LH', zone:null, structure:null, position:null, damage:null, measurements:{}, station:null};
let locator = {side:'LH', zone:null, mode:'overview', station:null, component:null, structConfig:localStorage.getItem('masterSRM.structConfig')||'ST3'};
let currentPdfUrl = null;

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

init();

async function init(){
  DATA = await fetch('data/srm-index.json').then(r=>r.json());
  restorePrefs();
  bindUI();
  await updateDocumentStatus();
  renderLocator();
  renderWizard();
  if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js').catch(()=>{}); }
}

function bindUI(){
  $$('.nav-item').forEach(btn=>btn.addEventListener('click',()=>showView(btn.dataset.view)));
  $('#homeBtn').addEventListener('click',goHome);
  $('#settingsBtn').addEventListener('click',()=>{ previousView=currentView; showView('settingsView', false); });
  $('#settingsBack').addEventListener('click',()=>showView(previousView,false));
  $('#locatorBack').addEventListener('click',()=>showView('searchView'));
  $('#openLocatorBtn').addEventListener('click',()=>{ locator.zone=null; locator.station=null; locator.component=null; locator.mode='overview'; locator.side=wizard.side||'LH'; showView('locatorView'); });
  $$('.side-btn').forEach(btn=>btn.addEventListener('click',()=>{ locator.side=btn.dataset.side; $$('.side-btn').forEach(x=>x.classList.toggle('active',x.dataset.side===locator.side)); renderLocator(); }));
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
  if(updateNav){ $$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===id)); }
  window.scrollTo({top:0,behavior:'auto'});
  if(id==='wizardView') renderWizard();
  if(id==='locatorView') renderLocator();
  if(id==='documentView') updateDocumentStatus();
}

function goHome(){
  $('#searchInput').value='';
  search('');
  locator.zone=null; locator.station=null; locator.component=null; locator.mode='overview';
  resetWizard(false);
  showView('searchView');
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
  $('#resultsList').innerHTML=scored.length?scored.map(x=>taskCard(x.t)).join(''):`<div class="info-card"><strong>Точного совпадения пока нет</strong><p>Попробуй выбрать место на самолёте или запрос: “ice shield dent”, “вмятина обшивки возле багажной двери”, “cargo door dent”, “rear fuselage dent”.</p></div>`;
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
  resetWizard(false);
  if(type==='cargo-area'){ wizard.zone='cargo-area'; wizard.step=2; }
  if(type==='fuselage'){ wizard.zone='fwd'; wizard.structure='skin'; wizard.step=3; }
  showView('wizardView');
}

function planeSvg(selected=null, compact=false){
  const selectedClass=z=>selected===z?' selected':'';
  return `<svg class="plane-map${compact?' compact':''}" viewBox="0 0 820 330" role="img" aria-label="Интерактивная схема ATR 72. Нажми на область самолёта.">
    <defs>
      <linearGradient id="fuseGrad" x1="0" x2="1"><stop offset="0" stop-color="#f8fbff"/><stop offset=".55" stop-color="#d9e5ef"/><stop offset="1" stop-color="#afc0cf"/></linearGradient>
      <linearGradient id="wingGrad" x1="0" x2="1"><stop offset="0" stop-color="#dce7f1"/><stop offset="1" stop-color="#9fb2c4"/></linearGradient>
    </defs>
    <g class="aircraft-art" aria-hidden="true">
      <path class="airframe fuselage-shape" d="M76 164 C92 123 140 108 222 108 H610 C661 108 706 124 749 151 C770 165 774 181 753 195 C714 220 662 229 602 229 H215 C143 229 99 213 79 187 C71 177 70 172 76 164 Z" fill="url(#fuseGrad)"/>
      <path class="airframe tail-fin" d="M638 112 L686 44 L716 48 L703 139 Z" fill="url(#wingGrad)"/>
      <path class="airframe tailplane" d="M644 146 L760 118 L773 127 L700 163 Z" fill="url(#wingGrad)"/>
      <path class="airframe wing-shape" d="M363 124 L530 43 L566 51 L466 151 L568 257 L531 265 L361 194 Z" fill="url(#wingGrad)"/>
      <rect x="352" y="91" width="67" height="34" rx="14" fill="#aebdca"/>
      <rect x="487" y="91" width="67" height="34" rx="14" fill="#aebdca"/>
      <circle cx="360" cy="108" r="42" class="prop-disc"/><circle cx="495" cy="108" r="42" class="prop-disc"/>
      <circle cx="360" cy="108" r="8" fill="#22364a"/><circle cx="495" cy="108" r="8" fill="#22364a"/>
      <path d="M98 154 L126 140 L149 140 L158 159 Z" fill="#35546e" opacity=".9"/>
      <rect x="190" y="137" width="24" height="53" rx="4" class="door-outline"/>
      <rect x="234" y="141" width="31" height="43" rx="4" class="door-outline cargo-outline"/>
      <g class="windows">${Array.from({length:15},(_,i)=>`<rect x="${284+i*20}" y="145" width="10" height="16" rx="5"/>`).join('')}</g>
      <path d="M327 190 C358 199 420 200 453 190" class="ice-line"/>
    </g>
    <g class="plane-zone${selectedClass('fwd')}" data-zone="fwd" tabindex="0" role="button" aria-label="Передняя часть фюзеляжа"><rect class="zone-hit" x="72" y="112" width="188" height="118" rx="35"/><text x="135" y="101">FWD</text></g>
    <g class="plane-zone${selectedClass('cargo-area')}" data-zone="cargo-area" tabindex="0" role="button" aria-label="Район багажной двери"><rect class="zone-hit cargo-hit" x="214" y="124" width="82" height="86" rx="18"/><text x="220" y="246">CARGO AREA</text></g>
    <g class="plane-zone${selectedClass('ice-shield')}" data-zone="ice-shield" tabindex="0" role="button" aria-label="Ice shield"><rect class="zone-hit ice-hit" x="318" y="174" width="144" height="62" rx="22"/><text x="342" y="254">ICE SHIELD</text></g>
    <g class="plane-zone${selectedClass('center')}" data-zone="center" tabindex="0" role="button" aria-label="Центральная часть фюзеляжа"><rect class="zone-hit" x="295" y="118" width="184" height="70" rx="24"/><text x="346" y="101">CENTER</text></g>
    <g class="plane-zone${selectedClass('rear')}" data-zone="rear" tabindex="0" role="button" aria-label="Задняя часть фюзеляжа"><rect class="zone-hit" x="480" y="116" width="170" height="112" rx="30"/><text x="532" y="101">REAR</text></g>
    <g class="plane-zone${selectedClass('tail')}" data-zone="tail" tabindex="0" role="button" aria-label="Хвостовое оперение"><rect class="zone-hit" x="630" y="40" width="145" height="145" rx="28"/><text x="668" y="31">TAIL</text></g>
    <g class="plane-zone wing-zone${selectedClass('wing')}" data-zone="wing" tabindex="0" role="button" aria-label="Крыло"><path class="zone-hit wing-hit" d="M340 114 L544 28 L588 45 L475 164 L592 272 L538 286 L337 198 Z"/><text x="470" y="296">WING</text></g>
  </svg>`;
}

const zoneInfo={
  fwd:{title:'FWD Fuselage',sub:'Передняя часть фюзеляжа',next:'skin'},
  'cargo-area':{title:'Cargo Door Area',sub:'Обшивка и структура вокруг багажной двери',next:'cargo'},
  'ice-shield':{title:'Ice Shield',sub:'Зона металлического защитного щита',next:'ice'},
  center:{title:'Center Fuselage',sub:'Центральная часть фюзеляжа',next:'skin'},
  rear:{title:'Rear Fuselage',sub:'Задняя часть фюзеляжа',next:'skin'},
  wing:{title:'Wing',sub:'Крыло / wing structure',next:'search'},
  tail:{title:'Tail / Empennage',sub:'Хвостовое оперение',next:'search'}
};

const majorFrames=[
  {x:2962,fr:'FR 1'},{x:5707,fr:'FR 13'},{x:7684,fr:'FR 17A'},
  {x:8595,fr:'FR 19A'},{x:11132,fr:'FR 24'},{x:13850,fr:'FR 25'},
  {x:14981,fr:'FR 27'},{x:15509,fr:'FR 28'},{x:22645,fr:'FR 39'},
  {x:24053,fr:'FR 42'},{x:24921,fr:'FR 44'},{x:29528,fr:'FR 48'}
];
const stationFigures={
  ST2:{src:'assets/fig2-st2.png',sheet:'Figure 2 · Sheet 1 · ST2',page:332},
  ST3:{src:'assets/fig2-st3.png',sheet:'Figure 2 · Sheet 2 · ST3',page:333},
  ST7:{src:'assets/fig2-st7.png',sheet:'Figure 2 · Sheet 3 · ST7 Freighter',page:334}
};
const locatorZones={
  nose:{title:'Nose / FWD fuselage',sub:'Передняя носовая часть',mode:'fuselage'},
  fwd:{title:'FWD Fuselage',sub:'Передняя часть фюзеляжа',mode:'fuselage'},
  'cargo-area':{title:'Cargo Door Area',sub:'Район cargo-compartment door / surrounding skin',mode:'fuselage'},
  center:{title:'Center Fuselage',sub:'Центральная часть фюзеляжа',mode:'fuselage'},
  rear:{title:'Rear Fuselage',sub:'Задняя часть фюзеляжа',mode:'fuselage'},
  tail:{title:'Vertical Stabilizer / Tail',sub:'Хвостовое оперение',mode:'components'},
  gear:{title:'Landing Gear Area',sub:'Зона шасси / adjacent structure',mode:'overview'},
  'wing-fairing':{title:'Wing to Fuselage Fairing',sub:'Wing-to-fuselage fairing',mode:'components'},
  nacelle:{title:'Power Plant / Nacelle',sub:'Engine nacelle and power-plant area',mode:'components'},
  'belly-fairing':{title:'Belly Fairings',sub:'Belly fairing structure',mode:'components'},
  'vertical-stabilizer':{title:'Vertical Stabilizer',sub:'Vertical stabilizer frames/stations/sections',mode:'components'}
};
function hotspot(id,label,left,top,width,height,kind=''){
  return `<button class="tech-hotspot ${kind} ${locator.zone===id||locator.component===id?'selected':''}" data-zone="${id}" style="left:${left}%;top:${top}%;width:${width}%;height:${height}%"><span>${label}</span></button>`;
}
function overviewMapHtml(compact=false){
  return `<div class="official-map ${compact?'compact':''}">
    <div class="source-strip"><b>SRM 51-00-02</b><span>Figure 5 · Major Sub Zones</span></div>
    <div class="tech-map-wrap overview-tech-map">
      <img src="assets/fig5-major-subzones.png" alt="ATR72 SRM major sub zones" draggable="false">
      ${hotspot('nose','NOSE',4,42,13,21)}
      ${hotspot('fwd','FWD',16,41,26,22)}
      ${hotspot('cargo-area','CARGO',23,43,10,19,'accent')}
      ${hotspot('center','CENTER',40,40,22,24)}
      ${hotspot('gear','GEAR',46,57,13,18)}
      ${hotspot('rear','REAR',61,38,23,27)}
      ${hotspot('tail','TAIL',82,23,16,34)}
    </div>
    <div class="map-legend"><span><i></i>нажимай прямо на конструкцию</span><small>оригинальная SRM figure</small></div>
  </div>`;
}
function componentsMapHtml(){
  return `<div class="official-map">
    <div class="source-strip"><b>SRM 51-00-02</b><span>Figure 3 · Frames / Stations / Sections</span></div>
    <div class="tech-map-wrap components-tech-map">
      <img src="assets/fig3-components.png" alt="SRM component location figure" draggable="false">
      ${hotspot('vertical-stabilizer','VERT STAB',46,1,50,27)}
      ${hotspot('wing-fairing','WING FAIRING',4,33,56,24)}
      ${hotspot('nacelle','NACELLE',63,38,36,29)}
      ${hotspot('belly-fairing','BELLY FAIRING',4,72,68,27)}
    </div>
    <div class="map-legend"><span><i></i>узлы самолёта</span><small>FWD / STA / RIB сохранены на рисунке</small></div>
  </div>`;
}
function closestMajorFrame(x){ return majorFrames.reduce((a,b)=>Math.abs(b.x-x)<Math.abs(a.x-x)?b:a); }
function zoneFromStation(x){
  if(x>=5200 && x<=8500) return 'cargo-area';
  if(x<14981) return 'fwd';
  if(x<22645) return 'center';
  return 'rear';
}
function stationMapHtml(){
  const f=stationFigures[locator.structConfig]||stationFigures.ST3;
  const marker=locator.station?`<div class="station-marker" style="top:${locator.station.yPct}%"><span></span></div>`:'';
  return `<div class="official-map station-map-card">
    <div class="source-strip"><b>SRM 51-00-02</b><span>${f.sheet}</span></div>
    <div class="locator-config-row"><label>Конфигурация рисунка</label><select id="structConfigSelect"><option value="ST2" ${locator.structConfig==='ST2'?'selected':''}>ST2</option><option value="ST3" ${locator.structConfig==='ST3'?'selected':''}>ST3</option><option value="ST7" ${locator.structConfig==='ST7'?'selected':''}>ST7 · Freighter</option></select></div>
    <div class="station-scroll"><div class="tech-map-wrap station-tech-map" id="stationMapWrap">
      <img src="${f.src}" alt="${f.sheet} fuselage stations and frames" draggable="false">
      <button id="stationTapArea" class="station-tap-area" aria-label="Нажми на фюзеляж для выбора станции"></button>${marker}
    </div></div>
    <div class="station-help">Нажми на продольное место повреждения. Все STA / FR остаются видимыми на исходном рисунке; расчёт X ниже - только навигационная подсказка.</div>
    <button class="text-link" id="openFigurePdf">Оригинал SRM · PDF ${f.page}</button>
  </div>`;
}
function locatorTabs(){
  const tab=(m,t)=>`<button class="locator-tab ${locator.mode===m?'active':''}" data-locator-mode="${m}">${t}</button>`;
  return `<div class="locator-tabs">${tab('overview','Общий вид')}${tab('fuselage','STA / FR')}${tab('components','Узлы')}</div>`;
}
function renderLocator(){
  if(!$('#locatorBody')) return;
  $$('.side-btn').forEach(x=>x.classList.toggle('active',x.dataset.side===locator.side));
  let map='';
  if(locator.mode==='fuselage') map=stationMapHtml();
  else if(locator.mode==='components') map=componentsMapHtml();
  else map=overviewMapHtml(false);
  const info=locator.station?{title:`≈ X/STA ${Math.round(locator.station.x)}`,sub:`${locator.station.frame.fr} · ${locator.side} · ${locator.structConfig}`}:(locator.zone?locatorZones[locator.zone]:locator.component?locatorZones[locator.component]:null);
  $('#locatorBody').innerHTML=`${locatorTabs()}${map}
    ${info?`<div class="selection-card"><span class="eyebrow">ВЫБРАНО</span><h3>${info.title}</h3><p>${info.sub}</p><div class="selection-actions">${locator.mode==='overview' && locatorZones[locator.zone]?.mode==='fuselage'?`<button class="secondary-action" id="refineStation">Уточнить STA / FR</button>`:''}<button class="primary-action" id="locatorContinue">Продолжить</button></div></div>`:`<div class="info-card"><strong>Нажми на место повреждения</strong><p>Сначала выбери сторону LH/RH. Для фюзеляжа можно перейти в STA/FR и поставить точку по официальному рисунку.</p></div>`}
  `;
  $$('#locatorBody [data-locator-mode]').forEach(b=>b.onclick=()=>{ locator.mode=b.dataset.locatorMode; locator.zone=null; locator.component=null; locator.station=null; renderLocator(); });
  $$('#locatorBody .tech-hotspot').forEach(b=>b.onclick=()=>{ const z=b.dataset.zone; if(locator.mode==='components') locator.component=z; else locator.zone=z; locator.station=null; renderLocator(); });
  $('#refineStation')?.addEventListener('click',()=>{ locator.mode='fuselage'; renderLocator(); });
  $('#locatorContinue')?.addEventListener('click',continueFromLocator);
  $('#structConfigSelect')?.addEventListener('change',e=>{ locator.structConfig=e.target.value; localStorage.setItem('masterSRM.structConfig',locator.structConfig); locator.station=null; renderLocator(); });
  $('#stationTapArea')?.addEventListener('click',e=>{
    const r=e.currentTarget.getBoundingClientRect(); const p=Math.max(0,Math.min(1,(e.clientY-r.top)/r.height));
    const x=29528-p*(29528-2362); const frame=closestMajorFrame(x);
    locator.station={x,frame,yPct:1+p*72}; locator.zone=zoneFromStation(x); locator.component=null; renderLocator();
  });
  $('#openFigurePdf')?.addEventListener('click',()=>openPdfAt((stationFigures[locator.structConfig]||stationFigures.ST3).page));
}

function bindPlaneZones(scope,handler){
  $$(scope+' .plane-zone').forEach(el=>{
    el.addEventListener('click',()=>handler(el.dataset.zone));
    el.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); handler(el.dataset.zone); } });
  });
}

function continueFromLocator(){
  const z=locator.zone || locator.component; if(!z) return;
  resetWizard(false); wizard.side=locator.side; wizard.station=locator.station;
  if(z==='cargo-area'){ wizard.zone='cargo-area'; wizard.step=2; }
  else if(z==='fwd'||z==='nose'){ wizard.zone='fwd'; wizard.structure='skin'; wizard.step=3; }
  else if(z==='rear'){ wizard.zone='rear'; wizard.structure='skin'; wizard.step=3; }
  else if(z==='center'){ wizard.zone='center'; wizard.step=2; }
  else if(z==='tail'||z==='vertical-stabilizer'||z==='wing-fairing'||z==='nacelle'||z==='belly-fairing'||z==='gear'){
    const q=(locatorZones[z]?.title||z)+' damage'; showView('searchView'); $('#searchInput').value=q; search(q); toast('Место сохранено; для этого узла автоматический damage rule пока не индексирован'); return;
  } else { showView('searchView'); return; }
  showView('wizardView');
}

function resetWizard(render=true){ wizard={step:1,side:locator.side||'LH',zone:null,structure:null,position:null,damage:null,measurements:{},station:null}; if(render) renderWizard(); }

function renderWizard(){
  if(!$('#wizardBody')) return;
  $('#wizardStep').textContent=`${Math.min(wizard.step,4)} / 4`;
  const body=$('#wizardBody');
  if(wizard.step===1){
    body.innerHTML=`<div class="aircraft-map-card compact-map"><div class="map-help"><strong>ATR 72 · ${wizard.side}</strong><span>Ткни область на официальной SRM figure</span></div>${overviewMapHtml(true)}</div><div class="wizard-question">Или выбери область кнопкой</div><div class="choice-grid">${choice('zone','cargo-area','Cargo Door Area','обшивка рядом с багажной дверью')}${choice('zone','ice-shield','Ice Shield','защитный щит фюзеляжа')}${choice('zone','fwd','FWD Fuselage','передняя часть фюзеляжа')}${choice('zone','rear','Rear Fuselage','задняя часть фюзеляжа')}</div>`;
    $$('#wizardBody .tech-hotspot').forEach(b=>b.onclick=()=>{ const z=b.dataset.zone; if(z==='tail'||z==='gear'){ locator.zone=z; locator.side=wizard.side; locator.mode='overview'; showView('locatorView'); return; } wizard.zone=z==='nose'?'fwd':z; if(z==='fwd'||z==='rear'){ wizard.structure='skin'; wizard.step=3; } else if(z==='center'){ wizard.step=2; } else wizard.step=2; renderWizard(); });
  } else if(wizard.step===2){
    body.innerHTML=`<div class="location-summary"><span class="badge">${wizard.side}</span><strong>${zoneInfo[wizard.zone]?.title||locatorZones[wizard.zone]?.title||wizard.zone}</strong>${wizard.station?`<small>≈ X/STA ${Math.round(wizard.station.x)} · ${wizard.station.frame.fr}</small>`:''}</div><div class="wizard-question">Что именно повреждено?</div><div class="choice-grid">${choice('structure','skin','Fuselage Skin','обшивка самолёта')}${choice('structure','door','Cargo Door','сама багажная дверь')}${choice('structure','ice','Ice Shield','металлический щит')}${choice('structure','unknown','Не уверен','показать Identification')}</div>${wizard.zone==='cargo-area'?`<div class="panel"><strong>Положение относительно двери</strong><div class="choice-grid" style="margin-top:10px">${choice('position','fwd','FWD','перед дверью')}${choice('position','aft','AFT','за дверью')}${choice('position','above','ABOVE','над дверью')}${choice('position','below','BELOW','под дверью')}</div></div>`:''}`;
  } else if(wizard.step===3){
    body.innerHTML=`<div class="location-summary"><span class="badge">${wizard.side}</span><strong>${zoneInfo[wizard.zone]?.title||locatorZones[wizard.zone]?.title||wizard.zone}</strong><small>${wizard.position?wizard.position.toUpperCase():''}</small>${wizard.station?`<small>≈ X/STA ${Math.round(wizard.station.x)} · ${wizard.station.frame.fr}</small>`:''}</div><div class="wizard-question">Тип повреждения</div><div class="choice-grid">${choice('damage','dent','Dent','вмятина')}${choice('damage','scratch','Scratch / Score','царапина / риска')}${choice('damage','crack','Crack','трещина')}${choice('damage','corrosion','Corrosion','коррозия')}</div>`;
  } else {
    const target=resolveWizardTask();
    if(!target){
      body.innerHTML=`<div class="info-card"><strong>Для этой комбинации автоматическое правило ещё не настроено</strong><p>Открой поиск SRM по ключевым словам или Identification. Приложение не будет придумывать limit, которого нет в индексе.</p></div><div class="wizard-actions"><button class="secondary-action" id="wizRestart">Сначала</button><button class="primary-action" id="wizSearch">Искать в базе</button></div>`;
      $('#wizRestart').onclick=()=>resetWizard(); $('#wizSearch').onclick=()=>{ showView('searchView'); $('#searchInput').value=`${wizard.damage||''} ${wizard.structure||''} ${wizard.zone||''}`; search($('#searchInput').value); };
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
    if(g==='zone'){
      if(v==='ice-shield'){ wizard.structure='ice'; wizard.step=3; }
      else if(v==='fwd'||v==='rear'){ wizard.structure='skin'; wizard.step=3; } else if(v==='center'){ wizard.step=2; }
      else wizard.step=2;
    }
    else if(g==='structure'){
      if(v==='unknown'){ openIdentification(); return; }
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
    if(wizard.zone==='fwd'||wizard.zone==='cargo-area') return DATA.tasks.find(t=>t.id==='fwd-fuselage-skin-dent');
    return null;
  }
  return null;
}

function measurementForm(t){
  const st=wizard.station?`<small>≈ X/STA ${Math.round(wizard.station.x)} · ${wizard.station.frame.fr}</small>`:''; const loc=`<div class="location-summary"><span class="badge">${wizard.side}</span><strong>${zoneInfo[wizard.zone]?.title||locatorZones[wizard.zone]?.title||''}</strong>${wizard.position?`<small>${wizard.position.toUpperCase()}</small>`:''}${st}</div>`;
  if(t.rule?.type==='iceShieldDepth') return `${loc}<div class="detail-hero"><div class="ata">ATA ${t.ata}</div><h2>${t.title}</h2><div class="task">${t.task}</div></div><div class="panel"><div class="wizard-question">Введи измерение</div><div class="field"><label>Глубина повреждения, mm</label><input id="depthMm" inputmode="decimal" placeholder="например 5.5"></div></div><div class="wizard-actions"><button class="secondary-action" id="openTaskDirect">Условия</button><button class="primary-action" id="evaluateBtn">Проверить</button></div>`;
  return `${loc}<div class="detail-hero"><div class="ata">ATA ${t.ata}</div><h2>${t.title}</h2><div class="task">${t.task}</div></div><div class="panel"><div class="wizard-question">Нужны 2 значения</div><div class="measure-grid"><div class="field"><label>A — до ближайшей кромки stiffener, mm</label><input id="aMm" inputmode="decimal" placeholder="например 60"></div><div class="field"><label>Фактическая глубина dent, mm</label><input id="depthMm" inputmode="decimal" placeholder="например 1.0"></div></div><div class="field" style="margin-top:10px"><label>Положение dent относительно stiffener</label><select id="deCond"><option value="unknown">Не уверен</option><option value="valid">D ≥ E — dent не заходит на stiffener</option><option value="invalid">D &lt; E — dent распространяется на stiffener</option></select></div><div class="source-note">Если E нельзя определить, SRM указывает использовать E = 13 mm как reference measuring point для A.</div></div><div class="wizard-actions"><button class="secondary-action" id="openTaskDirect">Условия</button><button class="primary-action" id="evaluateBtn">Проверить</button></div>`;
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
  $('#evaluateAgainBtn')?.addEventListener('click',()=>{ wizard.zone=t.id.includes('ice')?'ice-shield':t.id.includes('rear')?'rear':'fwd'; wizard.structure=t.id.includes('cargo-door-dent')?'door':t.id.includes('ice')?'ice':'skin'; wizard.damage='dent'; wizard.step=4; showView('wizardView'); });
  $('#findIdentificationBtn')?.addEventListener('click',()=>openIdentification());
}

function detailHTML(t,evalData){
  const label=t.kind==='identification'?'IDENTIFICATION':'ALLOWABLE DAMAGE';
  return `<div class="detail-hero"><div class="ata">${label} · ATA ${t.ata}</div><h2>${t.title}</h2><div class="task">${t.task}</div></div>${evaluationBlock(t,evalData)}<div class="panel"><div class="section-heading"><span>Условия</span></div>${(t.conditions?.length?`<ul class="condition-list">${t.conditions.map(x=>`<li>${x}</li>`).join('')}</ul>`:`<p class="muted">Используй этот Identification task, чтобы точно определить structural part и effectivity перед применением damage limits.</p>`)}<div class="meta-row"><span class="meta-pill">PDF page ${t.page}</span><span class="meta-pill">${t.issue}</span><span class="meta-pill">${t.config}</span></div></div><div class="detail-actions">${t.kind==='allowable'&&t.rule?`<button class="secondary-action" id="evaluateAgainBtn">Ввести / изменить размеры</button>`:''}${t.id==='fwd-fuselage-skin-dent'?`<button class="secondary-action" id="findIdentificationBtn">Identification · Cargo Door Surround</button>`:''}${t.repairTask?`<button class="secondary-action" id="openRepairBtn">Repair reference · ${t.repairTask}</button>`:''}<button class="primary-action" id="openPdfBtn">Оригинал SRM · PDF ${t.page}</button></div><div class="source-note">Проверь A/C configuration, точную structural part, STA/FR и applicability на оригинальной странице SRM перед использованием результата.</div>`;
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
