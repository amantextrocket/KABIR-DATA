import {initializeApp} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {getAuth,signInAnonymously,onAuthStateChanged} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {getFirestore,collection,addDoc,updateDoc,deleteDoc,setDoc,getDoc,doc,onSnapshot,query,orderBy,serverTimestamp,getDocs} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

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
const DELETED_COL="recentlyDeleted";
const AUDIT_COL="auditLogs";
const SETTINGS_COL="settings";
const SETTINGS_DOC="security";
const REMOTE_DEVICES_URL="https://cdn.jsdelivr.net/gh/bsthen/device-models/devices.json";
const isAdminPage=!!document.querySelector(".admin");

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
            // SECURITY: PIN verification must use the live Firebase value.
            // localStorage is never accepted as the source of truth.
            const securitySnap=await getDoc(securityRef);
            if(securitySnap.exists()){
                const p=String(securitySnap.data()?.pin||"");
                if(/^\d{4}$/.test(p)){
                    sharedPin=p;
                    pinLoaded=true;
                    return p;
                }
            }
            const legacyRef=doc(db,SETTINGS_COL,"app");
            const legacySnap=await getDoc(legacyRef);
            if(legacySnap.exists()){
                const p=String(legacySnap.data()?.pin||"");
                if(/^\d{4}$/.test(p)){
                    sharedPin=p;
                    pinLoaded=true;
                    await setDoc(securityRef,{pin:p,updatedAt:serverTimestamp()},{merge:true});
                    return p;
                }
            }
            // Only create the default on a genuinely new Firebase setup.
            sharedPin=DEFAULT_PIN;
            await setDoc(securityRef,{pin:DEFAULT_PIN,updatedAt:serverTimestamp()},{merge:true});
            pinLoaded=true;
            return sharedPin;
        }catch(e){
            console.error("Shared PIN load failed:",e);
            pinLoaded=false;
            throw Error("PIN load नहीं हुआ. Firebase connection check करें.");
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
    pinLoaded=true;
    await audit("pin_change",{section:"Admin Panel",description:"Shared PIN changed from Admin Panel"});
}


/* =========================================================
   WORK HISTORY / AUDIT LOGS
========================================================= */
function deviceInfo(){
    const ua=navigator.userAgent||"";
    let brand="Browser",model=navigator.platform||"Unknown";
    if(/iPhone/i.test(ua)){brand="Apple";model="iPhone";}
    else if(/iPad/i.test(ua)){brand="Apple";model="iPad";}
    else if(/Android/i.test(ua)){
        brand="Android";
        const m=ua.match(/Android[^;)]*;[^;)]*;\s*([^;)]+?)(?:\s+Build\/[^;)]+)?[;)]/i);
        model=m?.[1]?.trim()||"Android device";
    }
    else if(/Macintosh/i.test(ua)){brand="Apple";model="Mac";}
    return {brand,model,userAgent:ua.slice(0,180)};
}

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
        accessory_add:"Accessory Added",
        pdf_download:"Complete PDF Download"
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
            deviceBrand:details.deviceBrand||deviceInfo().brand,
            deviceModel:details.deviceModel||deviceInfo().model,
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
    const iconMap={customer_add:"👤",customer_edit:"✏️",customer_delete:"🗑️",customer_bill_update:"🧾",repairing_add:"🛠️",customer_search:"🔎",repairing_search:"🔎",customer_export:"📥",repairing_export:"📥",customer_pdf:"📄",pin_change:"🔐",login_success:"🟢",login_failed:"🔴",page_open:"🟡",pdf_download:"🔵",second_hand_add:"📱",accessory_add:"🎧"};
    box.innerHTML=rows.slice(0,300).map((x,i)=>`<article class="result work-log">
      <div class="work-log-head"><div class="work-log-icon">${iconMap[x.action]||"⚡"}</div><div class="work-log-title"><b>${esc(x.label||auditLabel(x.action))}</b><small>${esc(x.section||"Kabir Mobile Data")} • ${esc(x.userName||x.userUid||"Kabir User")}</small></div><time class="work-log-time">${esc(auditTime(x))}</time></div>
      <div class="work-log-desc">${esc(x.description||auditLabel(x.action))}</div><div class="work-log-tags"><span class="work-log-tag">Device: ${esc(x.deviceBrand||"—")} ${esc(x.deviceModel||"")}</span></div>
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
    if(!$("workHistoryButton")||!$("trafficButton"))return;
    const open=id=>{document.querySelectorAll("[data-admin-page]").forEach(x=>x.classList.add("hidden"));$(id)?.classList.remove("hidden");$(id)?.scrollIntoView({behavior:"smooth",block:"start"});};
    $("pinSettingsButton")?.addEventListener("click",()=>open("pinPage"));
    $("workHistoryButton").addEventListener("click",()=>{open("workHistorySection");renderWorkHistory();});
    $("trafficButton").addEventListener("click",()=>{open("trafficSection");renderTraffic();});
    document.querySelectorAll("[data-admin-back]").forEach(b=>b.addEventListener("click",()=>open(b.dataset.adminBack)));
    $("refreshWorkButton")?.addEventListener("click",renderWorkHistory);$("refreshTrafficButton")?.addEventListener("click",renderTraffic);$("workSearchInput")?.addEventListener("input",renderWorkHistory);$("customerGraphRange")?.addEventListener("change",renderCustomerDateGraph);
    document.querySelectorAll("[data-management]").forEach(b=>b.addEventListener("click",()=>renderManagementData(b.dataset.management)));
    subscribeAuditLogs();
}
function renderManagementData(type){
    const box=$("trafficManagementDetail");if(!box)return;
    let title="",rows=[];
    if(type==="finance"){title="Finance Management";rows=customers.map(x=>[x.customerName,x.phone,`${x.brand||""} ${x.model||""}`,x.imei,`₹${x.phoneAmount||0}`]);}
    if(type==="repairing"){title="Repairing Management";rows=repairing.map(x=>[x.customerName,x.phone,x.device,x.problem,`₹${x.total??x.payment??0}`,`₹${x.partsPrice||0}`,`₹${x.profit??(Number(x.total ?? x.payment ?? 0)-Number(x.partsPrice||0))}`]);}
    if(type==="secondHand"){title="Second Hand Management";rows=secondHand.map(x=>[x.customerName,`${x.brand||""} ${x.model||x.device||""}`,x.imei,x.condition,`₹${x.price||0}`,`₹${x.salePrice||0}`,`₹${x.profit??(Number(x.salePrice||0)-Number(x.price||0))}`]);}
    if(type==="accessories"){title="Accessories Management";rows=accessories.map(x=>[x.name,x.category,x.sn,x.quantity,`₹${x.price||0}`,`₹${x.salePrice||0}`,`₹${x.profit??(Number(x.salePrice||0)-Number(x.price||0))}`]);}
    box.innerHTML=`<div class="section-head"><div><div class="eyebrow">SELECTED MANAGEMENT</div><h3>${esc(title)}</h3></div><b>${rows.length} Records</b></div>`+(rows.length?`<div class="admin-data-table">${rows.slice(0,500).map(r=>`<div class="admin-data-row">${r.map(v=>`<span>${esc(v)}</span>`).join("")}</div>`).join("")}</div>`:'<div class="empty">No data found.</div>');
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
            // Never unlock from a cached/local PIN. Wait for live Firebase PIN.
            try{
                await authReady;
                const livePin=await loadSharedPin();
                if(e.value!==entered)return;
                if(entered===livePin){
                    audit("login_success",{section:$('appScreen')?.classList.contains('admin')?'Admin Panel':'Kabir Mobile Data',description:'PIN login successful',deviceBrand:deviceInfo().brand,deviceModel:deviceInfo().model});
                    unlock();
                    msg("pinMessage","");
                }else{
                    audit("login_failed",{section:$('appScreen')?.classList.contains('admin')?'Admin Panel':'Kabir Mobile Data',description:'Incorrect PIN entered'});
                    msg("pinMessage","Incorrect PIN");
                    pinError();
                    setTimeout(()=>{e.value="";dots("");msg("pinMessage","");e.focus()},240);
                }
            }catch(err){
                msg("pinMessage","Firebase से PIN verify नहीं हो पाया.");
                pinError();
                setTimeout(()=>{e.value="";dots("");e.focus()},240);
            }
        };
        finish();
    };
    e.addEventListener("input",attempt);
    $("lockButton")?.addEventListener("click",lock);
    // Do not restore an unlocked session after a reload/device change.
    sessionStorage.removeItem("kabir_unlocked");
    setTimeout(()=>e.focus(),100);
}

/* =========================================================
   FIREBASE AUTH
========================================================= */

let authReadyResolve;
let authReadyReject;
let authStarted=false;
const authReady=new Promise((resolve,reject)=>{
    authReadyResolve=resolve;
    authReadyReject=reject;
});

async function authInit(){
    if(authStarted)return authReady;
    authStarted=true;
    let settled=false;

    const setStatus=(text,isError=false)=>{
        if($("connectionStatus")){
            $("connectionStatus").textContent=text;
            $("connectionStatus").classList.toggle("error",!!isError);
        }
        if($("adminFirebaseStatus")){
            $("adminFirebaseStatus").textContent=text;
            $("adminFirebaseStatus").classList.toggle("error",!!isError);
        }
    };

    onAuthStateChanged(auth,u=>{
        // Firebase emits null while restoring auth state. Never treat null as ready.
        if(!u){
            user=null;
            updateAdmin();
            setStatus("Firebase connecting…");
            return;
        }
        user=u;
        updateAdmin();
        setStatus("Firebase connected ✓");
        if(!settled){
            settled=true;
            authReadyResolve(u);
        }
    },e=>{
        console.error("Firebase auth state error:",e);
        user=null;
        updateAdmin();
        setStatus("Firebase authentication failed. Anonymous Sign-in ON करें.",true);
        if(!settled){
            settled=true;
            authReadyReject(e);
        }
    });

    try{
        if(!auth.currentUser){
            await signInAnonymously(auth);
        }
    }catch(e){
        console.error("Firebase anonymous sign-in failed:",e);
        setStatus("Firebase authentication failed. Anonymous Sign-in ON करें.",true);
        if(!settled){
            settled=true;
            authReadyReject(e);
        }
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

let pageHistory=["homeView"];
function show(id,{back=false}={}){
    const current=pageHistory[pageHistory.length-1];
    if(!back && current!==id) pageHistory.push(id);
    if(back && pageHistory.length>1){pageHistory.pop();id=pageHistory[pageHistory.length-1];}
    document.querySelectorAll("[data-page]").forEach(x=>x.classList.add("hidden"));
    const el=$(id);
    if(el){
        el.classList.remove("hidden");
        requestAnimationFrame(()=>{
            const top=Math.max(0,el.getBoundingClientRect().top+window.scrollY-108);
            window.scrollTo({top,behavior:"smooth"});
        });
    }
}


function nav(){
    const open=id=>show(id);
    $("financeModule")?.addEventListener("click",()=>open("financePage"));
    $("repairingModule")?.addEventListener("click",()=>open("repairingPage"));
    $("secondHandModule")?.addEventListener("click",()=>open("secondPage"));
    $("accessoriesModule")?.addEventListener("click",()=>open("accessoriesPage"));
    $("customerModule")?.addEventListener("click",()=>{open("customerPage");renderAllCustomers();});
    document.querySelectorAll("[data-page-back]").forEach(b=>b.addEventListener("click",()=>{if(b.dataset.pageBack==="homeView")show("homeView",{back:true});else open(b.dataset.pageBack);}));
    document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>{
        const target=b.dataset.close;
        if(target==="homeView"){open("homeView");return;}
        const el=$(target);
        if(el)el.classList.add("hidden");
        open("homeView");
    }));
    $("searchCustomerCard")?.addEventListener("click",()=>{open("searchSection");$("searchInput")?.focus();renderSearch();audit("customer_search",{section:"Kabir Mobile Data",description:"Customer search opened"});});
    $("addCustomerCard")?.addEventListener("click",()=>open("addSection"));
    $("totalCustomersCard")?.addEventListener("click",()=>{open("searchSection");renderSearch();});
    $("totalDevicesCard")?.addEventListener("click",()=>{open("searchSection");renderSearch();});
    $("repairTotalCustomersCard")?.addEventListener("click",()=>{open("repairSearchSection");renderRepairing();});
    $("repairTotalDevicesCard")?.addEventListener("click",()=>{open("repairSearchSection");renderRepairing();});
    $("addRepairingCard")?.addEventListener("click",()=>open("repairAddSection"));
    $("searchRepairingCard")?.addEventListener("click",()=>{open("repairSearchSection");renderRepairing();$("repairSearchInput")?.focus();audit("repairing_search",{section:"Kabir Repairing Data",description:"Repairing search opened"});});
    $("secondCustomerListCard")?.addEventListener("click",()=>{open("secondListSection");renderSecondHand();});
    $("secondStockCard")?.addEventListener("click",()=>{open("secondListSection");renderSecondHand();});
    $("secondSearchCard")?.addEventListener("click",()=>{open("secondListSection");renderSecondHand();$("secondSearchInput")?.focus();});
    $("secondAddCard")?.addEventListener("click",()=>open("secondAddSection"));
    $("accessoryListCard")?.addEventListener("click",()=>{open("accessoryListSection");renderAccessories();});
    $("accessoryStockCard")?.addEventListener("click",()=>{open("accessoryListSection");renderAccessories();});
    $("accessorySearchCard")?.addEventListener("click",()=>{open("accessoryListSection");renderAccessories();$("accessorySearchInput")?.focus();});
    $("accessoryAddCard")?.addEventListener("click",()=>open("accessoryAddSection"));
    $("secondSearchInput")?.addEventListener("input",renderSecondHand);
    $("accessorySearchInput")?.addEventListener("input",renderAccessories);
    $("allCustomerSearchInput")?.addEventListener("input",renderAllCustomers);
    $("secondHandForm")?.addEventListener("submit",saveSecondHand);
    $("accessoryForm")?.addEventListener("submit",saveAccessory);
    document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>$(b.dataset.close)?.classList.add("hidden")));
    $("homePdfButton")?.addEventListener("click",downloadFullPdf);
    setupSecondHandFields();
    setupAccessoryFields();
}


function closeTopLayer(){
    const ids=[
        "customerDetailModal","pdfSelectModal","themeModal","scannerModal",
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
let swipeStartX=0,swipeStartY=0;
document.addEventListener("touchstart",e=>{const t=e.changedTouches[0];swipeStartX=t.clientX;swipeStartY=t.clientY;},{passive:true});
document.addEventListener("touchend",e=>{
    const t=e.changedTouches[0],dx=t.clientX-swipeStartX,dy=t.clientY-swipeStartY;
    if(swipeStartX<55 && dx>90 && Math.abs(dx)>Math.abs(dy)*1.25){
        const modalOpen=["customerDetailModal","themeModal","scannerModal"].some(id=>$(id)&&!$(id).classList.contains("hidden"));
        if(!modalOpen && pageHistory.length>1) show(pageHistory[pageHistory.length-2],{back:true});
    }
},{passive:true});

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
    $("editCustomerButton")?.removeAttribute("disabled");
    $("deleteCustomerButton")?.removeAttribute("disabled");
}
function closeCustomerDetail(){activeCustomerId=null;$("customerDetailModal")?.classList.add("hidden")}
async function moveToRecentlyDeleted(collectionName,id,data){
    const deleted={originalCollection:collectionName,originalId:id,deletedAt:serverTimestamp(),deletedBy:user?.uid||null,data:{...data}};
    await addDoc(collection(db,DELETED_COL),deleted);
}
async function deleteWithRecycle(collectionName,id,data){
    await moveToRecentlyDeleted(collectionName,id,data);
    await deleteDoc(doc(db,collectionName,id));
}
async function purgeExpiredDeleted(){
    try{
        const snap=await getDocs(collection(db,DELETED_COL));
        const cutoff=Date.now()-30*24*60*60*1000;
        for(const d of snap.docs){
            const ts=d.data()?.deletedAt?.toDate?.();
            if(ts && ts.getTime()<cutoff) await deleteDoc(doc(db,DELETED_COL,d.id));
        }
    }catch(e){console.warn("Recently deleted cleanup failed",e)}
}
function deletedDate(x){return x?.deletedAt?.toDate?.()||null}
function renderRecentlyDeleted(){
    const box=$("recentDeletedResults");if(!box)return;
    getDocs(collection(db,DELETED_COL)).then(async snap=>{
        const rows=snap.docs.map(d=>({id:d.id,...d.data()}));
        const cutoff=Date.now()-30*24*60*60*1000;
        const active=rows.filter(x=>{const d=deletedDate(x);return !d||d.getTime()>=cutoff}).sort((a,b)=>(deletedDate(b)?.getTime()||0)-(deletedDate(a)?.getTime()||0));
        if(!active.length){box.innerHTML='<div class="empty">Recently Deleted खाली है.</div>';return;}
        box.innerHTML=active.map(x=>{const d=deletedDate(x);const data=x.data||{};const name=data.customerName||data.name||data.customerPhone||"Deleted Record";const type=x.originalCollection||"Data";const days=d?Math.max(0,30-Math.floor((Date.now()-d.getTime())/86400000)):30;return `<article class="result deleted-result"><div class="result-top"><div><div class="result-name">${esc(name)}</div><div class="result-meta">${esc(type)} • Deleted ${d?d.toLocaleString("en-IN") : "recently"}</div></div><span class="work-log-tag">${days} days</span></div><div class="result-grid">${item("Phone",data.phone||data.customerPhone||"—")}${item("Code",data.customerCode||"—")}</div><div class="deleted-actions"><button class="save restore-deleted" data-id="${esc(x.id)}">RECOVER</button><button class="save danger-btn purge-deleted" data-id="${esc(x.id)}">DELETE NOW</button></div></article>`}).join("");
        box.querySelectorAll(".restore-deleted").forEach(btn=>btn.onclick=()=>restoreDeleted(btn.dataset.id));
        box.querySelectorAll(".purge-deleted").forEach(btn=>btn.onclick=async()=>{if(!confirm("इस deleted record को permanently delete करें?"))return;await deleteDoc(doc(db,DELETED_COL,btn.dataset.id));renderRecentlyDeleted();});
    }).catch(e=>{console.error(e);box.innerHTML='<div class="empty">Recently Deleted load नहीं हुआ.</div>';});
}
async function restoreDeleted(id){
    try{const snap=await getDoc(doc(db,DELETED_COL,id));if(!snap.exists())return;const x=snap.data();await setDoc(doc(db,x.originalCollection,x.originalId),x.data||{});await deleteDoc(doc(db,DELETED_COL,id));renderRecentlyDeleted();renderAllCustomers();showSuccessToast("Recovered","Data successfully recovered");}catch(e){console.error(e);alert("Recovery failed. Firebase Rules check करें.");}
}

async function deleteCustomer(){
    if(enforceWriteLock("pinMessage"))return;
    let c=customers.find(x=>x.id===activeCustomerId);
    if(!c && window.activeUnifiedCustomer){
        const u=window.activeUnifiedCustomer;
        c=customers.find(x=>u.financeId&&x.id===u.financeId);
        if(!c){
            const p=u.phone;
            const match=x=>p&&String(x.phone||x.customerPhone||"").replace(/\D/g,"")===p;
            const r=repairing.find(match), sh=secondHand.find(match), ac=accessories.find(match);
            if(r){if(!confirm(`Delete ${r.customerName||"this customer"} repairing record permanently?`))return;return deleteWithRecycle(REPAIR_COL,r.id,r).then(()=>{closeCustomerDetail();renderAllCustomers();showSuccessToast("Deleted","Repairing customer record deleted");}).catch(e=>{console.error(e);alert("Delete failed. Firebase Rules check करें.");});}
            if(sh){if(!confirm(`Delete ${sh.customerName||"this customer"} second-hand record permanently?`))return;return deleteWithRecycle(SECOND_COL,sh.id,sh).then(()=>{closeCustomerDetail();renderAllCustomers();showSuccessToast("Deleted","Second-hand customer record deleted");}).catch(e=>{console.error(e);alert("Delete failed. Firebase Rules check करें.");});}
            if(ac){if(!confirm(`Delete ${ac.customerName||"this customer"} accessory record permanently?`))return;return deleteWithRecycle(ACCESSORY_COL,ac.id,ac).then(()=>{closeCustomerDetail();renderAllCustomers();showSuccessToast("Deleted","Accessory customer record deleted");}).catch(e=>{console.error(e);alert("Delete failed. Firebase Rules check करें.");});}
        }
    }
    if(!c){alert("Customer record नहीं मिला.");return;}
    if(!confirm(`Delete ${c.customerName||"this customer"} (${c.customerCode||""}) permanently?`))return;
    try{
        await deleteWithRecycle(COL,c.id,c);
        await audit("customer_delete",{section:"Kabir Mobile Data",customerId:c.id,customerCode:c.customerCode,customerName:c.customerName,description:`Customer ${c.customerName||c.customerCode||c.id} deleted`});
        closeCustomerDetail();
        renderAllCustomers();
        showSuccessToast("Customer Deleted","Customer record deleted successfully");
    }catch(e){console.error(e);alert("Customer delete नहीं हुआ. Firebase Rules check करें.")}
}
function editCustomer(){
    if(enforceWriteLock("formMessage"))return;
    const c=customers.find(x=>x.id===activeCustomerId);
    if(!c){alert("यह customer Finance/Customer database में नहीं है, इसलिए Customer Edit उपलब्ध नहीं है।");return;}
    closeCustomerDetail();
    show("addSection");
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
        setTimeout(()=>{$("colour").value=c.colour||"";$('storage').value=c.storage||""},0);
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

let scanTargetId="imei";
let zxingReader=null;

async function startScan(targetId="imei"){
    scanTargetId=targetId||"imei";
    const modal=$("scannerModal"),video=$("scannerVideo"),m=$("scannerMessage");
    if(!modal||!video)return;
    modal.classList.remove("hidden");
    $("scannerTitle")&&( $("scannerTitle").textContent=scanTargetId==="accessorySn"?"Scan Serial Number":"Scan IMEI" );
    m.textContent="Camera start हो रही है…";
    try{
        if(!navigator.mediaDevices?.getUserMedia)throw Error("Camera API unavailable");
        const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false});
        scanStream=stream; video.srcObject=stream; await video.play();
        // First try the native iOS/browser detector when available.
        if("BarcodeDetector" in window){
            const supported=await BarcodeDetector.getSupportedFormats().catch(()=>[]);
            const formats=supported.filter(x=>["qr_code","code_128","code_39","code_93","ean_13","ean_8","upc_a","upc_e","itf","data_matrix"].includes(x));
            if(formats.length){
                const detector=new BarcodeDetector({formats});
                const loop=async()=>{
                    if(!scanStream)return;
                    try{const codes=await detector.detect(video);if(codes?.length){if(handleScannedValue(codes[0].rawValue||""))return;}}catch(_){}
                    scanTimer=setTimeout(loop,180);
                };
                m.textContent="Barcode/QR को camera frame में रखें…"; loop(); return;
            }
        }
        // Reliable fallback for browsers without BarcodeDetector (common on iPhone).
        m.textContent="Scanner engine load हो रहा है…";
        const z=await import("https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm");
        const Reader=z.BrowserMultiFormatReader;
        if(!Reader)throw Error("ZXing unavailable");
        zxingReader=new Reader();
        m.textContent="Barcode/QR को camera frame में रखें…";
        const controls=await zxingReader.decodeFromVideoElement(video,(result)=>{
            if(result?.getText?.())handleScannedValue(result.getText());
        });
        scanTimer=controls;
    }catch(e){
        console.error("Scanner:",e);
        m.textContent="Scanner start नहीं हुआ. iPhone Settings → Safari → Camera = Allow करें, फिर दोबारा Scan दबाएँ.";
        if(!scanStream){return;}
    }
}
function handleScannedValue(raw){
    const input=$(scanTargetId);if(!input)return false;
    let value=String(raw||"").trim();
    if(scanTargetId!=="accessorySn")value=value.replace(/\D/g,"");
    if(scanTargetId!=="accessorySn" && value.length<15)return false;
    if(scanTargetId==="accessorySn" && value.length<3)return false;
    input.value=scanTargetId!=="accessorySn"?value.slice(0,15):value.slice(0,80);
    input.dispatchEvent(new Event("input",{bubbles:true}));
    $("scannerMessage").textContent="✓ Scanned successfully";
    setTimeout(stopScan,250);
    return true;
}
function stopScan(){
    if(scanTimer&&typeof scanTimer==="number")clearTimeout(scanTimer);
    try{scanTimer?.stop?.()}catch(_){}
    scanTimer=null;
    try{zxingReader?.reset?.()}catch(_){}
    zxingReader=null;
    if(scanStream)scanStream.getTracks().forEach(t=>t.stop());
    scanStream=null;
    if($("scannerVideo"))$("scannerVideo").srcObject=null;
    $("scannerModal")?.classList.add("hidden");
}
function scanner(){
    document.querySelectorAll(".scan-code-button").forEach(b=>b.addEventListener("click",()=>startScan(b.dataset.scanTarget)));
    $("scanImeiButton")?.addEventListener("click",()=>startScan("imei"));
    $("closeScannerButton")?.addEventListener("click",stopScan);
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
function renderSecondHand(){
    const box=$("secondResults");if(!box)return;
    const q=val("secondSearchInput").toLowerCase();
    const rows=secondHand.filter(x=>!q||[x.customerName,x.phone,x.brand,x.model,x.device,x.imei,x.condition].join(" ").toLowerCase().includes(q));
    box.innerHTML=rows.length?rows.map(x=>{const profit=Number(x.salePrice||0)-Number(x.price||0);return `<article class="result"><div class="result-name">${esc(`${x.brand||""} ${x.model||x.device||"Second Hand Phone"}`.trim())}</div><div class="result-meta">${esc(x.customerName||"")} • ${esc(x.phone||"")}</div><div class="result-grid">${item("IMEI",x.imei||"")}${item("Condition",x.condition||"")}${item("Purchase Price",`₹${Number(x.price||0).toLocaleString("en-IN")}`)}${item("Sell Price",`₹${Number(x.salePrice||0).toLocaleString("en-IN")}`)}${item("Profit",`₹${profit.toLocaleString("en-IN")}`)}</div></article>`}).join(""):"<div class=\"empty\">No second-hand records found.</div>";
}
function renderAccessories(){
    const box=$("accessoryResults");if(!box)return;
    const q=val("accessorySearchInput").toLowerCase();
    const rows=accessories.filter(x=>!q||[x.name,x.category,x.sn,x.customerName,x.customerPhone].join(" ").toLowerCase().includes(q));
    box.innerHTML=rows.length?rows.map(x=>{const profit=Number(x.salePrice||0)-Number(x.price||0);return `<article class="result"><div class="result-name">${esc(x.name||"Accessory")}</div><div class="result-meta">${esc(x.category||"")} • SN: ${esc(x.sn||"—")}</div><div class="result-grid">${item("Quantity",x.quantity||0)}${item("Purchase Price",`₹${Number(x.price||0).toLocaleString("en-IN")}`)}${item("Sale Price",`₹${Number(x.salePrice||0).toLocaleString("en-IN")}`)}${item("Profit",`₹${profit.toLocaleString("en-IN")}`)}${item("Customer",x.customerName||"—")}</div></article>`}).join(""):"<div class=\"empty\">No accessories found.</div>";
}
function setupSecondHandFields(){
    const b=$("secondBrand"),m=$("secondModel");if(!b||!m)return;
    b.innerHTML='<option value="">Select brand</option>'+Object.keys(BRANDS).sort().map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("");
    b.addEventListener("change",()=>{const list=modelListForBrand(b.value);m.innerHTML='<option value="">Select model</option>'+list.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("");m.disabled=!list.length;});
    ["secondPrice","secondSalePrice"].forEach(id=>$(id)?.addEventListener("input",updateSecondProfit));
}
function updateSecondProfit(){const p=Number(val("secondPrice")||0),s=Number(val("secondSalePrice")||0);if($("secondProfit"))$("secondProfit").textContent=`₹${(s-p).toLocaleString("en-IN")}`;}
function updateRepairProfit(){
    const total=Number(val("repairTotal")||0),parts=Number(val("repairPartsPrice")||0);
    if($("repairProfit"))$("repairProfit").textContent=`₹${(total-parts).toLocaleString("en-IN")}`;
}
function setupRepairFields(){
    ["repairTotal","repairPartsPrice"].forEach(id=>$(id)?.addEventListener("input",updateRepairProfit));
    updateRepairProfit();
}
function setupAccessoryFields(){["accessoryPrice","accessorySalePrice"].forEach(id=>$(id)?.addEventListener("input",updateAccessoryProfit));}
function updateAccessoryProfit(){const p=Number(val("accessoryPrice")||0),s=Number(val("accessorySalePrice")||0);if($("accessoryProfit"))$("accessoryProfit").textContent=`₹${(s-p).toLocaleString("en-IN")}`;}
async function saveSecondHand(e){
    e.preventDefault();if(enforceWriteLock("secondMessage"))return;
    const brand=val("secondBrandType")||val("secondBrand"),model=val("secondModelType")||val("secondModel");
    const data={customerName:val("secondCustomerName"),phone:val("secondPhone").replace(/\D/g,""),brand,model,device:[brand,model].filter(Boolean).join(" "),imei:val("secondImei").replace(/\D/g,""),condition:val("secondCondition"),price:Number(val("secondPrice")||0),salePrice:Number(val("secondSalePrice")||0),profit:Number(val("secondSalePrice")||0)-Number(val("secondPrice")||0),createdAt:serverTimestamp(),createdBy:user?.uid||null};
    if(!data.condition||!brand||!model||!/^(?:\d{15})?$/.test(data.imei)||!data.customerName||!/^\d{10}$/.test(data.phone)){msg("secondMessage","Condition, brand, model, valid 10 digit phone और IMEI (15 digit) सही भरें.");return;}
    try{await addDoc(collection(db,SECOND_COL),data);await audit("second_hand_add",{section:"Second Hand",customerName:data.customerName,description:`Second-hand phone added: ${data.device}`,extra:{phone:data.phone,imei:data.imei,brand,model,profit:data.profit}});e.target.reset();$("secondBrandType").value="";$("secondModelType").value="";$("secondModel").innerHTML='<option value="">Select brand first</option>';$("secondModel").disabled=true;updateSecondProfit();showSuccessToast("Successfully Saved","Second-hand phone stock में add हो गया.");}catch(err){console.error(err);msg("secondMessage",err?.message||"Save failed.");}
}
async function saveAccessory(e){
    e.preventDefault();if(enforceWriteLock("accessoryMessage"))return;
    const data={name:val("accessoryName"),category:val("accessoryCategory"),sn:val("accessorySn"),quantity:Number(val("accessoryQty")||0),price:Number(val("accessoryPrice")||0),salePrice:Number(val("accessorySalePrice")||0),profit:Number(val("accessorySalePrice")||0)-Number(val("accessoryPrice")||0),customerName:val("accessoryCustomerName"),customerPhone:val("accessoryCustomerPhone").replace(/\D/g,""),createdAt:serverTimestamp(),createdBy:user?.uid||null};
    if(!data.name||!data.category||data.quantity<1){msg("accessoryMessage","Name, category और quantity भरें.");return;}
    try{await addDoc(collection(db,ACCESSORY_COL),data);await audit("accessory_add",{section:"Accessories",customerName:data.customerName,description:`Accessory added: ${data.name}`,extra:{category:data.category,quantity:data.quantity,sn:data.sn,profit:data.profit,customerPhone:data.customerPhone}});e.target.reset();updateAccessoryProfit();showSuccessToast("Successfully Saved","Accessory stock में add हो गया.");}catch(err){console.error(err);msg("accessoryMessage",err?.message||"Save failed.");}
}

function renderAllCustomers(){
    const box=$("allCustomerResults");if(!box)return;const q=val("allCustomerSearchInput").toLowerCase();
    const map=new Map();
    const add=(r,type,name,phone)=>{const n=String(name||"").trim(),p=String(phone||"").replace(/\D/g,"");if(!n&&!p)return;const key=p||n.toLowerCase();if(!map.has(key))map.set(key,{name:n||"Customer",phone:p,types:new Set()});map.get(key).types.add(type);};
    customers.forEach(x=>add(x,"Finance",x.customerName,x.phone));repairing.forEach(x=>add(x,"Repairing",x.customerName,x.phone));secondHand.forEach(x=>add(x,"Second Hand",x.customerName,x.phone));accessories.forEach(x=>add(x,"Accessories",x.customerName,x.customerPhone));
    const rows=[...map.values()].filter(x=>!q||[x.name,x.phone,[...x.types].join(" ")].join(" ").toLowerCase().includes(q));
    box.innerHTML=rows.length?rows.map((x,i)=>`<article class="result all-customer-result" data-phone="${esc(x.phone)}" data-name="${esc(x.name)}"><div class="result-top"><div><div class="result-name">${esc(x.name)}</div><div class="result-meta">${esc(x.phone||"Phone not available")}</div></div><div class="work-log-tag">${esc([...x.types].join(" • "))}</div></div><div class="result-open-hint">Tap करके आज तक का पूरा data देखें</div></article>`).join(""):"<div class=\"empty\">No customer found.</div>";
    box.querySelectorAll(".all-customer-result").forEach(card=>card.addEventListener("click",()=>showUnifiedCustomerHistory(card.dataset.phone,card.dataset.name)));
}
function showUnifiedCustomerHistory(phone,name){
    const p=String(phone||"").replace(/\D/g,"");const n=String(name||"").trim().toLowerCase();
    const same=x=>(p&&String(x.phone||x.customerPhone||"").replace(/\D/g,"")===p)||(!p&&n&&String(x.customerName||"").trim().toLowerCase()===n);
    const finance=customers.filter(same),repair=repairing.filter(same),second=secondHand.filter(same),acc=accessories.filter(same);
    const title=name||finance[0]?.customerName||repair[0]?.customerName||second[0]?.customerName||acc[0]?.customerName||"Customer";
    $("detailTitle").textContent=`${title} • Complete History`;
    activeCustomerId=finance[0]?.id||null;
    window.activeUnifiedCustomer={phone:p,name:title,financeId:finance[0]?.id||null,repairId:repair[0]?.id||null,secondId:second[0]?.id||null,accessoryId:acc[0]?.id||null};
    const editBtn=$("editCustomerButton"),deleteBtn=$("deleteCustomerButton");
    const financeEditable=!!activeCustomerId;
    if(editBtn){editBtn.disabled=false;editBtn.title=financeEditable?"Edit Finance customer":"This customer has no Finance record";}
    if(deleteBtn){deleteBtn.disabled=false;deleteBtn.title=financeEditable?"Delete Finance customer":"Delete available customer record";}
    const rows=[];finance.forEach(x=>rows.push(`<article class="history-row"><b>💳 Finance / Phone</b><small>${esc(formatDateTime(x))}</small><span>${esc(`${x.brand||""} ${x.model||""}`)} • IMEI ${esc(x.imei||"—")} • ₹${Number(x.phoneAmount||0).toLocaleString("en-IN")}</span></article>`));repair.forEach(x=>rows.push(`<article class="history-row"><b>🛠 Repairing</b><small>${esc(formatDateTime(x))}</small><span>${esc(x.device||"")} • ${esc(x.problem||"")} • Total ₹${Number(x.total ?? x.payment ?? 0).toLocaleString("en-IN")} • Parts ₹${Number(x.partsPrice||0).toLocaleString("en-IN")} • Profit ₹${Number(x.profit??(Number(x.total ?? x.payment ?? 0)-Number(x.partsPrice||0))).toLocaleString("en-IN")}</span></article>`));second.forEach(x=>rows.push(`<article class="history-row"><b>📱 Second Hand</b><small>${esc(formatDateTime(x))}</small><span>${esc(`${x.brand||""} ${x.model||x.device||""}`)} • IMEI ${esc(x.imei||"—")} • Profit ₹${Number(x.profit??(Number(x.salePrice||0)-Number(x.price||0))).toLocaleString("en-IN")}</span></article>`));acc.forEach(x=>rows.push(`<article class="history-row"><b>🎧 Accessories</b><small>${esc(formatDateTime(x))}</small><span>${esc(x.name||"")} • SN ${esc(x.sn||"—")} • Profit ₹${Number(x.profit??(Number(x.salePrice||0)-Number(x.price||0))).toLocaleString("en-IN")}</span></article>`));
    $("customerDetailBody").innerHTML=`<div class="detail-grid">${detailItem("Customer",title)}${detailItem("Phone",p||finance[0]?.phone||repair[0]?.phone||second[0]?.phone||acc[0]?.customerPhone||"—")}${detailItem("Finance Records",finance.length)}${detailItem("Repairing Records",repair.length)}${detailItem("Second Hand Records",second.length)}${detailItem("Accessories Records",acc.length)}</div><div class="history-list">${rows.join("")||'<div class="empty">इस customer का कोई history record नहीं मिला.</div>'}</div>`;$("customerDetailModal")?.classList.remove("hidden");
}

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
    const arr=repairing.filter(r=>!s||[r.customerName,r.phone,r.device,r.problem,r.repairBy,r.total,r.partsPrice,r.profit,r.payment,formatDateTime(r)].join(" ").toLowerCase().includes(s));
    if(!arr.length){box.innerHTML=`<div class="empty">${s?"No repairing record found.":"No repairing records yet."}</div>`;return}
    box.innerHTML=arr.map(r=>`<article class="result">
      <div class="result-name">${esc(r.customerName||"")}</div><div class="result-meta">${esc(r.phone||"")} • ${esc(formatDateTime(r))}</div>
      <div class="result-grid">${item("Brand / Model",r.device)}${item("Problem",r.problem)}${item("Repairing By",r.repairBy)}${item("Total",`₹${Number(r.total??r.payment??0).toLocaleString("en-IN")}`)}${item("Parts Price",`₹${Number(r.partsPrice||0).toLocaleString("en-IN")}`)}${item("Profit",`₹${Number(r.profit??(Number(r.total??r.payment??0)-Number(r.partsPrice||0))).toLocaleString("en-IN")}`)}</div>
    </article>`).join("");
    box.querySelectorAll(".repair-delete-btn").forEach(btn=>btn.onclick=async e=>{e.stopPropagation();const r=repairing.find(x=>x.id===btn.dataset.repairId);if(!r||!confirm(`Delete ${r.customerName||"this customer"} repairing record?`))return;try{await deleteWithRecycle(REPAIR_COL,r.id,r);await audit("customer_delete",{section:"Kabir Repairing Data",customerId:r.id,customerName:r.customerName,description:`Repairing customer ${r.customerName||r.id} moved to Recently Deleted`});renderRepairing();renderAllCustomers();showSuccessToast("Deleted","Repairing record moved to Recently Deleted");}catch(err){console.error(err);alert("Delete failed. Firebase Rules check करें.");}});
}
async function saveRepair(e){
    e.preventDefault();
    if(enforceWriteLock("repairMessage"))return;
    const ids=["repairCustomerName","repairPhone","repairDevice","repairProblem","repairBy","repairTotal","repairPartsPrice"];
    for(const id of ids)if(!val(id)){ $(id)?.focus();msg("repairMessage","सभी fields भरना जरूरी है.");return }
    const phone=val("repairPhone").replace(/\D/g,"");
    if(!/^\d{10}$/.test(phone)){msg("repairMessage","10 digit customer phone number डालें.");return}

    const total=Number(val("repairTotal")||0);
    const partsPrice=Number(val("repairPartsPrice")||0);
    const profit=total-partsPrice;

    const saveBtn = $("repairForm")?.querySelector("button[type='submit']");
    if(saveBtn) saveBtn.disabled=true;

    try{
        const repairRef=await addDoc(collection(db,REPAIR_COL),{
            customerName:val("repairCustomerName"),
            phone,
            device:val("repairDevice"),
            problem:val("repairProblem"),
            repairBy:val("repairBy"),
            total,
            partsPrice,
            profit,
            createdAt:serverTimestamp(),
            createdBy:user?.uid||null
        });
        await audit("repairing_add",{section:"Kabir Repairing Data",customerId:repairRef.id,customerName:val("repairCustomerName"),description:`Repairing added: ${val("repairProblem")||"Problem"}`,extra:{phone,device:val("repairDevice"),problem:val("repairProblem"),total,partsPrice,profit}});

        $("repairForm").reset();
        updateRepairProfit();
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
      "Brand / Model":r.device||"","Problem":r.problem||"","Repairing By":r.repairBy||"","Total":r.total??r.payment??0,"Parts Price":r.partsPrice||0,"Profit":r.profit??(Number(r.total??r.payment??0)-Number(r.partsPrice||0))})),
      "Kabir_Repairing_Data.xlsx","Repairing");
}
/* =========================================================
   PREMIUM PDF EXPORT — SECTION SELECTOR + FULL TABLES
========================================================= */

let pdfFontReady=false;
async function ensurePdfFont(pdf){
    if(pdfFontReady){pdf.setFont("NotoSans","normal");return true;}
    try{
        const url="https://cdn.jsdelivr.net/npm/@fontsource/noto-sans@5.2.5/files/noto-sans-latin-400-normal.ttf";
        const res=await fetch(url,{mode:"cors",cache:"force-cache"});
        if(!res.ok)throw Error("PDF font unavailable");
        const buf=await res.arrayBuffer();
        let binary="",bytes=new Uint8Array(buf);
        const chunk=0x8000;
        for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,i+chunk));
        pdf.addFileToVFS("NotoSans-Regular.ttf",btoa(binary));
        pdf.addFont("NotoSans-Regular.ttf","NotoSans","normal");
        pdf.setFont("NotoSans","normal");
        pdfFontReady=true;
        return true;
    }catch(e){
        console.warn("Unicode PDF font unavailable:",e);
        return false;
    }
}
function pdfSafe(v){
    if(v===null||v===undefined||v==="")return "—";
    return String(v);
}
function pdfMoney(v){
    const n=Number(v||0);
    return `₹${Number.isFinite(n)?n.toLocaleString("en-IN"):0}`;
}
function pdfDate(v){return formatDateTime(v)||"—";}
function pdfRowsFromObject(rows,fields){
    return rows.map(row=>fields.map(([key,label,fn])=>fn?fn(row):pdfSafe(row[key])));
}
function pdfDrawTable(pdf,title,headers,rows){
    const pageW=297,pageH=210,margin=10;
    const usableW=pageW-margin*2;
    const colW=usableW/headers.length;
    let y=29;
    const lineH=3.8, padX=2.2, padY=2.4, headH=10;
    const drawHeader=()=>{
        pdf.setFillColor(28,31,40);
        pdf.rect(margin,y,usableW,headH,"F");
        pdf.setTextColor(255,255,255);
        pdf.setFont("NotoSans","normal");pdf.setFontSize(7.2);
        headers.forEach((h,i)=>pdf.text(pdfSafe(h),margin+i*colW+padX,y+6.5,{maxWidth:colW-padX*2}));
        pdf.setTextColor(20,20,24);
        y+=headH;
    };
    const newPage=()=>{
        pdf.addPage("a4","landscape");
        y=12;
        pdf.setFontSize(17);pdf.setFont("NotoSans","normal");pdf.text(title,margin,y);y+=7;
        pdf.setFontSize(7);pdf.text(`Generated: ${new Date().toLocaleString("en-IN")}`,margin,y);y+=6;
        drawHeader();
    };
    pdf.setFontSize(17);pdf.setFont("NotoSans","normal");pdf.text(title,margin,14);
    pdf.setFontSize(7);pdf.text(`Generated: ${new Date().toLocaleString("en-IN")}`,margin,20);
    drawHeader();
    rows.forEach((row,ri)=>{
        pdf.setFontSize(6.6);pdf.setFont("NotoSans","normal");
        const lines=row.map(v=>pdf.splitTextToSize(pdfSafe(v),Math.max(10,colW-padX*2)));
        const maxLines=Math.max(1,...lines.map(a=>a.length));
        const rowH=Math.max(8,maxLines*lineH+padY*2);
        if(y+rowH>pageH-10)newPage();
        pdf.setDrawColor(205,208,215);pdf.setFillColor(248,249,251);
        if(ri%2===1)pdf.setFillColor(240,242,246);
        pdf.rect(margin,y,usableW,rowH,"FD");
        lines.forEach((arr,i)=>{
            pdf.text(arr,margin+i*colW+padX,y+padY+3,{maxWidth:colW-padX*2});
        });
        for(let i=0;i<=headers.length;i++)pdf.line(margin+i*colW,y,margin+i*colW,y+rowH);
        y+=rowH;
    });
    return pdf;
}

function pdfRecordDate(row){
    const v=row?.createdAt;
    const d=v?.toDate?.() || (v instanceof Date?v:(v?new Date(v):null));
    return d&&!Number.isNaN(d.getTime())?d:null;
}
function pdfDateInputValue(row){
    const d=pdfRecordDate(row);
    if(!d)return "";
    const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${day}`;
}
function filterPdfRowsByDate(rows,from,to){
    if(!from&&!to)return rows;
    const fromD=from?new Date(`${from}T00:00:00`):null;
    const toD=to?new Date(`${to}T23:59:59.999`):null;
    return rows.filter(r=>{const d=pdfRecordDate(r);if(!d)return false;return (!fromD||d>=fromD)&&(!toD||d<=toD);});
}
async function buildSelectedPdf(section,fromDate="",toDate=""){
    try{
        if(fromDate&&toDate&&fromDate>toDate){alert("From date, To date से पहले नहीं हो सकती।");return;}
        if(!window.jspdf)await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
        const {jsPDF}=window.jspdf;
        const pdf=new jsPDF({orientation:"landscape",unit:"mm",format:"a4"});
        await ensurePdfFont(pdf);

        let title="",headers=[],rows=[],file="";
        const financeData=filterPdfRowsByDate(customers,fromDate,toDate);
        const repairingData=filterPdfRowsByDate(repairing,fromDate,toDate);
        const secondHandData=filterPdfRowsByDate(secondHand,fromDate,toDate);
        const accessoriesData=filterPdfRowsByDate(accessories,fromDate,toDate);
        if(section==="finance"){
            title="KABIR MOBILE DATA — FINANCE";
            headers=["Customer Code","Date & Time","Customer Name","Phone","Address","PIN","City","State","Brand","Model","IMEI","Colour","Storage","Finance Company","Phone Amount","Down Payment","EMI Amount","EMI Months","Lock","Stock","Counter","Financer","Bill"];
            rows=pdfRowsFromObject(financeData,[
                ["customerCode"],["createdAt","",pdfDate],["customerName"],["phone"],["address"],["pincode"],["city"],["state"],["brand"],["model"],["imei"],["colour"],["storage"],["financeCompany"],
                ["phoneAmount","",x=>pdfMoney(x.phoneAmount)],["downPayment","",x=>pdfMoney(x.downPayment)],["emiAmount","",x=>pdfMoney(x.emiAmount)],["emiMonths"],["lockName"],["stock"],["counter"],["financerName"],["billYes","",x=>x.billYes?"YES":"NO"]
            ]);
            file="Kabir_Finance_Data.pdf";
        }else if(section==="repairing"){
            title="KABIR MOBILE DATA — REPAIRING";
            headers=["Date & Time","Customer Name","Phone","Brand / Model","Problem","Repairing By","Total","Parts Price","Profit"];
            rows=pdfRowsFromObject(repairingData,[["createdAt","",pdfDate],["customerName"],["phone"],["device"],["problem"],["repairBy"],["total","",x=>pdfMoney(x.total??x.payment)],["partsPrice","",x=>pdfMoney(x.partsPrice)],["profit","",x=>pdfMoney(x.profit??(Number(x.total ?? x.payment ?? 0)-Number(x.partsPrice||0)))]]);
            file="Kabir_Repairing_Data.pdf";
        }else if(section==="secondHand"){
            title="KABIR MOBILE DATA — SECOND HAND";
            headers=["Date & Time","Condition","Customer Name","Phone","Brand","Model","IMEI","Purchase Price","Sell Price","Profit"];
            rows=pdfRowsFromObject(secondHandData,[["createdAt","",pdfDate],["condition"],["customerName"],["phone"],["brand"],["model","",x=>x.model||x.device],["imei"],["price","",x=>pdfMoney(x.price)],["salePrice","",x=>pdfMoney(x.salePrice)],["profit","",x=>pdfMoney(x.profit??(Number(x.salePrice||0)-Number(x.price||0)))]]);
            file="Kabir_Second_Hand_Data.pdf";
        }else if(section==="accessories"){
            title="KABIR MOBILE DATA — ACCESSORIES";
            headers=["Date & Time","Name","Category","SN","Qty","Customer Name","Customer Phone","Purchase","Sell","Profit"];
            rows=pdfRowsFromObject(accessoriesData,[["createdAt","",pdfDate],["name"],["category"],["sn"],["quantity"],["customerName"],["customerPhone"],["price","",x=>pdfMoney(x.price)],["salePrice","",x=>pdfMoney(x.salePrice)],["profit","",x=>pdfMoney(x.profit??(Number(x.salePrice||0)-Number(x.price||0)))]]);
            file="Kabir_Accessories_Data.pdf";
        }else if(section==="customers"){
            title="KABIR MOBILE DATA — CUSTOMERS";
            const map=new Map();
            const add=(name,phone,type)=>{
                const n=String(name||"").trim(),p=String(phone||"").replace(/\D/g,"");if(!n&&!p)return;
                const key=p||n.toLowerCase();
                if(!map.has(key))map.set(key,{name:n||"Customer",phone:p,types:new Set()});
                map.get(key).types.add(type);
            };
            financeData.forEach(x=>add(x.customerName,x.phone,"Finance"));
            repairingData.forEach(x=>add(x.customerName,x.phone,"Repairing"));
            secondHandData.forEach(x=>add(x.customerName,x.phone,"Second Hand"));
            accessoriesData.forEach(x=>add(x.customerName,x.customerPhone,"Accessories"));
            const list=[...map.values()];
            title="KABIR MOBILE DATA — CUSTOMERS";
            headers=["Section","Date & Time","Customer Name","Phone","Code / Identifier","Device / Item","IMEI / SN","Amount / Price","Profit"];
            const financeRows=financeData.map(x=>["Finance",pdfDate(x.createdAt),x.customerName,x.phone,x.customerCode,`${x.brand||""} ${x.model||""}`.trim(),x.imei,pdfMoney(x.phoneAmount),"—"]);
            const repairRows=repairingData.map(x=>["Repairing",pdfDate(x.createdAt),x.customerName,x.phone,"—",x.device,x.phone?x.phone:"—",pdfMoney(x.total??x.payment),pdfMoney(x.profit??(Number(x.total ?? x.payment ?? 0)-Number(x.partsPrice||0)))]);
            const secondRows=secondHandData.map(x=>["Second Hand",pdfDate(x.createdAt),x.customerName,x.phone,"—",`${x.brand||""} ${x.model||x.device||""}`.trim(),x.imei,pdfMoney(x.salePrice||x.price),pdfMoney(x.profit??(Number(x.salePrice||0)-Number(x.price||0)))]);
            const accRows=accessoriesData.map(x=>["Accessories",pdfDate(x.createdAt),x.customerName||"—",x.customerPhone||"—","—",x.name,x.sn,pdfMoney(x.salePrice||x.price),pdfMoney(x.profit??(Number(x.salePrice||0)-Number(x.price||0)))]);
            rows=[...financeRows,...repairRows,...secondRows,...accRows];
            file="Kabir_Customers_Data.pdf";
        }else return;

        await audit("pdf_download",{section:`PDF ${section}`,description:`Premium ${section} PDF downloaded`,extra:{records:rows.length,fromDate:fromDate||null,toDate:toDate||null}});
        pdfDrawTable(pdf,title,headers,rows);
        pdf.save(file);
        $("pdfSelectModal")?.classList.add("hidden");
        showSuccessToast("PDF Ready",`${title.replace("KABIR MOBILE DATA — ","")} PDF downloaded`);
    }catch(e){
        console.error(e);
        alert("PDF नहीं बन पाया. कृपया internet/Firebase connection check करें.");
    }
}
function downloadFullPdf(){
    $("pdfSelectModal")?.classList.remove("hidden");
    const from=$("pdfFromDate"),to=$("pdfToDate");
    if(from&&!from.value)from.value="";
    if(to&&!to.value)to.value="";
}
function runPdfWithSelectedDate(section){
    const from=$("pdfFromDate")?.value||"",to=$("pdfToDate")?.value||"";
    buildSelectedPdf(section,from,to);
}

/* =========================================================
   KABIR DATA — ADVANCED SMART SEARCH / AI-LIKE QUERY ENGINE
   Understands the 290 Hindi / Hinglish / English examples
   without changing Firebase data or existing UI.
   ========================================================= */

function normalizeText(x){
    return String(x??"")
        .toLowerCase()
        .normalize("NFKC")
        .replace(/[’'`]/g,"")
        .replace(/[^\p{L}\p{N}₹]+/gu," ")
        .trim();
}

function searchTokens(x){
    return normalizeText(x).split(/\s+/).filter(Boolean);
}

function dataDate(row){
    const d = row?.createdAt?.toDate?.()
        || (row?.createdAt instanceof Date ? row.createdAt : null)
        || (row?.clientTime ? new Date(row.clientTime) : null)
        || (row?.date ? new Date(row.date) : null)
        || (row?.createdDate ? new Date(row.createdDate) : null);
    return d && !Number.isNaN(d.getTime()) ? d : null;
}

function dayKey(d){
    return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("en-CA") : "";
}

function startOfDay(d=new Date()){
    const x=new Date(d); x.setHours(0,0,0,0); return x;
}
function endOfDay(d=new Date()){
    const x=new Date(d); x.setHours(23,59,59,999); return x;
}
function startOfMonth(d=new Date()){
    const x=new Date(d.getFullYear(),d.getMonth(),1); return x;
}
function endOfMonth(d=new Date()){
    const x=new Date(d.getFullYear(),d.getMonth()+1,0,23,59,59,999); return x;
}
function startOfYear(d=new Date()){
    return new Date(d.getFullYear(),0,1);
}
function endOfYear(d=new Date()){
    return new Date(d.getFullYear(),11,31,23,59,59,999);
}
function startOfWeek(d=new Date()){
    const x=startOfDay(d), day=x.getDay();
    x.setDate(x.getDate()-(day===0?6:day-1));
    return x;
}
function endOfWeek(d=new Date()){
    const x=startOfWeek(d); x.setDate(x.getDate()+6); x.setHours(23,59,59,999); return x;
}

const KABIR_MONTHS={
    january:0,february:1,march:2,april:3,may:4,june:5,july:6,august:7,september:8,october:9,november:10,december:11,
    jan:0,feb:1,mar:2,apr:3,jun:5,jul:6,aug:7,sep:8,sept:8,oct:9,nov:10,dec:11,
    जनवरी:0,फरवरी:1,मार्च:2,अप्रैल:3,मई:4,जून:5,जुलाई:6,अगस्त:7,सितंबर:8,सितम्बर:8,अक्टूबर:9,नवंबर:10,दिसंबर:11
};

function parseDMY(s){
    const m=String(s||"").match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if(!m)return null;
    let y=Number(m[3]); if(y<100)y+=2000;
    const d=new Date(y,Number(m[2])-1,Number(m[1]));
    return Number.isNaN(d.getTime())?null:d;
}

function smartDateRange(q){
    const n=normalizeText(q), now=new Date();

    /* Explicit range: 01/08/2026 se 20/08/2026 / from ... to ... */
    const dates=[...n.matchAll(/\b(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})\b/g)]
        .map(m=>parseDMY(m[1])).filter(Boolean);
    if(dates.length>=2) return {from:startOfDay(dates[0]),to:endOfDay(dates[1]),label:`${dates[0].toLocaleDateString("en-IN")} से ${dates[1].toLocaleDateString("en-IN")}`};
    if(dates.length===1) return {from:startOfDay(dates[0]),to:endOfDay(dates[0]),label:dates[0].toLocaleDateString("en-IN")};

    const monthMatch=n.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec|जनवरी|फरवरी|मार्च|अप्रैल|मई|जून|जुलाई|अगस्त|सितंबर|सितम्बर|अक्टूबर|नवंबर|दिसंबर)\b/);
    if(monthMatch){
        let mi=KABIR_MONTHS[monthMatch[1]], year=now.getFullYear();
        const ym=n.match(new RegExp(monthMatch[1]+String.raw`\s*(20\d{2})`,"i"));
        if(ym)year=Number(ym[1]);
        const from=new Date(year,mi,1),to=new Date(year,mi+1,0,23,59,59,999);
        return {from,to,label:from.toLocaleString("en-IN",{month:"long",year:"numeric"})};
    }

    if(/\b(today|aaj|आज|आजका|आजकी)\b/i.test(q)) return {from:startOfDay(now),to:endOfDay(now),label:"आज"};
    if(/\b(yesterday|kal|कल|yesterday ka)\b/i.test(q) && !/\btomorrow\b/i.test(q)){
        const d=new Date(now); d.setDate(d.getDate()-1);
        return {from:startOfDay(d),to:endOfDay(d),label:"कल"};
    }
    if(/\b(day before yesterday|parso|परसों)\b/i.test(q)){
        const d=new Date(now); d.setDate(d.getDate()-2);
        return {from:startOfDay(d),to:endOfDay(d),label:"परसों"};
    }
    if(/\b(last|pichhle|pichla|पिछले|पिछला)\s*(7|seven|सात)\s*(days|din|दिन)\b/i.test(q))
        {const from=new Date(now);from.setDate(from.getDate()-6);return {from:startOfDay(from),to:endOfDay(now),label:"पिछले 7 दिन"};}
    if(/\b(last|pichhle|पिछले)\s*(30|thirty|तीस)\s*(days|din|दिन)\b/i.test(q))
        {const from=new Date(now);from.setDate(from.getDate()-29);return {from:startOfDay(from),to:endOfDay(now),label:"पिछले 30 दिन"};}
    if(/\b(this|current|is|इस)\s*(week|hafte|हफ्ते|सप्ताह)\b/i.test(q))
        return {from:startOfWeek(now),to:endOfWeek(now),label:"इस हफ्ते"};
    if(/\b(this|current|is|इस)\s*(month|mahina|महीने)\b/i.test(q))
        return {from:startOfMonth(now),to:endOfMonth(now),label:"इस महीने"};
    if(/\b(last|previous|pichhle|पिछले)\s*(month|mahine|महीने)\b/i.test(q)){
        const d=new Date(now.getFullYear(),now.getMonth()-1,1);
        return {from:startOfMonth(d),to:endOfMonth(d),label:"पिछले महीने"};
    }
    if(/\b(this|current|is|इस)\s*(year|saal|साल)\b/i.test(q))
        return {from:startOfYear(now),to:endOfYear(now),label:"इस साल"};
    if(/\b(last|previous|pichhle|पिछले)\s*(year|saal|साल)\b/i.test(q)){
        const y=now.getFullYear()-1,d=new Date(y,0,1);
        return {from:startOfYear(d),to:endOfYear(d),label:"पिछले साल"};
    }
    return null;
}

function rowInRange(row,range){
    if(!range)return true;
    const d=dataDate(row); return !!d && d>=range.from && d<=range.to;
}

function allDataRows(){
    return [
        ...customers.map(x=>({...x,__section:"Finance"})),
        ...repairing.map(x=>({...x,__section:"Repairing"})),
        ...secondHand.map(x=>({...x,__section:"Second Hand"})),
        ...accessories.map(x=>({...x,__section:"Accessories"}))
    ];
}

function smartAnswerLanguage(q){
    const n=normalizeText(q);
    if(/[\u0900-\u097f]/.test(q))return "hi";
    if(/\b(kya|kitne|kitni|kitna|kaun|dikhao|batao|btao|aaj|kal|naam|grahak|customer|data|hisab|kam|kaam|hua|hue|hain|hai|profit|munafa|paisa|rupaye|rupees)\b/i.test(n))return "hinglish";
    return "en";
}

function smartSay(lang,hi,hinglish,en){
    return lang==="hi"?hi:(lang==="hinglish"?hinglish:en);
}

function rupees(n){
    return `₹${Number(n||0).toLocaleString("en-IN")}`;
}

function num(v){return Number(v||0);}
function repairProfit(x){return num(x.profit??(num(x.total??x.payment)-num(x.partsPrice)));}
function secondProfit(x){return num(x.profit??(num(x.salePrice)-num(x.price)));}
function accessoryProfit(x){return num(x.profit??(num(x.salePrice)-num(x.price)));}

function rowSearchText(x){
    return normalizeText([
        x.customerName,x.customerCode,x.phone,x.customerPhone,x.imei,x.brand,x.model,x.device,
        x.problem,x.repairBy,x.name,x.category,x.sn,x.financeCompany,x.lockName,x.stock,x.counter,
        x.financerName,x.condition,x.colour,x.storage,x.pincode,x.city,x.state,x.__section,
        formatDateTime(x)
    ].join(" "));
}

function sectionOfQuery(q){
    const n=normalizeText(q);
    if(/\b(finance|financed|finance company|emi|down payment|downpayment|फाइनेंस|ईएमआई|डाउन पेमेंट)\b/i.test(n))return "Finance";
    if(/\b(repair|repairing|repairing data|repaired|repair|रिपेयर|रिपेयरिंग)\b/i.test(n))return "Repairing";
    if(/\b(second hand|secondhand|used phone|used mobile|सेकंड हैंड|पुराना फोन)\b/i.test(n))return "Second Hand";
    if(/\b(accessor|accessories|accessory|सामान|एक्सेसरी)\b/i.test(n))return "Accessories";
    return null;
}

function metricOfQuery(q){
    const n=normalizeText(q);
    if(/\b(profit|profit hua|munafa|मुनाफा|फायदा|कमाई|कमाया|earning|earnings)\b/i.test(n))return "profit";
    if(/\b(sale|sales|bikri|बिक्री|बेचा|sold|sell|revenue|business hua|business)\b/i.test(n))return "sale";
    if(/\b(down payment|downpayment|dp|डाउन पेमेंट)\b/i.test(n))return "downPayment";
    if(/\b(emi|ईएमआई)\b/i.test(n))return "emi";
    if(/\b(parts price|parts|part cost|पार्ट्स|पार्ट)\b/i.test(n))return "parts";
    if(/\b(quantity|qty|stock|quantity|कितना stock|स्टॉक)\b/i.test(n))return "quantity";
    if(/\b(phone amount|phone price|amount|राशि|कीमत|price|दाम)\b/i.test(n))return "amount";
    return "count";
}

function rowsForSection(section){
    if(section==="Finance")return customers.map(x=>({...x,__section:"Finance"}));
    if(section==="Repairing")return repairing.map(x=>({...x,__section:"Repairing"}));
    if(section==="Second Hand")return secondHand.map(x=>({...x,__section:"Second Hand"}));
    if(section==="Accessories")return accessories.map(x=>({...x,__section:"Accessories"}));
    return allDataRows();
}

function metricValue(row,metric,section){
    if(metric==="profit"){
        if(section==="Repairing")return repairProfit(row);
        if(section==="Second Hand")return secondProfit(row);
        if(section==="Accessories")return accessoryProfit(row);
        return num(row.profit); /* Finance has no standard profit field. */
    }
    if(metric==="sale"){
        if(section==="Finance")return num(row.phoneAmount);
        if(section==="Repairing")return num(row.total??row.payment);
        if(section==="Second Hand")return num(row.salePrice);
        if(section==="Accessories")return num(row.salePrice);
    }
    if(metric==="downPayment")return num(row.downPayment);
    if(metric==="emi")return num(row.emiAmount);
    if(metric==="parts")return num(row.partsPrice);
    if(metric==="quantity")return num(row.quantity);
    if(metric==="amount"){
        return section==="Finance"?num(row.phoneAmount):
            section==="Repairing"?num(row.total??row.payment):
            section==="Second Hand"?num(row.salePrice):
            num(row.salePrice);
    }
    return 1;
}

function countBy(rows,pred){return rows.filter(pred).length;}

function uniqueCustomers(rows){
    const m=new Map();
    rows.forEach(x=>{
        const p=String(x.phone||x.customerPhone||"").replace(/\D/g,"");
        const name=String(x.customerName||x.name||"").trim();
        const key=p||normalizeText(name);
        if(!key)return;
        if(!m.has(key))m.set(key,{name:name||"Customer",phone:p});
    });
    return [...m.values()];
}

function detectEntityQuery(q){
    const n=normalizeText(q);
    const phone=(String(q).match(/\b\d{10}\b/)||[])[0]||"";
    const imei=(String(q).match(/\b\d{14,16}\b/)||[])[0]||"";
    const code=(String(q).match(/\bkm\d{3,8}\b/i)||[])[0]||"";
    return {phone,imei,code,n};
}

function entityRows(rows,q){
    const e=detectEntityQuery(q),n=normalizeText(q);
    let out=rows;
    if(e.phone) out=out.filter(x=>String(x.phone||x.customerPhone||"").replace(/\D/g,"")===e.phone);
    else if(e.imei) out=out.filter(x=>String(x.imei||"").replace(/\D/g,"")===e.imei);
    else if(e.code) out=out.filter(x=>normalizeText(x.customerCode)===normalizeText(e.code));
    else{
        /* Remove generic query words and look for meaningful person/model terms. */
        const stop=/\b(today|aaj|kal|parso|total|kitne|kitni|kitna|how|many|what|show|give|tell|me|the|all|data|record|records|history|complete|full|pura|puri|dikhao|batao|hisab|ka|ki|ke|hai|hain|customer|customers|grahak|finance|repair|repairing|second|hand|accessories|accessory|profit|munafa|sale|sales|work|kam|kaam|hua|hue|huye|month|month|week|year|today|कल|आज|ग्राहक|डेटा|दिखाओ|बताओ|हिसाब|मुनाफा|बिक्री)\b/gi;
        const words=n.replace(stop," ").split(/\s+/).filter(w=>w.length>=2);
        if(words.length){
            out=out.filter(x=>{
                const text=rowSearchText(x);
                return words.some(w=>text.includes(w));
            });
        }
    }
    return out;
}

function renderSmartRows(rows){
    return rows.slice(0,80).map(x=>{
        const section=x.__section||"";
        const amount=section==="Finance"?x.phoneAmount:
            section==="Repairing"?x.total??x.payment:
            section==="Second Hand"?x.salePrice:
            section==="Accessories"?x.salePrice:null;
        const profit=section==="Repairing"?repairProfit(x):
            section==="Second Hand"?secondProfit(x):
            section==="Accessories"?accessoryProfit(x):null;
        return `<article class="result">
            <div class="result-name">${esc(x.customerName||x.name||x.device||"Record")}</div>
            <div class="result-meta">${esc(section)} • ${esc(x.phone||x.customerPhone||"")} • ${esc(formatDateTime(x))}</div>
            <div class="result-grid">
                ${item("Device",x.device||`${x.brand||""} ${x.model||""}`)}
                ${item("IMEI / SN",x.imei||x.sn||"—")}
                ${item("Amount",amount!=null?rupees(amount):"—")}
                ${item("Profit",profit!=null?rupees(profit):"—")}
                ${item("Customer",x.customerName||x.name||"—")}
            </div>
        </article>`;
    }).join("");
}

function smartSummaryForRange(range,section){
    const rows=rowsForSection(section).filter(x=>rowInRange(x,range));
    const finance=rows.filter(x=>x.__section==="Finance").length;
    const repair=rows.filter(x=>x.__section==="Repairing").length;
    const second=rows.filter(x=>x.__section==="Second Hand").length;
    const acc=rows.filter(x=>x.__section==="Accessories").length;
    const profit=rows.reduce((s,x)=>{
        if(x.__section==="Repairing")return s+repairProfit(x);
        if(x.__section==="Second Hand")return s+secondProfit(x);
        if(x.__section==="Accessories")return s+accessoryProfit(x);
        return s;
    },0);
    const sale=rows.reduce((s,x)=>s+metricValue(x,"sale",x.__section),0);
    return {rows,finance,repair,second,acc,profit,sale,customers:uniqueCustomers(rows).length};
}

function smartSearch(){
    const q=val("universalSearchInput");
    const a=$("smartSearchAnswer"),r=$("smartSearchResults");
    if(!a||!r)return;
    const n=normalizeText(q);

    if(!n){
        a.innerHTML='<div class="empty">आप Hindi, Hinglish या English में कोई भी business question पूछ सकते हैं — जैसे “आज का पूरा हिसाब बताओ”, “this month profit”, “Aman ki full history”, “which technician did most repairs?”</div>';
        r.innerHTML="";
        return;
    }

    const lang=smartAnswerLanguage(q);
    const section=sectionOfQuery(q);
    const range=smartDateRange(q);
    let rows=rowsForSection(section);
    let answer="";
    let filtered=[];
    let metric=metricOfQuery(q);
    const nrm=normalizeText(q);

    /* ---------- Comparison ---------- */
    const compareTodayYesterday=/\b(compare|comparison|difference|farak|अंतर|difference batao|better|बेहतर|kal se|कल से)\b/i.test(nrm)
        && /\b(today|aaj|आज)\b/i.test(nrm)
        && /\b(yesterday|kal|कल)\b/i.test(nrm);

    if(compareTodayYesterday){
        const now=new Date(), yd=new Date(now); yd.setDate(yd.getDate()-1);
        const tr=smartSummaryForRange({from:startOfDay(now),to:endOfDay(now)},section);
        const yr=smartSummaryForRange({from:startOfDay(yd),to:endOfDay(yd)},section);
        const diffProfit=tr.profit-yr.profit, diffSale=tr.sale-yr.sale, diffCount=tr.rows.length-yr.rows.length;
        answer=smartSay(lang,
            `आज ${tr.rows.length} काम/records हुए और ${rupees(tr.profit)} profit हुआ। कल ${yr.rows.length} records और ${rupees(yr.profit)} profit था। Profit में ${rupees(Math.abs(diffProfit))} ${diffProfit>=0?"ज्यादा":"कम"} है।`,
            `Aaj ${tr.rows.length} kaam/records hue aur ${rupees(tr.profit)} profit hua. Kal ${yr.rows.length} records aur ${rupees(yr.profit)} profit tha. Profit ${rupees(Math.abs(diffProfit))} ${diffProfit>=0?"zyada":"kam"} hai.`,
            `Today had ${tr.rows.length} records and ${rupees(tr.profit)} profit. Yesterday had ${yr.rows.length} records and ${rupees(yr.profit)} profit. Profit is ${rupees(Math.abs(diffProfit))} ${diffProfit>=0?"higher":"lower"}.`
        );
        r.innerHTML=renderSmartRows(tr.rows);
    }

    /* ---------- Complete activity / report ---------- */
    else if(/\b(what happened|kya kya|क्या क्या|pura hisab|पूरा हिसाब|complete report|full report|business summary|summary|daily report|आज का हिसाब|आज की report|today.*work|aaj.*kam|aaj.*kaam)\b/i.test(nrm)
        || (range && metric==="count" && !section && /\b(work|kaam|काम|activity|business)\b/i.test(nrm))){
        const rr=range||{from:startOfDay(),to:endOfDay()};
        const s=smartSummaryForRange(rr,section);
        const period=rr.label||"इस अवधि";
        answer=smartSay(lang,
            `${period} में कुल ${s.rows.length} काम/records हुए। Finance ${s.finance}, Repairing ${s.repair}, Second Hand ${s.second}, Accessories ${s.acc}। कुल ज्ञात profit ${rupees(s.profit)} और sale/collection ${rupees(s.sale)} है।`,
            `${period} mein total ${s.rows.length} kaam/records hue. Finance ${s.finance}, Repairing ${s.repair}, Second Hand ${s.second}, Accessories ${s.acc}. Total known profit ${rupees(s.profit)} aur sale/collection ${rupees(s.sale)} hai.`,
            `${period}: ${s.rows.length} total records — Finance ${s.finance}, Repairing ${s.repair}, Second Hand ${s.second}, Accessories ${s.acc}. Known profit ${rupees(s.profit)} and sale/collection ${rupees(s.sale)}.`
        );
        filtered=s.rows;
    }

    /* ---------- Count questions ---------- */
    else if(metric==="count" && /\b(total|how many|count|kitne|kitni|kitna|कितने|कितनी|कितना|number|कुल)\b/i.test(nrm)){
        const rr=range;
        const source=rows.filter(x=>rowInRange(x,rr));
        let count=source.length;
        let label=section||"काम";
        if(section==="Finance" && /\bcustomer|ग्राहक\b/i.test(nrm))count=uniqueCustomers(source).length;
        if(!section && /\bcustomer|customers|ग्राहक\b/i.test(nrm)){count=uniqueCustomers(rr?allDataRows().filter(x=>rowInRange(x,rr)):customers);label="customers";}
        answer=smartSay(lang,
            `${range?.label||"कुल"} ${label} ${count} हैं।`,
            `${range?.label||"Total"} ${label} ${count} hain.`,
            `${range?.label||"Total"} ${label}: ${count}.`
        );
        filtered=source;
    }

    /* ---------- Profit questions ---------- */
    else if(metric==="profit"){
        const rr=range;
        const source=rows.filter(x=>rowInRange(x,rr));
        if(section==="Finance"){
            answer=smartSay(lang,
                `Finance records में अलग profit field उपलब्ध नहीं है, इसलिए Finance का profit अभी calculate नहीं किया जा सकता। Finance sale/phone amount ${rupees(source.reduce((s,x)=>s+num(x.phoneAmount),0))} है।`,
                `Finance records mein separate profit field nahi hai, isliye Finance profit abhi calculate nahi ho sakta. Finance sale/phone amount ${rupees(source.reduce((s,x)=>s+num(x.phoneAmount),0))} hai.`,
                `Finance records do not have a standard profit field. Finance phone/sale amount is ${rupees(source.reduce((s,x)=>s+num(x.phoneAmount),0))}.`
            );
        }else{
            const p=source.reduce((sum,x)=>sum+metricValue(x,"profit",x.__section),0);
            answer=smartSay(lang,
                `${range?.label||"कुल"} ${section?section+" का ":""}profit ${rupees(p)} है।`,
                `${range?.label||"Total"} ${section?section+" ka ":""}profit ${rupees(p)} hai.`,
                `${range?.label||"Total"} ${section?section+" ":""}profit is ${rupees(p)}.`
            );
        }
        filtered=source;
    }

    /* ---------- Sale / amount / money questions ---------- */
    else if(["sale","downPayment","emi","parts","quantity","amount"].includes(metric)){
        const rr=range, source=rows.filter(x=>rowInRange(x,rr));
        const total=source.reduce((s,x)=>s+metricValue(x,metric,x.__section),0);
        const labels={sale:"sale/collection",downPayment:"down payment",emi:"EMI amount",parts:"parts cost",quantity:"quantity/stock",amount:"amount"};
        answer=smartSay(lang,
            `${range?.label||"कुल"} ${section?section+" की ":""}${labels[metric]} ${metric==="quantity"?total:rupees(total)} है।`,
            `${range?.label||"Total"} ${section?section+" ki ":""}${labels[metric]} ${metric==="quantity"?total:rupees(total)} hai.`,
            `${range?.label||"Total"} ${section?section+" ":""}${labels[metric]}: ${metric==="quantity"?total:rupees(total)}.`
        );
        filtered=source;
    }

    /* ---------- Top / most questions ---------- */
    else if(/\b(most|maximum|highest|top|sabse zyada|सबसे ज्यादा|सबसे अधिक|कम|lowest|least|sabse kam|सबसे कम)\b/i.test(nrm)){
        const source=rows.filter(x=>rowInRange(x,range));
        let field=null,label="";
        if(/\btechnician|repairing by|repair by|technician ne|technician ने\b/i.test(nrm)){field="repairBy";label="technician";}
        else if(/\bfinance company|financer|finance company ke\b/i.test(nrm)){field="financeCompany";label="finance company";}
        else if(/\baccessor|accessory|एक्सेसरी\b/i.test(nrm)){field="name";label="accessory";}
        else if(/\bmodel|phone|mobile\b/i.test(nrm)){field="model";label="model";}
        else if(/\bbrand\b/i.test(nrm)){field="brand";label="brand";}
        else if(/\bcustomer|ग्राहक\b/i.test(nrm)){field="customerName";label="customer";}
        if(field){
            const map=new Map();
            source.forEach(x=>{const k=String(x[field]||"Unknown").trim()||"Unknown";map.set(k,(map.get(k)||0)+1);});
            const arr=[...map.entries()].sort((a,b)=>b[1]-a[1]);
            if(arr.length){
                const top=/\b(lowest|least|sabse kam|सबसे कम)\b/i.test(nrm)?arr[arr.length-1]:arr[0];
                answer=smartSay(lang,
                    `${label} में सबसे ज्यादा/कम record: ${top[0]} — ${top[1]} records।`,
                    `${label} mein sabse zyada/kam records: ${top[0]} — ${top[1]} records.`,
                    `Top ${label}: ${top[0]} — ${top[1]} records.`
                );
                filtered=source.filter(x=>String(x[field]||"").trim()===top[0]);
            }
        }
        if(!answer){
            const ranked=source.map(x=>({x,v:metricValue(x,metric,x.__section)})).sort((a,b)=>b.v-a.v);
            const top=ranked[0];
            if(top){
                answer=smartSay(lang,`सबसे बड़ा record ${rupees(top.v)} का है।`, `Sabse bada record ${rupees(top.v)} ka hai.`, `Highest record is ${rupees(top.v)}.`);
                filtered=[top.x];
            }
        }
    }

    /* ---------- Customer history / entity questions ---------- */
    else if(/\b(history|complete history|full history|pura data|पूरी history|पूरा data|transactions|transaction|record dikhao|record दिखाओ|show|dikhao|दिखाओ)\b/i.test(nrm)){
        const entity=entityRows(allDataRows(),q);
        if(entity.length){
            const person=entity[0].customerName||entity[0].name||"Customer";
            answer=smartSay(lang,
                `${person} के ${entity.length} matching records मिले। पूरी history नीचे है।`,
                `${person} ke ${entity.length} matching records mile. Puri history neeche hai.`,
                `${entity.length} matching records found for ${person}. Full history is below.`
            );
            filtered=entity;
        }
    }

    /* ---------- Search by name / phone / IMEI / model / generic ---------- */
    if(!answer){
        const entity=entityRows(rows,q);
        if(entity.length){
            filtered=entity;
            answer=smartSay(lang,
                `${entity.length} matching records मिले।`,
                `${entity.length} matching records mile.`,
                `Found ${entity.length} matching records.`
            );
        }else{
            /* Fuzzy token matching for natural questions not covered by a metric. */
            const words=searchTokens(nrm).filter(w=>w.length>2);
            filtered=rows.filter(x=>{
                const text=rowSearchText(x);
                return words.filter(w=>!["show","give","tell","please","today","aaj","ka","ki","ke","hai","hain","data","record","records","customer","customers"].includes(w))
                    .some(w=>text.includes(w));
            });
            answer=filtered.length
                ? smartSay(lang,`${filtered.length} matching records मिले।`,`${filtered.length} matching records mile.`,`Found ${filtered.length} matching records.`)
                : smartSay(lang,"इस सवाल के लिए matching data नहीं मिला।","Is sawal ke liye matching data nahi mila.","No matching data was found for this question.");
        }
    }

    a.innerHTML=`<div class="smart-answer-text">${esc(answer)}</div>`;
    r.innerHTML=renderSmartRows(filtered);
}

/* =========================================================
   290 MASTER QUESTION EXAMPLES
   These are intentionally kept as semantic examples/aliases.
   The engine above is not limited to these exact sentences.
   ========================================================= */
const KABIR_AI_QUESTION_EXAMPLES = [
"कुल कितने customers हैं?","Total customers कितने हैं?","आज कितने customer add हुए?","आज कितने नए ग्राहक आए?","आज कौन-कौन से customers add हुए?","कल कितने customers add हुए थे?","इस महीने कितने customers आए?","पिछले 7 दिनों में कितने customers आए?","Aman का data दिखाओ","Aman की पूरी history दिखाओ","9876543210 का पूरा data दिखाओ","इस number का customer कौन है?","customer code KM1234 का data दिखाओ","इस customer ने पहले क्या-क्या करवाया है?",
"Finance में कितने customers हैं?","Total finance records कितने हैं?","आज कितने finance हुए?","आज कितने phones finance हुए?","आज finance का पूरा हिसाब बताओ","आज कौन-कौन से phones finance हुए?","इस महीने कितने finance हुए?","इस महीने finance से कितनी sale हुई?","कौन सी finance company के सबसे ज्यादा customers हैं?","Finance में total phone amount कितना है?","आज कितनी down payment मिली?","आज कितनी EMI बनी?","Finance की पूरी history दिखाओ","इस number की finance history दिखाओ","इस IMEI का finance record दिखाओ",
"Repairing में कितने records हैं?","आज कितनी repairing हुई?","आज कितने phones repair हुए?","आज कौन-कौन से phones repair हुए?","आज की पूरी repairing list दिखाओ","इस महीने कितनी repairing हुई?","आज repairing से कितना पैसा आया?","आज repairing में कितना profit हुआ?","इस महीने repairing का profit कितना है?","Aman की repairing history दिखाओ","इस customer की repairing history दिखाओ","इस phone में क्या problem थी?","किस technician ने सबसे ज्यादा repairing की?","कौन सी problem सबसे ज्यादा आ रही है?","किस model की सबसे ज्यादा repairing हुई?",
"Second Hand में कितने phones हैं?","आज कितने second hand phones आए?","आज कितने second hand phones बिके?","आज कौन सा second hand phone बिका?","Second Hand का आज का हिसाब बताओ","इस महीने कितने second hand phones बिके?","इस महीने second hand में कितना profit हुआ?","कौन सा second hand phone सबसे ज्यादा profit में बिका?","कौन-कौन से phones stock में हैं?","कौन सा iPhone stock में है?","IMEI से phone दिखाओ","इस phone की purchase price कितनी थी?","इस phone की sale price कितनी है?","इस phone में कितना profit हुआ?","कौन सा model available है?",
"Accessories कितनी हैं?","Total accessories stock कितना है?","आज कितनी accessories बिकी?","आज कौन-कौन सी accessories बिकी?","आज accessories की total sale कितनी है?","आज accessories में कितना profit हुआ?","कौन सी accessory सबसे ज्यादा बिकी?","कौन सी accessories खत्म होने वाली हैं?","कौन-कौन सी accessories available हैं?","इस accessory की quantity कितनी है?","इस accessory का purchase price कितना है?","इस accessory का sale price कितना है?","SN number से accessory दिखाओ","किस customer ने accessory खरीदी?",
"आज कितना profit हुआ?","Aaj kitna profit hua?","आज का total profit बताओ","आज कितने रुपए कमाए?","आज की earning कितनी है?","आज का पूरा profit breakup बताओ","Finance से आज कितना profit हुआ?","Repairing से आज कितना profit हुआ?","Second Hand से आज कितना profit हुआ?","Accessories से आज कितना profit हुआ?","इस महीने कितना profit हुआ?","पिछले 7 दिनों का profit कितना है?","पिछले 30 दिनों का profit कितना है?","इस साल कितना profit हुआ?","किस section से सबसे ज्यादा profit हुआ?",
"आज क्या-क्या काम हुआ है?","Aaj ka pura hisab batao","आज का पूरा काम बताओ","आज कितने काम हुए?","आज total कितने records बने?","आज कितने finance, repairing, second hand और accessories के काम हुए?","आज की पूरी activity बताओ","आज की पूरी business report दिखाओ","आज कितना business हुआ?","आज कितनी sale हुई?","आज कितने customers आए?","आज कितने नए customers आए?","आज कितने पुराने customers आए?","आज कितने phones repair हुए?","आज कितने phones finance हुए?","आज कितनी accessories बिकी?","आज का total collection कितना है?","आज का पूरा summary दो","What happened today?",
"कल कितने काम हुए?","परसों कितने काम हुए?","पिछले 7 दिनों में क्या हुआ?","पिछले 30 दिनों में क्या हुआ?","इस हफ्ते का हिसाब बताओ","इस महीने का हिसाब बताओ","पिछले महीने का हिसाब बताओ","इस साल का हिसाब बताओ","जनवरी में कितना काम हुआ?","अगस्त में कितने customers आए?","1 अगस्त से 20 अगस्त तक कितने काम हुए?","01/08/2026 से 20/08/2026 तक का profit बताओ","इस तारीख को क्या-क्या हुआ था?","15 अगस्त को कितने customers आए?","इस हफ्ते सबसे ज्यादा काम किस दिन हुआ?","किस दिन सबसे ज्यादा profit हुआ?","आज और कल का comparison करो",
"Aman को खोजो","इस नाम का पूरा data दिखाओ","इस number को खोजो","इस IMEI को खोजो","इस customer code को खोजो","iPhone 15 के सारे records दिखाओ","Samsung के सारे records दिखाओ","सभी iPhone दिखाओ","सभी Samsung customers दिखाओ","इस model के सारे customers दिखाओ","इस brand की पूरी history दिखाओ","इस phone number से जुड़े सारे records दिखाओ","इस customer के सारे transactions दिखाओ","इसका सबसे पुराना record दिखाओ","इसका सबसे नया record दिखाओ",
"आज और कल में कितना difference है?","इस महीने और पिछले महीने की sale compare करो","इस महीने और पिछले महीने का profit compare करो","किस section ने सबसे ज्यादा profit दिया?","किस section में सबसे ज्यादा काम हुआ?","किस दिन सबसे ज्यादा customers आए?","किस दिन सबसे ज्यादा sale हुई?","कौन सा model सबसे ज्यादा बिका?","कौन सा brand सबसे ज्यादा बिका?","कौन सा accessory सबसे ज्यादा बिका?","किस technician ने सबसे ज्यादा काम किया?","किस finance company के सबसे ज्यादा records हैं?","किस customer के सबसे ज्यादा transactions हैं?",
"भाई आज का हिसाब क्या है?","आज दुकान पर क्या-क्या हुआ?","आज कितने लोग आए?","आज कितना काम किया?","आज कितने phone निकले?","आज कितनी कमाई हुई?","आज सबसे ज्यादा कमाई किससे हुई?","आज कौन सा काम सबसे ज्यादा हुआ?","आज कौन सा phone सबसे ज्यादा आया?","कल से आज business कैसा रहा?","इस महीने business कैसा चल रहा है?","कौन सा section अच्छा perform कर रहा है?","मुझे आज की पूरी report समझाओ","मुझे इस महीने का पूरा हिसाब समझाओ","सबका हिसाब एक साथ बताओ","आज का पूरा summary दो",
"How many customers were added today?","How many customers do we have?","What happened today?","Give me today's complete report.","How much profit did we make today?","Which section made the most profit?","How many phones were repaired today?","How many phones were financed today?","How many second-hand phones were sold today?","How many accessories were sold today?","Show today's customers.","Show Aman’s complete history.","Show all records for this phone number.","What was our total sale this month?","Compare today's profit with yesterday.","Which phone sold the most?","Which technician did the most repairs?","Which finance company has the most records?","Give me the complete business summary."
,
"आज कितने phones आए?",
"आज कितने phones बिके?",
"आज कितने पुराने customers आए?",
"आज कितने customer में काम हुआ?",
"आज customer में क्या-क्या काम हुआ?",
"Finance में सबसे ज्यादा कौन सी company इस्तेमाल हुई?",
"कौन-कौन सी finance companies इस्तेमाल हुई हैं?",
"इस customer ने कौन सी finance company ली?",
"इस phone की finance company कौन सी है?",
"Finance में total down payment कितना है?",
"Finance में total EMI कितना है?",
"आज finance में कितना पैसा आया?",
"आज finance में कौन सा model सबसे ज्यादा बिका?",
"सबसे ज्यादा कौन सा phone finance हुआ?",
"Finance में कितने pending records हैं?",
"Finance के सभी records दिखाओ",
"इस महीने repairing की sale कितनी हुई?",
"आज repairing का total कितना है?",
"आज parts पर कितना खर्च हुआ?",
"Total repairing profit कितना है?",
"किसने phone repair किया?",
"आज किस technician ने कितने काम किए?",
"सबसे महंगी repairing कौन सी थी?",
"सबसे ज्यादा profit वाली repairing कौन सी थी?",
"आज कितने repairing jobs complete हुए?",
"आज कौन-कौन से repairing काम हुए?",
"आज का पूरा repairing work दिखाओ",
"Second Hand की पूरी list दिखाओ",
"इस महीने second hand से कितनी sale हुई?",
"आज second hand का profit कितना है?",
"Total second hand profit कितना है?",
"सबसे ज्यादा profit वाला phone कौन सा है?",
"सबसे कम price वाला phone कौन सा है?",
"सबसे महंगा phone कौन सा है?",
"कौन सा phone किस condition में है?",
"सबसे ज्यादा कौन सा brand stock में है?",
"कौन सा model सबसे ज्यादा है?",
"इस IMEI का पूरा data दिखाओ",
"किस customer का second hand phone है?",
"आज किस customer ने accessory खरीदी?",
"इस महीने accessories की पूरी sale दिखाओ",
"Accessories की पूरी history दिखाओ",
"कौन सी accessory सबसे ज्यादा stock में है?",
"इस accessory में कितना profit है?",
"इस SN number का data दिखाओ",
"आज का profit कल से ज्यादा है या कम?",
"आज और कल के profit में कितना difference है?",
"इस महीने सबसे ज्यादा profit किस section ने दिया?",
"आज सबसे ज्यादा profit किस काम से हुआ?",
"इस महीने और पिछले महीने का profit compare करो",
"पिछले महीने का profit कितना था?",
"पिछले महीने कितनी sale हुई?",
"पिछले महीने कितने customers आए?",
"इस साल कितने customers आए?",
"इस साल कितनी sale हुई?",
"इस साल का profit कितना है?",
"पिछले रविवार को कितने काम हुए?",
"इस हफ्ते का total profit कितना है?",
"इस हफ्ते कितनी sale हुई?",
"इस हफ्ते कितने customers आए?",
"इस हफ्ते कौन सा काम ज्यादा हुआ?",
"इस तारीख को कितने records बने?",
"इस date range में कितनी sale हुई?",
"आज की पूरी business activity दिखाओ",
"आज की पूरी business report दो",
"आज की complete report Hindi में दो",
"Give me today's business summary",
"Show me everything done today",
"What was today's total business?",
"How much money came in today?",
"How many jobs were completed today?",
"How many finance records are there?",
"How much was today's down payment?",
"How much was today's EMI amount?",
"Show all repairing records",
"What problem was repaired most?",
"Which phone model had the most repairs?",
"Show second hand stock",
"Which used phone has the highest profit?",
"Show accessories stock",
"Which accessory sold the most?",
"Find Aman",
"Find this phone number",
"Find this IMEI",
"Find this customer code",
"Show complete customer history",
"Show all transactions of this customer",
"Show the latest record",
"Show the oldest record",
"bhai aaj ka scene kya raha?",
"aaj jeb me kitna paisa bana?",
"aaj kitna fayda hua?",
"aaj ka pura kaam kya tha?",
"aaj kitne bande aaye?",
"is mahine ka business kaisa raha?",
"kaunsa section sabse achha chal raha hai?",
"kaunsa phone sabse zyada bik raha hai?",
"kis customer ki sabse zyada transactions hain?",
"sab ka hisab ek saath batao",
"aaj koi unusual cheez hui?",
"mere business ka summary do",
"आज सबसे ज्यादा sale किस section में हुई?",
"Which section had the highest sales today?"];

function applyTheme(theme){
    const allowed=["dark","light","midnight","silver","glass","sunset","emerald","rose"];
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
    $("deleteCustomerButton")?.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();deleteCustomer();});
    $("editCustomerButton")?.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();editCustomer();});
    $("closeDetailButton")?.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();closeCustomerDetail();});
    $("homeSearchButton")?.addEventListener("click",()=>{show("smartSearchSection");$("universalSearchInput")?.focus();smartSearch();audit("customer_search",{section:"All Data",description:"Smart database search opened"});});
    $("recentDeletedButton")?.addEventListener("click",()=>{show("recentDeletedSection");renderRecentlyDeleted();});
    $("universalSearchInput")?.addEventListener("input",smartSearch);
    $("closePdfSelectButton")?.addEventListener("click",()=>$("pdfSelectModal")?.classList.add("hidden"));
    $("pdfChoices")?.addEventListener("click",e=>{const b=e.target.closest("[data-pdf-section]");if(b)runPdfWithSelectedDate(b.dataset.pdfSection)});
}

// FINAL ROBUST CUSTOMER ACTION HANDLERS
// Delegation ensures the buttons keep working even when the modal is rebuilt or re-rendered.
document.addEventListener("click",e=>{
    const edit=e.target.closest("#editCustomerButton");
    if(edit){e.preventDefault();e.stopImmediatePropagation();editCustomer();return;}
    const del=e.target.closest("#deleteCustomerButton");
    if(del){e.preventDefault();e.stopImmediatePropagation();deleteCustomer();return;}
    const close=e.target.closest("#closeDetailButton");
    if(close){e.preventDefault();e.stopImmediatePropagation();closeCustomerDetail();return;}
});

/* =========================================================
   INITIALIZE
========================================================= */

async function init(){
    setupPin();
    authInit().catch(e=>{
        console.error("Firebase authentication startup failed:",e);
    });
    authReady.then(()=>loadSharedPin()).catch(e=>{
        console.error("Firebase/PIN initialization failed:",e);
        if($("connectionStatus")){
            $("connectionStatus").textContent="Firebase authentication failed. Anonymous Sign-in ON करें.";
            $("connectionStatus").classList.add("error");
        }
    });

    nav();

    brands();

    setupFinanceCompany();
    setupRepairFields();

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
    if(!$('appScreen')?.classList.contains('admin')) audit('page_open',{section:'Kabir Mobile Data',description:'Website opened',deviceBrand:deviceInfo().brand,deviceModel:deviceInfo().model});
    setupHomeDateFilter();
    adminAnalytics();
    if($('appScreen')?.classList.contains('admin')) audit('page_open',{section:'Admin Panel',description:'Admin Panel opened'});

    authReady.then(()=>{
        purgeExpiredDeleted();
        subscribe();
        subscribeRepairing();
        subscribeInventory();
    }).catch(e=>{
        console.error("Firebase data initialization blocked:",e);
    });

    $("customerForm")
        ?.addEventListener(
            "submit",
            save
        );
}


document.addEventListener("DOMContentLoaded",()=>{init()});