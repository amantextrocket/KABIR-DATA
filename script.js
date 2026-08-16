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
const DEFAULT_PIN="2968";
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


let adminLoginBusy=false;

function adminPinShake(){
    const card=document.querySelector("#adminLoginScreen .pin-card");
    const input=$("adminPinInput");

    if(card){
        card.classList.remove("pin-shake");
        void card.offsetWidth;
        card.classList.add("pin-shake");
        setTimeout(()=>card.classList.remove("pin-shake"),550);
    }

    if(navigator.vibrate){
        try{navigator.vibrate([100,40,100,40,150]);}catch(_){}
    }

    setTimeout(()=>{
        if(input){
            input.value="";
            input.focus();
        }
    },550);
}

async function adminLogin(e){
    if(e?.preventDefault)e.preventDefault();

    const input=$("adminPinInput");
    const pin=String(input?.value||"").replace(/\D/g,"").slice(0,4);

    if(input)input.value=pin;

    if(pin.length!==4){
        msg("adminLoginMessage","4 digit PIN डालें.");
        input?.focus();
        return false;
    }

    if(adminLoginBusy)return false;
    adminLoginBusy=true;

    msg("adminLoginMessage","Checking PIN…",true);

    try{
        if(!kabirFunctions){
            kabirFunctions=getFunctions(app,"asia-south1");
        }

        const data=await callKabir("adminLogin",{pin});

        if(!data?.token){
            throw new Error("Admin login token नहीं मिला.");
        }

        await signInWithCustomToken(auth,data.token);

        msg("adminLoginMessage","Login successful ✓",true);
        return true;
    }catch(err){
        console.error("ADMIN LOGIN ERROR:",err);
        msg("adminLoginMessage","Wrong PIN");
        adminPinShake();
        return false;
    }finally{
        adminLoginBusy=false;
    }
}

function setupPin(){
    $("employeeLoginForm")?.addEventListener("submit",employeeLogin);

    const form=$("adminLoginForm");
    const input=$("adminPinInput");

    if(form){
        form.addEventListener("submit",e=>{
            e.preventDefault();
            if(input?.value.length===4)adminLogin(e);
        });
    }

    if(input){
        input.maxLength=4;
        input.inputMode="numeric";

        input.addEventListener("input",()=>{
            input.value=input.value.replace(/\D/g,"").slice(0,4);

            if(input.value.length===4){
                adminLogin();
            }
        });

        input.addEventListener("keydown",e=>{
            if(e.key==="Enter"){
                e.preventDefault();
                adminLogin();
            }
        });
    }

    $("lockButton")?.addEventListener("click",async()=>{
        try{await callKabir("logout");}catch(_){}
        await signOut(auth);
        sessionStorage.removeItem("kabir_login_id");
        showLoginScreen();
    });

    $("adminLogoutButton")?.addEventListener("click",async()=>{
        try{await callKabir("logout");}catch(_){}
        await signOut(auth);
        showLoginScreen();
    });
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
        if(a!=="2968"){msg("pinSettingsMessage","Admin PIN fixed है: 2968");return;}
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
