import {initializeApp} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {getAuth,signInWithCustomToken,onAuthStateChanged,signOut} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {getFirestore,collection,addDoc,updateDoc,deleteDoc,setDoc,getDoc,doc,onSnapshot,query,orderBy,serverTimestamp} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import {getFunctions,httpsCallable} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-functions.js";

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
const SETTINGS_COL="settings";
const SETTINGS_DOC="security";
const REMOTE_DEVICES_URL="https://cdn.jsdelivr.net/gh/bsthen/device-models/devices.json";

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

    if(navigator.vibrate){
        try{navigator.vibrate([90,35,90,35,140]);}catch(_){}
    }

    input?.select();
    setTimeout(()=>card?.classList.remove("pin-shake"),500);
}

function setupPin(){
    const e=$("pinInput");
    if(!e)return;

    e.addEventListener("input",async()=>{
        e.value=e.value.replace(/\D/g,"").slice(0,4);
        dots(e.value);
        msg("pinMessage","");

        if(e.value.length===4){
            const entered=e.value;

            if(!pinLoaded) await loadSharedPin();

            if(entered===pin()){
                unlock();
            }else{
                msg("pinMessage","Incorrect PIN");
                pinError();
                setTimeout(()=>{
                    e.value="";
                    dots("");
                    msg("pinMessage","");
                    e.focus();
                },500);
            }
        }
    });

    $("lockButton")?.addEventListener("click",lock);

    if(sessionStorage.getItem("kabir_unlocked")==="1")
        unlock();
    else
        setTimeout(()=>e.focus(),250);
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
    });
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
            show("searchSection");
            renderSearch();
        }
    );

    $("repairTotalDevicesCard")?.addEventListener(
        "click",
        ()=>{
            show("searchSection");
            renderSearch();
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

async function save(e){

    e.preventDefault();

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

        let customerData={

            customerCode:await uniqueCustomerCode(),
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
            delete customerData.customerCode;
            delete customerData.createdAt;
            delete customerData.createdBy;
            await updateDoc(doc(db,COL,editId),customerData);
        }else{
            await addDoc(collection(db,COL),customerData);
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
    if(!confirm(`Delete ${c.customerName||"this customer"} (${c.customerCode||""}) permanently?`))return;
    try{await deleteDoc(doc(db,COL,c.id));closeCustomerDetail()}
    catch(e){console.error(e);alert("Customer delete नहीं हुआ. Firebase Rules check करें.")}
}
function editCustomer(){
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

    let f=$("changePinForm");

    if(!f)return;


    f.onsubmit=e=>{

        e.preventDefault();


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
    const arr=repairing.filter(r=>!s||[r.customerName,r.phone,r.device,r.problem,r.repairBy,r.payment,formatDateTime(r)].join(" ").toLowerCase().includes(s));
    if(!arr.length){box.innerHTML=`<div class="empty">${s?"No repairing record found.":"No repairing records yet."}</div>`;return}
    box.innerHTML=arr.map(r=>`<article class="result">
      <div class="result-name">${esc(r.customerName||"")}</div><div class="result-meta">${esc(r.phone||"")} • ${esc(formatDateTime(r))}</div>
      <div class="result-grid">${item("Brand / Model",r.device)}${item("Problem",r.problem)}${item("Repairing By",r.repairBy)}${item("Payment",`₹${Number(r.payment||0).toLocaleString("en-IN")}`)}</div>
    </article>`).join("");
}
async function saveRepair(e){
    e.preventDefault();
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

    setupPin();

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

    authInit();

    subscribe();
    subscribeRepairing();

    $("customerForm")
        ?.addEventListener(
            "submit",
            save
        );
}


/* =====================================================================
   KABIR MOBILE DATA — SECURE AI / USER LOGIN UPGRADE
   This block intentionally overrides only the authentication, write,
   admin, AI and initialization layer. Existing customer UI/brand/search
   functions above remain available and are reused.
===================================================================== */

let kabirFunctions=null;
let kabirRole=null;
let kabirUserId="";
let kabirSessionId="";
let kabirAdminListenersStarted=false;
let kabirEmployeeListenerStarted=false;
let kabirLogListenerStarted=false;
let kabirAdminUnsubEmployees=null;
let kabirAdminUnsubLogs=null;
let kabirVoiceRecognition=null;

function isAdminPage(){return document.body?.dataset?.page==="admin";}
function isLoggedIn(){return !!user && !!kabirRole;}
function isWriteLocked(){
    const d=new Date();
    const h=d.getHours();
    return h>=0 && h<10;
}
function lockMessage(){return "🔒 अभी रात 12:00 AM से सुबह 10:00 AM तक database write lock active है। Add / Edit / Delete सुबह 10:00 AM के बाद उपलब्ध होगा।";}
function showLoginScreen(){
    if(isAdminPage()){
        $("adminLoginScreen")?.classList.remove("hidden");
        $("adminAppScreen")?.classList.add("hidden");
    }else{
        $("loginScreen")?.classList.remove("hidden");
        $("appScreen")?.classList.add("hidden");
    }
}
function showAppScreen(){
    if(isAdminPage()){
        $("adminLoginScreen")?.classList.add("hidden");
        $("adminAppScreen")?.classList.remove("hidden");
    }else{
        $("loginScreen")?.classList.add("hidden");
        $("appScreen")?.classList.remove("hidden");
    }
    applyWriteLockUI();
}
function currentActor(){return {uid:user?.uid||null,userId:kabirUserId||user?.displayName||"unknown",role:kabirRole||"unknown"};}
function setStatus(text,ok=true){
    const e=$("adminFirebaseStatus");
    if(e){e.textContent=text;e.classList.toggle("ok",!!ok);e.classList.toggle("bad",!ok);}
}
function writeDenied(target="formMessage"){
    msg(target,lockMessage());
    applyWriteLockUI();
    return true;
}
function applyWriteLockUI(){
    const locked=isWriteLocked();
    const banners=[$("writeLockBanner"),$("adminLockBanner")];
    banners.forEach(b=>b?.classList.toggle("hidden",!locked));
    const ids=["addCustomerCard","addRepairingCard","saveCustomerButton","repairForm","editCustomerButton","deleteCustomerButton"];
    ids.forEach(id=>{
        const e=$(id); if(!e)return;
        e.classList.toggle("write-disabled",locked);
        if("disabled" in e && id!=="repairForm")e.disabled=locked;
        if(id==="repairForm")e.querySelectorAll("input,select,button,textarea").forEach(x=>x.disabled=locked);
    });
    document.querySelectorAll("[data-bill]").forEach(x=>x.disabled=locked);
}
function startWriteClock(){
    applyWriteLockUI();
    clearInterval(window.__kabirWriteClock);
    window.__kabirWriteClock=setInterval(applyWriteLockUI,15000);
}

async function callKabir(name,data={}){
    if(!kabirFunctions)throw new Error("Firebase Functions अभी तैयार नहीं है.");
    const fn=httpsCallable(kabirFunctions,name);
    const res=await fn(data);
    return res.data;
}

function appendAiMessage(boxId,text,who){
    const box=$(boxId);if(!box)return;
    const div=document.createElement("div");
    div.className=`ai-msg ${who}`;
    div.textContent=text;
    box.appendChild(div);
    box.scrollTop=box.scrollHeight;
}
function aiBusy(boxId,busy){
    const box=$(boxId);if(!box)return;
    let e=box.querySelector(".ai-thinking");
    if(busy && !e){e=document.createElement("div");e.className="ai-msg bot ai-thinking";e.textContent="Kabir AI सोच रहा है…";box.appendChild(e);box.scrollTop=box.scrollHeight;}
    if(!busy)e?.remove();
}
function speechInput(inputId,voiceBtnId){
    const btn=$(voiceBtnId),input=$(inputId);if(!btn||!input)return;
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){btn.title="इस browser में voice input available नहीं है";return;}
    btn.addEventListener("click",()=>{
        if(kabirVoiceRecognition){try{kabirVoiceRecognition.stop();}catch(_){}kabirVoiceRecognition=null;btn.textContent="🎙️";return;}
        const r=new SR();kabirVoiceRecognition=r;r.lang="hi-IN";r.interimResults=false;r.continuous=false;
        btn.textContent="⏺️";
        r.onresult=e=>{input.value=e.results?.[0]?.[0]?.transcript||"";input.focus();};
        r.onerror=()=>{btn.textContent="🎙️";kabirVoiceRecognition=null;};
        r.onend=()=>{btn.textContent="🎙️";kabirVoiceRecognition=null;};
        try{r.start();}catch(e){btn.textContent="🎙️";kabirVoiceRecognition=null;}
    });
}
function speakHindi(text){
    if(!("speechSynthesis" in window))return;
    try{
        window.speechSynthesis.cancel();
        const u=new SpeechSynthesisUtterance(text.replace(/[*_#`]/g,""));
        u.lang=/[\u0900-\u097F]/.test(text)?"hi-IN":"en-IN";
        u.rate=.96;window.speechSynthesis.speak(u);
    }catch(_){}
}

async function askAi(inputId,boxId,admin=false){
    const input=$(inputId);if(!input)return;
    const q=input.value.trim();if(!q)return;
    input.value="";
    appendAiMessage(boxId,q,"user");
    aiBusy(boxId,true);
    try{
        const data=await callKabir("askKabirAI",{question:q,admin:!!admin});
        aiBusy(boxId,false);
        appendAiMessage(boxId,data?.answer||"AI ने कोई जवाब नहीं दिया.","bot");
        if(data?.answer)speakHindi(data.answer);
    }catch(e){
        aiBusy(boxId,false);
        const message=e?.message||"AI service अभी उपलब्ध नहीं है.";
        appendAiMessage(boxId,"⚠️ "+message,"bot");
    }
}
function setupMainAI(){
    $("aiButton")?.addEventListener("click",()=>$("aiModal")?.classList.remove("hidden"));
    $("closeAiButton")?.addEventListener("click",()=>$("aiModal")?.classList.add("hidden"));
    $("aiSendButton")?.addEventListener("click",()=>askAi("aiInput","aiMessages",false));
    $("aiInput")?.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();askAi("aiInput","aiMessages",false);}});
    $("aiVoiceButton")&&speechInput("aiInput","aiVoiceButton");
    $("aiSuggestions")?.addEventListener("click",e=>{const b=e.target.closest("[data-ai]");if(b){$("aiInput").value=b.dataset.ai;askAi("aiInput","aiMessages",false);}});
    document.querySelectorAll("#aiModal [data-ai]").forEach(b=>b.addEventListener("click",()=>{$("aiInput").value=b.dataset.ai;askAi("aiInput","aiMessages",false);}));
}

async function employeeLogin(e){
    e.preventDefault();
    const id=val("employeeIdInput").toUpperCase();const password=val("employeePasswordInput");
    if(!id||!password){msg("loginMessage","ID और Password दोनों डालना जरूरी है.");return;}
    const btn=e.currentTarget.querySelector("button[type='submit']");if(btn)btn.disabled=true;
    try{
        const data=await callKabir("employeeLogin",{userId:id,password});
        await signInWithCustomToken(auth,data.token);
        sessionStorage.setItem("kabir_login_id",data.userId||id);
        msg("loginMessage","Login successful ✓",true);
    }catch(err){
        console.error(err);msg("loginMessage",err?.message||"Login failed.");
    }finally{if(btn)btn.disabled=false;}
}
async function adminLogin(e){
    e.preventDefault();const pin=val("adminPinInput");
    if(!pin){msg("adminLoginMessage","Admin PIN डालें.");return;}
    const btn=e.currentTarget.querySelector("button[type='submit']");if(btn)btn.disabled=true;
    try{
        const data=await callKabir("adminLogin",{pin});
        await signInWithCustomToken(auth,data.token);
        msg("adminLoginMessage","Login successful ✓",true);
    }catch(err){console.error(err);msg("adminLoginMessage",err?.message||"Admin login failed.");}
    finally{if(btn)btn.disabled=false;}
}

/* New secure PIN compatibility functions — old shared PIN storage is no longer used for website access. */
async function loadSharedPin(){pinLoaded=true;sharedPin=DEFAULT_PIN;return sharedPin;}
function pin(){return sharedPin;}
async function changeSharedPin(newPin){
    const data=await callKabir("changeAdminPin",{newPin});
    return data;
}
function setupPin(){
    $("employeeLoginForm")?.addEventListener("submit",employeeLogin);
    $("adminLoginForm")?.addEventListener("submit",adminLogin);
    $("lockButton")?.addEventListener("click",async()=>{try{await callKabir("logout");}catch(_){}await signOut(auth);sessionStorage.removeItem("kabir_login_id");showLoginScreen();});
    $("adminLogoutButton")?.addEventListener("click",async()=>{try{await callKabir("logout");}catch(_){}await signOut(auth);showLoginScreen();});
}

async function authInit(){
    try{kabirFunctions=getFunctions(app,"asia-south1");}catch(e){console.error(e);}
    onAuthStateChanged(auth,async u=>{
        user=u;kabirRole=null;kabirUserId="";kabirSessionId="";
        if(!u){showLoginScreen();setStatus("Login required",false);return;}
        try{
            const token=await u.getIdTokenResult(true);
            kabirRole=token.claims?.role||null;
            kabirUserId=token.claims?.userId||u.displayName||"";
            kabirSessionId=token.claims?.sessionId||"";
            if(isAdminPage() && kabirRole!=="admin"){await signOut(auth);showLoginScreen();return;}
            if(!isAdminPage() && !["employee","admin"].includes(kabirRole)){await signOut(auth);showLoginScreen();return;}
            showAppScreen();setStatus(`Firebase connected • ${kabirUserId||kabirRole}`,true);
            if(isAdminPage())startAdminPanel();
            else startEmployeePanel();
        }catch(e){console.error(e);await signOut(auth);showLoginScreen();setStatus("Authentication error",false);}
    });
}

function startEmployeePanel(){
    if(kabirEmployeeListenerStarted)return;
    kabirEmployeeListenerStarted=true;
    subscribe();subscribeRepairing();setupMainAI();startWriteClock();
    $("customerForm")?.addEventListener("submit",save);
}

/* Secure customer save replacement. Existing form structure is unchanged. */
async function save(e){
    e.preventDefault();
    if(!isLoggedIn()){msg("formMessage","पहले login करें.");return;}
    if(isWriteLocked()){writeDenied();return;}
    const ids=["customerName","address","pincode","city","state","phone","brand","model","imei","colour","storage","phoneAmount","downPayment"];
    for(const id of ids){if(!val(id)){$(id)?.focus();msg("formMessage","सभी जरूरी fields भरें.");return;}}
    const phone=val("phone").replace(/\D/g,"");const imei=val("imei").replace(/\D/g,"");
    if(!/^\d{10}$/.test(phone)){msg("formMessage","10 digit mobile number डालें.");return;}
    if(!/^\d{15}$/.test(imei)){msg("formMessage","15 digit IMEI डालें.");return;}
    const saveBtn=$("saveCustomerButton");saveBtn.disabled=true;$('saveSpinner')?.classList.remove("hidden");msg("formMessage","Saving…",true);
    try{
        const editId=$("customerForm").dataset.editId;
        const base={customerName:val("customerName"),address:val("address"),pincode:val("pincode"),city:val("city"),state:val("state"),phone,brand:val("brand"),model:val("model"),imei,colour:val("colour"),storage:val("storage"),financeCompany:val("financeCompany"),phoneAmount:Number(val("phoneAmount"))||0,downPayment:Number(val("downPayment"))||0,emiAmount:Number(val("emiAmount"))||0,emiMonths:Number(val("emiMonths"))||0,lockName:val("lockName"),stock:val("stock"),counter:val("counter"),financerName:val("financerName"),bill:{status:"NO",dueDate:billDate()},billYes:false,deviceCount:1,documents:{aadhaar:null,pan:null,customerPhoto:null},updatedByUserId:kabirUserId,updatedByUid:user.uid};
        if(editId){await updateDoc(doc(db,COL,editId),base);}else{await addDoc(collection(db,COL),{...base,customerCode:await uniqueCustomerCode(),createdAt:serverTimestamp(),createdBy:user.uid,createdByUserId:kabirUserId});}
        $("customerForm").reset();delete $("customerForm").dataset.editId;$('customerCode').value="";$('saveCustomerButton').textContent="22. SAVE CUSTOMER";$('financeCompany').value="";
        $("model").innerHTML='<option value="">Select brand first</option>';$("model").disabled=true;$("colour").innerHTML='<option value="">Select model first</option>';$("colour").disabled=true;$("storage").innerHTML='<option value="">Select model first</option>';$("storage").disabled=true;billDate();msg("formMessage","");showSuccessToast(editId?"Updated Successfully":"Successfully Saved",editId?"Customer data updated successfully":"Customer data saved successfully");
        setTimeout(()=>$("addSection")?.classList.add("hidden"),900);
    }catch(err){console.error(err);msg("formMessage",err?.message||"Customer save नहीं हुआ.");}
    finally{$('saveCustomerButton').disabled=isWriteLocked();$('saveSpinner')?.classList.add("hidden");}
}

async function saveRepair(e){
    e.preventDefault();if(!isLoggedIn()){msg("repairMessage","पहले login करें.");return;}if(isWriteLocked()){writeDenied("repairMessage");return;}
    const ids=["repairCustomerName","repairPhone","repairDevice","repairProblem","repairBy","repairPayment"];for(const id of ids)if(!val(id)){$(id)?.focus();msg("repairMessage","सभी fields भरना जरूरी है.");return;}
    const phone=val("repairPhone").replace(/\D/g,"");if(!/^\d{10}$/.test(phone)){msg("repairMessage","10 digit customer phone number डालें.");return;}
    const btn=$("repairForm")?.querySelector("button[type='submit']");if(btn)btn.disabled=true;
    try{await addDoc(collection(db,REPAIR_COL),{customerName:val("repairCustomerName"),phone,device:val("repairDevice"),problem:val("repairProblem"),repairBy:val("repairBy"),payment:Number(val("repairPayment"))||0,createdAt:serverTimestamp(),createdBy:user.uid,createdByUserId:kabirUserId});$("repairForm").reset();msg("repairMessage","");showSuccessToast("Successfully Saved","Repairing data saved successfully");}
    catch(err){console.error(err);msg("repairMessage",err?.message||"Repairing save नहीं हुआ.");}
    finally{if(btn)btn.disabled=isWriteLocked();}
}

async function deleteCustomer(){
    const c=customers.find(x=>x.id===activeCustomerId);if(!c)return;if(isWriteLocked()){alert(lockMessage());return;}
    if(!confirm(`Delete ${c.customerName||"this customer"} (${c.customerCode||""}) permanently?`))return;
    try{await deleteDoc(doc(db,COL,c.id));closeCustomerDetail();}catch(e){console.error(e);alert(e?.message||"Customer delete नहीं हुआ.");}
}
function editCustomer(){
    const c=customers.find(x=>x.id===activeCustomerId);if(!c)return;if(isWriteLocked()){alert(lockMessage());return;}
    closeCustomerDetail();show("addSection");
    const map={customerName:"customerName",address:"address",pincode:"pincode",city:"city",state:"state",phone:"phone",brand:"brand",model:"model",imei:"imei",colour:"colour",storage:"storage",financeCompany:"financeCompany",phoneAmount:"phoneAmount",downPayment:"downPayment",emiAmount:"emiAmount",emiMonths:"emiMonths",lockName:"lockName",stock:"stock",counter:"counter",financerName:"financerName"};
    Object.entries(map).forEach(([k,id])=>{if($(id))$(id).value=c[k]??""});$("customerCode").value=c.customerCode||"";$("saveCustomerButton").textContent="UPDATE CUSTOMER";$("customerForm").dataset.editId=c.id;$("brand").dispatchEvent(new Event("change"));setTimeout(()=>{$("model").value=c.model||"";$('model').dispatchEvent(new Event("change"));setTimeout(()=>{$("colour").value=c.colour||"";$('storage').value=c.storage||""},0)},100);applyWriteLockUI();
}

/* Bill switch write guard: the original renderer remains intact, but the server rules also enforce the lock. */
function featureNav(){
    $("addRepairingCard")?.addEventListener("click",()=>{if(isWriteLocked()){alert(lockMessage());return;}show("repairAddSection");});
    $("searchRepairingCard")?.addEventListener("click",()=>{show("repairSearchSection");renderRepairing();$("repairSearchInput")?.focus();});
    $("repairSearchInput")?.addEventListener("input",renderRepairing);
    $("repairForm")?.addEventListener("submit",saveRepair);
    $("exportCustomersButton")?.addEventListener("click",exportCustomers);
    $("exportRepairingButton")?.addEventListener("click",exportRepairing);
    $("downloadCustomerPdf")?.addEventListener("click",downloadCustomerPdf);
    $("deleteCustomerButton")?.addEventListener("click",deleteCustomer);
    $("editCustomerButton")?.addEventListener("click",editCustomer);
    $("closeDetailButton")?.addEventListener("click",closeCustomerDetail);
}

/* Admin panel */
function startAdminPanel(){
    if(kabirAdminListenersStarted)return;kabirAdminListenersStarted=true;
    setupAdminAI();loadAdminEmployees();loadAdminLogs();startWriteClock();
    $("createEmployeeForm")?.addEventListener("submit",createEmployee);
    $("adminQuickAnalysisButton")?.addEventListener("click",()=>runAdminReport());
    $("refreshLogsButton")?.addEventListener("click",loadAdminLogs);
    $("copyCredentialsButton")?.addEventListener("click",copyCredentials);
    $("adminAiOpenButton")?.addEventListener("click",()=>$("adminAiModal")?.classList.remove("hidden"));
}
async function loadAdminEmployees(){
    const box=$("employeeList");if(!box)return;
    try{
        if(kabirAdminUnsubEmployees)kabirAdminUnsubEmployees();
        kabirAdminUnsubEmployees=onSnapshot(collection(db,"employees"),snap=>{
            const arr=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(a.userId||"").localeCompare(String(b.userId||"")));
            if(!arr.length){box.innerHTML='<div class="empty">अभी कोई website user नहीं है। ऊपर से पहला user बनाइए।</div>';return;}
            box.innerHTML=arr.map(u=>{const online=u.activeSession===true;return `<article class="user-row"><div class="user-row-top"><div><strong>${esc(u.userId||"")}</strong><div class="user-meta">${esc(u.name||"Website User")} • Created ${esc(u.createdAt?.toDate?formatDateTime({createdAt:u.createdAt}):"-")}</div></div><span class="status-pill ${online?'online':'offline'}">${online?'🟢 ONLINE':'⚪ OFFLINE'}</span></div><div class="user-meta">Last active: ${esc(u.lastActiveAt?.toDate?formatDateTime({createdAt:u.lastActiveAt}):"-")} • ${u.disabled?'DISABLED':'ACTIVE'}</div><div class="row-actions">${u.disabled?`<button data-user-enable="${esc(u.id)}">ENABLE</button>`:`<button data-user-disable="${esc(u.id)}">DISABLE</button>`}${online?`<button data-user-logout="${esc(u.id)}">FORCE LOGOUT</button>`:''}<button class="danger" data-user-delete="${esc(u.id)}">DELETE</button></div></article>`}).join("");
            box.querySelectorAll("[data-user-enable]").forEach(b=>b.onclick=()=>manageEmployee(b.dataset.userEnable,"enableEmployee"));
            box.querySelectorAll("[data-user-disable]").forEach(b=>b.onclick=()=>manageEmployee(b.dataset.userDisable,"disableEmployee"));
            box.querySelectorAll("[data-user-logout]").forEach(b=>b.onclick=()=>manageEmployee(b.dataset.userLogout,"forceLogoutEmployee"));
            box.querySelectorAll("[data-user-delete]").forEach(b=>b.onclick=()=>manageEmployee(b.dataset.userDelete,"deleteEmployee"));
        },e=>{console.error(e);box.innerHTML='<div class="empty">Users load नहीं हुए. Firebase Rules/Functions check करें.</div>';});
    }catch(e){console.error(e);}
}
async function createEmployee(e){
    e.preventDefault();const msgId="createEmployeeMessage";
    const userId=val("newEmployeeId").toUpperCase();const name=val("newEmployeeName");const password=val("newEmployeePassword");
    if(userId && !/^[A-Z0-9_\-]{4,32}$/.test(userId)){msg(msgId,"ID 4-32 characters की हो: A-Z, 0-9, _ या -");return;}
    const btn=e.currentTarget.querySelector("button[type='submit']");if(btn)btn.disabled=true;
    try{
        const data=await callKabir("createEmployee",{userId,name,password});
        $("createdUserId").textContent=data.userId;$("createdUserPassword").textContent=data.password;$("newCredentialsBox").classList.remove("hidden");$("createEmployeeForm").reset();msg(msgId,"User successfully बनाया गया ✓",true);loadAdminEmployees();
    }catch(err){console.error(err);msg(msgId,err?.message||"User create नहीं हुआ.");}
    finally{if(btn)btn.disabled=false;}
}
async function manageEmployee(uid,action){
    try{await callKabir(action,{uid});loadAdminEmployees();}catch(e){alert(e?.message||"Action failed.");}
}
function copyCredentials(){
    const text=`Kabir Mobile Data Login\nID: ${$("createdUserId")?.textContent||""}\nPassword: ${$("createdUserPassword")?.textContent||""}`;
    navigator.clipboard?.writeText(text).then(()=>showSuccessToast("Copied","Login details copied"));
}
async function loadAdminLogs(){
    const box=$("adminLogs");if(!box)return;
    try{
        if(kabirAdminUnsubLogs)kabirAdminUnsubLogs();
        kabirAdminUnsubLogs=onSnapshot(collection(db,"auditLogs"),snap=>{
            const arr=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>{const ta=a.timestamp?.toMillis?.()||0,tb=b.timestamp?.toMillis?.()||0;return tb-ta}).slice(0,80);
            if(!arr.length){box.innerHTML='<div class="empty">अभी activity logs नहीं हैं।</div>';return;}
            box.innerHTML=arr.map(l=>`<article class="log-row"><div class="log-row-top"><div><strong>${esc(l.userId||l.uid||"Unknown")}</strong><div class="log-meta">${esc(l.action||"WORK")} • ${esc(l.collection||"")} • ${esc(l.documentId||"")}</div></div><span class="status-pill">${esc(l.timestamp?.toDate?formatDateTime({createdAt:l.timestamp}):"Pending")}</span></div><div class="log-meta">${esc(l.summary||"")}</div></article>`).join("");
        },e=>{console.error(e);box.innerHTML='<div class="empty">Activity logs load नहीं हुए.</div>';});
    }catch(e){console.error(e);}
}
async function runAdminReport(){
    const box=$("adminAnalysisResult");if(!box)return;box.classList.remove("hidden");box.textContent="AI report बन रही है…";
    try{const d=await callKabir("askKabirAI",{question:"आज की पूरी activity report दो। किस user ने क्या किया, कितने customer/repairing add/edit/delete हुए और कोई महत्वपूर्ण बात हो तो बताओ।",admin:true});box.textContent=d?.answer||"Report नहीं मिली.";speakHindi(d?.answer||"");}
    catch(e){box.textContent="⚠️ "+(e?.message||"AI report नहीं बन पाई.");}
}
function setupAdminAI(){
    $("adminAiSendButton")?.addEventListener("click",()=>askAi("adminAiInput","adminAiMessages",true));
    $("adminAiInput")?.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();askAi("adminAiInput","adminAiMessages",true);}});
    speechInput("adminAiInput","adminAiVoiceButton");
    $("closeAdminAiButton")?.addEventListener("click",()=>$("adminAiModal")?.classList.add("hidden"));
    document.querySelectorAll("#adminAiModal [data-admin-ai]").forEach(b=>b.addEventListener("click",()=>{$("adminAiInput").value=b.dataset.adminAi;askAi("adminAiInput","adminAiMessages",true);}));
}

function init(){
    setupPin();changePin();
    nav();brands();setupFinanceCompany();pincode();amounts();billDate();search();scanner();themeSystem();featureNav();authInit();
    applyWriteLockUI();startWriteClock();
}
document.addEventListener("DOMContentLoaded",init);


/* Admin PIN form for the new secure backend. */
function changePin(){
    const f=$("changePinForm");if(!f)return;
    f.addEventListener("submit",async e=>{
        e.preventDefault();
        const a=val("newPin"),b=val("confirmPin");
        if(!/^\d{4,12}$/.test(a)){msg("pinSettingsMessage","PIN 4 से 12 digits का होना चाहिए.");return;}
        if(a!==b){msg("pinSettingsMessage","दोनों PIN match नहीं हैं.");return;}
        try{await changeSharedPin(a);f.reset();msg("pinSettingsMessage","Admin PIN successfully updated ✓",true);}catch(err){msg("pinSettingsMessage",err?.message||"PIN update नहीं हुआ.");}
    });
}

function nav(){
    $("searchCustomerCard")?.addEventListener("click",()=>{show("searchSection");$("searchInput")?.focus();renderSearch();});
    $("addCustomerCard")?.addEventListener("click",()=>{if(isWriteLocked()){alert(lockMessage());return;}show("addSection");});
    $("totalCustomersCard")?.addEventListener("click",()=>{show("searchSection");renderSearch();});
    $("totalDevicesCard")?.addEventListener("click",()=>{show("searchSection");renderSearch();});
    $("repairTotalCustomersCard")?.addEventListener("click",()=>{show("repairSearchSection");renderRepairing();});
    $("repairTotalDevicesCard")?.addEventListener("click",()=>{show("repairSearchSection");renderRepairing();});
    document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>$(b.dataset.close)?.classList.add("hidden")));
}
