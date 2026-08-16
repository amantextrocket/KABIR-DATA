const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {onDocumentWrittenWithAuthContext}=require('firebase-functions/v2/firestore');
const {setGlobalOptions,defineSecret}=require('firebase-functions/params');
const admin=require('firebase-admin');
const crypto=require('crypto');
const {promisify}=require('util');
const {GoogleGenAI}=require('@google/genai');

admin.initializeApp();
setGlobalOptions({region:'asia-south1',maxInstances:10,memory:'512MiB',timeoutSeconds:60});

const db=admin.firestore();
const auth=admin.auth();
const geminiKey=defineSecret('GEMINI_API_KEY');
const scryptAsync=promisify(crypto.scrypt);

function normalizeId(value){
  return String(value||'').trim().toUpperCase();
}
function randomPassword(length=8){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let out='';
  const bytes=crypto.randomBytes(length);
  for(let i=0;i<length;i++)out+=chars[bytes[i]%chars.length];
  return out;
}
async function hashPassword(password,salt){
  const s=salt||crypto.randomBytes(16).toString('hex');
  const hash=(await scryptAsync(String(password),s,64)).toString('hex');
  return {salt:s,hash};
}
async function verifyPassword(password,salt,expected){
  const {hash}=await hashPassword(password,salt);
  const a=Buffer.from(hash,'hex'),b=Buffer.from(expected,'hex');
  return a.length===b.length && crypto.timingSafeEqual(a,b);
}
function requireAuth(request){
  if(!request.auth?.uid)throw new HttpsError('unauthenticated','Login required.');
  return request.auth;
}
function requireAdmin(request){
  const a=requireAuth(request);
  if(a.token?.role!=='admin')throw new HttpsError('permission-denied','Admin access required.');
  return a;
}
async function activeSession(uid,sessionId){
  if(!uid||!sessionId)return false;
  const s=await db.doc(`sessions/${uid}`).get();
  return s.exists && s.data()?.active===true && s.data()?.sessionId===sessionId;
}
async function requireActiveUser(request,adminOnly=false){
  const a=requireAuth(request);
  if(adminOnly && a.token?.role!=='admin')throw new HttpsError('permission-denied','Admin access required.');
  if(!await activeSession(a.uid,a.token?.sessionId))throw new HttpsError('permission-denied','Session expired or logged out.');
  return a;
}
async function ensureAdminConfig(){
  const ref=db.doc('admins/config');
  const snap=await ref.get();
  const pin='2968';
  const salt='kabir-admin-pin-2968-v2';
  const {hash}=await hashPassword(pin,salt);
  const old=snap.exists?snap.data():{};
  const data={
    salt,
    hash,
    createdAt:old.createdAt||admin.firestore.FieldValue.serverTimestamp(),
    updatedAt:admin.firestore.FieldValue.serverTimestamp()
  };
  if(!snap.exists || old.salt!==salt || old.hash!==hash){
    await ref.set(data,{merge:true});
  }
  return data;
}
async function issueToken(uid,claims){
  return auth.createCustomToken(uid,claims);
}
async function createSession(uid,userId,role){
  const sessionId=crypto.randomUUID();
  await db.doc(`sessions/${uid}`).set({sessionId,active:true,userId,role,createdAt:admin.firestore.FieldValue.serverTimestamp(),lastActiveAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
  return sessionId;
}

exports.adminLogin=onCall({enforceAppCheck:false},async request=>{
  const pin=String(request.data?.pin||'').replace(/\D/g,'');
  if(!/^\d{4}$/.test(pin)){
    throw new HttpsError('invalid-argument','Admin PIN exactly 4 digits का होना चाहिए.');
  }
  const cfg=await ensureAdminConfig();
  if(!await verifyPassword(pin,cfg.salt,cfg.hash)){
    throw new HttpsError('permission-denied','Admin PIN incorrect.');
  }
  const uid='kabir_admin';
  try{await auth.getUser(uid);}catch(_){await auth.createUser({uid,displayName:'Kabir Admin'});}
  const sessionId=await createSession(uid,'ADMIN','admin');
  const token=await issueToken(uid,{role:'admin',userId:'ADMIN',sessionId});
  return {token,userId:'ADMIN'};
});

exports.changeAdminPin=onCall(async request=>{
  await requireActiveUser(request,true);
  const pin=String(request.data?.newPin||'').replace(/\D/g,'');
  if(pin!=='2968')throw new HttpsError('invalid-argument','Admin PIN fixed है: 2968');
  await ensureAdminConfig();
  return {ok:true};
});

exports.employeeLogin=onCall(async request=>{
  const userId=normalizeId(request.data?.userId);const password=String(request.data?.password||'');
  if(!userId||!password)throw new HttpsError('invalid-argument','ID और password दोनों जरूरी हैं.');
  const index=await db.doc(`employeeIndex/${userId}`).get();
  if(!index.exists)throw new HttpsError('permission-denied','ID या password गलत है.');
  const uid=index.data().uid;
  const ref=db.doc(`employees/${uid}`);const snap=await ref.get();
  if(!snap.exists)throw new HttpsError('permission-denied','ID या password गलत है.');
  const e=snap.data();
  if(e.disabled)throw new HttpsError('permission-denied','यह ID Admin ने disable कर दी है.');
  if(!await verifyPassword(password,e.passwordSalt,e.passwordHash))throw new HttpsError('permission-denied','ID या password गलत है.');
  const old=await db.doc(`sessions/${uid}`).get();
  if(old.exists && old.data()?.active===true)throw new HttpsError('already-exists','यह ID पहले से किसी दूसरे device पर login है. Admin से Force Logout कराएँ.');
  const sessionId=await createSession(uid,e.userId,'employee');
  await ref.set({lastLoginAt:admin.firestore.FieldValue.serverTimestamp(),lastActiveAt:admin.firestore.FieldValue.serverTimestamp(),activeSession:true},{merge:true});
  const token=await issueToken(uid,{role:'employee',userId:e.userId,sessionId});
  return {token,userId:e.userId};
});

exports.logout=onCall(async request=>{
  const a=requireAuth(request);
  await db.doc(`sessions/${a.uid}`).set({active:false,lastLogoutAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
  if(a.token?.role==='employee')await db.doc(`employees/${a.uid}`).set({activeSession:false,lastActiveAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
  return {ok:true};
});

exports.createEmployee=onCall(async request=>{
  await requireActiveUser(request,true);
  let userId=normalizeId(request.data?.userId);
  const name=String(request.data?.name||'Website User').trim().slice(0,80)||'Website User';
  let password=String(request.data?.password||'').trim();
  if(userId && !/^[A-Z0-9_-]{4,32}$/.test(userId))throw new HttpsError('invalid-argument','Invalid User ID.');
  if(!userId){
    do{userId='USER'+Math.floor(100000+Math.random()*900000);}while((await db.doc(`employeeIndex/${userId}`).get()).exists);
  }
  if(!password)password=randomPassword(8);
  if(password.length<4||password.length>64)throw new HttpsError('invalid-argument','Password 4-64 characters का होना चाहिए.');
  if((await db.doc(`employeeIndex/${userId}`).get()).exists)throw new HttpsError('already-exists','यह User ID पहले से मौजूद है.');
  const uid=`emp_${crypto.randomUUID().replaceAll('-','')}`;
  const {salt,hash}=await hashPassword(password,'');
  await auth.createUser({uid,displayName:userId});
  const batch=db.batch();
  batch.set(db.doc(`employees/${uid}`),{uid,userId,name,passwordSalt:salt,passwordHash:hash,disabled:false,activeSession:false,createdAt:admin.firestore.FieldValue.serverTimestamp(),createdBy:'ADMIN'});
  batch.set(db.doc(`employeeIndex/${userId}`),{uid,userId});
  await batch.commit();
  return {uid,userId,password};
});

exports.disableEmployee=onCall(async request=>{await requireActiveUser(request,true);const uid=String(request.data?.uid||'');if(!uid)throw new HttpsError('invalid-argument','User required.');await db.doc(`employees/${uid}`).set({disabled:true},{merge:true});await db.doc(`sessions/${uid}`).set({active:false,lastForcedLogoutAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});return {ok:true};});
exports.enableEmployee=onCall(async request=>{await requireActiveUser(request,true);const uid=String(request.data?.uid||'');await db.doc(`employees/${uid}`).set({disabled:false},{merge:true});return {ok:true};});
exports.forceLogoutEmployee=onCall(async request=>{await requireActiveUser(request,true);const uid=String(request.data?.uid||'');await db.doc(`sessions/${uid}`).set({active:false,lastForcedLogoutAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});await db.doc(`employees/${uid}`).set({activeSession:false},{merge:true});try{await auth.revokeRefreshTokens(uid);}catch(_){}return {ok:true};});
exports.deleteEmployee=onCall(async request=>{await requireActiveUser(request,true);const uid=String(request.data?.uid||'');if(!uid||uid==='kabir_admin')throw new HttpsError('invalid-argument','Invalid user.');const e=await db.doc(`employees/${uid}`).get();const id=e.data()?.userId;if(id)await db.doc(`employeeIndex/${id}`).delete().catch(()=>{});await db.doc(`employees/${uid}`).delete();await db.doc(`sessions/${uid}`).delete().catch(()=>{});try{await auth.deleteUser(uid);}catch(_){}return {ok:true};});

function compactCustomer(d){return {code:d.customerCode||'',name:d.customerName||'',phone:d.phone||'',city:d.city||'',state:d.state||'',brand:d.brand||'',model:d.model||'',imei:d.imei||'',colour:d.colour||'',storage:d.storage||'',finance:d.financeCompany||'',amount:d.phoneAmount||0,downPayment:d.downPayment||0,emi:d.emiAmount||0,emiMonths:d.emiMonths||0,lock:d.lockName||'',stock:d.stock||'',counter:d.counter||'',financer:d.financerName||'',createdBy:d.createdByUserId||'',createdAt:d.createdAt?.toDate?.()?.toISOString?.()||''};}
function compactRepair(d){return {name:d.customerName||'',phone:d.phone||'',device:d.device||'',problem:d.problem||'',repairBy:d.repairBy||'',payment:d.payment||0,createdBy:d.createdByUserId||'',createdAt:d.createdAt?.toDate?.()?.toISOString?.()||''};}

exports.askKabirAI=onCall({secrets:[geminiKey],timeoutSeconds:60},async request=>{
  const a=await requireActiveUser(request,false);
  const adminMode=!!request.data?.admin;
  if(adminMode && a.token?.role!=='admin')throw new HttpsError('permission-denied','Admin AI only.');
  const question=String(request.data?.question||'').trim();
  if(!question)throw new HttpsError('invalid-argument','Question required.');
  const [customersSnap,repairingSnap,logsSnap]=await Promise.all([
    db.collection('customers').limit(600).get(),
    db.collection('repairing').limit(600).get(),
    adminMode?db.collection('auditLogs').limit(1000).get():Promise.resolve(null)
  ]);
  const customers=customersSnap.docs.map(d=>compactCustomer(d.data()));
  const repairing=repairingSnap.docs.map(d=>compactRepair(d.data()));
  const logs=logsSnap?logsSnap.docs.map(d=>{const x=d.data();return {userId:x.userId||'',action:x.action||'',collection:x.collection||'',documentId:x.documentId||'',summary:x.summary||'',timestamp:x.timestamp?.toDate?.()?.toISOString?.()||''};}):[];
  const counts={mobileCustomers:customers.length,mobileDevices:customers.reduce((n,x)=>n+1,0),repairingRecords:repairing.length,uniqueRepairCustomers:new Set(repairing.map(x=>x.phone||x.name).filter(Boolean)).size};
  const context={currentTime:new Date().toISOString(),counts,customers,repairing};if(adminMode)context.auditLogs=logs;
  const ai=new GoogleGenAI({apiKey:geminiKey.value()});
  const system=`तुम Kabir Mobile Data के लिए private shop AI assistant हो। हमेशा user की भाषा पहचानो और जवाब मुख्यतः सरल Hindi/local Hinglish में दो, जरूरत हो तो English terms रखो। केवल दिए गए database context के आधार पर factual answers दो। कोई data अनुमान से मत बनाओ। अगर exact record नहीं मिलता तो साफ बताओ। Sensitive fields जैसे Aadhaar/PAN/photo के बारे में database में actual file content उपलब्ध नहीं है, ऐसा हो तो यही बताओ। Admin mode में user activity logs को प्राथमिकता दो और ID के साथ काम बताओ। सवाल का सीधा, उपयोगी और छोटा जवाब दो।`;
  const prompt=`${system}\n\nMODE: ${adminMode?'ADMIN':'WEBSITE USER'}\nQUESTION: ${question}\n\nDATABASE CONTEXT JSON:\n${JSON.stringify(context)}`;
  try{
    const response=await ai.models.generateContent({model:'gemini-3.6-flash',contents:prompt});
    return {answer:response.text||'मुझे इसका जवाब नहीं मिला.'};
  }catch(err){console.error('Gemini error',err);throw new HttpsError('internal','AI service में अभी समस्या है. Gemini API key, billing और Functions deployment check करें.');}
});

async function auditWrite(event,collectionName){
  const before=event.data?.before?.data?.()||null;const after=event.data?.after?.data?.()||null;
  if(!before && !after)return;
  const action=!before?'CREATE':!after?'DELETE':'UPDATE';
  const actorUid=event.authId||after?.updatedByUid||after?.createdBy||before?.updatedByUid||before?.createdBy||'';
  let userId=after?.createdByUserId||after?.updatedByUserId||before?.createdByUserId||before?.updatedByUserId||'';
  if(actorUid && !userId){const e=await db.doc(`employees/${actorUid}`).get();userId=e.data()?.userId||'';}
  if(!userId && actorUid==='kabir_admin')userId='ADMIN';
  const d=after||before||{};
  const summary=collectionName==='customers'?`${action}: ${d.customerCode||''} ${d.customerName||''} • ${d.brand||''} ${d.model||''}`:`${action}: ${d.customerName||''} • ${d.device||''} • ${d.problem||''}`;
  await db.collection('auditLogs').add({uid:actorUid||null,userId:userId||'Unknown',role:event.authType||'',action,collection:collectionName,documentId:event.params?.customerId||event.params?.repairId||'',summary,timestamp:admin.firestore.FieldValue.serverTimestamp()});
}
exports.auditCustomers=onDocumentWrittenWithAuthContext('customers/{customerId}',event=>auditWrite(event,'customers'));
exports.auditRepairing=onDocumentWrittenWithAuthContext('repairing/{repairId}',event=>auditWrite(event,'repairing'));
