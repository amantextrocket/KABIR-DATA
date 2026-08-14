import {initializeApp} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {getAuth,signInAnonymously,onAuthStateChanged} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {getFirestore,collection,addDoc,updateDoc,doc,onSnapshot,query,orderBy,serverTimestamp} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

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

let user=null;
let customers=[];
let scanStream=null;
let scanTimer=null;

const $=id=>document.getElementById(id);
const val=id=>($(id)?.value||"").trim();


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

function pin(){
    return localStorage.getItem(PIN_KEY)||DEFAULT_PIN;
}

function msg(id,t,ok=false){
    let e=$(id);

    if(e){
        e.textContent=t;
        e.style.color=ok?"var(--success)":"";
    }
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

function setupPin(){

    let e=$("pinInput");

    if(!e)return;

    e.addEventListener("input",()=>{

        e.value=e.value
            .replace(/\D/g,"")
            .slice(0,4);

        dots(e.value);

        msg("pinMessage","");

        if(e.value.length===4){

            if(e.value===pin()){

                unlock();

            }else{

                msg("pinMessage","Incorrect PIN");

                if(navigator.vibrate)
                    navigator.vibrate([80,40,80]);

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

    let q=query(
        collection(db,COL),
        orderBy("createdAt","desc")
    );

    onSnapshot(
        q,
        s=>{

            customers=s.docs.map(
                d=>({
                    id:d.id,
                    ...d.data()
                })
            );

            counts();
            renderSearch();
            updateAdmin();

        },
        e=>{

            console.error(e);

            msg(
                "formMessage",
                "Firestore access error. Check Firebase Firestore rules."
            );
        }
    );
}


/* =========================================================
   COUNTS
========================================================= */

function counts(){

    let n=customers.length;

    let d=customers.reduce(
        (s,c)=>s+(c.deviceCount||1),
        0
    );

    if($("totalCustomers"))
        $("totalCustomers").textContent=n;

    if($("totalDevices"))
        $("totalDevices").textContent=d;
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
        "addSection"
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

            Object.keys(d.models)
                .sort()
                .forEach(x=>{

                    let o=document.createElement("option");

                    o.value=x;
                    o.textContent=x;

                    m.appendChild(o);
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

        await addDoc(
            collection(db,COL),
            customerData
        );


        /*
         * Form reset
         */

        $("customerForm").reset();


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


        msg(
            "formMessage",
            "Customer saved successfully ✓",
            true
        );


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

    let box=$("searchResults");

    if(!box)return;

    let s=
        val("searchInput")
        .toLowerCase();


    let arr=customers.filter(c=>{

        if(!s)
            return true;

        let date=
            c.createdAt
            ?.toDate
            ?.()
            ?.toLocaleDateString("en-IN")
            ||"";


        return [

            c.customerName,
            c.phone,
            c.imei,
            c.pincode,
            c.city,
            c.state,
            c.brand,
            c.model,
            c.colour,
            c.storage,
            c.lockName,
            c.stock,
            c.counter,
            c.financerName,
            date

        ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(s);
    });


    if(!arr.length){

        box.innerHTML=`

            <div class="empty">

                ${
                    s
                    ?"No customer found."
                    :"No customer records yet."
                }

            </div>
        `;

        return;
    }


    box.innerHTML=

        arr.map(c=>{

            let date=
                c.createdAt
                ?.toDate
                ?.()
                ?
                new Intl.DateTimeFormat(
                    "en-IN",
                    {
                        day:"2-digit",
                        month:"short",
                        year:"numeric"
                    }
                ).format(
                    c.createdAt.toDate()
                )
                :
                "Date pending";


            return `

            <article class="result">

                <div class="result-top">

                    <div>

                        <div class="result-name">

                            ${esc(
                                c.customerName||
                                "Unnamed"
                            )}

                        </div>

                        <div class="result-meta">

                            ${esc(
                                c.phone||""
                            )}

                            •

                            ${esc(date)}

                        </div>

                    </div>


                    <div class="bill">

                        <span>BILL</span>

                        <label class="switch">

                            <input
                                type="checkbox"
                                data-bill="${c.id}"
                                ${
                                    c.billYes
                                    ?"checked"
                                    :""
                                }
                            >

                            <span class="slider"></span>

                        </label>

                    </div>

                </div>


                <div class="result-grid">

                    ${item(
                        "Device",
                        `${c.brand||""} ${c.model||""}`
                    )}

                    ${item(
                        "IMEI",
                        c.imei||"-"
                    )}

                    ${item(
                        "Colour",
                        c.colour||"-"
                    )}

                    ${item(
                        "Storage",
                        c.storage||"-"
                    )}

                    ${item(
                        "City",
                        `${c.city||""}, ${c.state||""}`
                    )}

                    ${item(
                        "Amount",
                        `₹${Number(
                            c.phoneAmount||0
                        ).toLocaleString("en-IN")}`
                    )}

                </div>

            </article>

            `;

        })
        .join("");


    /*
     * BILL switch
     */

    box
        .querySelectorAll("[data-bill]")
        .forEach(i=>{

            i.onchange=async()=>{

                try{

                    await updateDoc(
                        doc(
                            db,
                            COL,
                            i.dataset.bill
                        ),
                        {
                            billYes:i.checked,
                            "bill.status":
                                i.checked
                                ?"YES"
                                :"NO"
                        }
                    );

                }catch(x){

                    i.checked=!i.checked;

                    console.error(x);
                }
            };
        });
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


        localStorage.setItem(
            PIN_KEY,
            b
        );


        f.reset();


        msg(
            "pinSettingsMessage",
            "PIN changed successfully ✓",
            true
        );
    };
}


/* =========================================================
   INITIALIZE
========================================================= */

function init(){

    setupPin();

    nav();

    brands();

    pincode();

    amounts();

    billDate();

    search();

    scanner();

    changePin();

    authInit();

    subscribe();

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