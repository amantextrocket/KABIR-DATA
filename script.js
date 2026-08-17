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

window.kabirGetSharedPin = async function(){
    try{
        const ref=doc(db,"settings","security");
        const snap=await getDoc(ref);
        if(snap.exists() && snap.data().pin){
            const p=String(snap.data().pin);
            localStorage.setItem("kabirSharedPin",p);
            return p;
        }
    }catch(e){
        console.warn("Shared PIN read failed:",e);
    }
    return localStorage.getItem("kabirSharedPin") || "0000";
};
const db=getFirestore(app);

const PIN_KEY="kabir_mobile_pin";
const DEFAULT_PIN="0000";
const COL="customers";
const REPAIR_COL="repairing";
const SETTINGS_COL="settings";
const SETTINGS_DOC="security";
const REMOTE_DEVICES_URL="https://cdn.jsdelivr.net/gh/bsthen/device-models/devices.json";
const ACCESS_USERS_COL="accessUsers";
const AUDIT_COL="auditLogs";
const ACCESS_SESSION_KEY="kabir_access_session";
let kabirAccessUser=null;
let kabirAccessSessionId=null;
let accessHeartbeatTimer=null;
let accessSessionUnsubscribe=null;
let authReadyResolve;
let authReadyResolved=false;
const authReady=new Promise(resolve=>{authReadyResolve=resolve;});
function resolveAuthReady(){
    if(authReadyResolved)return;
    authReadyResolved=true;
    authReadyResolve?.();
}

let user=null;
let customers=[];
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

let sharedPin=DEFAULT_PIN;
let pinLoaded=false;

async function loadSharedPin(){
    try{
        const ref=doc(db,SETTINGS_COL,SETTINGS_DOC);
        const snap=await getDoc(ref);

        if(snap.exists()){
            const p=String(snap.data()?.pin||"");
            if(/^\d{4}$/.test(p)){
                sharedPin=p;
                localStorage.setItem(PIN_KEY,p);
                pinLoaded=true;
                return p;
            }
        }

        const cached=localStorage.getItem(PIN_KEY);
        sharedPin=/^\d{4}$/.test(cached||"")?cached:DEFAULT_PIN;
        await setDoc(ref,{pin:sharedPin,updatedAt:serverTimestamp()},{merge:true});
    }catch(e){
        console.warn("Shared PIN read failed:",e);
        const cached=localStorage.getItem(PIN_KEY);
        sharedPin=/^\d{4}$/.test(cached||"")?cached:DEFAULT_PIN;
    }
    pinLoaded=true;
    return sharedPin;
}

function pin(){
    return sharedPin||DEFAULT_PIN;
}

async function changeSharedPin(newPin){
    if(!/^\d{4}$/.test(newPin)) throw Error("PIN must be exactly 4 digits.");
    await setDoc(doc(db,SETTINGS_COL,SETTINGS_DOC),{
        pin:newPin,
        updatedAt:serverTimestamp()
    },{merge:true});
    sharedPin=newPin;
    localStorage.setItem(PIN_KEY,newPin);
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
   KABIR ID / PASSWORD ACCESS
   One active session per Kabir ID.
========================================================= */

function currentPageIsAdmin(){
    return /admin\.html?$/i.test(location.pathname) || document.querySelector(".admin");
}

function accessNow(){
    return new Date();
}

function accessDateTime(v){
    if(!v)return "—";
    try{
        const d=v?.toDate?.() || new Date(v);
        return isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat("en-IN",{dateStyle:"medium",timeStyle:"medium"}).format(d);
    }catch(_){return "—";}
}

function normalizeKabirId(v){
    return String(v||"").trim().toUpperCase().replace(/\s+/g,"");
}

function accessMessage(t,ok=false){
    msg("kabirLoginMessage",t,ok);
}

function accessSessionIsValid(){
    return !!sessionStorage.getItem(ACCESS_SESSION_KEY);
}

async function getAccessUserById(id){
    const cleanId=normalizeKabirId(id);
    const snap=await getDoc(doc(db,ACCESS_USERS_COL,cleanId));
    if(!snap.exists())return null;
    const data=snap.data()||{};
    return {id:snap.id,...data};
}

async function audit(action,details={}){
    try{
        if(!kabirAccessUser && !user)return;
        await addDoc(collection(db,AUDIT_COL),{
            action,
            userId:kabirAccessUser?.id||null,
            userName:kabirAccessUser?.name||null,
            authUid:user?.uid||null,
            details,
            createdAt:serverTimestamp()
        });
    }catch(e){console.warn("Audit log failed:",e)}
}

async function claimAccessSession(record){
    const sessionId=crypto.randomUUID ? crypto.randomUUID() : ("S"+Date.now()+Math.random().toString(36).slice(2));
    const now=new Date();
    const ref=doc(db,ACCESS_USERS_COL,record.id);

    const latest=await getDoc(ref);
    const data=latest.exists()?latest.data():record;

    if(data.activeSessionId && data.activeSessionId!=="" && data.activeSessionId!==sessionId){
        // A session is considered active until its explicit logout or until
        // the heartbeat expires for more than 90 seconds.
        const hb=data.lastHeartbeat?.toDate?.()?.getTime?.()||0;
        if(hb && (Date.now()-hb)<90000){
            throw Error("यह Kabir ID अभी किसी दूसरे device/browser में login है.");
        }
    }

    await updateDoc(ref,{
        activeSessionId:sessionId,
        status:"online",
        lastLoginAt:serverTimestamp(),
        lastHeartbeat:serverTimestamp(),
        lastLoginDevice:navigator.userAgent.slice(0,180)
    });

    kabirAccessSessionId=sessionId;
    kabirAccessUser={...data,id:record.id};
    sessionStorage.setItem(ACCESS_SESSION_KEY,JSON.stringify({
        id:record.id,
        sessionId
    }));

    await audit("LOGIN",{loginAt:new Date().toISOString()});
    startAccessHeartbeat();
    updateAccessIdentityUI();
}

function startAccessHeartbeat(){
    clearInterval(accessHeartbeatTimer);
    accessHeartbeatTimer=setInterval(async()=>{
        if(!kabirAccessUser || !kabirAccessSessionId)return;
        try{
            const ref=doc(db,ACCESS_USERS_COL,kabirAccessUser.id);
            const snap=await getDoc(ref);
            if(!snap.exists())return forceAccessLogout("User access removed.");
            const data=snap.data();
            if(data.activeSessionId!==kabirAccessSessionId){
                forceAccessLogout("यह Kabir ID किसी दूसरे login में इस्तेमाल हो रही है.");
                return;
            }
            await updateDoc(ref,{status:"online",lastHeartbeat:serverTimestamp()});
        }catch(e){console.warn("Heartbeat failed:",e)}
    },30000);
}

async function releaseAccessSession(log=true){
    if(!kabirAccessUser)return;
    try{
        await updateDoc(doc(db,ACCESS_USERS_COL,kabirAccessUser.id),{
            status:"offline",
            activeSessionId:"",
            lastLogoutAt:serverTimestamp(),
            lastHeartbeat:serverTimestamp()
        });
        if(log)await audit("LOGOUT",{logoutAt:new Date().toISOString()});
    }catch(e){console.warn("Logout update failed:",e)}
    clearInterval(accessHeartbeatTimer);
    kabirAccessUser=null;
    kabirAccessSessionId=null;
    sessionStorage.removeItem(ACCESS_SESSION_KEY);
}

function forceAccessLogout(message){
    clearInterval(accessHeartbeatTimer);
    kabirAccessUser=null;
    kabirAccessSessionId=null;
    sessionStorage.removeItem(ACCESS_SESSION_KEY);
    $("appScreen")?.classList.add("hidden");
    $("kabirLoginScreen")?.classList.remove("hidden");
    accessMessage(message||"Session ended.");
}

async function logoutAccess(){
    await releaseAccessSession(true);
    $("appScreen")?.classList.add("hidden");
    $("kabirLoginScreen")?.classList.remove("hidden");
    $("kabirLoginId")?.focus();
}

function updateAccessIdentityUI(){
    if($("kabirCurrentUser")){
        $("kabirCurrentUser").textContent=
            kabirAccessUser ? `${kabirAccessUser.id} • ${kabirAccessUser.name||""}` : "";
    }
}

async function restoreAccessSession(){
    const raw=sessionStorage.getItem(ACCESS_SESSION_KEY);
    if(!raw)return false;
    try{
        const s=JSON.parse(raw);
        const rec=await getAccessUserById(s.id);
        if(!rec || rec.activeSessionId!==s.sessionId || rec.status!=="online"){
            sessionStorage.removeItem(ACCESS_SESSION_KEY);
            return false;
        }
        kabirAccessUser=rec;
        kabirAccessSessionId=s.sessionId;
        updateAccessIdentityUI();
        startAccessHeartbeat();
        $("kabirLoginScreen")?.classList.add("hidden");
        $("appScreen")?.classList.remove("hidden");
        return true;
    }catch(e){
        console.warn(e);
        sessionStorage.removeItem(ACCESS_SESSION_KEY);
        return false;
    }
}

function setupKabirLogin(){
    const button=$("kabirLoginButton");
    if(!button)return;

    button.addEventListener("click",async()=>{
        const id=normalizeKabirId(val("kabirLoginId"));
        const password=val("kabirLoginPassword");

        if(!id || !password){
            accessMessage("Kabir ID और Password दोनों भरें.");
            return;
        }

        button.disabled=true;
        accessMessage("Login हो रहा है…",true);

        try{
            if(!db)throw Error("Firebase अभी तैयार नहीं है. एक सेकंड बाद फिर कोशिश करें.");
            await authReady;
            if(!user)throw Error("Firebase login तैयार नहीं हुआ. फिर से कोशिश करें.");
            const rec=await getAccessUserById(id);
            if(!rec || rec.enabled===false)throw Error("Kabir ID या Password गलत है.");
            if(String(rec.password)!==password)throw Error("Kabir ID या Password गलत है.");

            await claimAccessSession(rec);
            accessMessage("");
            $("kabirLoginScreen")?.classList.add("hidden");
            $("appScreen")?.classList.remove("hidden");
        }catch(e){
            console.error(e);
            accessMessage(e?.message||"Login नहीं हुआ.");
        }finally{
            button.disabled=false;
        }
    });

    $("kabirLoginPassword")?.addEventListener("keydown",e=>{
        if(e.key==="Enter")button.click();
    });
    $("kabirLoginId")?.addEventListener("keydown",e=>{
        if(e.key==="Enter")$("kabirLoginPassword")?.focus();
    });
    $("kabirLogoutButton")?.addEventListener("click",logoutAccess);
}

async function ensureAccessOnMain(){
    if(currentPageIsAdmin())return;
    $("appScreen")?.classList.add("hidden");
    $("kabirLoginScreen")?.classList.remove("hidden");
    if(!(await restoreAccessSession())){
        $("kabirLoginId")?.focus();
    }
}

/* =========================================================
   FIREBASE AUTH
========================================================= */

async function authInit(){

    try{

        await signInAnonymously(auth);

    }catch(e){

        console.error(e);

        if($("adminFirebaseStatus"))
            msg(
                "adminFirebaseStatus",
                "Firebase authentication error"
            );
    }

    onAuthStateChanged(auth,u=>{
        user=u;
        updateAdmin();
        resolveAuthReady();
    });
    // If anonymous authentication is disabled/fails, do not leave the app
    // waiting forever on authReady.
    if(!user) resolveAuthReady();
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
        },
        e=>{
            console.error("Customer listener:",e);
            msg("formMessage","Firestore access error. Check Firebase rules.");
            counts();
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
        $("adminFirebaseStatus").textContent=
            user
            ?"Firebase connected"
            :"Connecting to Firebase…";
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

    $("repairTotalCustomersCard")?.addEventListener(
        "click",
        ()=>{
            show("repairSearchSection");
            renderRepairing();
            $("repairSearchInput")?.focus();
        }
    );

    $("repairTotalDevicesCard")?.addEventListener(
        "click",
        ()=>{
            show("repairSearchSection");
            renderRepairing();
            $("repairSearchInput")?.focus();
        }
    );

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
        if(!cs.length && m.value){
            cs=["Black","White","Blue","Green","Other"];
        }

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

/* Business rule: add/edit/delete is blocked from 12:00 AM to 10:00 AM. */
function isBusinessBlocked(){
    const h=new Date().getHours();
    return h>=0 && h<10;
}
function businessBlockedMessage(){
    return "12:00 AM से 10:00 AM तक Add, Edit और Delete बंद है. 10:00 AM के बाद फिर कोशिश करें.";
}
function ensureBusinessHours(messageId){
    if(!isBusinessBlocked())return true;
    msg(messageId,businessBlockedMessage());
    return false;
}

async function save(e){

    e.preventDefault();

    if(!user){

        msg(
            "formMessage",
            "Firebase connect होने का इंतज़ार करें."
        );

        return;
    }

    if(!ensureBusinessHours("formMessage"))return;

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

        let customerData={

            customerCode:$("customerForm")?.dataset?.editId
                ? (val("customerCode") || await uniqueCustomerCode())
                : await uniqueCustomerCode(),
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

            bill:{
                status:"NO",
                dueDate:billDate()
            },

            billYes:false,

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

        const editId=$("customerForm").dataset.editId;
        if(editId){
            const existing=customers.find(c=>c.id===editId);
            customerData.customerCode=existing?.customerCode || customerData.customerCode;
            customerData.bill=existing?.bill || customerData.bill;
            customerData.billYes=existing?.billYes ?? customerData.billYes;
            delete customerData.createdAt;
            delete customerData.createdBy;
            await updateDoc(doc(db,COL,editId),customerData);
            await audit("CUSTOMER_EDITED",{customerId:editId,customerName:customerData.customerName});
        }else{
            await addDoc(collection(db,COL),customerData);
            await audit("CUSTOMER_ADDED",{customerCode:customerData.customerCode,customerName:customerData.customerName});
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
            try{await updateDoc(doc(db,COL,i.dataset.bill),{billYes:i.checked,"bill.status":i.checked?"YES":"NO"})}
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
    const c=customers.find(x=>x.id===activeCustomerId);if(!c)return;
    if(isBusinessBlocked()){
        alert(businessBlockedMessage());
        return;
    }
    if(!confirm(`Delete ${c.customerName||"this customer"} (${c.customerCode||""}) permanently?`))return;
    try{await deleteDoc(doc(db,COL,c.id));await audit("CUSTOMER_DELETED",{customerId:c.id,customerName:c.customerName,customerCode:c.customerCode});closeCustomerDetail()}
    catch(e){console.error(e);alert("Customer delete नहीं हुआ. Firebase Rules check करें.")}
}
function editCustomer(){
    const c=customers.find(x=>x.id===activeCustomerId);if(!c)return;
    if(!ensureBusinessHours("formMessage"))return;
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
   ADMIN: KABIR USERS / LIVE STATUS / ANALYSIS / TODAY WORK
========================================================= */

function adminToday(){
    return new Intl.DateTimeFormat("en-CA").format(new Date());
}

function formatAuditDate(v){
    return accessDateTime(v);
}

function showAdminSuccessPopup(title,text){
    const popup=$("adminSuccessPopup");
    if(!popup)return;
    $("adminSuccessTitle").textContent=title||"Successfully Added";
    $("adminSuccessText").textContent=text||"Saved successfully.";
    popup.classList.remove("hidden");
    requestAnimationFrame(()=>popup.classList.add("show"));
    clearTimeout(window.__adminSuccessTimer);
    window.__adminSuccessTimer=setTimeout(()=>{
        popup.classList.remove("show");
        setTimeout(()=>popup.classList.add("hidden"),250);
    },2200);
}

async function adminSaveKabirUser(e){
    e.preventDefault();

    const name=val("kabirUserName");
    const id=normalizeKabirId(val("kabirUserId"));
    const password=val("kabirUserPassword");

    if(!name||!id||!password){
        msg("kabirUserMessage","Name, Kabir ID और Password भरें.");
        return;
    }

    if(!/^KABIR[A-Z0-9_-]{2,30}$/.test(id)){
        msg("kabirUserMessage","Kabir ID KABIR से शुरू होना चाहिए.");
        return;
    }

    const button=e.submitter||$("kabirUserForm")?.querySelector("button[type=submit]");
    if(button)button.disabled=true;

    try{
        await authReady;
        if(!user)throw Error("Firebase authentication तैयार नहीं है.");

        const existing=await getDoc(doc(db,ACCESS_USERS_COL,id));
        const updateData={
            id:id,
            name:name,
            password:password,
            enabled:true,
            updatedAt:serverTimestamp()
        };
        if(!existing.exists()){
            Object.assign(updateData,{
                status:"offline",
                activeSessionId:"",
                lastLoginAt:null,
                lastLogoutAt:null,
                lastHeartbeat:null
            });
        }
        await setDoc(doc(db,ACCESS_USERS_COL,id),updateData,{merge:true});

        await renderKabirUsers();

        $("kabirUserForm")?.reset();
        msg("kabirUserMessage","Successfully added ✓",true);
        showAdminSuccessPopup("Successfully Added","Kabir ID और Password successfully saved.");

    }catch(e){
        console.error("Kabir user create/update error:",e);
        msg("kabirUserMessage",
            e?.code==="permission-denied"
            ?"Firebase permission denied — Firestore Rules check करें."
            :"User save नहीं हुआ. फिर से कोशिश करें."
        );
    }finally{
        if(button)button.disabled=false;
    }
}

async function renderKabirUsers(){
    const box=$("kabirUsersList");
    if(!box)return;
    try{
        await authReady;
        if(!user){
            box.innerHTML='<div class="empty">Firebase authentication तैयार नहीं है.</div>';
            return;
        }
        const snap=await getDocs(collection(db,ACCESS_USERS_COL));
        const rows=snap.docs.map(d=>({id:d.id,...d.data()}));
        if($("kabirUsersCount"))$("kabirUsersCount").textContent=String(rows.length);
        if(!rows.length){
            box.innerHTML='<div class="empty">अभी कोई Kabir ID नहीं बनी.</div>';
            return;
        }
        box.innerHTML=rows.map(r=>{
            const online=r.status==="online" && !!r.activeSessionId;
            return `<article class="result">
                <div class="result-top">
                    <div>
                      <div class="result-name">${esc(r.id||"")}</div>
                      <div class="result-meta">${esc(r.name||"Name not set")}</div>
                    </div>
                    <strong>${online?"🟢 ONLINE":"⚪ OFFLINE"}</strong>
                </div>
                <div class="result-grid">
                    ${item("Kabir ID",r.id||"")}
                    ${item("Password",r.password||"")}
                    ${item("Status",online?"Online":"Offline")}
                    ${item("Last Login",accessDateTime(r.lastLoginAt))}
                    ${item("Last Logout",accessDateTime(r.lastLogoutAt))}
                    ${item("Last Heartbeat",accessDateTime(r.lastHeartbeat))}
                </div>
            </article>`;
        }).join("");
    }catch(e){
        console.error(e);
        box.innerHTML='<div class="empty">User list load नहीं हुआ. Firebase Rules check करें.</div>';
    }
}

async function renderLiveUsers(){
    const box=$("kabirLiveUsers");
    if(!box)return;
    try{
        await authReady;
        if(!user){
            box.innerHTML='<div class="empty">Firebase authentication तैयार नहीं है.</div>';
            return;
        }
        const snap=await getDocs(collection(db,ACCESS_USERS_COL));
        const rows=snap.docs.map(d=>({id:d.id,...d.data()}));
        const online=rows.filter(r=>r.status==="online" && !!r.activeSessionId);
        if(!online.length){
            box.innerHTML='<div class="empty">अभी कोई Kabir user online नहीं है.</div>';
            return;
        }
        box.innerHTML=online.map(r=>`<article class="result">
            <div class="result-top">
                <div>
                    <div class="result-name">${esc(r.id||"")}</div>
                    <div class="result-meta">${esc(r.name||"Name not set")}</div>
                </div>
                <strong>🟢 ONLINE</strong>
            </div>
            <div class="result-grid">
                ${item("Last Login",accessDateTime(r.lastLoginAt))}
                ${item("Last Heartbeat",accessDateTime(r.lastHeartbeat))}
            </div>
        </article>`).join("");
    }catch(e){
        console.error(e);
        box.innerHTML='<div class="empty">Live user status load नहीं हुआ.</div>';
    }
}

async function getAuditRows(){
    await authReady;
    if(!user)return [];
    const snap=await getDocs(collection(db,AUDIT_COL));
    return snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>{
        const ta=a.createdAt?.toMillis?.()||0, tb=b.createdAt?.toMillis?.()||0;
        return tb-ta;
    });
}

function inDateRange(row,from,to){
    const d=row.createdAt?.toDate?.();
    if(!d)return false;
    const ds=new Intl.DateTimeFormat("en-CA").format(d);
    return (!from||ds>=from)&&(!to||ds<=to);
}

function actionLabel(a){
    return ({
        LOGIN:"Login",
        LOGOUT:"Logout",
        CUSTOMER_ADDED:"Customer Added",
        CUSTOMER_EDITED:"Customer Edited",
        CUSTOMER_DELETED:"Customer Deleted",
        REPAIR_ADDED:"Repair Added"
    })[a]||a||"Work";
}

async function renderTraffic(){
    const box=$("trafficAnalysis");if(!box)return;
    const date=val("analysisDate");
    if(!date){box.innerHTML='<div class="empty">Select a date.</div>';return;}
    try{
        const rows=(await getAuditRows()).filter(r=>inDateRange(r,date,date));
        const counts={};
        rows.forEach(r=>counts[r.action]=(counts[r.action]||0)+1);
        const users={};
        rows.forEach(r=>{
            const k=r.userId||"Unknown";
            users[k]=(users[k]||0)+1;
        });
        box.innerHTML=`
          <div class="mini-grid">
            <div><span>Total Activities</span><strong>${rows.length}</strong></div>
            <div><span>Active Members</span><strong>${Object.keys(users).length}</strong></div>
          </div>
          <div class="result-grid">
            ${Object.entries(counts).map(([k,v])=>item(actionLabel(k),v)).join("")||'<div class="empty">No work recorded.</div>'}
          </div>`;
    }catch(e){console.error(e);box.innerHTML='<div class="empty">Analysis load नहीं हुआ.</div>'}
}

async function renderTodayWork(){
    const box=$("todayWorkResults");if(!box)return;
    const from=val("workFromDate")||adminToday();
    const to=val("workToDate")||from;
    try{
        const rows=(await getAuditRows()).filter(r=>inDateRange(r,from,to));
        if(!rows.length){box.innerHTML='<div class="empty">इस date range में कोई work नहीं मिला.</div>';return;}
        box.innerHTML=rows.map(r=>`<article class="result">
            <div class="result-top">
                <div><div class="result-name">${esc(r.userId||"Unknown")}</div>
                <div class="result-meta">${esc(r.userName||"")} • ${esc(formatAuditDate(r.createdAt))}</div></div>
                <strong>${esc(actionLabel(r.action))}</strong>
            </div>
            <div class="result-grid">${item("Work",actionLabel(r.action))}${item("Details",JSON.stringify(r.details||{}))}</div>
        </article>`).join("");
    }catch(e){console.error(e);box.innerHTML='<div class="empty">Work history load नहीं हुआ.</div>'}
}

async function downloadAuditRows(rows,filename){
    const data=rows.map(r=>({
        "Date & Time":formatAuditDate(r.createdAt),
        "Kabir ID":r.userId||"",
        "Name":r.userName||"",
        "Work":actionLabel(r.action),
        "Details":JSON.stringify(r.details||{})
    }));
    if(!data.length){alert("Download के लिए data नहीं है.");return}
    await exportXlsx(data,filename,"Work");
}

function adminFeatureNav(){
    $("kabirUserForm")?.addEventListener("submit",adminSaveKabirUser);
    $("analysisDate")?.addEventListener("change",renderTraffic);
    $("workFromDate")?.addEventListener("change",renderTodayWork);
    $("workToDate")?.addEventListener("change",renderTodayWork);

    $("downloadTrafficButton")?.addEventListener("click",async()=>{
        const date=val("analysisDate");
        const rows=(await getAuditRows()).filter(r=>inDateRange(r,date,date));
        await downloadAuditRows(rows,`Kabir_Traffic_${date||adminToday()}.xlsx`);
    });

    $("downloadTodayWorkButton")?.addEventListener("click",async()=>{
        const from=val("workFromDate")||adminToday();
        const to=val("workToDate")||from;
        const rows=(await getAuditRows()).filter(r=>inDateRange(r,from,to));
        await downloadAuditRows(rows,`Kabir_Work_${from}_to_${to}.xlsx`);
    });

    const today=adminToday();
    if($("analysisDate"))$("analysisDate").value=today;
    if($("workFromDate"))$("workFromDate").value=today;
    if($("workToDate"))$("workToDate").value=today;
    renderTraffic();
    renderTodayWork();
    renderKabirUsers();
    renderLiveUsers();

    setInterval(()=>{
        renderKabirUsers();
        renderLiveUsers();
        renderTraffic();
        renderTodayWork();
    },30000);
}

/* =========================================================
   CHANGE PIN
========================================================= */

function changePin(){

    let f=$("changePinForm");

    if(!f)return;


    f.onsubmit=async e=>{

        e.preventDefault();

        await loadSharedPin();

        let a=val("currentPin");
        let b=val("newPin");
        let c=val("confirmPin");


        if(a!==pin()){

            return msg(
                "pinSettingsMessage",
                "Current PIN incorrect."
            );
        }


        if(!/^\d{4}$/.test(b)){

            return msg(
                "pinSettingsMessage",
                "New PIN exactly 4 digits होना चाहिए."
            );
        }


        if(b!==c){

            return msg(
                "pinSettingsMessage",
                "New PIN और confirmation match नहीं हैं."
            );
        }


        changeSharedPin(b)
            .then(()=>{
                f.reset();
                msg("pinSettingsMessage","PIN changed successfully ✓",true);
                showSuccessToast("PIN Updated","New PIN is now saved to Firebase");
            })
            .catch(error=>{
                console.error(error);
                msg("pinSettingsMessage","PIN save नहीं हुआ. Firebase Rules check करें.");
            });
    };
}



let repairing=[];
let repairListenerStarted=false;
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
    const date=val("repairSearchDate");
    const arr=repairing.filter(r=>{
        const text=[r.customerName,r.phone,r.device,r.problem,r.repairBy,r.payment,formatDateTime(r)].join(" ").toLowerCase();
        const created=r.createdAt?.toDate?.();
        const rowDate=created?new Intl.DateTimeFormat("en-CA").format(created):"";
        return (!s||text.includes(s)) && (!date||rowDate===date);
    });
    if(!arr.length){box.innerHTML=`<div class="empty">${s?"No repairing record found.":"No repairing records yet."}</div>`;return}
    box.innerHTML=arr.map(r=>`<article class="result">
      <div class="result-name">${esc(r.customerName||"")}</div><div class="result-meta">${esc(r.phone||"")} • ${esc(formatDateTime(r))}</div>
      <div class="result-grid">${item("Brand / Model",r.device)}${item("Problem",r.problem)}${item("Repairing By",r.repairBy)}${item("Payment",`₹${Number(r.payment||0).toLocaleString("en-IN")}`)}</div>
    </article>`).join("");
}
async function saveRepair(e){
    e.preventDefault();
    if(!ensureBusinessHours("repairMessage"))return;
    const ids=["repairCustomerName","repairPhone","repairDevice","repairProblem","repairBy","repairPayment"];
    for(const id of ids)if(!val(id)){ $(id)?.focus();msg("repairMessage","सभी fields भरना जरूरी है.");return }
    const phone=val("repairPhone").replace(/\D/g,"");
    if(!/^\d{10}$/.test(phone)){msg("repairMessage","10 digit customer phone number डालें.");return}
    const saveBtn = $("repairForm")?.querySelector("button[type='submit']");
    if(saveBtn) saveBtn.disabled=true;

    try{
        await addDoc(collection(db,REPAIR_COL),{
            customerName:val("repairCustomerName"),
            phone,
            device:val("repairDevice"),
            problem:val("repairProblem"),
            repairBy:val("repairBy"),
            payment:Number(val("repairPayment")),
            createdAt:serverTimestamp(),
            createdBy:user?.uid||null
        });
        await audit("REPAIR_ADDED",{customerName:val("repairCustomerName"),problem:val("repairProblem"),payment:Number(val("repairPayment"))});

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
    exportXlsx(customers.map(c=>({"Customer Code":c.customerCode||"","Date & Time":formatDateTime(c),"Customer Name":c.customerName||"",
      "Phone":c.phone||"","Address":c.address||"","PIN Code":c.pincode||"","City":c.city||"","State":c.state||"",
      "Brand":c.brand||"","Model":c.model||"","IMEI":c.imei||"","Colour":c.colour||"","RAM + Storage":c.storage||"",
      "Finance Company":c.financeCompany||"","Phone Amount":c.phoneAmount||0,"Down Payment":c.downPayment||0,
      "EMI Amount":c.emiAmount||0,"EMI Months":c.emiMonths||0,"Lock":c.lockName||"","Stock":c.stock||"",
      "Counter":c.counter||"","Financer":c.financerName||"","Bill":c.billYes?"YES":"NO"})),"Kabir_Mobile_Customers.xlsx","Customers");
}
function exportRepairing(){
    if(!repairing.length){alert("Repairing data अभी उपलब्ध नहीं है.");return}
    exportXlsx(repairing.map(r=>({"Date & Time":formatDateTime(r),"Customer Name":r.customerName||"","Phone":r.phone||"",
      "Brand / Model":r.device||"","Problem":r.problem||"","Repairing By":r.repairBy||"","Payment":r.payment||0})),
      "Kabir_Repairing_Data.xlsx","Repairing");
}
async function downloadCustomerPdf(){
    const c=customers.find(x=>x.id===activeCustomerId);if(!c)return;
    try{
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
    $("searchRepairingCard")?.addEventListener("click",()=>{show("repairSearchSection");renderRepairing();$("repairSearchInput")?.focus()});
    $("repairSearchInput")?.addEventListener("input",renderRepairing);
    $("repairSearchDate")?.addEventListener("change",renderRepairing);
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

function init(){
    loadSharedPin();

    // Firebase authentication must finish before accessUsers/auditLogs are touched.
    authInit().then(async()=>{
        await authReady;
        if(user){
            subscribe();
            subscribeRepairing();
        }

        if(currentPageIsAdmin()){
            adminFeatureNav();
        }else{
            setupKabirLogin();
            ensureAccessOnMain();
        }
    }).catch(e=>{
        console.error("Firebase initialization failed:",e);
        if(currentPageIsAdmin()){
            msg("adminFirebaseStatus","Firebase initialization error.");
        }
    });

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

    $("customerForm")
        ?.addEventListener(
            "submit",
            save
        );
}


document.addEventListener(
    "DOMContentLoaded",
    init
);
\nwindow.addEventListener("beforeunload",()=>{\n    // Do not automatically mark offline here: refreshes should not log the user out.\n});\n