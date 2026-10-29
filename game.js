"use strict";

// ==========================================
// 1. معالجة الأخطاء والتهيئات الأولية (Error Handling & Initialization)
// ==========================================

// التقاط أخطاء JavaScript غير المعالجة وتسجيلها في وحدة التحكم (Console)
window.addEventListener("error", e => {
  console.error("Unhandled JS error:", e.error || e.message);
});
// التقاط أخطاء الوعود (Promise Rejections) غير المعالجة
window.addEventListener("unhandledrejection", e => {
  console.error("Unhandled promise rejection:", e.reason);
});

// الحصول على عناصر لوحة الرسم (Canvas) وسياق الرسم ثنائي الأبعاد (2D Context)
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const mapCanvas = document.getElementById("mapCanvas");
const mapCtx = mapCanvas.getContext("2d");
const W = canvas.width, H = canvas.height; // أبعاد اللعبة (العرض والارتفاع)
ctx.imageSmoothingEnabled = false; // إيقاف تنعيم الصور للحفاظ على نمط البكسل (Pixel Art)

// دالة اختصار للحصول على العناصر عبر الـ ID
const $ = id => document.getElementById(id);

// قائمة بمُعرّفات جميع الشاشات/القوائم في اللعبة
const SCREENS = ["mainMenu","arsenalMenu","upgradeMenu","settingsMenu","pauseMenu","mapOverlay","inventory","roomReward","shop","dialogueScreen","gameOver"];

// دالة لإظهار شاشة معينة وإخفاء الباقي
const show = id => { SCREENS.forEach(s => $(s).classList.remove("active")); if(id) $(id).classList.add("active"); };
// دالة لإخفاء شاشة معينة
const hide = id => $(id).classList.remove("active");
// دالة للتحقق مما إذا كانت الشاشة مفتوحة حالياً
const isOpen = id => $(id).classList.contains("active");

// ==========================================
// 2. إدارة المدخلات (Input Handling: Keyboard & Mouse)
// ==========================================

let keys = Object.create(null); // كائن لتتبع المفاتيح المضغوطة حالياً
let mouse = {x:W/2,y:H/2,down:false}; // كائن لتتبع موقع وحالة الفأرة
let last = performance.now(); // التوقيت الزمني لآخر إطار (Frame)

// الاستماع لضغطات المفاتيح
window.addEventListener("keydown", e => {
  const k=e.key.toLowerCase();
  keys[k]=true;
  // منع السلوك الافتراضي للمتصفح مع المفاتيح الخاصة باللعبة
  if(["i","m","escape","shift","1","2","3","e","space"].includes(k)) e.preventDefault();
  AudioSys.ensure(); // التأكد من تفعيل نظام الصوت

  // إذا كانت شاشة الحوار مفتوحة، يتم توجيه مدخلات لوحة المفاتيح للحوار فقط
  if(isOpen("dialogueScreen")){
    if(k==="enter"||k==="space"){advanceDialogue();}
    else if(k==="escape"){closeDialogue();}
    return;
  }
  
  // اختصارات المفاتيح لأوامر اللعبة
  if(k==="i") toggleInventory();  // فتح/إغلاق الحقيبة
  if(k==="m") toggleMap();        // فتح/إغلاق الخريطة
  if(k==="escape") togglePause();  // إيقاف مؤقت
  if(k==="e") interact();         // التفاعل مع العناصر
  if(k==="1") useItem("Potion");  // استخدام جرعة علاج
  if(k==="2") useItem("Bomb");    // استخدام قنبلة
  if(k==="3") useItem("Magnet");  // استخدام المغناطيس
  if(k==="q") cycleWeapon(-1);    // تبديل السلاح للخلف
  if(k==="r") cycleWeapon(1);     // تبديل السلاح للأمام
  if(k==="shift") dash();         // حركة اندفاع سريعة (Dash)
  if(k==="enter" && isOpen("mainMenu")) newRun(); // بدء محاولة جديدة من القائمة الرئيسية
});

// عند رفع الضغط عن المفتاح
window.addEventListener("keyup", e => keys[e.key.toLowerCase()]=false);
// إعادة ضبط المدخلات عند فقدان التركيز عن النافذة
window.addEventListener("blur",()=>{keys=Object.create(null);mouse.down=false});
document.addEventListener("visibilitychange",()=>{if(document.hidden){keys=Object.create(null);mouse.down=false;}});

// تتبع حركة الفأرة وتحديد موقعها بالنسبة لأبعاد Canvas
canvas.addEventListener("mousemove", e => {
  const r=canvas.getBoundingClientRect();
  mouse.x=(e.clientX-r.left)*W/r.width;
  mouse.y=(e.clientY-r.top)*H/r.height;
});
// ضغط زر الفأرة
canvas.addEventListener("mousedown", () => { mouse.down=true; AudioSys.ensure(); });
// رفع الضغط عن زر الفأرة
window.addEventListener("mouseup", () => mouse.down=false);

// Delegate clicks cleanly on the UI containers


// ==========================================
// 3. الإعدادات ونظام الصوت (Settings & Web Audio System)
// ==========================================

// إعدادات اللعبة الافتراضية
const SETTINGS = {
  master:.8,      // مستوى الصوت العام
  music:.35,      // مستوى الموسيقى
  sfx:.75,        // مستوى المؤثرات الصوتية
  shake:0.8,      // قوة اهتزاز الشاشة
  colorAssist:false, // وضع المساعدة للعمى الألوان
  dashAim:true    // الاندفاع باتجاه تصويب الفأرة
};

// تحميل الإعدادات من التخزين المحلي (LocalStorage)
function loadSettings(){
  try{Object.assign(SETTINGS,JSON.parse(localStorage.getItem("db_settings")||"{}"));}catch{}
  syncSettingsUI();
}
// حفظ الإعدادات في التخزين المحلي
function saveSettings(){localStorage.setItem("db_settings",JSON.stringify(SETTINGS));syncSettingsUI();}
// مزامنة عناصر واجهة المستخدم مع قيم الإعدادات
function syncSettingsUI(){
  $("masterVol").value=SETTINGS.master;$("musicVol").value=SETTINGS.music;$("sfxVol").value=SETTINGS.sfx;$("shakeVol").value=SETTINGS.shake;
  $("muteBtn").textContent=(typeof AudioSys!=="undefined" && AudioSys.muted)?"🔇 SOUND OFF":"🔊 SOUND ON";
  $("colorAssistBtn").textContent=SETTINGS.colorAssist?"ON":"OFF";
  $("dashAimBtn").textContent=SETTINGS.dashAim?"ON":"OFF";
}

// نظام الصوت المبني على Web Audio API لإنشاء نغمات ومؤثرات صوتية ديناميكياً
const AudioSys = {
  ac:null, muted:false, timer:null, step:0,
  // التأكد من تهيئة سياق الصوت واستئنافه
  ensure(){ if(!this.ac) this.ac=new (window.AudioContext||window.webkitAudioContext)(); if(this.ac.state==="suspended") this.ac.resume(); },
  // حساب مستوى الصوت بناءً على النوع والصوت العام
  gain(kind){ return (kind==="music"?SETTINGS.music:SETTINGS.sfx)*SETTINGS.master },
  // توليد نغمة صوتية محددة التردد والنوع
  tone(freq,dur=.07,type="square",vol=.05,kind="sfx",offset=0){
    if(this.muted)return;this.ensure();
    const o=this.ac.createOscillator(),g=this.ac.createGain(),t=this.ac.currentTime+offset;
    o.type=type;o.frequency.setValueAtTime(freq,t);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,vol*this.gain(kind)),t+.006);
    g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g).connect(this.ac.destination);o.start(t);o.stop(t+dur+.02);
  },
  // توليد ضوضاء بيضاء (White Noise) للمؤثرات مثل الانفجارات أو إطلاق الخرطوش
  noise(dur=.05,vol=.05){
    if(this.muted)return;this.ensure();
    const n=this.ac.createBufferSource(),len=this.ac.sampleRate*dur,buf=this.ac.createBuffer(1,len,this.ac.sampleRate),a=buf.getChannelData(0);
    for(let i=0;i<len;i++)a[i]=(Math.random()*2-1)*(1-i/len);
    n.buffer=buf;const g=this.ac.createGain();g.gain.value=vol*this.gain("sfx");n.connect(g).connect(this.ac.destination);n.start();
  },
  // مؤثرات صوتية لأحداث اللعبة المختلفة
  shoot(){this.tone(170,.045,"square",.08)},
  shotgun(){this.noise(.08,.09);this.tone(95,.1,"sawtooth",.06)},
  hit(){this.tone(95,.05,"sawtooth",.08)},
  crit(){this.tone(880,.07,"triangle",.09);this.tone(1100,.11,"triangle",.07,.0,"sfx",.07)},
  dash(){this.tone(300,.07,"sawtooth",.05);this.tone(520,.09,"triangle",.05,.0,"sfx",.05)},
  coin(){this.tone(740,.06,"square",.05);this.tone(980,.09,"square",.05,"sfx",.055)},
  pickup(){this.tone(520,.08,"triangle",.06);this.tone(780,.12,"triangle",.05,"sfx",.06)},
  buy(){this.tone(440,.07,"triangle",.07);this.tone(660,.09,"triangle",.07,"sfx",.07)},
  level(){[440,554,659,880].forEach((n,i)=>this.tone(n,.13,"square",.05,"sfx",i*.07))},
  hurt(){this.tone(75,.09,"sawtooth",.08)},
  boost(){this.tone(520,.08,"triangle",.07);this.tone(780,.10,"triangle",.06,"sfx",.06);this.tone(1040,.12,"sine",.045,"sfx",.12)},
  warning(){this.tone(180,.09,"square",.06);this.tone(120,.12,"square",.05,"sfx",.11)},
  elite(){this.tone(260,.10,"sawtooth",.055);this.tone(390,.16,"triangle",.06,"sfx",.08)},
  combo(){this.tone(620,.045,"square",.045);this.tone(930,.065,"square",.04,"sfx",.055)},
  boss(){this.tone(70,.4,"sawtooth",.09,"sfx");this.tone(52,.55,"sawtooth",.06,"sfx",.16)},
  room(){this.tone(330,.08,"square",.05);this.tone(494,.1,"square",.05,"sfx",.07)},
  weaponSwitch(){this.tone(280,.045,"square",.045);this.tone(420,.07,"triangle",.04,"sfx",.045)},
  impactSmall(){this.tone(125,.035,"square",.035)},
  impactHeavy(){this.noise(.055,.055);this.tone(82,.09,"sawtooth",.05)},
  chain(){this.tone(700,.045,"sine",.045);this.tone(1050,.06,"triangle",.04,"sfx",.04)},
  // تشغيل الموسيقى الخلفية
  startMusic(){
    if(this.timer)return;this.ensure();
    const notes=[220,277,330,370,330,277,247,311,370,415,370,311];
    this.timer=setInterval(()=>{if(this.muted)return;const n=notes[this.step++%notes.length];this.tone(n,.24,"triangle",.02,"music");},270);
  },
  // إيقاف الموسيقى
  stopMusic(){clearInterval(this.timer);this.timer=null}
};

loadSettings(); // تحميل الإعدادات عند فتح اللعبة

// ==========================================
// 4. بيانات اللعبة: الأسلحة، الأعداء، الزعماء، الحوارات (Game Data)
// ==========================================

// تعريف الأسلحة وخصائصها (الضرر، سرعة الإطلاق، الانتشار، إلخ)
const WEAPONS={
 Blaster:{icon:"✦",color:"#fbbf24",d:19,rate:.16,speed:690,shots:1,spread:0,style:"BALANCED",desc:"Reliable all-round weapon."},
 Scattergun:{icon:"✹",color:"#fb923c",d:11,rate:.50,speed:560,shots:7,spread:.42,style:"BURST",desc:"Wide close-range damage."},
 VoltSMG:{icon:"◈",color:"#60a5fa",d:8,rate:.062,speed:760,shots:1,spread:.08,style:"RAPID",desc:"High fire rate, easy to dodge with."},
 "Rail Lance":{icon:"┃",color:"#c084fc",d:70,rate:.85,speed:1250,shots:1,spread:0,style:"PRECISION",desc:"Massive single-shot piercing hit."},
 "Arc Wand":{icon:"✦",color:"#34d399",d:25,rate:.34,speed:520,shots:3,spread:.34,style:"CHAIN",desc:"Triple arc bolts with strong spread."},
 "Frost Cannon":{icon:"❄",color:"#7dd3fc",d:31,rate:.38,speed:490,shots:1,spread:0,style:"CONTROL",desc:"Heavy shots with slow effect."}
};

// تعريف أنواع الأعداء وخصائصهم (الصحة، السرعة، الضرر، إلخ)
const ENEMIES={
 grunt:{name:"Grunt",r:15,hp:44,sp:66,c:"#ef4444",d:10,score:10},
 runner:{name:"Runner",r:10,hp:27,sp:135,c:"#fb923c",d:8,score:12},
 shooter:{name:"Shooter",r:13,hp:40,sp:58,c:"#06b6d4",d:12,score:15},
 tank:{name:"Tank",r:21,hp:118,sp:39,c:"#64748b",d:19,score:22},
 mage:{name:"Mage",r:15,hp:58,sp:53,c:"#ec4899",d:15,score:20},
 splitter:{name:"Splitter",r:17,hp:70,sp:72,c:"#a3e635",d:13,score:24}
};

// قائمة الزعماء (Bosses)
const BOSSES=[
 {name:"IRON GOLEM",kind:"golem",hp:780,sp:42,c:"#94a3b8"},
 {name:"VOID WITCH",kind:"witch",hp:640,sp:54,c:"#a78bfa"},
 {name:"FLAME BEAST",kind:"beast",hp:850,sp:68,c:"#fb923c"}
];

// نصوص القصة والحوارات في اللعبة
const STORY={
  intro:[
    {speaker:"RAGNAR",role:"VETERAN WARDEN",portrait:"R",text:"The Crown Seal broke three nights ago. Since then, the dungeon has been waking room by room."},
    {speaker:"RAGNAR",role:"VETERAN WARDEN",portrait:"R",text:"The old wards are failing. Creatures that were once trapped below are moving toward the surface."},
    {speaker:"THE WARDEN",role:"LAST LINE OF THE GATE",portrait:"W",text:"Then I go below before they reach the kingdom."},
    {speaker:"RAGNAR",role:"VETERAN WARDEN",portrait:"R",text:"Take the Ember Sigil. Learn the enemy's rhythm. Strike when they expose themselves, and survive long enough to reach the throne vault."}
  ],
  mira:[
    {speaker:"MIRA",role:"KEEPER OF THE MARKET",portrait:"M",text:"You made it back. That means the dungeon hasn't broken you yet."},
    {speaker:"MIRA",role:"KEEPER OF THE MARKET",portrait:"M",text:"Coin buys steel. Steel buys time. And in the lower halls, time is the most expensive thing you own."},
    {speaker:"THE WARDEN",role:"LAST LINE OF THE GATE",portrait:"W",text:"Keep something useful on the counter. I'll be back when the next door opens."}
  ],
  boss:[
    {speaker:"THE WARDEN",role:"LAST LINE OF THE GATE",portrait:"W",text:"So this is what has been calling the creatures upward."},
    {speaker:"THE SEAL",role:"VOICE FROM THE VOID",portrait:"S",text:"The kingdom forgot the promise beneath its throne."},
    {speaker:"THE WARDEN",role:"LAST LINE OF THE GATE",portrait:"W",text:"Then I'll remember it for them."}
  ],
  ending:[
    {speaker:"RAGNAR",role:"A VOICE ABOVE",portrait:"R",text:"The gate is open. The dawn can finally see the valley again."},
    {speaker:"MIRA",role:"KEEPER OF THE MARKET",portrait:"M",text:"You went in as a fighter. You came back carrying the kingdom's last piece of hope."},
    {speaker:"THE WARDEN",role:"LAST LINE OF THE GATE",portrait:"W",text:"This was only the first vault. Whatever is deeper down heard us open the door."}
  ]
};
let dialogueState={queue:[],index:0,onDone:null,chapter:""}; // حالة الحوار الحالي

// الترقيات الدائمة (Meta Upgrades) التي يتم شراؤها بين المحاولات
const META_UPGRADES=[
 ["hp","VITALITY","+15 Max HP",12,6],
 ["damage","POWER","+4 weapon damage",16,6],
 ["speed","AGILITY","+8 move speed",15,6],
 ["fire","QUICK HANDS","-0.012s weapon cooldown",20,7],
 ["armor","ARMOR","-4% contact/projectile damage",25,7],
 ["luck","LUCK","+5% drop chance",28,8],
 ["dash","DASH CORE","Dash cooldown -0.08s",22,7],
 ["regen","FIELD REGEN","+1 HP every 2 sec",30,8]
];
const metaDefault={coins:0,hp:0,damage:0,speed:0,fire:0,armor:0,luck:0,dash:0,regen:0,bestRoom:0,lifetimeKills:0};
let META={...metaDefault};
try{META={...metaDefault,...JSON.parse(localStorage.getItem("db_meta")||"{}")}}catch{}

// ==========================================
// 5. حالة اللعبة الكلية (Global Game State: S)
// ==========================================

const S={
  running:false,room:0,coins:0,kills:0,score:0,level:1,xp:0,nextXp:100,combo:0,comboTimer:0,
  seed:0,rooms:[],cur:0,visited:new Set(),completed:new Set(),shake:0,flash:0,
  luck:0,weaponLevels:{},difficulty:1,eliteCount:0,boosts:[],
  p:{},enemies:[],bullets:[],enemyBullets:[],particles:[],texts:[],drops:[],walls:[],
  chest:null,npc:null,boss:null,door:null,event:null,roomStart:0,dashAvailable:true,dashCd:0,dashTime:0,
  bgPulse:0,
  combatPhase:"ready",combatTimer:0,combatCycle:0,combatActive:false,
  storyFlags:{intro:false,mira:false,boss:false,ending:false}
};

// مولد أرقام عشوائية شبة منتظم يعتمد على البذرة (Seed)
function rng(seed){let t=seed>>>0;return()=>{t+=0x6D2B79F5;let r=Math.imul(t^t>>>15,1|t);r^=r+Math.imul(r^r>>>7,61|r);return((r^r>>>14)>>>0)/4294967296}}
let R=Math.random;

// تحديث الإحصائيات المجهزة في القائمة الرئيسية
function menuStats(){
 $("menuMetaCoins").textContent=META.coins||0;
 $("menuBestRoom").textContent=META.bestRoom||0;
 $("menuKills").textContent=META.lifetimeKills||0;
 $("continueState").textContent=localStorage.getItem("db_run")?"SAVE FOUND":"NO SAVE";
}
menuStats();

// تفريغ الكائنات المؤقتة عند الانتقال بين الغرف
function resetTransient(){
 S.enemies=[];S.bullets=[];S.enemyBullets=[];S.particles=[];S.texts=[];S.drops=[];
 S.chest=null;S.npc=null;S.boss=null;S.door=null;S.event=null;S.walls=[];
}

// إنشاء الخريطة والغرف عشوائياً بناءً على Seed
function generateWorld(){
  S.seed=Math.floor(Math.random()*1e9);R=rng(S.seed);S.rooms=[];
  const occupied=new Set(["0,0"]);
  S.rooms.push({id:0,x:0,y:0,type:"start",depth:0,cleared:false});
  for(let i=1;i<34;i++){
    const parent=S.rooms[Math.floor(R()*S.rooms.length)];
    const dirs=[[1,0],[-1,0],[0,1],[0,-1]].sort(()=>R()-.5);
    let placed=false;
    for(const [dx,dy] of dirs){
      const x=parent.x+dx,y=parent.y+dy,k=x+","+y;
      if(Math.abs(x)>7||Math.abs(y)>7||occupied.has(k))continue;
      occupied.add(k);S.rooms.push({id:i,x,y,type:"combat",depth:i,parent:parent.id,cleared:false});placed=true;break;
    }
    if(!placed)i--;
    if(S.rooms.length>=34)break;
  }
  // تحديد أدوية وتخصصات الغرف (متجر، كنز، زعيم، أحداث)
  const candidates=S.rooms.slice(1).sort((a,b)=>b.depth-a.depth);
  if(candidates[0])candidates[0].type="boss";
  if(candidates[1])candidates[1].type="treasure";
  if(candidates[2])candidates[2].type="shop";
  if(candidates[3])candidates[3].type="event";
  if(candidates[4])candidates[4].type="shop";
  if(candidates[5])candidates[5].type="treasure";
  for(let i=6;i<candidates.length;i++) if(R()<.09)candidates[i].type="secret";
  S.visited=new Set([0]);S.completed=new Set();
}

// إيجاد موقع فارغ عشوائي للترسيب (Spawn) لا يتداخل مع الجدران أو اللاعب
function randomFree(radius=22){
  for(let i=0;i<120;i++){
    const x=100+R()*(W-200),y=125+R()*(H-175);
    if(Math.hypot(x-S.p.x,y-S.p.y)<160)continue;
    if(!S.walls.some(w=>circleRect(x,y,radius,w)))return{x,y};
  }
  return{x:200,y:180};
}

// اختبرا التصادم بين دائرة ومستطيل (مفيد لتصادم الأعداء/الطلقات مع الجدران)
function circleRect(x,y,r,w){
  const cx=Math.max(w.x,Math.min(x,w.x+w.w)),cy=Math.max(w.y,Math.min(y,w.y+w.h));
  return (x-cx)**2+(y-cy)**2<r*r;
}

// بناء جدران الغرفة بناءً على أنماط مسبقة التحديد
function makeWalls(){
  S.walls=[];
  const add=(x,y,w,h)=>S.walls.push({x,y,w,h});
  const pattern=(S.cur+S.seed)%5;
  if(pattern===0){add(260,225,180,24);add(840,225,180,24);add(260,470,180,24);add(840,470,180,24)}
  if(pattern===1){add(330,180,26,250);add(925,180,26,250);add(505,330,270,28)}
  if(pattern===2){add(260,205,175,25);add(845,205,175,25);add(480,470,320,25);add(420,300,25,180);add(835,300,25,180)}
  if(pattern===3){add(250,315,190,28);add(840,315,190,28);add(600,190,28,165);add(600,420,28,165)}
  if(pattern===4){add(300,210,120,28);add(860,210,120,28);add(300,470,120,28);add(860,470,120,28);add(585,275,110,28);add(585,415,110,28)}
}

// ==========================================
// 6. إدارة الغرف، الأعداء، وبدء المحاولات (Room Management & Game Flow)
// ==========================================

// الدخول إلى غرفة جديدة وتهيئة محتوياتها
function enterRoom(id){
  const room=S.rooms[id];if(!room)return;
  resetTransient();S.cur=id;S.room=(S.progress||0);S.visited.add(id);S.roomStart=performance.now();
  S.p.x=640;S.p.y=600;S.p.inv=S.p.inv||["Potion","Bomb"];
  makeWalls();
  S.combatPhase = (room.type==="combat"||room.type==="boss") ? "ready" : "explore";
  S.combatTimer = (room.type==="boss") ? 3.2 : 2.8;
  if($('combatPhaseHud')) $('combatPhaseHud').style.display=(S.combatPhase==="explore"?"none":"block");
  S.combatCycle = 0;
  S.combatActive = false;
  const type=room.type;
  $("roomLabel").textContent=type.toUpperCase()+" · ROOM "+(S.room+1);
  S.event=null;
  if(type==="shop"){S.npc={x:640,y:315};room.cleared=true;S.door={x:640,y:110};}
  else if(type==="treasure"||type==="secret"){S.chest={x:640,y:340,open:room.cleared};if(room.cleared)S.door={x:640,y:110};}
  else if(type==="event"){S.event={x:640,y:340,kind:R()<.5?"blessing":"gamble",used:room.cleared};if(room.cleared)S.door={x:640,y:110};}
  else if(type==="boss"){
    const b=BOSSES[id%3],scale=1.35+Math.floor(id/5)*.12+Math.max(0,S.level-1)*.04;
    S.boss={x:640,y:310,r:48,hp:b.hp*scale,maxHp:b.hp*scale,sp:b.sp*(1+id*.006),c:b.c,kind:b.kind,name:b.name,t:1.6,phase:1,attackIndex:0,mode:"defense",phaseTimer:2.2,hitFlash:0,contactCd:0,enrage:false,telegraph:0};
  }else{
    const count=5+Math.min(13,Math.floor(id*.55)+Math.floor(R()*5));
    const keys=Object.keys(ENEMIES);
    for(let i=0;i<count;i++){
      let type=keys[Math.floor(R()*keys.length)];
      if(id<2 && (type==="splitter"||type==="tank")) type="grunt";
      spawnEnemy(type);
    }
  }
  updateObjective();
  if(type==="combat"||type==="boss"){
    AudioSys.room();
    showToast(type==="boss"?"THE DUNGEON HOLDS ITS BREATH · PREPARE":"ROOM ENTRY · PREPARE FOR THE ATTACK",2800);
  }else{
    AudioSys.room();
    showToast(type==="shop"?"Mira is here. Press E.":type==="treasure"?"A chest is waiting.":type==="event"?"A strange altar waits.":"Defeat every enemy to unlock the exit.",2300);
  }
  saveRun();
  queueRoomStory(type,id);
}

// إنشاء عدو جديد في الغرفة
function spawnEnemy(type,x=null,y=null){
  const d=ENEMIES[type],p={x,y};
  if(x===null){const q=randomFree(d.r+8);p.x=q.x;p.y=q.y}
  const difficulty=1+S.room*.048+Math.floor(S.room/5)*.08;
  const elite=(S.room>=5 && R()<Math.min(.16,.035+S.room*.0025));
  const scale=difficulty*(elite?1.62:1);
  const initialDelay=.35+R()*.9;
  S.enemies.push({
    x:p.x,y:p.y,r:d.r*(elite?1.12:1),hp:d.hp*scale,maxHp:d.hp*scale,sp:d.sp*(elite?1.08:1),c:d.c,d:d.d*difficulty*(elite?1.35:1),type,
    t:initialDelay,slow:0,hitFlash:0,mode:"defense",modeTimer:1.2+R()*1.0,
    contactCd:.25+R()*.4,dashWindup:0,dashTime:0,phaseOffset:R()*1.4,elite
  });
  if(elite){S.eliteCount++;AudioSys.elite();}
}

// تطبيق الترقيات الدائمة على خصائص اللاعب عند بدء المحاولة
function applyMeta(){
  const maxHp=100+META.hp*15;
  S.p={x:640,y:600,r:15,hp:maxHp,maxHp,spd:185+META.speed*8,weapon:"Blaster",cool:0,inv:["Potion","Bomb"],bombCount:1,
    damageBonus:META.damage*4,fireBonus:META.fire*.012,armor:Math.min(.45,META.armor*.04),regen:META.regen*.5,
    dashCdMax:1.2-META.dash*.08,dashCd:0,dashAvailable:true,dashTimer:0,magnetTimer:0,
    boostDamage:1,boostFire:0,boostSpeed:1,shieldTimer:0,rageTimer:0,hasteTimer:0,speedTimer:0,boostPulse:0,recoil:0,weaponFlash:0};
}

// بدء محاولة لعب جديدة بالكامل
function newRun(){
  AudioSys.ensure();AudioSys.startMusic();
  generateWorld();Object.assign(S,{running:true,room:0,coins:0,kills:0,score:0,level:1,xp:0,nextXp:100,combo:0,comboTimer:0,luck:0,weaponLevels:{},difficulty:1,eliteCount:0,boosts:[],shake:0,flash:0,roomClearedPending:false,_autosave:0,storyFlags:{intro:false,mira:false,boss:false,ending:false}});
  applyMeta();hideAllScreens();enterRoom(0);
  $("hud").classList.remove("hidden");$("bossHud").classList.add("hidden");
  updateHUD();
}

// إخفاء جميع الشاشات
function hideAllScreens(){SCREENS.forEach(id=>{const el=$(id);if(el)el.classList.remove("active")});}

// حفظ تقدم المحاولة الحالية في LocalStorage
function saveRun(){
  if(!S.running)return;
  const payload={progress:S.progress||0,relics:(typeof ENDGAME!=="undefined"?ENDGAME.relics:[]),seed:S.seed,rooms:S.rooms,cur:S.cur,visited:[...S.visited],completed:[...S.completed],coins:S.coins,kills:S.kills,score:S.score,level:S.level,xp:S.xp,nextXp:S.nextXp,combo:S.combo,luck:S.luck,weaponLevels:S.weaponLevels,p:{...S.p},storyFlags:{...S.storyFlags},timestamp:Date.now()};
  localStorage.setItem("db_run",JSON.stringify(payload));
  menuStats();
}

// تحميل المحاولة المحفوظة سابقاً
function loadRun(){
  let d;try{d=JSON.parse(localStorage.getItem("db_run")||"null")}catch{}
  if(!d){newRun();return}
  S.seed=d.seed||Math.floor(Math.random()*1e9);R=rng(S.seed);S.rooms=d.rooms||[];S.cur=d.cur||0;S.visited=new Set(d.visited||[0]);S.completed=new Set(d.completed||[]);
  S.coins=d.coins||0;S.kills=d.kills||0;S.score=d.score||0;S.level=d.level||1;S.xp=d.xp||0;S.nextXp=d.nextXp||100;S.combo=d.combo||0;S.luck=d.luck||0;S.weaponLevels=d.weaponLevels||{};S.storyFlags={intro:false,mira:false,boss:false,ending:false,...(d.storyFlags||{})};
  applyMeta();S.p={...S.p,...d.p};S.running=true;enterRoom(S.cur);$("hud").classList.remove("hidden");hide("mainMenu");AudioSys.ensure();AudioSys.startMusic();showToast("Run restored.",1600);updateHUD();
}

// الحفظ والخروج إلى القائمة الرئيسية
function saveAndQuit(){saveRun();S.running=false;AudioSys.stopMusic();$("hud").classList.add("hidden");$("bossHud").classList.add("hidden");show("mainMenu");menuStats()}
// إنهاء المحاولة والخروج
function quitRun(){localStorage.removeItem("db_run");S.running=false;AudioSys.stopMusic();$("hud").classList.add("hidden");$("bossHud").classList.add("hidden");show("mainMenu");menuStats()}

// التحقق مما إذا كان بالإمكان تحديث اللعبة (ليست في حالة توقف أو واجهة مفتوحة)
function canUpdateGame(){
  if(!S.running)return false;
  const blocked=["routeOverlay","achievementsOverlay","pauseMenu","mapOverlay","inventory","roomReward","shop","gameOver","settingsMenu","upgradeMenu","arsenalMenu","mainMenu"];
  return !blocked.some(id=>{const el=$(id);return !!el&&el.classList.contains("active")});
}

// ==========================================
// 7. الحلقة البرمجية الرئيسية للترقية والحسابات (Update Loop)
// ==========================================

// تحديث كافة عناصر اللعبة ل كل إطار (Frame)
function update(dt,now){
  S.bgPulse=now*.001;
  if(!canUpdateGame())return;

  // تحديث مرحلة القتال (هجوم / دفاع)
  updateCombatPhase(dt,now);

  // حركة اللاعب بواسطة المفاتيح WASD أو الأسهم
  let dx=(keys.d?1:0)-(keys.a?1:0),dy=(keys.s?1:0)-(keys.w?1:0);
  if(keys.arrowleft)dx-=1;if(keys.arrowright)dx+=1;if(keys.arrowup)dy-=1;if(keys.arrowdown)dy+=1;
  if(dx||dy){const l=Math.hypot(dx,dy);moveEntity(S.p,dx/l*S.p.spd*S.p.boostSpeed*dt,dy/l*S.p.spd*S.p.boostSpeed*dt)}

  // تحديث العدادات الزمانية للاعب والكومبو
  S.p.cool-=dt;S.p.dashCd-=dt;S.comboTimer-=dt;S.p.muzzle=Math.max(0,(S.p.muzzle||0)-dt);
  S.p.weaponFlash=Math.max(0,(S.p.weaponFlash||0)-dt);
  updateBoosts(dt);S.p.recoil=Math.max(0,(S.p.recoil||0)-dt);
  if(S.comboTimer<=0)S.combo=0;
  if(mouse.down)shoot(); // الإطلاق عند ضغط الفأرة
  if(S.p.regen>0)S.p.regenTick=(S.p.regenTick||0)+dt;
  if(S.p.regenTick>=2){S.p.regenTick=0;S.p.hp=Math.min(S.p.maxHp,S.p.hp+META.regen*.5)}

  // تحديث حالة الأسلحة، الأعداء، المقذوفات، والترسبات
  updateDashTrail(dt);
  updateBullets(dt);
  updateEnemies(dt);
  S.enemies=S.enemies.filter(e=>e.hp>0);
  updateBoss(dt);
  updateDrops(dt);
  updateParticles(dt);
  updateTexts(dt);

  // التحقق من إنهاء الغرفة عادي أو غرفة الزعيم
  const nonBossRoom=S.rooms[S.cur]?.type!=="boss";
  if(nonBossRoom && S.enemies.length===0 && !S.completed.has(S.cur) && !S.roomClearedPending && S.combatPhase!=="ready"){
    roomCleared();
  }
  if(S.boss===null && S.rooms[S.cur]?.type==="boss" && !S.completed.has(S.cur) && !S.roomClearedPending && S.combatPhase!=="ready"){
    roomCleared(true);
  }
  if(S.p.hp<=0)die(); // موت اللاعب

  // الترقية عند اكتمال نقاط الخبرة (XP)
  if(S.xp>=S.nextXp){
    S.xp-=S.nextXp;S.level++;S.nextXp=Math.floor(S.nextXp*1.28);
    S.p.maxHp+=7;S.p.hp=S.p.maxHp;S.p.spd+=2;
    AudioSys.level();showLevelToast("LEVEL UP · FULL HEAL");
    spawnBurst(S.p.x,S.p.y,"#c084fc",30);S.shake=Math.max(S.shake,12);
  }
  updateHUD();
  if(S.flash>0)S.flash-=dt;if(S.shake>0)S.shake=Math.max(0,S.shake-dt*18);
  if(Math.floor(now/2500)!==S._autosave){S._autosave=Math.floor(now/2500);saveRun()}
}

// إدارة مرحلة القتال (الاستعداد، الهجوم، والدفاع للأعداء)
function updateCombatPhase(dt,now){
  const type=S.rooms[S.cur]?.type;
  if(type!=="combat"&&type!=="boss") {
    S.combatPhase="explore"; S.combatActive=true;
    if($('combatPhaseHud')) $('combatPhaseHud').style.display="none";
    return;
  }
  S.combatTimer-=dt;
  if(!S.combatActive){
    if(S.combatTimer<=0){
      S.combatActive=true;
      S.combatCycle=0;
      S.combatPhase=(type==="boss")?"attack":"attack";
      S.combatTimer= type==="boss" ? 4.2 : 4.0;
      for(const e of S.enemies){e.mode="attack";e.modeTimer=.8+R()*.8}
      showToast("⚔ ATTACK PHASE · ENGAGE",1100);
      S.shake=Math.max(S.shake,3);AudioSys.tone(260,.08,"square",.04);
    }
  }else{
    if(S.combatTimer<=0){
      S.combatPhase=S.combatPhase==="attack"?"defense":"attack";
      S.combatCycle++;
      S.combatTimer=S.combatPhase==="attack"?4.0:(type==="boss"?2.8:2.5);
      for(const e of S.enemies){e.mode=S.combatPhase;e.modeTimer=.7+R()*1.0;e.contactCd=Math.max(e.contactCd||0,0.25)}
      if(S.boss)S.boss.mode=S.combatPhase;
      showToast(S.combatPhase==="attack"?"⚔ ENEMY ATTACK · PRESSURE ON":"🛡 ENEMY DEFENSE · FIND AN OPENING",1100);
      AudioSys.tone(S.combatPhase==="attack"?360:190,.10,"triangle",.035);
    }
  }
  const left=Math.max(0,S.combatTimer);
  $("combatPhase").textContent=S.combatPhase==="ready"?"GET READY":S.combatPhase==="attack"?"ENEMY ATTACK":"ENEMY DEFENSE";
  $("combatPhase").dataset.state=S.combatPhase;
  $("combatTimer").textContent=S.combatPhase==="ready"?Math.max(0,left).toFixed(1):left.toFixed(1);
  $("combatHint").textContent=S.combatPhase==="ready"?"The room is quiet… prepare your position.":S.combatPhase==="attack"?"Enemies commit to the attack. Use cover and dash.":"Enemies are guarding and repositioning. Punish openings.";
}

// تحريك الكيانات خطوة بخطوة مع فحص التصادم بالجدران والحدود
function moveEntity(o,dx,dy){
  const maxStep=5.5;
  const steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/maxStep));
  const sx=dx/steps,sy=dy/steps;
  for(let i=0;i<steps;i++){
    const nx=o.x+sx;
    if(nx>35&&nx<W-35&&!S.walls.some(w=>circleRect(nx,o.y,o.r,w)))o.x=nx;
    const ny=o.y+sy;
    if(ny>86&&ny<H-35&&!S.walls.some(w=>circleRect(o.x,ny,o.r,w)))o.y=ny;
  }
}

// تفعيل حركة الاندفاع السريع (Dash) للاعب
function dash(){
  if(!S.running||!canUpdateGame()||S.p.dashCd>0)return;
  let dx=(keys.d?1:0)-(keys.a?1:0),dy=(keys.s?1:0)-(keys.w?1:0);
  if(!dx&&!dy){
    const a=Math.atan2(mouse.y-S.p.y,mouse.x-S.p.x);dx=Math.cos(a);dy=Math.sin(a)
  }else{const l=Math.hypot(dx,dy);dx/=l;dy/=l}
  for(let i=0;i<9;i++){moveEntity(S.p,dx*13,dy*13);spawnParticle(S.p.x-dx*10,S.p.y-dy*10,"#22d3ee",.18)}
  S.p.dashCd=Math.max(.28,S.p.dashCdMax);S.shake=Math.max(S.shake,5);AudioSys.dash();flash(.08)
}

// تحديث أثر حركة الاندفاع
function updateDashTrail(dt){
  if(S.p.dashCd<=0)S.dashAvailable=true;else S.dashAvailable=false;
}

// تبديل السلاح مع انتقال سريع وواضح للاعب
function cycleWeapon(dir=1){
  if(!S.running||!canUpdateGame())return;
  const names=Object.keys(WEAPONS);
  let i=Math.max(0,names.indexOf(S.p.weapon));
  i=(i+dir+names.length)%names.length;
  S.p.weapon=names[i];
  S.p.cool=Math.min(S.p.cool,0.04);
  S.p.weaponFlash=.28;
  AudioSys.ensure();AudioSys.weaponSwitch();
  showToast(`${WEAPONS[S.p.weapon].icon} ${S.p.weapon.toUpperCase()} · ${WEAPONS[S.p.weapon].style}`,850);
  updateHUD();
}

// آلية إطلاق النار من قبل اللاعب
function shoot(){
  if(S.p.cool>0)return;
  if(S.combatPhase==="ready" && (S.rooms[S.cur]?.type==="combat"||S.rooms[S.cur]?.type==="boss"))return;
  const w=WEAPONS[S.p.weapon],bonus=S.p.damageBonus||0;
  S.p.cool=Math.max(.028,(w.rate-(S.p.fireBonus||0))*(1-Math.min(.45,S.p.boostFire||0))*(S.p.overdriveTimer>0?.80:1));
  let a=Math.atan2(mouse.y-S.p.y,mouse.x-S.p.x);
  const baselineCrit=(S.p.critTimer>0?.25:.08)+(S.p.critChance||0);
  for(let i=0;i<w.shots;i++){
    const aa=a+(i-(w.shots-1)/2)*w.spread;
    let damage=(w.d+(S.weaponLevels[S.p.weapon]||0)*3+bonus)*(S.p.boostDamage||1);
    const crit=Math.random()<baselineCrit;
    if(crit)damage*=1.65;
    S.bullets.push({x:S.p.x,y:S.p.y,vx:Math.cos(aa)*w.speed,vy:Math.sin(aa)*w.speed,r:w===WEAPONS["Rail Lance"]?5:4,d:damage,life:1.3,c:w.color,pierce:w===WEAPONS["Rail Lance"]?3:0,trail:[],crit,chain:w===WEAPONS["Arc Wand"],weapon:S.p.weapon,hit:new Set()});
  }
  S.p.muzzle=.08;S.p.recoil=.08;
  if(S.p.weapon==="Rail Lance")S.shake=Math.max(S.shake,3);
  if(S.p.weapon==="Scattergun")S.shake=Math.max(S.shake,2);
  if(S.combo>=10&&Math.random()<.12)AudioSys.combo();
  AudioSys[S.p.weapon==="Scattergun"?"shotgun":"shoot"]();
}


function chainArc(source,b){
  const candidates=S.enemies.filter(e=>e.hp>0&&e!==source&&Math.hypot(e.x-source.x,e.y-source.y)<145);
  candidates.sort((a,c)=>Math.hypot(a.x-source.x,a.y-source.y)-Math.hypot(c.x-source.x,c.y-source.y));
  const target=candidates[0];
  if(!target)return;
  damageEnemy(target,b.d*.38,target);
  target.hitFlash=.14;
  addRing(target.x,target.y,"#34d399",12);
  spawnBurst(target.x,target.y,"#34d399",7);
  AudioSys.chain();
}

// تحديث طلقات اللاعب واختبار تصادمها مع الأعداء والعدو الرئيسي والجدران
function updateBullets(dt){
  for(const b of S.bullets){
    b.trail=b.trail||[];
    b.trail.push({x:b.x,y:b.y,life:.16});
    if(b.trail.length>5)b.trail.shift();
    for(const tr of b.trail)tr.life-=dt;
    b.trail=b.trail.filter(tr=>tr.life>0);
    const dist=Math.hypot(b.vx*dt,b.vy*dt);
    const steps=Math.max(1,Math.ceil(dist/4.5));
    const sx=b.vx*dt/steps,sy=b.vy*dt/steps;
    b.hit=b.hit||new Set();
    for(let step=0;step<steps && b.life>0;step++){
      b.x+=sx;b.y+=sy;b.life-=dt/steps;
      if(S.walls.some(w=>circleRect(b.x,b.y,b.r,w))){b.life=0;spawnParticle(b.x,b.y,"#94a3b8",.14);break;}
      for(const e of S.enemies){
        if(e.hp<=0||b.hit.has(e))continue;
        if(Math.hypot(b.x-e.x,b.y-e.y)<b.r+e.r){
          b.hit.add(e);
          const dead=damageEnemy(e,b.d,e);
          if(b.weapon==="Scattergun"){
            const ka=Math.atan2(e.y-b.y,e.x-b.x);moveEntity(e,Math.cos(ka)*18,Math.sin(ka)*18);
          }
          if(b.weapon==="Frost Cannon")e.slow=Math.max(e.slow,1.35);
          if(b.weapon==="Arc Wand") chainArc(e,b);
          if(b.crit){polishHit(e.x,e.y,"#fde68a",true);AudioSys.crit();}
          else if(b.weapon==="Rail Lance")AudioSys.impactHeavy();
          else AudioSys.impactSmall();
          b.pierce=(b.pierce??0)-1;
          if(b.weapon!=="Rail Lance" && b.pierce<0){b.life=0;break;}
          if(b.weapon==="Rail Lance" && b.pierce<0){b.life=0;break;}
        }
      }
      if(S.boss&&b.life>0&&Math.hypot(b.x-S.boss.x,b.y-S.boss.y)<b.r+S.boss.r){
        hitBoss(b.d);b.pierce=(b.pierce??0)-1;
        if(b.pierce<0)b.life=0;
      }
    }
  }
  S.bullets=S.bullets.filter(b=>b.life>0&&b.x>-20&&b.x<W+20&&b.y>70&&b.y<H+20);
}

// تحديث سلوك الأعداء، حركتهم وإطلاقهم النار حسب نوعهم ومرحلة القتال
function updateEnemies(dt){
  for(const e of S.enemies){
    if(e.hp<=0)continue;
    e.slow=Math.max(0,e.slow-dt);e.t-=dt;e.hitFlash=Math.max(0,e.hitFlash-dt);e.contactCd=Math.max(0,(e.contactCd||0)-dt);
    if(S.combatPhase==="ready"||S.combatPhase==="explore"){
      e.mode="defense";e.modeTimer=.4+Math.sin((e.phaseOffset||0)+S.bgPulse)*.2;
      continue;
    }
    e.mode=S.combatPhase;
    const a=Math.atan2(S.p.y-e.y,S.p.x-e.x),dist=Math.hypot(S.p.x-e.x,S.p.y-e.y);
    const slow=e.slow>0?.5:1;
    const phaseMult=e.mode==="attack"?1:.42;
    const speed=e.sp*slow*phaseMult;
    const perp={x:-Math.sin(a),y:Math.cos(a)};

    if(e.type==="shooter"||e.type==="mage"){
      if(e.mode==="attack"){
        if(dist>360)moveEntity(e,Math.cos(a)*speed*dt,Math.sin(a)*speed*dt);
        else if(dist<230)moveEntity(e,-Math.cos(a)*speed*dt,-Math.sin(a)*speed*dt);
        else moveEntity(e,perp.x*speed*.34*dt,perp.y*speed*.34*dt);
        if(e.t<=0){e.t=e.type==="mage"?1.55:1.9;enemyShot(e,a,e.type==="mage"?15:11)}
      }else{
        const drift=Math.sin(S.bgPulse*2.1+(e.phaseOffset||0))>0?1:-1;
        if(dist<315)moveEntity(e,-Math.cos(a)*speed*dt,-Math.sin(a)*speed*dt);
        moveEntity(e,perp.x*drift*speed*.55*dt,perp.y*drift*speed*.55*dt);
      }
    }else{
      if(e.mode==="attack"){
        if(e.type==="runner" && e.dashWindup<=0 && e.dashTime<=0 && dist<300 && dist>70 && e.t<=0){
          e.dashWindup=.42;e.dashTime=.17;e.t=2.8;
          showToast("⚠ RUNNER CHARGING",450);
        }
        if(e.dashWindup>0){
          e.dashWindup-=dt;
          if(e.dashWindup<=0)spawnBurst(e.x,e.y,e.c,8);
        }else if(e.dashTime>0){
          e.dashTime-=dt;moveEntity(e,Math.cos(a)*e.sp*3.0*dt,Math.sin(a)*e.sp*3.0*dt);
        }else if(dist>e.r+S.p.r+10){
          moveEntity(e,Math.cos(a)*speed*dt,Math.sin(a)*speed*dt);
        }
      }else{
        const drift=Math.sin(S.bgPulse*1.7+(e.phaseOffset||0))>0?1:-1;
        if(dist<160)moveEntity(e,-Math.cos(a)*speed*dt,-Math.sin(a)*speed*dt);
        moveEntity(e,perp.x*drift*speed*.42*dt,perp.y*drift*speed*.42*dt);
      }
    }

    // إحداث ضرر التصادم عند ملامسة اللاعب
    const contact=e.r+S.p.r+4,nowDist=Math.hypot(S.p.x-e.x,S.p.y-e.y);
    if(nowDist<contact){
      const nx=(S.p.x-e.x)/(nowDist||1),ny=(S.p.y-e.y)/(nowDist||1);
      moveEntity(e,-nx*(contact-nowDist+1),-ny*(contact-nowDist+1));
      if(e.mode==="attack"&&e.contactCd<=0){
        e.contactCd=e.type==="runner"?.9:.7;
        hurtPlayer(e.d,e);
        moveEntity(S.p,nx*18,ny*18);
      }
    }
  }
}

// توليد طلقات الأعداء
function enemyShot(e,a,d){
  const spread=e.type==="mage"?[-.22,0,.22]:[0];
  for(const s of spread)S.enemyBullets.push({x:e.x,y:e.y,vx:Math.cos(a+s)*290,vy:Math.sin(a+s)*290,r:5,d,life:3,c:e.c});
}

// تحديث الزعيم (Boss) وإدارته أثناء المعركة
function updateBoss(dt){
  if(!S.boss)return;
  if(S.combatPhase==="ready")return;
  const b=S.boss,a=Math.atan2(S.p.y-b.y,S.p.x-b.x),dist=Math.hypot(S.p.x-b.x,S.p.y-b.y);
  b.t-=dt;b.contactCd=Math.max(0,(b.contactCd||0)-dt);b.telegraph=Math.max(0,(b.telegraph||0)-dt);
  const hpRatio=b.hp/b.maxHp;
  b.phase=hpRatio<.33?3:(hpRatio<.66?2:1);
  const speed=b.sp*(b.phase===3?1.15:1)*(S.combatPhase==="defense"?.35:1);
  if(S.combatPhase==="defense"){
    if(dist<300)moveEntity(b,-Math.cos(a)*speed*dt,-Math.sin(a)*speed*dt);
    moveEntity(b,-Math.sin(a)*speed*.45*dt,Math.cos(a)*speed*.45*dt);
  }else if(b.kind==="witch"&&dist<280)moveEntity(b,-Math.cos(a)*speed*.75*dt,-Math.sin(a)*speed*.75*dt);
  else moveEntity(b,Math.cos(a)*speed*dt,Math.sin(a)*speed*dt);
  if(b.t<=0&&S.combatPhase==="attack"){
    b.t=b.kind==="golem"?(b.phase===3?.8:1.05):(b.kind==="witch"?(b.phase===3?.6:.9):(b.phase===3?.72:1.0));
    b.telegraph=.45;AudioSys.warning();
    if(b.kind==="golem"){
      const rings=b.phase===3?20:b.phase===2?16:12;for(let i=0;i<rings;i++)enemyShot(b,i*Math.PI*2/rings,b.phase===3?25:b.phase===2?21:17);
      if(b.phase>=2){spawnEnemy("runner",b.x+65,b.y);spawnEnemy("runner",b.x-65,b.y)}
    }else if(b.kind==="witch"){
      const spread=b.phase===3?.24:.18;for(let i=-3;i<=3;i++)enemyShot(b,a+i*spread,b.phase===3?25:b.phase===2?21:17);
      if(b.phase>=2){enemyShot(b,a+Math.PI/2,18);enemyShot(b,a-Math.PI/2,18)}
    }else{
      enemyShot(b,a,b.phase===3?32:b.phase===2?27:21);
      if(b.phase>=2){for(let i=0;i<6;i++)enemyShot(b,a+(i-2.5)*.28,b.phase===3?23:19)}
      if(b.phase===3){spawnEnemy("runner",b.x+55,b.y);spawnEnemy("shooter",b.x-55,b.y)}
    }
  }
  if(dist<b.r+S.p.r+12&&S.combatPhase==="attack"&&b.contactCd<=0){
    b.contactCd=.9;hurtPlayer(b.phase===3?32:24,b);moveEntity(S.p,Math.cos(a)*16,Math.sin(a)*16);
  }
  $("bossBar").style.width=(b.hp/b.maxHp*100)+"%";$("bossPhase").textContent="PHASE "+b.phase;
}

// تطبيق الضرر على الزعيم
function hitBoss(d){
  if(!S.boss)return;
  S.boss.hp-=d;S.combo=Math.min(99,S.combo+1);S.comboTimer=2.6;S.score+=Math.round(d*2);
  S.texts.push({x:S.boss.x,y:S.boss.y-55,text:Math.round(d),life:.6,color:d>=55?"#fde68a":"#fff",size:d>=55?18:12});
  spawnBurst(S.boss.x,S.boss.y,S.boss.c,4);AudioSys.hit();S.shake=Math.max(S.shake,2);
  if(S.boss.hp<=0){
    S.boss=null;S.completed.add(S.cur);S.rooms[S.cur].cleared=true;S.coins+=75+S.room*3;S.xp+=120;S.score+=1000;
    roomCleared(true);AudioSys.level();
  }
}

// تطبيق الضرر على العدو وحساب المكافآت أو الموت
function damageEnemy(e,d,src){
  const dealt=e.mode==="defense"?d*.55:d;
  e.hp-=dealt;e.hitFlash=.08;S.score+=Math.round(dealt*(1+S.combo*.01));S.combo=Math.min(99,S.combo+1);S.comboTimer=2.8;
  S.texts.push({x:e.x,y:e.y-e.r-8,text:Math.round(dealt),life:.55,color:dealt>=50?"#fde68a":"#fff",size:dealt>=50?16:11});
  spawnBurst(e.x,e.y,e.c,4);AudioSys.hit();
  if(e.hp<=0){
    S.kills++;S.score+=ENEMIES[e.type].score*(e.elite?3:1);
    const chance=.22+(S.luck+META.luck+(META.legend?1:0))*.05;
    if(Math.random()<chance)S.drops.push({x:e.x,y:e.y,type:Math.random()<.66?"coin":"Potion",life:12});
    if(e.elite||Math.random()<Math.min(.16,.025+S.room*.003)){
      const types=["RAGE","HASTE","SHIELD","FRENZY"];S.drops.push({x:e.x+8,y:e.y-8,type:types[Math.floor(R()*types.length)],life:14,bob:R()*6});
    }
    if(e.type==="splitter"){
      spawnEnemy("runner",e.x+18,e.y);spawnEnemy("runner",e.x-18,e.y);
    }
    return true;
  }
  return false;
}

// إلحاق الضرر باللاعب واحتساب الدروع
function hurtPlayer(amount,source){
  const shield=S.p.shieldTimer>0?.62:0;amount*=1-(S.p.armor||0);amount*=1-shield;
  S.p.hp-=amount;S.flash=Math.max(S.flash,.04);S.shake=Math.max(S.shake,S.p.shieldTimer>0?2:4);
  if(S.p.shieldTimer>0)spawnBurst(S.p.x,S.p.y,"#60a5fa",5);AudioSys.hurt();
}

// Temporary combat boosts dropped by enemies and elite enemies.
function activateBoost(type){
  const p=S.p,duration=type==="SHIELD"?7:type==="FRENZY"?9:8;
  if(type==="RAGE"){p.boostDamage=1.42;p.rageTimer=Math.max(p.rageTimer||0,duration)}
  if(type==="HASTE"){p.boostFire=.34;p.hasteTimer=Math.max(p.hasteTimer||0,duration)}
  if(type==="SHIELD")p.shieldTimer=Math.max(p.shieldTimer||0,duration);
  if(type==="FRENZY"){p.boostSpeed=1.32;p.speedTimer=Math.max(p.speedTimer||0,duration);p.boostDamage=Math.max(p.boostDamage||1,1.22);p.rageTimer=Math.max(p.rageTimer||0,duration)}
  p.boostPulse=.45;S.boosts=Array.from(new Set([...S.boosts,type]));AudioSys.boost();
  spawnBurst(p.x,p.y,type==="SHIELD"?"#60a5fa":type==="RAGE"?"#fb7185":"#fbbf24",22);S.shake=Math.max(S.shake,4);
  showToast(type==="RAGE"?"🔥 RAGE BOOST · DAMAGE +42%":type==="HASTE"?"⚡ HASTE BOOST · FIRE +34%":type==="SHIELD"?"🛡️ SHIELD BOOST · DAMAGE -62%":"💨 FRENZY BOOST · SPEED +32%",1500);
}
function updateBoosts(dt){
  const p=S.p;p.rageTimer=Math.max(0,(p.rageTimer||0)-dt);p.hasteTimer=Math.max(0,(p.hasteTimer||0)-dt);
  p.speedTimer=Math.max(0,(p.speedTimer||0)-dt);p.shieldTimer=Math.max(0,(p.shieldTimer||0)-dt);p.boostPulse=Math.max(0,(p.boostPulse||0)-dt);
  if(p.rageTimer<=0&&p.speedTimer<=0)p.boostDamage=1;else if(p.rageTimer<=0)p.boostDamage=1.22;
  p.boostFire=p.hasteTimer>0?.34:0;p.boostSpeed=p.speedTimer>0?1.32:1;S.boosts=[];
  if(p.rageTimer>0)S.boosts.push("🔥");if(p.hasteTimer>0)S.boosts.push("⚡");if(p.shieldTimer>0)S.boosts.push("🛡️");if(p.speedTimer>0)S.boosts.push("💨");
}
// تحديث العناصر الساقطة (Drops) والطلقات المعادية
function updateDrops(dt){
  for(const d of S.drops){
    d.life-=dt;let dist=Math.hypot(d.x-S.p.x,d.y-S.p.y);
    if(S.p.magnetTimer>0 && dist<260){let a=Math.atan2(S.p.y-d.y,S.p.x-d.x);d.x+=Math.cos(a)*240*dt;d.y+=Math.sin(a)*240*dt}
    if(dist<24){
      if(d.type==="coin"){S.coins+=5;AudioSys.coin();S.score+=20}
      else if(["RAGE","HASTE","SHIELD","FRENZY"].includes(d.type)){activateBoost(d.type)}
      else{S.p.inv.push("Potion");AudioSys.pickup()}
      d.dead=true;spawnBurst(d.x,d.y,["RAGE","HASTE","SHIELD","FRENZY"].includes(d.type)?(d.type==="SHIELD"?"#60a5fa":"#fbbf24"):(d.type==="coin"?"#fbbf24":"#34d399"),9);
    }
  }
  S.drops=S.drops.filter(d=>!d.dead&&d.life>0);
  for(const b of S.enemyBullets){
    const dist=Math.hypot(b.vx*dt,b.vy*dt);
    const steps=Math.max(1,Math.ceil(dist/4.5));
    const sx=b.vx*dt/steps,sy=b.vy*dt/steps;
    for(let i=0;i<steps && b.life>0;i++){
      b.x+=sx;b.y+=sy;b.life-=dt/steps;
      if(S.walls.some(w=>circleRect(b.x,b.y,b.r,w))){b.life=0;spawnParticle(b.x,b.y,"#64748b",.12);break;}
      if(Math.hypot(b.x-S.p.x,b.y-S.p.y)<b.r+S.p.r){b.life=0;hurtPlayer(b.d);spawnBurst(S.p.x,S.p.y,b.c,5);}
    }
  }
  S.enemyBullets=S.enemyBullets.filter(b=>b.life>0&&b.x>-20&&b.x<W+20&&b.y>70&&b.y<H+20)
}

// معالجة إنهاء الغرفة وتطهيرها من الأعداء
function roomCleared(boss=false){
  S.roomClearedPending=true;
  const room=S.rooms[S.cur];room.cleared=true;S.completed.add(S.cur);
  if(!boss){S.coins+=14+Math.floor(S.room*1.5);S.xp+=25;S.drops.push({x:S.p.x+28,y:S.p.y,type:"coin",life:12});showRunReward()}
  else{
    S.coins+=90+S.room*4;S.score+=2000;S.door={x:640,y:110};showToast("BOSS DEFEATED · EXIT UNLOCKED",3000);S.roomClearedPending=false;
  }
  S.door={x:640,y:110};updateObjective();saveRun();
}

// تحديث نص الهدف الحالي المكتوب في أعلى الواجهة
function updateObjective(){
  const t=S.rooms[S.cur]?.type;
  let obj="Defeat every enemy to unlock the exit.";
  if(t==="start")obj="Press E at the gate to descend. Find and slay the boss.";
  if(t==="shop")obj="Press E near Mira to open the shop.";
  if(t==="treasure")obj=S.chest?.open?"Exit unlocked.":"Press E near the chest.";
  if(t==="secret")obj=S.chest?.open?"Secret cleared.":"Press E to reveal the cache.";
  if(t==="event")obj=S.event?.used?"Exit unlocked.":"Press E at the altar.";
  if(t==="boss")obj="Defeat the boss to unlock the exit.";
  $("objective").textContent=obj;
  if($("combatPhase")&&S.combatPhase!=="explore") $("combatPhase").style.display="block";
}

// ==========================================
// 8. التفاعل والترقيات والأنظمة الفرعية (Interaction & Meta Systems)
// ==========================================

// التعامل مع زر التفاعل (E) للكنوز، المتاجر، البوابات، والمذابح
function interact(){
  if(!S.running||!canUpdateGame())return;
  if(S.npc&&Math.hypot(S.p.x-S.npc.x,S.p.y-S.npc.y)<90){openShop();return}
  if(S.chest&&!S.chest.open&&Math.hypot(S.p.x-S.chest.x,S.p.y-S.chest.y)<90){
    S.chest.open=true;S.rooms[S.cur].cleared=true;S.completed.add(S.cur);S.coins+=40+(META.vault?30:0);S.p.inv.push("Potion","Bomb");
    S.door={x:640,y:110};AudioSys.pickup();showToast("TREASURE FOUND · +40 COINS",1800);updateObjective();saveRun();return
  }
  if(S.event&&!S.event.used&&Math.hypot(S.p.x-S.event.x,S.p.y-S.event.y)<90){
    S.event.used=true;S.rooms[S.cur].cleared=true;S.completed.add(S.cur);S.door={x:640,y:110};
    if(S.event.kind==="blessing"){S.p.maxHp+=20;S.p.hp=S.p.maxHp;S.luck+=1;showToast("BLESSING · +20 MAX HP · +LUCK",2200)}
    else if(S.coins>=20){S.coins-=20;S.p.damageBonus=(S.p.damageBonus||0)+16;showToast("GAMBLE PAID OFF · +16 DAMAGE",2200)}
    else{S.coins+=10;showToast("POOR PAYOUT · +10 COINS",1700)}
    AudioSys.level();updateObjective();saveRun();return
  }
  if(S.door&&S.rooms[S.cur]?.type!=="boss"&&Math.hypot(S.p.x-S.door.x,S.p.y-S.door.y)<95){nextRoom();return}
  if(S.door&&S.rooms[S.cur]?.type==="boss"&&Math.hypot(S.p.x-S.door.x,S.p.y-S.door.y)<95){finalEscape();return}
}

// الانتقال للغرفة المجاورة
function nextRoom(){
  S.roomClearedPending=false;
  const here=S.rooms[S.cur];
  let adj=S.rooms.filter(r=>Math.abs(r.x-here.x)+Math.abs(r.y-here.y)===1);
  let unknown=adj.filter(r=>!S.visited.has(r.id));
  if(!unknown.length)unknown=adj;
  if(!unknown.length){showToast("No further path.",1500);return}
  enterRoom(unknown[Math.floor(R()*unknown.length)].id);
}

// الهروب النهائي عند هزيمة الزعيم الأخير
function finalEscape(){
  const reward=S.coins+Math.floor(S.score/50);
  META.coins=(META.coins||0)+reward;META.bestRoom=Math.max(META.bestRoom||0,S.room+1);META.lifetimeKills=(META.lifetimeKills||0)+S.kills;saveMeta();
  localStorage.removeItem("db_run");
  S.running=true;
  S.storyFlags.ending=true;
  openDialogue(STORY.ending,()=>completeRunScreen(reward));
}

// عرض شاشة الفوز وإتمام المحاولة
function completeRunScreen(reward){
  S.running=false;AudioSys.stopMusic();$("hud").classList.add("hidden");$("bossHud").classList.add("hidden");
  $("gameOverStats").textContent=`ESCAPED!  Score ${S.score.toLocaleString()}  •  ${S.kills} kills  •  ${reward} meta coins`;
  $("retryRun").onclick=newRun;show("gameOver");menuStats();
}

// عند موت اللاعب
function die(){
  META.coins=(META.coins||0)+Math.floor(S.coins*.7)+Math.floor(S.score/80);META.bestRoom=Math.max(META.bestRoom||0,S.room+1);META.lifetimeKills=(META.lifetimeKills||0)+S.kills;saveMeta();
  localStorage.removeItem("db_run");S.running=false;AudioSys.stopMusic();$("hud").classList.add("hidden");$("bossHud").classList.add("hidden");
  $("gameOverStats").textContent=`Score ${S.score.toLocaleString()}  •  ${S.kills} kills  •  reached room ${S.room+1}`;
  $("retryRun").onclick=newRun;show("gameOver");menuStats();
}

// إضافة الحوار القلبي الخاص بالغرفة
function queueRoomStory(type,id){
  if(type==="start" && !S.storyFlags.intro){
    openDialogue(STORY.intro,()=>{S.storyFlags.intro=true;saveRun();showToast("THE DESCENT BEGINS",1600)});
  }else if(type==="shop" && !S.storyFlags.mira){
    openDialogue(STORY.mira,()=>{S.storyFlags.mira=true;saveRun();showToast("MIRA'S MARKET IS OPEN",1400)});
  }else if(type==="boss" && !S.storyFlags.boss){
    openDialogue(STORY.boss,()=>{S.storyFlags.boss=true;saveRun();showToast("THE THRONE VAULT · PREPARE",1600)});
  }
}

// فتح نافذة الحوارات
function openDialogue(queue,onDone=null){
  dialogueState={queue,index:0,onDone,chapter:""};
  show("dialogueScreen");
  renderDialogueLine();
  AudioSys.ensure();
  AudioSys.tone(220,.12,"triangle",.035);
}

// عرض السطر الحالي من الحوار
function renderDialogueLine(){
  const d=dialogueState.queue[dialogueState.index];
  if(!d){closeDialogue();return}
  $("dialoguePortrait").textContent=d.portrait||d.speaker.charAt(0);
  $("dialogueSpeaker").textContent=d.speaker;
  $("dialogueRole").textContent=d.role;
  $("dialogueText").textContent=d.text;
  $("dialogueIndex").textContent=`${dialogueState.index+1} / ${dialogueState.queue.length}`;
  $("dialogueContinue").textContent=dialogueState.index===dialogueState.queue.length-1?"ENTER THE DUNGEON  ▶":"CONTINUE  ▶";
}

// إغلاق شاشة الحوار
function closeDialogue(){
  hide("dialogueScreen");
  const cb=dialogueState.onDone;dialogueState={queue:[],index:0,onDone:null,chapter:""};
  if(cb)cb();
}

// التقدم للسطر التالي في الحوار
function advanceDialogue(){
  if(!isOpen("dialogueScreen"))return;
  dialogueState.index++;
  AudioSys.tone(320,.06,"triangle",.028);
  if(dialogueState.index>=dialogueState.queue.length)closeDialogue();
  else renderDialogueLine();
}

// عرض اختيار المكافأة بعد تطهير الغرفة
// --- UI INTERACTION & REWARD SELECTION FIX ---

// 1. Clean event delegation for UI modals (Room Rewards & Shop)
document.addEventListener("click", function(e) {
  var btn = e.target.closest("button");
  if (!btn || btn.disabled) return;

  // Handles clicking "SELECT" on Room Cleared reward cards
  var upgradeCard = btn.closest(".upgradeCard");
  if (upgradeCard && !btn.closest("#shopGrid") && btn.dataset.i !== undefined) {
    var idx = parseInt(btn.dataset.i, 10);
    if (!isNaN(idx) && typeof handleRewardSelect === "function") {
      handleRewardSelect(idx);
    }
    return;
  }

  // Handles clicking "BUY" in the Shop
  if (btn.closest("#shopGrid") && btn.dataset.i !== undefined) {
    var shopIdx = parseInt(btn.dataset.i, 10);
    if (!isNaN(shopIdx) && typeof handleShopPurchase === "function") {
      handleShopPurchase(shopIdx);
    }
    return;
  }
});

// 2. Updated showRunReward function with clean data attributes
function showRunReward() {
  var pool = [
    ["HEART CORE", "+25 Max HP", function() { S.p.maxHp += 25; S.p.hp += 25; }],
    ["OVERDRIVE", "Fire cooldown -12%", function() { S.p.fireBonus += 0.12; }],
    ["POWER CHIP", "+12 Damage", function() { S.p.damageBonus += 12; }],
    ["BOOTS", "+25 Move Speed", function() { S.p.spd += 25; }],
    ["LUCKY CHARM", "+1 room luck", function() { S.luck += 1; }],
    ["POCKET", "+2 Potions", function() { S.p.inv.push("Potion", "Potion"); }],
    ["DASH BATTERY", "Dash cooldown -0.15s", function() { S.p.dashCdMax = Math.max(0.3, S.p.dashCdMax - 0.15); }],
    ["MAGNET", "Auto-loot for 8 sec", function() { S.p.magnetTimer = 8; }]
  ].sort(function() { return Math.random() - 0.5; }).slice(0, 3);

  window.currentRewardPool = pool;

  var grid = document.getElementById("runUpgradeGrid");
  if (grid) {
    grid.innerHTML = pool.map(function(u, i) {
      return '<div class="upgradeCard">' +
               '<h3>' + u[0] + '</h3>' +
               '<p>' + u[1] + '</p>' +
               '<button type="button" data-i="' + i + '">SELECT</button>' +
             '</div>';
    }).join("");
  }

  var sub = document.getElementById("rewardSub");
  if (sub) sub.textContent = "Room " + (S.cur + 1) + " reward · choose one";
  
  show("roomReward");
}

// 3. Handler for applying chosen rewards
function handleRewardSelect(index) {
  if (!window.currentRewardPool || !window.currentRewardPool[index]) return;
  
  // Execute the selected upgrade effect
  window.currentRewardPool[index][2]();
  
  hide("roomReward");
  S.roomClearedPending = false;
  
  if (typeof AudioSys !== "undefined" && AudioSys.level) AudioSys.level();
  if (typeof saveRun === "function") saveRun();
  if (typeof showToast === "function") showToast("UPGRADE EQUIPPED", 1200);
}

// فتح شاشة المتجر للشراء
const SHOP_ITEMS = [
  ["Scattergun",35,"Weapon"],
  ["VoltSMG",55,"Weapon"],
  ["Rail Lance",90,"Weapon"],
  ["Arc Wand",75,"Weapon"],
  ["Frost Cannon",85,"Weapon"],
  ["Potion",18,"Heal"],
  ["Bomb",28,"Utility"],
  ["Magnet",32,"Utility"],
  ["Weapon Upgrade",50,"Upgrade"]
];

function openShop(){
  $("shopCoins").textContent = S.coins;
  $("shopGrid").innerHTML = SHOP_ITEMS.map((a,i) => `
    <div class="upgradeCard">
      <h3>${a[0]}</h3>
      <p>${a[2]==="Weapon" ? WEAPONS[a[0]].desc : a[2]==="Upgrade" ? "Increase current weapon level." : "Consumable utility."}</p>
      <button data-i="${i}">BUY 🪙 ${a[1]}</button>
    </div>
  `).join("");
  show("shop");
}

function handleShopPurchase(index) {
  const item = SHOP_ITEMS[index];
  if (!item) return;
  const [name, cost] = item;
  
  if (S.coins < cost) return;
  S.coins -= cost;
  
  if (WEAPONS[name]) S.p.weapon = name;
  else if (name === "Potion") S.p.inv.push("Potion");
  else if (name === "Bomb") S.p.inv.push("Bomb");
  else if (name === "Magnet") S.p.magnetTimer = 15;
  else if (name === "Weapon Upgrade") S.weaponLevels[S.p.weapon] = (S.weaponLevels[S.p.weapon] || 0) + 1;
  
  AudioSys.buy();
  $("shopCoins").textContent = S.coins;
  updateHUD();
  saveRun();
  showToast(name + " purchased", 1100);
}

// استخدام عنصر من الحقيبة
function useItem(name){
  if(!S.running||!canUpdateGame())return;
  const i=S.p.inv.indexOf(name);if(i<0)return;
  if(name==="Potion"&&S.p.hp<S.p.maxHp){S.p.hp=Math.min(S.p.maxHp,S.p.hp+45);S.p.inv.splice(i,1);AudioSys.pickup();showToast("+45 HP",900)}
  else if(name==="Bomb"){S.p.inv.splice(i,1);for(const e of S.enemies.slice())damageEnemy(e,95,e);if(S.boss)hitBoss(95);S.enemyBullets=[];spawnBurst(S.p.x,S.p.y,"#fb7185",32);AudioSys.boss();showToast("BOMB BLAST",900)}
  else if(name==="Magnet"){S.p.magnetTimer=15;S.p.inv.splice(i,1);AudioSys.pickup();showToast("MAGNET ACTIVE",900)}
  renderInventory();updateHUD();
}

// رسم وعرض عناصر الحقيبة
function renderInventory(){
  const inv=S.p.inv||[];
  $("inventoryTop").innerHTML=[["Weapon",S.p.weapon],["HP",`${Math.ceil(S.p.hp)}/${S.p.maxHp}`],["Coins",S.coins],["Dash",S.p.dashCd<=0?"READY":"COOLDOWN"]].map(x=>`<span class="chip"><b>${x[0]}</b> ${x[1]}</span>`).join("");
  $("invGrid").innerHTML=inv.length?inv.map((x,i)=>`<div class="invSlot"><div class="icon">${x==="Potion"?"🧪":x==="Bomb"?"💣":"🧲"}</div><b>${x}</b><br><button onclick="useItem('${x}')">USE</button></div>`).join(""):"<div class='muted'>Empty</div>";
}
function toggleInventory(){if(!S.running)return;if(isOpen("inventory")){hide("inventory")}else{renderInventory();show("inventory")}}
function toggleMap(){if(!S.running)return;if(isOpen("mapOverlay"))hide("mapOverlay");else{drawMap();show("mapOverlay")}}

// رسم خريطة الغرف والمستويات
function drawMap(){
  mapCtx.fillStyle="#070b15";mapCtx.fillRect(0,0,mapCanvas.width,mapCanvas.height);
  if(!S.rooms.length)return;
  const minX=Math.min(...S.rooms.map(r=>r.x)),maxX=Math.max(...S.rooms.map(r=>r.x)),minY=Math.min(...S.rooms.map(r=>r.y)),maxY=Math.max(...S.rooms.map(r=>r.y));
  const scale=Math.min((mapCanvas.width-120)/Math.max(1,maxX-minX+1),(mapCanvas.height-100)/Math.max(1,maxY-minY+1));
  const ox=60-minX*scale,oy=50-minY*scale;
  const color={start:"#60a5fa",combat:"#94a3b8",treasure:"#fbbf24",shop:"#a78bfa",event:"#34d399",boss:"#ef4444",secret:"#f472b6"};
  mapCtx.lineWidth=7;mapCtx.strokeStyle="#25314d";
  for(const r of S.rooms){
    if(!S.visited.has(r.id))continue;
    for(const q of S.rooms)if(S.visited.has(q.id)&&Math.abs(r.x-q.x)+Math.abs(r.y-q.y)===1){
      mapCtx.beginPath();mapCtx.moveTo(ox+r.x*scale,oy+r.y*scale);mapCtx.lineTo(ox+q.x*scale,oy+q.y*scale);mapCtx.stroke();
    }
  }
  for(const r of S.rooms){
    if(!S.visited.has(r.id))continue;
    mapCtx.fillStyle=color[r.type]||"#64748b";mapCtx.beginPath();mapCtx.arc(ox+r.x*scale,oy+r.y*scale,Math.max(11,Math.min(20,scale*.23)),0,Math.PI*2);mapCtx.fill();
    if(r.id===S.cur){mapCtx.strokeStyle="#fff";mapCtx.lineWidth=3;mapCtx.stroke();mapCtx.beginPath()}
    if(r.cleared){mapCtx.fillStyle="#0b1120";mapCtx.fillRect(ox+r.x*scale-3,oy+r.y*scale-3,6,6)}
  }
}

// عرض بيانات الترقية الدائمة
function renderMeta(){
  $("metaCoins").textContent=META.coins||0;$("menuMetaCoins").textContent=META.coins||0;$("menuBestRoom").textContent=META.bestRoom||0;$("menuKills").textContent=META.lifetimeKills||0;
}
function saveMeta(){localStorage.setItem("db_meta",JSON.stringify(META));renderMeta();menuStats()}

// عرض قائمة الترقيات الدائمة وشراؤها
function renderMetaUpgrades(){
  $("metaUpgradeGrid").innerHTML=META_UPGRADES.map(([k,n,d,base,step])=>{
    const lvl=META[k]||0,cost=base+lvl*step;
    return `<div class="upgradeCard"><h3>${n}<small>Lv.${lvl}</small></h3><p>${d}</p><button data-k="${k}" data-cost="${cost}" ${META.coins<cost?"disabled":""}>UPGRADE · 🪙 ${cost}</button></div>`
  }).join("");
  $("metaUpgradeGrid").querySelectorAll("button").forEach(b=>b.onclick=()=>{
    const cost=+b.dataset.cost,k=b.dataset.k;if(META.coins<cost)return;META.coins-=cost;META[k]++;saveMeta();AudioSys.buy();renderMetaUpgrades()
  });
}

// عرض قائمة الأسلحة المتاحة
function renderArsenal(){
  $("arsenalGrid").innerHTML=Object.entries(WEAPONS).map(([n,w])=>{
    return `<div class="weaponCard"><div class="weaponArt" style="color:${w.color}">${w.icon}</div><h3>${n}</h3><p>${w.desc}</p>
      <div class="statRow"><span>STYLE</span><b>${w.style}</b></div>
      <div class="statRow"><span>DAMAGE</span><b>${w.d}</b></div>
      <div class="statRow"><span>RATE</span><b>${w.rate.toFixed(2)}s</b></div>
      <button onclick="equipFromArsenal('${n}')">EQUIP</button></div>`
  }).join("");
}
function equipFromArsenal(n){if(!S.running){showToast("Weapons are equipped during runs.");return}S.p.weapon=n;updateHUD();showToast(n+" equipped",1000);hide("arsenalMenu")}

// تحديث شاشة معلومات اللعبة (HUD) مثل الصحة، نقاط الخبرة، السلاح، والعملات
function updateHUD(){
  if(!S.running)return;
  const p=S.p;
  $("hpText").textContent=`${Math.max(0,Math.ceil(p.hp))}/${Math.ceil(p.maxHp)}`;$("hpBar").style.width=Math.max(0,p.hp/p.maxHp*100)+"%";
  $("xpText").textContent=`${S.level} · ${S.xp}/${S.nextXp}`;$("xpBar").style.width=(S.xp/S.nextXp*100)+"%";
  $("comboPill").textContent=`COMBO x${S.combo}`;$("dashPill").textContent=p.dashCd<=0?"DASH READY":`DASH ${p.dashCd.toFixed(1)}s`;
  $("boostPill").textContent=S.boosts.length?S.boosts.join("  "):"NO BOOST";$("boostPill").classList.toggle("boostActive",S.boosts.length>0);
  $("dangerPill").textContent=`DANGER ${Math.min(10,1+Math.floor(S.room/4))}`;$("dashPill").classList.toggle("dashReady",p.dashCd<=0);
  $("runCoins").textContent=S.coins;$("roomCounter").textContent=`${S.visited.size}/${S.rooms.length}`;
  const w=WEAPONS[p.weapon];$("weaponIcon").textContent=w.icon;$("weaponIcon").style.color=w.color;$("weaponText").textContent=p.weapon;$("weaponHint").textContent=`${w.style} · Lv.${S.weaponLevels[p.weapon]||0}`;
  const qb=$("weaponQuickbar");
  if(qb && qb.dataset.weapon !== p.weapon){
    qb.dataset.weapon=p.weapon;
    qb.innerHTML=Object.entries(WEAPONS).map(([name,ww],i)=>`<button type="button" title="${name} · ${ww.style} · Q/R to switch" data-weapon="${name}" class="${name===p.weapon?'active':''}" style="color:${ww.color}">${ww.icon}<small>${i+1}</small></button>`).join("");
    qb.querySelectorAll("button").forEach(b=>b.onclick=()=>{if(S.running&&canUpdateGame()){S.p.weapon=b.dataset.weapon;S.p.weaponFlash=.28;AudioSys.weaponSwitch();updateHUD();}});
  } else if(qb){
    qb.querySelectorAll("button").forEach(b=>b.classList.toggle("active",b.dataset.weapon===p.weapon));
  }
  $("bossHud").classList.toggle("hidden",!S.boss);
  updateObjective();
}

// ==========================================
// 9. المؤثرات الجسيمية والنصوص المائية (Particles & Floating Text)
// ==========================================

// إنشاء جسيم واحد
function spawnParticle(x,y,c,life=.4){
  S.particles.push({x,y,vx:(Math.random()-.5)*100,vy:(Math.random()-.5)*100,life,max:life,c,r:2+Math.random()*2});
}
// إنشاء انفجار من الجسيمات
function spawnBurst(x,y,c,n=10){
  for(let i=0;i<n;i++){const p={x,y,vx:(Math.random()-.5)*220,vy:(Math.random()-.5)*220,life:.25+Math.random()*.35,c,r:2+Math.random()*3};S.particles.push(p)}
}
// تحديث موقع وعمر الجسيمات
function updateParticles(dt){for(const p of S.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.96;p.vy*=.96;p.life-=dt}S.particles=S.particles.filter(p=>p.life>0)}
// تحديث النصوص العائمة (أرقام الضرر)
function updateTexts(dt){for(const t of S.texts){t.y-=28*dt;t.life-=dt}S.texts=S.texts.filter(t=>t.life>0)}
// إظهار إشعار مؤقت (Toast)
function showToast(msg,duration=1400){const el=$("toast");el.textContent=msg;el.classList.remove("hidden");clearTimeout(showToast.t);showToast.t=setTimeout(()=>el.classList.add("hidden"),duration)}
function showLevelToast(msg){const el=$("levelToast");el.textContent=msg;el.classList.remove("hidden");clearTimeout(showLevelToast.t);showLevelToast.t=setTimeout(()=>el.classList.add("hidden"),1300)}
// تأثير وميض الشاشة
function flash(a=.05){$("flash").style.opacity=a;setTimeout(()=>$("flash").style.opacity=0,60)}

// ==========================================
// 10. وظائف الرسم على Canvas (Rendering & Graphics)
// ==========================================

// رسم مستطيل بكسلي محاذى بشكل دقيق
function px(x,y,w,h,c){
  ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));
}

// رسم شكل العدو برسوميات البكسل (Pixel Art Sprites)
function drawEnemySprite(e,size,hit=false){
  const facing=S.p ? (S.p.x>=e.x?1:-1) : 1;
  const bob=(e.mode==="attack"?Math.sin(S.bgPulse*9+(e.phaseOffset||0))*1.1:Math.sin(S.bgPulse*4+(e.phaseOffset||0))*0.55);
  ctx.save();ctx.translate(Math.round(e.x),Math.round(e.y+bob));ctx.scale(facing,1);
  if(hit)ctx.globalAlpha=.52;

  // ظل الأرض
  px(-size*.9,size*.62,size*1.8,6,"#0009");

  // لوحة الألوان لكل نوع من الأعداء
  const palette={
    grunt:{body:"#7f1d1d",mid:"#b91c1c",light:"#fecaca",dark:"#3f0b12",metal:"#334155",eye:"#fde68a"},
    runner:{body:"#9a3412",mid:"#ea580c",light:"#fed7aa",dark:"#431407",metal:"#7c2d12",eye:"#fde68a"},
    shooter:{body:"#075985",mid:"#0891b2",light:"#cffafe",dark:"#082f49",metal:"#334155",eye:"#67e8f9"},
    tank:{body:"#334155",mid:"#64748b",light:"#cbd5e1",dark:"#111827",metal:"#94a3b8",eye:"#dbeafe"},
    mage:{body:"#701a75",mid:"#c026d3",light:"#f5d0fe",dark:"#3b0764",metal:"#4c1d95",eye:"#f0abfc"},
    splitter:{body:"#3f6212",mid:"#65a30d",light:"#d9f99d",dark:"#1a2e05",metal:"#4d7c0f",eye:"#fef08a"}
  }[e.type] || {body:"#3f3f46",mid:"#71717a",light:"#e4e4e7",dark:"#18181b",metal:"#52525b",eye:"#fef08a"};
  const k=size/20;

  // رسم الأرجل، الجذع، الكتف، الخوذة
  px(-10*k,7*k,7*k,10*k,palette.dark);px(4*k,7*k,7*k,10*k,palette.dark);
  px(-11*k,15*k,9*k,3*k,"#0b1020");px(3*k,15*k,9*k,3*k,"#0b1020");

  const cape=e.type==="mage"?"#4c1d95":e.type==="shooter"?"#164e63":"#252b38";
  px(-14*k,-2*k,7*k,20*k,cape);px(-12*k,1*k,4*k,13*k,palette.mid);
  px(-11*k,-8*k,22*k,20*k,palette.body);px(-9*k,-6*k,18*k,14*k,palette.mid);
  px(-8*k,4*k,16*k,5*k,palette.dark);

  px(-14*k,-6*k,6*k,7*k,palette.metal);px(8*k,-6*k,6*k,7*k,palette.metal);
  px(-13*k,-5*k,4*k,3*k,palette.light);px(9*k,-5*k,4*k,3*k,palette.light);

  px(-9*k,-20*k,18*k,13*k,palette.dark);px(-8*k,-21*k,16*k,11*k,palette.metal);
  px(-6*k,-18*k,12*k,6*k,palette.mid);px(-7*k,-13*k,14*k,4*k,palette.dark);
  px(-5*k,-17*k,3*k,2*k,palette.eye);px(2*k,-17*k,3*k,2*k,palette.eye);
  px(-8*k,-22*k,12*k,3*k,palette.light);

  // أسلحة خاصة بالأعداء
  if(e.type==="tank"){
    px(10*k,-1*k,5*k,19*k,palette.metal);px(14*k,2*k,8*k,12*k,palette.dark);
    px(15*k,-1*k,7*k,4*k,palette.light);
  }else if(e.type==="runner"){
    px(10*k,-2*k,4*k,18*k,"#f1f5f9");px(13*k,-5*k,3*k,7*k,"#e2e8f0");
  }else if(e.type==="shooter"||e.type==="mage"){
    px(10*k,-2*k,22*k,4*k,palette.metal);px(27*k,-4*k,6*k,8*k,palette.light);
    if(e.type==="mage")px(9*k,-9*k,5*k,16*k,palette.mid);
  }else{
    px(10*k,0,17*k,4*k,palette.metal);px(25*k,-3*k,4*k,10*k,palette.light);
  }

  // مؤشرات طور الهجوم والدفاع
  if(e.elite){ctx.globalAlpha=.9;ctx.fillStyle="#fbbf24";ctx.font=Math.max(11,size*.55)+"px Segoe UI Emoji";ctx.textAlign="center";ctx.fillText("♛",0,-size*1.42);ctx.globalAlpha=hit?.52:1}
  if(e.mode==="attack"){
    ctx.globalAlpha=.55;px(-size*.78,-size*.98,size*1.56,3,"#fb7185");ctx.globalAlpha=hit?.52:1;
  }else if(e.mode==="defense"){
    ctx.globalAlpha=.52;ctx.strokeStyle="#60a5fa";ctx.lineWidth=2;ctx.strokeRect(-size*.92,-size*.86,size*1.84,size*1.55);ctx.globalAlpha=hit?.52:1;
  }
  ctx.restore();
}

// رسم الزعيم (Boss)
function drawBoss(b){
  ctx.save();ctx.translate(Math.round(b.x),Math.round(b.y));
  if(b.hitFlash>0)ctx.globalAlpha=.55;
  px(-48,38,96,8,"#0009");
  const aura=b.kind==="witch"?"#8b5cf6":b.kind==="beast"?"#fb923c":"#94a3b8";
  ctx.globalAlpha=.18;ctx.fillStyle=aura;ctx.beginPath();ctx.arc(0,0,56+Math.sin(S.bgPulse*2)*4,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
  px(-33,-28,66,58,"#1a2230");px(-40,-12,10,28,"#4b5563");px(30,-12,10,28,"#4b5563");
  if(b.kind==="golem") {px(-26,-29,52,11,"#c2ccd5");px(-29,-14,58,26,"#6f7d89");px(-18,-8,36,18,"#9aa7b2");px(-7,-4,6,6,"#dff5ff");px(3,-4,6,6,"#dff5ff");px(-22,13,16,19,"#4e5a66");px(6,13,16,19,"#4e5a66");}
  else if(b.kind==="witch"){px(-29,-30,58,14,"#6d28d9");px(-23,-18,46,35,"#54239a");px(-17,-7,34,23,"#7c3aed");px(-8,-5,6,6,"#f5d0fe");px(4,-5,6,6,"#f5d0fe");px(22,-16,5,42,"#4b2a1b");px(19,-20,11,6,"#f0abfc");}
  else {px(-30,-31,60,13,"#8a3412");px(-25,-17,50,35,"#c2410c");px(-17,-6,34,24,"#f97316");px(-8,-4,6,6,"#fff0c2");px(4,-4,6,6,"#fff0c2");px(-32,8,12,20,"#7c2d12");px(21,8,12,20,"#7c2d12");}
  if(S.combatPhase==="defense"){ctx.strokeStyle="#60a5fa88";ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,55,0,Math.PI*2);ctx.stroke()}
  if(b.telegraph>0){ctx.globalAlpha=.5*(b.telegraph/.45);ctx.strokeStyle="#fb7185";ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,72+Math.sin(S.bgPulse*18)*5,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1}
  ctx.restore();
}

// رسم الغلاف الجوي والخلفية للزنزانة (تدرجات، أقواس، ومشاعل)
function drawDungeonAtmosphere(now){
  const g=ctx.createLinearGradient(0,70,0,230);g.addColorStop(0,"#09101d");g.addColorStop(1,"#14213a");ctx.fillStyle=g;ctx.fillRect(0,70,W,175);
  ctx.fillStyle="#0b1424";
  for(let i=0;i<9;i++){
    const x=i*155-45;ctx.fillRect(x,100,92,130);ctx.fillRect(x+18,126,56,105);
    ctx.fillStyle="#172743";ctx.fillRect(x+30,145,32,85);ctx.fillStyle="#0b1424";
  }
  for(const x of [96,230,1050,1184]){
    const pulse=.80+.12*Math.sin(now*.004+x);
    ctx.globalAlpha=.09*pulse;ctx.fillStyle="#f59e0b";ctx.beginPath();ctx.arc(x,176,55,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=.26*pulse;ctx.fillStyle="#fbbf24";ctx.fillRect(x-2,164,4,16);
  }
  ctx.globalAlpha=1;
  for(let i=0;i<34;i++){
    const x=(i*97+S.cur*41)%W;const y=98+((i*53+Math.floor(now*.018)+S.cur*17)%170);
    ctx.globalAlpha=.12+.08*((i%3)/2);ctx.fillStyle=i%5===0?"#fbbf24":"#93c5fd";ctx.fillRect(x,y,2,2);
  }
  ctx.globalAlpha=1;
}

// الدالة الكلية لرسم إطار اللعبة بالكامل
function draw(now){
  ctx.save();
  const shake=S.shake*SETTINGS.shake,ox=(Math.random()-.5)*shake,oy=(Math.random()-.5)*shake;ctx.translate(ox,oy);
  ctx.fillStyle="#0e1523";ctx.fillRect(0,0,W,H);

  // رسم أرضية الحجر
  const tile=32;
  v14Floor(now);for(let y=70;y<0;y+=tile)for(let x=0;x<W;x+=tile){
    const n=((x/tile+y/tile+S.cur)%2);
    ctx.fillStyle=n?"#16243a":"#142034";ctx.fillRect(x,y,tile-1,tile-1);
    ctx.fillStyle="#20314a";ctx.fillRect(x+3,y+4,2,2);ctx.fillRect(x+18,y+21,2,3);ctx.fillRect(x+27,y+9,3,2);
    if((x/tile+y/tile+S.cur)%5===0){ctx.fillStyle="#0d1728";ctx.fillRect(x+8,y+15,7,2);ctx.fillRect(x+12,y+17,2,5)}
    if((x/tile*3+y/tile+S.cur)%7===0){ctx.fillStyle="#31415a";ctx.fillRect(x+22,y+27,4,2)}
  }
  ctx.fillStyle="#1b2d44";for(let i=0;i<22;i++){let x=((i*73+S.cur*41)%W),y=100+((i*149+S.cur*23)%(H-120));ctx.fillRect(x,y,3,3);ctx.fillRect(x+4,y+2,2,2)}

  drawDungeonAtmosphere(now);

  // رسم الجدران
  for(const w of S.walls){v14Wall(w,now);continue;
    ctx.fillStyle="#080e1a";ctx.fillRect(w.x+6,w.y+8,w.w,w.h);
    ctx.fillStyle="#2c3b53";ctx.fillRect(w.x,w.y,w.w,w.h);
    ctx.fillStyle="#53657e";ctx.fillRect(w.x,w.y,w.w,6);
    ctx.fillStyle="#1b2638";ctx.fillRect(w.x,w.y+6,w.w,2);
    for(let yy=w.y+12,row=0;yy<w.y+w.h;yy+=13,row++){
      ctx.fillStyle="#3b4c65";ctx.fillRect(w.x+3,yy,w.w-6,10);
      for(let xx=w.x+7-(row%2)*10;xx<w.x+w.w-4;xx+=28){ctx.fillStyle="#27364d";ctx.fillRect(xx,yy+1,18,2)}
      ctx.fillStyle="#1b2637";ctx.fillRect(w.x+3,yy+10,w.w-6,2);
    }
    ctx.fillStyle="#6b7d95";ctx.fillRect(w.x+2,w.y+1,12,2);
  }

  // رسم المخرج / البوابة
  if(S.door){
    const pulse=0.75+Math.sin(now*.008)*.2;
    ctx.globalAlpha=pulse;ctx.fillStyle="#7c3aed";ctx.fillRect(S.door.x-45,S.door.y-16,90,30);
    ctx.fillStyle="#c4b5fd";ctx.fillRect(S.door.x-22,S.door.y-11,44,20);ctx.globalAlpha=1;
    ctx.fillStyle="#fff";ctx.font="bold 12px monospace";ctx.textAlign="center";ctx.fillText(S.rooms[S.cur]?.type==="boss"?"ESCAPE":"EXIT ↑",S.door.x,S.door.y-23);
  }

  // رسم الصناديق والتُّجار والمذابح
  if(S.chest){
    ctx.fillStyle=S.chest.open?"#5a6477":"#fbbf24";ctx.fillRect(S.chest.x-27,S.chest.y-19,54,38);ctx.fillStyle="#713f12";ctx.fillRect(S.chest.x-5,S.chest.y-19,10,38);
    if(!S.chest.open){ctx.fillStyle="#fff7cc";ctx.fillRect(S.chest.x-18,S.chest.y-30,36,3)}
  }
  if(S.npc){drawEntityShadow(S.npc.x,S.npc.y,23,7,.42);drawActor(S.npc,"#60a5fa",22);ctx.fillStyle="#fff";ctx.font="bold 13px monospace";ctx.textAlign="center";ctx.fillText("MIRA",S.npc.x,S.npc.y-35)}
  if(S.event){
    ctx.fillStyle="#34d399";ctx.beginPath();ctx.arc(S.event.x,S.event.y,22+Math.sin(now*.006)*4,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#08231c";ctx.fillRect(S.event.x-6,S.event.y-14,12,28);
    ctx.fillStyle="#fff";ctx.font="bold 11px monospace";ctx.textAlign="center";ctx.fillText("ALTAR",S.event.x,S.event.y-31);
  }

  // رسم المنسوبات، الطلقات، الأعداء، والجسيمات
  for(const d of S.drops){ctx.fillStyle=d.type==="coin"?"#fbbf24":"#34d399";ctx.fillRect(d.x-7,d.y-7,14,14);ctx.fillStyle="#fff";ctx.fillRect(d.x-2,d.y-5,4,4)}
  for(const b of []){
    for(const tr of (b.trail||[])){ctx.globalAlpha=Math.max(0,tr.life/.16)*.35;ctx.fillStyle=b.c;ctx.fillRect(tr.x-1.5,tr.y-1.5,3,3)}
    ctx.globalAlpha=1;ctx.fillStyle=b.c;ctx.fillRect(b.x-b.r,b.y-b.r,b.r*2,b.r*2);
    if(b.crit){ctx.strokeStyle="#fde68a";ctx.lineWidth=2;ctx.beginPath();ctx.arc(b.x,b.y,b.r+3,0,Math.PI*2);ctx.stroke()}
    if(b.r>=5){ctx.fillStyle="#fff";ctx.fillRect(b.x-2,b.y-2,4,4)}
  }
  for(const b of S.enemyBullets){ctx.fillStyle=b.c;ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill()}
  for(const e of S.enemies){if(e.hp<=0)continue;drawEntityShadow(e.x,e.y,e.r*1.25,6,.56);drawEnemySprite(e,e.type==="tank"?29:e.type==="runner"?19:21,e.hitFlash>0);drawEnemyBar(e)}
  if(S.boss){drawEntityShadow(S.boss.x,S.boss.y,52,10,.62);drawBoss(S.boss)}
  for(const p of S.particles){ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.c;ctx.fillRect(p.x-p.r,p.y-p.r,p.r*2,p.r*2)}ctx.globalAlpha=1;

  // رسم اللاعب
  drawEntityShadow(S.p.x,S.p.y,19,6,.56);drawPlayer(S.p,now);

  // شاشة التمهيد لمرحلة القتال
  if((S.rooms[S.cur]?.type==="combat"||S.rooms[S.cur]?.type==="boss")&&S.combatPhase==="ready"){
    ctx.fillStyle="#07101acc";ctx.fillRect(0,70,W,H-70);
    ctx.strokeStyle="#8b5cf633";ctx.lineWidth=2;ctx.beginPath();ctx.arc(W/2,360,130+Math.sin(now*.005)*8,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle="#f8fafc";ctx.font="bold 22px monospace";ctx.textAlign="center";ctx.fillText("PREPARE",W/2,375);
    ctx.fillStyle="#9aa8c4";ctx.font="12px monospace";ctx.fillText("The enemies are watching…",W/2,398);
  }

  // رسم النصوص العائمة
  for(const t of S.texts){ctx.globalAlpha=Math.max(0,t.life/.55);ctx.fillStyle=t.color;ctx.font=`bold ${t.size}px monospace`;ctx.textAlign="center";ctx.fillText(t.text,t.x,t.y)}ctx.globalAlpha=1;
  ctx.restore();
  if(S.flash>0) $("flash").style.opacity=Math.min(.22,S.flash*3);
}

// رسم شريط صحة العدو
function drawEnemyBar(e){
  const ratio=Math.max(0,e.hp/e.maxHp);if(ratio>=.999)return;ctx.fillStyle="#111";ctx.fillRect(e.x-e.r,e.y-e.r-9,e.r*2,4);ctx.fillStyle="#fb7185";ctx.fillRect(e.x-e.r,e.y-e.r-9,e.r*2*ratio,4)
}

// رسم ظلال الكيانات
function drawEntityShadow(x,y,w,h,alpha=.5){
  ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle="#02050b";ctx.beginPath();ctx.ellipse(Math.round(x),Math.round(y+h*.7),w,h,0,0,Math.PI*2);ctx.fill();ctx.restore();
}

// رسم الشخصيات التفاعلية مثل التاجر
function drawActor(o,c,size,hit=false){
  ctx.save();ctx.translate(Math.round(o.x),Math.round(o.y));
  if(hit)ctx.globalAlpha=.55;
  px(-size*.62,-size*.9,size*1.24,size*.36,"#111827");
  px(-size*.78,-size*.56,size*1.56,size*.84,c);
  px(-size*.48,-size*.72,size*.96,size*.62,"#2b1b33");
  px(-size*.30,-size*.54,size*.60,size*.43,"#d4a373");
  px(-size*.16,-size*.44,size*.08,size*.08,"#1f2937");px(size*.08,-size*.44,size*.08,size*.08,"#1f2937");
  px(-size*.58,size*.15,size*.40,size*.78,"#0f172a");px(size*.18,size*.15,size*.40,size*.78,"#0f172a");
  px(-size*.88,size*.80,size*.62,size*.14,"#111827");px(size*.26,size*.80,size*.62,size*.14,"#111827");
  ctx.restore();
}

// رسم مجسم وسلاح اللاعب
function drawPlayer(p,now){
  const a=Math.atan2(mouse.y-p.y,mouse.x-p.x),w=WEAPONS[p.weapon],bob=Math.sin(now*.010)*1.2;
  ctx.save();ctx.translate(Math.round(p.x),Math.round(p.y+bob));ctx.rotate(a);
  if((p.boostDamage||1)>1||p.boostFire>0||p.shieldTimer>0||p.speedTimer>0){ctx.save();ctx.rotate(-a);ctx.globalAlpha=.16+.08*Math.sin(now*.012);ctx.strokeStyle=p.shieldTimer>0?"#60a5fa":p.boostDamage>1?"#fb7185":"#fbbf24";ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,26+Math.sin(now*.01)*3,0,Math.PI*2);ctx.stroke();ctx.restore();}
  px(-17,-8,7,24,"#312e81");px(-22,-2,12,21,"#4338ca");px(-26,4,10,13,"#1e1b4b");
  px(-12,12,8,8,"#111827");px(6,12,8,8,"#111827");
  px(-13,-11,26,25,"#334155");px(-10,-13,20,22,"#64748b");px(-5,-8,10,13,"#cbd5e1");
  px(-15,-8,7,11,"#475569");px(8,-8,7,11,"#475569");
  px(-3,-8,6,6,"#0f172a");
  px(-11,-20,22,10,"#0b1220");px(-9,-18,18,11,"#94a3b8");px(-10,-12,20,5,"#1e293b");
  px(-6,-11,12,3,"#e2e8f0");
  px(-2,-22,4,4,"#22d3ee");
  px(9,-5,9,9,"#94a3b8");px(15,-4,9,7,"#1e293b");px(19,-3,28,5,w.color);
  px(45-(p.recoil||0)*45,-4,7,7,"#f8fafc");
  if(p.muzzle>0){ctx.globalAlpha=.9;px(51,-6,7,10,"#fff7b2");ctx.globalAlpha=1}
  px(-21,-3,6,13,"#0f172a");px(-24,-4,5,10,"#60a5fa");
  if((p.weaponFlash||0)>0){
    ctx.save();ctx.rotate(-a);ctx.globalAlpha=Math.min(1,p.weaponFlash*4);ctx.fillStyle=w.color;ctx.font="bold 11px monospace";ctx.textAlign="center";ctx.fillText("READY",0,38);ctx.restore();
  }
  ctx.restore();
  if(p.magnetTimer>0){ctx.globalAlpha=.18;ctx.strokeStyle="#34d399";ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,85+Math.sin(now*.01)*6,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1}
}


// ==========================================
// 10.9 POLISH OVERDRIVE — presentation, juice, boosts and escalation
// ==========================================
const POLISH = {
  t:0, hitStop:0, wave:0, bossPulse:0, banner:0, lastRoom:-1,
  shake:0, streak:0, ambient:0, particles:[], trails:[], rings:[], sparks:[],
  boostNames:{OVERDRIVE:"☄ OVERDRIVE", CRIT:"💥 CRIT FURY", MAGNET:"🧲 SOUL MAGNET", REGEN:"💚 REGEN CORE"},
  boostColors:{OVERDRIVE:"#fb7185",CRIT:"#f59e0b",MAGNET:"#34d399",REGEN:"#4ade80"}
};

// Extra sound palette. Everything is synthesized locally; no assets are required.
Object.assign(AudioSys,{
  pickupRare(){this.tone(392,.06,"triangle",.06);this.tone(587,.08,"triangle",.065,"sfx",.05);this.tone(784,.12,"sine",.07,"sfx",.11)},
  crit(){this.tone(740,.045,"square",.075);this.tone(1046,.07,"triangle",.085,"sfx",.025);this.tone(1480,.11,"sine",.055,"sfx",.06)},
  boostRare(){this.tone(260,.08,"sawtooth",.045);this.tone(520,.12,"triangle",.07,"sfx",.06);this.tone(1040,.18,"sine",.055,"sfx",.11)},
  bossPhase(){this.tone(92,.16,"sawtooth",.07);this.tone(138,.22,"triangle",.055,"sfx",.08);this.tone(184,.28,"sawtooth",.04,"sfx",.15)},
  bossSlam(){this.noise(.18,.13);this.tone(62,.24,"sawtooth",.08)},
  levelBig(){[330,440,554,659,880,1108].forEach((n,i)=>this.tone(n,.13,"triangle",.065,"sfx",i*.055))},
  danger(){this.tone(110,.08,"square",.065);this.tone(165,.09,"square",.05,"sfx",.09)},
  comboUp(n){const base=440+Math.min(700,n*18);this.tone(base,.045,"square",.05);if(n%5===0)this.tone(base*1.5,.08,"triangle",.055,"sfx",.03)},
  dashImpact(){this.noise(.045,.07);this.tone(180,.08,"sawtooth",.06);this.tone(90,.13,"triangle",.04,"sfx",.03)}
});

function ensurePolishHUD(){
  if($('polishStage'))return;
  const hud=$('hud'); if(!hud)return;
  const center=document.querySelector('.hudCenter');
  if(center){
    const stage=document.createElement('div');stage.id='polishStage';stage.className='polishStage';
    stage.innerHTML='<b id="stageTitle">DEPTH 1</b><span id="stageSub">THE OUTER HALLS</span><i id="threatMeter"><em></em></i>';
    center.prepend(stage);
  }
  const left=document.querySelector('.hudLeft');
  if(left){
    const perks=document.createElement('div');perks.id='perkTray';perks.className='perkTray';
    perks.setAttribute('aria-label','Active boosts');left.appendChild(perks);
  }
}
function difficultyStage(){
  const depth=Math.max(0,S.room||0), lv=Math.max(1,S.level||1);
  const tier=Math.min(8,1+Math.floor(depth/4)+Math.floor((lv-1)/3));
  const names=["OUTER HALLS","BLOODSTONE HALL","FORGOTTEN DEPTHS","CURSED GALLERY","ABYSSAL VAULT","WARLORD'S DOMAIN","VOID DESCENT","THRONE OF RUIN"];
  const threat=Math.min(1,0.12+depth*.025+(lv-1)*.025);
  return {tier,name:names[tier-1],threat};
}

function addPolishBurst(x,y,color,n=12,force=1){
  for(let i=0;i<n;i++){
    const a=Math.random()*Math.PI*2, sp=(60+Math.random()*220)*force;
    POLISH.sparks.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:.22+Math.random()*.42,max:.65,c:color,r:1+Math.random()*3});
  }
}
function addRing(x,y,color,r=18){POLISH.rings.push({x,y,color,r,life:.38,max:.38});}
function updatePolish(dt){
  POLISH.t+=dt; POLISH.ambient+=dt;
  if(POLISH.hitStop>0){POLISH.hitStop=Math.max(0,POLISH.hitStop-dt);return;}
  for(const q of POLISH.sparks){q.x+=q.vx*dt;q.y+=q.vy*dt;q.vx*=.94;q.vy*=.94;q.life-=dt}
  POLISH.sparks=POLISH.sparks.filter(q=>q.life>0);
  for(const q of POLISH.rings){q.r+=190*dt;q.life-=dt}
  POLISH.rings=POLISH.rings.filter(q=>q.life>0);
  if(POLISH.banner>0)POLISH.banner-=dt;
  POLISH.shake=Math.max(0,POLISH.shake-dt*2.8);
}
function polishHit(x,y,color='#fff',big=false){
  addPolishBurst(x,y,color,big?22:9,big?1.4:1);
  addRing(x,y,color,big?24:12);
  POLISH.hitStop=Math.max(POLISH.hitStop,big?.035:.012);
  POLISH.shake=Math.max(POLISH.shake,big?7:2);
}
function polishBanner(title,sub=''){
  POLISH.banner=1.8;
  const el=$('toast'); if(!el)return;
  el.innerHTML='<b>'+title+'</b>'+(sub?'<small>'+sub+'</small>':'');
  el.classList.remove('hidden'); clearTimeout(polishBanner.timer);polishBanner.timer=setTimeout(()=>el.classList.add('hidden'),1800);
}

function activatePolishBoost(type){
  const p=S.p;if(!p)return;
  const dur={OVERDRIVE:10,CRIT:9,MAGNET:12,REGEN:10}[type]||9;
  if(type==='OVERDRIVE')p.overdriveTimer=Math.max(p.overdriveTimer||0,dur);
  if(type==='CRIT')p.critTimer=Math.max(p.critTimer||0,dur);
  if(type==='MAGNET')p.magnetTimer=Math.max(p.magnetTimer||0,dur);
  if(type==='REGEN')p.regenBoostTimer=Math.max(p.regenBoostTimer||0,dur);
  S.boosts=Array.from(new Set([...(S.boosts||[]),type]));
  AudioSys.boostRare(); polishHit(p.x,p.y,POLISH.boostColors[type],true);
  const names=POLISH.boostNames[type];
  polishBanner(names, type==='OVERDRIVE'?'+65% damage & +20% fire speed':type==='CRIT'? '25% chance for x2.5 critical hits':type==='MAGNET'? 'Vacuum range massively increased':'Regenerate 3 HP every second');
}
function updatePolishBoosts(dt){
  const p=S.p;if(!p)return;
  p.overdriveTimer=Math.max(0,(p.overdriveTimer||0)-dt);
  p.critTimer=Math.max(0,(p.critTimer||0)-dt);
  p.magnetTimer=Math.max(0,(p.magnetTimer||0)-dt);
  p.regenBoostTimer=Math.max(0,(p.regenBoostTimer||0)-dt);
  if(p.regenBoostTimer>0){p._regenTick=(p._regenTick||0)+dt;if(p._regenTick>=1){p._regenTick=0;p.hp=Math.min(p.maxHp,p.hp+3);S.texts.push({x:p.x,y:p.y-30,text:'+3',life:.5,color:'#4ade80',size:12});}}
}

function applyElitePolish(e){
  if(!e||!e.elite)return;
  const pool=['BERSERKER','VAMPIRIC','ARMORED','FROSTBORN'];
  e.affix=e.affix||pool[Math.floor(Math.random()*pool.length)];
  if(e.affix==='BERSERKER')e.sp*=1.18;
  if(e.affix==='VAMPIRIC')e.lifesteal=.12;
  if(e.affix==='ARMORED')e.armor=.25;
  if(e.affix==='FROSTBORN')e.slowAura=true;
}

function polishSpawnEnemy(type,x,y){
  const before=S.enemies.length;spawnEnemy(type,x,y);const e=S.enemies[S.enemies.length-1];
  if(e){applyElitePolish(e);e.spawnAnim=.5;e.rot=0;e.trail=[];addRing(e.x,e.y,e.elite?'#fbbf24':e.c,10);}
  return before!==S.enemies.length?e:null;
}

// Replace the normal enemy spawner with a presentation-aware wrapper.
const _spawnEnemyCore=spawnEnemy;
spawnEnemy=function(type,x=null,y=null){
  const before=S.enemies.length;_spawnEnemyCore(type,x,y);const e=S.enemies[S.enemies.length-1];
  if(e&&S.enemies.length>before){applyElitePolish(e);e.spawnAnim=.55;e.rot=(Math.random()-.5)*.3;e.trail=[];addRing(e.x,e.y,e.elite?'#fbbf24':e.c,10);}
};

// Extra boss phase system: shields, telegraphed slams, and an enrage phase.
const _updateBossCore=updateBoss;
updateBoss=function(dt){
  if(!S.boss){_updateBossCore(dt);return;}
  const b=S.boss;
  const beforePhase=b.phase;
  _updateBossCore(dt);
  if(!S.boss)return;
  const ratio=S.boss.hp/S.boss.maxHp;
  const newPhase=ratio<.2?4:ratio<.42?3:ratio<.68?2:1;
  S.boss.phase=newPhase;
  if(newPhase!==beforePhase){
    S.boss.phasePulse=.8;S.boss.phaseTimer=0;S.boss.enrage=newPhase>=3;AudioSys.bossPhase();polishHit(S.boss.x,S.boss.y,S.boss.c,true);
    polishBanner('⚔ PHASE '+newPhase,'The boss is becoming more dangerous');
    S.shake=Math.max(S.shake,10);
  }
  if(newPhase>=3){S.boss.sp*=1+dt*.018;}
  if(newPhase===4 && !S.boss.finalBurst){
    S.boss.finalBurst=true;AudioSys.danger();
    for(let i=0;i<16;i++)enemyShot(S.boss,i*Math.PI*2/16,32);
    for(let i=0;i<3;i++)spawnEnemy(i===0?'tank':'runner',S.boss.x+(i-1)*70,S.boss.y+55);
  }
  if(S.boss.telegraph>.05){POLISH.bossPulse=S.boss.telegraph;}
};

// Crits + better feedback on every hit.
const _damageEnemyCore=damageEnemy;
damageEnemy=function(e,d,src){
  if(!e)return false;
  let crit=false;
  if(S.p&&S.p.critTimer>0&&Math.random()<.25){d*=2.5;crit=true;AudioSys.crit();polishHit(e.x,e.y,'#fde68a',true);S.texts.push({x:e.x,y:e.y-e.r-25,text:'CRIT!',life:.7,color:'#fde68a',size:16});}
  if(e.armor) d*=1-e.armor;
  const dead=_damageEnemyCore(e,d,src);
  if(crit){S.score+=35;S.combo=Math.min(99,S.combo+2);}
  if(dead){polishHit(e.x,e.y,e.elite?'#fbbf24':e.c,true);AudioSys.combo(S.combo);}
  return dead;
};

// Richer boost table: old boosts remain compatible, these are additional rare drops.
const _activateBoostCore=activateBoost;
activateBoost=function(type){
  if(['OVERDRIVE','CRIT','MAGNET','REGEN'].includes(type)){activatePolishBoost(type);return;}
  _activateBoostCore(type);
};
const _updateBoostsCore=updateBoosts;
updateBoosts=function(dt){
  _updateBoostsCore(dt);updatePolishBoosts(dt);
  if(S.p){
    if(S.p.overdriveTimer>0)S.boosts.push('☄');
    if(S.p.critTimer>0)S.boosts.push('💥');
    if(S.p.magnetTimer>0)S.boosts.push('🧲');
    if(S.p.regenBoostTimer>0)S.boosts.push('💚');
    S.boosts=[...new Set(S.boosts)];
  }
};

// Add rare drops without replacing the original reward system.
const _damageEnemyDropPatch=damageEnemy;
damageEnemy=function(e,d,src){
  if(S.p&&S.p.overdriveTimer>0)d*=1.65;
  const hpBefore=e.hp;const dead=_damageEnemyDropPatch(e,d,src);
  if(dead&&e.elite&&Math.random()<.55){
    const types=['OVERDRIVE','CRIT','MAGNET','REGEN'];
    S.drops.push({x:e.x+12,y:e.y-12,type:types[Math.floor(Math.random()*types.length)],life:16,bob:Math.random()*6,rare:true});
  }
  return dead;
};

// Override drop rendering/collection by augmenting the existing drop update.
// Scale bosses harder as the run deepens and give each boss a signature identity.
const _enterRoomCore=enterRoom;
enterRoom=function(id){
  _enterRoomCore(id);
  if(S.boss){
    const depth=Math.max(0,id),tier=difficultyStage().tier;
    const hpMult=1.18+depth*.035+tier*.055+(S.level-1)*.035;
    S.boss.maxHp*=hpMult;S.boss.hp=S.boss.maxHp;S.boss.sp*=1+tier*.035;
    S.boss.r+=Math.min(14,tier*1.4);S.boss.phase=1;S.boss.finalBurst=false;
    S.boss.signature=tier%3;S.boss.telegraph=1.2;
    AudioSys.boss();polishBanner('👑 '+S.boss.name,'THE THRONE GUARDIAN AWAKENS');
    addRing(S.boss.x,S.boss.y,S.boss.c,30);
  }
};

const _updateDropsCore=updateDrops;
updateDrops=function(dt){
  // Rare drops are collected by the normal distance logic below through this pre-pass.
  for(const d of S.drops){
    if(['OVERDRIVE','CRIT','MAGNET','REGEN'].includes(d.type)){
      d.life-=dt;d.bob=(d.bob||0)+dt*4;
      const dist=Math.hypot(d.x-S.p.x,d.y-S.p.y);
      const range=S.p.magnetTimer>0?330:28;
      if(dist<range){
        const a=Math.atan2(S.p.y-d.y,S.p.x-d.x);const pull=dist<range?Math.max(120,520-dist):0;
        d.x+=Math.cos(a)*pull*dt;d.y+=Math.sin(a)*pull*dt;
      }
      if(Math.hypot(d.x-S.p.x,d.y-S.p.y)<25){activatePolishBoost(d.type);d.dead=true;AudioSys.pickupRare();}
    }
  }
  S.drops=S.drops.filter(d=>!d.dead);
  _updateDropsCore(dt);
};

// Make player motion leave a short afterimage trail and add a dash impact.
const _dashCore=dash;
dash=function(){const old={x:S.p.x,y:S.p.y};_dashCore();if(S.p&&S.p.x!==old.x){addPolishBurst(S.p.x,S.p.y,'#22d3ee',14,1.1);addRing(S.p.x,S.p.y,'#22d3ee',18);AudioSys.dashImpact();}};

// Difficulty + polish HUD + ambient animation run beside the original update.
const _updateCore=update;
update=function(dt,now){
  updatePolish(dt);
  if(POLISH.hitStop>0)return;
  _updateCore(dt,now);
  const st=difficultyStage();
  S.difficulty=1+Math.max(0,S.room)*.055+(st.tier-1)*.035+(S.level-1)*.025;
  ensurePolishHUD();
  if($('stageTitle'))$('stageTitle').textContent='DEPTH '+st.tier+' · '+String(Math.round(st.threat*100)).padStart(2,'0')+'%';
  if($('stageSub'))$('stageSub').textContent=st.name;
  if($('threatMeter'))$('threatMeter').style.setProperty('--threat',Math.min(100,st.threat*100)+'%');
  if($('perkTray'))$('perkTray').innerHTML=(S.boosts||[]).map(x=>'<span>'+x+'</span>').join('');
  if(S.boss&&S.boss.phase>=3&&Math.random()<dt*.9){AudioSys.warning();POLISH.shake=Math.max(POLISH.shake,2);}
};

// Cinematic render layer: trails, rings, enemy affix markers, boost drops, boss danger rings.
const _drawCore=draw;
draw=function(now){
  _drawCore(now);
  const c=ctx;
  c.save();
  for(const q of POLISH.rings){c.globalAlpha=Math.max(0,q.life/q.max)*.55;c.strokeStyle=q.color;c.lineWidth=2;c.beginPath();c.arc(q.x,q.y,q.r,0,Math.PI*2);c.stroke();}
  for(const q of POLISH.sparks){c.globalAlpha=Math.max(0,q.life/q.max);c.fillStyle=q.c;c.fillRect(q.x-q.r/2,q.y-q.r/2,q.r,q.r)}
  for(const d of S.drops){
    if(!['OVERDRIVE','CRIT','MAGNET','REGEN'].includes(d.type))continue;
    const bob=Math.sin((d.bob||0)+POLISH.t*5)*5;
    const col=POLISH.boostColors[d.type];
    c.save();c.translate(d.x,d.y+bob);c.globalAlpha=.35;c.fillStyle=col;c.beginPath();c.arc(0,0,18+Math.sin(POLISH.t*8)*3,0,Math.PI*2);c.fill();c.globalAlpha=1;
    c.fillStyle=col;c.font='bold 20px Segoe UI Emoji';c.textAlign='center';c.textBaseline='middle';c.fillText({OVERDRIVE:'☄',CRIT:'💥',MAGNET:'🧲',REGEN:'💚'}[d.type],0,0);c.restore();
  }
  for(const e of S.enemies){if(e.hp<=0||!e.elite)continue;c.save();c.translate(e.x,e.y-e.r-22);c.globalAlpha=.75+.2*Math.sin(POLISH.t*7);c.fillStyle=e.affix==='BERSERKER'?'#fb7185':e.affix==='VAMPIRIC'?'#c084fc':e.affix==='ARMORED'?'#cbd5e1':'#67e8f9';c.font='bold 12px Segoe UI Emoji';c.textAlign='center';c.fillText({BERSERKER:'☠',VAMPIRIC:'🩸',ARMORED:'🛡️',FROSTBORN:'❄️'}[e.affix]||'♛',0,0);c.restore();}
  if(S.boss){
    const b=S.boss;const danger=b.telegraph||0;
    if(danger>0){c.save();c.globalAlpha=.16+.14*Math.sin(POLISH.t*18);c.strokeStyle='#fb7185';c.lineWidth=4;c.beginPath();c.arc(b.x,b.y,b.r+28+danger*45,0,Math.PI*2);c.stroke();c.restore();}
    if(b.phase>=3){c.save();c.globalAlpha=.16+.06*Math.sin(POLISH.t*9);c.strokeStyle='#ef4444';c.lineWidth=3;c.beginPath();c.arc(b.x,b.y,b.r+13+Math.sin(POLISH.t*6)*4,0,Math.PI*2);c.stroke();c.restore();}
  }
  c.restore();
};

// Patch player state when a new run is created/loaded so new systems always start cleanly.
const _applyMetaCore=applyMeta;
applyMeta=function(){_applyMetaCore();Object.assign(S.p,{overdriveTimer:0,critTimer:0,regenBoostTimer:0,_regenTick:0});};




// ============================================================================
// PHASES 3-10 — COMPLETE CONTENT, ROGUELITE, MAP, BOSSES, META & FINAL POLISH
// ============================================================================

const ENDGAME = {
  phase: 3,
  roomVariantNames:{
    standard:'COMBAT', ambush:'AMBUSH', elite:'ELITE HUNT', gauntlet:'GAUNTLET',
    trap:'TRAP HALL', shrine:'SHRINE', challenge:'CHALLENGE', treasure:'TREASURE'
  },
  relics:[], routeChoices:[], routeOpen:false, eventState:null, unlocked:{},
  achievements:{}, stats:{runs:0,bosses:0,rooms:0,damage:0,crits:0,coins:0},
  musicMode:'normal', bossMusic:false, shakeTimer:0, flash:0
};

const RUN_UPGRADES = [
  {id:'twin',name:'TWIN CORE',icon:'⚔️',desc:'Every 8th shot fires a bonus projectile.',apply:()=>S.p.twinShots=(S.p.twinShots||0)+1},
  {id:'executioner',name:'EXECUTIONER',icon:'☠️',desc:'+18% damage to enemies below 40% HP.',apply:()=>S.p.executeBonus=(S.p.executeBonus||0)+.18},
  {id:'vampire',name:'BLOOD ENGINE',icon:'🩸',desc:'Heal 2% of damage dealt.',apply:()=>S.p.vampire=(S.p.vampire||0)+.02},
  {id:'thorns',name:'THORN ARMOR',icon:'🌵',desc:'Reflect 20% of contact damage.',apply:()=>S.p.thorns=(S.p.thorns||0)+.20},
  {id:'combo',name:'COMBO DRIVE',icon:'🔥',desc:'Combo lasts 45% longer and boosts score.',apply:()=>S.p.comboBoost=(S.p.comboBoost||0)+.45},
  {id:'glass',name:'GLASS CANNON',icon:'💎',desc:'+35% damage, -12% max HP.',apply:()=>{S.p.damageBonus=(S.p.damageBonus||0)+18;S.p.maxHp=Math.max(25,S.p.maxHp*.88);S.p.hp=Math.min(S.p.hp,S.p.maxHp)}},
  {id:'bulwark',name:'BULWARK',icon:'🛡️',desc:'+18% armor and +20 max HP.',apply:()=>{S.p.armor=Math.min(.7,(S.p.armor||0)+.18);S.p.maxHp+=20;S.p.hp+=20}},
  {id:'momentum',name:'MOMENTUM',icon:'💨',desc:'Dash gives +40% fire rate for 2 sec.',apply:()=>S.p.dashMomentum=(S.p.dashMomentum||0)+1},
  {id:'collector',name:'SOUL HARVESTER',icon:'🧲',desc:'+25% coins and +20% drop chance.',apply:()=>{S.p.coinMult=(S.p.coinMult||1)*1.25;S.luck+=.2}},
  {id:'frost',name:'FROST NOVA',icon:'❄️',desc:'Every 12th hit releases a slowing nova.',apply:()=>S.p.frostNova=(S.p.frostNova||0)+1},
  {id:'critmaster',name:'CRIT MASTER',icon:'🎯',desc:'+8% permanent critical chance.',apply:()=>S.p.critChance=(S.p.critChance||0)+.08},
  {id:'adrenaline',name:'ADRENALINE',icon:'⚡',desc:'+12% speed and +10% fire rate below 45% HP.',apply:()=>S.p.adrenaline=(S.p.adrenaline||0)+1}
];

const ROOM_EVENTS = [
  {id:'bloodPact',title:'🩸 BLOOD PACT',text:'Lose 15% current HP for a powerful permanent run bonus.',action:()=>{const cost=S.p.hp*.15;S.p.hp=Math.max(1,S.p.hp-cost);S.p.damageBonus=(S.p.damageBonus||0)+10;S.p.critChance=(S.p.critChance||0)+.04;S.coins+=12;showToast('BLOOD PACT · POWER ACCEPTED',1800)}},
  {id:'merchant',title:'🛒 WANDERING MERCHANT',text:'Trade 35 coins for a random rare relic.',action:()=>{if(S.coins<35){showToast('NOT ENOUGH COINS',1000);return false}S.coins-=35;grantRandomRunUpgrade(true);return true}},
  {id:'trial',title:'⚔️ CHAMPION TRIAL',text:'Enemies become stronger, but the reward is doubled.',action:()=>{S.roomTrial=true;S.roomTrialMult=1.75;showToast('CHAMPION TRIAL · REWARD x1.75',1600)}},
  {id:'well',title:'💚 WISHING WELL',text:'Spend coins to restore health and gain luck.',action:()=>{if(S.coins<20){showToast('THE WELL WANTS 20 COINS',1000);return false}S.coins-=20;S.p.hp=S.p.maxHp;S.luck+=1;showToast('THE WELL ANSWERED',1400);return true}}
];

function grantRandomRunUpgrade(forceRare=false){
  const pool=forceRare?RUN_UPGRADES.filter(x=>['glass','bulwark','collector','critmaster','adrenaline'].includes(x.id)):RUN_UPGRADES;
  const u=pool[Math.floor(Math.random()*pool.length)];u.apply();ENDGAME.relics.push(u.id);AudioSys.levelBig?.();showToast(`${u.icon} ${u.name}`,1500);return u;
}

function createPhaseOverlay(){
  if($('routeOverlay'))return;
  const wrap=document.createElement('div');wrap.id='routeOverlay';wrap.className='screen';wrap.innerHTML=`<div class="panel wide"><div class="panelHead"><div><h1>CHOOSE YOUR PATH</h1><p class="muted">Your next room changes the run. There is no single safe route.</p></div><button id="routeClose">✕</button></div><div id="routeChoices" class="upgradeGrid"></div></div>`;
  document.getElementById('app').appendChild(wrap);SCREENS.push('routeOverlay');
  $('routeClose').onclick=()=>{hide('routeOverlay');ENDGAME.routeOpen=false};
  const style=document.createElement('style');style.textContent=`#routeOverlay{z-index:50}.routeCard{min-height:180px}.routeCard .routeIcon{font-size:34px;margin-bottom:8px}.routeCard small{display:block;color:#9aa8c4;margin:8px 0 14px;line-height:1.5}`;document.head.appendChild(style);
}
function roomIcon(t){return {combat:'⚔️',ambush:'💀',elite:'👑',gauntlet:'🔥',trap:'☠️',shrine:'⛩️',challenge:'🎯',treasure:'💎',shop:'🛒',event:'✨',boss:'👹',secret:'🕳️',start:'🏰'}[t]||'❔'}
function routeDescription(r){
  const d=r.depth||0;
  const desc={combat:'Standard battle with balanced rewards.',ambush:'Enemies begin closer and attack faster.',elite:'Elite-heavy room. Better loot.',gauntlet:'Multiple enemy waves. Huge reward.',trap:'Hazards punish careless movement.',shrine:'A safe room with a permanent run blessing.',challenge:'Optional challenge with a large payout.',treasure:'Open the chest for guaranteed loot.',shop:'Mira sells powerful run upgrades.',event:'A random event with risk and reward.',boss:'A major boss encounter. Prepare.',secret:'Hidden cache. Rare rewards.'};
  const h=S.rooms[S.cur],dir=r.x>h.x?'EAST →':r.x<h.x?'← WEST':r.y>h.y?'SOUTH ↓':'NORTH ↑';return `${dir} · ${S.visited.has(r.id)?'EXPLORED · safe passage':desc[r.type]||'Unknown room'}`;
}
function openRouteChoices(){
  createPhaseOverlay();const here=S.rooms[S.cur];
  let adj=S.rooms.filter(r=>Math.abs(r.x-here.x)+Math.abs(r.y-here.y)===1 && !S.visited.has(r.id));
  if(!adj.length)adj=S.rooms.filter(r=>Math.abs(r.x-here.x)+Math.abs(r.y-here.y)===1);
  adj=S.rooms.filter(r=>Math.abs(r.x-here.x)+Math.abs(r.y-here.y)===1);
  ENDGAME.routeChoices=adj;ENDGAME.routeOpen=true;
  $('routeChoices').innerHTML=adj.map((r,i)=>`<div class="upgradeCard routeCard"><div class="routeIcon">${roomIcon(r.type)}</div><h3>${ENDGAME.roomVariantNames[r.variant||r.type]||r.type.toUpperCase()}</h3><small>${routeDescription(r)}</small><button type="button" data-route="${r.id}">ENTER PATH</button></div>`).join('');
  $('routeChoices').querySelectorAll('[data-route]').forEach(b=>b.onclick=()=>{const id=+b.dataset.route;hide('routeOverlay');ENDGAME.routeOpen=false;enterRoom(id)});
  show('routeOverlay');
}

// Branching routes: the player chooses instead of being silently sent to a random adjacent room.
const _nextRoomPhase2=nextRoom;
nextRoom=function(){
  if(isOpen('routeOverlay'))return;
  const here=S.rooms[S.cur];let adj=S.rooms.filter(r=>Math.abs(r.x-here.x)+Math.abs(r.y-here.y)===1 && !S.visited.has(r.id));
  if(!adj.length)adj=S.rooms.filter(r=>Math.abs(r.x-here.x)+Math.abs(r.y-here.y)===1);
  if(!adj.length){showToast('NO FURTHER PATH',1200);return;}
  openRouteChoices();
};

// More meaningful world composition. Existing graph remains compatible with saved runs.
const _generateWorldPhase2=generateWorld;
generateWorld=function(){
  _generateWorldPhase2();
  const candidates=S.rooms.slice(1).sort((a,b)=>a.depth-b.depth);
  for(const r of candidates){
    if(['boss','shop','event','treasure','secret'].includes(r.type))continue;
    const roll=R();
    r.variant=roll<.08?'ambush':roll<.15?'elite':roll<.22?'gauntlet':roll<.29?'trap':roll<.35?'shrine':roll<.40?'challenge':'standard';
  }
  // Guarantee a few special destinations in the first half of a run.
  const specials=candidates.filter(r=>r.type==='combat');
  if(specials[0])specials[0].variant='elite';
  if(specials[1])specials[1].variant='treasure';
  if(specials[2])specials[2].variant='challenge';
};

// Room variants and events are layered on top of the existing room engine.
const _enterRoomPhase2=enterRoom;
enterRoom=function(id){
  _enterRoomPhase2(id);
  const r=S.rooms[id];if(!r)return;
  S.roomTrial=false;S.roomTrialMult=1;
  if(r.type==='combat' && r.variant && r.variant!=='standard'){
    S.enemies=[];S.enemyBullets=[];S.particles=[];
    if(r.variant==='ambush'){
      const keys=Object.keys(ENEMIES);for(let i=0;i<7+Math.floor(S.room*.2);i++)spawnEnemy(keys[(i+S.room)%keys.length]);
      showToast('💀 AMBUSH · THEY WERE WAITING',1400);
    }else if(r.variant==='elite'){
      for(let i=0;i<4+Math.floor(S.room*.15);i++){spawnEnemy(i%2?'tank':'runner');if(S.enemies[i])S.enemies[i].elite=true;}
      showToast('👑 ELITE HUNT · RARE REWARDS',1400);
    }else if(r.variant==='gauntlet'){
      S.gauntlet={wave:0,max:3,timer:0};S.enemies=[];spawnGauntletWave();showToast('🔥 GAUNTLET · 3 WAVES',1400);
    }else if(r.variant==='trap'){
      S.traps=[];for(let i=0;i<6;i++)S.traps.push({x:180+R()*920,y:150+R()*450,r:22,t:R()*2.5});
      showToast('☠️ TRAP HALL · WATCH THE FLOOR',1400);
    }else if(r.variant==='shrine'){
      S.enemies=[];S.combatPhase='explore';S.combatActive=true;S.event={x:640,y:340,kind:'shrine',used:r.cleared};if(r.cleared)S.door={x:640,y:110};
      showToast('⛩️ SHRINE · A BLESSING AWAITS',1400);
    }else if(r.variant==='challenge'){
      S.enemies=[];S.combatPhase='explore';S.combatActive=true;S.event={x:640,y:340,kind:'challenge',used:r.cleared};if(r.cleared)S.door={x:640,y:110};
      showToast('🎯 CHALLENGE ROOM · PRESS E',1400);
    }else if(r.variant==='treasure'){
      S.enemies=[];S.combatPhase='explore';S.combatActive=true;S.chest={x:640,y:340,open:r.cleared};if(r.cleared)S.door={x:640,y:110};
      showToast('💎 TREASURE PATH · GUARANTEED LOOT',1400);
    }
  }
  if(r.type==='event' && !r.cleared){
    const ev=ROOM_EVENTS[Math.floor(R()*ROOM_EVENTS.length)];S.event={x:640,y:340,kind:'custom',eventId:ev.id,used:false};
  }
};
function spawnGauntletWave(){
  if(!S.gauntlet)return;S.gauntlet.wave++;const base=4+S.gauntlet.wave*2;for(let i=0;i<base;i++){const keys=Object.keys(ENEMIES);spawnEnemy(keys[Math.floor(R()*keys.length)])}
  showToast(`🔥 WAVE ${S.gauntlet.wave}/${S.gauntlet.max}`,900);
}

// Special room logic is inserted before normal completion checks.
const _updatePhase2Core=update;
update=function(dt,now){
  // Trap hazards.
  if(S.running && S.traps && canUpdateGame()){
    for(const t of S.traps){t.t+=dt;if(t.t>3)t.t=0;if(t.t<.22 && Math.hypot(S.p.x-t.x,S.p.y-t.y)<t.r+S.p.r)hurtPlayer(18);}
  }
  // Gauntlet wave progression.
  if(S.running && S.gauntlet && canUpdateGame() && S.combatPhase!=='ready' && S.enemies.length===0){
    if(S.gauntlet.wave<S.gauntlet.max){S.roomClearedPending=true;spawnGauntletWave();}
    else {S.gauntlet=null;S.roomClearedPending=true;S.completed.add(S.cur);S.rooms[S.cur].cleared=true;S.coins+=35;S.xp+=60;S.door={x:640,y:110};showToast('🔥 GAUNTLET CLEARED · BONUS LOOT',1700);setTimeout(()=>{S.roomClearedPending=false;},50)}
  }
  _updatePhase2Core(dt,now);
  if(S.rooms[S.cur]?.variant==='gauntlet' && S.gauntlet)S.roomClearedPending=true;
};

// Custom interactions: events, shrine and challenge rooms.
const _interactPhase2=interact;
interact=function(){
  if(!S.running||!canUpdateGame())return;
  const r=S.rooms[S.cur];
  if(S.event && Math.hypot(S.p.x-S.event.x,S.p.y-S.event.y)<95 && !S.event.used){
    if(S.event.kind==='custom'){
      const ev=ROOM_EVENTS.find(x=>x.id===S.event.eventId);if(ev){const ok=ev.action();if(ok!==false){S.event.used=true;r.cleared=true;S.completed.add(S.cur);S.door={x:640,y:110};saveRun();updateObjective();}}
      return;
    }
    if(S.event.kind==='shrine'){
      S.event.used=true;r.cleared=true;S.completed.add(S.cur);S.door={x:640,y:110};S.p.maxHp+=15;S.p.hp=S.p.maxHp;S.p.damageBonus=(S.p.damageBonus||0)+6;ENDGAME.relics.push('shrine');AudioSys.levelBig?.();showToast('⛩️ SHRINE BLESSING · +15 HP · +6 DAMAGE',1800);saveRun();updateObjective();return;
    }
    if(S.event.kind==='challenge'){
      S.event.used=true;r.cleared=true;S.completed.add(S.cur);S.door={x:640,y:110};S.coins+=55;S.xp+=75;grantRandomRunUpgrade();showToast('🎯 CHALLENGE COMPLETE · BONUS REWARD',1800);saveRun();updateObjective();return;
    }
  }
  if(r.variant==='trap' && S.door && Math.hypot(S.p.x-S.door.x,S.p.y-S.door.y)<95){nextRoom();return;}
  _interactPhase2();
};

// --------------------------------------------------------------------------
// PHASE 4 — ROGUELITE UPGRADE SYSTEM
// --------------------------------------------------------------------------
function showRunReward(){
  const pool=[...RUN_UPGRADES].sort(()=>Math.random()-.5).slice(0,3);window.currentRewardPool=pool.map(u=>[u.name,u.desc,u.apply,u]);
  const grid=$('runUpgradeGrid');if(!grid)return;
  grid.innerHTML=pool.map((u,i)=>`<div class="upgradeCard"><div class="rewardIconSmall">${u.icon}</div><h3>${u.name}</h3><p>${u.desc}</p><button type="button" data-i="${i}">TAKE RELIC</button></div>`).join('');
  $('rewardSub').textContent=`Room ${S.room+1} reward · choose one relic · ${ENDGAME.relics.length} collected`;
  show('roomReward');
}
function handleRewardSelect(index){const x=window.currentRewardPool?.[index];if(!x)return;x[2]();ENDGAME.relics.push(x[3].id);hide('roomReward');S.roomClearedPending=false;AudioSys.levelBig?.();showToast(`${x[3].icon} ${x[0]} EQUIPPED`,1400);saveRun();}

// Patch projectile damage with relic effects.
const _shootPhase4=shoot;
shoot=function(){
  const before=S.p.cool;_shootPhase4();
  if(S.p.twinShots && before<=0 && S.p.weapon && (S.p.shotCounter=(S.p.shotCounter||0)+1)%8===0){
    const w=WEAPONS[S.p.weapon],a=Math.atan2(mouse.y-S.p.y,mouse.x-S.p.x)+.10;S.bullets.push({x:S.p.x,y:S.p.y,vx:Math.cos(a)*w.speed,vy:Math.sin(a)*w.speed,r:4,d:(w.d+(S.weaponLevels[S.p.weapon]||0)*3+S.p.damageBonus)*.75,life:1.3,c:w.color,pierce:0,trail:[],crit:false,chain:false,weapon:S.p.weapon,hit:new Set()});
  }
};
const _damageEnemyPhase4=damageEnemy;
damageEnemy=function(e,d,src){
  if(e && S.p){if(S.p.executeBonus && e.hp/e.maxHp<.4)d*=1+S.p.executeBonus;if(S.p.adrenaline&&S.p.hp/S.p.maxHp<.45)d*=1.12;}
  const before=S.p?.hp||0;const dead=_damageEnemyPhase4(e,d,src);
  if(S.p?.vampire)S.p.hp=Math.min(S.p.maxHp,S.p.hp+d*S.p.vampire);
  if(dead&&S.p?.frostNova&&(S.kills%12===0)){for(const q of S.enemies){if(q!==e&&Math.hypot(q.x-e.x,q.y-e.y)<130)q.slow=Math.max(q.slow,2.5)}spawnBurst(e.x,e.y,'#7dd3fc',22)}
  if(dead&&S.p?.coinMult)S.coins+=Math.floor(.25*S.p.coinMult);
  return dead;
};

// --------------------------------------------------------------------------
// PHASE 6 — BOSS OVERHAUL
// --------------------------------------------------------------------------
const BOSS_SIGS={golem:'💀',witch:'🔮',beast:'🔥'};
const _hitBossPhase6=hitBoss;
hitBoss=function(d){
  if(!S.boss)return;const before=S.boss.hp;_hitBossPhase6(d);if(S.boss){ENDGAME.stats.damage+=Math.max(0,before-S.boss.hp);}
};
const _updateBossPhase6=updateBoss;
updateBoss=function(dt){
  _updateBossPhase6(dt);if(!S.boss)return;const b=S.boss,ratio=b.hp/b.maxHp;
  if(!b.extraPhase)b.extraPhase=1;
  const target=ratio<.12?5:ratio<.25?4:ratio<.5?3:ratio<.75?2:1;
  if(target!==b.extraPhase){b.extraPhase=target;AudioSys.bossPhase?.();showToast(`${BOSS_SIGS[b.kind]||'👑'} BOSS PHASE ${target}`,1400);addRing(b.x,b.y,b.c,60);S.shake=Math.max(S.shake,12)}
  b.phase=target;
  if(S.combatPhase==='attack'&&b.t<=0&&target>=4){
    b.t=.7;const a=Math.atan2(S.p.y-b.y,S.p.x-b.x);for(let i=0;i<10;i++)enemyShot(b,a+(i-4.5)*.22,26+target*2);spawnEnemy(target===5?'tank':'runner',b.x+60,b.y);
  }
  if(S.combatPhase==='attack'&&b.t<=0&&target===5){b.t=.55;for(let i=0;i<18;i++)enemyShot(b,i*Math.PI*2/18,35);}
};

// --------------------------------------------------------------------------
// PHASE 7 — VISUAL / ANIMATION OVERHAUL
// --------------------------------------------------------------------------
function drawPhase7Decor(now){
  if(!S.running)return;ctx.save();
  // Animated floor glyphs and room identity accents.
  const r=S.rooms[S.cur];const variant=r?.variant||r?.type;
  const accent={ambush:'#ef4444',elite:'#fbbf24',gauntlet:'#fb923c',trap:'#f43f5e',shrine:'#34d399',challenge:'#60a5fa',treasure:'#fbbf24',boss:'#c084fc'}[variant]||'#60a5fa';
  ctx.globalAlpha=.10+.04*Math.sin(now*.004);ctx.strokeStyle=accent;ctx.lineWidth=2;
  for(let i=0;i<4;i++){const x=160+i*320;ctx.beginPath();ctx.arc(x,610,28+Math.sin(now*.003+i)*5,0,Math.PI*2);ctx.stroke();}
  if(S.p.dashMomentum>0&&S.p.dashCd>0){ctx.globalAlpha=.35;ctx.strokeStyle='#22d3ee';ctx.beginPath();ctx.arc(S.p.x,S.p.y,30+Math.sin(now*.015)*5,0,Math.PI*2);ctx.stroke();}
  // Trap telegraphs.
  for(const t of (S.traps||[])){ctx.globalAlpha=.10+.12*Math.max(0,Math.sin(t.t*5));ctx.strokeStyle='#fb7185';ctx.beginPath();ctx.arc(t.x,t.y,t.r+8,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#fb7185';ctx.fillRect(t.x-3,t.y-3,6,6)}
  ctx.restore();
}
const _drawPhase7=draw;
draw=function(now){_drawPhase7(now);drawPhase7Decor(now);};

// --------------------------------------------------------------------------
// PHASE 8 — AUDIO / MUSIC OVERHAUL
// --------------------------------------------------------------------------
Object.assign(AudioSys,{
  roomVariant(v){const notes={ambush:[110,165],elite:[220,330],gauntlet:[146,220],trap:[98,147],shrine:[392,523],challenge:[261,392],treasure:[523,659]}[v]||[330,494];notes.forEach((n,i)=>this.tone(n,.12,'triangle',.045,'sfx',i*.08))},
  relic(){this.tone(330,.06,'square',.05);this.tone(495,.08,'triangle',.06,'sfx',.05);this.tone(660,.14,'sine',.055,'sfx',.12)},
  route(){this.tone(220,.05,'triangle',.04);this.tone(330,.07,'triangle',.05,'sfx',.05)},
  achievement(){[392,523,659,784].forEach((n,i)=>this.tone(n,.12,'triangle',.06,'sfx',i*.06))}
});
const _startMusic=AudioSys.startMusic.bind(AudioSys);
AudioSys.startMusic=function(){_startMusic();};

// --------------------------------------------------------------------------
// PHASE 9 — META PROGRESSION & UNLOCKS
// --------------------------------------------------------------------------
const META_UNLOCKS=[
  {id:'scatter',name:'SCATTERGUN LICENSE',need:10,desc:'Start future runs with Scattergun available.'},
  {id:'arc',name:'ARC WAND LICENSE',need:20,desc:'Arc Wand becomes a permanent arsenal option.'},
  {id:'frost',name:'FROST LICENSE',need:35,desc:'Frost Cannon joins the starting pool.'},
  {id:'vault',name:'VAULT KEY',need:50,desc:'Treasure rooms gain improved rewards.'},
  {id:'legend',name:'LEGENDARY HUNTER',need:80,desc:'+1 permanent luck (more drops).'}
];
function metaProgress(){return (META.lifetimeKills||0)+(META.bestRoom||0)*3+(META.bosses||0)*15}
function checkUnlocks(){const p=metaProgress();for(const u of META_UNLOCKS){if(p>=u.need&&!META[u.id]){META[u.id]=true;AudioSys.achievement?.();showToast(`🔓 ${u.name}`,1800)}}saveMeta()}
const _saveMetaPhase9=saveMeta;saveMeta=function(){_saveMetaPhase9();checkUnlocksNoSave();};
function checkUnlocksNoSave(){const p=metaProgress();for(const u of META_UNLOCKS){if(p>=u.need&&!META[u.id]){META[u.id]=true;AudioSys.achievement?.();}}renderMeta?.();}
const _diePhase9=die;die=function(){_diePhase9();checkUnlocks();};
const _finalEscapePhase9=finalEscape;finalEscape=function(){META.bosses=(META.bosses||0)+1;checkUnlocks();_finalEscapePhase9();};

// --------------------------------------------------------------------------
// PHASE 10 — BALANCE, SAFETY, STATS & QUALITY OF LIFE
// --------------------------------------------------------------------------
function qualityPass(){
  // Prevent runaway values after long runs.
  if(S.p){S.p.hp=Math.min(S.p.hp,S.p.maxHp);S.p.spd=Math.min(420,Math.max(90,S.p.spd));S.p.damageBonus=Math.min(250,S.p.damageBonus||0);S.p.maxHp=Math.min(500,S.p.maxHp);}
  S.combo=Math.min(99,Math.max(0,S.combo||0));S.coins=Math.max(0,Math.floor(S.coins||0));
  if(S.enemies.length>32)S.enemies.splice(32);if(S.enemyBullets.length>180)S.enemyBullets.splice(180);if(S.particles.length>600)S.particles.splice(600);
}
const _updatePhase10=update;
update=function(dt,now){
  _updatePhase10(dt,now);qualityPass();
  if(S.running){ENDGAME.stats.rooms=Math.max(ENDGAME.stats.rooms,S.room+1);ENDGAME.stats.coins=Math.max(ENDGAME.stats.coins,S.coins);}
};

// Better save data: relics and player run modifiers survive Continue.
const _saveRunPhase10=saveRun;
saveRun=function(){
  if(S.running){S._phaseRelics=ENDGAME.relics.slice();S._phaseStats={...ENDGAME.stats};}
  _saveRunPhase10();
};
const _loadRunPhase10=loadRun;
loadRun=function(){_loadRunPhase10();ENDGAME.relics=S._phaseRelics||[];ENDGAME.stats={...ENDGAME.stats,...(S._phaseStats||{})};};

// Upgrade HUD chip and route status.
function renderRelicHUD(){
  if(!S.running)return;let el=$('relicHud');if(!el){el=document.createElement('div');el.id='relicHud';el.className='statusPills';$('hud').querySelector('.hudLeft')?.appendChild(el)}
  el.innerHTML=ENDGAME.relics.slice(-5).map(id=>{const u=RUN_UPGRADES.find(x=>x.id===id);return `<span title="${u?.desc||''}">${u?.icon||'◆'} ${u?.name||id}</span>`}).join('');
}
const _updateHUDPhase10=updateHUD;
updateHUD=function(){_updateHUDPhase10();renderRelicHUD();};

// Initialize and make the phase controls visible in the existing map UI.
createPhaseOverlay();


// Phase 9: expose permanent unlocks directly in the META screen.
const _renderMetaUpgradesPhase9=renderMetaUpgrades;
renderMetaUpgrades=function(){
  _renderMetaUpgradesPhase9();
  const grid=$('metaUpgradeGrid');if(!grid)return;
  const wrap=document.createElement('div');wrap.style.cssText='grid-column:1/-1;margin-top:10px;border-top:1px solid #26324a;padding-top:14px';
  wrap.innerHTML='<h2 style="margin:0 0 8px">🔓 DUNGEON UNLOCKS</h2><p class="muted">Lifetime progress unlocks new possibilities in future runs.</p>'+META_UNLOCKS.map(u=>`<div class="upgradeCard"><h3>${u.name} ${META[u.id]?'✅':'🔒'}</h3><p>${u.desc}</p><small class="muted">Requirement: ${u.need} progress · Current: ${metaProgress()}</small></div>`).join('');
  grid.appendChild(wrap);
};

// Phase 8: adaptive procedural music reacts to room danger.
AudioSys.startMusic=function(){
  if(this.timer)return;this.ensure();this.step=0;
  this.timer=setInterval(()=>{
    if(this.muted)return;
    const r=S.rooms[S.cur];const boss=!!S.boss;let notes=boss?[92,110,138,164,138,110]:r?.variant==='elite'?[220,277,330,277]:r?.variant==='gauntlet'?[146,174,220,174]:r?.variant==='shrine'?[392,523,659,523]:r?.type==='shop'?[261,330,392,330]:[220,277,330,247];
    const n=notes[this.step++%notes.length];this.tone(n,boss?.18:.24,boss?'sawtooth':'triangle',boss?.032:.018,'music');
    if(boss&&this.step%4===0)this.tone(n/2,.18,'sine',.018,'music',.02);
  },270);
};


// ============================================================================
// V1.2 FULL POLISH PASS — ART, JUICE, BOSS IDENTITY, UX, ACHIEVEMENTS
// ============================================================================
const V12 = {
  started: false,
  hitFlash: 0,
  killStreak: 0,
  lastKills: 0,
  lastRoom: -1,
  fullscreen: false,
  achievements: [
    {id:'first_blood', name:'FIRST BLOOD', desc:'Defeat your first enemy.', icon:'✦', test:()=>(META.lifetimeKills>=1||S.kills>=1)},
    {id:'combo_10', name:'HOT STREAK', desc:'Reach a 10-hit combo.', icon:'⚡', test:()=>V12.bestCombo>=10},
    {id:'room_10', name:'DEEP DELVER', desc:'Reach room 10.', icon:'◆', test:()=>(META.bestRoom>=10||S.room>=9)},
    {id:'boss_1', name:'THRONE BREAKER', desc:'Defeat a boss.', icon:'♛', test:()=>META.bosses>=1},
    {id:'boss_3', name:'BOSS HUNTER', desc:'Defeat three bosses.', icon:'☠', test:()=>META.bosses>=3},
    {id:'coins_500', name:'TREASURE HOARDER', desc:'Carry 500 coins in a run.', icon:'◈', test:()=>S.coins>=500},
    {id:'perfect', name:'CLEAN CLEAR', desc:'Clear a room without taking damage.', icon:'◇', test:()=>V12.perfectRooms>=1},
    {id:'arsenal', name:'MASTER OF STEEL', desc:'Unlock five weapons in the arsenal.', icon:'⚔', test:()=>(S.p&&S.p.owned||[]).length>=5}
  ],
  unlocked:new Set(),
  bestCombo:0,
  perfectRooms:0,
  roomDamageTaken:0
};
try{
  const saved=JSON.parse(localStorage.getItem('db_v12')||'{}');
  V12.unlocked=new Set(saved.unlocked||[]); V12.bestCombo=saved.bestCombo||0; V12.perfectRooms=saved.perfectRooms||0;
}catch{}
function saveV12(){localStorage.setItem('db_v12',JSON.stringify({unlocked:[...V12.unlocked],bestCombo:V12.bestCombo,perfectRooms:V12.perfectRooms}))}
function v12AchievementTick(){
  V12.bestCombo=Math.max(V12.bestCombo,S.combo||0);
  for(const a of V12.achievements){
    if(!V12.unlocked.has(a.id) && a.test()){
      V12.unlocked.add(a.id); saveV12(); AudioSys.achievement?.();
      showToast(`🏆 ${a.name} · ${a.desc}`,2400);
      S.score+=250;
    }
  }
}
function openAchievements(){
  let el=$('achievementsOverlay');
  if(!el){
    el=document.createElement('section');el.id='achievementsOverlay';el.className='screen';
    el.innerHTML=`<div class="panel wide v12Achievements"><div class="panelHead"><div><h1>🏆 ACHIEVEMENTS</h1><p class="muted">Permanent challenges with small gameplay rewards.</p></div><button id="closeAchievements">✕</button></div><div id="achievementGrid" class="achievementGrid"></div></div>`;
    $('app').appendChild(el); SCREENS.push('achievementsOverlay');
    $('closeAchievements').onclick=()=>hide('achievementsOverlay');
  }
  const grid=$('achievementGrid');
  grid.innerHTML=V12.achievements.map(a=>`<article class="achievementCard ${V12.unlocked.has(a.id)?'unlocked':''}"><div class="achievementIcon">${a.icon}</div><div><b>${a.name}</b><p>${a.desc}</p></div><span>${V12.unlocked.has(a.id)?'UNLOCKED':'LOCKED'}</span></article>`).join('');
  show('achievementsOverlay');
}
function toggleFullscreen(){
  const root=document.documentElement;
  if(!document.fullscreenElement){root.requestFullscreen?.().catch(()=>{});V12.fullscreen=true;showToast('FULLSCREEN ENABLED',900)}
  else {document.exitFullscreen?.().catch(()=>{});V12.fullscreen=false;showToast('FULLSCREEN DISABLED',900)}
}
function v12FullscreenButtons(){
  if(!$('fullscreenBtn')){
    const b=document.createElement('button');b.id='fullscreenBtn';b.textContent='⛶ FULLSCREEN';b.className='v12FullBtn';
    $('mainMenu').querySelector('.menuCard')?.appendChild(b);b.onclick=toggleFullscreen;
  }
  if(!$('hudFullscreenBtn')){
    const b=document.createElement('button');b.id='hudFullscreenBtn';b.textContent='⛶';b.title='Fullscreen';
    $('hud').querySelector('.hudButtons')?.prepend(b);b.onclick=toggleFullscreen;
  }
  if(!$('achievementsBtn')){
    const b=document.createElement('button');b.id='achievementsBtn';b.textContent='🏆 ACHIEVEMENTS';
    $('mainMenu').querySelector('.menuCard')?.appendChild(b);b.onclick=openAchievements;
  }
}

// --------------------------- Pixel-art character set -----------------------
function v12SpriteFrame(type, size, now, hit){
  const k=size/24, bob=Math.sin(now*.009+(type.length||1))*1.2, hurt=hit?.14:0;
  const P={
    grunt:['#45131a','#b91c1c','#ef4444','#fecaca','#fde68a'],
    runner:['#4a1709','#c2410c','#f97316','#fed7aa','#fde68a'],
    shooter:['#062d45','#0369a1','#22d3ee','#cffafe','#67e8f9'],
    tank:['#111827','#475569','#94a3b8','#e2e8f0','#dbeafe'],
    mage:['#2b0b3d','#7e22ce','#d946ef','#f5d0fe','#f0abfc'],
    splitter:['#172a08','#4d7c0f','#84cc16','#d9f99d','#fef08a']
  }[type]||['#111827','#475569','#94a3b8','#e2e8f0','#fef08a'];
  ctx.save();ctx.translate(Math.round(bob*0),Math.round(bob));
  if(hurt)ctx.globalAlpha=.82;
  const [dark,mid,light,hi,eye]=P;
  px(-9*k,5*k,6*k,12*k,dark);px(3*k,5*k,6*k,12*k,dark);
  px(-12*k,-4*k,24*k,14*k,mid);px(-9*k,-8*k,18*k,9*k,light);
  px(-7*k,-6*k,14*k,5*k,hi);px(-11*k,2*k,22*k,5*k,dark);
  px(-8*k,-16*k,16*k,9*k,dark);px(-7*k,-17*k,14*k,8*k,mid);px(-5*k,-14*k,10*k,4*k,light);
  px(-5*k,-12*k,3*k,2*k,eye);px(2*k,-12*k,3*k,2*k,eye);
  if(type==='tank'){px(10*k,-1*k,7*k,15*k,mid);px(14*k,2*k,9*k,10*k,dark);px(16*k,-2*k,7*k,3*k,hi)}
  if(type==='runner'){px(9*k,-2*k,4*k,18*k,hi);px(12*k,-6*k,3*k,7*k,light)}
  if(type==='shooter'){px(9*k,-2*k,18*k,4*k,dark);px(24*k,-5*k,7*k,10*k,hi)}
  if(type==='mage'){px(10*k,-9*k,4*k,20*k,mid);px(8*k,-13*k,8*k,4*k,hi)}
  if(type==='splitter'){px(-14*k,-2*k,4*k,18*k,light);px(10*k,-2*k,4*k,18*k,light)}
  ctx.restore();
}

drawEnemySprite=function(e,size,hit=false){
  const facing=S.p?.x>=e.x?1:-1;
  ctx.save();ctx.translate(Math.round(e.x),Math.round(e.y));ctx.scale(facing,1);
  px(-size*.9,size*.62,size*1.8,5,'#0009');
  v12SpriteFrame(e.type,size,S.bgPulse*100,hit);
  const pulse=.5+.5*Math.sin((S.bgPulse*7)+(e.phaseOffset||0));
  if(e.elite){ctx.globalAlpha=.25+.2*pulse;ctx.strokeStyle='#fbbf24';ctx.lineWidth=2;ctx.strokeRect(-size*.8,-size*1.05,size*1.6,size*1.5);ctx.globalAlpha=1;px(-4,-size*1.28,8,3,'#fde68a')}
  if(e.mode==='attack'){ctx.globalAlpha=.75;ctx.fillStyle='#fb7185';ctx.fillRect(-size*.72,-size*1.08,size*1.44,3);ctx.globalAlpha=1}
  if(e.mode==='defense'){ctx.globalAlpha=.55;ctx.strokeStyle='#60a5fa';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,size*.92,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1}
  ctx.restore();
};

drawBoss=function(b){
  ctx.save();ctx.translate(Math.round(b.x),Math.round(b.y));
  const p=b.phase||1, pulse=.5+.5*Math.sin(S.bgPulse*6), flash=b.hitFlash>0;
  if(flash)ctx.globalAlpha=.7;
  px(-56,42,112,9,'#000b');
  const C=b.kind==='golem'?['#1e293b','#64748b','#cbd5e1','#e2e8f0','#67e8f9']:b.kind==='witch'?['#210b35','#6d28d9','#a78bfa','#f5d0fe','#f0abfc']:['#431307','#c2410c','#f97316','#fed7aa','#fff7ed'];
  ctx.globalAlpha=.14+.07*pulse;ctx.fillStyle=C[2];ctx.beginPath();ctx.arc(0,0,70+p*7+Math.sin(S.bgPulse*4)*5,0,Math.PI*2);ctx.fill();ctx.globalAlpha=flash?.7:1;
  if(b.kind==='golem'){
    px(-42,-38,84,68,C[0]);px(-36,-34,72,56,C[1]);px(-27,-50,54,18,C[2]);px(-22,-18,44,28,C[2]);
    px(-12,-8,8,8,C[4]);px(4,-8,8,8,C[4]);px(-48,-12,12,34,C[1]);px(36,-12,12,34,C[1]);
    px(-28,30,18,18,C[0]);px(10,30,18,18,C[0]);
  }else if(b.kind==='witch'){
    px(-40,-34,80,62,C[0]);px(-34,-30,68,54,C[1]);px(-25,-17,50,38,C[2]);px(-10,-8,7,7,C[3]);px(3,-8,7,7,C[3]);
    px(-47,-49,94,9,C[1]);px(-33,-60,66,12,C[2]);px(26,-12,7,44,C[1]);px(21,-17,17,6,C[3]);
  }else{
    px(-43,-36,86,64,C[0]);px(-36,-31,72,56,C[1]);px(-27,-20,54,39,C[2]);px(-11,-8,8,8,C[4]);px(3,-8,8,8,C[4]);
    px(-49,5,15,30,C[0]);px(34,5,15,30,C[0]);px(-22,-47,15,10,C[2]);px(7,-47,15,10,C[2]);
  }
  // Boss-specific telegraph language.
  if(b.telegraph>0){ctx.globalAlpha=.35+.25*Math.sin(S.bgPulse*18);ctx.strokeStyle='#fb7185';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,78+p*7,0,Math.PI*2);ctx.stroke();}
  if(S.combatPhase==='defense'){ctx.globalAlpha=.45;ctx.strokeStyle='#60a5fa';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,64+p*4,0,Math.PI*2);ctx.stroke();}
  if(b.t<=.25&&S.combatPhase==='attack'){ctx.globalAlpha=.22+.16*pulse;ctx.strokeStyle=C[3];ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,90+p*9,0,Math.PI*2);ctx.stroke();}
  ctx.restore();
};

// --------------------------- Combat feedback & sound -----------------------
Object.assign(AudioSys,{
  blaster(){this.tone(210,.045,'square',.075);this.tone(320,.035,'triangle',.025,'sfx',.018)},
  volt(){this.tone(480,.035,'square',.045);this.tone(760,.04,'sine',.035,'sfx',.02)},
  rail(){this.noise(.11,.10);this.tone(70,.16,'sawtooth',.075);this.tone(880,.08,'triangle',.04,'sfx',.02)},
  arc(){this.tone(620,.045,'sine',.045);this.tone(930,.06,'sine',.035,'sfx',.025)},
  frost(){this.tone(260,.08,'triangle',.05);this.tone(520,.12,'sine',.035,'sfx',.05)},
  enemyAttack(kind='grunt'){const f={grunt:120,runner:180,shooter:260,tank:80,mage:420,splitter:150}[kind]||120;this.tone(f,.07,'sawtooth',.035)},
  bossAttack(kind){const f={golem:72,witch:210,beast:105}[kind]||90;this.tone(f,.12,'sawtooth',.055);this.tone(f*1.5,.08,'triangle',.035,'sfx',.04)},
  explosion(){this.noise(.16,.12);this.tone(65,.22,'sawtooth',.065)},
  achievement(){[392,523,659,784,1046].forEach((n,i)=>this.tone(n,.11,'triangle',.055,'sfx',i*.055))}
});
const _shootV12=shoot;
shoot=function(){
  const before=S.bullets.length; _shootV12();
  if(S.bullets.length>before){
    const snd={Blaster:'blaster',VoltSMG:'volt','Rail Lance':'rail','Arc Wand':'arc','Frost Cannon':'frost',Scattergun:'shotgun'}[S.p.weapon];
    AudioSys[snd]?.();
    S.p.weaponFlash=.14; S.p.recoil=Math.max(S.p.recoil||0,.12);
    spawnBurst(S.p.x+Math.cos(Math.atan2(mouse.y-S.p.y,mouse.x-S.p.x))*22,S.p.y+Math.sin(Math.atan2(mouse.y-S.p.y,mouse.x-S.p.x))*22,WEAPONS[S.p.weapon].color,S.p.weapon==='Rail Lance'?10:5);
  }
};

// Add a stronger death/crit signature without changing the existing damage model.
const _damageV12=damageEnemy;
damageEnemy=function(e,d,src){
  const hp=e?.hp||0; const crit=d>hp*.45; const dead=_damageV12(e,d,src);
  if(e){
    if(crit)spawnBurst(e.x,e.y,'#fde68a',10);
    if(dead){spawnBurst(e.x,e.y,e.c,18);addRing(e.x,e.y,e.c,e.r*1.4);AudioSys.explosion();}
  }
  return dead;
};
const _hurtV12=hurtPlayer;
hurtPlayer=function(amount,source){V12.roomDamageTaken+=amount;_hurtV12(amount,source);if(source?.kind)AudioSys.enemyAttack(source.kind)};

// --------------------------- Bullet rendering ------------------------------
function drawV12ProjectileLayer(now){
  ctx.save();
  for(const b of S.bullets){
    const ang=Math.atan2(b.vy,b.vx), speed=Math.hypot(b.vx,b.vy), len=Math.min(46,10+speed*.025);
    ctx.globalAlpha=.18;ctx.strokeStyle=b.c;ctx.lineWidth=b.weapon==='Rail Lance'?8:5;ctx.beginPath();ctx.moveTo(b.x-Math.cos(ang)*len,b.y-Math.sin(ang)*len);ctx.lineTo(b.x,b.y);ctx.stroke();
    ctx.globalAlpha=.95;ctx.fillStyle=b.crit?'#fff7b2':b.c;ctx.fillRect(b.x-2,b.y-2,b.weapon==='Rail Lance'?8:5,b.weapon==='Rail Lance'?5:5);
  }
  for(const b of S.enemyBullets){ctx.globalAlpha=.22;ctx.fillStyle=b.c;ctx.beginPath();ctx.arc(b.x,b.y,b.r*2.2,0,Math.PI*2);ctx.fill();ctx.globalAlpha=.9;ctx.fillStyle=b.c;ctx.fillRect(Math.round(b.x-b.r),Math.round(b.y-b.r),Math.round(b.r*2),Math.round(b.r*2));}
  ctx.restore();
}
const _drawV12=draw;
draw=function(now){_drawV12(now);drawV12ProjectileLayer(now);};
const _updateBossV12=updateBoss;
updateBoss=function(dt){
  const before=S.boss?.t||0; _updateBossV12(dt);
  if(S.boss && before>0 && S.boss.t<=0 && S.combatPhase==='attack'){AudioSys.bossAttack(S.boss.kind);S.shake=Math.max(S.shake,S.boss.phase>=3?6:3);}
};

// --------------------------- Dungeon decoration ----------------------------
function drawV12RoomDecor(now){
  if(!S.running)return;ctx.save();
  const room=S.rooms[S.cur], variant=room?.variant||room?.type;
  const colors={ambush:'#ef4444',elite:'#fbbf24',gauntlet:'#fb923c',trap:'#f43f5e',shrine:'#34d399',challenge:'#60a5fa',treasure:'#fbbf24',boss:'#c084fc',shop:'#38bdf8',event:'#a78bfa'};
  const c=colors[variant]||'#64748b';
  // Torches / banners / floor glyphs create a distinct identity for each room.
  for(const x of [70,1210]){
    ctx.globalAlpha=.10+.04*Math.sin(now*.005+x);ctx.fillStyle=c;ctx.beginPath();ctx.arc(x,155,48,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=.75;ctx.fillStyle='#3f4c63';ctx.fillRect(x-3,170,6,25);ctx.fillStyle=c;ctx.fillRect(x-2,154,4,12);
  }
  ctx.globalAlpha=.18;ctx.strokeStyle=c;ctx.lineWidth=2;
  for(let i=0;i<3;i++){const x=260+i*380;ctx.beginPath();ctx.arc(x,580,26+Math.sin(now*.003+i)*4,0,Math.PI*2);ctx.stroke();}
  if(variant==='treasure'||variant==='shrine'){ctx.globalAlpha=.35+.12*Math.sin(now*.006);ctx.fillStyle=c;for(let i=0;i<5;i++){const x=420+i*110,y=250+Math.sin(now*.002+i)*12;ctx.fillRect(x,y,3,3)}}
  ctx.restore();
}
const _drawDecorV12=draw;
draw=function(now){_drawDecorV12(now);drawV12RoomDecor(now);};

// --------------------------- Better route/map presentation -----------------
const _drawMapV12=drawMap;
drawMap=function(){
  _drawMapV12();
  const c=mapCtx; c.save();
  c.font='900 11px monospace';c.textAlign='left';c.fillStyle='#dbeafe';
  c.fillText(`DEPTH ${Math.max(1,S.room+1)} · ${S.rooms.length} ROOMS`,18,22);
  c.fillStyle='#7f91b1';c.font='10px monospace';c.fillText('Gold = treasure · Violet = boss · Cyan = shop · Red = danger',18,40);
  c.restore();
};

// --------------------------- Meta rewards / unlock economy -----------------
function v12RewardForAchievement(id){
  const rewards={first_blood:10,combo_10:20,room_10:30,boss_1:40,boss_3:75,coins_500:25,perfect:35,arsenal:60};
  return rewards[id]||0;
}
function grantV12AchievementRewards(){
  let changed=false;
  for(const a of V12.achievements){
    if(V12.unlocked.has(a.id)){
      const key='reward_'+a.id;
      if(!META[key]){META[key]=true;META.coins=(META.coins||0)+v12RewardForAchievement(a.id);changed=true;}
    }
  }
  if(changed)_saveMetaPhase9();
}

// --------------------------- Responsive / game feel ------------------------
const _updateV12=update;
update=function(dt,now){
  _updateV12(dt,now);
  v12AchievementTick();
  grantV12AchievementRewards();
  if(S.combo>V12.bestCombo)V12.bestCombo=S.combo;
  if(S.cur!==V12.lastRoom){
    if(V12.lastRoom>=0 && V12.roomDamageTaken<=0){V12.perfectRooms++;saveV12();}
    V12.lastRoom=S.cur;V12.roomDamageTaken=0;
  }
  v12FullscreenButtons();
};

// Keep all transient arrays bounded even if a long session stresses the browser.
const _spawnParticleV12=spawnParticle;
spawnParticle=function(x,y,c,life=.4){if(S.particles.length<850)_spawnParticleV12(x,y,c,life)};
const _spawnBurstV12=spawnBurst;
spawnBurst=function(x,y,c,n=10){_spawnBurstV12(x,y,c,Math.min(n,30))};



// ============================================================================
// V1.3 — FIXES, WEAPON OWNERSHIP, I-FRAMES, RELIC COMPLETION, QoL
// ============================================================================
const _newRunV13=newRun;
newRun=function(){ENDGAME.relics=[];S.traps=null;S.gauntlet=null;S.progress=0;V12.roomDamageTaken=0;V12.lastRoom=-1;_newRunV13();};
const _loadRunV13=loadRun;
loadRun=function(){
  let d=null;try{d=JSON.parse(localStorage.getItem("db_run")||"null")}catch{}
  if(d){ENDGAME.relics=d.relics||[];S.progress=d.progress!==undefined?d.progress:Math.max(0,(d.visited||[]).length-1);}
  _loadRunV13();
};
const _applyMetaV13=applyMeta;
applyMeta=function(){
  _applyMetaV13();
  const o=["Blaster"];if(META.scatter)o.push("Scattergun");if(META.arc)o.push("Arc Wand");if(META.frost)o.push("Frost Cannon");
  S.p.owned=o;S.p.iframes=0;
};
// Room entry: progress-based difficulty, no stale traps, safe rooms don't fire "room cleared", revisits are free.
const _enterRoomV13=enterRoom;
enterRoom=function(id){
  const r0=S.rooms[id];S.traps=null;S.gauntlet=null;
  if(r0&&!S.visited.has(id))S.progress=(S.progress||0)+1;
  _enterRoomV13(id);
  const room=S.rooms[S.cur];if(!room)return;
  const t=room.type,v=room.variant;
  const safe=["start","shop","treasure","secret","event"].includes(t)||["shrine","challenge","treasure"].includes(v);
  if(safe){S.enemies=[];S.completed.add(S.cur);if(t==="start"){room.cleared=true;S.door={x:640,y:110};}}
  else if(room.cleared){
    S.enemies=[];S.boss=null;S.enemyBullets=[];S.gauntlet=null;S.traps=null;S.combatPhase="explore";S.combatActive=true;
    S.completed.add(S.cur);S.roomClearedPending=false;S.door={x:640,y:110};
    $("combatPhaseHud").style.display="none";showToast("Room already cleared.",1400);
  }
  S.p.iframes=Math.max(S.p.iframes||0,.8);
  updateObjective();
};
// Invulnerability frames (also fixes trap tiles hitting every frame) + thorns relic.
const _hurtV13=hurtPlayer;
hurtPlayer=function(a,src){
  if(!S.p||(S.p.iframes||0)>0)return;
  _hurtV13(a,src);S.p.iframes=.3;
  if(S.p.thorns&&src){const d=a*S.p.thorns;if(src===S.boss)hitBoss(d);else if(src.hp>0)damageEnemy(src,d,src);}
};
const _dashV13=dash;
dash=function(){
  const was=S.p.dashCd;_dashV13();
  if(S.p.dashCd>0&&was<=0){S.p.iframes=Math.max(S.p.iframes||0,.28);if(S.p.dashMomentum)S.p.momentumTimer=2;}
};
const _shootV13=shoot;
shoot=function(){
  const before=S.p.cool;_shootV13();
  if(before<=0&&S.p.cool>0){
    if(S.p.momentumTimer>0)S.p.cool*=.72;
    if(S.p.adrenaline&&S.p.hp/S.p.maxHp<.45)S.p.cool*=.9;
  }
};
const _updateV13=update;
update=function(dt,now){
  if(S.running&&S.p&&canUpdateGame()){
    S.p.iframes=Math.max(0,(S.p.iframes||0)-dt);S.p.momentumTimer=Math.max(0,(S.p.momentumTimer||0)-dt);
    if(S.p.comboBoost&&S.comboTimer>0)S.comboTimer+=dt*(S.p.comboBoost/(1+S.p.comboBoost));
    if(S.p.adrenaline&&S.p.hp/S.p.maxHp<.45){
      let dx=(keys.d?1:0)-(keys.a?1:0)+(keys.arrowright?1:0)-(keys.arrowleft?1:0),dy=(keys.s?1:0)-(keys.w?1:0)+(keys.arrowdown?1:0)-(keys.arrowup?1:0);
      const l=Math.hypot(dx,dy);if(l)moveEntity(S.p,dx/l*S.p.spd*.12*dt,dy/l*S.p.spd*.12*dt);
    }
  }
  _updateV13(dt,now);
};
// Weapons must be owned: Blaster + license unlocks at start, the rest from Mira.
cycleWeapon=function(dir=1){
  if(!S.running||!canUpdateGame())return;
  const own=S.p.owned||["Blaster"];let i=Math.max(0,own.indexOf(S.p.weapon));
  S.p.weapon=own[(i+dir+own.length)%own.length];S.p.cool=Math.min(S.p.cool,.04);S.p.weaponFlash=.28;
  AudioSys.ensure();AudioSys.weaponSwitch();
  showToast(`${WEAPONS[S.p.weapon].icon} ${S.p.weapon.toUpperCase()} · ${WEAPONS[S.p.weapon].style}`,850);updateHUD();
};
const _shopBuyV13=handleShopPurchase;
handleShopPurchase=function(i){
  const item=SHOP_ITEMS[i];if(!item)return;const name=item[0];
  if(WEAPONS[name]&&(S.p.owned||[]).includes(name)){S.p.weapon=name;showToast(name+" equipped (already owned)",1200);updateHUD();return}
  const c=S.coins;_shopBuyV13(i);
  if(WEAPONS[name]&&S.coins<c&&!(S.p.owned||[]).includes(name))S.p.owned.push(name);
};
const _equipV13=equipFromArsenal;
equipFromArsenal=function(n){
  if(S.running&&!(S.p.owned||[]).includes(n)){showToast(n+" is not owned — buy it from Mira",1500);return}
  _equipV13(n);
};
// HUD: consumable counts, hide unowned weapons in the quickbar.
const _updateHUDV13=updateHUD;
updateHUD=function(){
  _updateHUDV13();if(!S.running)return;
  let el=$("invPill");if(!el){el=document.createElement("span");el.id="invPill";const sp=document.querySelector(".statusPills");if(sp)sp.appendChild(el)}
  const inv=S.p.inv||[],n=k=>inv.filter(x=>x===k).length;
  if(el)el.textContent=`🧪${n("Potion")} 💣${n("Bomb")} 🧲${n("Magnet")}`;
  const own=S.p.owned||["Blaster"],qb=$("weaponQuickbar");
  if(qb)qb.querySelectorAll("button").forEach(b=>b.style.display=own.includes(b.dataset.weapon)?"":"none");
};
// Map: reveal neighbouring rooms as "?" so the player can route toward the boss.
const _drawMapV13=drawMap;
drawMap=function(){
  _drawMapV13();if(!S.rooms.length)return;
  const c=mapCtx,m=S.rooms,minX=Math.min(...m.map(r=>r.x)),maxX=Math.max(...m.map(r=>r.x)),minY=Math.min(...m.map(r=>r.y)),maxY=Math.max(...m.map(r=>r.y));
  const sc=Math.min((mapCanvas.width-120)/Math.max(1,maxX-minX+1),(mapCanvas.height-100)/Math.max(1,maxY-minY+1)),ox=60-minX*sc,oy=50-minY*sc;
  const col={treasure:"#fbbf24",shop:"#a78bfa",event:"#34d399",boss:"#ef4444",secret:"#f472b6"};
  c.save();c.textAlign="center";c.textBaseline="middle";c.font="bold 13px monospace";
  for(const r of m){
    if(S.visited.has(r.id)||!m.some(q=>S.visited.has(q.id)&&Math.abs(q.x-r.x)+Math.abs(q.y-r.y)===1))continue;
    c.globalAlpha=.4;c.fillStyle=col[r.type]||"#64748b";c.beginPath();c.arc(ox+r.x*sc,oy+r.y*sc,Math.max(9,Math.min(16,sc*.18)),0,Math.PI*2);c.fill();
    c.globalAlpha=.9;c.fillStyle="#fff";c.fillText("?",ox+r.x*sc,oy+r.y*sc);
  }
  c.restore();
};
// On-canvas interaction prompts, i-frame ring, colour-assist outlines.
const _drawV13=draw;
draw=function(now){
  _drawV13(now);
  if(!S.running||!S.p)return;
  const near=(o,r)=>o&&Math.hypot(S.p.x-o.x,S.p.y-o.y)<r;let t=null,x=0,y=0;
  if(canUpdateGame()){
    if(near(S.npc,90)){t="[E] SHOP";x=S.npc.x;y=S.npc.y-54}
    else if(S.chest&&!S.chest.open&&near(S.chest,90)){t="[E] OPEN";x=S.chest.x;y=S.chest.y-44}
    else if(S.event&&!S.event.used&&near(S.event,90)){t="[E] USE";x=S.event.x;y=S.event.y-48}
    else if(S.door&&near(S.door,95)){t=S.rooms[S.cur]?.type==="boss"?"[E] ESCAPE":"[E] DESCEND";x=S.door.x;y=S.door.y+40}
  }
  ctx.save();ctx.textAlign="center";
  if(t){ctx.font="bold 13px monospace";const w=ctx.measureText(t).width+18;ctx.globalAlpha=.88;ctx.fillStyle="#0b1120";ctx.fillRect(x-w/2,y-13,w,22);ctx.strokeStyle="#fbbf24";ctx.lineWidth=1;ctx.strokeRect(x-w/2,y-13,w,22);ctx.globalAlpha=1;ctx.fillStyle="#fde68a";ctx.fillText(t,x,y+3)}
  if((S.p.iframes||0)>0){ctx.globalAlpha=.25+.25*Math.sin(now*.03);ctx.strokeStyle="#fff";ctx.lineWidth=2;ctx.beginPath();ctx.arc(S.p.x,S.p.y,24,0,Math.PI*2);ctx.stroke()}
  if(SETTINGS.colorAssist){ctx.globalAlpha=.95;ctx.strokeStyle="#fff";ctx.lineWidth=2;for(const b of S.enemyBullets){ctx.beginPath();ctx.arc(b.x,b.y,b.r+3,0,Math.PI*2);ctx.stroke()}}
  ctx.restore();
};
// Space = dash (or advance dialogue); auto-pause when the window loses focus.
window.addEventListener("keydown",e=>{
  if(e.code!=="Space")return;e.preventDefault();
  if(isOpen("dialogueScreen"))advanceDialogue();else dash();
});
window.addEventListener("blur",()=>{
  if(S.running&&canUpdateGame()&&!isOpen("dialogueScreen"))show("pauseMenu");
});


// ============================================================================
// V1.4 — VISUAL OVERHAUL: art, lighting, particles, adaptive mood & music
// ============================================================================
const V14={mood:.15,parts:[],decals:[],lights:[],floor:null,key:'',amb:0,walk:0,px:0,py:0,vx:0,vy:0,t:0,lc:document.createElement('canvas')};
V14.lc.width=W;V14.lc.height=H;
const V14_TORCH=[[70,170],[200,170],[380,170],[900,170],[1080,170],[1210,170]];
const PAL=[
 {fa:'#1a2a40',fb:'#16243a',ln:'#0d1728',hi:'#2b3f5e',wt:'#5d718c',wf:'#33455e',wd:'#0e1626',ac:'#60a5fa',tc:'#fbbf24'},
 {fa:'#3a2028',fb:'#321a22',ln:'#1c0d12',hi:'#5a303a',wt:'#8a5a5e',wf:'#55303a',wd:'#1c0b10',ac:'#fb7185',tc:'#fb923c'},
 {fa:'#16332f',fb:'#122b28',ln:'#0a1a18',hi:'#24524a',wt:'#4f8a7c',wf:'#2c5148',wd:'#08201c',ac:'#34d399',tc:'#a3e635'},
 {fa:'#2a1d45',fb:'#241a3b',ln:'#130c24',hi:'#44326e',wt:'#7a63b0',wf:'#42336b',wd:'#120a24',ac:'#c084fc',tc:'#e879f9'},
 {fa:'#2b1212',fb:'#230f0f',ln:'#110606',hi:'#4a1c1c',wt:'#8a3434',wf:'#4a1d1d',wd:'#150606',ac:'#ef4444',tc:'#f97316'}];
function v14Idx(){const t=difficultyStage().tier;return S.rooms[S.cur]?.type==='boss'?4:Math.min(4,Math.floor(t/2))}
function v14Pal(){return PAL[v14Idx()]}
const v14R=(a,b)=>a+Math.random()*(b-a);
function v14P(o){if(V14.parts.length<1600)V14.parts.push(o)}
function v14Burst(x,y,c,n=10,f=1){
  n=Math.min(n,34);
  for(let i=0;i<n;i++){const a=Math.random()*6.283,sp=(50+Math.random()*230)*f,k=Math.random();
    if(k<.55)v14P({k:'spark',x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:.25+Math.random()*.4,max:.65,c,r:1+Math.random()*2.5,drag:.9});
    else if(k<.85)v14P({k:'shard',x,y,vx:Math.cos(a)*sp*.6,vy:Math.sin(a)*sp*.6-40,g:420,life:.5+Math.random()*.5,max:1,c,r:2+Math.random()*3,rot:Math.random()*6,vr:(Math.random()-.5)*14,drag:.97});
    else v14P({k:'smoke',x,y,vx:Math.cos(a)*40,vy:Math.sin(a)*40-20,life:.6+Math.random()*.5,max:1.1,c:'#94a3b8',r:5+Math.random()*7,drag:.93});
  }
}
spawnBurst=function(x,y,c,n=10){v14Burst(x,y,c,n,1)};
spawnParticle=function(x,y,c,life=.4){v14P({k:'spark',x,y,vx:v14R(-50,50),vy:v14R(-50,50),life,max:life,c,r:2,drag:.92})};
addPolishBurst=function(x,y,c,n=12,f=1){v14Burst(x,y,c,n,f)};
drawV12RoomDecor=function(){};drawV12ProjectileLayer=function(){};

// ---------------- Terrain: cached floor, back wall, obstacles ----------------
function v14BuildFloor(P,idx){
  const c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d'),r=rng(S.seed+S.cur*977);
  for(let y=70;y<H;y+=32)for(let x=0;x<W;x+=32){
    g.fillStyle=((x+y)/32+S.cur)%2?P.fa:P.fb;g.fillRect(x,y,32,32);
    g.globalAlpha=.35;g.fillStyle=P.hi;g.fillRect(x,y,32,2);g.fillRect(x,y,2,32);
    g.globalAlpha=.8;g.fillStyle=P.ln;g.fillRect(x,y+30,32,2);g.fillRect(x+30,y,2,32);g.globalAlpha=1;
    const q=r();
    if(q<.2){g.globalAlpha=.3;g.fillStyle=P.hi;g.fillRect(x+4+r()*20,y+4+r()*20,3,2);g.globalAlpha=1}
    else if(q<.28){g.strokeStyle=P.ln;g.lineWidth=1;g.beginPath();let cx=x+6+r()*20,cy=y+3;g.moveTo(cx,cy);for(let i=0;i<4;i++){cx+=r()*8-4;cy+=6;g.lineTo(cx,cy)}g.stroke()}
    else if(q<.36&&idx>0){g.globalAlpha=.28;g.fillStyle=idx===1?'#7f1d1d':idx===2?'#3f8f4a':P.ac;g.beginPath();g.ellipse(x+16,y+16,4+r()*9,3+r()*6,r()*3,0,6.3);g.fill();g.globalAlpha=1}
  }
  const t=S.rooms[S.cur]?.variant||S.rooms[S.cur]?.type;
  g.strokeStyle=P.ac;g.fillStyle=P.ac;g.lineWidth=2;g.globalAlpha=.2;
  const big=['boss','shop','shrine','treasure','challenge','event','secret','start'].includes(t),R=big?150:210;
  g.beginPath();g.arc(640,410,R,0,6.3);g.stroke();g.beginPath();g.arc(640,410,R-14,0,6.3);g.stroke();
  for(let i=0;i<16;i++){const a=i*Math.PI/8;g.fillRect(640+Math.cos(a)*(R-7)-2,410+Math.sin(a)*(R-7)-2,4,4)}
  if(big){g.beginPath();for(let i=0;i<5;i++){const a=-Math.PI/2+i*Math.PI*4/5;g.lineTo(640+Math.cos(a)*(R-30),410+Math.sin(a)*(R-30))}g.closePath();g.stroke()}
  g.globalAlpha=1;
  g.fillStyle=P.wd;g.fillRect(0,70,36,H);g.fillRect(W-36,70,36,H);g.fillRect(0,H-36,W,36);
  g.globalAlpha=.5;g.fillStyle=P.wf;for(let y=70;y<H;y+=16){g.fillRect(0,y,36,1);g.fillRect(W-36,y,36,1)}for(let x=0;x<W;x+=40)g.fillRect(x,H-36,1,36);
  g.globalAlpha=1;g.fillStyle=P.wt;g.fillRect(34,70,3,H);g.fillRect(W-37,70,3,H);g.fillRect(0,H-38,W,3);
  const vg=g.createRadialGradient(640,400,250,640,400,760);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.5)');g.fillStyle=vg;g.fillRect(0,70,W,H);
  return c;
}
function v14Floor(now){
  const idx=v14Idx(),key=S.cur+'|'+S.seed+'|'+idx;
  if(key!==V14.key){V14.key=key;V14.floor=v14BuildFloor(PAL[idx],idx);V14.decals=[];V14.parts=V14.parts.filter(p=>p.k==='mote'||p.k==='ember'||p.k==='fly')}
  ctx.drawImage(V14.floor,0,0);
  for(const d of V14.decals){ctx.globalAlpha=.32;ctx.fillStyle=d.c;ctx.beginPath();ctx.ellipse(d.x,d.y+6,d.r*1.2,d.r*.55,d.rot,0,6.3);ctx.fill();for(let i=0;i<4;i++)ctx.fillRect(d.x+Math.cos(i*2+d.rot)*d.r*1.5,d.y+Math.sin(i*2+d.rot)*d.r*.8,3,2)}
  ctx.globalAlpha=1;
  const P=v14Pal();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.05+.05*Math.sin(now*.002)+V14.mood*.05;ctx.fillStyle=P.ac;ctx.beginPath();ctx.arc(640,410,150,0,6.3);ctx.fill();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
}
drawDungeonAtmosphere=function(now){
  const P=v14Pal(),m=V14.mood;
  let g=ctx.createLinearGradient(0,70,0,245);g.addColorStop(0,P.wd);g.addColorStop(1,P.wf);ctx.fillStyle=g;ctx.fillRect(0,70,W,175);
  ctx.fillStyle=P.wd;ctx.globalAlpha=.55;for(let y=78,row=0;y<240;y+=18,row++){ctx.fillRect(0,y+16,W,2);for(let x=-(row%2)*30;x<W;x+=60)ctx.fillRect(x,y,2,18)}ctx.globalAlpha=1;
  for(const x of [110,290,470,810,990,1170]){
    ctx.fillStyle=P.wt;ctx.fillRect(x-52,118,8,127);ctx.fillRect(x+44,118,8,127);ctx.beginPath();ctx.arc(x,118,52,Math.PI,0);ctx.fill();
    ctx.fillStyle=P.wd;ctx.beginPath();ctx.arc(x,120,42,Math.PI,0);ctx.fill();ctx.fillRect(x-42,120,84,125);
    ctx.fillStyle='#000';ctx.globalAlpha=.35;ctx.fillRect(x-42,180,84,65);ctx.globalAlpha=1;
  }
  for(const x of [290,990]){ctx.fillStyle=P.ac;ctx.globalAlpha=.55;ctx.beginPath();ctx.moveTo(x-16,84);ctx.lineTo(x+16,84);ctx.lineTo(x+16,150+Math.sin(now*.003+x)*3);ctx.lineTo(x,138);ctx.lineTo(x-16,150-Math.sin(now*.003+x)*3);ctx.closePath();ctx.fill();ctx.globalAlpha=.8;ctx.fillStyle=P.wd;ctx.fillRect(x-3,100,6,6);ctx.globalAlpha=1}
  ctx.fillStyle=P.wt;ctx.fillRect(640-60,72,120,60);ctx.fillStyle=P.wd;ctx.fillRect(640-46,80,92,52);ctx.fillStyle=P.wf;ctx.fillRect(640-12,72,24,12);
  for(const [x,y] of V14_TORCH){
    const fl=.85+.15*Math.sin(now*.02+x)+Math.random()*.08;
    ctx.fillStyle='#3f4c63';ctx.fillRect(x-3,y,6,22);ctx.fillStyle='#1f2937';ctx.fillRect(x-6,y-3,12,5);
    ctx.fillStyle=P.tc;ctx.beginPath();ctx.moveTo(x-6,y-3);ctx.quadraticCurveTo(x-8*fl,y-14,x,y-26*fl);ctx.quadraticCurveTo(x+8*fl,y-14,x+6,y-3);ctx.fill();
    ctx.fillStyle='#fde68a';ctx.beginPath();ctx.moveTo(x-3,y-3);ctx.quadraticCurveTo(x,y-18*fl,x+3,y-3);ctx.fill();
  }
  ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.045*(1-Math.min(1,m*1.4));ctx.fillStyle='#fde68a';
  for(const x of [220,560,900]){ctx.beginPath();ctx.moveTo(x,70);ctx.lineTo(x+50,70);ctx.lineTo(x+250,520);ctx.lineTo(x+120,520);ctx.fill()}
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
};
function v14Wall(w,now){
  const P=v14Pal();
  ctx.globalAlpha=.45;ctx.fillStyle='#000';ctx.fillRect(w.x+7,w.y+11,w.w,w.h);ctx.globalAlpha=1;
  const lg=ctx.createLinearGradient(0,w.y,0,w.y+w.h);lg.addColorStop(0,P.wt);lg.addColorStop(.1,P.wf);lg.addColorStop(1,P.wd);ctx.fillStyle=lg;ctx.fillRect(w.x,w.y,w.w,w.h);
  ctx.fillStyle=P.wd;ctx.globalAlpha=.5;
  for(let yy=w.y+9,row=0;yy<w.y+w.h-2;yy+=12,row++){ctx.fillRect(w.x,yy,w.w,1);for(let xx=w.x+8-(row%2)*12;xx<w.x+w.w-2;xx+=24)if(xx>w.x)ctx.fillRect(xx,yy,1,12)}
  ctx.globalAlpha=1;ctx.fillStyle=P.wt;ctx.fillRect(w.x,w.y,w.w,3);ctx.fillRect(w.x,w.y,2,w.h);ctx.fillStyle='#000';ctx.globalAlpha=.4;ctx.fillRect(w.x+w.w-2,w.y,2,w.h);ctx.fillRect(w.x,w.y+w.h-2,w.w,2);ctx.globalAlpha=1;
  if(v14Idx()===2){ctx.fillStyle='#3f8f4a';ctx.globalAlpha=.55;for(let i=0;i<Math.min(8,w.w/22);i++)ctx.fillRect(w.x+(i*37+w.y)%Math.max(8,w.w-8),w.y,7,3+(i%3)*2);ctx.globalAlpha=1}
  if(w.w*w.h>5000){const a=.35+.35*Math.sin(now*.004+w.x),cx=w.x+w.w/2,cy=w.y+w.h/2;ctx.globalCompositeOperation='lighter';ctx.globalAlpha=a;ctx.fillStyle=P.ac;ctx.beginPath();ctx.moveTo(cx,cy-6);ctx.lineTo(cx+4,cy);ctx.lineTo(cx,cy+6);ctx.lineTo(cx-4,cy);ctx.fill();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1}
  ctx.fillStyle=P.hi;for(const [a,b] of [[3,5],[w.w-6,5],[3,w.h-6],[w.w-6,w.h-6]])ctx.fillRect(w.x+a,w.y+b,3,3);
}

// ---------------- Player & weapons ----------------
function v14Weapon(n,c,fl,now){
  if(n==='Scattergun'){px(8,-4,26,8,'#4b5563');px(8,-4,26,2,'#9ca3af');px(30,-5,6,4,'#111827');px(30,1,6,4,'#111827');px(10,2,10,5,'#7c2d12')}
  else if(n==='VoltSMG'){px(8,-3,22,7,'#1f2937');px(10,-5,14,2,c);px(24,-2,10,3,'#64748b');px(14,3,5,8,'#0f172a');px(12,-3,2,7,c)}
  else if(n==='Rail Lance'){px(6,-2,44,5,'#374151');px(10,-3,36,1,c);px(46,-3,8,7,'#e9d5ff');px(14,3,8,4,'#1e1b4b')}
  else if(n==='Arc Wand'){px(6,-1,30,3,'#78350f');px(6,-1,30,1,'#b45309');ctx.globalCompositeOperation='lighter';ctx.fillStyle=c;ctx.globalAlpha=.6;ctx.beginPath();ctx.arc(40,0,8+Math.sin(now*.01)*2,0,6.3);ctx.fill();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;px(37,-3,6,6,'#d1fae5')}
  else if(n==='Frost Cannon'){px(6,-5,24,11,'#0f4c75');px(8,-4,20,3,'#7dd3fc');px(28,-6,10,13,'#bae6fd');px(30,-9,3,5,'#e0f2fe');px(34,5,3,5,'#e0f2fe')}
  else{px(8,-3,22,7,'#334155');px(8,-3,22,2,'#94a3b8');px(28,-2,6,4,c);px(12,3,5,7,'#1e293b')}
  if(fl>0){const L={Scattergun:36,VoltSMG:34,'Rail Lance':54,'Arc Wand':40,'Frost Cannon':38}[n]||34;
    ctx.globalCompositeOperation='lighter';const g=ctx.createRadialGradient(L,0,1,L,0,22);g.addColorStop(0,'#fff');g.addColorStop(.3,c);g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.globalAlpha=Math.min(1,fl*10);ctx.fillRect(L-22,-22,44,44);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1}
}
drawPlayer=function(p,now){
  const aim=Math.atan2(mouse.y-p.y,mouse.x-p.x),f=Math.cos(aim)>=0?1:-1,w=WEAPONS[p.weapon]||WEAPONS.Blaster;
  const mv=Math.hypot(V14.vx,V14.vy),walk=Math.min(1,mv/150),ph=V14.walk,bob=Math.sin(ph*2)*1.6*walk+Math.sin(now*.004)*.8;
  const sway=Math.max(-9,Math.min(9,-V14.vx*f*.03));
  ctx.save();ctx.translate(Math.round(p.x),Math.round(p.y));
  if((p.boostDamage||1)>1||p.boostFire>0||p.shieldTimer>0||p.speedTimer>0){ctx.globalAlpha=.2+.1*Math.sin(now*.012);ctx.strokeStyle=p.shieldTimer>0?'#60a5fa':p.boostDamage>1?'#fb7185':'#fbbf24';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,27+Math.sin(now*.01)*3,0,6.3);ctx.stroke();ctx.globalAlpha=1}
  ctx.save();ctx.scale(f,1);ctx.translate(0,Math.round(bob));
  const fl=Math.sin(now*.01)*2;
  ctx.fillStyle='#3730a3';ctx.beginPath();ctx.moveTo(-6,-9);ctx.lineTo(3,-9);ctx.bezierCurveTo(1+sway,4,-3+sway*1.3,12,-9+sway*1.6+fl*.5,19);ctx.lineTo(-17+sway*1.6,17+fl*.4);ctx.bezierCurveTo(-13+sway,8,-11,0,-6,-9);ctx.fill();
  ctx.fillStyle='#4f46e5';ctx.beginPath();ctx.moveTo(-5,-8);ctx.lineTo(0,-8);ctx.bezierCurveTo(-2+sway,4,-6+sway,10,-10+sway*1.4,16);ctx.lineTo(-12+sway*1.4,14);ctx.bezierCurveTo(-10,6,-8,-2,-5,-8);ctx.fill();
  const s1=Math.sin(ph)*5*walk,s2=-s1;
  px(-6+s1,8,5,9,'#1e1b4b');px(2+s2,8,5,9,'#1e1b4b');px(-7+s1,15,8,4,'#0f172a');px(1+s2,15,8,4,'#0f172a');
  px(-8,-8,16,17,'#475569');px(-6,-6,12,9,'#94a3b8');px(-6,-6,12,2,'#e2e8f0');px(-8,6,16,3,'#92400e');px(-2,6,4,3,'#fbbf24');
  px(-10,-9,6,6,'#64748b');px(4,-9,6,6,'#64748b');px(-10,-9,6,2,'#cbd5e1');px(4,-9,6,2,'#cbd5e1');
  ctx.globalCompositeOperation='lighter';ctx.fillStyle='#22d3ee';ctx.globalAlpha=.5+.3*Math.sin(now*.006);ctx.beginPath();ctx.arc(0,-1,6,0,6.3);ctx.fill();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;px(-2,-3,4,4,'#a5f3fc');
  px(-9,-10,16,3,'#6366f1');px(-13+sway,-9+Math.sin(now*.012)*1.2,6,3,'#818cf8');
  px(-7,-22,14,13,'#1e1b4b');px(-5,-19,12,9,'#0b1020');px(-9,-20,3,7,'#312e81');px(-7,-22,14,2,'#4338ca');
  ctx.globalCompositeOperation='lighter';ctx.fillStyle='#22d3ee';ctx.globalAlpha=.7;ctx.fillRect(0,-16,7,3);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;px(1,-15,5,1,'#fff');
  ctx.restore();
  ctx.save();ctx.translate(0,Math.round(-2+bob));ctx.rotate(aim);if(f<0)ctx.scale(1,-1);ctx.translate(-(p.recoil||0)*35,0);
  px(2,-3,8,7,'#94a3b8');v14Weapon(p.weapon,w.color,p.muzzle||0,now);px(5,-2,5,5,'#cbd5e1');ctx.restore();
  ctx.restore();
  if(p.magnetTimer>0){ctx.globalAlpha=.18;ctx.strokeStyle='#34d399';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,85+Math.sin(now*.01)*6,0,6.3);ctx.stroke();ctx.globalAlpha=1}
};

// ---------------- Enemies ----------------
drawEnemySprite=function(e,size,hit=false){
  const k=size/20,t=S.bgPulse,ph=e.phaseOffset||0,att=e.mode==='attack',sp=Math.max(0,e.spawnAnim||0),C=c=>hit?'#fff':c;
  const bob=Math.sin(t*(att?10:5)+ph*3)*1.5*k,face=S.p&&S.p.x>=e.x?1:-1,ty=e.type;
  ctx.save();ctx.translate(Math.round(e.x),Math.round(e.y+bob));
  if(sp>0){ctx.scale(1,.4+.6*(1-sp/.55));ctx.globalAlpha=1-sp}
  ctx.scale(face,1);
  if(ty==='grunt'){
    px(-8*k,8*k,6*k,9*k,C('#3f0b12'));px(3*k,8*k,6*k,9*k,C('#3f0b12'));px(-11*k,-8*k,22*k,17*k,C('#991b1b'));px(-8*k,-6*k,16*k,4*k,C('#dc2626'));px(-11*k,5*k,22*k,3*k,C('#450a0a'));
    px(-8*k,-20*k,16*k,12*k,C('#475569'));px(-8*k,-20*k,16*k,3*k,C('#94a3b8'));px(-12*k,-25*k,4*k,9*k,C('#e5e7eb'));px(8*k,-25*k,4*k,9*k,C('#e5e7eb'));px(1*k,-15*k,6*k,2*k,C('#fde68a'));
    ctx.save();ctx.translate(10*k,-2*k);ctx.rotate((att?Math.sin(t*10+ph)*.7:.3)-.4);px(0,-2*k,5*k,20*k,C('#78350f'));px(-3*k,14*k,11*k,9*k,C('#64748b'));px(-3*k,14*k,11*k,2*k,C('#cbd5e1'));ctx.restore();
  }else if(ty==='runner'){
    ctx.rotate(att?-.28:-.08);px(-6*k,8*k,5*k,10*k,C('#431407'));px(2*k,8*k,5*k,10*k,C('#431407'));px(-8*k,-8*k,16*k,17*k,C('#c2410c'));px(-6*k,-6*k,12*k,4*k,C('#fb923c'));
    px(-6*k,-19*k,13*k,11*k,C('#7c2d12'));px(-9*k,-17*k,5*k,3*k,C('#fb923c'));px(2*k,-15*k,5*k,2*k,C('#fde68a'));
    px(8*k,-6*k,16*k,2*k,C('#f1f5f9'));px(8*k,2*k,16*k,2*k,C('#e2e8f0'));
    if(e.dashWindup>0){ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.4+.3*Math.sin(t*40);ctx.fillStyle='#ef4444';ctx.beginPath();ctx.arc(0,-2*k,16*k,0,6.3);ctx.fill();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1}
    if(e.dashTime>0){ctx.globalAlpha=.4;px(-34*k,-8*k,26*k,2*k,'#fb923c');px(-40*k,2*k,32*k,2*k,'#fed7aa');ctx.globalAlpha=1}
  }else if(ty==='shooter'){
    px(-8*k,-6*k,16*k,23*k,C('#075985'));px(-6*k,-4*k,12*k,5*k,C('#0891b2'));px(-8*k,13*k,16*k,3*k,C('#082f49'));
    px(-7*k,-21*k,14*k,14*k,C('#082f49'));px(-5*k,-18*k,11*k,9*k,C('#020617'));
    ctx.globalCompositeOperation='lighter';ctx.fillStyle=C('#67e8f9');ctx.globalAlpha=.8;ctx.fillRect(1*k,-15*k,6*k,3*k);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
    px(6*k,-3*k,24*k,4*k,C('#334155'));px(8*k,-5*k,8*k,3*k,C('#94a3b8'));
    if(e.t<.4&&att){ctx.globalCompositeOperation='lighter';ctx.fillStyle='#67e8f9';ctx.globalAlpha=.7;ctx.beginPath();ctx.arc(31*k,-1*k,6*k*(1-e.t),0,6.3);ctx.fill();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1}
  }else if(ty==='tank'){
    px(-10*k,9*k,8*k,9*k,C('#111827'));px(3*k,9*k,8*k,9*k,C('#111827'));px(-16*k,-10*k,32*k,22*k,C('#334155'));px(-14*k,-8*k,28*k,6*k,C('#64748b'));px(-16*k,-10*k,32*k,3*k,C('#cbd5e1'));
    px(-6*k,-21*k,12*k,11*k,C('#1f2937'));px(-4*k,-16*k,10*k,2*k,C('#dbeafe'));px(-19*k,-13*k,6*k,8*k,C('#94a3b8'));px(-17*k,-18*k,2*k,5*k,C('#e5e7eb'));
    px(10*k,-14*k,10*k,30*k,C('#94a3b8'));px(12*k,-6*k,6*k,14*k,C('#475569'));px(11*k,-12*k,2*k,2*k,'#e2e8f0');px(11*k,12*k,2*k,2*k,'#e2e8f0');
  }else if(ty==='mage'){
    ctx.translate(0,-5*k);
    ctx.save();ctx.scale(1,.35);ctx.rotate(t*1.5);ctx.globalAlpha=.5;ctx.strokeStyle='#f0abfc';ctx.lineWidth=2;ctx.setLineDash([6,5]);ctx.beginPath();ctx.arc(0,60*k,16*k,0,6.3);ctx.stroke();ctx.restore();
    ctx.fillStyle=C('#701a75');ctx.beginPath();ctx.moveTo(-5*k,-8*k);ctx.lineTo(5*k,-8*k);ctx.lineTo(12*k,17*k);ctx.lineTo(0,13*k);ctx.lineTo(-12*k,17*k);ctx.fill();
    px(-4*k,-6*k,8*k,12*k,C('#c026d3'));px(-7*k,-21*k,14*k,14*k,C('#3b0764'));px(-5*k,-18*k,11*k,9*k,C('#0b0213'));px(1*k,-15*k,5*k,2*k,C('#f0abfc'));
    ctx.globalCompositeOperation='lighter';ctx.fillStyle='#f0abfc';ctx.globalAlpha=.6+.3*Math.sin(t*8);ctx.beginPath();ctx.arc(13*k,-4*k+Math.sin(t*3)*2,6*k,0,6.3);ctx.fill();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;px(11*k,-6*k+Math.sin(t*3)*2,4*k,4*k,'#fdf4ff');
  }else{
    const sq=1+Math.sin(t*6+ph)*.09;ctx.scale(sq,1/sq);
    ctx.globalAlpha=.92;ctx.fillStyle=C('#4d7c0f');ctx.beginPath();ctx.ellipse(0,4*k,16*k,14*k,0,Math.PI,0);ctx.lineTo(16*k,14*k);ctx.lineTo(-16*k,14*k);ctx.fill();
    ctx.fillStyle=C('#84cc16');ctx.beginPath();ctx.ellipse(-2*k,2*k,12*k,10*k,0,Math.PI,0);ctx.lineTo(12*k,12*k);ctx.lineTo(-14*k,12*k);ctx.fill();ctx.globalAlpha=1;
    ctx.fillStyle=C('#d9f99d');for(let i=0;i<3;i++){ctx.globalAlpha=.7;ctx.beginPath();ctx.arc(Math.sin(t*2+i*2+ph)*6*k,4*k+Math.cos(t*3+i)*3*k,3*k,0,6.3);ctx.fill()}ctx.globalAlpha=1;
    px(-6*k,-2*k,4*k,5*k,'#1a2e05');px(2*k,-2*k,4*k,5*k,'#1a2e05');px(-5*k,-1*k,2*k,2*k,'#fef08a');px(3*k,-1*k,2*k,2*k,'#fef08a');px(-8*k,-6*k,6*k,2*k,'rgba(255,255,255,.5)');
  }
  if(e.elite){const a=.35+.25*Math.sin(t*7);ctx.globalCompositeOperation='lighter';ctx.globalAlpha=a;ctx.strokeStyle='#fbbf24';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,-2*k,19*k,0,6.3);ctx.stroke();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
    px(-6*k,-31*k,12*k,3*k,'#fbbf24');px(-6*k,-34*k,3*k,3*k,'#fde68a');px(-1*k,-35*k,3*k,4*k,'#fde68a');px(3*k,-34*k,3*k,3*k,'#fde68a')}
  if(att){ctx.globalAlpha=.7;px(-size*.7,-size*1.2,size*1.4,2,'#fb7185');ctx.globalAlpha=1}
  else if(e.mode==='defense'){ctx.globalAlpha=.35;ctx.strokeStyle='#60a5fa';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,-2*k,size*.95,-2.2,.9);ctx.stroke();ctx.globalAlpha=1}
  ctx.restore();
};

// ---------------- Mood, particles, lighting ----------------
function v14Update(dt,now){
  V14.t+=dt;const p=S.p,P=v14Pal();
  if(V14.px||V14.py){V14.vx+=((p.x-V14.px)/dt-V14.vx)*Math.min(1,dt*12);V14.vy+=((p.y-V14.py)/dt-V14.vy)*Math.min(1,dt*12)}
  V14.px=p.x;V14.py=p.y;const mv=Math.hypot(V14.vx,V14.vy);V14.walk+=dt*mv*.075;
  if(mv>60&&Math.random()<dt*14)v14P({k:'smoke',x:p.x+v14R(-5,5),y:p.y+16,vx:-V14.vx*.1,vy:v14R(-12,-4),life:.4,max:.4,c:P.hi,r:3+Math.random()*2,drag:.9});
  let tg=.15;const ph=S.combatPhase;
  tg=ph==='attack'?.68:ph==='defense'?.42:ph==='ready'?.3:.15;
  if(S.boss)tg=Math.max(tg,S.boss.phase>=3?.95:.82);
  tg+=Math.min(.18,S.combo*.008);if(p.hp/p.maxHp<.35)tg+=.18;
  V14.mood+=(Math.min(1,tg)-V14.mood)*Math.min(1,dt*1.1);
  const m=V14.mood;V14.amb+=dt*(5+m*22);
  while(V14.amb>1){V14.amb--;
    if(Math.random()<.55*(1-m)+.1){const fly=m<.4&&Math.random()<.3;v14P({k:fly?'fly':'mote',x:v14R(50,W-50),y:v14R(100,H-40),vx:v14R(-8,8),vy:v14R(-14,-3),life:v14R(4,8),max:6,c:fly?'#fde68a':P.ac,r:fly?2.5:1.5,ph:Math.random()*6})}
    else{const t=V14_TORCH[Math.floor(Math.random()*V14_TORCH.length)];v14P({k:'ember',x:Math.random()<.6?t[0]+v14R(-6,6):v14R(40,W-40),y:Math.random()<.6?t[1]-20:H-30,vx:v14R(-25,25),vy:-v14R(30,60+m*80),life:v14R(1.2,2.6),max:2.4,c:P.tc,r:1+Math.random()*2})}
  }
  for(const b of S.bullets){if(Math.random()<dt*34){const c=b.weapon==='Frost Cannon'?'#e0f2fe':b.c;v14P({k:'spark',x:b.x,y:b.y,vx:v14R(-25,25),vy:v14R(-25,25),life:.22,max:.22,c,r:1.5+Math.random()*1.5,drag:.9})}}
  for(const b of S.enemyBullets){if(Math.random()<dt*20)v14P({k:'spark',x:b.x,y:b.y,vx:v14R(-15,15),vy:v14R(-15,15),life:.3,max:.3,c:b.c,r:1.5,drag:.9})}
  for(const e of S.enemies)if(e.spawnAnim>0){e.spawnAnim=Math.max(0,e.spawnAnim-dt)}
  if(S.boss&&Math.random()<dt*(10+m*20)){const a=Math.random()*6.283;v14P({k:'ember',x:S.boss.x+Math.cos(a)*S.boss.r,y:S.boss.y+Math.sin(a)*S.boss.r,vx:Math.cos(a)*30,vy:-v14R(20,70),life:1.2,max:1.2,c:S.boss.c,r:2})}
  for(const q of V14.parts){
    if(q.k==='fly'||q.k==='mote'){q.vx+=Math.cos(V14.t*(q.k==='fly'?2:.8)+q.ph)*(q.k==='fly'?30:6)*dt;if(q.k==='fly')q.vy+=Math.sin(V14.t*1.7+q.ph)*30*dt}
    q.x+=q.vx*dt;q.y+=q.vy*dt;if(q.g)q.vy+=q.g*dt;if(q.drag){const d=Math.pow(q.drag,dt*60);q.vx*=d;q.vy*=d}if(q.vr)q.rot+=q.vr*dt;q.life-=dt;
  }
  V14.parts=V14.parts.filter(q=>q.life>0);
  for(const l of V14.lights)l.life-=dt;V14.lights=V14.lights.filter(l=>l.life>0);
}
function v14Death(e){
  const c=e.elite?'#fbbf24':e.c;v14Burst(e.x,e.y,c,30,1.3);
  for(let i=0;i<10;i++)v14P({k:'shard',x:e.x,y:e.y,vx:v14R(-160,160),vy:v14R(-220,-40),g:520,life:v14R(.6,1.1),max:1,c:i%2?c:'#e2e8f0',r:2+Math.random()*3,rot:0,vr:v14R(-12,12),drag:.98});
  v14P({k:'ringp',x:e.x,y:e.y,vx:0,vy:0,life:.4,max:.4,c,r:e.r});
  V14.decals.push({x:e.x,y:e.y,c:e.type==='splitter'?'#365314':e.type==='mage'?'#581c87':'#450a0a',r:e.r*.9,rot:Math.random()*3});if(V14.decals.length>60)V14.decals.shift();
  V14.lights.push({x:e.x,y:e.y,r:130,life:.18,c});
}
const _dmg14=damageEnemy;
damageEnemy=function(e,d,src){const was=e&&e.hp>0,dead=_dmg14(e,d,src);if(dead&&was)v14Death(e);return dead};
const _shoot14=shoot;
shoot=function(){
  const n=S.bullets.length;_shoot14();
  if(S.bullets.length>n){const a=Math.atan2(mouse.y-S.p.y,mouse.x-S.p.x),w=WEAPONS[S.p.weapon];
    V14.lights.push({x:S.p.x+Math.cos(a)*34,y:S.p.y+Math.sin(a)*34,r:150,life:.07,c:w.color});
    if(['Blaster','VoltSMG','Scattergun'].includes(S.p.weapon))v14P({k:'shard',x:S.p.x,y:S.p.y-2,vx:-Math.sin(a)*v14R(60,120),vy:Math.cos(a)*v14R(60,120)-80,g:600,life:.6,max:.6,c:'#fbbf24',r:2,rot:0,vr:15,drag:.98});
    if(S.p.weapon==='Rail Lance')v14P({k:'ringp',x:S.p.x+Math.cos(a)*40,y:S.p.y+Math.sin(a)*40,vx:0,vy:0,life:.3,max:.3,c:w.color,r:8});}
};
const _dash14=dash;
dash=function(){
  const o={x:S.p.x,y:S.p.y};_dash14();
  if(Math.hypot(S.p.x-o.x,S.p.y-o.y)>20)for(let i=0;i<9;i++){const t=i/9;v14P({k:'ghost',x:o.x+(S.p.x-o.x)*t,y:o.y+(S.p.y-o.y)*t,vx:0,vy:0,life:.3,max:.3,c:'#22d3ee',r:14})}
};
const _enter14=enterRoom;
enterRoom=function(id){_enter14(id);V14.mood=Math.max(V14.mood,.2);for(const q of V14.parts)if(q.k==='spark'||q.k==='shard'||q.k==='smoke')q.life=0;};
const _upd14=update;
update=function(dt,now){_upd14(dt,now);if(S.running&&S.p&&canUpdateGame())v14Update(dt,now);else V14.mood+=(.12-V14.mood)*Math.min(1,dt)};

function v14Bullets(now){
  ctx.save();ctx.globalCompositeOperation='lighter';
  for(const b of S.bullets){
    const a=Math.atan2(b.vy,b.vx),ca=Math.cos(a),sa=Math.sin(a),w=b.weapon,c=b.c;
    ctx.save();ctx.translate(b.x,b.y);ctx.rotate(a);
    if(w==='Rail Lance'){ctx.globalAlpha=.4;ctx.fillStyle=c;ctx.fillRect(-70,-5,76,10);ctx.globalAlpha=.9;ctx.fillStyle='#fff';ctx.fillRect(-60,-1.5,66,3)}
    else if(w==='VoltSMG'){ctx.globalAlpha=.45;ctx.fillStyle=c;ctx.fillRect(-18,-3,22,6);ctx.globalAlpha=1;ctx.fillStyle='#fff';ctx.fillRect(-8,-1,12,2)}
    else if(w==='Arc Wand'){ctx.globalAlpha=.9;ctx.strokeStyle=c;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-26,0);for(let i=1;i<6;i++)ctx.lineTo(-26+i*5,Math.sin(now*.05+i*7+b.x)*5);ctx.lineTo(2,0);ctx.stroke();ctx.fillStyle='#d1fae5';ctx.beginPath();ctx.arc(0,0,4,0,6.3);ctx.fill()}
    else if(w==='Frost Cannon'){ctx.rotate(now*.01);ctx.globalAlpha=.5;ctx.fillStyle=c;ctx.beginPath();ctx.arc(0,0,11,0,6.3);ctx.fill();ctx.globalAlpha=1;ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(4,0);ctx.lineTo(0,8);ctx.lineTo(-4,0);ctx.fill();ctx.fillRect(-8,-1,16,2)}
    else if(w==='Scattergun'){ctx.globalAlpha=.4;ctx.fillStyle=c;ctx.fillRect(-10,-2,12,4);ctx.globalAlpha=1;ctx.fillStyle='#fff7ed';ctx.beginPath();ctx.arc(0,0,2.5,0,6.3);ctx.fill()}
    else{ctx.globalAlpha=.4;ctx.fillStyle=c;ctx.beginPath();ctx.arc(0,0,10,0,6.3);ctx.fill();ctx.globalAlpha=.5;ctx.fillRect(-16,-2,16,4);ctx.globalAlpha=1;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(0,0,3.5,0,6.3);ctx.fill()}
    ctx.restore();
    if(b.crit){ctx.globalAlpha=.8;ctx.strokeStyle='#fde68a';ctx.lineWidth=2;ctx.beginPath();ctx.arc(b.x,b.y,9+Math.sin(now*.03)*2,0,6.3);ctx.stroke()}
  }
  for(const b of S.enemyBullets){
    ctx.globalAlpha=.4;ctx.fillStyle=b.c;ctx.beginPath();ctx.arc(b.x,b.y,b.r*2.4,0,6.3);ctx.fill();ctx.globalAlpha=1;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(b.x,b.y,b.r*.6,0,6.3);ctx.fill();
    ctx.strokeStyle=b.c;ctx.lineWidth=2;ctx.beginPath();ctx.arc(b.x,b.y,b.r+2,now*.02,now*.02+4);ctx.stroke();
  }
  ctx.restore();
}
function v14Parts(){
  ctx.save();
  for(const q of V14.parts){
    const a=Math.max(0,q.life/q.max);
    if(q.k==='shard'){ctx.globalAlpha=Math.min(1,a*1.5);ctx.fillStyle=q.c;ctx.save();ctx.translate(q.x,q.y);ctx.rotate(q.rot||0);ctx.fillRect(-q.r,-q.r*.6,q.r*2,q.r*1.2);ctx.restore()}
    else if(q.k==='smoke'){ctx.globalAlpha=a*.25;ctx.fillStyle=q.c;ctx.beginPath();ctx.arc(q.x,q.y,q.r*(1+(1-a)*1.2),0,6.3);ctx.fill()}
  }
  ctx.globalCompositeOperation='lighter';
  for(const q of V14.parts){
    const a=Math.max(0,q.life/q.max);
    if(q.k==='spark'){ctx.globalAlpha=a;ctx.strokeStyle=q.c;ctx.lineWidth=q.r;ctx.beginPath();ctx.moveTo(q.x,q.y);ctx.lineTo(q.x-q.vx*.035,q.y-q.vy*.035);ctx.stroke()}
    else if(q.k==='ember'){ctx.globalAlpha=a*(.6+.4*Math.sin(q.x+V14.t*20));ctx.fillStyle=q.c;ctx.fillRect(q.x,q.y,q.r,q.r)}
    else if(q.k==='mote'){ctx.globalAlpha=Math.sin(Math.min(1,a)*3.14)*.5;ctx.fillStyle=q.c;ctx.fillRect(q.x,q.y,q.r,q.r)}
    else if(q.k==='fly'){const g=ctx.createRadialGradient(q.x,q.y,0,q.x,q.y,9);g.addColorStop(0,q.c);g.addColorStop(1,'rgba(0,0,0,0)');ctx.globalAlpha=Math.sin(Math.min(1,a)*3.14)*(.5+.5*Math.sin(V14.t*5+q.ph));ctx.fillStyle=g;ctx.fillRect(q.x-9,q.y-9,18,18)}
    else if(q.k==='ringp'){ctx.globalAlpha=a*.8;ctx.strokeStyle=q.c;ctx.lineWidth=3*a+1;ctx.beginPath();ctx.arc(q.x,q.y,q.r+(1-a)*60,0,6.3);ctx.stroke()}
    else if(q.k==='ghost'){ctx.globalAlpha=a*.4;ctx.fillStyle=q.c;ctx.fillRect(q.x-8,q.y-20,16,34)}
  }
  ctx.restore();
}
function v14Light(now){
  if(!S.p)return;const L=V14.lc.getContext('2d'),m=V14.mood,P=v14Pal();
  L.globalCompositeOperation='source-over';L.clearRect(0,0,W,H);L.fillStyle=`rgba(3,5,12,${.3+m*.4})`;L.fillRect(0,0,W,H);L.globalCompositeOperation='destination-out';
  const lit=(x,y,r,a)=>{const g=L.createRadialGradient(x,y,r*.08,x,y,r);g.addColorStop(0,`rgba(0,0,0,${a})`);g.addColorStop(1,'rgba(0,0,0,0)');L.fillStyle=g;L.fillRect(x-r,y-r,r*2,r*2)};
  lit(S.p.x,S.p.y,340-m*80,.95);
  for(const [x,y] of V14_TORCH)lit(x,y,175*(.9+.1*Math.sin(now*.02+x)),.8);
  for(const b of S.bullets)lit(b.x,b.y,55,.7);for(const b of S.enemyBullets)lit(b.x,b.y,48,.6);
  for(const e of S.enemies)if(e.elite)lit(e.x,e.y,90,.5);
  if(S.boss)lit(S.boss.x,S.boss.y,210,.75);if(S.door)lit(S.door.x,S.door.y,130,.8);if(S.chest)lit(S.chest.x,S.chest.y,100,.7);if(S.npc)lit(S.npc.x,S.npc.y,120,.7);
  for(const l of V14.lights)lit(l.x,l.y,l.r,.9);
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(V14.lc,0,0);
  ctx.globalCompositeOperation='lighter';
  for(const [x,y] of V14_TORCH){const g=ctx.createRadialGradient(x,y,0,x,y,120);g.addColorStop(0,P.tc);g.addColorStop(1,'rgba(0,0,0,0)');ctx.globalAlpha=.16*(.85+.15*Math.sin(now*.02+x));ctx.fillStyle=g;ctx.fillRect(x-120,y-120,240,240)}
  for(const l of V14.lights){const g=ctx.createRadialGradient(l.x,l.y,0,l.x,l.y,l.r);g.addColorStop(0,l.c);g.addColorStop(1,'rgba(0,0,0,0)');ctx.globalAlpha=Math.min(.5,l.life*6);ctx.fillStyle=g;ctx.fillRect(l.x-l.r,l.y-l.r,l.r*2,l.r*2)}
  if(S.boss){const g=ctx.createRadialGradient(S.boss.x,S.boss.y,10,S.boss.x,S.boss.y,160);g.addColorStop(0,S.boss.c);g.addColorStop(1,'rgba(0,0,0,0)');ctx.globalAlpha=.16+.08*Math.sin(now*.006);ctx.fillStyle=g;ctx.fillRect(S.boss.x-160,S.boss.y-160,320,320)}
  ctx.globalCompositeOperation='source-over';
  ctx.globalAlpha=.05*(1-m);ctx.fillStyle='#ffc88c';ctx.fillRect(0,70,W,H);ctx.globalAlpha=.08*m;ctx.fillStyle='#a01428';ctx.fillRect(0,70,W,H);
  const vg=ctx.createRadialGradient(640,400,300-m*60,640,400,820);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,`rgba(0,0,0,${.3+m*.3})`);ctx.globalAlpha=1;ctx.fillStyle=vg;ctx.fillRect(0,0,W,H);
  const hp=S.p.hp/S.p.maxHp;if(hp<.35&&S.running){const pu=.5+.5*Math.sin(now*.008),g=ctx.createRadialGradient(640,400,280,640,400,800);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,`rgba(220,20,40,${.35*pu*(1-hp/.35)+.08})`);ctx.fillStyle=g;ctx.fillRect(0,0,W,H)}
  ctx.restore();
}
const _draw14=draw;
draw=function(now){
  _draw14(now);if(!S.running||!S.p)return;
  v14Bullets(now);v14Parts();v14Light(now);
};

// ---------------- Adaptive music: calm pentatonic pads <-> driving phrygian ----------------
AudioSys.startMusic=function(){
  if(this.timer)return;this.ensure();this.step=0;const self=this;
  const calm=[220,261.6,293.7,329.6,392,440,523.3,587.3],hot=[220,233.1,277.2,293.7,329.6,349.2,415.3,440];
  const tick=()=>{
    if(!self.timer)return;const m=V14.mood,boss=!!S.boss,i=self.step++;
    if(!self.muted){
      if(m<.5){
        const n=calm[(i*3+((Math.random()*3)|0))%calm.length];self.tone(n,.9,'sine',.03,'music');
        if(i%8===0){self.tone(110,2.2,'sine',.035,'music');self.tone(165,2.2,'triangle',.02,'music')}
        if(Math.random()<.3)self.tone(n*2,.5,'triangle',.012,'music',.12);
      }else{
        const sc=hot,n=sc[[0,2,4,2,5,4,2,1][i%8]]*(boss?.5:1);
        self.tone(n,.14,'square',.02+m*.012,'music');
        if(i%2===0)self.tone(boss?55:73.4,.2,'sawtooth',.04+m*.02,'music');
        if(i%4===0)self.noise(.04,.02+m*.02);
        if(m>.8&&i%2)self.tone(n*2,.08,'triangle',.02,'music');
      }
    }
    self.timer=setTimeout(tick,m<.5?520-m*200:240-m*110);
  };
  this.timer=setTimeout(tick,200);
};
// ==========================================
// 11. أزرار الواجهة وإدارة أحداث القوائم (UI Binding & Controls)
// ==========================================

// تبديل حالة قائمة الإيقاف المؤقت
function togglePause(){
  if(!S.running)return;if(isOpen("pauseMenu")){hide("pauseMenu")}else show("pauseMenu")
}

// ربط أحداث الضغط على الأزرار في الواجهة
function wireMenuButtons(){
  const bind=(id,fn)=>{
    const el=$(id);
    if(!el)return;
    el.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();try{fn()}catch(err){console.error("Button "+id,err);showToast("UI error: "+id,2200)}});
  };
  bind("newRun",newRun);
  bind("continueRun",()=>localStorage.getItem("db_run")?loadRun():newRun());
  bind("arsenalBtn",()=>{renderArsenal();show("arsenalMenu")});
  bind("upgradesBtn",()=>{renderMetaUpgrades();show("upgradeMenu")});
  bind("settingsBtn",()=>show("settingsMenu"));
  bind("backArsenal",()=>show("mainMenu"));
  bind("backUpgrades",()=>show("mainMenu"));
  bind("backSettings",()=>show("mainMenu"));
}

// ربط عناصر الواجهة الأخرى بأفعالها
$("resumeBtn").onclick=()=>hide("pauseMenu");
$("saveQuitBtn").onclick=saveAndQuit;
$("quitRunBtn").onclick=quitRun;
$("pauseMapBtn").onclick=()=>{hide("pauseMenu");toggleMap()};
$("pauseSettingsBtn").onclick=()=>{hide("pauseMenu");show("settingsMenu")};
$("closeMap").onclick=()=>hide("mapOverlay");$("mapBtn").onclick=toggleMap;
$("invBtn").onclick=toggleInventory;$("closeInv").onclick=()=>hide("inventory");
$("closeShop").onclick=()=>hide("shop");
$("pauseBtn").onclick=togglePause;
$("retryRun").onclick=newRun;$("backMenuAfterDeath").onclick=()=>{hide("gameOver");show("mainMenu");menuStats()};
$("resetMeta").onclick=()=>{if(confirm("Reset permanent progress?")){META={...metaDefault};saveMeta();renderMetaUpgrades()}};
$("dialogueContinue").onclick=advanceDialogue;
$("dialogueSkip").onclick=()=>{if(isOpen("dialogueScreen")){dialogueState.index=dialogueState.queue.length;closeDialogue()}};
$("masterVol").oninput=e=>{SETTINGS.master=+e.target.value;saveSettings()};
$("musicVol").oninput=e=>{SETTINGS.music=+e.target.value;saveSettings()};
$("sfxVol").oninput=e=>{SETTINGS.sfx=+e.target.value;saveSettings()};
$("shakeVol").oninput=e=>{SETTINGS.shake=+e.target.value;saveSettings()};
$("muteBtn").onclick=()=>{AudioSys.muted=!AudioSys.muted;saveSettings()};
$("colorAssistBtn").onclick=()=>{SETTINGS.colorAssist=!SETTINGS.colorAssist;saveSettings()};
$("dashAimBtn").onclick=()=>{SETTINGS.dashAim=!SETTINGS.dashAim;saveSettings()};

canvas.addEventListener("click",e=>{if(S.running&&canUpdateGame()&&e.target===canvas)interact()});

// ==========================================
// 12. استعادة الأخطاء والريشة البرمجية (Engine Recovery & Main Loop)
// ==========================================

let ENGINE_ERRORS=0;
let LAST_ENGINE_ERROR="";
let ENGINE_RECOVERY_COOLDOWN=0;

// التعافي من الأخطاء العابرة أثناء حلقة اللعبة لضمان عدم تجمد الشاشة
function engineRecover(err,stage){
  ENGINE_ERRORS++;
  LAST_ENGINE_ERROR=(err&&err.message)||String(err);
  console.error("Dungeon Blitz engine error ("+stage+"):",err);
  if(!S.p||typeof S.p.x!=="number"||!Number.isFinite(S.p.x)){ if(S.running) applyMeta(); }
  if(!Array.isArray(S.enemies))S.enemies=[];
  if(!Array.isArray(S.bullets))S.bullets=[];
  if(!Array.isArray(S.enemyBullets))S.enemyBullets=[];
  if(!Array.isArray(S.particles))S.particles=[];
  if(!Array.isArray(S.texts))S.texts=[];
  if(!Array.isArray(S.drops))S.drops=[];
  if(ENGINE_ERRORS===1)showToast("Engine recovered — continuing run.",1800);
  if(ENGINE_ERRORS>=4 && ENGINE_RECOVERY_COOLDOWN<=0){
    ENGINE_RECOVERY_COOLDOWN=2.5;
    ENGINE_ERRORS=0;
    if(S.running){S.running=false;showToast("A runtime issue was detected. Please restart the run.",2600);}
  }
}

// حلقة اللعبة الأساسية (Main Game Loop)
function loop(now){
  const dt=Math.min(0.05, (now - last) / 1000); // حساب الوقت المنقضي بين الإطارات (Delta Time)
  last = now;

  if (ENGINE_RECOVERY_COOLDOWN > 0) ENGINE_RECOVERY_COOLDOWN -= dt;

  try {
    update(dt, now); // تحديث المنطق والحسابات
  } catch (err) {
    engineRecover(err, "update");
  }

  try {
    draw(now); // رسم العناصر على الشاشة
  } catch (err) {
    engineRecover(err, "draw");
  }

  requestAnimationFrame(loop); // طلب الإطار التالي
}

// تهيئة اللعبة وبدء تشغيل الحلقة
wireMenuButtons();
show("mainMenu");
requestAnimationFrame(loop);