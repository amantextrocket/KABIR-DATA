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
const INVENTORY_PHONE_COL="inventoryPhones";
const INVENTORY_PARTY_COL="inventoryParties";
const INVENTORY_INVOICE_COL="inventoryInvoices";
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
let inventoryPhones=[];
let inventoryParties=[];
let inventoryInvoices=[];
let inventoryStockFilter="used";
let inventoryStockStatus="sell";
let inventoryInvoiceRange="all";
let inventoryInvoicePreviewId=null;
let scanStream=null;
let scanTimer=null;

const $=id=>document.getElementById(id);
const val=id=>($(id)?.value||"").trim();

function todayISO(){ return new Date().toLocaleDateString("en-CA"); }
function setupEntryDateFields(){
    const c=$("entryDate"), r=$("repairEntryDate");
    if(c){ c.max=todayISO(); if(!c.value)c.value=todayISO(); }
    if(r){ r.max=todayISO(); if(!r.value)r.value=todayISO(); }
}

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
function fillModelOptions(brand,query=""){
    const m=$("model"); if(!m)return;
    const q=String(query||"").trim().toLowerCase();
    const all=modelListForBrand(brand);
    const list=q?all.filter(x=>x.toLowerCase().includes(q)):all;
    m.innerHTML='<option value="">Select model</option>';
    list.forEach(x=>{
        const o=document.createElement("option");o.value=x;o.textContent=x;m.appendChild(o);
    });
    m.disabled=!brand || list.length===0;
}
function syncCustomerModelOptions(){
    const brand=val("brand"),type=$("modelType"),m=$("model");
    if(!brand||!m)return;
    const query=type?.value||"";
    const current=m.value;
    fillModelOptions(brand,query);
    if(current && [...m.options].some(o=>o.value===current))m.value=current;
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

iQOO:{
models:{
"iQOO 13":["Legend","Nardo Gray","Track Black"],
"iQOO 12":["Legend","Alpha","Phoenix"],
"iQOO Neo 10 Pro":["Fiery Orange","Titanium Silver"],
"iQOO Neo 10R":["Raging Blue","MoonKnight Titanium"],
"iQOO Z10":["Stellar Blue","Silver"],
"iQOO Z9":["Brushed Green","Graphene Blue"]
},
storage:["128 GB","256 GB","512 GB"]
},

Honor:{
models:{
"Honor 400 Pro":["Lunar Grey","Midnight Black"],
"Honor 400":["Midnight Black","Desert Gold","Meteor Silver"],
"Honor X9c":["Titanium Purple","Jade Cyan"]
},
storage:["128 GB","256 GB","512 GB"]
},

Nokia:{
models:{
"Nokia G42 5G":["So Grey","So Purple"],
"Nokia C32":["Autumn Green","Beach Pink","Charcoal"]
},
storage:["64 GB","128 GB","256 GB"]
},

Sony:{
models:{
"Xperia 1 VII":["Black","Khaki Green","Orchid Purple"],
"Xperia 10 VII":["Black","White","Turquoise"]
},
storage:["128 GB","256 GB"]
},

ASUS:{
models:{
"ROG Phone 9 Pro":["Phantom Black","Storm White"],
"Zenfone 12 Ultra":["Sage Green","Ebony Black"]
},
storage:["256 GB","512 GB"]
},

Huawei:{
models:{
"Pura 80 Pro":["Black","White","Gold"],
"Nova 13 Pro":["Green","White","Black"]
},
storage:["256 GB","512 GB"]
},

ZTE:{
models:{
"nubia Z70 Ultra":["Black","Yellow","Blue"],
"RedMagic 10 Pro":["Shadow","Moonlight","Dusk"]
},
storage:["256 GB","512 GB"]
},

itel:{
models:{
"S25 Ultra":["Titanium Blue","Titanium Gray"],
"P55 5G":["Galaxy Blue","Royal Green"]
},
storage:["64 GB","128 GB"]
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

/* =========================================================
   ADMIN TRAFFIC — STATISTICS / PERFORMANCE / REPAIRING PROFIT / OVERVIEW
   Each view has its own Start Date / End Date filter.
========================================================= */
function adminTrafficDate(x){
    const d=x?.createdAt?.toDate?.() || (x?.clientTime?new Date(x.clientTime):null);
    return d && !Number.isNaN(d.getTime()) ? d : null;
}
function adminTrafficDateKey(x){
    const d=adminTrafficDate(x); return d ? d.toLocaleDateString("en-CA") : "";
}
function adminTrafficRange(prefix){
    const from=$(prefix+"From")?.value||"", to=$(prefix+"To")?.value||"";
    const start=from?new Date(from+"T00:00:00"):null;
    const end=to?new Date(to+"T23:59:59.999"):null;
    if(start&&end&&start>end)return null;
    const inRange=x=>{const d=adminTrafficDate(x);return !!d&&(!start||d>=start)&&(!end||d<=end)};
    return {from,to,start,end,inRange};
}
function adminTrafficDateFilter(id,title,sub=""){return `<div class="traffic-date-filter"><div><b>${esc(title)}</b>${sub?`<small>${esc(sub)}</small>`:""}</div><div class="traffic-date-fields"><label>Start Date<input id="${id}From" type="date"></label><label>End Date<input id="${id}To" type="date"></label></div><p id="${id}DateMessage" class="message"></p></div>`}
function adminTrafficStatCard(label,value,icon="•"){return `<div class="traffic-stat-card"><span>${icon}</span><small>${esc(label)}</small><strong>${esc(value)}</strong></div>`}
function adminMoney(n){return `₹${Number(n||0).toLocaleString("en-IN")}`}
function adminTrafficRows(){
    return [
      ...customers.map(x=>({...x,__section:"Finance",__name:x.customerName||"—",__phone:x.phone||"—",__revenue:Number(x.phoneAmount||0),__profit:0})),
      ...repairing.map(x=>({...x,__section:"Repairing",__name:x.customerName||"—",__phone:x.phone||"—",__revenue:Number(x.total??x.payment??0),__profit:Number(x.profit??(Number(x.total??x.payment??0)-Number(x.partsPrice||0)))})),
      ...secondHand.map(x=>({...x,__section:"Second Hand",__name:x.customerName||"—",__phone:x.phone||"—",__revenue:Number(x.salePrice||x.price||0),__profit:Number(x.profit??(Number(x.salePrice||0)-Number(x.price||0)))})),
      ...accessories.map(x=>({...x,__section:"Accessories",__name:x.customerName||x.name||"—",__phone:x.customerPhone||"—",__revenue:Number(x.salePrice||x.price||0)*Math.max(1,Number(x.quantity||1)),__profit:Number(x.profit??(Number(x.salePrice||0)-Number(x.price||0)))*Math.max(1,Number(x.quantity||1))}))
    ];
}
function renderTrafficStatistics(){
    const box=$("trafficAnalyticsContent");if(!box)return;
    box.innerHTML=adminTrafficDateFilter("trafficStats","Statistics","Finance, Repairing, Second Hand और Accessories");
    const render=()=>{
      const range=adminTrafficRange("trafficStats"),m=$("trafficStatsDateMessage");
      if(!range){m.textContent="Start Date, End Date से बड़ी नहीं हो सकती.";return;}
      m.textContent="";
      const rows=adminTrafficRows().filter(range.inRange), finance=rows.filter(x=>x.__section==="Finance"), repair=rows.filter(x=>x.__section==="Repairing"), second=rows.filter(x=>x.__section==="Second Hand"), acc=rows.filter(x=>x.__section==="Accessories");
      const totalRevenue=rows.reduce((n,x)=>n+x.__revenue,0), totalProfit=rows.reduce((n,x)=>n+x.__profit,0);
      box.querySelector("#trafficStatsResult")?.remove();
      const result=document.createElement("div");result.id="trafficStatsResult";result.innerHTML=`<div class="traffic-stat-grid">${adminTrafficStatCard("Total Records",rows.length,"📦")}${adminTrafficStatCard("Finance Customers",finance.length,"💳")}${adminTrafficStatCard("Repairing Records",repair.length,"🛠️")}${adminTrafficStatCard("Second Hand",second.length,"📱")}${adminTrafficStatCard("Accessories",acc.length,"🎧")}${adminTrafficStatCard("Total Revenue",adminMoney(totalRevenue),"💰")}${adminTrafficStatCard("Total Profit",adminMoney(totalProfit),"📈")}</div><div class="traffic-block"><b>Section Summary</b><div class="admin-data-table"><div class="admin-data-row"><b>Section</b><b>Records</b><b>Revenue</b><b>Profit</b></div>${[["Finance",finance],["Repairing",repair],["Second Hand",second],["Accessories",acc]].map(([n,a])=>`<div class="admin-data-row"><span>${n}</span><span>${a.length}</span><span>${adminMoney(a.reduce((v,x)=>v+x.__revenue,0))}</span><span>${adminMoney(a.reduce((v,x)=>v+x.__profit,0))}</span></div>`).join("")}</div></div>`;
      box.appendChild(result);
    };
    $("trafficStatsFrom")?.addEventListener("change",render);$("trafficStatsTo")?.addEventListener("change",render);render();
}
function renderTrafficPerformance(){
    const box=$("trafficAnalyticsContent");if(!box)return;
    box.innerHTML=adminTrafficDateFilter("trafficPerformance","Performance","Website work and user activity");
    const render=()=>{
      const range=adminTrafficRange("trafficPerformance"),m=$("trafficPerformanceDateMessage");if(!range){m.textContent="Start Date, End Date से बड़ी नहीं हो सकती.";return;}m.textContent="";
      const rows=auditLogs.filter(range.inRange), users=new Set(rows.map(x=>x.userUid||x.userName).filter(Boolean));
      const actionCount=a=>rows.filter(x=>x.action===a).length;
      const adds=actionCount("customer_add")+actionCount("repairing_add")+actionCount("second_hand_add")+actionCount("accessory_add"), edits=actionCount("customer_edit"), deletes=actionCount("customer_delete");
      const byUser={};rows.forEach(x=>{const u=x.userName||x.userUid||"Unknown";byUser[u]=(byUser[u]||0)+1});const usersList=Object.entries(byUser).sort((a,b)=>b[1]-a[1]);
      box.querySelector("#trafficPerformanceResult")?.remove();const result=document.createElement("div");result.id="trafficPerformanceResult";result.innerHTML=`<div class="traffic-stat-grid">${adminTrafficStatCard("Total Work Actions",rows.length,"⚡")}${adminTrafficStatCard("Active Users",users.size,"👥")}${adminTrafficStatCard("New Entries",adds,"➕")}${adminTrafficStatCard("Edits",edits,"✏️")}${adminTrafficStatCard("Deletes",deletes,"🗑️")}${adminTrafficStatCard("Searches",rows.filter(x=>String(x.action||"").includes("search")).length,"🔎")}</div><div class="traffic-block"><b>User Performance</b><div class="admin-data-table"><div class="admin-data-row"><b>User</b><b>Actions</b><b>Last Activity</b></div>${usersList.slice(0,100).map(([u,n])=>{const last=rows.find(x=>(x.userName||x.userUid||"Unknown")===u);return `<div class="admin-data-row"><span>${esc(u)}</span><span>${n}</span><span>${esc(auditTime(last))}</span></div>`}).join("")||'<div class="empty">इस date range में performance record नहीं है.</div>'}</div></div>`;box.appendChild(result);
    };
    $("trafficPerformanceFrom")?.addEventListener("change",render);$("trafficPerformanceTo")?.addEventListener("change",render);render();
}
function renderTrafficRepairProfit(){
    const box=$("trafficAnalyticsContent");if(!box)return;
    box.innerHTML=adminTrafficDateFilter("trafficRepair","Repairing Profit","Repairing records का detailed profit report");
    const render=()=>{
      const range=adminTrafficRange("trafficRepair"),m=$("trafficRepairDateMessage");if(!range){m.textContent="Start Date, End Date से बड़ी नहीं हो सकती.";return;}m.textContent="";
      const rows=repairing.filter(range.inRange),total=rows.reduce((n,x)=>n+Number(x.total??x.payment??0),0),parts=rows.reduce((n,x)=>n+Number(x.partsPrice||0),0),profit=rows.reduce((n,x)=>n+Number(x.profit??(Number(x.total??x.payment??0)-Number(x.partsPrice||0))),0);
      box.querySelector("#trafficRepairResult")?.remove();const result=document.createElement("div");result.id="trafficRepairResult";result.innerHTML=`<div class="traffic-stat-grid">${adminTrafficStatCard("Repairing Records",rows.length,"🛠️")}${adminTrafficStatCard("Total Collection",adminMoney(total),"💰")}${adminTrafficStatCard("Parts Cost",adminMoney(parts),"🔧")}${adminTrafficStatCard("Repairing Profit",adminMoney(profit),"📈")}</div><div class="traffic-block"><b>Repairing Profit Details</b><div class="admin-data-table"><div class="admin-data-row"><b>Date</b><b>Customer</b><b>Device</b><b>Total</b><b>Parts</b><b>Profit</b></div>${rows.map(x=>`<div class="admin-data-row"><span>${esc(formatDateTime(x))}</span><span>${esc(x.customerName||"—")}</span><span>${esc(x.device||"—")}</span><span>${adminMoney(x.total??x.payment)}</span><span>${adminMoney(x.partsPrice)}</span><span>${adminMoney(x.profit??(Number(x.total??x.payment??0)-Number(x.partsPrice||0)))}</span></div>`).join("")||'<div class="empty">इस date range में repairing record नहीं है.</div>'}</div></div>`;box.appendChild(result);
    };
    $("trafficRepairFrom")?.addEventListener("change",render);$("trafficRepairTo")?.addEventListener("change",render);render();
}
function renderTrafficOverview(){
    const box=$("trafficAnalyticsContent");if(!box)return;
    box.innerHTML=adminTrafficDateFilter("trafficOverview","Overview","पूरे Kabir Data का combined summary");
    const render=()=>{
      const range=adminTrafficRange("trafficOverview"),m=$("trafficOverviewDateMessage");if(!range){m.textContent="Start Date, End Date से बड़ी नहीं हो सकती.";return;}m.textContent="";
      const rows=adminTrafficRows().filter(range.inRange),profit=rows.reduce((n,x)=>n+x.__profit,0),revenue=rows.reduce((n,x)=>n+x.__revenue,0),audit= auditLogs.filter(range.inRange);
      const result=document.createElement("div");result.id="trafficOverviewResult";result.innerHTML=`<div class="traffic-stat-grid">${adminTrafficStatCard("All Records",rows.length,"📦")}${adminTrafficStatCard("Revenue / Value",adminMoney(revenue),"💰")}${adminTrafficStatCard("Business Profit",adminMoney(profit),"📈")}${adminTrafficStatCard("Work Actions",audit.length,"⚡")}${adminTrafficStatCard("Customers",new Set(rows.map(x=>x.__phone).filter(x=>x&&x!=="—")).size,"👥")}${adminTrafficStatCard("Repairing Profit",adminMoney(rows.filter(x=>x.__section==="Repairing").reduce((n,x)=>n+x.__profit,0)),"🛠️")}</div><div class="traffic-block"><b>Quick Overview</b><div class="admin-data-table"><div class="admin-data-row"><span>Finance</span><span>${rows.filter(x=>x.__section==="Finance").length} records</span><span>${adminMoney(rows.filter(x=>x.__section==="Finance").reduce((n,x)=>n+x.__revenue,0))}</span></div><div class="admin-data-row"><span>Repairing</span><span>${rows.filter(x=>x.__section==="Repairing").length} records</span><span>Profit ${adminMoney(rows.filter(x=>x.__section==="Repairing").reduce((n,x)=>n+x.__profit,0))}</span></div><div class="admin-data-row"><span>Second Hand</span><span>${rows.filter(x=>x.__section==="Second Hand").length} records</span><span>Profit ${adminMoney(rows.filter(x=>x.__section==="Second Hand").reduce((n,x)=>n+x.__profit,0))}</span></div><div class="admin-data-row"><span>Accessories</span><span>${rows.filter(x=>x.__section==="Accessories").length} records</span><span>Profit ${adminMoney(rows.filter(x=>x.__section==="Accessories").reduce((n,x)=>n+x.__profit,0))}</span></div></div></div>`;box.appendChild(result);
    };
    $("trafficOverviewFrom")?.addEventListener("change",render);$("trafficOverviewTo")?.addEventListener("change",render);render();
}
function openTrafficTab(tab){
    document.querySelectorAll("[data-traffic-tab]").forEach(b=>b.classList.toggle("selected",b.dataset.trafficTab===tab));
    if(tab==="statistics")renderTrafficStatistics();
    else if(tab==="performance")renderTrafficPerformance();
    else if(tab==="repairProfit")renderTrafficRepairProfit();
    else renderTrafficOverview();
}

function adminAnalytics(){
    const open=id=>{document.querySelectorAll("[data-admin-page]").forEach(x=>x.classList.add("hidden"));$(id)?.classList.remove("hidden");$(id)?.scrollIntoView({behavior:"smooth",block:"start"});};
    $("pinSettingsButton")?.addEventListener("click",()=>open("pinPage"));
    $("workHistoryButton")?.addEventListener("click",()=>{open("workHistorySection");renderWorkHistory();});
    $("trafficButton")?.addEventListener("click",()=>{open("trafficSection");openTrafficTab("statistics");});
    document.querySelectorAll("[data-traffic-tab]").forEach(b=>b.addEventListener("click",()=>openTrafficTab(b.dataset.trafficTab)));
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
    $("homeButton")?.addEventListener("click",()=>{pageHistory=["homeView"];show("homeView");window.scrollTo({top:0,behavior:"smooth"});});
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
            const lifetimeCount=getLifetimeCustomerDirectory().length;
            $("homeCustomerCount")&&($("homeCustomerCount").textContent=`${lifetimeCount} Customers`);
            $("inventoryCustomerCount")&&($("inventoryCustomerCount").textContent=String(lifetimeCount));
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
    // Inventory के landing page और उसके सभी 4 pages पर SELL / PURCHASE
    // sticky action हमेशा उपलब्ध रहे. बाकी pages पर यह hidden रहेगा.
    const inventorySticky=$("inventoryStickyActions");
    const isInventoryPage=String(id||"").startsWith("inventory");
    inventorySticky?.classList.toggle("hidden",!isInventoryPage);
    $("inventoryAddPartyButton")?.classList.toggle("hidden",id!=="inventoryPartyPage");
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


    $("customerModule")?.addEventListener("click",()=>{open("customerPage");renderAllCustomers();});
    $("inventoryModule")?.addEventListener("click",()=>open("inventoryPage"));
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

function refreshRamStorage(brand, model){
    const d=BRANDS?.[brand]||{};
    const ram=$("ram"), storage=$("storage"), ramField=$("ramField");
    const isIphone=/^iPhone\b/i.test(String(model||""));
    const rams=["2 GB","3 GB","4 GB","6 GB","8 GB","12 GB","16 GB","18 GB","24 GB"];
    if(ram){
        ram.innerHTML='<option value="">Select RAM</option>';
        rams.forEach(x=>{const o=document.createElement("option");o.value=x;o.textContent=x;ram.appendChild(o);});
        ram.disabled=!brand || isIphone;
        if(isIphone)ram.value="";
    }
    if(ramField)ramField.style.display=isIphone?"none":"";
    if(storage){
        storage.innerHTML='<option value="">Select storage</option>';
        (d?.storage||["64 GB","128 GB","256 GB","512 GB","1 TB"]).forEach(x=>{const o=document.createElement("option");o.value=x;o.textContent=x;storage.appendChild(o);});
        storage.disabled=!brand || !model;
    }
}

function brands(){
    const b=$("brand");
    const modelType=$("modelType");
    const m=$("model");
    if(!b)return;

    b.innerHTML='<option value="">Select brand</option>';
    Object.keys(BRANDS).sort((a,z)=>a.localeCompare(z)).forEach(x=>{
        const o=document.createElement("option");o.value=x;o.textContent=x;b.appendChild(o);
    });

    const refreshDetails=()=>{
        const d=BRANDS[b.value];
        const selected=m?.value||"";
        const list=modelListForBrand(b.value);
        const query=modelType?.value||"";
        fillModelOptions(b.value,query);
        if(selected && [...m.options].some(o=>o.value===selected))m.value=selected;
        const activeModel=m?.value||"";
        const cs=d?.models?.[activeModel]||["Black","White","Blue","Green","Red","Silver","Gold","Purple"];
        const c=$("colour");
        if(c){
            c.innerHTML='<option value="">Select colour</option>';
            if(activeModel) cs.forEach(x=>{const o=document.createElement("option");o.value=x;o.textContent=x;c.appendChild(o);});
            c.disabled=!activeModel;
        }
        refreshRamStorage(b.value,activeModel);
    };

    b.onchange=()=>{
        if(modelType)modelType.value="";
        refreshDetails();
        loadAllPhoneModels().then(()=>{if($("brand")?.value===b.value)refreshDetails();});
    };

    modelType?.addEventListener("input",()=>{
        const q=modelType.value.trim();
        fillModelOptions(b.value,q);
        if(m?.options.length===2 && q){m.selectedIndex=1;}
        m?.dispatchEvent(new Event("change"));
    });

    m.onchange=()=>{
        const d=BRANDS[b.value],cs=d?.models?.[m.value]||["Black","White","Blue","Green","Red","Silver","Gold","Purple"],c=$("colour");
        if(modelType && m.value)modelType.value=m.value;
        if(c){c.innerHTML='<option value="">Select colour</option>';if(m.value)cs.forEach(x=>{const o=document.createElement("option");o.value=x;o.textContent=x;c.appendChild(o);});c.disabled=!m.value;}
        refreshRamStorage(b.value,m.value);
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
function findMatchingCustomerByPhone(phone,excludeId=""){const p=normalizeDigits(phone);return customers.find(c=>c.id!==excludeId&&normalizeDigits(c.phone)===p)||null;}
function findMatchingCustomersByName(name,excludeId=""){const n=String(name||"").trim().toLowerCase();return customers.filter(c=>c.id!==excludeId&&String(c.customerName||"").trim().toLowerCase()===n);}
function syncCustomerFields(nameId,phoneId){
    const nameEl=$(nameId),phoneEl=$(phoneId);if(!nameEl||!phoneEl)return;
    const editId=$("customerForm")?.dataset.editId||"";
    const p=normalizeDigits(phoneEl.value), byPhone=findMatchingCustomerByPhone(p,editId);
    if(byPhone){nameEl.value=byPhone.customerName||"";nameEl.readOnly=true;nameEl.dataset.autoMatched="1";return;}
    nameEl.readOnly=false;nameEl.dataset.autoMatched="";
    const matches=findMatchingCustomersByName(nameEl.value,editId);
    if(matches.length===1 && !p) phoneEl.value=matches[0].phone||"";
}
function applyCustomerDuplicateState(){
    const nameEl=$("customerName"),phoneEl=$("phone");if(!nameEl||!phoneEl)return;
    const editId=$("customerForm")?.dataset.editId||"";
    const byPhone=findMatchingCustomerByPhone(phoneEl.value,editId);
    if(byPhone){nameEl.value=byPhone.customerName||"";nameEl.readOnly=true;return;}
    nameEl.readOnly=false;
    const matches=findMatchingCustomersByName(nameEl.value,editId);
    if(matches.length===1 && !normalizeDigits(phoneEl.value)) phoneEl.value=matches[0].phone||"";
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


    /*
     * Customer fields are intentionally OPTIONAL.
     * Empty fields are saved as empty values instead of blocking the save.
     * Phone/IMEI are still cleaned when entered, but are not required.
     */
    let phone=val("phone").replace(/\D/g,"");
    let imei=val("imei").replace(/\D/g,"");
    const editIdForDup=$("customerForm").dataset.editId||"";
    const duplicatePhone=phone?findMatchingCustomerByPhone(phone,editIdForDup):null;
    if(duplicatePhone){
        $("customerName").value=duplicatePhone.customerName||"";
        $("customerName").readOnly=true;
        msg("formMessage","THIS MOBILE NUMBER ALREADY EXISTS. Existing customer details auto-filled.");
        return;
    }
    if(imei && inventoryImeiExists(imei,"",editIdForDup)){msg("formMessage","THIS IMEI ALREADY IN STOCK");return;}


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
        if(editId && !existing){throw Error("Customer record नहीं मिला.");}
        let customerData={

            customerCode:existing?.customerCode || await uniqueCustomerCode(),
            entryDate:val("entryDate") || todayISO(),
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
                (val("model") || val("modelType")),

            imei:
                imei,

            colour:
                val("colour"),

            ram:
                val("ram"),

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
        if($("entryDate"))$("entryDate").value=todayISO();
        delete $("customerForm").dataset.editId;
        if($("customerCode")) $("customerCode").value="";
        if($("modelType")) $("modelType").value="";
        if($("saveCustomerButton")) $("saveCustomerButton").textContent="SAVE CUSTOMER";
        $("customerForm")?.querySelectorAll("input,textarea,select").forEach(el=>{
            el.classList.remove("field-filled");
            el.closest("label")?.classList.remove("field-filled-label");
        });

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
        c.colour,c.ram,c.storage,c.financeCompany,c.lockName,c.stock,c.counter,c.financerName,formatDateTime(c)
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
      ${detailItem("Colour",c.colour)}${detailItem("RAM",c.ram)}${detailItem("Storage",c.storage)}
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
    const u=window.activeUnifiedCustomer;
    let source=u?.actionSource||null;
    let id=u?.actionId||null;
    let row=null;

    if(source==="finance")row=customers.find(x=>x.id===id);
    else if(source==="repair")row=repairing.find(x=>x.id===id);
    else if(source==="second")row=secondHand.find(x=>x.id===id);
    else if(source==="accessory")row=accessories.find(x=>x.id===id);

    // Fallback for older/open detail states.
    if(!row && activeCustomerId){
        row=customers.find(x=>x.id===activeCustomerId);
        if(row){source="finance";id=row.id;}
    }
    if(!row && u){
        const groups=getUnifiedRecords(u.phone,u.name);
        row=getLatestUnifiedRecord(groups);
        source=row?.__source||null;
        id=row?.id||null;
    }

    if(!row||!source||!id){alert("Customer record नहीं मिला.");return;}

    const collectionName=source==="finance"?COL:source==="repair"?REPAIR_COL:source==="second"?SECOND_COL:ACCESSORY_COL;
    const label=source==="finance"?"Finance":source==="repair"?"Repairing":source==="second"?"Second Hand":"Accessories";
    if(!confirm(`Delete ${row.customerName||row.name||"this customer"} का ${label} record?`))return;

    try{
        await deleteWithRecycle(collectionName,id,row);
        await audit("customer_delete",{
            section:source==="finance"?"Kabir Mobile Data":label,
            customerId:id,
            customerCode:row.customerCode||null,
            customerName:row.customerName||row.name||null,
            description:`${label} customer record moved to Recently Deleted`
        });
        closeCustomerDetail();
        renderAllCustomers();
        if(source==="finance")renderSearch();
        if(source==="repair")renderRepairing();
        if(source==="second")renderSecondHand();
        if(source==="accessory")renderAccessories();
        showSuccessToast("Deleted","Customer record moved to Recently Deleted");
    }catch(e){
        console.error(e);
        alert("Customer delete नहीं हुआ. Firebase Rules check करें.");
    }
}

function openFinanceEdit(c){
    closeCustomerDetail();
    show("addSection");
    const map={customerName:"customerName",address:"address",pincode:"pincode",city:"city",state:"state",phone:"phone",
      brand:"brand",model:"model",modelType:"model",imei:"imei",colour:"colour",ram:"ram",storage:"storage",financeCompany:"financeCompany",
      phoneAmount:"phoneAmount",downPayment:"downPayment",emiAmount:"emiAmount",emiMonths:"emiMonths",
      lockName:"lockName",stock:"stock",counter:"counter",financerName:"financerName"};
    Object.entries(map).forEach(([k,id])=>{if($(id))$(id).value=c[k]??""});
    $("entryDate").value=c.entryDate||todayISO();
    $("customerCode").value=c.customerCode||"";
    $("saveCustomerButton").textContent="UPDATE CUSTOMER";
    $("customerForm").dataset.editId=c.id;
    $("brand").dispatchEvent(new Event("change"));
    setTimeout(()=>{
        $("model").value=c.model||"";$("model").dispatchEvent(new Event("change"));
        setTimeout(()=>{$("colour").value=c.colour||"";$("ram").value=c.ram||"";$("storage").value=c.storage||""},0);
    },100);
}
function openRepairEdit(r){
    closeCustomerDetail();
    show("repairAddSection");
    const map={repairEntryDate:"entryDate",repairCustomerName:"customerName",repairPhone:"phone",repairDevice:"device",repairProblem:"problem",repairBy:"repairBy",repairTotal:"total",repairPartsPrice:"partsPrice"};
    Object.entries(map).forEach(([id,key])=>{if($(id))$(id).value=r[key]??""});
    $("repairForm").dataset.editId=r.id;
    const btn=$("repairForm")?.querySelector("button[type='submit']");
    if(btn)btn.textContent="UPDATE REPAIRING";
    updateRepairProfit();
}
function openSecondEdit(x){
    closeCustomerDetail();
    show("secondAddSection");
    $("secondCondition").value=x.condition||"";
    $("secondCustomerName").value=x.customerName||"";
    $("secondPhone").value=x.phone||"";
    $("secondImei").value=x.imei||"";
    $("secondPrice").value=x.price??"";
    $("secondSalePrice").value=x.salePrice??"";
    const brandType=$("secondBrandType"),modelType=$("secondModelType");
    const brand=$("secondBrand"),model=$("secondModel");
    brandType.value="";
    modelType.value="";
    if(Object.keys(BRANDS).includes(x.brand)){
        brand.value=x.brand;
        brand.dispatchEvent(new Event("change"));
        setTimeout(()=>{model.value=x.model||""},0);
    }else{
        brand.value="";
        model.value="";
        brandType.value=x.brand||"";
        modelType.value=x.model||"";
    }
    $("secondHandForm").dataset.editId=x.id;
    const btn=$("secondHandForm")?.querySelector("button[type='submit']");
    if(btn)btn.textContent="UPDATE SECOND HAND";
    updateSecondProfit();
}
function openAccessoryEdit(x){
    closeCustomerDetail();
    show("accessoryAddSection");
    $("accessoryName").value=x.name||"";
    $("accessoryCategory").value=x.category||"";
    $("accessorySn").value=x.sn||"";
    $("accessoryQty").value=x.quantity??"";
    $("accessoryPrice").value=x.price??"";
    $("accessorySalePrice").value=x.salePrice??"";
    $("accessoryCustomerName").value=x.customerName||"";
    $("accessoryCustomerPhone").value=x.customerPhone||"";
    $("accessoryForm").dataset.editId=x.id;
    const btn=$("accessoryForm")?.querySelector("button[type='submit']");
    if(btn)btn.textContent="UPDATE ACCESSORY";
    updateAccessoryProfit();
}
function editCustomer(){
    if(enforceWriteLock("formMessage"))return;
    const u=window.activeUnifiedCustomer;
    let row=null;
    if(u?.actionSource==="finance")row=customers.find(x=>x.id===u.actionId);
    else if(u?.actionSource==="repair")row=repairing.find(x=>x.id===u.actionId);
    else if(u?.actionSource==="second")row=secondHand.find(x=>x.id===u.actionId);
    else if(u?.actionSource==="accessory")row=accessories.find(x=>x.id===u.actionId);

    if(!row){alert("Customer record नहीं मिला.");return;}
    const source=u.actionSource;
    if(source==="finance")openFinanceEdit(row);
    else if(source==="repair")openRepairEdit(row);
    else if(source==="second")openSecondEdit(row);
    else if(source==="accessory")openAccessoryEdit(row);
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

function subscribeSecondaryAndAccessories(){
    onSnapshot(collection(db,SECOND_COL),snap=>{ secondHand=snap.docs.map(d=>({id:d.id,...d.data()})); if($("secondStockCount"))$("secondStockCount").textContent=String(secondHand.length); updateLifetimeCustomerCountUI(); renderSecondHand(); },e=>console.warn("Second hand load:",e));
    onSnapshot(collection(db,ACCESSORY_COL),snap=>{ accessories=snap.docs.map(d=>({id:d.id,...d.data()})); if($("accessoryStockCount"))$("accessoryStockCount").textContent=String(accessories.reduce((n,x)=>n+Number(x.quantity||0),0)); updateLifetimeCustomerCountUI(); renderAccessories(); },e=>console.warn("Accessories load:",e));
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
    const editId=$("secondHandForm").dataset.editId||"";
    const existing=editId?secondHand.find(x=>x.id===editId):null;
    if(editId && (!existing || !canEditRecord(existing))){msg("secondMessage",editLockMessage(existing));return;}
    const brand=val("secondBrandType")||val("secondBrand"),model=val("secondModelType")||val("secondModel");
    const data={customerName:val("secondCustomerName"),phone:val("secondPhone").replace(/\D/g,""),brand,model,device:[brand,model].filter(Boolean).join(" "),imei:val("secondImei").replace(/\D/g,""),condition:val("secondCondition"),price:Number(val("secondPrice")||0),salePrice:Number(val("secondSalePrice")||0),profit:Number(val("secondSalePrice")||0)-Number(val("secondPrice")||0)};
    if(!data.condition||!brand||!model||!/^(?:\d{15})?$/.test(data.imei)||!data.customerName||!/^\d{10}$/.test(data.phone)){msg("secondMessage","Condition, brand, model, valid 10 digit phone और IMEI (15 digit) सही भरें.");return;}
    try{
        if(editId){
            await updateDoc(doc(db,SECOND_COL,editId),data);
            await audit("customer_edit",{section:"Second Hand",customerId:editId,customerName:data.customerName,description:`Second-hand customer ${data.customerName||editId} edited`});
        }else{
            const added=await addDoc(collection(db,SECOND_COL),{...data,createdAt:serverTimestamp(),createdBy:user?.uid||null});
            await audit("second_hand_add",{section:"Second Hand",customerId:added.id,customerName:data.customerName,description:`Second-hand phone added: ${data.device}`,extra:{phone:data.phone,imei:data.imei,brand,model,profit:data.profit}});
        }
        e.target.reset();delete $("secondHandForm").dataset.editId;
        $("secondBrandType").value="";$("secondModelType").value="";$("secondModel").innerHTML='<option value="">Select brand first</option>';$("secondModel").disabled=true;
        const btn=$("secondHandForm")?.querySelector("button[type='submit']");if(btn)btn.textContent="SAVE SECOND HAND PHONE";
        updateSecondProfit();showSuccessToast(editId?"Updated":"Successfully Saved",editId?"Second-hand data updated successfully":"Second-hand phone stock में add हो गया.");
    }catch(err){console.error(err);msg("secondMessage",err?.message||"Save failed.");}
}

async function saveAccessory(e){
    e.preventDefault();if(enforceWriteLock("accessoryMessage"))return;
    const editId=$("accessoryForm").dataset.editId||"";
    const existing=editId?accessories.find(x=>x.id===editId):null;
    if(editId && (!existing || !canEditRecord(existing))){msg("accessoryMessage",editLockMessage(existing));return;}
    const data={name:val("accessoryName"),category:val("accessoryCategory"),sn:val("accessorySn"),quantity:Number(val("accessoryQty")||0),price:Number(val("accessoryPrice")||0),salePrice:Number(val("accessorySalePrice")||0),profit:Number(val("accessorySalePrice")||0)-Number(val("accessoryPrice")||0),customerName:val("accessoryCustomerName"),customerPhone:val("accessoryCustomerPhone").replace(/\D/g,"")};
    if(!data.name||!data.category||data.quantity<1){msg("accessoryMessage","Name, category और quantity भरें.");return;}
    try{
        if(editId){
            await updateDoc(doc(db,ACCESSORY_COL,editId),data);
            await audit("customer_edit",{section:"Accessories",customerId:editId,customerName:data.customerName||data.name,description:`Accessory customer record ${data.customerName||data.name||editId} edited`});
        }else{
            const added=await addDoc(collection(db,ACCESSORY_COL),{...data,createdAt:serverTimestamp(),createdBy:user?.uid||null});
            await audit("accessory_add",{section:"Accessories",customerId:added.id,customerName:data.customerName,description:`Accessory added: ${data.name}`,extra:{category:data.category,quantity:data.quantity,sn:data.sn,profit:data.profit,customerPhone:data.customerPhone}});
        }
        e.target.reset();delete $("accessoryForm").dataset.editId;
        const btn=$("accessoryForm")?.querySelector("button[type='submit']");if(btn)btn.textContent="ADD ACCESSORY";
        updateAccessoryProfit();showSuccessToast(editId?"Updated":"Successfully Saved",editId?"Accessory data updated successfully":"Accessory stock में add हो गया.");
    }catch(err){console.error(err);msg("accessoryMessage",err?.message||"Save failed.");}
}

function updateLifetimeCustomerCountUI(){
    const count=getLifetimeCustomerDirectory().length;
    $("homeCustomerCount")&&($("homeCustomerCount").textContent=`${count} Customers`);
    $("inventoryCustomerCount")&&($("inventoryCustomerCount").textContent=String(count));
}
function getLifetimeCustomerDirectory(){
    const map=new Map();
    const add=(r,type,name,phone)=>{
        const n=String(name||"").trim(),p=String(phone||"").replace(/\D/g,"");
        if(!n&&!p)return;
        const key=p||n.toLowerCase();
        if(!map.has(key))map.set(key,{name:n||"Customer",phone:p,types:new Set(),records:0});
        const item=map.get(key); item.types.add(type); item.records++;
    };
    customers.forEach(x=>add(x,"Finance",x.customerName,x.phone));
    repairing.forEach(x=>add(x,"Repairing",x.customerName,x.phone));
    secondHand.forEach(x=>add(x,"Second Hand",x.customerName,x.phone));
    accessories.forEach(x=>add(x,"Accessories",x.customerName,x.customerPhone));
    return [...map.values()];
}
function renderAllCustomers(){
    const box=$("allCustomerResults");if(!box)return;const q=val("allCustomerSearchInput").toLowerCase();
    const rows=getLifetimeCustomerDirectory().filter(x=>!q||[x.name,x.phone,[...x.types].join(" ")].join(" ").toLowerCase().includes(q));
    const count=getLifetimeCustomerDirectory().length;
    $("homeCustomerCount")&&($("homeCustomerCount").textContent=`${count} Customers`);
    box.innerHTML=rows.length?rows.map(x=>`<article class="result all-customer-result" data-phone="${esc(x.phone)}" data-name="${esc(x.name)}"><div class="result-top"><div><div class="result-name">${esc(x.name)}</div><div class="result-meta">${esc(x.phone||"Phone not available")} • ${x.records} record${x.records===1?"":"s"}</div></div><div class="work-log-tag">${esc([...x.types].join(" • "))}</div></div><div class="result-open-hint">Tap करके आज तक का पूरा data देखें</div></article>`).join(""):"<div class=\"empty\">No customer found.</div>";
    box.querySelectorAll(".all-customer-result").forEach(card=>card.addEventListener("click",()=>showUnifiedCustomerHistory(card.dataset.phone,card.dataset.name)));
}
function getRecordCreatedDate(row){
    if(!row)return null;
    const d=row.createdAt?.toDate?.();
    if(d instanceof Date && !Number.isNaN(d.getTime()))return d;
    if(row.createdAt){
        const x=new Date(row.createdAt);
        if(!Number.isNaN(x.getTime()))return x;
    }
    return null;
}
function canEditRecord(row){
    const d=getRecordCreatedDate(row);
    if(!d)return false;
    return (Date.now()-d.getTime()) < 24*60*60*1000;
}
function editLockMessage(row){
    const d=getRecordCreatedDate(row);
    if(!d)return "इस record का exact add time उपलब्ध नहीं है, इसलिए Edit सुरक्षित रूप से lock है.";
    const hours=Math.max(0,(Date.now()-d.getTime())/3600000);
    if(hours>=24)return "इस record को add किए 24 घंटे पूरे हो चुके हैं. Edit अब automatically lock है.";
    const left=24-hours;
    const h=Math.floor(left),m=Math.floor((left-h)*60);
    return `Edit केवल add होने के 24 घंटे तक उपलब्ध है. लगभग ${h} घंटे ${m} मिनट बाकी हैं.`;
}
function recordSource(row){
    if(!row)return null;
    if(row.__source)return row.__source;
    return null;
}
function getUnifiedRecords(phone,name){
    const p=String(phone||"").replace(/\D/g,"");
    const n=String(name||"").trim().toLowerCase();
    const same=x=>(p&&String(x.phone||x.customerPhone||"").replace(/\D/g,"")===p)||(!p&&n&&String(x.customerName||"").trim().toLowerCase()===n);
    return {
        finance:customers.filter(same),
        repair:repairing.filter(same),
        second:secondHand.filter(same),
        acc:accessories.filter(same)
    };
}
function getLatestUnifiedRecord(groups){
    const rows=[
        ...groups.finance.map(x=>({...x,__source:"finance"})),
        ...groups.repair.map(x=>({...x,__source:"repair"})),
        ...groups.second.map(x=>({...x,__source:"second"})),
        ...groups.acc.map(x=>({...x,__source:"accessory"}))
    ];
    return rows.sort((a,b)=>(getRecordCreatedDate(b)?.getTime()||0)-(getRecordCreatedDate(a)?.getTime()||0))[0]||null;
}
function showUnifiedCustomerHistory(phone,name){
    const groups=getUnifiedRecords(phone,name);
    const {finance,repair,second,acc}=groups;
    const title=name||finance[0]?.customerName||repair[0]?.customerName||second[0]?.customerName||acc[0]?.customerName||"Customer";
    const primary=getLatestUnifiedRecord(groups);

    $("detailTitle").textContent=`${title} • Complete History`;
    activeCustomerId=primary?.__source==="finance"?primary.id:null;
    window.activeUnifiedCustomer={
        phone:String(phone||"").replace(/\D/g,""),
        name:title,
        financeId:finance[0]?.id||null,
        repairId:repair[0]?.id||null,
        secondId:second[0]?.id||null,
        accessoryId:acc[0]?.id||null,
        actionSource:primary?.__source||null,
        actionId:primary?.id||null
    };

    const editBtn=$("editCustomerButton"),deleteBtn=$("deleteCustomerButton");
    const editable=!!primary;
    if(editBtn){
        editBtn.disabled=!editable;
        editBtn.title=primary?(
            editable?`Edit ${primary.__source} record (24-hour window active)`:editLockMessage(primary)
        ):"No customer record found";
        editBtn.textContent=editable?"EDIT CUSTOMER":"EDIT LOCKED";
    }
    if(deleteBtn){
        deleteBtn.disabled=!primary;
        deleteBtn.title=primary?"Delete the latest customer record":"No customer record found";
        deleteBtn.textContent="DELETE CUSTOMER";
    }

    const rows=[];
    finance.forEach(x=>rows.push(`<article class="history-row"><b>💳 Finance / Phone</b><small>${esc(formatDateTime(x))}</small><span>${esc(`${x.brand||""} ${x.model||""}`)} • IMEI ${esc(x.imei||"—")} • ₹${Number(x.phoneAmount||0).toLocaleString("en-IN")}</span></article>`));
    repair.forEach(x=>rows.push(`<article class="history-row"><b>🛠 Repairing</b><small>${esc(formatDateTime(x))}</small><span>${esc(x.device||"")} • ${esc(x.problem||"")} • Total ₹${Number(x.total ?? x.payment ?? 0).toLocaleString("en-IN")} • Parts ₹${Number(x.partsPrice||0).toLocaleString("en-IN")} • Profit ₹${Number(x.profit??(Number(x.total ?? x.payment ?? 0)-Number(x.partsPrice||0))).toLocaleString("en-IN")}</span></article>`));
    second.forEach(x=>rows.push(`<article class="history-row"><b>📱 Second Hand</b><small>${esc(formatDateTime(x))}</small><span>${esc(`${x.brand||""} ${x.model||x.device||""}`)} • IMEI ${esc(x.imei||"—")} • Profit ₹${Number(x.profit??(Number(x.salePrice||0)-Number(x.price||0))).toLocaleString("en-IN")}</span></article>`));
    acc.forEach(x=>rows.push(`<article class="history-row"><b>🎧 Accessories</b><small>${esc(formatDateTime(x))}</small><span>${esc(x.name||"")} • SN ${esc(x.sn||"—")} • Profit ₹${Number(x.profit??(Number(x.salePrice||0)-Number(x.price||0))).toLocaleString("en-IN")}</span></article>`));

    const status=primary
        ? (editable
            ? `<div class="edit-window-note">✏️ Edit available for 24 hours after this record was added.</div>`
            : `<div class="edit-window-note locked">🔒 ${esc(editLockMessage(primary))}</div>`)
        : "";

    $("customerDetailBody").innerHTML=`<div class="detail-grid">${detailItem("Customer",title)}${detailItem("Phone",String(phone||"").replace(/\D/g,"")||finance[0]?.phone||repair[0]?.phone||second[0]?.phone||acc[0]?.customerPhone||"—")}${detailItem("Finance Records",finance.length)}${detailItem("Repairing Records",repair.length)}${detailItem("Second Hand Records",second.length)}${detailItem("Accessories Records",acc.length)}</div>${status}<div class="history-list">${rows.join("")||'<div class="empty">इस customer का कोई history record नहीं मिला.</div>'}</div>`;
    $("customerDetailModal")?.classList.remove("hidden");
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
        updateLifetimeCustomerCountUI();
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
    const editId=$("repairForm").dataset.editId||"";
    const existing=editId?repairing.find(x=>x.id===editId):null;
    if(editId && (!existing || !canEditRecord(existing))){msg("repairMessage",editLockMessage(existing));return;}

    const ids=["repairCustomerName","repairPhone","repairDevice","repairProblem","repairBy","repairTotal","repairPartsPrice"];
    for(const id of ids)if(!val(id)){ $(id)?.focus();msg("repairMessage","सभी fields भरना जरूरी है.");return }
    const phone=val("repairPhone").replace(/\D/g,"");
    if(!/^\d{10}$/.test(phone)){msg("repairMessage","10 digit customer phone number डालें.");return}
    const total=Number(val("repairTotal")||0);
    const partsPrice=Number(val("repairPartsPrice")||0);
    const profit=total-partsPrice;
    const saveBtn=$("repairForm")?.querySelector("button[type='submit']");
    if(saveBtn)saveBtn.disabled=true;

    try{
        const data={
            entryDate:val("repairEntryDate")||todayISO(),
            customerName:val("repairCustomerName"),
            phone,device:val("repairDevice"),problem:val("repairProblem"),repairBy:val("repairBy"),
            total,partsPrice,profit
        };
        if(editId){
            await updateDoc(doc(db,REPAIR_COL,editId),data);
            await audit("customer_edit",{section:"Kabir Repairing Data",customerId:editId,customerName:data.customerName,description:`Repairing customer ${data.customerName||editId} edited`});
        }else{
            const repairRef=await addDoc(collection(db,REPAIR_COL),{...data,createdAt:serverTimestamp(),createdBy:user?.uid||null});
            await audit("repairing_add",{section:"Kabir Repairing Data",customerId:repairRef.id,customerName:data.customerName,description:`Repairing added: ${data.problem||"Problem"}`,extra:{phone,device:data.device,problem:data.problem,total,partsPrice,profit}});
        }
        $("repairForm").reset();
        delete $("repairForm").dataset.editId;
        if($("repairEntryDate"))$("repairEntryDate").value=todayISO();
        if(saveBtn)saveBtn.textContent="SAVE REPAIRING";
        updateRepairProfit();
        msg("repairMessage","");
        showSuccessToast(editId?"Updated":"Successfully Saved",editId?"Repairing data updated successfully":"Repairing data saved successfully");
    }catch(e){
        console.error(e);
        msg("repairMessage",e?.message||"Repairing save नहीं हुआ.");
    }finally{
        if(saveBtn)saveBtn.disabled=false;
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
        }else if(section==="inventory"){
            title="KABIR MOBILE DATA — INVENTORY";
            headers=["Date & Time","Status","Type","Customer","Mobile","Brand","Model","IMEI","RAM / Storage","Colour","Purchase","Sell","Margin"];
            rows=inventoryPhones.filter(x=>{const d=pdfRecordDate(x);if(!fromDate&&!toDate)return true;return d&&(!fromDate||d>=new Date(`${fromDate}T00:00:00`))&&(!toDate||d<=new Date(`${toDate}T23:59:59.999`));}).map(x=>[pdfDate(x.createdAt),x.status==="sold"?"SOLD":"IN STOCK",String(x.conditionType||x.phoneType||"Used").toUpperCase(),x.customerName||x.partyName||"—",x.customerPhone||x.partyPhone||"—",x.brand,x.model,x.imei,`${x.ram||"—"} / ${x.storage||"—"}`,x.colour,pdfMoney(x.purchasePrice),pdfMoney(x.salePrice||x.sellingPrice),pdfMoney(Number(x.salePrice||x.sellingPrice||0)-Number(x.purchasePrice||0))]);
            file="Kabir_Inventory_Data.pdf";
        }else if(section==="customers"){        }else if(section==="customers"){
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
function normalizeText(x){return String(x||"").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim();}
function allDataRows(){return [
 ...customers.map(x=>({...x,__section:"Finance"})),
 ...repairing.map(x=>({...x,__section:"Repairing"})),
 ...secondHand.map(x=>({...x,__section:"Second Hand"})),
 ...accessories.map(x=>({...x,__section:"Accessories"}))
];}
function smartAnswerLanguage(q){const n=normalizeText(q);if(/[\u0900-\u097f]/.test(q))return "hi";if(/\b(kya|kitne|kaun|dikhao|batao|hai|hain|aaj|kal|naam|customer|data)\b/i.test(n))return "hinglish";return "en";}
function smartDateValue(x){
    const v=x?.createdAt;
    if(!v)return null;
    if(v?.toDate)return v.toDate();
    const d=v instanceof Date?v:new Date(v);
    return isNaN(d.getTime())?null:d;
}
function smartStartOfDay(d){const x=new Date(d);x.setHours(0,0,0,0);return x;}
function smartEndOfDay(d){const x=new Date(d);x.setHours(23,59,59,999);return x;}
function smartToday(){return smartStartOfDay(new Date());}
function smartRows(){return [
 ...customers.map(x=>({...x,__section:"Finance"})),
 ...repairing.map(x=>({...x,__section:"Repairing"})),
 ...secondHand.map(x=>({...x,__section:"Second Hand"})),
 ...accessories.map(x=>({...x,__section:"Accessories"}))
];}
function smartProfit(x){
    if(x.__section==="Repairing")return Number(x.profit??(Number(x.total??x.payment??0)-Number(x.partsPrice||0)));
    if(x.__section==="Second Hand")return Number(x.profit??(Number(x.salePrice||0)-Number(x.price||0)));
    if(x.__section==="Accessories")return Number(x.profit??((Number(x.salePrice||0)-Number(x.price||0))*Math.max(1,Number(x.quantity||1))));
    return Number(x.profit||0);
}
function smartSale(x){
    if(x.__section==="Finance")return Number(x.phoneAmount||0);
    if(x.__section==="Repairing")return Number(x.total??x.payment??0);
    if(x.__section==="Second Hand")return Number(x.salePrice||0);
    if(x.__section==="Accessories")return Number(x.salePrice||0)*Math.max(1,Number(x.quantity||1));
    return 0;
}
function smartMoney(n){return `₹${Number(n||0).toLocaleString("en-IN")}`;}
function smartDateText(d){return d?new Intl.DateTimeFormat("en-IN",{dateStyle:"medium"}).format(d):"—";}
function smartSameDay(row,d){const x=smartDateValue(row);return x&&x>=smartStartOfDay(d)&&x<=smartEndOfDay(d);}
function smartInRange(row,a,b){const x=smartDateValue(row);return x&&x>=a&&x<=b;}
function smartRangeFromQuery(q){
    const now=new Date(), today=smartToday(), n=normalizeText(q);
    if(/\b(आज|aaj|today|today s)\b/i.test(n))return [today,smartEndOfDay(today),"आज"];
    if(/\b(कल|kal|yesterday)\b/i.test(n)) {const d=new Date(today);d.setDate(d.getDate()-1);return [d,smartEndOfDay(d),"कल"];}
    if(/\b(परसों|parso|day before yesterday)\b/i.test(n)) {const d=new Date(today);d.setDate(d.getDate()-2);return [d,smartEndOfDay(d),"परसों"];}
    if(/(पिछले 7|last 7|this week|इस हफ्ते|इस सप्ताह|pichle 7)/i.test(n)){const a=new Date(today);a.setDate(a.getDate()-6);return [a,smartEndOfDay(today),"पिछले 7 दिन"];}
    if(/(पिछले 30|last 30)/i.test(n)){const a=new Date(today);a.setDate(a.getDate()-29);return [a,smartEndOfDay(today),"पिछले 30 दिन"];}
    if(/(इस महीने|this month|is mahine)/i.test(n)){return [new Date(now.getFullYear(),now.getMonth(),1),new Date(now.getFullYear(),now.getMonth()+1,0,23,59,59,999),"इस महीने"];}
    if(/(पिछले महीने|last month|pichle mahine)/i.test(n)){return [new Date(now.getFullYear(),now.getMonth()-1,1),new Date(now.getFullYear(),now.getMonth(),0,23,59,59,999),"पिछले महीने"];}
    if(/(इस साल|this year|is saal)/i.test(n)){return [new Date(now.getFullYear(),0,1),new Date(now.getFullYear(),11,31,23,59,59,999),"इस साल"];}
    if(/(जनवरी|january)/i.test(n))return [new Date(now.getFullYear(),0,1),new Date(now.getFullYear(),1,0,23,59,59,999),"जनवरी"];
    if(/(अगस्त|august)/i.test(n))return [new Date(now.getFullYear(),7,1),new Date(now.getFullYear(),8,0,23,59,59,999),"अगस्त"];
    const m=n.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/g);
    if(m&&m.length>=2){
        const p1=m[0].match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/),p2=m[1].match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
        const a=new Date(+p1[3],+p1[2]-1,+p1[1]),b=new Date(+p2[3],+p2[2]-1,+p2[1]);return [smartStartOfDay(a),smartEndOfDay(b),`${p1[1]}/${p1[2]}/${p1[3]} से ${p2[1]}/${p2[2]}/${p2[3]}`];
    }
    const one=n.match(/\b(\d{1,2})\s+(जनवरी|फरवरी|मार्च|अप्रैल|मई|जून|जुलाई|अगस्त|सितंबर|अक्टूबर|नवंबर|दिसंबर|january|february|march|april|may|june|july|august|september|october|november|december)\b/i);
    if(one){const months={जनवरी:0,फरवरी:1,मार्च:2,अप्रैल:3,मई:4,जून:5,जुलाई:6,अगस्त:7,सितंबर:8,अक्टूबर:9,नवंबर:10,दिसंबर:11,january:0,february:1,march:2,april:3,may:4,june:5,july:6,august:7,september:8,october:9,november:10,december:11};const d=new Date(now.getFullYear(),months[one[2].toLowerCase()],+one[1]);return [smartStartOfDay(d),smartEndOfDay(d),smartDateText(d)];}
    return null;
}
function smartLang(q){if(/[\u0900-\u097F]/.test(q))return "hi";if(/\b(kya|kitne|kitni|kitna|kaun|dikhao|batao|aaj|kal|mahina|hisab|profit|customer|phone|finance|repair|stock)\b/i.test(q))return "hinglish";return "en";}
function smartIntent(q){
    const n=normalizeText(q);
    const has=(...xs)=>xs.some(x=>n.includes(normalizeText(x)));
    if(has("customer code","ग्राहक कोड")||/\bkm\d{4}\b/i.test(n))return "customer_code";
    if(/\b\d{10,15}\b/.test(n))return "phone";
    if(has("imei"))return "imei";
    if(has("sn number","sn no","serial number","एसएन"))return "sn";
    if(has("finance company","financer","finance company"))return "finance_company";
    if(has("technician","repair by","repairing by","किसने phone repair","तकनीशियन"))return "technician";
    if(has("problem","क्या problem","कौन सी problem","समस्या"))return "problem";
    if(has("customer history","पूरी history","complete history","सारे transactions","all transactions","पहले क्या क्या","history"))return "history";
    if(has("compare","comparison","difference","difference between","comparison करो"))return "compare";
    if(/(सबसे ज्यादा|सबसे अधिक|सबसे कम|highest|most|least|top|maximum|minimum|best perform|सबसे अच्छा)/i.test(q))return "ranking";
    if(has("profit","मुनाफा","फायदा","कमाई","earning","जेब में","profit"))return "profit";
    if(has("sale","बिकी","बिका","बिके","sale हुई","sales"))return "sale";
    if(has("down payment","downpayment","डाउन payment"))return "downpayment";
    if(has("emi","ईएमआई"))return "emi";
    if(has("stock","available","उपलब्ध","कितने phones हैं","कितने phones")&&!has("repair","finance"))return "stock";
    if(has("accessor","accessories","accessory","एक्सेसरी"))return "accessories";
    if(has("second hand","used phone","पुराना phone","सेकंड हैंड"))return "second";
    if(has("repair","repairing","repairing work","मरम्मत","रिपेयर"))return "repair";
    if(has("finance","financed","finance हुए","फाइनेंस"))return "finance";
    if(has("customer","customers","ग्राहक","लोग","बंदे"))return "customer";
    if(has("report","summary","हिसाब","business","business activity","क्या हुआ","what happened","काम हुआ","work"))return "summary";
    return "search";
}
function smartEntityQuery(q){
    let s=String(q||"").trim();
    s=s.replace(/\b(show|find|search|give me|what is|what's|how many|how much|today|yesterday|tomorrow|complete|total|all|data|history|records|record|details|dikhao|batao|dikhाओ|ka|ki|ke|kaun|kitne|kitni|kitna|aaj|kal|pura|poora|hisab|do|mujhe|bhai|hai|hain|mein|me|का|की|के|है|हैं|कितने|कितनी|कितना|दिखाओ|बताओ|आज|कल|पूरा|पूरी|हिसाब|दो|मुझे|भाई)\b/gi," ");
    return normalizeText(s).replace(/\s+/g," ").trim();
}
function smartRowsForSection(section){const rows=smartRows();return section?rows.filter(x=>x.__section===section):rows;}
function smartRenderRows(r,filtered){r.innerHTML=filtered.slice(0,100).map(x=>`<article class="result"><div class="result-name">${esc(x.customerName||x.name||`${x.brand||""} ${x.model||x.device||"Record"}`.trim())}</div><div class="result-meta">${esc(x.__section||"")} • ${esc(x.phone||x.customerPhone||"")} • ${esc(formatDateTime(x))}</div><div class="result-grid">${item("Device",x.device||`${x.brand||""} ${x.model||""}`)}${item("IMEI / SN",x.imei||x.sn||"—")}${item("Amount",smartMoney(smartSale(x)))}${item("Profit",smartMoney(smartProfit(x)))}</div></article>`).join("");}
function smartAnswerText(lang,hi,hinglish,en){return lang==="hi"?hi:lang==="hinglish"?hinglish:en;}
/* =========================================================
   SMART SEARCH — MATHEMATICS / CALCULATOR ENGINE
   Supports examples like:
   3000x30% = 900
   30% of 3000 = 900
   3000 का 30% = 900
   (2500+500)*20% = 600
   2^10 = 1024
   ========================================================= */
function smartMathExpression(q){
    let s=String(q||'').trim();
    const hasMathMarker=/\d\s*(?:[+\-*/×÷xX^%]|\b(?:percent|percentage|प्रतिशत)\b)|(?:√|sqrt\s*\(|\b(?:percent|percentage|प्रतिशत)\b)|\d\s+(?:of|का|के|की)\s+\d/i.test(s);
    if(!hasMathMarker)return null;

    s=s.replace(/[×xX]/g,'*').replace(/÷/g,'/').replace(/−/g,'-').replace(/–/g,'-').replace(/√\s*(\d+(?:\.\d+)?)/g,'sqrt($1)');
    s=s.replace(/\b(percent|percentage|प्रतिशत)\b/gi,'%');
    // Natural-language percentage forms: "30% of 3000" and "3000 का 30%".
    s=s.replace(/(\d+(?:\.\d+)?\s*%)\s*(?:of|का|के|की)\s*(?=\d)/gi,'$1*');
    s=s.replace(/(\d+(?:\.\d+)?)\s*(?:of|का|के|की)\s*(\d+(?:\.\d+)?\s*%?)/gi,'$1*$2');

    // Remove common question words while keeping a safe mathematical alphabet.
    s=s.replace(/\b(?:what|what's|calculate|calculation|solve|answer|tell|me|please|how|much|is|equals|equal|find|result|kitna|kitne|kitni|hai|batao|nikalo|hoga|hogi|karo|kar|ka|ke|ki|mein|me|mujhe|do|bhai|hisaab|hisab|kya)\b/gi,' ');
    s=s.replace(/\s+/g,'');
    if(!s || !/[0-9]/.test(s))return null;
    // Only allow mathematical characters/functions. This prevents arbitrary code from ever reaching the parser.
    if(!/^(?:[0-9.+\-*/%^()]+|sqrt\()/i.test(s))return null;
    if(/[^0-9.+\-*/%^()a-z]/i.test(s) || /[a-z](?!sqrt)/i.test(s.replace(/sqrt/g,'')))return null;
    if(/(?:sqrt){2,}/i.test(s))return null;

    try{
        let i=0;
        const peek=()=>s[i]||'';
        const eat=c=>{if(s.slice(i,i+c.length).toLowerCase()===c.toLowerCase()){i+=c.length;return true}return false};
        const number=()=>{
            const start=i;while(/[0-9.]/.test(peek()))i++;
            const raw=s.slice(start,i);if(!raw||raw.split('.').length>2)throw new Error('number');
            const n=Number(raw);if(!Number.isFinite(n))throw new Error('number');return n;
        };
        const primary=()=>{
            if(eat('+'))return primary();
            if(eat('-'))return -primary();
            if(eat('(')){const v=additive();if(!eat(')'))throw new Error('paren');return v;}
            if(eat('sqrt')){if(!eat('('))throw new Error('sqrt');const v=additive();if(!eat(')')||v<0)throw new Error('sqrt');return Math.sqrt(v);}
            return number();
        };
        const power=()=>{let a=primary();if(eat('^')){const b=power();a=Math.pow(a,b);}return a;};
        const percent=()=>{let a=power();while(eat('%'))a/=100;return a;};
        const multiplicative=()=>{let a=percent();for(;;){if(eat('*'))a*=percent();else if(eat('/')){const b=percent();if(b===0)throw new Error('zero');a/=b;}else break;}return a;};
        const additive=()=>{let a=multiplicative();for(;;){if(eat('+'))a+=multiplicative();else if(eat('-'))a-=multiplicative();else break;}return a;};
        const result=additive();
        if(i!==s.length||!Number.isFinite(result))throw new Error('invalid');
        return {value:result,expression:s};
    }catch(e){return null;}
}
function smartMathFormat(n){
    const rounded=Math.abs(n-Math.round(n))<1e-10?Math.round(n):Number(n.toFixed(10));
    return Number(rounded).toLocaleString('en-IN',{maximumFractionDigits:10});
}

function smartSearch(){
    const q=val("universalSearchInput"),a=$("smartSearchAnswer"),r=$("smartSearchResults");if(!a||!r)return;
    const n=normalizeText(q);if(!n){a.innerHTML='<div class="empty">आप Hindi, Hinglish या English में कोई भी business question या mathematics calculation पूछ सकते हैं। जैसे: “आज का पूरा हिसाब बताओ”, “Aman की history दिखाओ”, “इस महीने profit कितना हुआ?”, “3000x30%”</div>';r.innerHTML="";return;}
    const math=smartMathExpression(q);
    if(math){
        const formatted=smartMathFormat(math.value);
        const lang=smartLang(q);
        const answer=smartAnswerText(lang,`उत्तर: ${formatted}`,`Answer: ${formatted}`,`Answer: ${formatted}`);
        a.innerHTML=`<div class="smart-answer-text">${esc(answer)}</div><div class="smart-answer-math">${esc(q.trim())} = <b>${esc(formatted)}</b></div>`;
        r.innerHTML="";
        return;
    }
    const lang=smartLang(q), rows=smartRows(), intent=smartIntent(q), range=smartRangeFromQuery(q), [start,end,label]=range||[null,null,""];
    let pool=start?rows.filter(x=>smartInRange(x,start,end)):rows, filtered=[], answer="";
    const today=smartToday(), yesterday=new Date(today);yesterday.setDate(yesterday.getDate()-1);
    const count=xs=>xs.length, sum=(xs,fn)=>xs.reduce((s,x)=>s+Number(fn(x)||0),0);
    const sectionName=intent==="finance"?"Finance":intent==="repair"?"Repairing":intent==="second"?"Second Hand":intent==="accessories"?"Accessories":null;
    if(intent==="customer"){
        const entityMode=/(data|history|find|search|show|details|दिखाओ|खोजो|history|पूरा)/i.test(q)&&!/(how many|कितने|कितनी|कितना|count|कितने आए|कितने customer)/i.test(q);
        if(entityMode){
            const term=smartEntityQuery(q).replace(/\b(customer|customers|ग्राहक|data|history|complete|पूरी|पूरा)\b/gi,"").trim();
            filtered=rows.filter(x=>normalizeText([x.customerName,x.customerCode,x.phone,x.customerPhone,x.imei,x.brand,x.model,x.device].join(" ")).includes(normalizeText(term)));
            answer=filtered.length?smartAnswerText(lang,`${filtered.length} matching customer records मिले हैं।`,`${filtered.length} matching customer records mile hain.`,`Found ${filtered.length} matching customer records.`):smartAnswerText(lang,"कोई matching customer record नहीं मिला।","Koi matching customer record nahi mila.","No matching customer record found.");
        }else{
        const isToday=range&&label==="आज", base=isToday?pool.filter(x=>x.__section==="Finance"):pool;
        filtered=base;
        if(/(पुराने|old customer|existing)/i.test(q)&&isToday){
            const todayPhones=new Set(customers.filter(x=>smartSameDay(x,today)).map(x=>String(x.phone||"")).filter(Boolean));
            const old=todayPhones.size?customers.filter(x=>smartSameDay(x,today)&&todayPhones.has(String(x.phone||""))).length:0;
            answer=smartAnswerText(lang,`आज ${old} पुराने customer records मिले।`,`Aaj ${old} purane customer records mile.`,`There were ${old} existing-customer records today.`);
        }else if(/(add|नए|आए|added|added today|लोग|बंदे)/i.test(q)) answer=smartAnswerText(lang,`आज ${count(pool.filter(x=>x.__section==="Finance"))} customer records हैं।`,`Aaj ${count(pool.filter(x=>x.__section==="Finance"))} customer records hain.`,`There are ${count(pool.filter(x=>x.__section==="Finance"))} customer records for today.`);
        else answer=smartAnswerText(lang,`कुल ${customers.length} customers हैं।`,`Total ${customers.length} customers hain.`,`There are ${customers.length} customers.`);
        }
    }else if(intent==="phone"){
        const term=(n.match(/\b\d{10,15}\b/)||[""])[0];filtered=rows.filter(x=>String(x.phone||x.customerPhone||"").replace(/\D/g,"").includes(term));answer=filtered.length?smartAnswerText(lang,`${filtered.length} records मिले हैं।`,` ${filtered.length} records mile hain.`,`Found ${filtered.length} records.`):smartAnswerText(lang,"इस number का कोई record नहीं मिला।","Is number ka koi record nahi mila.","No record found for this number.");
    }else if(intent==="finance_company"){
        filtered=pool.filter(x=>x.__section==="Finance");const m={};filtered.forEach(x=>{const k=x.financeCompany||"Unknown";m[k]=(m[k]||0)+1});const list=Object.entries(m).sort((a,b)=>b[1]-a[1]);answer=list.length?list.map((e,i)=>`${i+1}. ${e[0]} — ${e[1]} records`).join(" • "):"Finance company data नहीं मिला।";
    }else if(intent==="technician"){
        filtered=pool.filter(x=>x.__section==="Repairing");const m={};filtered.forEach(x=>{const k=x.repairBy||"Unknown";m[k]=(m[k]||0)+1});const list=Object.entries(m).sort((a,b)=>b[1]-a[1]);answer=list.length?list.map((e,i)=>`${i+1}. ${e[0]} — ${e[1]} jobs`).join(" • "):"Technician data नहीं मिला।";
    }else if(intent==="problem"){
        filtered=pool.filter(x=>x.__section==="Repairing");const m={};filtered.forEach(x=>{const k=x.problem||"Unknown";m[k]=(m[k]||0)+1});const list=Object.entries(m).sort((a,b)=>b[1]-a[1]);answer=list.length?list.map((e,i)=>`${i+1}. ${e[0]} — ${e[1]} records`).join(" • "):"Problem data नहीं मिला।";
    }else if(intent==="finance"){
        filtered=pool.filter(x=>x.__section==="Finance");
        const amt=sum(filtered,x=>x.phoneAmount), dp=sum(filtered,x=>x.downPayment), emi=sum(filtered,x=>x.emiAmount);
        answer=smartAnswerText(lang,`${label||"कुल"} ${filtered.length} finance records हैं। Phone amount ${smartMoney(amt)}, down payment ${smartMoney(dp)} और EMI ${smartMoney(emi)} है।`,`${label||"Total"} ${filtered.length} finance records hain. Phone amount ${smartMoney(amt)}, down payment ${smartMoney(dp)} aur EMI ${smartMoney(emi)} hai.`,`There are ${filtered.length} finance records. Phone amount ${smartMoney(amt)}, down payment ${smartMoney(dp)} and EMI ${smartMoney(emi)}.`);
        if(/company|कंपनी|company के सबसे ज्यादा/i.test(q)){const m={};filtered.forEach(x=>{const k=x.financeCompany||"Unknown";m[k]=(m[k]||0)+1});const top=Object.entries(m).sort((a,b)=>b[1]-a[1])[0];if(top)answer+=` ${top[0]} के सबसे ज्यादा ${top[1]} records हैं।`;}
    }else if(intent==="repair"){
        filtered=pool.filter(x=>x.__section==="Repairing");const total=sum(filtered,x=>x.total??x.payment), profit=sum(filtered,smartProfit), parts=sum(filtered,x=>x.partsPrice);
        answer=smartAnswerText(lang,`${label||"कुल"} ${filtered.length} repairing records हैं। Total ${smartMoney(total)}, parts ${smartMoney(parts)} और profit ${smartMoney(profit)} है।`,`${label||"Total"} ${filtered.length} repairing records hain. Total ${smartMoney(total)}, parts ${smartMoney(parts)} aur profit ${smartMoney(profit)} hai.`,`There are ${filtered.length} repairing records. Total ${smartMoney(total)}, parts ${smartMoney(parts)} and profit ${smartMoney(profit)}.`);
        if(intent==="repair"&&/technician|किसने|technician ने/i.test(q)){const m={};filtered.forEach(x=>{const k=x.repairBy||"Unknown";m[k]=(m[k]||0)+1});const top=Object.entries(m).sort((a,b)=>b[1]-a[1])[0];if(top)answer+=` ${top[0]} ने सबसे ज्यादा ${top[1]} repairing jobs किए।`;}
        if(/problem|समस्या/i.test(q)){const m={};filtered.forEach(x=>{const k=x.problem||"Unknown";m[k]=(m[k]||0)+1});const top=Object.entries(m).sort((a,b)=>b[1]-a[1])[0];if(top)answer+=` सबसे ज्यादा problem: ${top[0]} (${top[1]} records)।`;}
    }else if(intent==="second"){
        filtered=pool.filter(x=>x.__section==="Second Hand");const sale=sum(filtered,x=>x.salePrice),profit=sum(filtered,smartProfit);
        answer=smartAnswerText(lang,`${label||"कुल"} ${filtered.length} second-hand records हैं। Sale ${smartMoney(sale)} और profit ${smartMoney(profit)} है।`,`${label||"Total"} ${filtered.length} second-hand records hain. Sale ${smartMoney(sale)} aur profit ${smartMoney(profit)} hai.`,`There are ${filtered.length} second-hand records. Sale ${smartMoney(sale)} and profit ${smartMoney(profit)}.`);
    }else if(intent==="accessories"){
        filtered=pool.filter(x=>x.__section==="Accessories");const qty=sum(filtered,x=>x.quantity),sale=sum(filtered,x=>Number(x.salePrice||0)*Math.max(1,Number(x.quantity||1))),profit=sum(filtered,smartProfit);
        answer=smartAnswerText(lang,`${label||"कुल"} ${filtered.length} accessory records और ${qty} total quantity है। Sale ${smartMoney(sale)} और profit ${smartMoney(profit)} है।`,`${label||"Total"} ${filtered.length} accessory records aur ${qty} total quantity hai. Sale ${smartMoney(sale)} aur profit ${smartMoney(profit)} hai.`,`There are ${filtered.length} accessory records and ${qty} total quantity. Sale ${smartMoney(sale)} and profit ${smartMoney(profit)}.`);
    }else if(intent==="ranking"){
        const low=/(सबसे कम|सबसे कम price|least|minimum|lowest)/i.test(q), bySection=/(section|सेक्शन)/i.test(q), byModel=/(model|मॉडल|phone|फोन)/i.test(q), byBrand=/(brand|ब्रांड)/i.test(q), byTech=/(technician|repair by|किसने)/i.test(q), byCompany=/(finance company|company|कंपनी)/i.test(q), byAccessory=/(accessory|accessories|एक्सेसरी)/i.test(q), byDay=/(दिन|day|किस दिन)/i.test(q);
        const metricProfit=/(profit|मुनाफा|फायदा|कमाई|earning)/i.test(q), metricSale=/(sale|बिकी|बिका|बिके|sales)/i.test(q);
        if(bySection){const m={};rows.forEach(x=>{const k=x.__section;m[k]=(m[k]||0)+(metricProfit?smartProfit(x):smartSale(x));});const e=Object.entries(m).sort((a,b)=>low?a[1]-b[1]:b[1]-a[1])[0];answer=e?`${e[0]} ने ${metricProfit?"profit":"sale"} में ${smartMoney(e[1])} ${low?"(सबसे कम)":"(सबसे ज्यादा)"} दिया।`:"पर्याप्त data नहीं मिला.";filtered=rows;}
        else if(byTech){const m={};rows.filter(x=>x.__section==="Repairing").forEach(x=>{const k=x.repairBy||"Unknown";m[k]=(m[k]||0)+1});const e=Object.entries(m).sort((a,b)=>low?a[1]-b[1]:b[1]-a[1])[0];answer=e?`${e[0]} ने ${e[1]} repairing jobs किए।`:"Technician data नहीं मिला.";filtered=rows.filter(x=>x.__section==="Repairing");}
        else if(byCompany){const m={};rows.filter(x=>x.__section==="Finance").forEach(x=>{const k=x.financeCompany||"Unknown";m[k]=(m[k]||0)+1});const e=Object.entries(m).sort((a,b)=>low?a[1]-b[1]:b[1]-a[1])[0];answer=e?`${e[0]} के ${e[1]} finance records हैं।`:"Finance company data नहीं मिला.";filtered=rows.filter(x=>x.__section==="Finance");}
        else if(byAccessory){const m={};rows.filter(x=>x.__section==="Accessories").forEach(x=>{const k=x.name||"Unknown";m[k]=(m[k]||0)+Number(x.quantity||1)});const e=Object.entries(m).sort((a,b)=>low?a[1]-b[1]:b[1]-a[1])[0];answer=e?`${e[0]} की quantity ${e[1]} है।`:"Accessory data नहीं मिला.";filtered=rows.filter(x=>x.__section==="Accessories");}
        else if(byBrand||byModel){const m={};rows.forEach(x=>{const k=byBrand?(x.brand||"Unknown"):(x.model||x.device||"Unknown");m[k]=(m[k]||0)+1});const e=Object.entries(m).sort((a,b)=>low?a[1]-b[1]:b[1]-a[1])[0];answer=e?`${e[0]} के ${e[1]} records हैं।`:"Model/brand data नहीं मिला.";filtered=rows;}
        else if(byDay){const m={};rows.forEach(x=>{const d=smartDateValue(x);if(d){const k=d.toISOString().slice(0,10);m[k]=(m[k]||0)+1;}});const e=Object.entries(m).sort((a,b)=>low?a[1]-b[1]:b[1]-a[1])[0];answer=e?`${smartDateText(new Date(e[0]))} को ${e[1]} records हुए।`:"Date data नहीं मिला.";filtered=rows;}
        else {const m={};rows.forEach(x=>{const k=x.customerName||"Unknown";m[k]=(m[k]||0)+1});const e=Object.entries(m).sort((a,b)=>b[1]-a[1])[0];answer=e?`${e[0]} के ${e[1]} transactions/records हैं।`:"Ranking data नहीं मिला.";filtered=rows;}
    }else if(intent==="profit"||intent==="sale"||intent==="downpayment"||intent==="emi"){
        const xs=pool;let valNum=0, title="";
        if(intent==="profit"){valNum=sum(xs,smartProfit);title="profit";}
        if(intent==="sale"){valNum=sum(xs,smartSale);title="sale";}
        if(intent==="downpayment"){valNum=sum(xs.filter(x=>x.__section==="Finance"),x=>x.downPayment);title="down payment";}
        if(intent==="emi"){valNum=sum(xs.filter(x=>x.__section==="Finance"),x=>x.emiAmount);title="EMI";}
        answer=smartAnswerText(lang,`${label||"कुल"} ${title} ${smartMoney(valNum)} है।`,`${label||"Total"} ${title} ${smartMoney(valNum)} hai.`,`${label||"Total"} ${title} is ${smartMoney(valNum)}.`);
        filtered=xs;
    }else if(intent==="stock"){
        if(/(आज|aaj|today).*(आए|came|arrived)/i.test(q)){filtered=pool.filter(x=>smartSameDay(x,today));answer=smartAnswerText(lang,`आज ${filtered.length} phone/business records आए।`,`Aaj ${filtered.length} phone/business records aaye.`,`There were ${filtered.length} phone/business records today.`);}
        else {filtered=secondHandData.map(x=>({...x,__section:"Second Hand"}));const qStock=sum(filtered,x=>x.quantity||1);answer=smartAnswerText(lang,`Second Hand में ${filtered.length} phones/records और लगभग ${qStock} stock units हैं।`,`Second Hand mein ${filtered.length} phones/records aur lagbhag ${qStock} stock units hain.`,`There are ${filtered.length} second-hand phone records and about ${qStock} stock units.`);}
    }else if(intent==="history"||intent==="customer_code"||intent==="imei"||intent==="sn"||intent==="search"){
        let term=smartEntityQuery(q);
        if(intent==="customer_code"){const m=n.match(/\bkm\d{4}\b/i);if(m)term=m[0];}
        if(intent==="imei"){const m=n.match(/\b\d{10,18}\b/);if(m)term=m[0];}
        if(intent==="sn"){const m=n.match(/\b[a-z0-9-]{4,}\b/gi);if(m)term=m[m.length-1];}
        const needle=normalizeText(term||q).replace(/\b(aman|find|search)\b/g," ").trim();
        filtered=rows.filter(x=>normalizeText([x.customerName,x.customerCode,x.phone,x.customerPhone,x.imei,x.brand,x.model,x.device,x.problem,x.name,x.category,x.sn,x.financeCompany].join(" ")).includes(needle));
        if(!needle||filtered.length===0){
            filtered=rows.filter(x=>normalizeText([x.customerName,x.customerCode,x.phone,x.customerPhone,x.imei,x.brand,x.model,x.device,x.problem,x.name,x.category,x.sn,x.financeCompany].join(" ")).includes(normalizeText(q)));
        }
        answer=filtered.length?smartAnswerText(lang,`${filtered.length} matching records मिले हैं।`,`${filtered.length} matching records mile hain.`,`Found ${filtered.length} matching records.`):smartAnswerText(lang,"कोई matching record नहीं मिला।","Koi matching record nahi mila.","No matching record found.");
        if(intent==="history"&&filtered.length)answer+=smartAnswerText(lang," इस customer/identifier के जुड़े records नीचे हैं।"," Is customer/identifier ke jude records neeche hain."," Related records are shown below.");
    }else if(intent==="compare"){
        const aRows=rows.filter(x=>smartSameDay(x,today)),bRows=rows.filter(x=>smartSameDay(x,yesterday));const ap=sum(aRows,smartProfit),bp=sum(bRows,smartProfit),as=sum(aRows,smartSale),bs=sum(bRows,smartSale);
        answer=smartAnswerText(lang,`आज profit ${smartMoney(ap)} और कल ${smartMoney(bp)} था। Difference ${smartMoney(ap-bp)}। Sale आज ${smartMoney(as)}, कल ${smartMoney(bs)}।`,`Aaj profit ${smartMoney(ap)} aur kal ${smartMoney(bp)} tha. Difference ${smartMoney(ap-bp)}. Sale aaj ${smartMoney(as)}, kal ${smartMoney(bs)}.`,`Today profit was ${smartMoney(ap)} vs ${smartMoney(bp)} yesterday. Difference ${smartMoney(ap-bp)}. Sales: ${smartMoney(as)} vs ${smartMoney(bs)}.`);
    }else{
        const todayRows=rows.filter(x=>smartSameDay(x,today));const totalSale=sum(todayRows,smartSale),totalProfit=sum(todayRows,smartProfit),finance=todayRows.filter(x=>x.__section==="Finance").length,repair=todayRows.filter(x=>x.__section==="Repairing").length,second=todayRows.filter(x=>x.__section==="Second Hand").length,acc=todayRows.filter(x=>x.__section==="Accessories").length;
        filtered=todayRows;answer=smartAnswerText(lang,`आज की पूरी report: ${todayRows.length} records, Finance ${finance}, Repairing ${repair}, Second Hand ${second}, Accessories ${acc}, Sale/collection ${smartMoney(totalSale)}, Profit ${smartMoney(totalProfit)}।`,`Aaj ki puri report: ${todayRows.length} records, Finance ${finance}, Repairing ${repair}, Second Hand ${second}, Accessories ${acc}, Sale/collection ${smartMoney(totalSale)}, Profit ${smartMoney(totalProfit)}.`,`Today's complete report: ${todayRows.length} records, Finance ${finance}, Repairing ${repair}, Second Hand ${second}, Accessories ${acc}, Sales/collection ${smartMoney(totalSale)}, Profit ${smartMoney(totalProfit)}.`);
    }
    a.innerHTML=`<div class="smart-answer-text">${esc(answer)}</div>`;smartRenderRows(r,filtered);
}

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

// Desktop Enter navigation for Add Customer: move field-by-field, save after the last field.
function setupCustomerEnterNavigation(){
    const form=$("customerForm");
    if(!form || form.dataset.enterNavReady==="1")return;
    form.dataset.enterNavReady="1";
    form.addEventListener("keydown",e=>{
        if(e.key!=="Enter" || e.shiftKey || e.ctrlKey || e.metaKey)return;
        const target=e.target;
        if(!(target instanceof HTMLElement) || !["INPUT","SELECT","TEXTAREA"].includes(target.tagName))return;
        if(target.tagName==="TEXTAREA" && !target.dataset.singleLineEnter)return;
        e.preventDefault();
        const fields=[...form.querySelectorAll("input,select,textarea")].filter(el=>{
            if(el.disabled || el.type==="hidden" || el.closest(".hidden") || el.id==="customerCode")return false;
            const cs=getComputedStyle(el);
            return cs.display!=="none" && cs.visibility!=="hidden";
        });
        const i=fields.indexOf(target);
        if(i<0)return;
        const next=fields[i+1];
        if(next){ next.focus(); if(next.select && next.tagName==="INPUT" && next.type!=="date") next.select(); }
        else form.requestSubmit();
    });
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
   PHONE INVENTORY — PARTY / STOCK / INVOICE
========================================================= */
function invMoney(v){return `₹${Number(v||0).toLocaleString("en-IN")}`;}
function invDateValue(x){
    const v=x?.createdAt;
    if(v?.toDate)return v.toDate();
    if(v?.seconds)return new Date(v.seconds*1000);
    if(typeof v==="string")return new Date(v);
    if(v instanceof Date)return v;
    return new Date(0);
}
function invDate(d){return d&&d.getTime()?d.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}):"—";}
function invDateISO(d){const x=new Date(d);return isNaN(x)?"":x.toLocaleDateString("en-CA");}
function invAmountWords(n){
    n=Math.round(Number(n||0));
    if(n===0)return "Zero Rupees";
    const ones=["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
    const tens=["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
    const two=x=>x<20?ones[x]:tens[Math.floor(x/10)]+(x%10?" "+ones[x%10]:"");
    const under1000=x=>(x>=100?ones[Math.floor(x/100)]+" Hundred"+(x%100?" "+two(x%100):""):two(x));
    let out=[];if(n>=10000000){out.push(under1000(Math.floor(n/10000000))+" Crore");n%=10000000;}if(n>=100000){out.push(under1000(Math.floor(n/100000))+" Lakh");n%=100000;}if(n>=1000){out.push(under1000(Math.floor(n/1000))+" Thousand");n%=1000;}if(n)out.push(under1000(n));return out.join(" ")+" Rupees";
}
function inventoryShowTab(id){
    const pageMap={
        inventoryHome:"inventoryHomePage",
        inventoryPartySection:"inventoryPartyPage",
        inventoryStockSection:"inventoryStockPage",
        inventoryInvoiceSection:"inventoryInvoicePage"
    };
    if(id==="inventoryPartyDetailSection"){
        show("inventoryPartyPage");
        $("inventoryPartySection")?.classList.add("hidden");
        $("inventoryPartyDetailSection")?.classList.remove("hidden");
        renderInventoryPartyDetail();
        return;
    }
    const page=pageMap[id]||id;
    show(page);
    if(id==="inventoryHome")renderInventoryHome();
    if(id==="inventoryPartySection"){
        $("inventoryPartySection")?.classList.remove("hidden");
        $("inventoryPartyDetailSection")?.classList.add("hidden");
        renderInventoryParties();
    }
    if(id==="inventoryStockSection")renderInventoryStock();
    if(id==="inventoryInvoiceSection")renderInventoryInvoices();
}
function subscribeInventory(){
    if(window.__inventoryListenerStarted)return;window.__inventoryListenerStarted=true;
    onSnapshot(collection(db,INVENTORY_PHONE_COL),snap=>{inventoryPhones=snap.docs.map(d=>({id:d.id,...d.data()}));renderInventoryHome();renderInventoryStock();renderInventoryTransactionForm();},e=>console.warn("Inventory phones load:",e));
    onSnapshot(collection(db,INVENTORY_PARTY_COL),snap=>{inventoryParties=snap.docs.map(d=>({id:d.id,...d.data()}));renderInventoryParties();renderInventoryTransactionForm();},e=>console.warn("Inventory parties load:",e));
    onSnapshot(collection(db,INVENTORY_INVOICE_COL),snap=>{inventoryInvoices=snap.docs.map(d=>({id:d.id,...d.data()}));inventoryInvoices.sort((a,b)=>invDateValue(b)-invDateValue(a));renderInventoryInvoices();renderInventoryHome();},e=>console.warn("Inventory invoices load:",e));
}
function renderInventoryHome(){
    const total=inventoryPhones.length, available=inventoryPhones.filter(x=>x.status!=="sold").length, sold=inventoryPhones.filter(x=>x.status==="sold").length;
    const value=inventoryPhones.filter(x=>x.status!=="sold").reduce((n,x)=>n+Number(x.purchasePrice||0),0);
    $("invTotalPhones")&&($("invTotalPhones").textContent=String(total));$("invAvailablePhones")&&($("invAvailablePhones").textContent=String(available));$("invSoldPhones")&&($("invSoldPhones").textContent=String(sold));$("invStockValue")&&($("invStockValue").textContent=invMoney(value));
    const sales=inventoryInvoices.filter(x=>x.type==="sale").reduce((n,x)=>n+Number(x.total||0),0);
    const purchases=inventoryInvoices.filter(x=>x.type==="purchase").reduce((n,x)=>n+Number(x.total||0),0);
    const customerCount=getLifetimeCustomerDirectory().length;
    $("homeCustomerCount")&&($("homeCustomerCount").textContent=`${customerCount} Customers`);$("inventoryCustomerCount")&&($("inventoryCustomerCount").textContent=String(customerCount));$("invStockCount")&&($("invStockCount").textContent=String(total));
    const body=$("inventoryDashboardBody");if(!body)return;
    body.innerHTML=`<div class="inventory-summary-grid"><div><span>Total Phones</span><b>${total}</b></div><div><span>Available</span><b>${available}</b></div><div><span>Sold</span><b>${sold}</b></div><div><span>Customers</span><b>${customerCount}</b></div><div><span>Vendors</span><b>${inventoryParties.filter(x=>x.type==="vendor").length}</b></div><div><span>Purchase</span><b>${invMoney(purchases)}</b></div><div><span>Sales</span><b>${invMoney(sales)}</b></div><div><span>Invoices</span><b>${inventoryInvoices.length}</b></div></div>`;
}
async function editInventoryPartyCustomer(phone,name){
    if(enforceWriteLock())return;
    const oldPhone=normalizeDigits(phone),oldName=String(name||"").trim();
    const newName=prompt("Customer name",oldName);if(newName===null)return;
    const newPhoneRaw=prompt("Mobile number",oldPhone);if(newPhoneRaw===null)return;
    const newPhone=normalizeDigits(newPhoneRaw);
    if(!newName.trim()||!/^[0-9]{10}$/.test(newPhone)){alert("Valid name और 10 digit mobile number जरूरी है.");return;}
    const clash=customers.find(c=>normalizeDigits(c.phone)===newPhone&&String(c.customerName||"").trim().toLowerCase()!==newName.trim().toLowerCase());
    if(clash){alert("यह mobile number किसी दूसरे customer के साथ already linked है.");return;}
    try{
        const batches=[
            [COL,customers.filter(c=>normalizeDigits(c.phone)===oldPhone||String(c.customerName||"").trim().toLowerCase()===oldName.toLowerCase())],
            [REPAIR_COL,repairing.filter(c=>normalizeDigits(c.phone)===oldPhone||String(c.customerName||"").trim().toLowerCase()===oldName.toLowerCase())],
            [SECOND_COL,secondHand.filter(c=>normalizeDigits(c.phone)===oldPhone||String(c.customerName||"").trim().toLowerCase()===oldName.toLowerCase())],
            [ACCESSORY_COL,accessories.filter(c=>normalizeDigits(c.customerPhone)===oldPhone||String(c.customerName||"").trim().toLowerCase()===oldName.toLowerCase())]
        ];
        for(const [col,arr] of batches)for(const rec of arr){const data=col===ACCESSORY_COL?{customerName:newName.trim(),customerPhone:newPhone}:{customerName:newName.trim(),phone:newPhone};await updateDoc(doc(db,col,rec.id),data);}
        for(const inv of inventoryInvoices.filter(x=>normalizeDigits(x.partyPhone||x.customerPhone)===oldPhone)){await updateDoc(doc(db,INVENTORY_INVOICE_COL,inv.id),{partyName:newName.trim(),partyPhone:newPhone,customerName:newName.trim(),customerPhone:newPhone});}
        for(const ph of inventoryPhones.filter(x=>normalizeDigits(x.partyPhone||x.customerPhone)===oldPhone||String(x.customerName||"").trim().toLowerCase()===oldName.toLowerCase())){await updateDoc(doc(db,INVENTORY_PHONE_COL,ph.id),{partyName:newName.trim(),partyPhone:newPhone,customerName:newName.trim(),customerPhone:newPhone});}
        await audit("customer_edit",{section:"Inventory Party",customerName:newName.trim(),description:`Inventory party edited: ${oldName} / ${oldPhone} -> ${newName.trim()} / ${newPhone}`});
        showSuccessToast("Party Updated","Customer name और mobile successfully updated.");
        window.__inventoryPartyDetail={kind:"customer",phone:newPhone,name:newName.trim()};renderInventoryParties();renderInventoryPartyDetail();
    }catch(e){console.error(e);alert(e?.message||"Party update failed.");}
}

function renderInventoryParties(){
    const box=$("inventoryPartyResults");if(!box)return;const q=val("inventoryPartySearch").toLowerCase();
    const customersDir=getLifetimeCustomerDirectory().map(x=>({...x,kind:"customer"}));
    const vendors=inventoryParties.filter(x=>x.type==="vendor").map(x=>({name:x.name||"Vendor",phone:String(x.phone||"").replace(/\D/g,""),types:new Set(["Vendor"]),records:1,kind:"vendor",vendorId:x.id}));
    const map=new Map();[...customersDir,...vendors].forEach(x=>{const key=x.kind+"|"+(x.phone||x.name.toLowerCase());if(!map.has(key))map.set(key,x);});
    const rows=[...map.values()].filter(x=>!q||[x.name,x.phone,[...x.types].join(" ")].join(" ").toLowerCase().includes(q));
    $("inventoryCustomerCount")&&($("inventoryCustomerCount").textContent=String(customersDir.length));
    box.innerHTML=rows.length?rows.map(x=>`<article class="result inventory-party-result" data-party-kind="${x.kind}" data-phone="${esc(x.phone)}" data-name="${esc(x.name)}" data-vendor-id="${esc(x.vendorId||"")}"><div class="result-top"><div><div class="result-name">${esc(x.name)}</div><div class="result-meta">${esc(x.phone||"Phone not available")} • ${x.records||1} record${(x.records||1)===1?"":"s"}</div></div><span class="work-log-tag">${x.kind==="vendor"?"VENDOR":"CUSTOMER"}</span></div><div class="result-open-hint">Tap करके पूरा record / history देखें</div><button type="button" class="inventory-party-inline-edit" data-party-edit-phone="${esc(x.phone)}" data-party-edit-name="${esc(x.name||"")}">EDIT</button></article>`).join(""):"<div class=\"empty\">No customers / vendors found.</div>";
    box.querySelectorAll(".inventory-party-result").forEach(card=>card.addEventListener("click",()=>{
        if(card.dataset.partyKind==="vendor") showInventoryVendorDetail(card.dataset.vendorId);
        else showInventoryCustomerDetail(card.dataset.phone,card.dataset.name);
    }));
}
function showInventoryCustomerDetail(phone,name){window.__inventoryPartyDetail={kind:"customer",phone:String(phone||"").replace(/\D/g,""),name:name||"Customer"};inventoryShowTab("inventoryPartyDetailSection");}
function showInventoryVendorDetail(id){window.__inventoryPartyDetail={kind:"vendor",vendorId:id};inventoryShowTab("inventoryPartyDetailSection");}
function renderInventoryPartyDetail(){
    const body=$("inventoryPartyDetailBody"),title=$("inventoryPartyDetailTitle");if(!body||!title)return;
    const d=window.__inventoryPartyDetail||{};
    if(d.kind==="vendor"){
        const v=inventoryParties.find(x=>x.id===d.vendorId);if(!v){title.textContent="Vendor";body.innerHTML='<div class="empty">Vendor not found.</div>';return;}
        title.textContent=v.name||"Vendor";
        const purchases=inventoryInvoices.filter(x=>x.type==="purchase"&&x.partyId===v.id);
        body.innerHTML=`<div class="detail-grid">${detailItem("Party Type","Vendor")}${detailItem("Mobile",v.phone||"—")}${detailItem("Purchase Records",purchases.length)}${detailItem("Purchase Value",invMoney(purchases.reduce((n,x)=>n+Number(x.total||0),0)))}</div><div class="history-list">${purchases.map(x=>`<article class="history-row"><b>📥 Purchase Invoice</b><small>${esc(invDate(invDateValue(x)))}</small><span>${esc(x.invoiceNo||"—")} • ${invMoney(x.total)}</span></article>`).join("")||'<div class="empty">No purchase history found.</div>'}</div>`;
        return;
    }
    const groups=getUnifiedRecords(d.phone,d.name), finance=groups.finance,repair=groups.repair,second=groups.second,acc=groups.acc;
    const inventoryCustomerRows=inventoryInvoices.filter(x=>String(x.partyPhone||x.customerPhone||"").replace(/\D/g,"")===d.phone);
    title.textContent=d.name||"Customer";
    const editPartyButton=`<div class="inventory-party-edit-row"><button type="button" class="inventory-party-edit-btn" data-party-edit-phone="${esc(d.phone)}" data-party-edit-name="${esc(d.name||"")}">EDIT PARTY</button></div>`;
    const rows=[];
    finance.forEach(x=>rows.push(`<article class="history-row"><b>💳 Finance / Phone</b><small>${esc(formatDateTime(x))}</small><span>${esc(`${x.brand||""} ${x.model||""}`)} • IMEI ${esc(x.imei||"—")} • ₹${Number(x.phoneAmount||0).toLocaleString("en-IN")}</span></article>`));
    repair.forEach(x=>rows.push(`<article class="history-row"><b>🛠 Repairing</b><small>${esc(formatDateTime(x))}</small><span>${esc(x.device||"")} • ${esc(x.problem||"")} • Total ₹${Number(x.total ?? x.payment ?? 0).toLocaleString("en-IN")} • Parts ₹${Number(x.partsPrice||0).toLocaleString("en-IN")} • Profit ₹${Number(x.profit??(Number(x.total ?? x.payment ?? 0)-Number(x.partsPrice||0))).toLocaleString("en-IN")}</span></article>`));
    second.forEach(x=>rows.push(`<article class="history-row"><b>📱 Second Hand</b><small>${esc(formatDateTime(x))}</small><span>${esc(`${x.brand||""} ${x.model||x.device||""}`)} • IMEI ${esc(x.imei||"—")} • Profit ₹${Number(x.profit??(Number(x.salePrice||0)-Number(x.price||0))).toLocaleString("en-IN")}</span></article>`));
    acc.forEach(x=>rows.push(`<article class="history-row"><b>🎧 Accessories</b><small>${esc(formatDateTime(x))}</small><span>${esc(x.name||"")} • SN ${esc(x.sn||"—")} • Profit ₹${Number(x.profit??(Number(x.salePrice||0)-Number(x.price||0))).toLocaleString("en-IN")}</span></article>`));
    inventoryCustomerRows.forEach(x=>{const it=(x.items||[])[0]||{};rows.push(`<article class="history-row"><b>🧾 Inventory Sale</b><small>${esc(invDate(invDateValue(x)))}</small><span>${esc(`${it.brand||""} ${it.model||""}`)} • IMEI ${esc(it.imei||"—")} • Sale ₹${Number(x.total||0).toLocaleString("en-IN")}</span></article>`)});
    const total=finance.length+repair.length+second.length+acc.length+inventoryCustomerRows.length;
    body.innerHTML=editPartyButton+`<div class="detail-grid">${detailItem("Customer",d.name||"Customer")}${detailItem("Mobile",d.phone||"—")}${detailItem("Total Records",total)}${detailItem("Finance",finance.length)}${detailItem("Repairing",repair.length)}${detailItem("Second Hand",second.length)}${detailItem("Accessories",acc.length)}${detailItem("Inventory Records",inventoryCustomerRows.length)}</div><div class="history-list">${rows.join("")||'<div class="empty">इस customer का कोई history record नहीं मिला.</div>'}</div>`;
}
function renderInventoryStock(){
    const box=$("inventoryStockResults");if(!box)return;
    const total=inventoryPhones.length;$("invStockCount")&&($("invStockCount").textContent=String(total));
    const q=val("inventoryStockSearch").toLowerCase();
    let rows=inventoryPhones.filter(x=>{
        const condition=String(x.conditionType||x.phoneType||"used").toLowerCase()==="new"?"new":"used";
        const status=x.status==="sold"?"sold":"sell";
        return condition===inventoryStockFilter&&status===inventoryStockStatus;
    });
    rows=rows.filter(x=>!q||[x.brand,x.model,x.imei,x.ram,x.storage,x.colour,x.partyName,x.partyPhone,x.customerName,x.customerPhone,x.conditionType,x.status].join(" ").toLowerCase().includes(q));
    box.innerHTML=rows.length?rows.map(x=>{
        const sold=x.status==="sold";
        const isUsed=String(x.conditionType||x.phoneType||"used").toLowerCase()==="used"; const actions=sold?(isUsed?`<div class="inventory-stock-actions"><button type="button" class="inventory-stock-restock-btn" data-stock-restock="${esc(x.id)}">RESTOCK</button></div>`:""):`<div class="inventory-stock-actions"><button type="button" class="inventory-stock-sell-btn" data-stock-sell="${esc(x.id)}">SELL</button><button type="button" class="inventory-stock-delete-btn" data-stock-delete="${esc(x.id)}">DELETE</button></div>`;
        return `<article class="result inventory-stock-card"><div class="result-top"><div><div class="result-name">${esc(`${x.brand||""} ${x.model||"Phone"}`.trim())}</div><div class="result-meta">${esc(String(x.conditionType||x.phoneType||"Used").toUpperCase())} • ${sold?"SOLD":"AVAILABLE"}</div></div><span class="work-log-tag">${sold?"SOLD":"SELL"}</span></div><div class="result-grid">${item("IMEI",x.imei||"—")}${item("RAM / Storage",`${x.ram||"—"} / ${x.storage||"—"}`)}${item("Colour",x.colour||"—")}${item("Customer",x.customerName||x.partyName||"—")}${item("Mobile",x.customerPhone||x.partyPhone||"—")}${item("Purchase",invMoney(x.purchasePrice))}${item("Sale",x.salePrice?invMoney(x.salePrice):"—")}${item("Margin",x.salePrice?invMoney(Number(x.salePrice)-Number(x.purchasePrice||0)):"—")}</div>${actions}</article>`;
    }).join(""):"<div class=\"empty\">No inventory phones found.</div>";
    box.querySelectorAll("[data-stock-sell]").forEach(b=>b.addEventListener("click",()=>inventoryOpenSellForPhone(b.dataset.stockSell)));
    box.querySelectorAll("[data-stock-delete]").forEach(b=>b.addEventListener("click",()=>deleteInventoryPhone(b.dataset.stockDelete)));
    box.querySelectorAll("[data-stock-restock]").forEach(b=>b.addEventListener("click",()=>restockInventoryPhone(b.dataset.stockRestock)));
}
async function deleteInventoryPhone(id){
    if(enforceWriteLock())return;
    const phone=inventoryPhones.find(x=>x.id===id);if(!phone)return;
    const name=`${phone.brand||""} ${phone.model||"Phone"}`.trim();
    if(!confirm(`\"${name}\" को delete करें?\nयह Recently Deleted में चला जाएगा और 30 दिनों तक recover किया जा सकेगा.`))return;
    try{
        await deleteWithRecycle(INVENTORY_PHONE_COL,id,phone);
        await audit("inventory_phone_delete",{section:"Inventory Stock",customerName:phone.customerName||phone.partyName||"",description:`Inventory phone deleted: ${name}`,extra:{imei:phone.imei||"",inventoryId:id}});
        showSuccessToast("Deleted","Phone Recently Deleted में चला गया.");
        renderInventoryStock();
    }catch(err){console.error(err);alert(err?.message||"Phone delete नहीं हो पाया.");}
}
function inventoryOpenSellForPhone(id){
    const modal=$("inventorySellPurchaseModal");if(!modal)return;
    modal.classList.remove("hidden");
    renderInventoryTransactionForm("sell");
    setTimeout(()=>{
        const select=$("invSellPhone");if(select){select.value=id;inventorySellPreview();}
    },0);
}

function inventoryBrandOptions(){
    // Inventory में केवल phone/tablet brands रखें; remote catalog के
    // laptop/PC/other device brands यहाँ नहीं आएँगे.
    const brands=Object.keys(BRANDS||{}).sort((a,b)=>a.localeCompare(b));
    return '<option value="">Select brand</option>'+brands.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("");
}
function isInventoryPhoneTabletModel(name){
    const n=String(name||"").toLowerCase().trim();
    if(!n)return false;
    // केवल phone/tablet family रखें; laptop, PC, watch, TV, audio आदि हटाएँ.
    const blocked=/(\blaptop\b|\bnotebook\b|\bmacbook\b|\bchromebook\b|\bdesktop\b|\bworkstation\b|\bmini pc\b|\bmini-pc\b|\bmonitor\b|\bsmartwatch\b|\bwatch\b|\btv\b|\btelevision\b|\bearbuds?\b|\bheadphones?\b|\bheadset\b|\bprinter\b|\bcamera\b|\bprojector\b)/i;
    return !blocked.test(n);
}
function inventoryModelOptions(brand){
    const b=String(brand||"").trim();
    if(!b)return '<option value="">Select model</option>';
    const local=Object.keys(BRANDS?.[b]?.models||{});
    const key=Object.keys(remoteModelsByBrand||{}).find(k=>k.toLowerCase()===b.toLowerCase());
    const remote=key?(remoteModelsByBrand[key]||[]):[];
    const models=[...new Set([...local,...remote].filter(isInventoryPhoneTabletModel))];
    return '<option value="">Select model</option>'+models.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("");
}
function inventoryColourOptions(brand,model){
    const colours=BRANDS?.[brand]?.models?.[model]||[];
    const fallback=["Black","White","Blue","Green","Red","Silver","Gold"];
    const list=[...new Set(colours.length?colours:fallback)];
    return '<option value="">Select colour</option>'+list.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("");
}
const INVENTORY_MODEL_STORAGE_OVERRIDES={
    "Apple|iPhone 17":["256 GB","512 GB","1 TB"],
    "Apple|iPhone 17 Pro":["256 GB","512 GB","1 TB"],
    "Apple|iPhone 17 Pro Max":["256 GB","512 GB","1 TB"],
    "Apple|iPhone Air":["256 GB","512 GB","1 TB"],
    "Apple|iPhone 16":["128 GB","256 GB","512 GB"],
    "Apple|iPhone 16 Plus":["128 GB","256 GB","512 GB"],
    "Apple|iPhone 16 Pro":["128 GB","256 GB","512 GB","1 TB"],
    "Apple|iPhone 16 Pro Max":["256 GB","512 GB","1 TB"]
};
function inventoryStorageForModel(brand,model){
    return INVENTORY_MODEL_STORAGE_OVERRIDES[`${brand}|${model}`] || BRANDS?.[brand]?.models?.[model]?.storage || BRANDS?.[brand]?.storage || ["64 GB","128 GB","256 GB","512 GB","1 TB"];
}
function inventoryRamStorageOptions(brand,model){
    const storage=inventoryStorageForModel(brand,model);
    // Apple/iPhone में user ने model-specific storage मांगा है; RAM को fixed/hidden रखते हुए केवल storage दिखाएं.
    if(String(brand).toLowerCase()==="apple" && /^iphone\b/i.test(String(model||""))) return '<option value="">Select Storage</option>'+storage.map(st=>`<option value="${esc(st)}">${esc(st)}</option>`).join("");
    const rams=["4 GB","6 GB","8 GB","12 GB","16 GB"];
    return '<option value="">Select RAM / Storage</option>'+rams.flatMap(r=>storage.map(st=>{const v=`${r} / ${st}`;return `<option value="${esc(v)}">${esc(v)}</option>`;})).join("");
}
function inventoryRefreshPurchaseSelectors(){
    const brand=$("invPurchaseBrand"),model=$("invPurchaseModel"),ramStorage=$("invPurchaseRamStorage"),colour=$("invPurchaseColour");
    if(!brand||!model)return;
    const currentBrand=brand.value,currentModel=model.value,currentRS=ramStorage?.value,currentColour=colour?.value;
    brand.innerHTML=inventoryBrandOptions();if(currentBrand)brand.value=currentBrand;
    model.innerHTML=inventoryModelOptions(brand.value);if(currentModel&&[...model.options].some(o=>o.value===currentModel))model.value=currentModel;
    if(ramStorage){ramStorage.innerHTML=inventoryRamStorageOptions(brand.value,model.value);if(currentRS)ramStorage.value=currentRS;}
    if(colour){colour.innerHTML=inventoryColourOptions(brand.value,model.value);if(currentColour)colour.value=currentColour;}
}
function inventoryPartyOptions(type,includeBlank=true){
    const list=inventoryParties.filter(x=>!type||x.type===type);return (includeBlank?'<option value="">Select party</option>':"")+list.map(x=>`<option value="${esc(x.id)}">${esc(x.name)} • ${esc(x.phone||"")}</option>`).join("");
}
function inventorySetPurchaseConditionVisibility(){
    const type=val("invPurchaseType"),wrap=$("invPurchaseConditionWrap");if(wrap)wrap.classList.toggle("hidden",type!=="used");
}
function renderInventoryTransactionForm(mode){
    const box=$("inventoryTransactionFormBox");if(!box)return;
    if(!mode)mode=box.dataset.mode||"purchase";
    box.dataset.mode=mode;
    if(mode==="purchase"){
        box.innerHTML=`<form id="inventoryPurchaseForm"><div class="inventory-form-title">📥 Purchase Phone</div><label>Customer Name<input id="invPurchaseCustomerName" required placeholder="Customer name"></label><label>Mobile Number<input id="invPurchaseCustomerPhone" required type="tel" inputmode="tel" maxlength="10" placeholder="10 digit mobile number"></label><label>Used / New<select id="invPurchaseType" required><option value="used">Used</option><option value="new">New</option></select></label><label id="invPurchaseConditionWrap">Condition<select id="invPurchaseCondition"><option value="Excellent">Excellent</option><option value="Good" selected>Good</option><option value="Fair">Fair</option><option value="Damaged">Damaged</option></select></label><label>Brand<select id="invPurchaseBrand" required>${inventoryBrandOptions()}</select></label><label>Model<select id="invPurchaseModel" required>${inventoryModelOptions("")}</select></label><label>IMEI<div class="with-button"><input id="invPurchaseImei" inputmode="numeric" maxlength="15" required placeholder="15 digit IMEI"><button class="inventory-scan-button" data-scan-target="invPurchaseImei" type="button">▣ Scan</button></div><small id="invPurchaseImeiError" class="imei-error hidden"></small></label><label>RAM / Storage<select id="invPurchaseRamStorage" required>${inventoryRamStorageOptions("","")}</select></label><label>Colour<select id="invPurchaseColour" required>${inventoryColourOptions("","")}</select></label><label>Purchase Price<input id="invPurchasePrice" type="number" min="0" inputmode="decimal" required placeholder="Purchase price"></label><label>Selling Price<input id="invPurchaseSellingPrice" type="number" min="0" inputmode="decimal" required placeholder="Selling price"></label><div id="inventoryMarginBox" class="bill-box"><span><strong>Margin</strong><small>Selling Price − Purchase Price</small></span><em id="invPurchaseMargin">₹0</em></div><button class="save" type="submit">SAVE PURCHASE</button><p id="inventoryTransactionMessage" class="message"></p></form>`;
        inventoryRefreshPurchaseSelectors();inventorySetPurchaseConditionVisibility();
        loadAllPhoneModels().then(inventoryRefreshPurchaseSelectors);
        $("invPurchaseType")?.addEventListener("change",inventorySetPurchaseConditionVisibility);
        $("invPurchaseBrand")?.addEventListener("change",()=>{inventoryRefreshPurchaseSelectors();});
        $("invPurchaseModel")?.addEventListener("change",()=>{inventoryRefreshPurchaseSelectors();});
        $("invPurchaseImei")?.addEventListener("input",()=>setInventoryImeiState("invPurchaseImei","invPurchaseImeiError"));
        $("invPurchaseCustomerPhone")?.addEventListener("input",()=>syncCustomerFields("invPurchaseCustomerName","invPurchaseCustomerPhone"));
        $("invPurchaseCustomerName")?.addEventListener("input",()=>syncCustomerFields("invPurchaseCustomerName","invPurchaseCustomerPhone"));
        const calc=()=>{const p=Number(val("invPurchasePrice")||0),s=Number(val("invPurchaseSellingPrice")||0),m=s-p;$("invPurchaseMargin")&&($("invPurchaseMargin").textContent=`${invMoney(m)} (${p>0?((m/p)*100).toFixed(1):"0.0"}%)`);};
        $("invPurchasePrice")?.addEventListener("input",calc);$("invPurchaseSellingPrice")?.addEventListener("input",calc);
        $("inventoryPurchaseForm")?.addEventListener("submit",saveInventoryPurchase);
    }else{
        const available=inventoryPhones.filter(x=>x.status!=="sold");
        box.innerHTML=`<form id="inventorySellForm"><div class="inventory-form-title">📤 Sell Phone</div><label>Select Available Phone<select id="invSellPhone" required><option value="">Tap करके available stock select करें</option>${available.map(x=>`<option value="${esc(x.id)}">${esc(`${x.brand||""} ${x.model||"Phone"}`)} • IMEI ${esc(x.imei||"—")} • ${esc(String(x.conditionType||x.phoneType||"USED").toUpperCase())} • ${invMoney(x.salePrice||x.sellingPrice||x.purchasePrice)}</option>`).join("")}</select></label><div id="inventorySellPhonePreview" class="inventory-selected-phone">Available stock select करने पर पूरा phone detail यहाँ दिखेगा.</div><label>Customer Name<input id="invSellCustomerName" required placeholder="Customer name"></label><label>Mobile Number<input id="invSellCustomerPhone" required type="tel" inputmode="tel" maxlength="10" placeholder="10 digit mobile number"></label><label>Sell Amount<input id="invSellPrice" type="number" min="0" inputmode="decimal" required placeholder="Sale amount"></label><label>Invoice Date<input id="invSellDate" type="date" value="${invDateISO(new Date())}"></label><button class="save" type="submit">SAVE SALE + CREATE INVOICE</button><p id="inventoryTransactionMessage" class="message"></p></form>`;
        $("invSellPhone")?.addEventListener("change",inventorySellPreview);
        $("invSellCustomerPhone")?.addEventListener("input",()=>syncCustomerFields("invSellCustomerName","invSellCustomerPhone"));
        $("invSellCustomerName")?.addEventListener("input",()=>syncCustomerFields("invSellCustomerName","invSellCustomerPhone"));
        $("inventorySellForm")?.addEventListener("submit",saveInventorySale);
    }
}
function inventorySellPreview(){
    const x=inventoryPhones.find(r=>r.id===val("invSellPhone")),box=$("inventorySellPhonePreview");if(!box)return;
    box.innerHTML=x?`<b>${esc(`${x.brand||""} ${x.model||"Phone"}`)}</b><small>IMEI ${esc(x.imei||"—")} • ${esc(x.ram||"—")} / ${esc(x.storage||"—")} • ${esc(x.colour||"—")} • ${esc(String(x.conditionType||x.phoneType||"USED").toUpperCase())}</small><small>Purchase ₹${Number(x.purchasePrice||0).toLocaleString("en-IN")} • Suggested Sell ₹${Number(x.salePrice||x.sellingPrice||x.purchasePrice||0).toLocaleString("en-IN")}</small>`:"";
    if(x&&$("invSellPrice"))$("invSellPrice").value=x.salePrice||x.sellingPrice||x.purchasePrice||"";
}
function parseInventoryRamStorage(v){const raw=String(v||"").trim();if(/^\d+\s*GB$|^\d+\s*TB$/i.test(raw))return {ram:"",storage:raw};const parts=raw.split("/");return {ram:(parts[0]||"").trim(),storage:(parts.slice(1).join("/")||"").trim()};}
function inventoryDateKey(dateLike){
    const d=dateLike instanceof Date?new Date(dateLike):new Date(dateLike||Date.now());
    if(Number.isNaN(d.getTime()))return todayISO().replace(/-/g,"/");
    const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");
    return `${y}/${m}/${day}`;
}
function nextInventoryInvoiceNo(dateLike){
    const key=inventoryDateKey(dateLike);
    let max=0;
    for(const x of inventoryInvoices){
        if(x.type!=="sale")continue;
        const m=String(x.invoiceNo||"").match(/^INV-(\d{4}\/\d{2}\/\d{2})-(\d{2,})$/);
        if(m&&m[1]===key)max=Math.max(max,Number(m[2])||0);
        else {
            const d=invDateValue(x);
            if(inventoryDateKey(d)===key){
                const old=String(x.invoiceNo||"").match(/-(\d+)$/);
                if(old)max=Math.max(max,Number(old[1])||0);
            }
        }
    }
    return `INV-${key}-${String(max+1).padStart(2,"0")}`;
}
function nextInventorySerial(){
    let max=0;
    for(const x of inventoryInvoices){
        for(const it of (x.items||[])){
            const m=String(it.sn||"").match(/^KM(\d+)$/i);
            if(m)max=Math.max(max,Number(m[1])||0);
        }
    }
    return `KM${String(max+1).padStart(3,"0")}`;
}
async function restockInventoryPhone(id){
    if(enforceWriteLock())return;
    const phone=inventoryPhones.find(x=>x.id===id);
    if(!phone||phone.status!=="sold"||String(phone.conditionType||phone.phoneType||"used").toLowerCase()!=="used")return;
    const name=`${phone.brand||""} ${phone.model||"Phone"}`.trim();
    if(!confirm(`\"${name}\" को Restock करें?\nयह phone SOLD से वापस SELL/AVAILABLE में आ जाएगा.`))return;
    try{
        await updateDoc(doc(db,INVENTORY_PHONE_COL,id),{status:"in_stock",salePrice:0,soldToPartyId:null,soldToPartyName:null,soldToPartyPhone:null,customerName:phone.partyName||null,customerPhone:phone.partyPhone||null,soldAt:null,updatedAt:serverTimestamp(),updatedBy:user?.uid||null,restockedAt:serverTimestamp()});
        await audit("inventory_phone_restock",{section:"Inventory Stock",customerName:phone.customerName||phone.partyName||"",description:`Inventory phone restocked: ${name}`,extra:{imei:phone.imei||"",inventoryId:id}});
        showSuccessToast("Restocked","Phone अब SELL / AVAILABLE stock में आ गया.");
        inventoryStockFilter="used";inventoryStockStatus="sell";
        document.querySelectorAll("[data-stock-condition]").forEach(x=>x.classList.toggle("active",x.dataset.stockCondition==="used"));
        document.querySelectorAll("[data-stock-status]").forEach(x=>x.classList.toggle("active",x.dataset.stockStatus==="sell"));
        renderInventoryStock();
    }catch(err){console.error(err);alert(err?.message||"Restock failed.");}
}
function normalizeDigits(v){return String(v||"").replace(/\D/g,"");}
function inventoryImeiExists(imei,excludeInventoryId="",excludeCustomerId="",excludeSecondHandId=""){
    const n=normalizeDigits(imei);if(!n)return false;
    return inventoryPhones.some(x=>x.id!==excludeInventoryId&&normalizeDigits(x.imei)===n) || customers.some(x=>x.id!==excludeCustomerId&&normalizeDigits(x.imei)===n) || secondHand.some(x=>x.id!==excludeSecondHandId&&normalizeDigits(x.imei)===n);
}
function setInventoryImeiState(inputId,messageId){
    const el=$(inputId),msgEl=$(messageId);if(!el)return true;const duplicate=inventoryImeiExists(el.value);
    el.classList.toggle("imei-duplicate",duplicate);
    if(msgEl){msgEl.textContent=duplicate?"THIS IMEI ALREADY IN STOCK":"";msgEl.classList.toggle("hidden",!duplicate);}
    return !duplicate;
}
async function saveInventoryPurchase(e){
    e.preventDefault();if(enforceWriteLock("inventoryTransactionMessage"))return;
    const phone=val("invPurchaseCustomerPhone").replace(/\D/g,""),rs=parseInventoryRamStorage(val("invPurchaseRamStorage"));
    const purchase=Number(val("invPurchasePrice")||0),selling=Number(val("invPurchaseSellingPrice")||0);
    const data={partyId:null,partyName:val("invPurchaseCustomerName"),partyPhone:phone,customerName:val("invPurchaseCustomerName"),customerPhone:phone,partyType:"customer",phoneType:val("invPurchaseType"),conditionType:val("invPurchaseType"),condition:val("invPurchaseCondition"),brand:val("invPurchaseBrand"),model:val("invPurchaseModel"),imei:val("invPurchaseImei").replace(/\D/g,""),ram:rs.ram,storage:rs.storage,colour:val("invPurchaseColour"),purchasePrice:purchase,salePrice:selling,sellingPrice:selling,margin:selling-purchase,status:"in_stock",createdAt:serverTimestamp(),createdBy:user?.uid||null};
    if(!data.partyName||!/^[0-9]{10}$/.test(phone)||!data.brand||!data.model||!/^[0-9]{15}$/.test(data.imei)||purchase<0||selling<0){msg("inventoryTransactionMessage","Customer name, 10 digit mobile, brand, model, 15 digit IMEI और prices सही भरें.");return;}
    if(inventoryImeiExists(data.imei)){setInventoryImeiState("invPurchaseImei","invPurchaseImeiError");msg("inventoryTransactionMessage","THIS IMEI ALREADY IN STOCK");return;}
    try{
        const added=await addDoc(collection(db,INVENTORY_PHONE_COL),data);
        const invoice={invoiceNo:nextInventoryInvoiceNo(new Date()),type:"purchase",date:new Date().toISOString(),partyId:null,partyName:data.partyName,partyPhone:phone,customerName:data.customerName,customerPhone:phone,items:[{inventoryId:added.id,brand:data.brand,model:data.model,imei:data.imei,ram:data.ram,storage:data.storage,colour:data.colour,quantity:1,rate:purchase,amount:purchase,sn:""}],total:purchase,amountWords:invAmountWords(purchase),createdAt:serverTimestamp(),createdBy:user?.uid||null};
        await addDoc(collection(db,INVENTORY_INVOICE_COL),invoice);await audit("inventory_purchase",{section:"Inventory",customerName:data.partyName,description:`Phone purchased: ${data.brand} ${data.model}`,extra:{imei:data.imei,amount:purchase,customerPhone:phone,condition:data.condition}});
        showSuccessToast("Purchase Saved","Phone stock में add हो गया और invoice बन गया.");renderInventoryTransactionForm("purchase");
    }catch(err){console.error(err);msg("inventoryTransactionMessage",err?.message||"Purchase save failed.");}
}
async function saveInventorySale(e){
    e.preventDefault();if(enforceWriteLock("inventoryTransactionMessage"))return;
    const phone=inventoryPhones.find(x=>x.id===val("invSellPhone"));const customerName=val("invSellCustomerName"),customerPhone=val("invSellCustomerPhone").replace(/\D/g,"");const sale=Number(val("invSellPrice")||0);
    if(!phone||phone.status==="sold"||!customerName||!/^[0-9]{10}$/.test(customerPhone)||sale<0){msg("inventoryTransactionMessage","Available phone, customer name, valid 10 digit mobile और sell amount सही भरें.");return;}
    try{
        await updateDoc(doc(db,INVENTORY_PHONE_COL,phone.id),{status:"sold",salePrice:sale,soldToPartyId:null,soldToPartyName:customerName,soldToPartyPhone:customerPhone,customerName,customerPhone,soldAt:serverTimestamp(),updatedBy:user?.uid||null});
        const invoice={invoiceNo:nextInventoryInvoiceNo(val("invSellDate")||new Date()),type:"sale",date:new Date(val("invSellDate")||new Date()).toISOString(),partyId:null,partyName:customerName,partyPhone:customerPhone,customerName,customerPhone,items:[{inventoryId:phone.id,brand:phone.brand,model:phone.model,imei:phone.imei,ram:phone.ram,storage:phone.storage,colour:phone.colour,quantity:1,rate:sale,amount:sale,sn:nextInventorySerial()}],total:sale,amountWords:invAmountWords(sale),createdAt:serverTimestamp(),createdBy:user?.uid||null};
        const invRef=await addDoc(collection(db,INVENTORY_INVOICE_COL),invoice);await audit("inventory_sale",{section:"Inventory",customerName,description:`Phone sold: ${phone.brand||""} ${phone.model||""}`,extra:{imei:phone.imei,amount:sale,customerPhone}});
        showSuccessToast("Sale Saved","Stock में SOLD और Invoice में save हो गया.");
        inventoryInvoicePreviewId=invRef.id;$("inventorySellPurchaseModal")?.classList.add("hidden");renderInventoryTransactionForm("sell");openInventoryInvoicePreview(invRef.id);
    }catch(err){console.error(err);msg("inventoryTransactionMessage",err?.message||"Sale save failed.");}
}

function renderInventoryInvoices(){
    const box=$("inventoryInvoiceResults");if(!box)return;
    const q=val("inventoryInvoiceSearch").toLowerCase();const now=new Date();now.setHours(0,0,0,0);
    let rows=inventoryInvoices.filter(x=>x.type==="sale").filter(x=>{const d=invDateValue(x);const day=new Date(d);day.setHours(0,0,0,0);if(inventoryInvoiceRange==="today")return day.getTime()===now.getTime();if(inventoryInvoiceRange==="yesterday"){const y=new Date(now);y.setDate(y.getDate()-1);return day.getTime()===y.getTime();}if(inventoryInvoiceRange==="week"){const from=new Date(now);from.setDate(from.getDate()-6);return day>=from;}if(inventoryInvoiceRange==="month")return day.getMonth()===now.getMonth()&&day.getFullYear()===now.getFullYear();return true;});
    rows=rows.filter(x=>!q||[x.invoiceNo,x.partyName,x.partyPhone,x.type,(x.items||[]).map(i=>[i.brand,i.model,i.imei].join(" ")).join(" ")].join(" ").toLowerCase().includes(q));
    if($("inventoryInvoiceCount"))$("inventoryInvoiceCount").textContent=rows.length;
    box.innerHTML=rows.length?rows.map(x=>{const item0=(x.items||[])[0]||{};return `<article class="inventory-invoice-card"><div class="inventory-invoice-main"><div class="inventory-invoice-device">${esc(`${item0.brand||""} ${item0.model||"Phone"}`.trim())}</div><div class="inventory-invoice-no">${esc(x.invoiceNo||"—")}</div><div class="inventory-invoice-party">👤 ${esc(x.partyName||"—")}<br>📱 ${esc(x.partyPhone||"—")}</div><b class="inventory-invoice-type">SALE INVOICE</b><div class="inventory-invoice-total">${invMoney(x.total)}</div><small class="inventory-invoice-label">Bill Total Amount</small></div><div class="inventory-invoice-footer"><button type="button" class="inventory-bill-btn" data-invoice-preview="${esc(x.id)}">⬇ Bill</button><button type="button" class="inventory-edit-btn" data-invoice-edit="${esc(x.id)}">EDIT</button><button type="button" class="inventory-delete-btn" data-invoice-delete="${esc(x.id)}">DELETE</button></div></article>`}).join(""):"<div class=\"empty\">No sale invoices found.</div>";
    box.querySelectorAll("[data-invoice-preview]").forEach(b=>b.addEventListener("click",()=>openInventoryInvoicePreview(b.dataset.invoicePreview)));
    box.querySelectorAll("[data-invoice-edit]").forEach(b=>b.addEventListener("click",()=>editInventoryInvoice(b.dataset.invoiceEdit)));
    box.querySelectorAll("[data-invoice-delete]").forEach(b=>b.addEventListener("click",()=>deleteInventoryInvoice(b.dataset.invoiceDelete)));
}
async function editInventoryInvoice(id){
    const inv=inventoryInvoices.find(x=>x.id===id);if(!inv)return;
    const item=(inv.items||[])[0]||{};
    const name=prompt("Customer name",inv.partyName||inv.customerName||"");if(name===null)return;
    const phone=prompt("Mobile number",inv.partyPhone||inv.customerPhone||"");if(phone===null)return;
    const amount=prompt("Sale amount",String(inv.total||0));if(amount===null)return;
    const sale=Number(amount);if(!Number.isFinite(sale)||sale<0){alert("Invalid sale amount");return;}
    const date=prompt("Invoice date (YYYY-MM-DD)",invDateISO(invDateValue(inv)));if(date===null)return;
    try{await updateDoc(doc(db,INVENTORY_INVOICE_COL,id),{partyName:name.trim(),partyPhone:phone.replace(/\D/g,""),customerName:name.trim(),customerPhone:phone.replace(/\D/g,""),date:new Date(date).toISOString(),total:sale,amountWords:invAmountWords(sale),items:[{...item,rate:sale,amount:sale}]});showSuccessToast("Invoice Updated","Sale invoice successfully updated.");}
    catch(e){console.error(e);alert(e?.message||"Invoice update failed.");}
}
async function deleteInventoryInvoice(id){
    const inv=inventoryInvoices.find(x=>x.id===id);if(!inv)return;
    if(!confirm(`Invoice ${inv.invoiceNo||""} को delete करें?`))return;
    try{await deleteWithRecycle(INVENTORY_INVOICE_COL,id,inv);await audit("inventory_invoice_delete",{section:"Inventory",invoiceNo:inv.invoiceNo,description:"Sale invoice moved to Recently Deleted"});showSuccessToast("Invoice Deleted","Invoice Recently Deleted में चला गया.");renderInventoryInvoices();}
    catch(e){console.error(e);alert(e?.message||"Invoice delete failed.");}
}
function openInventoryInvoicePreview(id){
    const inv=inventoryInvoices.find(x=>x.id===id);if(!inv)return;inventoryInvoicePreviewId=id;const it=(inv.items||[])[0]||{};const total=Number(inv.total||0);
    const shopPhone="7247345495",gstin="Chhattisgarh",shopAddress="Shop no EG13 rajive plaza near old Bus stand bilaspur";
    const terms=`(1). सेकंड हैंड मोबाइल में काउंटर छोड़ने के बाद किसी भी तरह की वारंटी - गारंटी नहीं होती है। कृपया चेक करके ले जाएं।   (2). बिका हुआ माल वापस नहीं होगा और न ही बदला जायेगा।   (3). अगर आप किसी भी सेकंड हैंड फोन को वापसी या बदली करवाते हैं तो आपका 30% से 40% रु. कट जायेगा।   (4). नए मोबाइल की वारंटी सर्विस सेंटर से ही मिलेगी।`;
    $("inventoryInvoicePreview").innerHTML=`<div class="print-invoice" id="printableInventoryInvoice"><div class="invoice-border"><div class="invoice-head"><div><b>GSTIN : </b>${esc(gstin)}</div><div class="invoice-shop-title">KABIR MOBILE</div><div>${shopPhone}</div><div></div><div class="invoice-address">${esc(shopAddress)}</div></div><div class="invoice-details"><div><u>Invoice Details</u><p><b>Invoice No :</b> ${esc(inv.invoiceNo||"")}</p><p><b>Date :</b> ${invDate(invDateValue(inv))}</p></div><div><p><b>Name :</b> ${esc(inv.partyName||"")}</p><p><b>Contact :</b> ${esc(inv.partyPhone||"")}</p></div></div><table class="invoice-table"><thead><tr><th>S No.</th><th>Particulars</th><th>S.N.</th><th>Qty.</th><th>Rate</th><th>Amount</th></tr></thead><tbody><tr><td>1</td><td><b>${esc(`${it.brand||""} ${it.model||"Phone"}`.trim())}</b><br>IMEI - ${esc(it.imei||"")}<br>${esc(it.colour||"")}<br>${esc(it.storage||"")} ${it.ram?`/ ${esc(it.ram)}`:""}</td><td>${esc(it.sn||it.imei?.slice(-5)||"")}</td><td>1</td><td>${Number(it.rate||total)}</td><td>${Number(it.amount||total)}</td></tr></tbody><tfoot><tr><th colspan="3">Total</th><th>1</th><th></th><th>${Number(total)}</th></tr></tfoot></table><div class="invoice-words"><b>Invoice Amount In Words :</b> ${esc(inv.amountWords||invAmountWords(total))}</div><div class="invoice-terms"><div><b>Terms & Conditions:</b><p>${esc(terms)}</p></div><div class="invoice-sign"><b>For, KABIR MOBILE</b><br><br>Authorised<br>Signatory</div></div></div></div>`;
    $("inventoryInvoicePreviewModal")?.classList.remove("hidden");
}
function printInventoryInvoice(){
    const content=$("printableInventoryInvoice")?.outerHTML;if(!content)return;const w=window.open("","_blank","width=900,height=1200");if(!w){alert("Print window blocked. Browser popup allow करें.");return;}w.document.write(`<html><head><title>KABIR MOBILE Invoice</title><style>${inventoryPrintCss()}</style></head><body>${content}</body></html>`);w.document.close();w.focus();setTimeout(()=>w.print(),300);
}
async function downloadInventoryInvoicePdf(){
    const inv=inventoryInvoices.find(x=>x.id===inventoryInvoicePreviewId);if(!inv)return;
    try{
        if(!window.html2canvas)await loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
        if(!window.jspdf)await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
        const canvas=await html2canvas($("printableInventoryInvoice"),{scale:2,useCORS:true,backgroundColor:"#ffffff"});
        const {jsPDF}=window.jspdf;const pdf=new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});
        const pageW=210,pageH=297,margin=5,imgW=pageW-margin*2,imgH=canvas.height*imgW/canvas.width;
        let srcY=0;const srcH=Math.max(1,Math.floor(canvas.height*((pageH-margin*2)/imgH)));
        while(srcY<canvas.height){const h=Math.min(srcH,canvas.height-srcY);const pageCanvas=document.createElement("canvas");pageCanvas.width=canvas.width;pageCanvas.height=h;pageCanvas.getContext("2d").drawImage(canvas,0,srcY,canvas.width,h,0,0,canvas.width,h);if(srcY>0)pdf.addPage();pdf.addImage(pageCanvas.toDataURL("image/jpeg",.94),"JPEG",margin,margin,imgW,h*imgW/canvas.width);srcY+=h;}
        pdf.save(`${inv.invoiceNo||"Kabir_Invoice"}.pdf`);
    }catch(err){console.error(err);alert("Invoice PDF generate नहीं हो पाया. Print option से direct PDF save कर सकते हैं.");}
}
function inventoryPrintCss(){return `.print-invoice{width:210mm;min-height:297mm;box-sizing:border-box;background:#fff;color:#111;font-family:Arial,sans-serif}.invoice-border{border:1px solid #111;padding:6mm;box-sizing:border-box;min-height:297mm}.invoice-head{display:grid;grid-template-columns:1fr 1.5fr 1fr;align-items:center;border-bottom:1px solid #111;padding-bottom:3mm;font-size:9pt}.invoice-shop-title{text-align:center;font-size:18pt;font-weight:800}.invoice-head>div:nth-child(3){text-align:right}.invoice-address{grid-column:1/-1;text-align:center;font-size:9pt;margin-top:-2mm}.invoice-details{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #111;padding:3mm 0;min-height:20mm;font-size:9pt}.invoice-details>div:last-child{text-align:left;padding-left:6mm}.invoice-details p{margin:1.2mm 0}.invoice-table{width:100%;border-collapse:collapse;margin-top:0;font-size:8.5pt}.invoice-table th,.invoice-table td{border:1px solid #111;padding:2mm;text-align:center;vertical-align:top}.invoice-table tbody td:nth-child(2){text-align:center;line-height:1.3}.invoice-table tbody tr{height:95mm}.invoice-words{padding:5mm 0 3mm;font-size:9pt}.invoice-terms{display:grid;grid-template-columns:3fr 1fr;gap:5mm;font-size:8pt;line-height:1.4}.invoice-sign{padding-top:8mm;text-align:left}@media print{@page{size:A4 portrait;margin:0}html,body{margin:0;padding:0;width:210mm;min-height:297mm}.print-invoice{width:210mm;min-height:297mm}.invoice-border{min-height:297mm}}`}
function setupInventoryUI(){
    $("inventoryPartySearch")?.addEventListener("input",renderInventoryParties);
    $("inventoryStockSearch")?.addEventListener("input",renderInventoryStock);
    $("inventoryInvoiceSearch")?.addEventListener("input",renderInventoryInvoices);
    $("inventoryNewInvoiceButton")?.addEventListener("click",()=>{$("inventorySellPurchaseModal")?.classList.remove("hidden");renderInventoryTransactionForm("sell");});
    $("inventoryInvoiceFilterButton")?.addEventListener("click",()=>{$("inventoryInvoiceSection")?.scrollTo?.({top:0,behavior:"smooth"});});
    document.querySelectorAll("[data-inventory-page]").forEach(b=>b.addEventListener("click",()=>{
        const target=b.dataset.inventoryPage;
        if(!target)return;
        show(target);
        if(target==="inventoryHomePage")renderInventoryHome();
        if(target==="inventoryPartyPage")renderInventoryParties();
        if(target==="inventoryStockPage")renderInventoryStock();
        if(target==="inventoryInvoicePage")renderInventoryInvoices();
    }));
    // Stock switches: delegated click handler so they keep working even if the
    // stock page/cards are re-rendered or the page is opened more than once.
    if(!window.__inventoryStockSwitchDelegated){
        window.__inventoryStockSwitchDelegated=true;
        document.addEventListener("click",e=>{
            const conditionBtn=e.target.closest("[data-stock-condition]");
            if(conditionBtn){
                e.preventDefault();
                e.stopPropagation();
                inventoryStockFilter=conditionBtn.dataset.stockCondition||"used";
                document.querySelectorAll("[data-stock-condition]").forEach(x=>x.classList.toggle("active",x===conditionBtn));
                renderInventoryStock();
                return;
            }
            const statusBtn=e.target.closest("[data-stock-status]");
            if(statusBtn){
                e.preventDefault();
                e.stopPropagation();
                inventoryStockStatus=statusBtn.dataset.stockStatus||"sell";
                document.querySelectorAll("[data-stock-status]").forEach(x=>x.classList.toggle("active",x===statusBtn));
                renderInventoryStock();
            }
        });
    }
    document.querySelectorAll("[data-invoice-range]").forEach(b=>b.addEventListener("click",()=>{inventoryInvoiceRange=b.dataset.invoiceRange;document.querySelectorAll("[data-invoice-range]").forEach(x=>x.classList.toggle("active",x===b));renderInventoryInvoices();}));
    if(!window.__inventoryPartyEditDelegated){window.__inventoryPartyEditDelegated=true;document.addEventListener("click",e=>{const b=e.target.closest("[data-party-edit-phone]");if(!b)return;e.preventDefault();e.stopPropagation();editInventoryPartyCustomer(b.dataset.partyEditPhone,b.dataset.partyEditName);});}
    $("inventoryAddPartyButton")?.addEventListener("click",()=>{$("inventoryPartyModal")?.classList.remove("hidden");});
    $("inventoryPartyForm")?.addEventListener("submit",saveInventoryParty);
    $("inventorySellPurchaseButton")?.addEventListener("click",()=>{$("inventorySellPurchaseModal")?.classList.remove("hidden");renderInventoryTransactionForm("purchase");});
    $("inventoryPartyDetailBack")?.addEventListener("click",()=>inventoryShowTab("inventoryPartySection"));
    document.querySelectorAll("[data-inventory-mode]").forEach(b=>b.addEventListener("click",()=>renderInventoryTransactionForm(b.dataset.inventoryMode)));
    document.querySelectorAll("[data-inventory-close]").forEach(b=>b.addEventListener("click",()=>{const m=$(b.dataset.inventoryClose);if(m){m.classList.add("hidden");m.scrollTop=0;const card=m.querySelector(".modal-card");if(card)card.scrollTop=0;}}));
    $("inventoryPrintInvoiceButton")?.addEventListener("click",printInventoryInvoice);$("inventoryDownloadInvoiceButton")?.addEventListener("click",downloadInventoryInvoicePdf);
    if(!window.__inventoryScanDelegated){window.__inventoryScanDelegated=true;document.addEventListener("click",e=>{const b=e.target.closest(".inventory-scan-button");if(b)startScan(b.dataset.scanTarget);});}
    if(!window.__inventoryDashboardDelegated){window.__inventoryDashboardDelegated=true;document.querySelectorAll("[data-inventory-dashboard]").forEach(b=>b.addEventListener("click",()=>{const title={statistics:"Statistics",performance:"Performance",stockValue:"Stock Value",overview:"Overview"}[b.dataset.inventoryDashboard]||"Overview";const body=$("inventoryDashboardBody");if(!body)return;const sales=inventoryInvoices.filter(x=>x.type==="sale").reduce((n,x)=>n+Number(x.total||0),0),purchases=inventoryInvoices.filter(x=>x.type==="purchase").reduce((n,x)=>n+Number(x.total||0),0),profit=inventoryInvoices.filter(x=>x.type==="sale").reduce((n,x)=>{const it=(x.items||[])[0]||{};const ph=inventoryPhones.find(p=>p.id===it.inventoryId);return n+(Number(x.total||0)-Number(ph?.purchasePrice||0));},0);body.innerHTML=`<h3>${title}</h3><div class="inventory-summary-grid"><div><span>Total Phones</span><b>${inventoryPhones.length}</b></div><div><span>Available</span><b>${inventoryPhones.filter(x=>x.status!=="sold").length}</b></div><div><span>Sold</span><b>${inventoryPhones.filter(x=>x.status==="sold").length}</b></div><div><span>Parties</span><b>${inventoryParties.length}</b></div><div><span>Purchase Value</span><b>${invMoney(purchases)}</b></div><div><span>Sales Value</span><b>${invMoney(sales)}</b></div><div><span>Estimated Profit</span><b>${invMoney(profit)}</b></div><div><span>Invoices</span><b>${inventoryInvoices.length}</b></div></div>`;}));}
}
async function saveInventoryParty(e){
    e.preventDefault();if(enforceWriteLock("inventoryPartyMessage"))return;const phone=val("inventoryPartyPhone").replace(/\D/g,"");if(!/^\d{10}$/.test(phone)){msg("inventoryPartyMessage","10 digit mobile number डालें.");return;}const data={type:val("inventoryPartyType"),name:val("inventoryPartyName"),phone,createdAt:serverTimestamp(),createdBy:user?.uid||null};try{await addDoc(collection(db,INVENTORY_PARTY_COL),data);await audit("inventory_party_add",{section:"Inventory Party",customerName:data.name,description:`${data.type} party added: ${data.name}`,extra:{phone}});e.target.reset();$("inventoryPartyModal")?.classList.add("hidden");showSuccessToast("Party Saved","Customer / Vendor saved successfully");}catch(err){console.error(err);msg("inventoryPartyMessage",err?.message||"Party save failed.");}}

/* =========================================================
   CUSTOMER FORM: FILLED FIELD STATE
========================================================= */
function setupCustomerFilledFields(){
    const form=$("customerForm");
    if(!form || form.dataset.filledReady==="1") return;
    const update=el=>{
        if(!el) return;
        const filled=String(el.value||"").trim()!=="";
        el.classList.toggle("field-filled",filled);
        el.closest("label")?.classList.toggle("field-filled-label",filled);
    };
    form.querySelectorAll("input,textarea,select").forEach(el=>{
        update(el);
        el.addEventListener("input",()=>update(el));
        el.addEventListener("change",()=>update(el));
    });
    form.dataset.filledReady="1";
}

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
    setupCustomerFilledFields();
    setupRepairFields();
    setupEntryDateFields();

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
    setupInventoryUI();
    if(!$('appScreen')?.classList.contains('admin')) audit('page_open',{section:'Kabir Mobile Data',description:'Website opened',deviceBrand:deviceInfo().brand,deviceModel:deviceInfo().model});
    setupHomeDateFilter();
    adminAnalytics();
    if($('appScreen')?.classList.contains('admin')) audit('page_open',{section:'Admin Panel',description:'Admin Panel opened'});

    authReady.then(()=>{
        purgeExpiredDeleted();
        subscribe();
        subscribeRepairing();
        subscribeSecondaryAndAccessories();
        subscribeInventory();
    }).catch(e=>{
        console.error("Firebase data initialization blocked:",e);
    });

    $("customerForm")
        ?.addEventListener(
            "submit",
            save
        );
    setupCustomerEnterNavigation();
    $("phone")?.addEventListener("input",applyCustomerDuplicateState);
    $("customerName")?.addEventListener("input",applyCustomerDuplicateState);
}


document.addEventListener("DOMContentLoaded",()=>{init()});