import {initializeApp} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {getAuth,signInAnonymously,onAuthStateChanged} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {getFirestore,collection,addDoc,updateDoc,deleteDoc,setDoc,getDoc,doc,onSnapshot,query,orderBy,serverTimestamp} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

const firebaseConfig={
    apiKey:"AIzaSyDWD2S7Zvcy-T_Ddr8Ytbqwv9tNEBNIJg4",
    authDomain:"kabir-data.firebaseapp.com",
    projectId:"kabir-data",
    storageBucket:"kabir-data.firebasestorage.app",
    messagingSenderId:"261218356495",
    appId:"1:261218356495:web:2bbfeae7c70df8d3a2c27a",
    measurementId:"G-EYTJPH33KQ"
};

const app=initializeApp(firebaseConfig);

const auth=getAuth(app);
const db=getFirestore(app);

const PIN_KEY="kabir_mobile_pin";
const DEFAULT_PIN="0000";
const COL="customers";
const REPAIR_COL="repairing";
const SECOND_COL="secondHand";
const ACCESSORY_COL="accessories";
const AUDIT_COL="auditLogs";
const SETTINGS_COL="settings";
const SETTINGS_DOC="security";
const REMOTE_DEVICES_URL="https://cdn.jsdelivr.net/gh/bsthen/device-models/devices.json";

let user=null;
let customers=[];
let repairing=[];
let secondHand=[];
let accessories=[];
let auditLogs=[];
let auditListenerStarted=false;
let scanStream=null;
let scanTimer=null;

const $=id=>document.getElementById(id);
const val=id=>($(id)?.value||"").trim();

const FINANCE_COMPANIES=[
    "Bajaj Finance","HDB Financial Services","TVS Credit","Home Credit India",
    "IDFC FIRST Bank","Tata Capital","L&T Finance","Mahindra Finance",
    "Shriram Finance","Cholamandalam Finance","Hero FinCorp","DMI Finance",
    "Aditya Birla Finance","Personal Finance","Other Mobile Finance",
    "No Finance / Cash"
];

function setupFinanceCompany(){
    const select=$("financeCompany");
    if(!select || select.dataset.ready==="1") return;

    FINANCE_COMPANIES.forEach(name=>{
        const option=document.createElement("option");
        option.value=name;
        option.textContent=name;
        select.appendChild(option);
    });

    select.dataset.ready="1";
}




let remoteModelsByBrand={};
let remoteModelsLoaded=false;

async function loadAllPhoneModels(){
    if(remoteModelsLoaded)return;
    try{
        const cached=sessionStorage.getItem("kabir_device_catalog");
        if(cached){
            remoteModelsByBrand=JSON.parse(cached);
            remoteModelsLoaded=true;
            return;
        }
        const r=await fetch(REMOTE_DEVICES_URL,{cache:"force-cache"});
        if(!r.ok)throw Error("Device catalog unavailable");
        const data=await r.json(), grouped={};
        Object.values(data||{}).forEach(d=>{
            const brand=String(d?.brand||"").trim(), name=String(d?.name||"").trim();
            if(!brand||!name)return;
            (grouped[brand] ||= []).push(name);
        });
        Object.keys(grouped).forEach(k=>grouped[k]=[...new Set(grouped[k])]);
        remoteModelsByBrand=grouped;
        sessionStorage.setItem("kabir_device_catalog",JSON.stringify(grouped));
        remoteModelsLoaded=true;
    }catch(e){console.warn("Phone catalog unavailable:",e)}
}
function modelListForBrand(brand){
    const local=Object.keys(BRANDS?.[brand]?.models||{});
    const key=Object.keys(remoteModelsByBrand).find(k=>k.toLowerCase()===String(brand).toLowerCase());
    const remote=key?remoteModelsByBrand[key]:[];
    return [...new Set([...local,...remote])];
}
function fillModelOptions(brand){
    const m=$("model"); if(!m)return;
    m.innerHTML='<option value="">Select model</option>';
    modelListForBrand(brand).forEach(x=>{
        const o=document.createElement("option");o.value=x;o.textContent=x;m.appendChild(o);
    });
    m.disabled=!m.options.length;
}

/* =========================================================
   PHONE BRANDS / MODELS / COLOURS / STORAGE
========================================================= */

const BRANDS={

Apple:{
models:{
"iPhone 17 Pro Max":["Deep Blue","Silver","Cosmic Orange"],
"iPhone 17 Pro":["Deep Blue","Silver","Cosmic Orange"],
"iPhone 17":["Black","White","Lavender","Mist Blue","Sage"],
"iPhone Air":["Space Black","Cloud White","Light Gold","Sky Blue"],
"iPhone 16 Pro Max":["Black Titanium","White Titanium","Natural Titanium","Desert Titanium"],
"iPhone 16 Pro":["Black Titanium","White Titanium","Natural Titanium","Desert Titanium"],
"iPhone 16 Plus":["Black","White","Pink","Teal","Ultramarine"],
"iPhone 16":["Black","White","Pink","Teal","Ultramarine"],
"iPhone 15 Pro Max":["Black Titanium","White Titanium","Blue Titanium","Natural Titanium"],
"iPhone 15 Pro":["Black Titanium","White Titanium","Blue Titanium","Natural Titanium"],
"iPhone 15 Plus":["Black","Blue","Green","Yellow","Pink"],
"iPhone 15":["Black","Blue","Green","Yellow","Pink"],
"iPhone 14 Pro Max":["Space Black","Silver","Gold","Deep Purple"],
"iPhone 14 Pro":["Space Black","Silver","Gold","Deep Purple"],
"iPhone 14 Plus":["Midnight","Starlight","Blue","Purple","Red"],
"iPhone 14":["Midnight","Starlight","Blue","Purple","Red"],
"iPhone 13 Pro Max":["Graphite","Gold","Silver","Sierra Blue","Alpine Green"],
"iPhone 13 Pro":["Graphite","Gold","Silver","Sierra Blue","Alpine Green"],
"iPhone 13":["Midnight","Starlight","Blue","Pink","Green","Red"],
"iPhone 13 mini":["Midnight","Starlight","Blue","Pink","Green","Red"],
"iPhone 12":["Black","White","Red","Green","Blue","Purple"],
"iPhone 11":["Black","White","Red","Green","Yellow","Purple"]
},
storage:["128 GB","256 GB","512 GB","1 TB"]
},

Samsung:{
models:{
"Galaxy S25 Ultra":["Titanium Black","Titanium Gray","Titanium Silverblue","Titanium Whitesilver"],
"Galaxy S25+":["Navy","Icyblue","Mint","Silver Shadow"],
"Galaxy S25":["Navy","Icyblue","Mint","Silver Shadow"],
"Galaxy S24 Ultra":["Titanium Black","Titanium Gray","Titanium Violet","Titanium Yellow"],
"Galaxy S24+":["Onyx Black","Marble Gray","Cobalt Violet","Amber Yellow"],
"Galaxy S24":["Onyx Black","Marble Gray","Cobalt Violet","Amber Yellow"],
"Galaxy S23 Ultra":["Phantom Black","Cream","Green","Lavender"],
"Galaxy A56 5G":["Awesome Graphite","Awesome Lightgray","Awesome Olive","Awesome Pink"],
"Galaxy A36 5G":["Awesome Black","Awesome White","Awesome Lavender","Awesome Lime"],
"Galaxy A26 5G":["Black","White","Mint"],
"Galaxy M55 5G":["Light Green","Denim Black"]
},
storage:["128 GB","256 GB","512 GB"]
},

OnePlus:{
models:{
"OnePlus 13":["Black Eclipse","Midnight Ocean","Arctic Dawn"],
"OnePlus 13R":["Nebula Noir","Astral Trail"],
"OnePlus 12":["Silky Black","Flowy Emerald"],
"OnePlus 12R":["Cool Blue","Iron Gray"],
"OnePlus Nord 5":["Dry Ice","Phantom Grey","Marina Blue"],
"OnePlus Nord CE5":["Black Infinity","Nexus Blue"]
},
storage:["128 GB","256 GB","512 GB"]
},

Xiaomi:{
models:{
"Xiaomi 15":["Black","White","Green"],
"Xiaomi 15 Ultra":["Black","White","Silver Chrome"],
"Redmi Note 14 Pro+":["Titan Black","Frost Blue","Phantom Purple"],
"Redmi Note 14 Pro":["Titan Black","Ivy Green","Phantom Purple"],
"Redmi Note 14":["Titan Black","Mystic White","Phantom Purple"]
},
storage:["64 GB","128 GB","256 GB","512 GB"]
},

Redmi:{
models:{
"Redmi Note 14 Pro+":["Titan Black","Frost Blue","Phantom Purple"],
"Redmi Note 14 Pro":["Titan Black","Ivy Green","Phantom Purple"],
"Redmi Note 14":["Titan Black","Mystic White","Phantom Purple"],
"Redmi 14C":["Midnight Black","Sage Green","Starry Blue"],
"Redmi A5":["Midnight Black","Ocean Blue","Lake Green"]
},
storage:["64 GB","128 GB","256 GB","512 GB"]
},

Realme:{
models:{
"GT 7":["IceSense Black","IceSense Blue"],
"GT 7T":["IceSense Black","IceSense Gray"],
"P3 Ultra":["Genuine Silver","Nebula Glow"],
"P3 Pro":["Galaxy Purple","Saturn Brown","Neptune Blue"],
"Narzo 80 Pro":["Racing Green","Speed Silver"]
},
storage:["128 GB","256 GB","512 GB"]
},

Vivo:{
models:{
"X200 Pro":["Titanium Gray","Midnight Black"],
"X200":["Cosmos Black","Natural Green"],
"V50":["Titanium Grey","Rose Red","Starry Night"],
"V50e":["Pearl White","Sapphire Blue"],
"T4 5G":["Emerald Green","Phantom Grey"],
"Y39 5G":["Glacier Blue","Onyx Black"]
},
storage:["128 GB","256 GB","512 GB"]
},

OPPO:{
models:{
"Find X8 Pro":["Pearl White","Space Black"],
"Find X8":["Star Grey","Space Black"],
"Reno13 Pro":["Graphite Grey","Mist Lavender"],
"Reno13":["Luminous Blue","Ivory White","Black"],
"K13 5G":["Icy Purple","Prism Black"]
},
storage:["128 GB","256 GB","512 GB"]
},

Motorola:{
models:{
"Edge 60 Pro":["Pantone Shadow","Pantone Dazzling Blue","Pantone Sparkling Grape"],
"Edge 60 Fusion":["Pantone Slipstream","Pantone Amazonite"],
"Moto G85":["Olive Green","Cobalt Blue","Urban Grey"]
},
storage:["128 GB","256 GB","512 GB"]
},

Google:{
models:{
"Pixel 9 Pro XL":["Obsidian","Porcelain","Hazel","Rose Quartz"],
"Pixel 9 Pro":["Obsidian","Porcelain","Hazel","Rose Quartz"],
"Pixel 9":["Obsidian","Porcelain","Wintergreen","Peony"],
"Pixel 8a":["Obsidian","Porcelain","Bay","Aloe"]
},
storage:["128 GB","256 GB","512 GB"]
},

Nothing:{
models:{
"Phone (3)":["White","Black"],
"Phone (3a) Pro":["Black","White"],
"Phone (3a)":["Black","White","Blue"]
},
storage:["128 GB","256 GB","512 GB"]
},

POCO:{
models:{
"POCO F7":["Titanium Gray","White","Black"],
"POCO X7 Pro":["Nebula Green","Obsidian Black","Yellow"],
"POCO M7 Pro":["Lavender Frost","Lunar Dust","Titanium Gray"]
},
storage:["128 GB","256 GB","512 GB"]
},

Infinix:{
models:{
"GT 30 Pro":["Shadow Ash","Blade White"],
"Note 50 Pro":["Titanium Gray","Enchanted Purple"],
"Hot 60 Pro":["Titanium Silver","Sleek Black"]
},
storage:["128 GB","256 GB","512 GB"]
},

Tecno:{
models:{
"Camon 40 Pro":["Emerald Lake","Galaxy Black"],
"Pova 7 Pro":["Geek Black","Neon Cyan"]
},
storage:["128 GB","256 GB","512 GB"]
},

Lava:{
models:{
"Agni 3":["Pristine White","Heather Glass"],
"Blaze Duo":["Arctic Glass","Stardust Purple"]
},
storage:["128 GB","256 GB"]
}

};


/* =========================================================
   COMMON HELPERS
========================================================= */

let sharedPin=/^\d{4}$/.test(localStorage.getItem(PIN_KEY)||"")?localStorage.getItem(PIN_KEY):DEFAULT_PIN;
let pinLoaded=/^\d{4}$/.test(localStorage.getItem(PIN_KEY)||"");
let pinLoadPromise=null;

async function loadSharedPin(){
    if(pinLoadPromise)return pinLoadPromise;
    pinLoadPromise=(async()=>{
        const securityRef=doc(db,SETTINGS_COL,SETTINGS_DOC);
        try{
            // Primary location used by both Main Website and Admin Panel.
            const securitySnap=await getDoc(securityRef);
            if(securitySnap.exists()){
                const p=String(securitySnap.data()?.pin||"");
                if(/^\d{4}$/.test(p)){
                    sharedPin=p;
                    localStorage.setItem(PIN_KEY,p);
                    pinLoaded=true;
                    return p;
                }
            }

            // Backward compatibility with the earlier settings/app document.
            const legacyRef=doc(db,SETTINGS_COL,"app");
            const legacySnap=await getDoc(legacyRef);
            if(legacySnap.exists()){
                const p=String(legacySnap.data()?.pin||"");
                if(/^\d{4}$/.test(p)){
                    sharedPin=p;
                    localStorage.setItem(PIN_KEY,p);
                    await setDoc(securityRef,{pin:p,updatedAt:serverTimestamp()},{merge:true});
                    pinLoaded=true;
                    return p;
                }
            }

            const cached=localStorage.getItem(PIN_KEY);
            if(/^\d{4}$/.test(cached||"")){
                sharedPin=cached;
                await setDoc(securityRef,{pin:sharedPin,updatedAt:serverTimestamp()},{merge:true});
            }else{
                sharedPin=DEFAULT_PIN;
                await setDoc(securityRef,{pin:sharedPin,updatedAt:serverTimestamp()},{merge:true});
                localStorage.setItem(PIN_KEY,sharedPin);
            }
            return sharedPin;
        }catch(e){
            console.error("Shared PIN load failed:",e);
            const cached=localStorage.getItem(PIN_KEY);
            if(/^\d{4}$/.test(cached||"")){
                sharedPin=cached;
                return sharedPin;
            }
            throw Error("PIN load नहीं हुआ. Firebase connection check करें.");
        }finally{
            pinLoaded=true;
        }
    })();
    return pinLoadPromise;
}

function pin(){return sharedPin||DEFAULT_PIN;}

async function changeSharedPin(newPin){
    if(!/^\d{4}$/.test(newPin))throw Error("PIN must be exactly 4 digits.");
    await setDoc(doc(db,SETTINGS_COL,SETTINGS_DOC),{pin:newPin,updatedAt:serverTimestamp()},{merge:true});
    // Keep the legacy document synchronized so older deployments cannot disagree.
    await setDoc(doc(db,SETTINGS_COL,"app"),{pin:newPin,updatedAt:serverTimestamp()},{merge:true});
    sharedPin=newPin;
    localStorage.setItem(PIN_KEY,newPin);
    pinLoaded=true;
    await audit("pin_change",{section:"Admin Panel",description:"Shared PIN changed from Admin Panel"});
}


/* =========================================================
   WORK HISTORY / AUDIT LOGS
========================================================= */
function auditLabel(action){
    const labels={
        customer_add:"Customer Add",
        customer_edit:"Customer Edit",
        customer_delete:"Customer Delete",
        customer_bill_update:"Customer Bill Update",
        repairing_add:"Repairing Add",
        customer_search:"Customer Search",
        repairing_search:"Repairing Search",
        customer_export:"Customer Excel Download",
        repairing_export:"Repairing Excel Download",
        customer_pdf:"Customer PDF Download",
        pin_change:"PIN Changed",
        login_success:"Login Success",
        login_failed:"Login Failed",
        page_open:"Website Opened",
        logout:"Logout",
        second_hand_add:"Second Hand Phone Added",
        accessory_add:"Accessory Added"
    };
    return labels[action]||String(action||"Work").replaceAll("_"," ");
}
async function audit(action,details={}){
    try{
        await addDoc(collection(db,AUDIT_COL),{
            action:String(action||"work"),
            label:auditLabel(action),
            userUid:user?.uid||"unknown",
            userName:localStorage.getItem("kabir_current_user")||"Kabir User",
            section:details.section||"Kabir Mobile Data",
            customerId:details.customerId||null,
            customerCode:details.customerCode||null,
            customerName:details.customerName||null,
            description:details.description||auditLabel(action),
            details:details.extra||null,
            clientTime:new Date().toISOString(),
            createdAt:serverTimestamp()
        });
    }catch(e){
        // Audit failure must never block the actual customer/repairing operation.
        console.warn("Audit log failed:",e?.message||e);
    }
}

function auditTime(x){
    const d=x?.createdAt?.toDate?.() || (x?.clientTime?new Date(x.clientTime):null);
    if(!d || Number.isNaN(d.getTime())) return "Time pending";
    return d.toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"medium"});
}
function auditDay(x){
    const d=x?.createdAt?.toDate?.() || (x?.clientTime?new Date(x.clientTime):null);
    return d&&!Number.isNaN(d.getTime())?d.toLocaleDateString("en-CA"):"";
}
function auditHour(x){
    const d=x?.createdAt?.toDate?.() || (x?.clientTime?new Date(x.clientTime):null);
    return d&&!Number.isNaN(d.getTime())?d.getHours():-1;
}
function sortAudit(){
    auditLogs.sort((a,b)=>{
        const ta=a.createdAt?.toMillis?.()||Date.parse(a.clientTime||"")||0;
        const tb=b.createdAt?.toMillis?.()||Date.parse(b.clientTime||"")||0;
        return tb-ta;
    });
}
function subscribeAuditLogs(){
    if(auditListenerStarted || !$('workHistoryResults')) return;
    auditListenerStarted=true;
    onSnapshot(collection(db,AUDIT_COL),snap=>{
        auditLogs=snap.docs.map(d=>({id:d.id,...d.data()}));
        sortAudit();
        renderWorkHistory();
        renderTraffic();
    },e=>{
        console.error("Audit listener:",e);
        if($('workHistoryResults'))$('workHistoryResults').innerHTML='<div class="empty">Work History load नहीं हुआ. Firebase Rules में auditLogs read permission check करें.</div>';
    });
}
function renderWorkHistory(){
    const box=$("workHistoryResults"); if(!box)return;
    const q=val("workSearchInput").toLowerCase();
    const rows=auditLogs.filter(x=>!q||[x.label,x.action,x.userName,x.userUid,x.section,x.customerCode,x.customerName,x.description,auditTime(x)].join(" ").toLowerCase().includes(q));
    if(!rows.length){box.innerHTML='<div class="empty">अभी कोई work history उपलब्ध नहीं है.</div>';return;}
    const iconMap={customer_add:"👤",customer_edit:"✏️",customer_delete:"🗑️",customer_bill_update:"🧾",repairing_add:"🛠️",customer_search:"🔎",repairing_search:"🔎",customer_export:"📥",repairing_export:"📥",customer_pdf:"📄",pin_change:"🔐",login_success:"🟢",login_failed:"🔴",page_open:"🏠",second_hand_add:"📱",accessory_add:"🎧"};
    box.innerHTML=rows.slice(0,300).map((x,i)=>`<article class="result work-log">
      <div class="work-log-head"><div class="work-log-icon">${iconMap[x.action]||"⚡"}</div><div class="work-log-title"><b>${esc(x.label||auditLabel(x.action))}</b><small>${esc(x.section||"Kabir Mobile Data")} • ${esc(x.userName||x.userUid||"Kabir User")}</small></div><time class="work-log-time">${esc(auditTime(x))}</time></div>
      <div class="work-log-desc">${esc(x.description||auditLabel(x.action))}</div>
      <div class="work-log-tags"><span class="work-log-tag">#${i+1}</span>${x.customerCode?`<span class="work-log-tag">${esc(x.customerCode)}</span>`:""}${x.customerName?`<span class="work-log-tag">${esc(x.customerName)}</span>`:""}<span class="work-log-tag">${esc(x.action||"work")}</span></div>
    </article>`).join("");
}
function renderTraffic(){
    const total=auditLogs.length;
    const today=new Date().toLocaleDateString('en-CA');
    const todayRows=auditLogs.filter(x=>auditDay(x)===today);
    const count=a=>auditLogs.filter(x=>x.action===a).length;
    const users=new Set(auditLogs.map(x=>x.userUid).filter(Boolean));
    $('trafficTotal')&&($('trafficTotal').textContent=String(total));
    $('trafficToday')&&($('trafficToday').textContent=String(todayRows.length));
    $('trafficAdds')&&($('trafficAdds').textContent=String(count('customer_add')));
    $('trafficEdits')&&($('trafficEdits').textContent=String(count('customer_edit')));
    $('trafficDeletes')&&($('trafficDeletes').textContent=String(count('customer_delete')));
    $('trafficRepairs')&&($('trafficRepairs').textContent=String(count('repairing_add')));
    $('trafficUsers')&&($('trafficUsers').textContent=String(users.size));
    const hours=Array.from({length:24},(_,h)=>auditLogs.filter(x=>auditHour(x)===h).length);
    const peak=Math.max(...hours,0),peakHour=peak?hours.indexOf(peak):-1;
    $('trafficPeak')&&($('trafficPeak').textContent=peakHour<0?'—':`${String(peakHour).padStart(2,'0')}:00 (${peak})`);
    const hb=$('trafficHours');
    if(hb){
        const max=Math.max(...hours,1);
        hb.innerHTML=hours.map((n,h)=>`<div class="traffic-hour"><span>${String(h).padStart(2,'0')}</span><div><i style="width:${Math.round(n/max*100)}%"></i></div><b>${n}</b></div>`).join('');
    }
    const types={};
    auditLogs.forEach(x=>types[x.action||'other']=(types[x.action||'other']||0)+1);
    const tb=$('trafficTypes');
    if(tb){
        const list=Object.entries(types).sort((a,b)=>b[1]-a[1]);
        const max=Math.max(list[0]?.[1]||1,1);
        tb.innerHTML=list.slice(0,15).map(([a,n])=>`<div class="traffic-type"><span>${esc(auditLabel(a))}</span><div><i style="width:${Math.round(n/max*100)}%"></i></div><b>${n}</b></div>`).join('')||'<div class="empty">No traffic data.</div>';
    }
    renderCustomerDateGraph();
}
function renderCustomerDateGraph(){
    const box=$("customerDateGraph"); if(!box)return;
    const range=Number($("customerGraphRange")?.value||30);
    const now=new Date(); now.setHours(0,0,0,0);
    const rows=[];
    for(let i=range-1;i>=0;i--){
        const d=new Date(now); d.setDate(now.getDate()-i);
        const key=d.toLocaleDateString("en-CA");
        rows.push({d,key,count:customers.filter(c=>recordDay(c)===key).length});
    }
    const max=Math.max(...rows.map(x=>x.count),1);
    box.innerHTML=rows.map(x=>`<div class="customer-bar" title="${x.key}: ${x.count} customer"><div class="customer-bar-value">${x.count||""}</div><i style="height:${Math.max(4,Math.round(x.count/max*100))}%"></i><span>${x.d.getDate()} ${x.d.toLocaleString("en-IN",{month:"short"})}</span></div>`).join("");
}
function adminAnalytics(){
    if(!$('workHistoryButton'))return;
    const open=id=>{
        $('workHistorySection')?.classList.add('hidden');
        $('trafficSection')?.classList.add('hidden');
        $(id)?.classList.remove('hidden');
        setTimeout(()=>$(id)?.scrollIntoView({behavior:'smooth',block:'start'}),20);
    };
    $('workHistoryButton').addEventListener('click',()=>{open('workHistorySection');renderWorkHistory();});
    $('trafficButton').addEventListener('click',()=>{open('trafficSection');renderTraffic();});
    $('refreshWorkButton')?.addEventListener('click',renderWorkHistory);
    $('refreshTrafficButton')?.addEventListener('click',renderTraffic);
    $('workSearchInput')?.addEventListener('input',renderWorkHistory);
    subscribeAuditLogs();
}

function msg(id,t,ok=false){
    let e=$(id);

    if(e){
        e.textContent=t;
        e.style.color=ok?"var(--success)":"";
    }
}
function showSuccessToast(title="Successfully Saved",text="Data saved successfully"){
    const toast=$("successToast");
    if(!toast)return;
    $("successToastTitle").textContent=title;
    $("successToastText").textContent=text;
    toast.classList.remove("hidden");
    requestAnimationFrame(()=>toast.classList.add("show"));
    clearTimeout(window.__kabirToastTimer);
    window.__kabirToastTimer=setTimeout(()=>{
        toast.classList.remove("show");
        setTimeout(()=>toast.classList.add("hidden"),300);
    },2200);
}

/* =========================================================
   PIN SYSTEM
========================================================= */

function dots(v){
    document
        .querySelectorAll("#pinDots i")
        .forEach((e,i)=>{
            e.classList.toggle("filled",i<v.length);
        });
}

function unlock(){
    sessionStorage.setItem("kabir_unlocked","1");

    $("pinScreen")?.classList.add("hidden");
    $("appScreen")?.classList.remove("hidden");

    $("pinInput")?.blur();
}

function lock(){
    sessionStorage.removeItem("kabir_unlocked");

    $("appScreen")?.classList.add("hidden");
    $("pinScreen")?.classList.remove("hidden");

    let e=$("pinInput");

    if(e){
        e.value="";
        dots("");

        setTimeout(()=>{
            e.focus();
        },150);
    }
}

function pinError(){
    const card=document.querySelector(".pin-card");
    const input=$("pinInput");
    card?.classList.remove("pin-shake");
    void card?.offsetWidth;
    card?.classList.add("pin-shake");
    if(navigator.vibrate){try{navigator.vibrate([45,25,45]);}catch(_){}}
    input?.select();
    setTimeout(()=>card?.classList.remove("pin-shake"),260);
}

function setupPin(){
    const e=$("pinInput");
    if(!e)return;
    const attempt=()=>{
        e.value=e.value.replace(/\D/g,"").slice(0,4);
        dots(e.value);
        if(e.value.length!==4)return;
        const entered=e.value;
        const finish=async()=>{
            if(e.value!==entered)return;
            if(entered===pin()){
                audit("login_success",{section:$('appScreen')?.classList.contains('admin')?'Admin Panel':'Kabir Mobile Data',description:'PIN login successful'});
                unlock();
                msg("pinMessage","");
            }else{
                audit("login_failed",{section:$('appScreen')?.classList.contains('admin')?'Admin Panel':'Kabir Mobile Data',description:'Incorrect PIN entered'});
                msg("pinMessage","Incorrect PIN");
                pinError();
                setTimeout(()=>{e.value="";dots("");msg("pinMessage","");e.focus()},240);
            }
        };
        // Fast path: cached PIN is checked immediately. Firebase refresh never blocks the keypad.
        finish();
        if(!pinLoaded){
            loadSharedPin().then(()=>{if(e.value===entered)finish()}).catch(()=>{});
        }
    };
    e.addEventListener("input",attempt);
    $("lockButton")?.addEventListener("click",lock);
    if(sessionStorage.getItem("kabir_unlocked")==="1")unlock();
    else setTimeout(()=>e.focus(),100);
}

/* =========================================================
   FIREBASE AUTH
========================================================= */

let authReadyResolve;
const authReady=new Promise(resolve=>{authReadyResolve=resolve});

async function authInit(){
    let resolved=false;
    const finish=()=>{if(!resolved){resolved=true;authReadyResolve(user)}};
    onAuthStateChanged(auth,u=>{
        user=u;
        updateAdmin();
        finish();
    },e=>{
        console.error("Auth state error:",e);
        finish();
    });
    try{
        await signInAnonymously(auth);
    }catch(e){
        console.error(e);
        if($("adminFirebaseStatus"))msg("adminFirebaseStatus","Firebase authentication error: "+(e?.message||""));
        finish();
    }
    return authReady;
}

/* =========================================================
   FIRESTORE CUSTOMER LISTENER
========================================================= */

function subscribe(){
    onSnapshot(
        collection(db,COL),
        snap=>{
            customers=snap.docs.map(d=>({
                id:d.id,
                ...d.data()
            }));

            customers.sort((a,b)=>{
                const ta=a.createdAt?.toMillis?.()||0;
                const tb=b.createdAt?.toMillis?.()||0;
                return tb-ta;
            });

            counts();
            renderSearch();
            updateAdmin();
            homeDateFilter();
            renderCustomerDateGraph();
        },
        e=>{
            console.error("Customer listener:",e);
            msg("formMessage","Firestore access error. Check Firebase rules.");
            counts();
            homeDateFilter();
            renderCustomerDateGraph();
        }
    );
}


/* =========================================================
   COUNTS
========================================================= */

function counts(){
    // KABIR MOBILE DATA — only customer collection
    const mobileCustomers=Array.isArray(customers)?customers.length:0;
    const mobileDevices=Array.isArray(customers)
        ?customers.reduce((total,c)=>{
            const value=Number(c.deviceCount);
            return total+(Number.isFinite(value)&&value>0?value:1);
        },0)
        :0;

    if($("totalCustomers"))$("totalCustomers").textContent=String(mobileCustomers);
    if($("totalDevices"))$("totalDevices").textContent=String(mobileDevices);

    // KABIR REPAIRING DATA — completely separate counts
    const repairRows=Array.isArray(repairing)?repairing:[];
    const repairDevices=repairRows.length;
    const repairCustomerKeys=new Set(
        repairRows.map(r=>{
            const phone=String(r.phone||"").replace(/\D/g,"");
            return phone || String(r.customerName||"").trim().toLowerCase();
        }).filter(Boolean)
    );
    const repairCustomers=repairCustomerKeys.size;

    if($("repairTotalCustomers"))$("repairTotalCustomers").textContent=String(repairCustomers);
    if($("repairTotalDevices"))$("repairTotalDevices").textContent=String(repairDevices);
}


function updateAdmin(){

    if($("adminCustomers"))
        $("adminCustomers").textContent=customers.length;

    if($("adminDevices"))
        $("adminDevices").textContent=
            customers.reduce(
                (s,c)=>s+(c.deviceCount||1),
                0
            );

    if($("adminFirebaseStatus"))
        $("adminFirebaseStatus").textContent=user?"Firebase connected":"Connecting to Firebase…";
    if($("connectionStatus"))
        $("connectionStatus").textContent=user?"Firebase connected ✓":"Firebase connecting…";
}


/* =========================================================
   NAVIGATION
========================================================= */

function show(id){

    [
        "searchSection",
        "addSection",
        "repairAddSection",
        "repairSearchSection",
        "customerDetailModal",
        "themeModal",
        "scannerModal"
    ].forEach(x=>{
        $(x)?.classList.add("hidden");
    });

    $(id)?.classList.remove("hidden");

    setTimeout(()=>{
        $(id)?.scrollIntoView({
            behavior:"smooth",
            block:"start"
        });
    },20);
}

function nav(){

    $("searchCustomerCard")?.addEventListener(
        "click",
        ()=>{
            show("searchSection");
            $("searchInput")?.focus();
            renderSearch();
            audit("customer_search",{section:"Kabir Mobile Data",description:"Customer search opened"});
        }
    );

    $("addCustomerCard")?.addEventListener(
        "click",
        ()=>{
            show("addSection");
        }
    );

    $("totalCustomersCard")?.addEventListener(
        "click",
        ()=>{
            show("searchSection");
            renderSearch();
        }
    );

    $("totalDevicesCard")?.addEventListener(
        "click",
        ()=>{
            show("searchSection");
            renderSearch();
        }
    );

    $("repairTotalCustomersCard")?.addEventListener("click",()=>{
        show("repairSearchSection");
        renderRepairing();
        $("repairSearchInput")?.focus();
    });

    $("repairTotalDevicesCard")?.addEventListener("click",()=>{
        show("repairSearchSection");
        renderRepairing();
        $("repairSearchInput")?.focus();
    });

    const toggleModule=id=>{const el=$(id);if(el)el.classList.toggle("hidden");};
    $("financeModule")?.addEventListener("click",()=>toggleModule("financeBox"));
    $("repairingModule")?.addEventListener("click",()=>toggleModule("repairingBox"));
    $("secondHandModule")?.addEventListener("click",()=>toggleModule("secondHandBox"));
    $("accessoriesModule")?.addEventListener("click",()=>toggleModule("accessoriesBox"));
    document.querySelectorAll("[data-module-close]").forEach(b=>b.addEventListener("click",e=>{e.stopPropagation();$(b.dataset.moduleClose)?.classList.add("hidden");}));
    $("secondCustomerListCard")?.addEventListener("click",()=>{show("secondListSection");renderSecondHand();});
    $("secondStockCard")?.addEventListener("click",()=>{show("secondListSection");renderSecondHand();});
    $("secondSearchCard")?.addEventListener("click",()=>{show("secondListSection");renderSecondHand();$("secondSearchInput")?.focus();});
    $("secondAddCard")?.addEventListener("click",()=>show("secondAddSection"));
    $("accessoryListCard")?.addEventListener("click",()=>{show("accessoryListSection");renderAccessories();});
    $("accessoryStockCard")?.addEventListener("click",()=>{show("accessoryListSection");renderAccessories();});
    $("accessorySearchCard")?.addEventListener("click",()=>{show("accessoryListSection");renderAccessories();$("accessorySearchInput")?.focus();});
    $("accessoryAddCard")?.addEventListener("click",()=>show("accessoryAddSection"));
    $("secondSearchInput")?.addEventListener("input",renderSecondHand);
    $("accessorySearchInput")?.addEventListener("input",renderAccessories);
    $("secondHandForm")?.addEventListener("submit",saveSecondHand);
    $("accessoryForm")?.addEventListener("submit",saveAccessory);

    document
        .querySelectorAll("[data-close]")
        .forEach(b=>{
            b.addEventListener(
                "click",
                ()=>{
                    $(b.dataset.close)
                    ?.classList
                    .add("hidden");
                }
            );
        });
}


function closeTopLayer(){
    const ids=[
        "customerDetailModal","themeModal","scannerModal",
        "repairSearchSection","repairAddSection","addSection","searchSection"
    ];
    for(const id of ids){
        const el=$(id);
        if(el && !el.classList.contains("hidden")){
            el.classList.add("hidden");
            return;
        }
    }
}
document.addEventListener("keydown",e=>{
    if(e.key==="Escape") closeTopLayer();
});

/* =========================================================
   BRANDS / MODELS / COLOURS / STORAGE
========================================================= */

function brands(){

    let b=$("brand");

    if(!b)return;

    Object.keys(BRANDS)
        .sort()
        .forEach(x=>{

            let o=document.createElement("option");

            o.value=x;
            o.textContent=x;

            b.appendChild(o);
        });

    b.onchange=()=>{

        let d=BRANDS[b.value];

        let m=$("model");
        let c=$("colour");
        let s=$("storage");

        m.innerHTML=
            '<option value="">Select model</option>';

        c.innerHTML=
            '<option value="">Select model first</option>';

        s.innerHTML=
            '<option value="">Select model first</option>';

        m.disabled=!d;
        c.disabled=true;
        s.disabled=true;

        if(d){

            fillModelOptions(b.value);
            loadAllPhoneModels().then(()=>{
                if($("brand")?.value===b.value) fillModelOptions(b.value);
            });
        }
    };

    $("model").onchange=()=>{

        let d=BRANDS[b.value];

        let m=$("model");
        let c=$("colour");
        let s=$("storage");

        let cs=d?.models?.[m.value]||[];

        c.innerHTML=
            '<option value="">Select colour</option>';

        cs.forEach(x=>{

            let o=document.createElement("option");

            o.value=x;
            o.textContent=x;

            c.appendChild(o);
        });

        c.disabled=!cs.length;

        s.innerHTML=
            '<option value="">Select storage</option>';

        (d?.storage||[])
            .forEach(x=>{

                let o=document.createElement("option");

                o.value=x;
                o.textContent=x;

                s.appendChild(o);
            });

        s.disabled=!d;
    };
}


/* =========================================================
   PINCODE AUTO CITY / STATE
========================================================= */

function pincode(){

    let e=$("pincode");

    if(!e)return;

    e.oninput=async()=>{

        e.value=e.value
            .replace(/\D/g,"")
            .slice(0,6);

        if(e.value.length!==6)
            return;

        $("pincodeStatus").textContent="…";

        try{

            let r=await fetch(
                "https://api.postalpincode.in/pincode/"
                +e.value
            );

            let d=await r.json();

            let p=d?.[0]?.PostOffice?.[0];

            if(
                d?.[0]?.Status==="Success"
                && p
            ){

                $("city").value=
                    p.District||
                    p.Block||
                    p.Name||
                    "";

                $("state").value=
                    p.State||
                    "";

                $("pincodeStatus").textContent="✓";

            }else{

                $("pincodeStatus").textContent="!";
            }

        }catch(x){

            console.error(x);

            $("pincodeStatus").textContent="!";
        }
    };
}


/* =========================================================
   BILL DATE
========================================================= */

function billDate(){

    let d=new Date();

    d.setMonth(
        d.getMonth()+3
    );

    if($("billDueText"))

        $("billDueText").textContent=
            "Due: "
            +
            new Intl.DateTimeFormat(
                "en-IN",
                {
                    day:"2-digit",
                    month:"short",
                    year:"numeric"
                }
            ).format(d)
            +
            " • Status: NO";

    return d.toISOString();
}


/* =========================================================
   AMOUNT / EMI
========================================================= */

function amounts(){

    let a=$("phoneAmount");
    let d=$("downPayment");
    let e=$("emiAmount");

    let f=()=>{

        let x=Number(a?.value||0);
        let y=Number(d?.value||0);

        if(
            e
            &&
            !e.value
            &&
            x
        ){

            e.value=Math.max(
                x-y,
                0
            );
        }
    };

    a?.addEventListener("input",f);
    d?.addEventListener("input",f);
}


function isWriteLocked(){
    const now=new Date();
    const minutes=now.getHours()*60+now.getMinutes();
    return minutes<600;
}
function enforceWriteLock(messageId="formMessage"){
    if(!isWriteLocked())return false;
    msg(messageId,"12:00 AM से 10:00 AM तक Add/Edit/Delete बंद है. 10:00 AM के बाद फिर कोशिश करें.");
    return true;
}

/* =========================================================
   SAVE CUSTOMER
   IMPORTANT:
   FIREBASE STORAGE DISABLED FOR NOW.
   AADHAAR / PAN / PHOTO ARE OPTIONAL.
========================================================= */

function makeCustomerCode(){
    return "KM"+Math.floor(1000+Math.random()*9000);
}
async function uniqueCustomerCode(){
    for(let i=0;i<20;i++){
        const code=makeCustomerCode();
        if(!customers.some(c=>c.customerCode===code))return code;
    }
    return "KM"+Date.now().toString().slice(-4);
}
function formatDateTime(c){
    const d=c?.createdAt?.toDate?.();
    return d?new Intl.DateTimeFormat("en-IN",{dateStyle:"medium",timeStyle:"short"}).format(d):"Date pending";
}

async function save(e){

    e.preventDefault();
    if(enforceWriteLock())return;

    if(!user){

        msg(
            "formMessage",
            "Firebase connect होने का इंतज़ार करें."
        );

        return;
    }


    /* Required fields */

    let ids=[
        "customerName",
        "address",
        "pincode",
        "city",
        "state",
        "phone",
        "brand",
        "model",
        "imei",
        "colour",
        "storage",
        "phoneAmount",
        "downPayment"
    ];


    for(let id of ids){

        if(!val(id)){

            $(id)?.focus();

            msg(
                "formMessage",
                "सभी जरूरी fields भरें."
            );

            return;
        }
    }


    /* Mobile */

    let phone=
        val("phone")
        .replace(/\D/g,"");


    /* IMEI */

    let imei=
        val("imei")
        .replace(/\D/g,"");


    if(!/^\d{10}$/.test(phone)){

        msg(
            "formMessage",
            "10 digit mobile number डालें."
        );

        return;
    }


    if(!/^\d{15}$/.test(imei)){

        msg(
            "formMessage",
            "15 digit IMEI डालें."
        );

        return;
    }


    $("saveCustomerButton").disabled=true;

    $("saveSpinner")
        ?.classList
        .remove("hidden");


    msg(
        "formMessage",
        "Saving…",
        true
    );


    try{

        /*
         * IMPORTANT:
         * यहां Firebase Storage का कोई upload नहीं है.
         *
         * Aadhaar / PAN / Customer Photo:
         * optional हैं और अभी save process को रोकेंगे नहीं.
         */

        const editId=$("customerForm").dataset.editId;
        const existing=editId?customers.find(c=>c.id===editId):null;
        let customerData={

            customerCode:existing?.customerCode || await uniqueCustomerCode(),
            customerName:
                val("customerName"),

            address:
                val("address"),

            pincode:
                val("pincode"),

            city:
                val("city"),

            state:
                val("state"),

            phone:
                phone,

            brand:
                val("brand"),

            model:
                val("model"),

            imei:
                imei,

            colour:
                val("colour"),

            storage:
                val("storage"),

            financeCompany:
                val("financeCompany"),

            phoneAmount:
                Number(
                    val("phoneAmount")
                )||0,

            downPayment:
                Number(
                    val("downPayment")
                )||0,

            emiAmount:
                Number(
                    val("emiAmount")
                )||0,

            emiMonths:
                Number(
                    val("emiMonths")
                )||0,

            lockName:
                val("lockName"),

            stock:
                val("stock"),

            counter:
                val("counter"),

            financerName:
                val("financerName"),

            bill:existing?.bill || {status:"NO",dueDate:billDate()},

            billYes:existing?.billYes===true,

            deviceCount:1,

            /*
             * Documents अभी खाली रखे जा रहे हैं.
             * बाद में Storage plan लेने पर यहां
             * actual file URLs जोड़ी जा सकती हैं.
             */

            documents:{
                aadhaar:null,
                pan:null,
                customerPhoto:null
            },

            createdAt:
                serverTimestamp(),

            createdBy:
                user.uid
        };


        /*
         * ONLY FIRESTORE SAVE
         */

        if(editId){
            delete customerData.customerCode;
            delete customerData.createdAt;
            delete customerData.createdBy;
            await updateDoc(doc(db,COL,editId),customerData);
            await audit("customer_edit",{section:"Kabir Mobile Data",customerId:editId,customerCode:existing?.customerCode,customerName:customerData.customerName,description:`Customer ${customerData.customerName||existing?.customerCode||editId} edited`});
        }else{
            const added=await addDoc(collection(db,COL),customerData);
            await audit("customer_add",{section:"Kabir Mobile Data",customerId:added.id,customerCode:customerData.customerCode,customerName:customerData.customerName,description:`Customer ${customerData.customerName||customerData.customerCode||added.id} added`});
        }


        /*
         * Form reset
         */

        $("customerForm").reset();
        delete $("customerForm").dataset.editId;
        if($("customerCode")) $("customerCode").value="";
        if($("saveCustomerButton")) $("saveCustomerButton").textContent="22. SAVE CUSTOMER";

        if($("financeCompany"))
            $("financeCompany").value="";


        /*
         * Brand / model reset
         */

        $("model").innerHTML=
            '<option value="">Select brand first</option>';

        $("model").disabled=true;


        $("colour").innerHTML=
            '<option value="">Select model first</option>';

        $("colour").disabled=true;


        $("storage").innerHTML=
            '<option value="">Select model first</option>';

        $("storage").disabled=true;


        billDate();


        msg("formMessage","");
        showSuccessToast("Successfully Saved","Customer data saved successfully");


        /*
         * Add customer screen close
         */

        setTimeout(()=>{

            $("addSection")
                ?.classList
                .add("hidden");

            msg(
                "formMessage",
                ""
            );

        },1200);


    }catch(x){

        console.error(x);

        msg(
            "formMessage",
            x?.message||
            "Customer save नहीं हुआ."
        );


    }finally{

        $("saveCustomerButton").disabled=false;

        $("saveSpinner")
            ?.classList
            .add("hidden");
    }
}


/* =========================================================
   ESCAPE HTML
========================================================= */

function esc(x){

    return String(x??"")
        .replaceAll("&","&amp;")
        .replaceAll("<","&lt;")
        .replaceAll(">","&gt;")
        .replaceAll('"',"&quot;")
        .replaceAll("'","&#039;");
}

function item(a,b){

    return `
        <div class="result-item">
            <small>${esc(a)}</small>
            <b>${esc(b)}</b>
        </div>
    `;
}


/* =========================================================
   CUSTOMER SEARCH
========================================================= */

function renderSearch(){
    const box=$("searchResults"); if(!box)return;
    const s=val("searchInput").toLowerCase();
    const arr=customers.filter(c=>!s||[
        c.customerCode,c.customerName,c.phone,c.imei,c.pincode,c.city,c.state,c.brand,c.model,
        c.colour,c.storage,c.financeCompany,c.lockName,c.stock,c.counter,c.financerName,formatDateTime(c)
    ].filter(Boolean).join(" ").toLowerCase().includes(s));

    if(!arr.length){box.innerHTML=`<div class="empty">${s?"No customer found.":"No customer records yet."}</div>`;return;}

    box.innerHTML=arr.map(c=>`
      <article class="result customer-result" data-customer="${esc(c.id)}">
        <div class="result-top">
          <div><div class="result-name">${esc(c.customerName||"Unnamed")}</div>
          <div class="result-meta">${esc(c.customerCode||"KM----")} • ${esc(c.phone||"")} • ${esc(formatDateTime(c))}</div></div>
          <div class="bill"><span>BILL</span><label class="switch"><input type="checkbox" data-bill="${esc(c.id)}" ${c.billYes?"checked":""}><span class="slider"></span></label></div>
        </div>
        <div class="result-grid">
          ${item("Device",`${c.brand||""} ${c.model||""}`)}
          ${item("IMEI",c.imei||"-")}${item("Finance",c.financeCompany||"-")}
          ${item("Amount",`₹${Number(c.phoneAmount||0).toLocaleString("en-IN")}`)}
        </div>
        <div class="result-open-hint">Tap to view full details • Edit • Delete • PDF</div>
      </article>`).join("");

    box.querySelectorAll("[data-bill]").forEach(i=>{
        i.onchange=async()=>{
            if(enforceWriteLock()){i.checked=!i.checked;return;}
            try{await updateDoc(doc(db,COL,i.dataset.bill),{billYes:i.checked,"bill.status":i.checked?"YES":"NO"}); const bc=customers.find(x=>x.id===i.dataset.bill); await audit("customer_bill_update",{section:"Kabir Mobile Data",customerId:i.dataset.bill,customerCode:bc?.customerCode,customerName:bc?.customerName,description:`Bill marked ${i.checked?"YES":"NO"}`})}
            catch(x){i.checked=!i.checked;console.error(x)}
        };
    });
    box.querySelectorAll(".customer-result").forEach(card=>{
        card.addEventListener("click",e=>{
            if(e.target.closest(".switch"))return;
            const c=customers.find(x=>x.id===card.dataset.customer);if(c)showCustomerDetail(c);
        });
    });
}
function detailItem(a,b){return `<div class="detail-item"><small>${esc(a)}</small><b>${esc(b??"-")}</b></div>`}
let activeCustomerId=null;
function showCustomerDetail(c){
    activeCustomerId=c.id;
    $("detailTitle").textContent=`${c.customerName||"Customer"} • ${c.customerCode||""}`;
    $("customerDetailBody").innerHTML=`<div class="detail-grid">
      ${detailItem("Customer Code",c.customerCode)}${detailItem("Date & Time",formatDateTime(c))}
      ${detailItem("Name",c.customerName)}${detailItem("Phone",c.phone)}
      ${detailItem("Address",c.address)}${detailItem("PIN Code",c.pincode)}
      ${detailItem("City / State",`${c.city||""}, ${c.state||""}`)}
      ${detailItem("Brand",c.brand)}${detailItem("Model",c.model)}${detailItem("IMEI",c.imei)}
      ${detailItem("Colour",c.colour)}${detailItem("RAM + Storage",c.storage)}
      ${detailItem("Finance Company",c.financeCompany)}
      ${detailItem("Phone Amount",`₹${c.phoneAmount||0}`)}${detailItem("Down Payment",`₹${c.downPayment||0}`)}
      ${detailItem("EMI",`₹${c.emiAmount||0} × ${c.emiMonths||0} months`)}
      ${detailItem("Lock",c.lockName)}${detailItem("Stock",c.stock)}
      ${detailItem("Counter",c.counter)}${detailItem("Financer",c.financerName)}
      ${detailItem("Bill",c.billYes?"YES":"NO")}
    </div>`;
    $("customerDetailModal")?.classList.remove("hidden");
}
function closeCustomerDetail(){activeCustomerId=null;$("customerDetailModal")?.classList.add("hidden")}
async function deleteCustomer(){
    if(enforceWriteLock("pinMessage"))return;
    const c=customers.find(x=>x.id===activeCustomerId);if(!c)return;
    if(!confirm(`Delete ${c.customerName||"this customer"} (${c.customerCode||""}) permanently?`))return;
    try{await deleteDoc(doc(db,COL,c.id)); await audit("customer_delete",{section:"Kabir Mobile Data",customerId:c.id,customerCode:c.customerCode,customerName:c.customerName,description:`Customer ${c.customerName||c.customerCode||c.id} deleted`}); closeCustomerDetail()}
    catch(e){console.error(e);alert("Customer delete नहीं हुआ. Firebase Rules check करें.")}
}
function editCustomer(){
    if(enforceWriteLock("formMessage"))return;
    const c=customers.find(x=>x.id===activeCustomerId);if(!c)return;
    closeCustomerDetail();show("addSection");
    const map={customerName:"customerName",address:"address",pincode:"pincode",city:"city",state:"state",phone:"phone",
      brand:"brand",model:"model",imei:"imei",colour:"colour",storage:"storage",financeCompany:"financeCompany",
      phoneAmount:"phoneAmount",downPayment:"downPayment",emiAmount:"emiAmount",emiMonths:"emiMonths",
      lockName:"lockName",stock:"stock",counter:"counter",financerName:"financerName"};
    Object.entries(map).forEach(([k,id])=>{if($(id))$(id).value=c[k]??""});
    $("customerCode").value=c.customerCode||"";
    $("saveCustomerButton").textContent="UPDATE CUSTOMER";
    $("customerForm").dataset.editId=c.id;
    $("brand").dispatchEvent(new Event("change"));
    setTimeout(()=>{
        $("model").value=c.model||"";$("model").dispatchEvent(new Event("change"));
        setTimeout(()=>{$("colour").value=c.colour||"";$("storage").value=c.storage||""},0);
    },100);
}

/* =========================================================
   SEARCH INPUT
========================================================= */

function search(){

    $("searchInput")
        ?.addEventListener(
            "input",
            renderSearch
        );
}


/* =========================================================
   HOME DATE FILTER / DAILY WORK VIEW
========================================================= */
function recordDay(row){
    const d=row?.createdAt?.toDate?.() || (row?.createdAt?new Date(row.createdAt):null);
    return d&&!Number.isNaN(d.getTime())?d.toLocaleDateString("en-CA"):"";
}
function homeDateFilter(){
    const input=$("homeWorkDate");
    const date=input?.value||new Date().toLocaleDateString("en-CA");
    const customerRows=customers.filter(c=>recordDay(c)===date);
    const repairRows=repairing.filter(r=>recordDay(r)===date);
    $("homeDateCustomerCount")&&($("homeDateCustomerCount").textContent=customerRows.length);
    $("homeDateRepairCount")&&($("homeDateRepairCount").textContent=repairRows.length);
    const box=$("homeDateResults"); if(!box)return;
    const rows=[
        ...customerRows.map(c=>({icon:"👤",kind:"Customer",title:c.customerName||"Customer",meta:c.customerCode||"KM----",time:formatDateTime(c),detail:`${c.phone||""} • ${c.brand||""} ${c.model||""}`})),
        ...repairRows.map(r=>({icon:"🛠",kind:"Repairing",title:r.customerName||"Repairing",meta:r.phone||"",time:formatDateTime(r),detail:`${r.device||""} • ${r.problem||""}`}))
    ];
    box.innerHTML=rows.length?rows.map(r=>`<article class="date-work-item"><div class="date-work-icon">${r.icon}</div><div class="date-work-main"><b>${esc(r.title)}</b><small>${esc(r.kind)} • ${esc(r.meta)}</small><span>${esc(r.detail)}</span></div><time>${esc(r.time)}</time></article>`).join(""):'<div class="empty">इस तारीख को कोई Customer या Repairing work नहीं हुआ.</div>';
}
function setupHomeDateFilter(){
    $("homeDateWorkButton")?.addEventListener("click",()=>{
        const sec=$("homeDateWorkSection"); sec?.classList.toggle("hidden");
        if(sec&&!sec.classList.contains("hidden")){
            const d=$("homeWorkDate"); if(d&&!d.value)d.value=new Date().toLocaleDateString("en-CA");
            homeDateFilter(); setTimeout(()=>sec.scrollIntoView({behavior:"smooth",block:"start"}),20);
        }
    });
    $("homeWorkDate")?.addEventListener("change",homeDateFilter);
}

/* =========================================================
   IMEI QR / BARCODE SCANNER
========================================================= */

async function startScan(){

    let modal=$("scannerModal");
    let video=$("scannerVideo");
    let m=$("scannerMessage");

    modal.classList.remove("hidden");


    if(!("BarcodeDetector" in window)){

        m.textContent=
            "इस browser में barcode scanner available नहीं है. IMEI manually enter करें.";

        return;
    }


    try{

        let fmts=
            await BarcodeDetector
                .getSupportedFormats();


        let formats=
            fmts.filter(
                x=>[
                    "qr_code",
                    "code_128",
                    "code_39",
                    "ean_13",
                    "ean_8"
                ].includes(x)
            );


        if(!formats.length)
            throw Error("No barcode format");


        scanStream=
            await navigator.mediaDevices
                .getUserMedia({
                    video:{
                        facingMode:{
                            ideal:"environment"
                        }
                    },
                    audio:false
                });


        video.srcObject=scanStream;

        await video.play();


        let detector=
            new BarcodeDetector({
                formats
            });


        let loop=async()=>{

            if(!scanStream)
                return;

            try{

                let a=
                    await detector.detect(video);


                if(a?.length){

                    let raw=
                        a[0].rawValue||"";

                    let d=
                        raw.replace(
                            /\D/g,
                            ""
                        );


                    m.textContent=
                        "Scanned: "+raw;


                    if(d.length>=15){

                        $("imei").value=
                            d.slice(0,15);

                        stopScan();

                        return;
                    }
                }

            }catch(x){}


            scanTimer=
                setTimeout(
                    loop,
                    350
                );
        };


        loop();


    }catch(x){

        console.error(x);

        m.textContent=
            "Camera access नहीं मिला. iPhone Settings में camera permission check करें.";
    }
}


function stopScan(){

    if(scanTimer)
        clearTimeout(scanTimer);

    scanTimer=null;


    if(scanStream)
        scanStream
            .getTracks()
            .forEach(
                t=>t.stop()
            );

    scanStream=null;


    if($("scannerVideo"))
        $("scannerVideo").srcObject=null;


    $("scannerModal")
        ?.classList
        .add("hidden");
}


function scanner(){

    $("scanImeiButton")
        ?.addEventListener(
            "click",
            startScan
        );

    $("closeScannerButton")
        ?.addEventListener(
            "click",
            stopScan
        );
}


/* =========================================================
   CHANGE PIN
========================================================= */

function changePin(){
    const f=$("changePinForm");
    if(!f)return;
    f.onsubmit=async e=>{
        e.preventDefault();
        try{await loadSharedPin()}catch(x){return msg("pinSettingsMessage",x?.message||"PIN load नहीं हुआ. Firebase connection check करें.")}
        const a=val("currentPin"),b=val("newPin"),c=val("confirmPin");
        if(a!==pin())return msg("pinSettingsMessage","Current PIN incorrect.");
        if(!/^\d{4}$/.test(b))return msg("pinSettingsMessage","New PIN exactly 4 digits होना चाहिए.");
        if(b!==c)return msg("pinSettingsMessage","New PIN और confirmation match नहीं हैं.");
        try{
            await changeSharedPin(b);
            f.reset();
            msg("pinSettingsMessage","PIN changed successfully ✓",true);
            showSuccessToast("PIN Updated","New PIN is now saved to Firebase");
        }catch(error){
            console.error(error);
            msg("pinSettingsMessage","PIN save नहीं हुआ. Firebase Rules check करें.");
        }
    };
}


let repairListenerStarted=false;

function subscribeInventory(){
    if(isAdminPage)return;
    onSnapshot(collection(db,SECOND_COL),snap=>{ secondHand=snap.docs.map(d=>({id:d.id,...d.data()})); if($("secondStockCount"))$("secondStockCount").textContent=String(secondHand.length); renderSecondHand(); },e=>console.warn("Second hand load:",e));
    onSnapshot(collection(db,ACCESSORY_COL),snap=>{ accessories=snap.docs.map(d=>({id:d.id,...d.data()})); if($("accessoryStockCount"))$("accessoryStockCount").textContent=String(accessories.reduce((n,x)=>n+Number(x.quantity||0),0)); renderAccessories(); },e=>console.warn("Accessories load:",e));
}
function renderSecondHand(){ const box=$("secondResults"); if(!box)return; const q=val("secondSearchInput").toLowerCase(); const rows=secondHand.filter(x=>!q||[x.customerName,x.phone,x.device,x.imei,x.condition].join(" ").toLowerCase().includes(q)); box.innerHTML=rows.length?rows.map(x=>`<article class="result"><div class="result-name">${esc(x.device||"Second Hand Phone")}</div><div class="result-meta">${esc(x.customerName||"")} • ${esc(x.phone||"")}</div><div class="result-grid">${item("IMEI",x.imei||"")}${item("Condition",x.condition||"")}${item("Purchase Price",`₹${Number(x.price||0).toLocaleString("en-IN")}`)}${item("Sale Price",`₹${Number(x.salePrice||0).toLocaleString("en-IN")}`)}</div></article>`).join(""):"<div class=\"empty\">No second-hand records found.</div>"; }
function renderAccessories(){ const box=$("accessoryResults"); if(!box)return; const q=val("accessorySearchInput").toLowerCase(); const rows=accessories.filter(x=>!q||[x.name,x.category].join(" ").toLowerCase().includes(q)); box.innerHTML=rows.length?rows.map(x=>`<article class="result"><div class="result-name">${esc(x.name||"Accessory")}</div><div class="result-meta">${esc(x.category||"")}</div><div class="result-grid">${item("Quantity",x.quantity||0)}${item("Purchase Price",`₹${Number(x.price||0).toLocaleString("en-IN")}`)}${item("Sale Price",`₹${Number(x.salePrice||0).toLocaleString("en-IN")}`)}</div></article>`).join(""):"<div class=\"empty\">No accessories found.</div>"; }
async function saveSecondHand(e){ e.preventDefault(); const data={customerName:val("secondCustomerName"),phone:val("secondPhone").replace(/\D/g,""),device:val("secondDevice"),imei:val("secondImei"),condition:val("secondCondition"),price:Number(val("secondPrice")||0),salePrice:Number(val("secondSalePrice")||0),createdAt:serverTimestamp(),createdBy:user?.uid||null}; if(!data.customerName||!/^\d{10}$/.test(data.phone)||!data.device){msg("secondMessage","Customer name, valid 10 digit phone और phone model भरें.");return;} try{await addDoc(collection(db,SECOND_COL),data);await audit("second_hand_add",{section:"Second Hand",customerName:data.customerName,description:`Second-hand phone added: ${data.device}`,extra:{phone:data.phone,imei:data.imei}});e.target.reset();msg("secondMessage","Successfully added.",true);showSuccessToast("Second Hand Saved","Phone stock में add हो गया.");}catch(err){console.error(err);msg("secondMessage",err?.message||"Save failed.");}}
async function saveAccessory(e){ e.preventDefault(); const data={name:val("accessoryName"),category:val("accessoryCategory"),quantity:Number(val("accessoryQty")||0),price:Number(val("accessoryPrice")||0),salePrice:Number(val("accessorySalePrice")||0),createdAt:serverTimestamp(),createdBy:user?.uid||null}; if(!data.name||!data.category||data.quantity<1){msg("accessoryMessage","Name, category और quantity भरें.");return;} try{await addDoc(collection(db,ACCESSORY_COL),data);await audit("accessory_add",{section:"Accessories",description:`Accessory added: ${data.name}`,extra:{category:data.category,quantity:data.quantity}});e.target.reset();msg("accessoryMessage","Successfully added.",true);showSuccessToast("Accessory Saved","Accessory stock में add हो गया.");}catch(err){console.error(err);msg("accessoryMessage",err?.message||"Save failed.");}}
function subscribeRepairing(){
    if(repairListenerStarted)return;
    repairListenerStarted=true;

    const applyRepairing = s => {
        repairing = s.docs.map(d => ({id:d.id,...d.data()}));

        repairing.sort((a,b)=>{
            const ta = a.createdAt?.toMillis?.() || 0;
            const tb = b.createdAt?.toMillis?.() || 0;
            return tb-ta;
        });

        counts();
        renderRepairing();
    };

    onSnapshot(
        collection(db,REPAIR_COL),
        applyRepairing,
        e => {
            console.error("Repairing listener:",e);
            const box=$("repairResults");
            if(box){
                box.innerHTML='<div class="empty">Repairing data load नहीं हुआ. Firebase Rules check करें.</div>';
            }
        }
    );
}
function renderRepairing(){
    const box=$("repairResults");if(!box)return;
    const s=val("repairSearchInput").toLowerCase();
    const arr=repairing.filter(r=>!s||[r.customerName,r.phone,r.device,r.problem,r.repairBy,r.payment,formatDateTime(r)].join(" ").toLowerCase().includes(s));
    if(!arr.length){box.innerHTML=`<div class="empty">${s?"No repairing record found.":"No repairing records yet."}</div>`;return}
    box.innerHTML=arr.map(r=>`<article class="result">
      <div class="result-name">${esc(r.customerName||"")}</div><div class="result-meta">${esc(r.phone||"")} • ${esc(formatDateTime(r))}</div>
      <div class="result-grid">${item("Brand / Model",r.device)}${item("Problem",r.problem)}${item("Repairing By",r.repairBy)}${item("Payment",`₹${Number(r.payment||0).toLocaleString("en-IN")}`)}</div>
    </article>`).join("");
}
async function saveRepair(e){
    e.preventDefault();
    if(enforceWriteLock("repairMessage"))return;
    const ids=["repairCustomerName","repairPhone","repairDevice","repairProblem","repairBy","repairPayment"];
    for(const id of ids)if(!val(id)){ $(id)?.focus();msg("repairMessage","सभी fields भरना जरूरी है.");return }
    const phone=val("repairPhone").replace(/\D/g,"");
    if(!/^\d{10}$/.test(phone)){msg("repairMessage","10 digit customer phone number डालें.");return}
    const saveBtn = $("repairForm")?.querySelector("button[type='submit']");
    if(saveBtn) saveBtn.disabled=true;

    try{
        const repairRef=await addDoc(collection(db,REPAIR_COL),{
            customerName:val("repairCustomerName"),
            phone,
            device:val("repairDevice"),
            problem:val("repairProblem"),
            repairBy:val("repairBy"),
            payment:Number(val("repairPayment")),
            createdAt:serverTimestamp(),
            createdBy:user?.uid||null
        });
        await audit("repairing_add",{section:"Kabir Repairing Data",customerId:repairRef.id,customerName:val("repairCustomerName"),description:`Repairing added: ${val("repairProblem")||"Problem"}`,extra:{phone,device:val("repairDevice"),problem:val("repairProblem"),payment:Number(val("repairPayment"))}});

        $("repairForm").reset();
        msg("repairMessage","");
        showSuccessToast("Successfully Saved","Repairing data saved successfully");
    }catch(e){
        console.error(e);
        msg("repairMessage",e?.message||"Repairing save नहीं हुआ.");
    }finally{
        if(saveBtn) saveBtn.disabled=false;
    }
}
function loadScript(src){return new Promise((resolve,reject)=>{const s=document.createElement("script");s.src=src;s.onload=resolve;s.onerror=reject;document.head.appendChild(s)})}
async function exportXlsx(rows,filename,sheet){
    try{
        if(!window.XLSX)await loadScript("https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js");
        const ws=XLSX.utils.json_to_sheet(rows),wb=XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb,ws,sheet);XLSX.writeFile(wb,filename);
    }catch(e){console.error(e);alert("Excel file download नहीं हो पाया.")}
}

function pdfSafe(value){
    return String(value??"").replace(/\s+/g," ").trim() || "—";
}
function pdfDate(row){
    try{return formatDateTime(row)||"—"}catch{return "—"}
}
function pdfSectionTitle(pdf,title,subtitle){
    const pageW=pdf.internal.pageSize.getWidth();
    pdf.setFillColor(12,15,22);pdf.roundedRect(14,18,pageW-28,22,5,5,"F");
    pdf.setTextColor(255,255,255);pdf.setFontSize(16);pdf.setFont(undefined,"bold");pdf.text(title,22,32);
    if(subtitle){pdf.setFontSize(8);pdf.setFont(undefined,"normal");pdf.setTextColor(185,190,205);pdf.text(subtitle,pageW-22,32,{align:"right"});}
    pdf.setTextColor(20,22,28);
}
function pdfFieldGrid(pdf,rows,startY){
    const pageW=pdf.internal.pageSize.getWidth();
    const left=14,right=pageW-14,gap=7,colW=(right-left-gap)/2;
    let y=startY;
    for(let i=0;i<rows.length;i+=2){
        const pair=rows.slice(i,i+2).map(([k,v])=>[pdfSafe(k),pdfSafe(v)]);
        const prepared=pair.map(([k,v])=>{
            pdf.setFontSize(7);const lines=pdf.splitTextToSize(v,colW-12);return {k,vLines:lines};
        });
        const h=Math.max(17,...prepared.map(x=>10+x.vLines.length*4.2));
        if(y+h>190){pdf.addPage();pdfSectionTitle(pdf,"KABIR MOBILE DATA","CONTINUED");y=48;}
        prepared.forEach((x,j)=>{
            const x0=left+j*(colW+gap);
            pdf.setFillColor(247,248,251);pdf.setDrawColor(225,228,235);pdf.roundedRect(x0,y,colW,h,3,3,"FD");
            pdf.setTextColor(95,100,112);pdf.setFontSize(6.5);pdf.setFont(undefined,"bold");pdf.text(x.k,x0+6,y+7);
            pdf.setTextColor(25,27,34);pdf.setFontSize(7.5);pdf.setFont(undefined,"normal");pdf.text(x.vLines,x0+6,y+12);
        });
        y+=h+4;
    }
    return y;
}
function pdfRecord(pdf,number,title,rows){
    let y=45;
    if(pdf.internal.getNumberOfPages()>1){
        // Continue on the current page when space is available.
        y=45;
    }
    pdf.setFillColor(231,234,242);pdf.roundedRect(14,y, pdf.internal.pageSize.getWidth()-28, 10, 3,3,"F");
    pdf.setTextColor(35,38,48);pdf.setFontSize(9);pdf.setFont(undefined,"bold");pdf.text(`${number}. ${pdfSafe(title)}`,20,y+6.7);
    y=pdfFieldGrid(pdf,rows,y+14);
    return y;
}

async function downloadCompletePdf(){
    try{
        const total=customers.length+repairing.length+secondHand.length+accessories.length;
        if(!total){alert("Abhi PDF banane ke liye koi data उपलब्ध नहीं है.");return;}
        if(!window.jspdf)await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
        if(!window.jspdf?.jsPDF?.API?.autoTable)await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.4/jspdf.plugin.autotable.min.js");
        const pdf=new window.jspdf.jsPDF({orientation:"landscape",unit:"mm",format:"a4"});
        const pageW=pdf.internal.pageSize.getWidth(),pageH=pdf.internal.pageSize.getHeight();
        const stamp=new Date().toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"});

        // Premium cover
        pdf.setFillColor(7,8,12);pdf.rect(0,0,pageW,pageH,"F");
        pdf.setFillColor(30,34,55);pdf.circle(28,28,38,"F");
        pdf.setFillColor(70,75,125);pdf.circle(pageW-25,pageH-18,46,"F");
        pdf.setTextColor(255,255,255);pdf.setFont(undefined,"bold");pdf.setFontSize(30);pdf.text("KABIR MOBILE DATA",20,70);
        pdf.setFont(undefined,"normal");pdf.setFontSize(12);pdf.setTextColor(190,195,210);pdf.text("Complete Business Data • Premium PDF Report",20,80);
        pdf.setDrawColor(90,95,125);pdf.line(20,88,pageW-20,88);
        const summary=[
            ["CUSTOMERS",customers.length],
            ["REPAIRING",repairing.length],
            ["SECOND HAND",secondHand.length],
            ["ACCESSORIES",accessories.length]
        ];
        let sx=20;summary.forEach(([label,value])=>{
            pdf.setFillColor(20,24,34);pdf.roundedRect(sx,102,58,32,6,6,"F");
            pdf.setTextColor(150,155,175);pdf.setFontSize(7);pdf.text(label,sx+8,112);
            pdf.setTextColor(255,255,255);pdf.setFontSize(19);pdf.setFont(undefined,"bold");pdf.text(String(value),sx+8,126);
            sx+=64;
        });
        pdf.setFont(undefined,"normal");pdf.setFontSize(8);pdf.setTextColor(145,150,165);pdf.text(`Generated: ${stamp}`,20,pageH-20);
        pdf.text("Copyright © 2026 Kabir Data powered by AMAN",pageW-20,pageH-20,{align:"right"});

        // Customers
        if(customers.length){
            customers.forEach((c,idx)=>{
                pdf.addPage();pdfSectionTitle(pdf,"CUSTOMER DATABASE",`${idx+1} / ${customers.length}`);
                const rows=[
                    ["Customer Code",c.customerCode],["Date & Time",pdfDate(c)],["Customer Name",c.customerName],["Mobile Number",c.phone],
                    ["Address",c.address],["PIN Code",c.pincode],["City / Village",c.city],["State",c.state],
                    ["Phone Brand",c.brand],["Phone Model",c.model],["IMEI",c.imei],["Colour",c.colour],["RAM + Storage",c.storage],
                    ["Finance Company",c.financeCompany],["Phone Amount",`₹${Number(c.phoneAmount||0).toLocaleString("en-IN")}`],
                    ["Down Payment",`₹${Number(c.downPayment||0).toLocaleString("en-IN")}`],
                    ["EMI Amount",`₹${Number(c.emiAmount||0).toLocaleString("en-IN")} × ${Number(c.emiMonths||0)} months`],
                    ["Lock",c.lockName],["Stock",c.stock],["Counter",c.counter],["Financer Name",c.financerName],
                    ["Bill",c.billYes?"YES":"NO"],["Aadhaar Document",c.documents?.aadhaar?"Available":"Not attached"],
                    ["PAN Document",c.documents?.pan?"Available":"Not attached"],["Customer Photo",c.documents?.customerPhoto?"Available":"Not attached"]
                ];
                pdfFieldGrid(pdf,rows,48);
            });
        }
        // Repairing
        if(repairing.length){
            pdf.addPage();pdfSectionTitle(pdf,"REPAIRING DATABASE",`${repairing.length} records`);
            const rows=repairing.map((r,i)=>[
                String(i+1),pdfDate(r),pdfSafe(r.customerName),pdfSafe(r.phone),pdfSafe(r.device),pdfSafe(r.problem),pdfSafe(r.repairBy),`₹${Number(r.payment||0).toLocaleString("en-IN")}`
            ]);
            pdf.autoTable?.({startY:48,head:[["#","Date & Time","Customer","Phone","Brand / Model","Problem","Repairing By","Payment"]],body:rows,theme:"grid",styles:{fontSize:7,cellPadding:3},headStyles:{fillColor:[20,24,34],textColor:[255,255,255],fontStyle:"bold"},alternateRowStyles:{fillColor:[247,248,251]},margin:{left:14,right:14}});
            if(!pdf.autoTable){
                let y=48;rows.forEach(r=>{pdf.setFontSize(7);pdf.text(r.map(pdfSafe).join("  |  "),14,y,{maxWidth:pageW-28});y+=5;if(y>190){pdf.addPage();y=22;}});
            }
        }
        // Second hand
        if(secondHand.length){
            pdf.addPage();pdfSectionTitle(pdf,"SECOND HAND INVENTORY",`${secondHand.length} records`);
            const rows=secondHand.map((r,i)=>[String(i+1),pdfDate(r),pdfSafe(r.customerName),pdfSafe(r.phone),pdfSafe(r.device),pdfSafe(r.imei),pdfSafe(r.condition),`₹${Number(r.price||0).toLocaleString("en-IN")}`,`₹${Number(r.salePrice||0).toLocaleString("en-IN")}`]);
            if(!pdf.autoTable){
                let y=48;rows.forEach(r=>{pdf.setFontSize(7);pdf.text(r.map(pdfSafe).join("  |  "),14,y,{maxWidth:pageW-28});y+=5;if(y>190){pdf.addPage();y=22;}});
            }else pdf.autoTable({startY:48,head:[["#","Date & Time","Customer","Phone","Device","IMEI","Condition","Purchase","Sale"]],body:rows,theme:"grid",styles:{fontSize:7,cellPadding:3},headStyles:{fillColor:[20,24,34],textColor:[255,255,255],fontStyle:"bold"},alternateRowStyles:{fillColor:[247,248,251]},margin:{left:14,right:14}});
        }
        // Accessories
        if(accessories.length){
            pdf.addPage();pdfSectionTitle(pdf,"ACCESSORIES INVENTORY",`${accessories.length} records`);
            const rows=accessories.map((r,i)=>[String(i+1),pdfDate(r),pdfSafe(r.name),pdfSafe(r.category),String(r.quantity||0),`₹${Number(r.price||0).toLocaleString("en-IN")}`,`₹${Number(r.salePrice||0).toLocaleString("en-IN")}`]);
            if(!pdf.autoTable){
                let y=48;rows.forEach(r=>{pdf.setFontSize(7);pdf.text(r.map(pdfSafe).join("  |  "),14,y,{maxWidth:pageW-28});y+=5;if(y>190){pdf.addPage();y=22;}});
            }else pdf.autoTable({startY:48,head:[["#","Date & Time","Item","Category","Qty","Purchase","Sale"]],body:rows,theme:"grid",styles:{fontSize:7,cellPadding:3},headStyles:{fillColor:[20,24,34],textColor:[255,255,255],fontStyle:"bold"},alternateRowStyles:{fillColor:[247,248,251]},margin:{left:14,right:14}});
        }
        // Footer every page
        const pages=pdf.getNumberOfPages();
        for(let i=1;i<=pages;i++){
            pdf.setPage(i);pdf.setDrawColor(225,228,235);pdf.line(14,pageH-10,pageW-14,pageH-10);
            pdf.setFontSize(6.5);pdf.setTextColor(125,130,142);pdf.setFont(undefined,"normal");
            pdf.text("KABIR MOBILE DATA • Confidential Business Report",14,pageH-5);
            pdf.text(`Page ${i} / ${pages}`,pageW-14,pageH-5,{align:"right"});
        }
        await audit("customer_pdf",{section:"Kabir Mobile Data",description:`Complete PDF downloaded (${total} total records)`});
        pdf.save(`Kabir_Mobile_Data_Complete_${new Date().toISOString().slice(0,10)}.pdf`);
    }catch(e){
        console.error("Complete PDF error:",e);
        alert("Complete PDF बन नहीं पाया. Internet connection check करके फिर कोशिश करें.");
    }
}

function setupHomePdf(){
    $("homePdfButton")?.addEventListener("click",downloadCompletePdf);
}

function setupHomeModuleReorder(){
    const container=$("homeModules");
    if(!container)return;
    const key="kabir_home_module_order";
    const ids=["financeModule","repairingModule","secondHandModule","accessoriesModule"];
    const boxes={financeModule:"financeBox",repairingModule:"repairingBox",secondHandModule:"secondHandBox",accessoriesModule:"accessoriesBox"};
    const getCards=()=>ids.map(id=>$(id)).filter(Boolean);
    const getOrder=()=>{try{const a=JSON.parse(localStorage.getItem(key)||"[]");return Array.isArray(a)?a.filter(x=>ids.includes(x)):[]}catch{return []}};
    const saveOrder=order=>localStorage.setItem(key,JSON.stringify(order));
    const applyOrder=order=>{
        const normalized=[...order,...ids.filter(x=>!order.includes(x))];
        normalized.forEach(id=>{const card=$(id),box=$(boxes[id]);if(card)container.appendChild(card);if(box)container.appendChild(box);});
        saveOrder(normalized);
    };
    applyOrder(getOrder());

    let dragging=null,longPress=null,startY=0,moved=false,suppressClick=false;
    const group=(id)=>({card:$(id),box:$(boxes[id])});
    const reorder=(sourceId,targetId)=>{
        if(!sourceId||!targetId||sourceId===targetId)return;
        const order=[...container.querySelectorAll(":scope > .module-card")].map(x=>x.id);
        const a=order.indexOf(sourceId),b=order.indexOf(targetId);
        if(a<0||b<0)return;
        order.splice(a,1);order.splice(b,0,sourceId);applyOrder(order);
    };
    const clearTimer=()=>{if(longPress){clearTimeout(longPress);longPress=null;}};
    getCards().forEach(card=>{
        card.style.touchAction="pan-y";
        card.addEventListener("pointerdown",e=>{
            if(e.pointerType==="mouse"&&e.button!==0)return;
            clearTimer();moved=false;startY=e.clientY;
            longPress=setTimeout(()=>{
                dragging=card.id;card.classList.add("module-dragging");
                try{card.setPointerCapture(e.pointerId)}catch{}
                navigator.vibrate?.(20);
            },480);
        });
        card.addEventListener("pointermove",e=>{
            if(!dragging){if(Math.abs(e.clientY-startY)>8){moved=true;clearTimer();}return;}
            e.preventDefault();moved=true;
            const target=e.target.closest?.(".module-card");
            if(!target||target.id===dragging)return;
            const rect=target.getBoundingClientRect();
            const before=e.clientY<rect.top+rect.height/2;
            const source=group(dragging),dest=group(target.id);
            if(!source.card||!dest.card)return;
            const order=[...container.querySelectorAll(":scope > .module-card")].map(x=>x.id);
            const si=order.indexOf(dragging),ti=order.indexOf(target.id);
            if(si===ti)return;
            order.splice(si,1);
            let insert=order.indexOf(target.id)+(before?0:1);
            order.splice(insert,0,dragging);
            applyOrder(order);
        });
        card.addEventListener("pointerup",()=>{clearTimer();if(dragging){$(dragging)?.classList.remove("module-dragging");dragging=null;suppressClick=true;setTimeout(()=>suppressClick=false,80);}});
        card.addEventListener("pointercancel",()=>{clearTimer();if(dragging){$(dragging)?.classList.remove("module-dragging");dragging=null;suppressClick=true;setTimeout(()=>suppressClick=false,80);}});
        card.addEventListener("click",e=>{if(suppressClick){e.preventDefault();e.stopImmediatePropagation();suppressClick=false;}} ,true);
    });
}

function applyTheme(theme){
    const allowed=["dark","light","midnight","silver","glass"];
    if(!allowed.includes(theme)) theme="dark";

    document.documentElement.setAttribute("data-theme",theme);
    localStorage.setItem("kabir_theme",theme);

    document.querySelectorAll("#themeChoices button[data-theme]").forEach(btn=>{
        btn.classList.toggle("selected",btn.dataset.theme===theme);
    });
}

function themeSystem(){
    applyTheme(localStorage.getItem("kabir_theme")||"dark");

    $("themeButton")?.addEventListener("click",()=>{
        $("themeModal")?.classList.remove("hidden");
    });

    $("closeThemeButton")?.addEventListener("click",()=>{
        $("themeModal")?.classList.add("hidden");
    });

    $("themeChoices")?.addEventListener("click",e=>{
        const btn=e.target.closest("button[data-theme]");
        if(!btn)return;
        applyTheme(btn.dataset.theme);
        setTimeout(()=>$("themeModal")?.classList.add("hidden"),180);
    });
}

function featureNav(){
    $("addRepairingCard")?.addEventListener("click",()=>show("repairAddSection"));
    $("searchRepairingCard")?.addEventListener("click",()=>{show("repairSearchSection");renderRepairing();$("repairSearchInput")?.focus();audit("repairing_search",{section:"Kabir Repairing Data",description:"Repairing search opened"})});
    $("repairSearchInput")?.addEventListener("input",renderRepairing);
    $("repairForm")?.addEventListener("submit",saveRepair);
    $("deleteCustomerButton")?.addEventListener("click",deleteCustomer);
    $("editCustomerButton")?.addEventListener("click",editCustomer);
    $("closeDetailButton")?.addEventListener("click",closeCustomerDetail);
}

/* PATCH v2026-08-18 premium functional upgrade */
const isAdminPage = document.body.classList.contains('admin') || location.pathname.toLowerCase().includes('admin');

function deviceInfo(){
    const ua=navigator.userAgent||'';
    let brand='Unknown', model='Browser';
    if(/iPhone/i.test(ua)){brand='Apple';model='iPhone (exact model not exposed by Safari)';}
    else if(/iPad/i.test(ua)){brand='Apple';model='iPad (exact model not exposed by Safari)';}
    else if(/Samsung/i.test(ua)){brand='Samsung';model=(ua.match(/Samsung[^;) ]*/i)||['Samsung device'])[0];}
    else if(/Pixel/i.test(ua)){brand='Google';model=(ua.match(/Pixel[^;) ]*/i)||['Pixel'])[0];}
    else if(/OnePlus/i.test(ua)){brand='OnePlus';model=(ua.match(/OnePlus[^;) ]*/i)||['OnePlus device'])[0];}
    else if(/Android/i.test(ua)){brand='Android';model=(ua.match(/Android[^;)]*/i)||['Android device'])[0].trim();}
    const browser=/CriOS/i.test(ua)?'Chrome iOS':/EdgiOS/i.test(ua)?'Edge iOS':/FxiOS/i.test(ua)?'Firefox iOS':/Chrome/i.test(ua)?'Chrome':/Safari/i.test(ua)?'Safari':/Firefox/i.test(ua)?'Firefox':'Browser';
    return {brand,model,browser,platform:navigator.platform||'',language:navigator.language||''};
}

async function audit(action,details={}){
    try{
        const d=deviceInfo();
        await addDoc(collection(db,AUDIT_COL),{
            action:String(action||'work'),label:auditLabel(action),userUid:user?.uid||'unknown',
            userName:localStorage.getItem('kabir_current_user')||'Kabir User',section:details.section||'Kabir Mobile Data',
            customerId:details.customerId||null,customerCode:details.customerCode||null,customerName:details.customerName||null,
            description:details.description||auditLabel(action),details:details.extra||null,
            deviceBrand:d.brand,deviceModel:d.model,browser:d.browser,platform:d.platform,language:d.language,clientTime:new Date().toISOString(),createdAt:serverTimestamp()
        });
    }catch(e){console.warn('Audit log failed:',e?.message||e)}
}

function renderWorkHistory(){
    const box=$('workHistoryResults'); if(!box)return;
    const q=val('workSearchInput').toLowerCase();
    const rows=auditLogs.filter(x=>!q||[x.label,x.action,x.userName,x.userUid,x.section,x.customerCode,x.customerName,x.description,x.deviceBrand,x.deviceModel,auditTime(x)].join(' ').toLowerCase().includes(q));
    if(!rows.length){box.innerHTML='<div class="empty">अभी कोई work history उपलब्ध नहीं है.</div>';return;}
    const iconMap={customer_add:'👤',customer_edit:'✏️',customer_delete:'🗑️',customer_bill_update:'🧾',repairing_add:'🛠️',customer_search:'🔎',repairing_search:'🔎',customer_export:'📥',repairing_export:'📥',customer_pdf:'🔵',pin_change:'🔐',login_success:'🟢',login_failed:'🔴',page_open:'🟡',logout:'⚪',second_hand_add:'📱',accessory_add:'🎧'};
    box.innerHTML=rows.slice(0,300).map((x,i)=>`<article class="result work-log">
      <div class="work-log-head"><div class="work-log-icon">${iconMap[x.action]||'⚡'}</div><div class="work-log-title"><b>${esc(x.label||auditLabel(x.action))}</b><small>${esc(x.section||'Kabir Mobile Data')} • ${esc(x.userName||x.userUid||'Kabir User')}</small></div><time class="work-log-time">${esc(auditTime(x))}</time></div>
      <div class="work-log-desc">${esc(x.description||auditLabel(x.action))}</div>
      <div class="work-log-device"><span>${x.action==='login_success'?'🟢 Login Success':x.action==='login_failed'?'🔴 Login Failed':x.action==='page_open'?'🟡 Website Open':x.action==='customer_pdf'?'🔵 PDF Download':x.action==='logout'?'⚪ Logout':'⚡ Work'}</span><span>📱 ${esc(x.deviceBrand||'Device')} • ${esc(x.deviceModel||'Unknown model')}</span><span>🌐 ${esc(x.browser||'Browser')}</span></div>
      <div class="work-log-tags"><span class="work-log-tag">#${i+1}</span>${x.customerCode?`<span class="work-log-tag">${esc(x.customerCode)}</span>`:''}${x.customerName?`<span class="work-log-tag">${esc(x.customerName)}</span>`:''}<span class="work-log-tag">${esc(x.action||'work')}</span></div>
    </article>`).join('');
}

function managementRows(type){
    if(type==='finance') return customers.map(c=>({id:c.id,title:c.customerName||'Customer',meta:`${c.customerCode||'KM----'} • ${c.phone||''}`,detail:`${c.brand||''} ${c.model||''} • IMEI ${c.imei||'-'}`,deleteId:c.id}));
    if(type==='repairing') return repairing.map(r=>({id:r.id,title:r.customerName||'Repairing',meta:r.phone||'',detail:`${r.device||''} • ${r.problem||''} • Total ₹${Number(r.total??r.payment??0).toLocaleString('en-IN')}`,deleteId:null}));
    if(type==='second') return secondHand.map(r=>({id:r.id,title:r.customerName||r.model||r.device||'Second Hand',meta:r.phone||'',detail:`${r.brand||''} ${r.model||r.device||''} • Profit ₹${Number(r.profit??(Number(r.salePrice||0)-Number(r.price||0))).toLocaleString('en-IN')}`,deleteId:null}));
    return accessories.map(r=>({id:r.id,title:r.name||'Accessory',meta:r.sn||'SN not set',detail:`Qty ${r.quantity||0} • Profit ₹${Number(r.profit??(Number(r.salePrice||0)-Number(r.price||0))).toLocaleString('en-IN')}`,deleteId:null}));
}
function renderTrafficManagement(type){
    const box=$('trafficManagementData'); if(!box)return;
    const rows=managementRows(type);
    $('trafficManagementTitle')&&($('trafficManagementTitle').textContent={finance:'Finance Management',repairing:'Repairing Management',second:'Second Hand Management',accessories:'Accessories Management'}[type]||'Management');
    box.innerHTML=rows.length?rows.map(r=>`<article class="admin-data-row"><div><b>${esc(r.title)}</b><small>${esc(r.meta)}</small><span>${esc(r.detail)}</span></div>${r.deleteId?`<button class="admin-delete-customer" data-admin-delete="${esc(r.deleteId)}" type="button">DELETE</button>`:''}</article>`).join(''):'<div class="empty">इस management में अभी कोई data नहीं है.</div>';
    box.querySelectorAll('[data-admin-delete]').forEach(btn=>btn.addEventListener('click',async e=>{
        e.stopPropagation();
        if(!confirm('इस customer को permanently delete करना है?'))return;
        if(enforceWriteLock())return;
        try{const c=customers.find(x=>x.id===btn.dataset.adminDelete);await deleteDoc(doc(db,COL,btn.dataset.adminDelete));await audit('customer_delete',{section:'Admin Panel • Finance Management',customerId:btn.dataset.adminDelete,customerCode:c?.customerCode,customerName:c?.customerName,description:`Admin deleted customer ${c?.customerName||c?.customerCode||btn.dataset.adminDelete}`});showSuccessToast('Customer Deleted','Admin ने customer record delete कर दिया.');}
        catch(err){console.error(err);alert('Customer delete नहीं हुआ. Firebase Rules check करें.')}
    }));
}

function renderTraffic(){
    renderCustomerDateGraph();
    const type=window.__trafficType||$('trafficManagementSelect')?.value||'finance';
    renderTrafficManagement(type);
    const hb=$('trafficHours');
    if(hb){const hours=Array.from({length:24},(_,h)=>auditLogs.filter(x=>auditHour(x)===h).length),max=Math.max(...hours,1);hb.innerHTML=hours.map((n,h)=>`<div class="traffic-hour"><span>${String(h).padStart(2,'0')}</span><div><i style="width:${Math.round(n/max*100)}%"></i></div><b>${n}</b></div>`).join('');}
    const tb=$('trafficTypes');
    if(tb){const types={};auditLogs.forEach(x=>types[x.action||'other']=(types[x.action||'other']||0)+1);const list=Object.entries(types).sort((a,b)=>b[1]-a[1]),max=Math.max(list[0]?.[1]||1,1);tb.innerHTML=list.slice(0,15).map(([a,n])=>`<div class="traffic-type"><span>${esc(auditLabel(a))}</span><div><i style="width:${Math.round(n/max*100)}%"></i></div><b>${n}</b></div>`).join('')||'<div class="empty">No traffic data.</div>';}
}

function adminAnalytics(){
    if(!$('workHistoryButton'))return;
    const open=id=>{['workHistorySection','trafficSection','pinSettingsSection'].forEach(x=>$(x)?.classList.add('hidden'));$(id)?.classList.remove('hidden');setTimeout(()=>$(id)?.scrollIntoView({behavior:'smooth',block:'start'}),20)};
    $('workHistoryButton').onclick=()=>{open('workHistorySection');renderWorkHistory()};
    $('trafficButton').onclick=()=>{open('trafficSection');renderTraffic()};
    $('refreshWorkButton')?.addEventListener('click',renderWorkHistory);$('refreshTrafficButton')?.addEventListener('click',renderTraffic);
    $('workSearchInput')?.addEventListener('input',renderWorkHistory);$('trafficManagementSelect')?.addEventListener('change',renderTraffic);
    document.querySelectorAll('[data-traffic-type]').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('[data-traffic-type]').forEach(x=>x.classList.remove('selected'));btn.classList.add('selected');window.__trafficType=btn.dataset.trafficType;renderTrafficManagement(window.__trafficType)}));
    $('customerGraphRange')?.addEventListener('change',renderCustomerDateGraph);
    $('pinSettingsCard')?.addEventListener('click',()=>open('pinSettingsSection'));$('pinSettingsBack')?.addEventListener('click',()=>$('pinSettingsSection')?.classList.add('hidden'));
    subscribeAuditLogs();
}

function show(id){
    ['searchSection','addSection','repairAddSection','repairSearchSection','customerDetailModal','themeModal','scannerModal','secondAddSection','secondListSection','accessoryAddSection','accessoryListSection','homeDateWorkSection','modulePage','customerPageSection'].forEach(x=>$(x)?.classList.add('hidden'));
    $(id)?.classList.remove('hidden');
    setTimeout(()=>$(id)?.scrollIntoView({behavior:'smooth',block:'start'}),20);
}
function closeSpecific(id,e){e?.preventDefault();e?.stopPropagation();$(id)?.classList.add('hidden');if(['modulePage','customerPageSection','searchSection','addSection','repairAddSection','repairSearchSection','secondAddSection','secondListSection','accessoryAddSection','accessoryListSection','homeDateWorkSection'].includes(id)){const any=['modulePage','customerPageSection','searchSection','addSection','repairAddSection','repairSearchSection','secondAddSection','secondListSection','accessoryAddSection','accessoryListSection','homeDateWorkSection'].some(x=>$(x)&&!$(x).classList.contains('hidden'));if(!any){$('homeModules')?.classList.remove('hidden');$('homeCustomerCardWrap')?.classList.remove('hidden')}}}

function openModulePage(type){
    const cfg={
      finance:{ey:'FINANCE',title:'Finance Management',buttons:[['👥','Total Customers','All customer records','customerSearch'],['📱','Total Devices','Device count','customerSearch'],['⌕','Search Customer','Find by name, phone, IMEI, code','customerSearch'],['＋','Add Customer','Create customer record','addCustomer']]},
      repairing:{ey:'REPAIRING',title:'Repairing Management',buttons:[['👥','Total Customers',`${$('repairTotalCustomers')?.textContent||0} repairing customers`,'repairSearch'],['📱','Total Devices',`${$('repairTotalDevices')?.textContent||0} repair devices`,'repairSearch'],['🛠','Add Repairing','New repairing record','addRepair'],['⌕','Search Repairing','Find repairing records','repairSearch']]},
      second:{ey:'SECOND HAND',title:'Second Hand Management',buttons:[['👥','Customer List','Second-hand customer records','secondList'],['📦','Total Stock',`${$('secondStockCount')?.textContent||0} phones in stock`,'secondList'],['⌕','Search','Name, phone, IMEI, model','secondList'],['＋','Add Phone','Add second-hand phone','secondAdd']]},
      accessories:{ey:'ACCESSORIES',title:'Accessories Management',buttons:[['📋','Item List','All accessories records','accessoryList'],['📦','Total Stock',`${$('accessoryStockCount')?.textContent||0} units in stock`,'accessoryList'],['⌕','Search','Name, category, SN','accessoryList'],['＋','Add Accessory','Add new stock','accessoryAdd']]}
    }[type];
    if(!cfg)return;
    $('modulePageEyebrow').textContent=cfg.ey;$('modulePageTitle').textContent=cfg.title;
    $('modulePageContent').innerHTML=cfg.buttons.map((b,i)=>`<button class="glass action module-page-action" type="button" data-module-action="${b[3]}"><span class="icon">${b[0]}</span><strong>${b[1]}</strong><small>${b[2]}</small></button>`).join('');
    $('homeModules')?.classList.add('hidden');$('homeCustomerCardWrap')?.classList.add('hidden');show('modulePage');
    $('modulePageContent').querySelectorAll('[data-module-action]').forEach(btn=>btn.addEventListener('click',()=>{
        const a=btn.dataset.moduleAction;
        if(a==='customerSearch'){show('searchSection');renderSearch();$('searchInput')?.focus()}
        if(a==='addCustomer')show('addSection');
        if(a==='addRepair')show('repairAddSection');
        if(a==='repairSearch'){show('repairSearchSection');renderRepairing();$('repairSearchInput')?.focus()}
        if(a==='secondList'){show('secondListSection');renderSecondHand();}
        if(a==='secondAdd')show('secondAddSection');
        if(a==='accessoryList'){show('accessoryListSection');renderAccessories();}
        if(a==='accessoryAdd')show('accessoryAddSection');
    }));
}
function closeModulePage(){
    ['modulePage','customerPageSection'].forEach(x=>$(x)?.classList.add('hidden'));
    $('homeModules')?.classList.remove('hidden');$('homeCustomerCardWrap')?.classList.remove('hidden');
}

function renderAllCustomers(){
    const box=$('allCustomerResults');if(!box)return;
    const q=val('allCustomerSearchInput').toLowerCase();
    const rows=customers.filter(c=>!q||[c.customerCode,c.customerName,c.phone,c.imei,c.brand,c.model,c.city,c.state].join(' ').toLowerCase().includes(q));
    box.innerHTML=rows.length?rows.map(c=>`<article class="result customer-result" data-customer="${esc(c.id)}"><div class="result-top"><div><div class="result-name">${esc(c.customerName||'Unnamed')}</div><div class="result-meta">${esc(c.customerCode||'KM----')} • ${esc(c.phone||'')}</div></div></div><div class="result-grid">${item('Device',`${c.brand||''} ${c.model||''}`)}${item('IMEI',c.imei||'-')}${item('Finance',c.financeCompany||'-')}</div><div class="result-open-hint">Tap for complete history • PDF • Edit • Delete</div></article>`).join(''):'<div class="empty">No customer found.</div>';
    box.querySelectorAll('.customer-result').forEach(card=>card.onclick=e=>{if(e.target.closest('button'))return;const c=customers.find(x=>x.id===card.dataset.customer);if(c)showCustomerDetail(c)});
}

function renderSearch(){
    const box=$('searchResults');if(box){const q=val('searchInput').toLowerCase();const rows=customers.filter(c=>!q||[c.customerCode,c.customerName,c.phone,c.imei,c.pincode,c.city,c.state,c.brand,c.model,c.colour,c.storage,c.financeCompany,c.lockName,c.stock,c.counter,c.financerName,formatDateTime(c)].filter(Boolean).join(' ').toLowerCase().includes(q));box.innerHTML=rows.length?rows.map(c=>`<article class="result customer-result" data-customer="${esc(c.id)}"><div class="result-top"><div><div class="result-name">${esc(c.customerName||'Unnamed')}</div><div class="result-meta">${esc(c.customerCode||'KM----')} • ${esc(c.phone||'')} • ${esc(formatDateTime(c))}</div></div></div><div class="result-grid">${item('Device',`${c.brand||''} ${c.model||''}`)}${item('IMEI',c.imei||'-')}${item('Finance',c.financeCompany||'-')}${item('Amount',`₹${Number(c.phoneAmount||0).toLocaleString('en-IN')}`)}</div><div class="result-open-hint">Tap to view full details</div></article>`).join(''):'<div class="empty">No customer records found.</div>';box.querySelectorAll('.customer-result').forEach(card=>card.onclick=()=>{const c=customers.find(x=>x.id===card.dataset.customer);if(c)showCustomerDetail(c)});}
    renderAllCustomers();
}

function historyForCustomer(c){
    const key=String(c.phone||'').replace(/\D/g,'');
    const name=String(c.customerName||'').trim().toLowerCase();
    const match=x=>{const p=String(x.phone||'').replace(/\D/g,'');const n=String(x.customerName||'').trim().toLowerCase();return (key&&p&&key===p)||(name&&n&&name===n)};
    return {repairs:repairing.filter(match),second:secondHand.filter(match),accessories:accessories.filter(match)};
}
function showCustomerDetail(c){
    activeCustomerId=c.id;
    $('detailTitle').textContent=`${c.customerName||'Customer'} • ${c.customerCode||''}`;
    $('customerDetailBody').innerHTML=`<div class="detail-grid">${detailItem('Customer Code',c.customerCode)}${detailItem('Date & Time',formatDateTime(c))}${detailItem('Name',c.customerName)}${detailItem('Phone',c.phone)}${detailItem('Address',c.address)}${detailItem('PIN Code',c.pincode)}${detailItem('City / State',`${c.city||''}, ${c.state||''}`)}${detailItem('Brand',c.brand)}${detailItem('Model',c.model)}${detailItem('IMEI',c.imei)}${detailItem('Colour',c.colour)}${detailItem('RAM + Storage',c.storage)}${detailItem('Finance Company',c.financeCompany)}${detailItem('Phone Amount',`₹${c.phoneAmount||0}`)}${detailItem('Down Payment',`₹${c.downPayment||0}`)}${detailItem('EMI',`₹${c.emiAmount||0} × ${c.emiMonths||0} months`)}${detailItem('Bill',c.billYes?'YES':'NO')}</div>`;
    const h=historyForCustomer(c),box=$('customerHistory');
    if(box){const parts=[];if(h.repairs.length)parts.push(`<div class="history-group"><b>🛠 Repairing</b>${h.repairs.map(r=>`<div><span>${esc(r.device||'Repair')}</span><small>${esc(r.problem||'')} • Total ₹${Number(r.total??r.payment??0).toLocaleString('en-IN')} • Profit ₹${Number(r.profit??(Number(r.total||r.payment||0)-Number(r.partsPrice||0))).toLocaleString('en-IN')}</small></div>`).join('')}</div>`);if(h.second.length)parts.push(`<div class="history-group"><b>📱 Second Hand</b>${h.second.map(r=>`<div><span>${esc(r.brand||'')} ${esc(r.model||r.device||'')}</span><small>IMEI ${esc(r.imei||'-')} • Purchase ₹${Number(r.price||0).toLocaleString('en-IN')} • Sell ₹${Number(r.salePrice||0).toLocaleString('en-IN')}</small></div>`).join('')}</div>`);if(h.accessories.length)parts.push(`<div class="history-group"><b>🎧 Accessories</b>${h.accessories.map(r=>`<div><span>${esc(r.name||'Accessory')}</span><small>SN ${esc(r.sn||'-')} • Qty ${r.quantity||0}</small></div>`).join('')}</div>`);box.innerHTML=parts.length?`<div class="history-title">Complete History</div>${parts.join('')}`:'<div class="history-title">Complete History</div><div class="empty">इस customer के लिए अभी repairing / second-hand / accessory history नहीं मिली.</div>';}
    $('customerDetailModal')?.classList.remove('hidden');
}

async function downloadCustomerPdf(){
    const c=customers.find(x=>x.id===activeCustomerId);if(!c)return;
    try{
        if(!window.jspdf)await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
        const pdf=new window.jspdf.jsPDF({orientation:'portrait',unit:'mm',format:'a4'}),w=pdf.internal.pageSize.getWidth();
        pdf.setFillColor(8,10,16);pdf.rect(0,0,w,38,'F');pdf.setTextColor(255,255,255);pdf.setFontSize(21);pdf.setFont(undefined,'bold');pdf.text('KABIR MOBILE',16,19);pdf.setFontSize(9);pdf.setFont(undefined,'normal');pdf.text('Customer Complete Profile',16,27);
        let y=48;const rows=[['Customer Code',c.customerCode],['Name',c.customerName],['Phone',c.phone],['Address',c.address],['PIN',c.pincode],['City / State',`${c.city||''}, ${c.state||''}`],['Brand',c.brand],['Model',c.model],['IMEI',c.imei],['Finance',c.financeCompany],['Phone Amount',`₹${Number(c.phoneAmount||0).toLocaleString('en-IN')}`],['Down Payment',`₹${Number(c.downPayment||0).toLocaleString('en-IN')}`],['EMI',`₹${Number(c.emiAmount||0).toLocaleString('en-IN')} × ${c.emiMonths||0}`]];
        rows.forEach(([k,v])=>{pdf.setFillColor(246,247,250);pdf.roundedRect(14,y,w-28,11,2,2,'F');pdf.setTextColor(100,105,115);pdf.setFontSize(7);pdf.text(String(k),19,y+4.5);pdf.setTextColor(25,27,33);pdf.setFontSize(8);pdf.text(pdfSafe(v),19,y+8.5,{maxWidth:w-38});y+=14});
        const h=historyForCustomer(c);y+=5;pdf.setFontSize(13);pdf.setFont(undefined,'bold');pdf.text('History',14,y);y+=8;pdf.setFont(undefined,'normal');pdf.setFontSize(8);
        [...h.repairs.map(r=>`Repairing • ${r.device||''} • ${r.problem||''} • Total ₹${Number(r.total??r.payment??0)} • Parts ₹${Number(r.partsPrice||0)}`),...h.second.map(r=>`Second Hand • ${r.brand||''} ${r.model||r.device||''} • Purchase ₹${Number(r.price||0)} • Sell ₹${Number(r.salePrice||0)}`),...h.accessories.map(r=>`Accessory • ${r.name||''} • SN ${r.sn||'-'} • Qty ${r.quantity||0}`)].forEach(line=>{if(y>275){pdf.addPage();y=20}pdf.text(pdfSafe(line),14,y,{maxWidth:w-28});y+=6});
        await audit('customer_pdf',{section:'Kabir Mobile Data',customerId:c.id,customerCode:c.customerCode,customerName:c.customerName,description:`Customer PDF downloaded for ${c.customerName||c.customerCode}`});
        pdf.save(`Kabir_${c.customerCode||'Customer'}.pdf`);showSuccessToast('PDF Ready','Customer PDF downloaded successfully');
    }catch(e){console.error(e);alert('Customer PDF नहीं बन पाया.')}
}

function editCustomer(){
    if(enforceWriteLock('formMessage'))return;const c=customers.find(x=>x.id===activeCustomerId);if(!c)return;closeCustomerDetail();show('addSection');
    const map={customerName:'customerName',address:'address',pincode:'pincode',city:'city',state:'state',phone:'phone',brand:'brand',model:'model',imei:'imei',colour:'colour',storage:'storage',financeCompany:'financeCompany',phoneAmount:'phoneAmount',downPayment:'downPayment',emiAmount:'emiAmount',emiMonths:'emiMonths',lockName:'lockName',stock:'stock',counter:'counter',financerName:'financerName'};
    Object.entries(map).forEach(([k,id])=>{if($(id))$(id).value=c[k]??''});$('customerCode').value=c.customerCode||'';$('saveCustomerButton').textContent='UPDATE CUSTOMER';$('customerForm').dataset.editId=c.id;$('brand').dispatchEvent(new Event('change'));setTimeout(()=>{$('model').value=c.model||'';$('model').dispatchEvent(new Event('change'));setTimeout(()=>{$('colour').value=c.colour||'';$('storage').value=c.storage||''},0)},100);
}

function nav(){
    const openCustomer=()=>{show('customerPageSection');renderAllCustomers();$('allCustomerSearchInput')?.focus()};
    $('customerModule')?.addEventListener('click',openCustomer);
    [['financeModule','finance'],['repairingModule','repairing'],['secondHandModule','second'],['accessoriesModule','accessories']].forEach(([id,type])=>$(id)?.addEventListener('click',()=>openModulePage(type)));
    $('modulePageBack')?.addEventListener('click',closeModulePage);$('customerPageClose')?.addEventListener('click',closeModulePage);
    $('allCustomerSearchInput')?.addEventListener('input',renderAllCustomers);
    $('searchCustomerCard')?.addEventListener('click',()=>{show('searchSection');renderSearch();$('searchInput')?.focus();audit('customer_search',{section:'Kabir Mobile Data',description:'Customer search opened'})});
    $('addCustomerCard')?.addEventListener('click',()=>show('addSection'));$('totalCustomersCard')?.addEventListener('click',()=>{show('searchSection');renderSearch()});$('totalDevicesCard')?.addEventListener('click',()=>{show('searchSection');renderSearch()});
    $('repairTotalCustomersCard')?.addEventListener('click',()=>{show('repairSearchSection');renderRepairing()});$('repairTotalDevicesCard')?.addEventListener('click',()=>{show('repairSearchSection');renderRepairing()});
    $('secondCustomerListCard')?.addEventListener('click',()=>{show('secondListSection');renderSecondHand()});$('secondStockCard')?.addEventListener('click',()=>{show('secondListSection');renderSecondHand()});$('secondSearchCard')?.addEventListener('click',()=>{show('secondListSection');renderSecondHand();$('secondSearchInput')?.focus()});$('secondAddCard')?.addEventListener('click',()=>show('secondAddSection'));
    $('accessoryListCard')?.addEventListener('click',()=>{show('accessoryListSection');renderAccessories()});$('accessoryStockCard')?.addEventListener('click',()=>{show('accessoryListSection');renderAccessories()});$('accessorySearchCard')?.addEventListener('click',()=>{show('accessoryListSection');renderAccessories();$('accessorySearchInput')?.focus()});$('accessoryAddCard')?.addEventListener('click',()=>show('accessoryAddSection'));
    $('secondSearchInput')?.addEventListener('input',renderSecondHand);$('accessorySearchInput')?.addEventListener('input',renderAccessories);
    $('secondHandForm')?.addEventListener('submit',saveSecondHand);$('accessoryForm')?.addEventListener('submit',saveAccessory);
    document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',e=>closeSpecific(b.dataset.close,e)));
    document.querySelectorAll('[data-module-close]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();$(b.dataset.moduleClose)?.classList.add('hidden')}));
}

async function loadZXing(){
    if(window.ZXingBrowser)return window.ZXingBrowser;
    await loadScript('https://unpkg.com/@zxing/browser@0.1.5/umd/zxing-browser.min.js');
    return window.ZXingBrowser;
}
async function startScan(targetId='imei',title='Scan Code'){
    const modal=$('scannerModal'),video=$('scannerVideo'),m=$('scannerMessage');if(!modal||!video)return;window.__scanTarget=targetId;$('scannerTitle')&&($('scannerTitle').textContent=title);modal.classList.remove('hidden');m.textContent='Camera शुरू हो रही है…';
    try{
        scanStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});video.srcObject=scanStream;await video.play();
        if('BarcodeDetector' in window){const fmts=(await BarcodeDetector.getSupportedFormats()).filter(x=>['qr_code','code_128','code_39','ean_13','ean_8','upc_a','upc_e','data_matrix','pdf417'].includes(x));if(fmts.length){const detector=new BarcodeDetector({formats:fmts});const loop=async()=>{if(!scanStream)return;try{const a=await detector.detect(video);if(a?.length){const raw=a[0].rawValue||'';if(raw){$(window.__scanTarget).value=raw;$(window.__scanTarget).dispatchEvent(new Event('input',{bubbles:true}));m.textContent='Scanned ✓';setTimeout(stopScan,250);return}}}catch(_){}scanTimer=setTimeout(loop,220)};loop();return;}}
        m.textContent='Enhanced scanner loading…';const Z=await loadZXing();const reader=new Z.BrowserMultiFormatReader();reader.decodeFromVideoDevice(undefined,video,(result)=>{if(result?.getText){$(window.__scanTarget).value=result.getText();$(window.__scanTarget).dispatchEvent(new Event('input',{bubbles:true}));m.textContent='Scanned ✓';reader.reset();setTimeout(stopScan,250)}});
        window.__zxingReader=reader;
    }catch(e){console.error(e);m.textContent='Camera access नहीं मिला. iPhone Settings में Camera permission check करें.';}
}
function stopScan(){if(scanTimer)clearTimeout(scanTimer);scanTimer=null;try{window.__zxingReader?.reset()}catch(_){}window.__zxingReader=null;if(scanStream)scanStream.getTracks().forEach(t=>t.stop());scanStream=null;if($('scannerVideo'))$('scannerVideo').srcObject=null;$('scannerModal')?.classList.add('hidden')}
function scanner(){$('scanImeiButton')?.addEventListener('click',()=>startScan('imei','Scan IMEI'));$('scanSecondImeiButton')?.addEventListener('click',()=>startScan('secondImei','Scan IMEI'));$('scanAccessorySnButton')?.addEventListener('click',()=>startScan('accessorySn','Scan SN / Serial Number'));$('closeScannerButton')?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();stopScan()})}

function setupSecondHandFields(){
    const brand=$('secondBrand'),model=$('secondModel');if(!brand||!model)return;
    const fillBrands=()=>{const list=$('secondBrandOptions');if(!list)return;const names=[...new Set([...Object.keys(BRANDS),...Object.keys(remoteModelsByBrand)])].sort();list.innerHTML=names.map(x=>`<option value="${esc(x)}"></option>`).join('')};
    const fillModels=()=>{const q=brand.value.trim().toLowerCase(),list=$('secondModelOptions');if(!list)return;const key=Object.keys(remoteModelsByBrand).find(k=>k.toLowerCase()===q);const models=q?(key?remoteModelsByBrand[key]:modelListForBrand(brand.value)):[];list.innerHTML=[...new Set(models)].map(x=>`<option value="${esc(x)}"></option>`).join('')};
    fillBrands();loadAllPhoneModels().then(()=>{fillBrands();fillModels()});brand.addEventListener('input',fillModels);model.addEventListener('input',()=>{});
}
function profitWatch(inputA,inputB,out){const f=()=>{const a=Number(val(inputA)||0),b=Number(val(inputB)||0);$(out)&&($(out).textContent=`₹${(b-a).toLocaleString('en-IN')}`)};$(inputA)?.addEventListener('input',f);$(inputB)?.addEventListener('input',f);f}
function saveSecondHand(e){e.preventDefault();if(enforceWriteLock('secondMessage'))return;const data={customerName:val('secondCustomerName'),phone:val('secondPhone').replace(/\D/g,''),brand:val('secondBrand'),model:val('secondModel'),device:`${val('secondBrand')} ${val('secondModel')}`.trim(),imei:val('secondImei'),condition:val('secondCondition'),price:Number(val('secondPrice')||0),salePrice:Number(val('secondSalePrice')||0),profit:Number(val('secondSalePrice')||0)-Number(val('secondPrice')||0),createdAt:serverTimestamp(),createdBy:user?.uid||null};if(!data.customerName||!/^[0-9]{10}$/.test(data.phone)||!data.brand||!data.model||!data.condition)return msg('secondMessage','सभी जरूरी fields भरें.');if(data.imei&&!/^\d{15}$/.test(data.imei))return msg('secondMessage','IMEI 15 digit होना चाहिए.');addDoc(collection(db,SECOND_COL),data).then(ref=>audit('second_hand_add',{section:'Second Hand',customerId:ref.id,customerName:data.customerName,description:`Second-hand phone added: ${data.device}`,extra:{phone:data.phone,imei:data.imei,profit:data.profit}})).then(()=>{e.target.reset();$('secondProfit').textContent='₹0';msg('secondMessage','',true);showSuccessToast('Successfully Saved','Second-hand phone saved successfully')}).catch(err=>{console.error(err);msg('secondMessage',err?.message||'Save failed.')})}
function saveAccessory(e){e.preventDefault();if(enforceWriteLock('accessoryMessage'))return;const data={name:val('accessoryName'),category:val('accessoryCategory'),sn:val('accessorySn'),quantity:Number(val('accessoryQty')||0),price:Number(val('accessoryPrice')||0),salePrice:Number(val('accessorySalePrice')||0),profit:Number(val('accessorySalePrice')||0)-Number(val('accessoryPrice')||0),createdAt:serverTimestamp(),createdBy:user?.uid||null};if(!data.name||!data.category||data.quantity<1)return msg('accessoryMessage','Name, category और quantity भरें.');addDoc(collection(db,ACCESSORY_COL),data).then(ref=>audit('accessory_add',{section:'Accessories',customerId:ref.id,description:`Accessory added: ${data.name}`,extra:{sn:data.sn,profit:data.profit}})).then(()=>{e.target.reset();$('accessoryProfit').textContent='₹0';msg('accessoryMessage','',true);showSuccessToast('Successfully Saved','Accessory saved successfully')}).catch(err=>{console.error(err);msg('accessoryMessage',err?.message||'Save failed.')})}
function renderSecondHand(){const box=$('secondResults');if(!box)return;const q=val('secondSearchInput').toLowerCase();const rows=secondHand.filter(x=>!q||[x.customerName,x.phone,x.device,x.brand,x.model,x.imei,x.condition].join(' ').toLowerCase().includes(q));box.innerHTML=rows.length?rows.map(x=>`<article class="result"><div class="result-name">${esc(x.device||`${x.brand||''} ${x.model||''}`)}</div><div class="result-meta">${esc(x.customerName||'')} • ${esc(x.phone||'')}</div><div class="result-grid">${item('IMEI',x.imei||'')}${item('Condition',x.condition||'')}${item('Purchase Price',`₹${Number(x.price||0).toLocaleString('en-IN')}`)}${item('Sell Price',`₹${Number(x.salePrice||0).toLocaleString('en-IN')}`)}${item('Profit',`₹${Number(x.profit??(Number(x.salePrice||0)-Number(x.price||0))).toLocaleString('en-IN')}`)}</div></article>`).join(''):'<div class="empty">No second-hand records found.</div>'}
function renderAccessories(){const box=$('accessoryResults');if(!box)return;const q=val('accessorySearchInput').toLowerCase();const rows=accessories.filter(x=>!q||[x.name,x.category,x.sn].join(' ').toLowerCase().includes(q));box.innerHTML=rows.length?rows.map(x=>`<article class="result"><div class="result-name">${esc(x.name||'Accessory')}</div><div class="result-meta">${esc(x.category||'')} • SN ${esc(x.sn||'-')}</div><div class="result-grid">${item('Quantity',x.quantity||0)}${item('Purchase Price',`₹${Number(x.price||0).toLocaleString('en-IN')}`)}${item('Sale Price',`₹${Number(x.salePrice||0).toLocaleString('en-IN')}`)}${item('Profit',`₹${Number(x.profit??(Number(x.salePrice||0)-Number(x.price||0))).toLocaleString('en-IN')}`)}</div></article>`).join(''):'<div class="empty">No accessories found.</div>'}
function saveRepair(e){e.preventDefault();if(enforceWriteLock('repairMessage'))return;const ids=['repairCustomerName','repairPhone','repairDevice','repairProblem','repairBy','repairTotal','repairPartsPrice'];for(const id of ids)if(!val(id)){ $(id)?.focus();return msg('repairMessage','सभी fields भरना जरूरी है.')}const phone=val('repairPhone').replace(/\D/g,'');if(!/^\d{10}$/.test(phone))return msg('repairMessage','10 digit customer phone number डालें.');const total=Number(val('repairTotal')||0),parts=Number(val('repairPartsPrice')||0),profit=total-parts;const saveBtn=$('repairForm')?.querySelector('button[type="submit"]');if(saveBtn)saveBtn.disabled=true;addDoc(collection(db,REPAIR_COL),{customerName:val('repairCustomerName'),phone,device:val('repairDevice'),problem:val('repairProblem'),repairBy:val('repairBy'),total,partsPrice:parts,profit,payment:total,createdAt:serverTimestamp(),createdBy:user?.uid||null}).then(ref=>audit('repairing_add',{section:'Kabir Repairing Data',customerId:ref.id,customerName:val('repairCustomerName'),description:`Repairing added: ${val('repairProblem')}`,extra:{phone,device:val('repairDevice'),total,partsPrice:parts,profit}})).then(()=>{$('repairForm').reset();$('repairProfit').textContent='₹0';msg('repairMessage','',true);showSuccessToast('Successfully Saved','Repairing data saved successfully')}).catch(err=>{console.error(err);msg('repairMessage',err?.message||'Repairing save नहीं हुआ.')}).finally(()=>{if(saveBtn)saveBtn.disabled=false})}
function renderRepairing(){const box=$('repairResults');if(!box)return;const s=val('repairSearchInput').toLowerCase();const arr=repairing.filter(r=>!s||[r.customerName,r.phone,r.device,r.problem,r.repairBy,r.total,r.partsPrice,r.payment,formatDateTime(r)].join(' ').toLowerCase().includes(s));if(!arr.length){box.innerHTML=`<div class="empty">${s?'No repairing record found.':'No repairing records yet.'}</div>`;return}box.innerHTML=arr.map(r=>`<article class="result"><div class="result-name">${esc(r.customerName||'')}</div><div class="result-meta">${esc(r.phone||'')} • ${esc(formatDateTime(r))}</div><div class="result-grid">${item('Brand / Model',r.device)}${item('Problem',r.problem)}${item('Repairing By',r.repairBy)}${item('Total',`₹${Number(r.total??r.payment??0).toLocaleString('en-IN')}`)}${item('Parts Price',`₹${Number(r.partsPrice||0).toLocaleString('en-IN')}`)}${item('Profit',`₹${Number(r.profit??(Number(r.total??r.payment??0)-Number(r.partsPrice||0))).toLocaleString('en-IN')}`)}</div></article>`).join('')}
function applyTheme(theme){const allowed=['dark','light','midnight','silver','glass','aurora','rose','ocean'];if(!allowed.includes(theme))theme='dark';document.documentElement.setAttribute('data-theme',theme);localStorage.setItem('kabir_theme',theme);document.querySelectorAll('#themeChoices button[data-theme]').forEach(b=>b.classList.toggle('selected',b.dataset.theme===theme))}
function themeSystem(){applyTheme(localStorage.getItem('kabir_theme')||'dark');$('themeButton')?.addEventListener('click',()=>$('themeModal')?.classList.remove('hidden'));$('closeThemeButton')?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();$('themeModal')?.classList.add('hidden')});$('themeChoices')?.addEventListener('click',e=>{const b=e.target.closest('button[data-theme]');if(!b)return;applyTheme(b.dataset.theme);setTimeout(()=>$('themeModal')?.classList.add('hidden'),180)})}
function featureNav(){$('addRepairingCard')?.addEventListener('click',()=>show('repairAddSection'));$('searchRepairingCard')?.addEventListener('click',()=>{show('repairSearchSection');renderRepairing();$('repairSearchInput')?.focus();audit('repairing_search',{section:'Kabir Repairing Data',description:'Repairing search opened'})});$('repairSearchInput')?.addEventListener('input',renderRepairing);$('repairForm')?.addEventListener('submit',saveRepair);$('deleteCustomerButton')?.addEventListener('click',deleteCustomer);$('editCustomerButton')?.addEventListener('click',editCustomer);$('downloadCustomerPdfButton')?.addEventListener('click',downloadCustomerPdf);$('closeDetailButton')?.addEventListener('click',e=>closeSpecific('customerDetailModal',e))}

function subscribeInventory(){onSnapshot(collection(db,SECOND_COL),snap=>{secondHand=snap.docs.map(d=>({id:d.id,...d.data()}));$('secondStockCount')&&($('secondStockCount').textContent=String(secondHand.length));renderSecondHand();},e=>console.warn('Second hand load:',e));onSnapshot(collection(db,ACCESSORY_COL),snap=>{accessories=snap.docs.map(d=>({id:d.id,...d.data()}));$('accessoryStockCount')&&($('accessoryStockCount').textContent=String(accessories.reduce((n,x)=>n+Number(x.quantity||0),0)));renderAccessories();},e=>console.warn('Accessories load:',e))}


/* =========================================================
   KABIR AI ASSISTANT — LOCAL DATA INTELLIGENCE
========================================================= */
function aiLocale(q){
    const t=String(q||'');
    const hi=/[\u0900-\u097F]/.test(t);
    const hinglish=/\b(kya|kitna|kitne|kitni|batao|dikhao|aaj|kal|customer|repairing|stock|profit|sale|sell|purchase|data|hai|hain|ka|ki|ke|mein|me|total)\b/i.test(t);
    return hi?'hi':hinglish?'hinglish':'en';
}
function aiMoney(n){return `₹${Number(n||0).toLocaleString('en-IN')}`}
function aiCustomerMatches(q){
    const s=String(q||'').toLowerCase();
    return customers.filter(c=>[c.customerName,c.phone,c.customerCode,c.imei,c.brand,c.model].filter(Boolean).join(' ').toLowerCase().includes(s));
}
function aiAnswer(question){
    const q=String(question||'').trim();
    if(!q)return '';
    const l=q.toLowerCase(), lang=aiLocale(q);
    const today=new Date().toLocaleDateString('en-CA');
    const todayCustomers=customers.filter(x=>recordDay(x)===today).length;
    const todayRepair=repairing.filter(x=>recordDay(x)===today).length;
    const secondProfit=secondHand.reduce((n,x)=>n+Number(x.profit??(Number(x.salePrice||0)-Number(x.price||0))),0);
    const accessoryProfit=accessories.reduce((n,x)=>n+Number(x.profit??(Number(x.salePrice||0)-Number(x.price||0))),0);
    const repairProfit=repairing.reduce((n,x)=>n+Number(x.profit??(Number(x.total??x.payment||0)-Number(x.partsPrice||0))),0);
    const totalProfit=secondProfit+accessoryProfit+repairProfit;
    const customerQuery=l.replace(/(customer|ka|ki|ke|data|details|detail|history|dikhao|batao|show|find|search|about|hai|hain|who|what|of|for)/gi,' ').replace(/\s+/g,' ').trim();
    let matches=[];
    if(customerQuery.length>=3) matches=aiCustomerMatches(customerQuery);
    if(/(total|kitne|kitni|how many|count|customers?)/i.test(l) && /(customer|grahak)/i.test(l)){
        return lang==='en'?`Total customers: ${customers.length}. Total devices: ${customers.reduce((n,c)=>n+Number(c.deviceCount||1),0)}.`:lang==='hinglish'?`Total ${customers.length} customers hain aur ${customers.reduce((n,c)=>n+Number(c.deviceCount||1),0)} devices hain.`:`कुल ${customers.length} customers हैं और ${customers.reduce((n,c)=>n+Number(c.deviceCount||1),0)} devices हैं।`;
    }
    if(/repair/i.test(l) && /(total|kitne|kitni|count|how many|aaj|today)/i.test(l)) return lang==='en'?`Total repairing records: ${repairing.length}. Today: ${todayRepair}.`:`कुल repairing records ${repairing.length} हैं। आज ${todayRepair} repairing entries हुई हैं।`;
    if(/second|used|second.?hand/i.test(l) && /(stock|total|count|kitne|kitni|how many)/i.test(l)) return lang==='en'?`Second-hand stock: ${secondHand.length} phones.`:`Second-hand stock में ${secondHand.length} phones हैं।`;
    if(/accessor/i.test(l) && /(stock|total|count|kitne|kitni|how many)/i.test(l)) return lang==='en'?`Accessories: ${accessories.length} records, total quantity ${accessories.reduce((n,x)=>n+Number(x.quantity||0),0)}.`:`Accessories में ${accessories.length} records हैं और total quantity ${accessories.reduce((n,x)=>n+Number(x.quantity||0),0)} है।`;
    if(/profit|munafa|faayda|कमाई|लाभ/i.test(l)) return lang==='en'?`Current calculated profit: ${aiMoney(totalProfit)}. Repairing ${aiMoney(repairProfit)}, Second Hand ${aiMoney(secondProfit)}, Accessories ${aiMoney(accessoryProfit)}.`:`अभी calculated profit ${aiMoney(totalProfit)} है। Repairing ${aiMoney(repairProfit)}, Second Hand ${aiMoney(secondProfit)}, Accessories ${aiMoney(accessoryProfit)}।`;
    if(/aaj|today|आज/i.test(l) && /(work|kaam|काम|data|activity)/i.test(l)) return lang==='en'?`Today: ${todayCustomers} customer entries and ${todayRepair} repairing entries.`:`आज ${todayCustomers} customer entries और ${todayRepair} repairing entries हुई हैं।`;
    if(matches.length){
        const c=matches[0];
        return lang==='en'?`${c.customerName||'Customer'} (${c.customerCode||'-'}): ${c.phone||'-'}, ${c.brand||''} ${c.model||''}, IMEI ${c.imei||'-'}.`:`${c.customerName||'Customer'} (${c.customerCode||'-'}) का phone ${c.phone||'-'} है। Device: ${c.brand||''} ${c.model||''}, IMEI ${c.imei||'-'}।`;
    }
    if(/(brand|सबसे ज्यादा|most)/i.test(l)){
        const map={};customers.forEach(c=>{if(c.brand)map[c.brand]=(map[c.brand]||0)+1});const top=Object.entries(map).sort((a,b)=>b[1]-a[1])[0];
        return top?(lang==='en'?`Most common brand in customer records is ${top[0]} with ${top[1]} records.`:`सबसे ज्यादा customer records वाला brand ${top[0]} है, ${top[1]} records के साथ।`):'अभी brand data उपलब्ध नहीं है।';
    }
    return lang==='en'?`I can answer from your live Kabir Data: customers, devices, repairing, second-hand, accessories, profit, today's work, and customer details. Try asking a specific question.`:lang==='hinglish'?`Main live Kabir Data se customers, devices, repairing, second-hand, accessories, profit, aaj ka work aur customer details bata sakta hoon. Thoda specific question pucho.`:`मैं आपके live Kabir Data से customers, devices, repairing, second-hand, accessories, profit, आज का काम और customer details बता सकता हूँ। कोई specific सवाल पूछें।`;
}
function aiAddMessage(text,role='assistant'){
    const box=$('aiMessages');if(!box)return;const div=document.createElement('div');div.className=`ai-message ${role}`;div.textContent=text;box.appendChild(div);box.scrollTop=box.scrollHeight;}
function aiAsk(){const input=$('aiInput');const q=input?.value.trim();if(!q)return;aiAddMessage(q,'user');input.value='';const typing=document.createElement('div');typing.className='ai-message assistant ai-typing';typing.textContent='…';$('aiMessages')?.appendChild(typing);setTimeout(()=>{typing.remove();aiAddMessage(aiAnswer(q),'assistant')},260);}
function aiVoice(){
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){$('aiVoiceStatus').textContent='इस browser में voice input उपलब्ध नहीं है। Typing से पूछें।';return;}
    const r=new SR();r.lang=/[\u0900-\u097F]/.test(navigator.language||'')?'hi-IN':'en-IN';r.interimResults=false;r.maxAlternatives=1;
    $('aiVoiceStatus').textContent='🎙️ सुन रहा हूँ…';
    r.onresult=e=>{$('aiInput').value=e.results[0][0].transcript;$('aiVoiceStatus').textContent='';aiAsk()};
    r.onerror=()=>{$('aiVoiceStatus').textContent='Voice input नहीं मिला। फिर कोशिश करें।'};
    r.onend=()=>{if($('aiVoiceStatus').textContent.includes('सुन रहा'))$('aiVoiceStatus').textContent=''};
    try{r.start()}catch(_){$('aiVoiceStatus').textContent='Voice input अभी busy है।'}
}
function setupKabirAI(){
    $('aiHomeButton')?.addEventListener('click',()=>{$('aiModal')?.classList.remove('hidden');setTimeout(()=>$('aiInput')?.focus(),120)});
    $('closeAiButton')?.addEventListener('click',()=>{$('aiModal')?.classList.add('hidden')});
    $('aiSendButton')?.addEventListener('click',aiAsk);$('aiVoiceButton')?.addEventListener('click',aiVoice);
    $('aiInput')?.addEventListener('keydown',e=>{if(e.key==='Enter')aiAsk()});
    $('aiSuggestions')?.addEventListener('click',e=>{const b=e.target.closest('[data-ai-q]');if(b){$('aiInput').value=b.dataset.aiQ;aiAsk()}});
    document.querySelectorAll('[data-ai-q]').forEach(b=>b.addEventListener('click',()=>{$('aiInput').value=b.dataset.aiQ;aiAsk()}));
}

/* =========================================================
   INITIALIZE
========================================================= */

async function init(){
    setupPin();
    authInit();
    loadSharedPin().catch(e=>console.warn(e));

    nav();

    brands();

    setupFinanceCompany();

    pincode();

    amounts();

    billDate();

    search();

    scanner();

    changePin();

    /*
     * IMPORTANT:
     * New home/repairing/export buttons must be initialized here.
     * Earlier these listeners were defined in featureNav(), but
     * featureNav() was never called, so the buttons did nothing.
     */
    themeSystem();
    setupKabirAI();
    featureNav();
    setupSecondHandFields();
    profitWatch("secondPrice","secondSalePrice","secondProfit");
    profitWatch("accessoryPrice","accessorySalePrice","accessoryProfit");
    profitWatch("repairPartsPrice","repairTotal","repairProfit");
    setupHomePdf();
    setupHomeModuleReorder();
    setupHomeDateFilter();
    adminAnalytics();
    if($('appScreen')?.classList.contains('admin')) audit('page_open',{section:'Admin Panel',description:'Admin Panel opened'}); else authReady.then(()=>audit('page_open',{section:'Kabir Mobile Data',description:'Website opened'}));

    authReady.then(()=>{
        subscribe();
        subscribeRepairing();
    subscribeInventory();
    });

    $("customerForm")
        ?.addEventListener(
            "submit",
            save
        );
}


document.addEventListener("DOMContentLoaded",()=>{init()});