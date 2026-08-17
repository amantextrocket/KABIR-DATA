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
            details:{...(details.extra||{}),brand:details.brand||val("brand")||null,model:details.model||val("model")||null,device:details.device||val("repairDevice")||null},
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
            renderSearch(); renderTrafficManagementCounts?.();
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
    /* Enhanced inventory submit handlers are attached by enhancedFeaturesInit(). */

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


function scanner(){ /* Enhanced universal scanner is initialized later. */ }


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
    onSnapshot(collection(db,SECOND_COL),snap=>{ secondHand=snap.docs.map(d=>({id:d.id,...d.data()})); if($('secondStockCount'))$('secondStockCount').textContent=String(secondHand.length); renderSecondHand(); renderTrafficManagementCounts?.(); },e=>console.warn('Second hand load:',e));
    onSnapshot(collection(db,ACCESSORY_COL),snap=>{ accessories=snap.docs.map(d=>({id:d.id,...d.data()})); if($('accessoryStockCount'))$('accessoryStockCount').textContent=String(accessories.reduce((n,x)=>n+Number(x.quantity||0),0)); renderAccessories(); renderTrafficManagementCounts?.(); },e=>console.warn('Accessories load:',e));
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
function exportCustomers(){
    if(!customers.length){alert("Customer data अभी उपलब्ध नहीं है.");return}
    audit("customer_export",{section:"Kabir Mobile Data",description:`Customer Excel downloaded (${customers.length} records)`});
    exportXlsx(customers.map(c=>({"Customer Code":c.customerCode||"","Date & Time":formatDateTime(c),"Customer Name":c.customerName||"",
      "Phone":c.phone||"","Address":c.address||"","PIN Code":c.pincode||"","City":c.city||"","State":c.state||"",
      "Brand":c.brand||"","Model":c.model||"","IMEI":c.imei||"","Colour":c.colour||"","RAM + Storage":c.storage||"",
      "Finance Company":c.financeCompany||"","Phone Amount":c.phoneAmount||0,"Down Payment":c.downPayment||0,
      "EMI Amount":c.emiAmount||0,"EMI Months":c.emiMonths||0,"Lock":c.lockName||"","Stock":c.stock||"",
      "Counter":c.counter||"","Financer":c.financerName||"","Bill":c.billYes?"YES":"NO"})),"Kabir_Mobile_Customers.xlsx","Customers");
}
function exportRepairing(){
    if(!repairing.length){alert("Repairing data अभी उपलब्ध नहीं है.");return}
    audit("repairing_export",{section:"Kabir Repairing Data",description:`Repairing Excel downloaded (${repairing.length} records)`});
    exportXlsx(repairing.map(r=>({"Date & Time":formatDateTime(r),"Customer Name":r.customerName||"","Phone":r.phone||"",
      "Brand / Model":r.device||"","Problem":r.problem||"","Repairing By":r.repairBy||"","Payment":r.payment||0})),
      "Kabir_Repairing_Data.xlsx","Repairing");
}
async function downloadCustomerPdf(){
    const c=customers.find(x=>x.id===activeCustomerId);if(!c)return;
    try{
        await audit("customer_pdf",{section:"Kabir Mobile Data",customerId:c.id,customerCode:c.customerCode,customerName:c.customerName,description:`PDF downloaded for ${c.customerName||c.customerCode||c.id}`});
        if(!window.jspdf)await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
        const pdf=new window.jspdf.jsPDF();let y=18;
        pdf.setFontSize(18);pdf.text("KABIR MOBILE DATA",14,y);y+=10;pdf.setFontSize(10);
        [["Customer Code",c.customerCode],["Date & Time",formatDateTime(c)],["Customer Name",c.customerName],["Phone",c.phone],
        ["Address",c.address],["PIN Code",c.pincode],["City / State",`${c.city||""}, ${c.state||""}`],["Brand",c.brand],["Model",c.model],
        ["IMEI",c.imei],["Colour",c.colour],["RAM + Storage",c.storage],["Finance Company",c.financeCompany],
        ["Phone Amount",`₹${c.phoneAmount||0}`],["Down Payment",`₹${c.downPayment||0}`],["EMI",`₹${c.emiAmount||0} × ${c.emiMonths||0} months`],
        ["Lock",c.lockName],["Stock",c.stock],["Counter",c.counter],["Financer",c.financerName],["Bill",c.billYes?"YES":"NO"]].forEach(([a,b])=>{
            if(y>280){pdf.addPage();y=18}pdf.setFont(undefined,"bold");pdf.text(String(a||""),14,y);
            pdf.setFont(undefined,"normal");pdf.text(String(b||"-"),65,y,{maxWidth:130});y+=8;
        });
        pdf.save(`${c.customerCode||"customer"}_${(c.customerName||"customer").replace(/\s+/g,"_")}.pdf`);
    }catch(e){console.error(e);alert("PDF बन नहीं पाया.")}
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
    $("exportCustomersButton")?.addEventListener("click",exportCustomers);
    $("exportRepairingButton")?.addEventListener("click",exportRepairing);
    $("downloadCustomerPdf")?.addEventListener("click",downloadCustomerPdf);
    $("deleteCustomerButton")?.addEventListener("click",deleteCustomer);
    $("editCustomerButton")?.addEventListener("click",editCustomer);
    $("closeDetailButton")?.addEventListener("click",closeCustomerDetail);
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
    featureNav();
    setupHomeDateFilter();
    adminAnalytics();
    if($('appScreen')?.classList.contains('admin')) audit('page_open',{section:'Admin Panel',description:'Admin Panel opened'});

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


document.addEventListener("DOMContentLoaded",()=>{init();setTimeout(enhancedFeaturesInit,50)});

/* =========================================================
   ENHANCED SYNCED FEATURES — 17 AUG 2026
   Additive layer: keeps existing Firebase collections intact.
========================================================= */
const __originalShow = show;
function hideAllMainPages(){
    document.querySelectorAll('.page-section').forEach(el=>{el.classList.add('hidden');el.classList.remove('page-active');});
    document.querySelectorAll('.home-modules .module-box').forEach(el=>el.classList.remove('page-open'));
    document.querySelector('.home-modules')?.classList.remove('management-mode');
}
function openMainPage(id){
    hideAllMainPages();
    const el=$(id); if(!el)return;
    el.classList.remove('hidden'); el.classList.add('page-active');
    setTimeout(()=>el.scrollIntoView({behavior:'smooth',block:'start'}),20);
}
function openManagementPage(boxId){
    const home=document.querySelector('.home-modules');
    if(!home)return;
    document.querySelectorAll('.page-section').forEach(el=>{el.classList.add('hidden');el.classList.remove('page-active');});
    document.querySelectorAll('.home-modules .module-box').forEach(el=>el.classList.remove('page-open'));
    home.classList.add('management-mode');
    const box=$(boxId); if(!box)return;
    box.classList.remove('hidden'); box.classList.add('page-open');
}
function closeMainPage(id){
    if(id){$(id)?.classList.add('hidden');$(id)?.classList.remove('page-active');}
    document.querySelectorAll('.home-modules .module-box').forEach(el=>{el.classList.add('hidden');el.classList.remove('page-open');});
    document.querySelector('.home-modules')?.classList.remove('management-mode');
    window.scrollTo({top:0,behavior:'smooth'});
}
function enhancedNavigation(){
    // Four management buttons open as true pages instead of inline boxes.
    [['financeModule','financeBox'],['repairingModule','repairingBox'],['secondHandModule','secondHandBox'],['accessoriesModule','accessoriesBox']].forEach(([btn,box])=>{
        $(btn)?.addEventListener('click',()=>openManagementPage(box));
    });
    document.querySelectorAll('[data-module-close]').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();closeMainPage(btn.dataset.moduleClose);}));
    $('customerModule')?.addEventListener('click',()=>{openMainPage('customerHubSection');renderCustomerHub();});
    $('customerHubClose')?.addEventListener('click',()=>closeMainPage('customerHubSection'));
    $('customerHubSearch')?.addEventListener('input',renderCustomerHub);
    document.querySelectorAll('[data-close]').forEach(btn=>btn.addEventListener('click',()=>closeMainPage(btn.dataset.close)));
    // Keep existing internal action cards but present them in the opened management page.
    $('secondAddCard')?.addEventListener('click',()=>openMainPage('secondAddSection'));
    $('secondCustomerListCard')?.addEventListener('click',()=>openMainPage('secondListSection'));
    $('secondStockCard')?.addEventListener('click',()=>openMainPage('secondListSection'));
    $('secondSearchCard')?.addEventListener('click',()=>openMainPage('secondListSection'));
    $('accessoryAddCard')?.addEventListener('click',()=>openMainPage('accessoryAddSection'));
    $('accessoryListCard')?.addEventListener('click',()=>openMainPage('accessoryListSection'));
    $('accessoryStockCard')?.addEventListener('click',()=>openMainPage('accessoryListSection'));
    $('accessorySearchCard')?.addEventListener('click',()=>openMainPage('accessoryListSection'));
}
function setupProfitCalculators(){
    const calc=(a,b,out)=>{
        const n=Number(val(a)||0),s=Number(val(b)||0),p=s-n;
        if($(out)){$(out).textContent=`₹${p.toLocaleString('en-IN')}`;$(out).style.color=p>=0?'var(--success)':'var(--danger)';}
    };
    $('secondPrice')?.addEventListener('input',()=>calc('secondPrice','secondSalePrice','secondProfit'));
    $('secondSalePrice')?.addEventListener('input',()=>calc('secondPrice','secondSalePrice','secondProfit'));
    $('accessoryPrice')?.addEventListener('input',()=>calc('accessoryPrice','accessorySalePrice','accessoryProfit'));
    $('accessorySalePrice')?.addEventListener('input',()=>calc('accessoryPrice','accessorySalePrice','accessoryProfit'));
}
function setupSecondHandSelectors(){
    const bs=$('secondBrandSelect'), bi=$('secondBrand'), ms=$('secondModelSelect'), mi=$('secondModel');
    if(!bs||!bi||!ms||!mi)return;
    const brands=[...new Set(Object.keys(BRANDS||{}))].sort((a,b)=>a.localeCompare(b));
    bs.innerHTML='<option value="">Select brand</option>'+brands.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
    const dl=$('secondBrandList'); if(dl)dl.innerHTML=brands.map(x=>`<option value="${esc(x)}"></option>`).join('');
    const fillModels=(brand)=>{
        const list=modelListForBrand(brand||'');
        ms.innerHTML='<option value="">Select model</option>'+list.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
        const mdl=$('secondModelList'); if(mdl)mdl.innerHTML=list.map(x=>`<option value="${esc(x)}"></option>`).join('');
    };
    bs.addEventListener('change',()=>{bi.value=bs.value;fillModels(bs.value);});
    bi.addEventListener('input',()=>{const found=brands.find(x=>x.toLowerCase()===bi.value.trim().toLowerCase());if(found)bs.value=found;fillModels(found||bi.value.trim());});
    ms.addEventListener('change',()=>{mi.value=ms.value;});
    mi.addEventListener('input',()=>{const list=modelListForBrand(bi.value.trim());const found=list.find(x=>x.toLowerCase()===mi.value.trim().toLowerCase());if(found)ms.value=found;});
}
function customerKey(x){return String(x.phone||'').replace(/\D/g,'')||String(x.customerName||'').trim().toLowerCase();}
function aggregateCustomers(){
    const map=new Map();
    const add=(x,type)=>{
        const key=customerKey(x);if(!key)return;
        if(!map.has(key))map.set(key,{key,name:x.customerName||'Customer',phone:x.phone||'',records:[]});
        const g=map.get(key);if(!g.name||g.name==='Customer')g.name=x.customerName||g.name;if(!g.phone)g.phone=x.phone||'';g.records.push({type,data:x});
    };
    customers.forEach(x=>add(x,'Finance'));repairing.forEach(x=>add(x,'Repairing'));secondHand.forEach(x=>add(x,'Second Hand'));
    accessories.forEach(x=>{if(x.customerName||x.phone)add(x,'Accessories');});
    return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name));
}
function renderCustomerHub(){
    const box=$('customerHubResults');if(!box)return;
    const q=val('customerHubSearch').toLowerCase();
    const rows=aggregateCustomers().filter(g=>!q||[g.name,g.phone,...g.records.flatMap(r=>[r.data.imei,r.data.customerCode,r.data.device,r.data.brand,r.data.model])].join(' ').toLowerCase().includes(q));
    if(!rows.length){box.innerHTML='<div class="empty">No customer found.</div>';return;}
    box.innerHTML=rows.map((g,i)=>`<article class="result customer-result" data-customer-key="${esc(g.key)}"><div class="result-top"><div><div class="result-name">${esc(g.name)}</div><div class="result-meta">${esc(g.phone||'Phone not available')}</div></div><div class="work-log-tag">${g.records.length} records</div></div><div class="result-grid">${item('Finance',g.records.filter(r=>r.type==='Finance').length)}${item('Repairing',g.records.filter(r=>r.type==='Repairing').length)}${item('Second Hand',g.records.filter(r=>r.type==='Second Hand').length)}${item('Accessories',g.records.filter(r=>r.type==='Accessories').length)}</div></article>`).join('');
    box.querySelectorAll('.customer-result').forEach(card=>card.addEventListener('click',()=>showAggregatedCustomer(card.dataset.customerKey)));
}
function showAggregatedCustomer(key){
    const g=aggregateCustomers().find(x=>x.key===key);if(!g)return;
    const modal=$('customerDetailModal');if(!modal)return;
    $('detailTitle').textContent=`${g.name} • Customer History`;
    const blocks=g.records.map(r=>{
        const x=r.data;
        if(r.type==='Finance')return `<article class="traffic-data-card"><h4>💳 Finance / Mobile</h4><p>${esc(x.customerCode||'')} • ${esc(x.brand||'')} ${esc(x.model||'')}</p><p>IMEI: ${esc(x.imei||'-')} • Amount: ₹${Number(x.phoneAmount||0).toLocaleString('en-IN')}</p><p>Date: ${esc(formatDateTime(x))}</p></article>`;
        if(r.type==='Repairing')return `<article class="traffic-data-card"><h4>🛠️ Repairing</h4><p>${esc(x.device||'')} • ${esc(x.problem||'')}</p><p>Payment: ₹${Number(x.payment||0).toLocaleString('en-IN')} • ${esc(formatDateTime(x))}</p></article>`;
        if(r.type==='Second Hand')return `<article class="traffic-data-card"><h4>📦 Second Hand</h4><p>${esc(x.brand||x.device||'')} ${esc(x.model||'')}</p><p>IMEI: ${esc(x.imei||'-')} • Condition: ${esc(x.condition||'-')}</p><p>Purchase ₹${Number(x.price||0).toLocaleString('en-IN')} • Sell ₹${Number(x.salePrice||0).toLocaleString('en-IN')} • Profit ₹${Number((x.salePrice||0)-(x.price||0)).toLocaleString('en-IN')}</p></article>`;
        return `<article class="traffic-data-card"><h4>🎧 Accessories</h4><p>${esc(x.name||'')} • ${esc(x.category||'')}</p><p>SN: ${esc(x.sn||'-')} • Qty: ${esc(x.quantity||0)}</p></article>`;
    }).join('');
    $('customerDetailBody').innerHTML=`<div class="detail-grid">${detailItem('Customer Name',g.name)}${detailItem('Phone',g.phone||'-')}</div><div class="results" style="margin-top:14px">${blocks}</div>`;
    modal.classList.remove('hidden');
}
function setupUniversalScanners(){
    // Replace the old single-purpose scanner with a target-aware scanner.
    const openTarget=(targetId,title)=>startUniversalScan(targetId,title);
    $('scanImeiButton')?.addEventListener('click',e=>{e.stopImmediatePropagation();openTarget('imei','Scan IMEI');});
    $('scanSecondImeiButton')?.addEventListener('click',e=>{e.stopImmediatePropagation();openTarget('secondImei','Scan IMEI');});
    $('scanAccessorySnButton')?.addEventListener('click',e=>{e.stopImmediatePropagation();openTarget('accessorySn','Scan Serial Number');});
}
async function startUniversalScan(targetId,title){
    const modal=$('scannerModal'),video=$('scannerVideo'),m=$('scannerMessage');if(!modal||!video)return;
    modal.classList.remove('hidden');$('scannerMessage').textContent=`${title}: camera शुरू हो रहा है…`;
    try{
        if(!navigator.mediaDevices?.getUserMedia)throw Error('Camera API unavailable');
        scanStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
        video.srcObject=scanStream;await video.play();
        let detector=null;
        if('BarcodeDetector' in window){
            let formats=await BarcodeDetector.getSupportedFormats();formats=formats.filter(x=>['qr_code','code_128','code_39','code_93','ean_13','ean_8','itf','upc_a','upc_e','data_matrix'].includes(x));if(formats.length)detector=new BarcodeDetector({formats});
        }
        if(!detector){
            // ZXing fallback for iPhone/browser implementations without BarcodeDetector.
            if(!window.ZXingBrowser)await loadScript('https://unpkg.com/@zxing/browser@0.1.5/umd/index.min.js');
            if(window.ZXingBrowser){
                const reader=new ZXingBrowser.BrowserMultiFormatReader();
                m.textContent='Camera ready — barcode/IMEI को frame में रखें…';
                const controls=await reader.decodeFromVideoElement(video,(result)=>{
                    if(result){const raw=result.getText?result.getText():result.text||'';applyScanValue(targetId,raw);controls?.stop();stopScan();}
                });
                window.__zxingControls=controls;return;
            }
            throw Error('No barcode decoder available');
        }
        m.textContent='Camera ready — barcode/IMEI को frame में रखें…';
        const loop=async()=>{if(!scanStream)return;try{const a=await detector.detect(video);if(a?.length){applyScanValue(targetId,a[0].rawValue||'');return;}}catch(_){}scanTimer=setTimeout(loop,180);};loop();
    }catch(err){console.error(err);m.textContent='Camera scan शुरू नहीं हुआ. iPhone Settings → Safari → Camera permission allow करें, फिर HTTPS/GitHub Pages पर खोलें.';}
}
function applyScanValue(targetId,raw){
    const target=$(targetId);if(!target)return;
    const text=String(raw||'').trim();
    if(targetId.toLowerCase().includes('imei')){
        const digits=text.replace(/\D/g,'');target.value=digits.slice(0,15);
        if(target.value.length<15){$('scannerMessage').textContent=`Scanned ${target.value.length}/15 digits — पूरा IMEI frame में रखें…`;return;}
    }else{target.value=text.slice(0,80);}
    target.classList.add('scanner-target');setTimeout(()=>target.classList.remove('scanner-target'),700);stopScan();
}
function stopScan(){
    if(scanTimer)clearTimeout(scanTimer);scanTimer=null;
    try{window.__zxingControls?.stop?.();}catch(_){}window.__zxingControls=null;
    if(scanStream)scanStream.getTracks().forEach(t=>t.stop());scanStream=null;
    if($('scannerVideo'))$('scannerVideo').srcObject=null;$('scannerModal')?.classList.add('hidden');
}
function setupAdminEnhancements(){
    if(!$('appScreen')?.classList.contains('admin'))return;
    document.querySelector('h2')?.textContent;
    const pinHead=document.querySelector('.admin .panel .section-head h2');if(pinHead)pinHead.textContent='PIN Settings';
    document.querySelectorAll('.traffic-management-button').forEach(btn=>btn.addEventListener('click',()=>renderTrafficManagement(btn.dataset.management)));
    renderTrafficManagementCounts();
}
function renderTrafficManagementCounts(){
    $('trafficFinanceCount')&&($('trafficFinanceCount').textContent=`${customers.length} records`);
    $('trafficRepairingCount')&&($('trafficRepairingCount').textContent=`${repairing.length} records`);
    $('trafficSecondCount')&&($('trafficSecondCount').textContent=`${secondHand.length} records`);
    $('trafficAccessoryCount')&&($('trafficAccessoryCount').textContent=`${accessories.length} records`);
}
function renderTrafficManagement(type){
    const box=$('trafficManagementData');if(!box)return;box.classList.remove('hidden');
    const source=type==='finance'?customers:type==='repairing'?repairing:type==='secondHand'?secondHand:accessories;
    const title={finance:'Finance Management',repairing:'Repairing Management',secondHand:'Second Hand Management',accessories:'Accessories Management'}[type]||type;
    if(!source.length){box.innerHTML=`<div class="empty">${title} में अभी कोई data नहीं है.</div>`;return;}
    box.innerHTML=`<div class="traffic-data-card"><h4>${esc(title)}</h4><p>Total records: <b>${source.length}</b></p></div>`+source.slice(0,300).map(x=>{
        if(type==='finance')return `<div class="traffic-data-card"><h4>${esc(x.customerName||'Customer')} • ${esc(x.customerCode||'')}</h4><p>${esc(x.phone||'')} • ${esc(x.brand||'')} ${esc(x.model||'')}</p><p>IMEI: ${esc(x.imei||'-')} • Amount: ₹${Number(x.phoneAmount||0).toLocaleString('en-IN')}</p></div>`;
        if(type==='repairing')return `<div class="traffic-data-card"><h4>${esc(x.customerName||'Customer')}</h4><p>${esc(x.device||'')} • ${esc(x.problem||'')}</p><p>₹${Number(x.payment||0).toLocaleString('en-IN')} • ${esc(formatDateTime(x))}</p></div>`;
        if(type==='secondHand')return `<div class="traffic-data-card"><h4>${esc(x.brand||x.device||'')} ${esc(x.model||'')}</h4><p>${esc(x.customerName||'')} • ${esc(x.phone||'')}</p><p>IMEI: ${esc(x.imei||'-')} • Profit: ₹${Number((x.salePrice||0)-(x.price||0)).toLocaleString('en-IN')}</p></div>`;
        return `<div class="traffic-data-card"><h4>${esc(x.name||'Accessory')}</h4><p>${esc(x.category||'')} • SN: ${esc(x.sn||'-')}</p><p>Qty: ${esc(x.quantity||0)} • Profit: ₹${Number((x.salePrice||0)-(x.price||0)).toLocaleString('en-IN')}</p></div>`;
    }).join('');
}
function enhancedSaveSecondHand(){
    const f=$('secondHandForm');if(!f)return;
    f.addEventListener('submit',async e=>{
        e.preventDefault();if(enforceWriteLock('secondMessage'))return;
        const data={customerName:val('secondCustomerName'),phone:val('secondPhone').replace(/\D/g,''),brand:val('secondBrand'),model:val('secondModel'),device:[val('secondBrand'),val('secondModel')].filter(Boolean).join(' '),imei:val('secondImei').replace(/\D/g,''),condition:val('secondCondition'),price:Number(val('secondPrice')||0),salePrice:Number(val('secondSalePrice')||0),profit:Number(val('secondSalePrice')||0)-Number(val('secondPrice')||0),createdAt:serverTimestamp(),createdBy:user?.uid||null};
        if(!data.condition||!data.brand||!data.model||!data.customerName||!/^\d{10}$/.test(data.phone)){msg('secondMessage','Condition, brand, model, customer name और valid 10 digit phone भरें.');return;}
        if(data.imei && data.imei.length!==15){msg('secondMessage','IMEI 15 digits होना चाहिए.');return;}
        try{const ref=await addDoc(collection(db,SECOND_COL),data);await audit('second_hand_add',{section:'Second Hand Management',customerName:data.customerName,description:`Second-hand ${data.brand} ${data.model} added`,extra:{phone:data.phone,imei:data.imei,profit:data.profit}});f.reset();$('secondProfit').textContent='₹0';showSuccessToast('Successfully Saved','Second-hand phone saved successfully');}catch(err){console.error(err);msg('secondMessage',err?.message||'Save failed.');}
    });
}
function enhancedSaveAccessory(){
    const f=$('accessoryForm');if(!f)return;
    f.addEventListener('submit',async e=>{
        e.preventDefault();if(enforceWriteLock('accessoryMessage'))return;
        const data={name:val('accessoryName'),category:val('accessoryCategory'),sn:val('accessorySn'),quantity:Number(val('accessoryQty')||0),price:Number(val('accessoryPrice')||0),salePrice:Number(val('accessorySalePrice')||0),profit:Number(val('accessorySalePrice')||0)-Number(val('accessoryPrice')||0),createdAt:serverTimestamp(),createdBy:user?.uid||null};
        if(!data.name||!data.category||data.quantity<1){msg('accessoryMessage','Name, category और quantity भरें.');return;}
        try{await addDoc(collection(db,ACCESSORY_COL),data);await audit('accessory_add',{section:'Accessories Management',description:`Accessory added: ${data.name}`,extra:{sn:data.sn,quantity:data.quantity,profit:data.profit}});f.reset();$('accessoryProfit').textContent='₹0';showSuccessToast('Successfully Saved','Accessory saved successfully');}catch(err){console.error(err);msg('accessoryMessage',err?.message||'Save failed.');}
    });
}
function addWorkDeviceDetails(){
    // Patch audit display so existing and new logs show device details + source status.
    const oldRender=renderWorkHistory;
    window.renderWorkHistory=()=>{
        const box=$('workHistoryResults');if(!box)return;const q=val('workSearchInput').toLowerCase();const rows=auditLogs.filter(x=>!q||[x.label,x.action,x.userName,x.userUid,x.section,x.customerCode,x.customerName,x.description,JSON.stringify(x.details||{}),auditTime(x)].join(' ').toLowerCase().includes(q));
        if(!rows.length){box.innerHTML='<div class="empty">अभी कोई work history उपलब्ध नहीं है.</div>';return;}
        const iconMap={customer_add:'👤',customer_edit:'✏️',customer_delete:'🗑️',repairing_add:'🛠️',customer_search:'🔎',repairing_search:'🔎',customer_export:'📥',repairing_export:'📥',customer_pdf:'🔵',login_success:'🟢',login_failed:'🔴',page_open:'🟡',second_hand_add:'📱',accessory_add:'🎧',pin_change:'🔐'};
        box.innerHTML=rows.slice(0,300).map((x,i)=>{const d=x.details||{};const extra=d.extra||{};const device=[d.brand,d.model,d.device,extra.brand,extra.model,extra.device].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(' ');const status=x.action==='customer_pdf'?'🔵 PDF Download':(x.action==='customer_export'||x.action==='repairing_export'?'🔵 PDF/Export': '🟡 Website');return `<article class="result work-log"><div class="work-log-head"><div class="work-log-icon">${iconMap[x.action]||'⚡'}</div><div class="work-log-title"><b>${esc(x.label||auditLabel(x.action))}</b><small>${esc(x.section||'Kabir Mobile Data')} • ${esc(x.userName||x.userUid||'Kabir User')}</small></div><time class="work-log-time">${esc(auditTime(x))}</time></div><div class="work-log-desc">${esc(x.description||auditLabel(x.action))}</div><div class="work-log-tags"><span class="work-log-tag">${status}</span>${device?`<span class="work-log-tag">📱 ${esc(device)}</span>`:''}${x.customerCode?`<span class="work-log-tag">${esc(x.customerCode)}</span>`:''}${x.customerName?`<span class="work-log-tag">${esc(x.customerName)}</span>`:''}<span class="work-log-tag">#${i+1}</span></div></article>`;}).join('');
    };
}
function setupHomePdf(){
    $('homePdfButton')?.addEventListener('click',async()=>{
        try{
            if(!window.jspdf)await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
            const {jsPDF}=window.jspdf;const pdf=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});let page=1,y=20;
            const title='KABIR DATA — COMPLETE DATABASE';pdf.setFontSize(18);pdf.text(title,148,12,{align:'center'});pdf.setFontSize(9);pdf.text(`Generated: ${new Date().toLocaleString('en-IN')}`,148,17,{align:'center'});
            const addSection=(name,rows,cols)=>{if(y>185){pdf.addPage();page++;y=20;}pdf.setFontSize(13);pdf.text(name,14,y);y+=7;pdf.setFontSize(8);rows.slice(0,200).forEach(r=>{const line=cols.map(c=>`${c}: ${String(r[c]??'-')}`).join('   |   ');const lines=pdf.splitTextToSize(line,270);if(y+lines.length*4>195){pdf.addPage();page++;y=20;}pdf.text(lines,14,y);y+=lines.length*4+2;});y+=4;};
            addSection('FINANCE / CUSTOMERS',customers.map(c=>({'Code':c.customerCode,'Name':c.customerName,'Phone':c.phone,'Device':`${c.brand||''} ${c.model||''}`,'IMEI':c.imei,'Amount':c.phoneAmount,'Date':formatDateTime(c)})),['Code','Name','Phone','Device','IMEI','Amount','Date']);
            addSection('REPAIRING',repairing.map(r=>({'Name':r.customerName,'Phone':r.phone,'Device':r.device,'Problem':r.problem,'Payment':r.payment,'Date':formatDateTime(r)})),['Name','Phone','Device','Problem','Payment','Date']);
            addSection('SECOND HAND',secondHand.map(r=>({'Name':r.customerName,'Phone':r.phone,'Device':`${r.brand||''} ${r.model||r.device||''}`,'IMEI':r.imei,'Condition':r.condition,'Purchase':r.price,'Sell':r.salePrice,'Profit':r.profit??Number(r.salePrice||0)-Number(r.price||0)})),['Name','Phone','Device','IMEI','Condition','Purchase','Sell','Profit']);
            addSection('ACCESSORIES',accessories.map(r=>({'Name':r.name,'Category':r.category,'SN':r.sn,'Qty':r.quantity,'Purchase':r.price,'Sell':r.salePrice,'Profit':r.profit??Number(r.salePrice||0)-Number(r.price||0)})),['Name','Category','SN','Qty','Purchase','Sell','Profit']);
            pdf.save(`Kabir_Data_Complete_${new Date().toLocaleDateString('en-CA')}.pdf');
            await audit('customer_pdf',{section:'Kabir Data',description:'Complete database PDF downloaded'});
        }catch(e){console.error(e);alert('PDF download नहीं हो पाया.');}
    });
}
// Patch audit details for device/source when possible without breaking existing logs.
const __oldAudit=audit;
window.audit=__oldAudit;
function auditWithDevice(action,details={}){return __oldAudit(action,{...details,extra:{...(details.extra||{}),brand:details.brand||val('brand'),model:details.model||val('model'),device:details.device||val('repairDevice')}});}

function setupPinSettingsPage(){const b=$('openPinChangeButton'),p=$('pinChangePanel');b?.addEventListener('click',()=>p?.classList.toggle('hidden'));}
function setupAdminPages(){
    if(!$('appScreen')?.classList.contains('admin'))return;
    const open=(id)=>{
        document.querySelectorAll('#workHistorySection,#trafficSection').forEach(el=>{
            el.classList.add('hidden');
            el.classList.remove('admin-page-open');
        });
        const el=$(id);
        if(!el)return;
        el.classList.remove('hidden');
        el.classList.add('admin-page-open');
        setTimeout(()=>el.scrollIntoView({behavior:'smooth',block:'start'}),20);
    };
    const close=(id)=>{
        const el=$(id);
        el?.classList.add('hidden');
        el?.classList.remove('admin-page-open');
        window.scrollTo({top:0,behavior:'smooth'});
    };
    $('workHistoryButton')?.addEventListener('click',()=>{open('workHistorySection');renderWorkHistory();});
    $('trafficButton')?.addEventListener('click',()=>{open('trafficSection');renderTraffic();renderTrafficManagementCounts();});
    $('closeWorkPageButton')?.addEventListener('click',()=>close('workHistorySection'));
    $('closeTrafficPageButton')?.addEventListener('click',()=>close('trafficSection'));
}
const __renderTrafficBase=renderTraffic;
function renderTraffic(){__renderTrafficBase();renderTrafficManagementCounts();}

function enhancedFeaturesInit(){
    enhancedNavigation();setupProfitCalculators();setupSecondHandSelectors();setupUniversalScanners();enhancedSaveSecondHand();enhancedSaveAccessory();setupHomePdf();setupAdminEnhancements();setupAdminPages();setupPinSettingsPage();addWorkDeviceDetails();
}

function renderAccessories(){ const box=$('accessoryResults');if(!box)return;const q=val('accessorySearchInput').toLowerCase();const rows=accessories.filter(x=>!q||[x.name,x.category,x.sn].join(' ').toLowerCase().includes(q));box.innerHTML=rows.length?rows.map(x=>`<article class="result"><div class="result-name">${esc(x.name||'Accessory')}</div><div class="result-meta">${esc(x.category||'')} • SN: ${esc(x.sn||'-')}</div><div class="result-grid">${item('Quantity',x.quantity||0)}${item('Purchase Price',`₹${Number(x.price||0).toLocaleString('en-IN')}`)}${item('Sale Price',`₹${Number(x.salePrice||0).toLocaleString('en-IN')}`)}${item('Profit',`₹${Number(x.profit??(Number(x.salePrice||0)-Number(x.price||0))).toLocaleString('en-IN')}`)}</div></article>`).join(''):'<div class="empty">No accessories found.</div>'; }
