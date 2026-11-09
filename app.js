/* Presseur Backstage — appli du bureau. Les données vivent dans le Google Sheet de Presseur (voir config.js). */
const MEMBRES=["Romain","Tanguy","Nolan","Marvin","Iannis","Étienne","Yoann","Tonio"];
const EVENT=new Date("2027-05-15T14:00:00+02:00");
const PLAFOND=9000;
const COLS=["taches","depenses","problemes","posts","reunions","materiel","artistes","annuaire","echeances","postes","admin"];
const LOGO="logo.png";

let S={code:null,user:null,tab:"accueil",view:null,filter:"tous",docPath:[],calMonth:null,data:null,tree:null,loading:false,meteo:null};
const store={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{v==null?localStorage.removeItem(k):localStorage.setItem(k,v)}catch(e){}}};
S.code=store.get("pb-code");S.user=store.get("pb-user");
try{S.data=JSON.parse(store.get("pb-cache")||"null")}catch(e){}
(()=>{const t=new Date();S.calMonth=`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}`})();

const D=()=>S.data||{};
const L=c=>(D()[c]||[]);
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const eur=n=>Number(n||0).toLocaleString("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:Number(n)%1?2:0});
const dfmt=s=>s?new Date(s+"T12:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"}):"";
const dshort=s=>s?new Date(s+"T12:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"short"}):"";
const ini=n=>String(n||"?").slice(0,2);
const avColor=n=>["#f5c518","#9fd3f2","#a8dcae","#f7c69a","#cdbdf0","#9fe0da","#f3b3cc","#d9dde1"][Math.max(0,MEMBRES.indexOf(n))%8];
const avs=list=>`<span class="avs">${(list||[]).map(n=>`<span class="av" style="background:${avColor(n)}" title="${esc(n)}">${esc(ini(n))}</span>`).join("")}</span>`;
const ST={afaire:"À faire",encours:"En cours",fait:"Réalisé"};
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const nowHM=()=>new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
const today=()=>{const t=new Date();return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`};

/* ---------- Échanges avec Google ---------- */
async function api(action,payload={},code=S.code){
 if(!window.API_URL||API_URL.includes("COLLE"))throw new Error("L'adresse du script Google n'est pas encore renseignée dans config.js.");
 const r=await fetch(API_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action,code,user:S.user,...payload})});
 const j=await r.json();
 if(!j.ok){if(j.error==="code"&&code===S.code){S.code=null;store.set("pb-code",null);render();toast("Le code a changé, entre le nouveau.")}throw new Error(j.error==="code"?"Code incorrect.":j.error)}
 return j;
}
function cache(){store.set("pb-cache",JSON.stringify(S.data))}
async function refresh(silent){
 if(!S.code)return;
 try{const j=await api("all");S.data=j.data;cache();if(!document.querySelector(".bsheet"))render()}
 catch(e){if(!silent)toast("Pas de connexion : "+e.message)}
}
async function save(col,item,log){
 const arr=D()[col]||(D()[col]=[]);const i=arr.findIndex(x=>x.id===item.id);
 if(i>=0)arr[i]=item;else arr.push(item);cache();render();
 try{await api("save",{col,item,log})}catch(e){toast("Pas enregistré : "+e.message)}
}
async function del(col,id,log){
 D()[col]=L(col).filter(x=>x.id!==id);cache();render();
 try{await api("delete",{col,id,log})}catch(e){toast("Pas supprimé : "+e.message)}
}
function readFile(file){
 return new Promise((res,rej)=>{
  const done=(dataUrl,mime,name)=>res({b64:dataUrl.split(",")[1],mime,name});
  if(/^image\//.test(file.type)&&file.size>700000){
   const img=new Image();const u=URL.createObjectURL(file);
   img.onload=()=>{const k=Math.min(1,1600/Math.max(img.width,img.height));const c=document.createElement("canvas");c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);c.getContext("2d").drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(u);done(c.toDataURL("image/jpeg",.82),"image/jpeg",file.name.replace(/\.\w+$/,"")+".jpg")};
   img.onerror=()=>{const fr=new FileReader();fr.onload=()=>done(fr.result,file.type,file.name);fr.onerror=rej;fr.readAsDataURL(file)};img.src=u;
  }else{const fr=new FileReader();fr.onload=()=>done(fr.result,file.type||"application/octet-stream",file.name);fr.onerror=rej;fr.readAsDataURL(file)}
 });
}
async function upload(file,path){
 toast("Envoi du fichier…",60000);
 const f=await readFile(file);const j=await api("upload",{path,...f});S.tree=null;toast("Fichier rangé dans Drive › "+path.join(" › "));return j.file;
}
async function createDoc(kind,name,path){
 const w=window.open("","_blank");
 toast(`Création du ${kind==="sheet"?"Sheet":"Doc"}…`,60000);
 try{const j=await api("create",{kind,name,path});if(w)w.location.href=j.file.url;S.tree=null;toast(w?"Ouvert dans un nouvel onglet":"Créé : touche-le pour l'ouvrir");return j.file}
 catch(e){if(w)w.close();throw e}
}

const I={
 home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
 check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 12l3 3 5-6"/></svg>',
 euro:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6.5A7 7 0 1 0 18 17.5"/><path d="M4 10h10M4 14h10"/></svg>',
 folder:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/></svg>',
 menu:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
 chev:'<svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>',
 mic:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></svg>',
 cam:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
 users:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2 20c.8-3.5 3.5-5 7-5s6.2 1.5 7 5"/><circle cx="17" cy="7" r="2.5"/><path d="M17 13c2.6 0 4.4 1.3 5 4"/></svg>',
 book:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z"/><path d="M5 18a2 2 0 0 1 2-2h11"/></svg>',
 box:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/></svg>',
 bolt:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>',
 note:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
 star:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>',
 alert:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/></svg>',
 clip:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 11l-8 8a5 5 0 0 1-7-7l8-8a3.5 3.5 0 0 1 5 5l-8 8a2 2 0 0 1-3-3l7-7"/></svg>',
 sun:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/></svg>',
 lock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
 sync:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3"/><path d="M18 3v4h-4M6 21v-4h4"/></svg>'
};
const fileIcon=k=>`<span class="ft ${k}">${{doc:"DOC",sheet:"XLS",pdf:"PDF",img:"IMG",dir:""}[k]??"FIC"}</span>`;
const fileLink=f=>f.url?`<a class="file" href="${esc(f.url)}" target="_blank" rel="noopener">${fileIcon(f.k)}<span>${esc(f.n)}</span></a>`:`<div class="file">${fileIcon(f.k)}<span>${esc(f.n)}</span></div>`;

/* ---------- Connexion ---------- */
function renderLock(){
 const root=$("#root");
 if(!S.code){
  root.innerHTML=`<div class="lock pad"><img src="${LOGO}" alt="Logo Presseur de Citrons"><h1>Presseur Backstage</h1><p>L'appli du bureau pour l'Open Air du 15 mai.</p>
  <form class="code" id="codeform" autocomplete="off">${[0,1,2,3].map(i=>`<input id="c${i}" inputmode="numeric" maxlength="1" aria-label="Chiffre ${i+1}">`).join("")}</form>
  <div class="err" id="err"></div><p class="hint">Entre le code de l'asso</p></div>`;
  const ins=[...root.querySelectorAll(".code input")];ins[0].focus();
  ins.forEach((inp,i)=>{
   inp.addEventListener("input",async()=>{inp.value=inp.value.replace(/\D/g,"");if(inp.value&&i<3)ins[i+1].focus();const v=ins.map(x=>x.value).join("");
    if(v.length===4){$("#err").textContent="Vérification…";$("#err").style.color="var(--ink)";
     try{const j=await api("all",{},v);S.code=v;store.set("pb-code",v);S.data=j.data;cache();render()}
     catch(e){$("#err").style.color="";$("#err").textContent=e.message==="Code incorrect."?"Code incorrect, réessaie.":e.message;ins.forEach(x=>x.value="");ins[0].focus()}}});
   inp.addEventListener("keydown",e=>{if(e.key==="Backspace"&&!inp.value&&i>0)ins[i-1].focus()});
  });
  return true;
 }
 if(!S.user){
  root.innerHTML=`<div class="lock pad"><img src="${LOGO}" alt=""><h1>Qui es-tu ?</h1><p>Touche ton prénom. Ça sert à savoir qui commente, qui paie et à qui sont les tâches.</p>
  <div class="who">${MEMBRES.map(m=>`<button data-act="pick" data-v="${esc(m)}">${esc(m)}</button>`).join("")}</div></div>`;
  return true;
 }
 if(!S.data){root.innerHTML=`<div class="lock pad"><img src="${LOGO}" alt=""><h1>Chargement…</h1></div>`;refresh();return true}
 return false;
}

/* ---------- Shell ---------- */
const TABS=[["accueil","Accueil",I.home],["taches","Tâches",I.check],["budget","Budget",I.euro],["docs","Docs",I.folder]];
const VIEWS={artistes:["Artistes",I.mic],com:["Calendrier Instagram",I.cam],reunions:["Réunions",I.note],benevoles:["Bénévoles",I.users],annuaire:["Annuaire",I.book],materiel:["Matériel",I.box],jourj:["Jour J",I.bolt],meteo:["Météo",I.sun],bilan:["Bilan",I.star]};
let timer=null;
function render(){
 clearInterval(timer);
 if(renderLock())return;
 const title=S.view?VIEWS[S.view.split(":")[0]][0]:TABS.find(t=>t[0]===S.tab)[1];
 $("#root").innerHTML=`
 <header class="top pad">
  ${S.view?`<button class="iconbtn" data-act="back" aria-label="Retour"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M15 6l-6 6 6 6"/></svg></button>`:`<img src="${LOGO}" alt="">`}
  <div class="t"><b>${esc(title)}</b><span>Open Air · 15 mai 2027</span></div>
  <button class="iconbtn" data-act="refresh" aria-label="Actualiser">${I.sync}</button>
  <button class="iconbtn" data-act="drawer" aria-label="Ouvrir le menu">${I.menu}</button>
 </header>
 <main class="pad" id="main">${S.view?viewHTML():tabHTML()}</main>
 ${fabHTML()}
 <nav class="bottom" aria-label="Navigation"><div class="in">${TABS.map(([k,l,ic])=>`<button data-act="tab" data-v="${k}" ${!S.view&&S.tab===k?'aria-current="page"':""}><span class="ic">${ic}</span>${l}</button>`).join("")}</div></nav>`;
 if((!S.view&&S.tab==="accueil")||S.view==="jourj"){tick();timer=setInterval(tick,1000)}
}
function fabHTML(){
 const fab=(act,l)=>`<button class="fab" data-act="${act}">${l}</button>`;
 if(S.view==="materiel")return fab("newMat","+ Matériel");
 if(S.view==="com")return fab("newPost","+ Publication");
 if(S.view==="reunions")return fab("newMeet","+ Réunion");
 if(S.view==="annuaire")return fab("newContact","+ Contact");
 if(S.view)return "";
 if(S.tab==="taches")return fab("newTask","+ Nouvelle tâche");
 if(S.tab==="budget")return fab("newExp","+ Dépense");
 if(S.tab==="docs")return `<label class="fab" for="docup">+ Fichier<input type="file" id="docup" hidden data-up="docs"></label>`;
 return "";
}
function tabHTML(){return {accueil,taches,budget,docs}[S.tab]()}
function viewHTML(){const [v,arg]=S.view.split(":");return {artistes,com,reunions,benevoles,annuaire,materiel,jourj,meteo,bilan}[v](arg)}

/* ---------- Compte à rebours ---------- */
function tick(){
 const el=$("#cd");if(!el)return;
 let ms=Math.max(0,EVENT-new Date());
 const d=Math.floor(ms/864e5);ms-=d*864e5;const h=Math.floor(ms/36e5);ms-=h*36e5;const m=Math.floor(ms/6e4);ms-=m*6e4;const s=Math.floor(ms/1e3);
 const p=n=>String(n).padStart(2,"0");
 el.innerHTML=[[d,"jours"],[p(h),"heures"],[p(m),"min"],[p(s),"sec"]].map(([v,l])=>`<div><b>${v}</b><span>${l}</span></div>`).join("");
}
const countHTML=()=>`<section class="count" aria-label="Compte à rebours"><div class="lbl">Avant l'ouverture</div><div class="ev">Open Air Presseur de Citrons</div><div class="digits" id="cd"></div><div class="where">Samedi 15 mai 2027 · 14 h – 22 h · Parc du Chêne Joli, Noyal-sur-Vilaine</div></section>`;

/* ---------- Accueil ---------- */
function accueil(){
 const mine=L("taches").filter(t=>(t.who||[]).includes(S.user)&&t.st!=="fait").sort((a,b)=>(a.due||"").localeCompare(b.due||""));
 const pay=L("depenses").filter(e=>e.st==="aregler");
 const ech=L("echeances").filter(e=>e.st==="aregler"&&e.quand!=="À définir");
 const open=L("problemes").filter(p=>!p.ok);
 return `<div><div class="small muted">Salut</div><div style="font-family:var(--display);font-size:22px;font-weight:800">${esc(S.user)} 🍋</div></div>
 ${countHTML()}
 ${open.length?`<section class="list"><h2 class="sec">Problèmes en cours <button data-act="go" data-v="jourj">Voir</button></h2>${open.map(probRow).join("")}</section>`:""}
 <section class="list"><h2 class="sec">Tes tâches <button data-act="tab" data-v="taches">Tout voir</button></h2>
 ${mine.length?mine.slice(0,4).map(taskRow).join(""):`<div class="card muted">Rien à faire pour toi pour l'instant.</div>`}</section>
 <section class="list"><h2 class="sec">À régler <button data-act="tab" data-v="budget">Budget</button></h2>
 ${pay.length||ech.length?ech.map(echRow).join("")+pay.map(expRow).join(""):`<div class="card muted">Tout est réglé.</div>`}</section>
 <button class="row" data-act="go" data-v="meteo"><span style="width:26px;color:var(--orange)">${I.sun}</span><span class="grow"><span class="ttl">Météo du 15 mai</span><span class="sub">S'affiche automatiquement à partir du 8 mai 2027 (J-7)</span></span>${I.chev}</button>
 <button class="bigprob" data-act="newProb">${I.alert}<span><b>Signaler un problème</b><span class="small">Tout le bureau est prévenu par mail</span></span></button>`;
}

/* ---------- Tâches ---------- */
function taskRow(t){
 const late=t.st!=="fait"&&t.due&&new Date(t.due+"T23:59:00")<new Date();
 return `<button class="row" data-act="task" data-v="${esc(t.id)}"><span class="grow"><span class="ttl">${esc(t.t)}</span>
 <span class="sub" style="display:flex;gap:8px;align-items:center;margin-top:6px;flex-wrap:wrap"><span class="pill p-${t.st}">${ST[t.st]}</span>${t.due?`<span ${late?'style="color:var(--red);font-weight:700"':""}>${late?"En retard · ":"Pour le "}${dshort(t.due)}</span>`:""}${(t.files||[]).length?`<span>📎 ${t.files.length}</span>`:""}${(t.com||[]).length?`<span>💬 ${t.com.length}</span>`:""}</span></span>${avs(t.who)}</button>`;
}
function taches(){
 const F=[["tous","Toutes"],["moi","À moi"],["afaire","À faire"],["encours","En cours"],["fait","Réalisé"]];
 let l=L("taches").slice();
 if(S.filter==="moi")l=l.filter(t=>(t.who||[]).includes(S.user));else if(S.filter!=="tous")l=l.filter(t=>t.st===S.filter);
 l.sort((a,b)=>(a.st==="fait")-(b.st==="fait")||(a.due||"").localeCompare(b.due||""));
 return `<div class="chips" role="group" aria-label="Filtrer">${F.map(([k,lb])=>`<button class="chip" data-act="filter" data-v="${k}" aria-pressed="${S.filter===k}">${lb}</button>`).join("")}</div>
 <div class="list">${l.length?l.map(taskRow).join(""):`<div class="card empty">${I.check}<b>Aucune tâche ici</b><span class="small muted">Touche « + Nouvelle tâche » pour en créer une.</span></div>`}</div>
 `;
}
function taskSheet(id){
 const t=L("taches").find(x=>x.id===id);if(!t)return;
 openSheet(`<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px"><h3>${esc(t.t)}</h3><button class="copy" data-act="editTask" data-v="${esc(t.id)}" style="flex:none">✏️ Modifier</button></div>
 <div class="seg" role="group" aria-label="Statut">${Object.entries(ST).map(([k,l])=>`<button data-act="setSt" data-id="${esc(t.id)}" data-v="${k}" aria-pressed="${t.st===k}">${l}</button>`).join("")}</div>
 <dl class="kv">${t.due?`<dt>Pour le</dt><dd>${dfmt(t.due)}</dd>`:""}<dt>Qui</dt><dd>${(t.who||[]).map(esc).join(", ")}</dd>${t.desc?`<dt>Détails</dt><dd style="font-weight:500">${esc(t.desc)}</dd>`:""}</dl>
 <div class="list"><b class="small">Fichiers</b>${(t.files||[]).length?t.files.map(fileLink).join(""):`<span class="small muted">Aucun fichier.</span>`}
 <div class="attach">${attachBtns("task:"+t.id)}</div></div>
 <div class="list"><b class="small">Commentaires</b>${(t.com||[]).map(c=>`<div class="comment"><span class="av" style="background:${avColor(c.a)}">${esc(ini(c.a))}</span><div class="bub"><b>${esc(c.a)} · ${esc(c.d)}</b><br>${esc(c.x)}</div></div>`).join("")||`<span class="small muted">Pas encore de commentaire.</span>`}
 <form class="addc" data-form="comment" data-id="${esc(t.id)}"><input id="cmt" placeholder="Écrire un commentaire" aria-label="Commentaire"><button>Envoyer</button></form></div>
 <button class="btn ghost" data-act="delTask" data-id="${esc(t.id)}">Supprimer la tâche</button>`);
}
function attachBtns(target){
 const id="up-"+target.replace(/[^a-z0-9]/gi,"-");
 return `<label for="${id}">${I.clip}Joindre un fichier<input type="file" id="${id}" data-up="${esc(target)}"></label>
 <button type="button" data-act="mkdoc" data-k="doc" data-t="${esc(target)}"><span class="ft doc">DOC</span>Créer un Doc</button>
 <button type="button" data-act="mkdoc" data-k="sheet" data-t="${esc(target)}"><span class="ft sheet">XLS</span>Créer un Sheet</button>`;
}
let draft=null;
function newTaskSheet(id){
 const t=id?L("taches").find(x=>x.id===id):null;
 const d=new Date();d.setDate(d.getDate()+14);
 draft={id:id||null,who:t?[...(t.who||[])]:[S.user],files:t?[...(t.files||[])]:[]};
 openSheet(`<h3>${t?"Modifier la tâche":"Nouvelle tâche"}</h3><form id="taskform" class="list" style="gap:14px">
 <label class="f">Titre<input id="tt" required value="${esc(t?t.t:"")}" placeholder="Ex. Réserver les barrières"></label>
 <div class="f"><b class="small">Qui s'en occupe ?</b><div class="chips" style="flex-wrap:wrap">${MEMBRES.map(m=>`<button type="button" class="chip" data-act="toggleWho" data-v="${esc(m)}" aria-pressed="${draft.who.includes(m)}">${esc(m)}</button>`).join("")}</div></div>
 <label class="f">Pour le<input type="date" id="td" required value="${esc(t?t.due:d.toISOString().slice(0,10))}"></label>
 <label class="f">Détails (facultatif)<textarea id="tx">${esc(t?t.desc:"")}</textarea></label>
 ${t?"":`<div class="list"><b class="small">Fichier</b><div id="draftfiles" class="list"></div><div class="attach">${attachBtns("draft")}</div></div>`}
 <button class="btn lemon" type="submit">${t?"Enregistrer":"Créer la tâche"}</button>
 ${t?`<button class="btn ghost" type="button" data-act="task" data-v="${esc(t.id)}">Annuler</button>`:""}</form>`);
}
function drawDraftFiles(){const el=$("#draftfiles");if(el)el.innerHTML=draft.files.map(fileLink).join("")}

/* ---------- Budget ---------- */
const postes=()=>L("postes").slice().sort((a,b)=>(a.o||0)-(b.o||0));
const spentBy=p=>L("depenses").filter(e=>e.p===p).reduce((s,e)=>s+Number(e.m||0),0);
function donut(){
 const R=80,C=2*Math.PI*R,cx=110,cy=110;
 const tot=L("depenses").reduce((s,e)=>s+Number(e.m||0),0);const over=tot>PLAFOND;
 let a=0,arcs=`<circle r="${R}" cx="${cx}" cy="${cy}" fill="none" stroke="#e6e9e3" stroke-width="24"/>`;
 if(over)arcs+=`<circle r="${R}" cx="${cx}" cy="${cy}" fill="none" stroke="#d4433b" stroke-width="24"/>`;
 else postes().forEach(p=>{const real=spentBy(p.id);if(real<=0)return;const len=real/PLAFOND*C;
  arcs+=`<circle r="${R}" cx="${cx}" cy="${cy}" fill="none" stroke="${p.c}" stroke-width="24" stroke-dasharray="${Math.max(len-1.5,.5)} ${C}" stroke-dashoffset="${-a}"/>`;a+=len});
 const pct=Math.round(tot/PLAFOND*100);
 return `<svg class="donut" viewBox="0 0 220 220" role="img" aria-label="${eur(tot)} dépensés sur ${eur(PLAFOND)}"><g transform="rotate(-90 110 110)">${arcs}</g>
 <text x="110" y="100" text-anchor="middle" font-family="Unbounded,Arial Black" font-size="24" font-weight="800" style="fill:${over?"#d4433b":"#17181a"}">${eur(Math.round(tot))}</text>
 <text x="110" y="121" text-anchor="middle" font-family="Manrope" font-size="12" font-weight="700" style="fill:#5d645e">dépensés sur ${eur(PLAFOND)}</text>
 <text x="110" y="143" text-anchor="middle" font-family="Manrope" font-size="12.5" font-weight="800" style="fill:${over?"#d4433b":"#3d9a4a"}">${over?"Plafond dépassé de "+eur(tot-PLAFOND):pct+" % utilisé"}</text></svg>`;
}
function posteRow(p){
 const real=spentBy(p.id);const r=p.prevu?real/p.prevu:(real>0?2:0);
 const st=real>p.prevu?`<span class="pill p-over">Dépassé +${eur(real-p.prevu)}</span>`:r>=.9?`<span class="pill p-warn">${Math.round(r*100)} %</span>`:`<span class="pill p-ok">${Math.round(r*100)} %</span>`;
 return `<button class="poste" data-act="editPoste" data-v="${esc(p.id)}" style="text-align:left;width:100%"><div class="l1"><span class="dot" style="background:${p.c}"></span><span class="nm">${esc(p.nm)}</span>${st}</div>
 <div class="bar"><i style="width:${Math.min(r,1)*100}%;background:${real>p.prevu?"#d4433b":p.c}"></i></div>
 <div class="l2 num"><span>Réel ${eur(real)}</span><span>Prévu ${eur(p.prevu)} ✏️</span></div></button>`;
}
function expRow(e){
 const p=postes().find(x=>x.id===e.p)||{c:"#5c6670",nm:"Sans poste"};
 return `<button class="row" data-act="exp" data-v="${esc(e.id)}"><span class="dot" style="width:10px;height:36px;border-radius:5px;background:${p.c};flex:none"></span><span class="grow"><span class="ttl">${esc(e.l)}</span><span class="sub">${esc(p.nm)} · ${e.url?"📎 justificatif":"sans justificatif"}${e.par?" · "+esc(e.par):""}</span><span class="sub" style="color:var(--blue);font-weight:700">✏️ Modifier</span></span>
 <span style="text-align:right"><b class="num">${eur(e.m)}</b><br><span class="pill p-${e.st}">${e.st==="regle"?"Réglé":"À régler"}</span></span></button>`;
}
function echRow(e){
 return `<button class="row" data-act="ech" data-v="${esc(e.id)}"><span class="grow"><span class="ttl">${esc(e.art)} · ${esc(e.l)}</span><span class="sub num">${eur(e.m)} · ${esc(e.quand)}</span></span><span class="pill p-${e.st}">${e.st==="regle"?"Réglé":"À régler"}</span></button>`;
}
function budget(){
 const prevu=postes().reduce((s,p)=>s+Number(p.prevu||0),0);const tot=L("depenses").reduce((s,e)=>s+Number(e.m||0),0);
 const aregler=L("depenses").filter(e=>e.st==="aregler").reduce((s,e)=>s+Number(e.m||0),0);
 const used=postes().filter(p=>spentBy(p.id)>0);
 return `<section class="card donutwrap">${donut()}
 <div class="legend">${used.map(p=>`<span><i style="background:${p.c}"></i>${esc(p.nm.split(" ")[0].replace(",",""))} ${eur(spentBy(p.id))}</span>`).join("")}<span><i style="background:#e6e9e3"></i>Reste</span></div>
 <div class="kpis"><div><b>${eur(prevu)}</b><span>Prévu</span></div><div><b>${eur(PLAFOND-tot)}</b><span>Reste</span></div><div><b style="color:var(--orange)">${eur(aregler)}</b><span>À régler</span></div></div>
 <p class="small muted" style="margin:0;text-align:center">Le cercle se remplit au fil des dépenses, chaque couleur est un poste. Le gris, c'est ce qui reste. Si on dépasse les 9 000 €, il passe en rouge.</p></section>
 <section class="card list" style="gap:16px"><h2 class="sec">Par poste <span class="small muted" style="text-transform:none;letter-spacing:0;font-family:var(--body)">touche pour changer le prévu</span></h2>${postes().map(posteRow).join("")}</section>
 <section class="card list" style="gap:8px"><h2 class="sec">Échéancier artistes</h2>${L("echeances").slice().sort((a,b)=>(a.o||0)-(b.o||0)).map(echRow).join("")}<span class="small muted">Touche une échéance pour la passer en Réglé.</span></section>
 <section class="list"><h2 class="sec">Dépenses</h2>${L("depenses").length?L("depenses").slice().reverse().map(expRow).join(""):`<div class="card muted">Aucune dépense pour l'instant. Touche « + Dépense ».</div>`}</section>`;
}
function newExpSheet(id){
 const e=id?L("depenses").find(x=>x.id===id):{l:"",m:"",p:"artistes",st:"aregler"};
 draft={st:e.st,url:e.url||"",fname:e.fname||"",id:id||null,file:null};
 openSheet(`<h3>${id?"Modifier la dépense":"Nouvelle dépense"}</h3><form id="expform" class="list" style="gap:14px">
 <label class="f">Quoi ?<input id="el" required value="${esc(e.l)}" placeholder="Ex. Location barnum"></label>
 <label class="f">Montant (€)<input id="em" required inputmode="decimal" value="${esc(String(e.m).replace(".",","))}" placeholder="0,00"></label>
 <label class="f">Poste<select id="ep">${postes().map(p=>`<option value="${esc(p.id)}" ${p.id===e.p?"selected":""}>${esc(p.nm)}</option>`).join("")}</select></label>
 <div class="seg two" role="group" aria-label="Statut">${[["aregler","À régler"],["regle","Réglé"]].map(([k,l])=>`<button type="button" data-act="expSt" data-v="${k}" aria-pressed="${draft.st===k}">${l}</button>`).join("")}</div>
 <div class="list"><b class="small">Facture ou ticket</b><div id="jst" class="small muted">${draft.url?`<a href="${esc(draft.url)}" target="_blank" rel="noopener">📎 ${esc(draft.fname||"Voir le justificatif")}</a>`:"Pas de justificatif ? Pas de souci, le montant suffit."}</div>
 <div class="attach" style="grid-template-columns:1fr 1fr"><label for="up-exp">${I.clip}Joindre la facture<input type="file" id="up-exp" accept="image/*,application/pdf" data-up="exp"></label><label for="up-photo">${I.cam}Photo du ticket<input type="file" id="up-photo" accept="image/*" capture="environment" data-up="exp"></label></div></div>
 <button class="btn lemon" type="submit">${id?"Enregistrer":"Ajouter la dépense"}</button>
 ${id?`<button class="btn ghost" type="button" data-act="delExp" data-id="${esc(id)}">Supprimer</button>`:""}</form>`);
}

/* ---------- Docs ---------- */
function docs(){
 if(!S.tree){api("tree").then(j=>{S.tree=j.tree;if(S.tab==="docs"&&!S.view)render()}).catch(e=>toast("Drive indisponible : "+e.message));
  return `<div class="card empty">${I.folder}<b>Ouverture du Drive…</b></div>`+adminHTML()}
 let node=S.tree;const crumbs=[{n:"Open Air 15/05/2027",i:0}];
 S.docPath.forEach((i,k)=>{node=node.c[i];crumbs.push({n:node.n,i:k+1})});
 return `<div class="sync"><i></i>Drive de Presseur · <a href="${esc(node.url)}" target="_blank" rel="noopener">ouvrir dans Drive</a></div>
 <nav class="crumb" aria-label="Chemin">${crumbs.map((c,i)=>i<crumbs.length-1?`<button data-act="crumb" data-v="${c.i}">${esc(c.n)}</button><span class="muted">›</span>`:`<span>${esc(c.n)}</span>`).join("")}</nav>
 <div class="list">${node.c.length?node.c.map((f,i)=>f.c?`<button class="row" data-act="dir" data-v="${i}"><span class="ft dir">${I.folder.replace("<svg",'<svg width="18" height="18"')}</span><span class="grow"><span class="ttl">${esc(f.n)}</span><span class="sub">${f.c.length} élément${f.c.length>1?"s":""}</span></span>${I.chev}</button>`:`<a class="row" href="${esc(f.url)}" target="_blank" rel="noopener" style="text-decoration:none">${fileIcon(f.k)}<span class="grow"><span class="ttl">${esc(f.n)}</span><span class="sub">Ouvrir dans Google</span></span>${I.chev}</a>`).join(""):`<div class="card muted">Dossier vide.</div>`}</div>
 ${S.docPath.length===0?adminHTML():""}`;
}
function adminHTML(){
 return `<section class="card list" style="gap:10px"><h2 class="sec">Dossier administratif</h2>${L("admin").map(a=>`<button data-act="admin" data-v="${esc(a.id)}" style="display:flex;justify-content:space-between;gap:10px;align-items:center;text-align:left;padding:4px 0"><span>${esc(a.n)}</span><span class="pill p-${a.st}">${ST[a.st]}</span></button>`).join("")}<span class="small muted">Touche une ligne pour changer son statut.</span></section>`;
}

/* ---------- Menu ---------- */
function artistes(id){
 if(id){const a=L("artistes").find(x=>x.id===id);if(!a)return "";
  return `<div class="card list" style="gap:14px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><div style="font-family:var(--display);font-size:22px;font-weight:800">${esc(a.n)}</div><button class="copy" data-act="editArt" data-v="${esc(a.id)}">✏️ Modifier</button></div>
  <dl class="kv"><dt>Cachet</dt><dd>${esc(a.cachet)}</dd><dt>Passage</dt><dd>${esc(a.passage||"À confirmer")}</dd><dt>Contrat</dt><dd>${esc(a.contrat)}</dd><dt>Rider</dt><dd>${esc(a.rider)}</dd>${a.inv?`<dt>Invitations</dt><dd>${esc(a.inv)}</dd>`:""}</dl></div>
  ${a.agence?`<section class="card list"><h2 class="sec">Agence</h2><dl class="kv"><dt>Agence</dt><dd>${esc(a.agence.nm||"À renseigner")}</dd>${a.agence.who?`<dt>Contact</dt><dd>${esc(a.agence.who)}</dd>`:""}${a.agence.mail?`<dt>Contact</dt><dd style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${esc(a.agence.mail)}<button class="copy" data-act="copy" data-v="${esc(a.agence.mail)}">Copier</button></dd>`:""}</dl></section>`:""}
  <section class="list"><h2 class="sec">Documents</h2>${(a.files||[]).map(fileLink).join("")}<div class="attach">${attachBtns("art:"+a.id)}</div></section>`}
 return `<div class="list">${L("artistes").map(a=>`<button class="row" data-act="go" data-v="artistes:${esc(a.id)}"><span class="av" style="width:44px;height:44px;font-size:15px;margin:0;background:var(--lemon)">${esc(ini(a.n))}</span><span class="grow"><span class="ttl">${esc(a.n)}</span><span class="sub">${esc(String(a.cachet).split(" ·")[0])} · passage ${esc((a.passage||"à confirmer").toLowerCase())}</span></span>${I.chev}</button>`).join("")}</div>
 <button class="btn ghost" data-act="newArt">+ Ajouter un artiste</button>`;
}
function artSheet(id){
 const a=id?L("artistes").find(x=>x.id===id):{n:"",cachet:"",passage:"À confirmer",contrat:"À recevoir",rider:"À recevoir",files:[]};
 const ag=a.agence;
 openSheet(`<h3>${id?"Modifier "+esc(a.n):"Nouvel artiste"}</h3><form id="artform" data-id="${esc(id||"")}" class="list" style="gap:14px">
 <label class="f">Nom<input id="an" required value="${esc(a.n)}"></label>
 <label class="f">Cachet<input id="ac" value="${esc(a.cachet)}" placeholder="Ex. 300 €"></label>
 <label class="f">Heure de passage<input id="ap" value="${esc(a.passage)}"></label>
 <label class="f">Contrat<input id="ak" value="${esc(a.contrat)}"></label>
 <label class="f">Rider<input id="ar" value="${esc(a.rider)}"></label>
 ${ag?`<label class="f">Agence<input id="agn" value="${esc(ag.nm)}"></label><label class="f">Contact agence<input id="agw" value="${esc(ag.who)}"></label><label class="f">Mail agence<input id="agm" value="${esc(ag.mail)}"></label>`:""}
 <button class="btn lemon" type="submit">Enregistrer</button></form>`);
}
function com(){
 const [y,m]=S.calMonth.split("-").map(Number);const first=new Date(y,m-1,1);const days=new Date(y,m,0).getDate();const off=(first.getDay()+6)%7;
 const has=new Set(L("posts").filter(p=>(p.d||"").startsWith(S.calMonth)).map(p=>+p.d.slice(8)));
 const td=new Date();let cells="";for(let i=0;i<off;i++)cells+="<span></span>";
 for(let d=1;d<=days;d++){const isT=td.getFullYear()===y&&td.getMonth()===m-1&&td.getDate()===d;const ev=y===2027&&m===5&&d===15;cells+=`<span class="d${has.has(d)?" has":""}${isT?" today":""}${ev?" event":""}">${d}</span>`}
 const label=first.toLocaleDateString("fr-FR",{month:"long",year:"numeric"});
 const posts=L("posts").slice().sort((a,b)=>(a.d||"").localeCompare(b.d||""));
 const stl={idee:["Idée","p-afaire"],pret:["Prêt","p-encours"],publie:["Publié","p-fait"]};
 return `<section class="card list" style="gap:10px"><div style="display:flex;justify-content:space-between;align-items:center"><button class="iconbtn" data-act="cal" data-v="-1" aria-label="Mois précédent">‹</button><b style="font-family:var(--display);font-size:14px;text-transform:capitalize">${label}</b><button class="iconbtn" data-act="cal" data-v="1" aria-label="Mois suivant">›</button></div>
 <div class="cal">${["L","M","M","J","V","S","D"].map(d=>`<span class="h">${d}</span>`).join("")}${cells}</div></section>
 <section class="list"><h2 class="sec">Publications Instagram</h2>${posts.length?posts.map((p,i)=>`<button class="card post" data-act="post" data-v="${esc(p.id)}" style="text-align:left"><div class="vis" style="background:${["#f5c518","#1d8fd1","#3d9a4a"][i%3]};color:${i%3?"#fff":"#17181a"}">${esc(p.t)}</div><div class="grow" style="min-width:0;display:flex;flex-direction:column;gap:4px"><div style="display:flex;justify-content:space-between;gap:8px"><b>${esc(p.t)}</b><span class="pill ${stl[p.st||"idee"][1]}">${stl[p.st||"idee"][0]}</span></div><span class="small muted">${dfmt(p.d)}</span><span class="small">${esc(p.x)}</span>${p.url?`<span class="small" style="color:var(--blue);font-weight:700">📎 Visuel joint</span>`:""}</div></button>`).join(""):`<div class="card muted">Aucune publication prévue. Touche « + Publication ».</div>`}</section>`;
}
function postSheet(id){
 const p=id?L("posts").find(x=>x.id===id):{t:"",d:today(),x:"",st:"idee"};
 draft={st:p.st||"idee",url:p.url||"",id:id||null};
 openSheet(`<h3>${id?"Modifier la publication":"Nouvelle publication"}</h3><form id="postform" class="list" style="gap:14px"><label class="f">Titre<input id="pt" required value="${esc(p.t)}"></label><label class="f">Date<input type="date" id="pd" required value="${esc(p.d)}"></label><label class="f">Texte du post<textarea id="ptx">${esc(p.x)}</textarea></label>
 <div class="seg" role="group" aria-label="Statut">${[["idee","Idée"],["pret","Prêt"],["publie","Publié"]].map(([k,l])=>`<button type="button" data-act="postSt" data-v="${k}" aria-pressed="${draft.st===k}">${l}</button>`).join("")}</div>
 <div id="visu" class="small">${draft.url?`<a href="${esc(draft.url)}" target="_blank" rel="noopener">📎 Voir le visuel</a>`:""}</div>
 <div class="attach" style="grid-template-columns:1fr"><label for="up-vis">${I.cam}Ajouter le visuel<input type="file" id="up-vis" accept="image/*,video/*" data-up="vis"></label></div>
 <button class="btn lemon">${id?"Enregistrer":"Ajouter au calendrier"}</button>${id?`<button class="btn ghost" type="button" data-act="delPost" data-id="${esc(id)}">Supprimer</button>`:""}</form>`);
}
function reunions(){
 const l=L("reunions").slice().sort((a,b)=>(b.d||"").localeCompare(a.d||""));const now=today();
 if(!l.length)return `<div class="card empty">${I.note}<b>Aucune réunion</b><span class="small muted">Crée la prochaine réunion avec son ordre du jour.</span></div>`;
 return l.map(r=>{const up=r.d>=now;return `<section class="card list" style="gap:10px"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b style="font-family:var(--display);font-size:15px">${esc(r.t)}</b><span class="pill ${up?"p-encours":"p-fait"}">${up?"À venir":"Passée"}</span></div><span class="small muted">${dfmt(r.d)}</span>
 <div><b class="small">Ordre du jour</b><ol style="margin:6px 0 0;padding-left:20px">${(r.odj||[]).map(o=>`<li>${esc(o)}</li>`).join("")}</ol></div>
 ${r.cr?fileLink(r.cr):`<button class="btn ghost" data-act="mkcr" data-v="${esc(r.id)}">Rédiger le compte rendu (Google Doc)</button>`}
 <button class="small" data-act="delMeet" data-v="${esc(r.id)}" style="color:var(--muted);align-self:flex-start">Supprimer</button></section>`}).join("");
}
function benevoles(){
 return `<section class="card empty">${I.users}<b>Planning pas encore défini</b><p class="small muted" style="margin:0;max-width:34ch">Quand vous aurez les créneaux et les postes, on ajoute ici le planning et son export PDF à envoyer aux bénévoles.</p>
 <div class="ghostgrid"><div>Bar</div><div>Merch</div><div>Accueil / entrée</div><div>Nettoyage</div></div></section>
 <p class="small muted">Les bénévoles n'ont pas accès à l'appli : ils recevront seulement le PDF.</p>`;
}
function annuaire(){
 const groups=[...new Set(L("annuaire").map(c=>c.g||"Autres"))];
 return groups.map(g=>`<section class="list"><h2 class="sec">${esc(g)}</h2>${L("annuaire").filter(c=>(c.g||"Autres")===g).map(c=>`<div class="row"><button class="grow" data-act="contact" data-v="${esc(c.id)}" style="text-align:left"><span class="ttl">${esc(c.n)}</span><span class="sub">${[c.r,c.c].filter(Boolean).map(esc).join(" · ")||"Coordonnées à compléter"}</span></button>${c.c?`<button class="copy" data-act="copy" data-v="${esc(c.c)}">Copier</button>`:""}</div>`).join("")}</section>`).join("")||`<div class="card muted">Annuaire vide.</div>`;
}
function contactSheet(id){
 const c=id?L("annuaire").find(x=>x.id===id):{g:"Prestataires",n:"",r:"",c:""};
 const groups=[...new Set(["Bureau","Agences d'artistes","Prestataires","Mairie & secours",...L("annuaire").map(x=>x.g)])];
 openSheet(`<h3>${id?"Modifier le contact":"Nouveau contact"}</h3><form id="contactform" data-id="${esc(id||"")}" class="list" style="gap:14px">
 <label class="f">Nom<input id="cn" required value="${esc(c.n)}"></label><label class="f">Rôle<input id="cr" value="${esc(c.r)}"></label><label class="f">Téléphone ou mail<input id="cc" value="${esc(c.c)}"></label>
 <label class="f">Catégorie<select id="cg">${groups.map(g=>`<option ${g===c.g?"selected":""}>${esc(g)}</option>`).join("")}</select></label>
 <button class="btn lemon">Enregistrer</button>${id?`<button class="btn ghost" type="button" data-act="delContact" data-id="${esc(id)}">Supprimer</button>`:""}</form>`);
}
function materiel(){
 return L("materiel").length?`<div class="list">${L("materiel").map(m=>`<div class="row"><span class="av" style="width:38px;height:38px;margin:0;border-radius:10px;background:var(--surface);font-size:14px">${esc(m.q)}×</span><span class="grow"><span class="ttl">${esc(m.n)}</span><span class="sub">${esc(m.who)} · ${esc(m.o)}</span></span><button class="copy" data-act="delMat" data-v="${esc(m.id)}" style="background:var(--red-soft);color:var(--red)">Retirer</button></div>`).join("")}</div>`:`<div class="card empty">${I.box}<b>Liste vide</b><span class="small muted">Ajoute le matériel : barnums, rallonges, déco…</span></div>`;
}
function probRow(p){return `<div class="row prob ${p.ok?"ok":""}"><span class="grow"><span class="ttl">${esc(p.cat)}</span><span class="sub">${esc(p.x||"Sans commentaire")} · ${esc(p.a)} à ${esc(p.h)}</span></span>${p.ok?`<span class="pill p-fait">Résolu</span>`:`<button class="copy" data-act="solve" data-v="${esc(p.id)}">Résolu</button>`}</div>`}
function jourj(){
 const bureau=L("annuaire").filter(c=>c.g==="Bureau"&&c.c&&/\d/.test(c.c));
 return `${countHTML()}<button class="bigprob" data-act="newProb">${I.alert}<span><b>Signaler un problème</b><span class="small">Stock, toilettes, sécurité, technique… tout le bureau est prévenu</span></span></button>
 ${L("problemes").length?`<section class="list"><h2 class="sec">Problèmes signalés</h2>${L("problemes").slice().reverse().map(probRow).join("")}</section>`:""}
 <section class="card"><h2 class="sec" style="margin-bottom:6px">Feuille de route</h2><div class="timeline">
  <div class="tl"><span class="h">Matin</span><span>Montage scène, barnums bar et merch, arrivée des 2 food trucks <span class="muted">(horaires à caler)</span></span></div>
  <div class="tl"><span class="h">14:00</span><span><b>Ouverture au public</b></span></div>
  <div class="tl"><span class="h">TBC</span><span>Passages : ${L("artistes").map(a=>esc(a.n)+(a.passage&&a.passage!=="À confirmer"?" ("+esc(a.passage)+")":"")).join(", ")}</span></div>
  <div class="tl"><span class="h">22:00</span><span><b>Fin de l'Open Air</b>, puis démontage et nettoyage</span></div>
 </div></section>
 <section class="list"><h2 class="sec">Numéros utiles <button data-act="go" data-v="annuaire">Annuaire</button></h2>
  ${bureau.map(c=>`<div class="row"><span class="grow"><span class="ttl">${esc(c.n)}</span><span class="sub">${esc(c.c)}</span></span><button class="copy" data-act="copy" data-v="${esc(c.c)}">Copier</button></div>`).join("")}
  <div class="row"><span class="grow"><span class="ttl">Urgences</span><span class="sub">112 · hôpital le plus proche : Cesson-Sévigné</span></span><button class="copy" data-act="copy" data-v="112">Copier</button></div></section>`;
}
function meteo(){
 const days=(EVENT-new Date())/864e5;
 if(days>7)return `<section class="card empty">${I.sun}<b>Prévisions à partir du 8 mai 2027</b><p class="small muted" style="margin:0;max-width:34ch">À J-7, la météo prévue à Noyal-sur-Vilaine pour le 15 mai s'affiche ici, heure par heure de 14 h à 22 h.</p></section>`;
 if(!S.meteo){fetch("https://api.open-meteo.com/v1/forecast?latitude=48.11&longitude=-1.52&hourly=temperature_2m,precipitation_probability,wind_speed_10m&timezone=Europe%2FParis&start_date=2027-05-15&end_date=2027-05-15").then(r=>r.json()).then(j=>{S.meteo=j;render()}).catch(()=>toast("Météo indisponible"));return `<div class="card empty">${I.sun}<b>Chargement de la météo…</b></div>`}
 const h=S.meteo.hourly;const rows=h.time.map((t,i)=>({h:+t.slice(11,13),t:h.temperature_2m[i],p:h.precipitation_probability[i],w:h.wind_speed_10m[i]})).filter(r=>r.h>=14&&r.h<=22);
 return `<section class="card"><h2 class="sec" style="margin-bottom:8px">Samedi 15 mai · Noyal-sur-Vilaine</h2><div class="timeline">${rows.map(r=>`<div class="tl"><span class="h">${r.h} h</span><span class="grow num"><b>${Math.round(r.t)} °C</b> · pluie ${r.p} % · vent ${Math.round(r.w)} km/h</span></div>`).join("")}</div></section>`;
}
function bilan(){return `<section class="card empty">${I.star}<b>Disponible après le 15 mai</b><p class="small muted" style="margin:0;max-width:34ch">Chaque membre pourra noter ce qui a marché et ce qui est à revoir, avec le budget final.</p>
 <div class="ghostgrid" style="grid-template-columns:1fr"><div>✅ Ce qui a marché</div><div>🔧 À revoir pour la prochaine fois</div><div>📊 Chiffres : public, budget réel, bénévoles</div></div></section>`}

/* ---------- Feuilles, menu, toast ---------- */
function openSheet(html){closeLayers();document.body.insertAdjacentHTML("beforeend",`<div class="scrim" data-act="close"></div><div class="bsheet pad" role="dialog" aria-modal="true"><div class="in"><div class="grab"></div>${html}</div></div>`)}
function closeLayers(){document.querySelectorAll(".scrim,.bsheet,.drawer").forEach(e=>e.remove())}
const itm=k=>`<button class="it" data-act="go" data-v="${k}">${VIEWS[k][1]}${VIEWS[k][0]}</button>`;
function openDrawer(){
 closeLayers();
 document.body.insertAdjacentHTML("beforeend",`<div class="scrim" data-act="close"></div><aside class="drawer" aria-label="Menu"><div class="me"><span class="av" style="background:${avColor(S.user)}">${esc(ini(S.user))}</span><div><b>${esc(S.user)}</b><div class="small muted">Bureau Presseur de Citrons</div></div></div>
 <div class="grp">Organisation</div>${["artistes","com","reunions","benevoles"].map(itm).join("")}
 <div class="grp">Ressources</div>${["annuaire","materiel","meteo"].map(itm).join("")}
 <div class="grp">Événement</div>${["jourj","bilan"].map(itm).join("")}
 <div class="note">✉️ Un mail récap chaque soir à 20 h<br>🚨 Mail immédiat en cas de problème</div>
 <div class="grp">Compte</div>
 <button class="it" data-act="switch">${I.users}Changer de prénom</button>
 <button class="it" data-act="lockout">${I.lock}Verrouiller l'appli</button></aside>`);
}
let tt;function toast(m,ms=3200){document.querySelector(".toast")?.remove();document.body.insertAdjacentHTML("beforeend",`<div class="toast" role="status">${esc(m)}</div>`);clearTimeout(tt);tt=setTimeout(()=>document.querySelector(".toast")?.remove(),ms)}
function newProbSheet(){
 draft={cat:"Stock"};
 openSheet(`<h3>Signaler un problème</h3><form id="probform" class="list" style="gap:14px"><div class="chips" style="flex-wrap:wrap">${["Stock","Toilettes","Sécurité","Technique","Bar","Autre"].map(c=>`<button type="button" class="chip" data-act="probCat" data-v="${c}" aria-pressed="${c==="Stock"}">${c}</button>`).join("")}</div>
 <label class="f">C'est quoi ?<textarea id="px" placeholder="Ex. Plus de gobelets au bar"></textarea></label><button class="btn red" type="submit">Prévenir tout le bureau</button></form>`);
}

/* ---------- Événements ---------- */
document.addEventListener("click",async e=>{
 const b=e.target.closest("[data-act]");if(!b)return;const a=b.dataset.act,v=b.dataset.v;
 const pressSingle=()=>{b.parentElement.querySelectorAll("[aria-pressed]").forEach(x=>x.setAttribute("aria-pressed",x===b))};
 try{switch(a){
  case "pick":S.user=v;store.set("pb-user",v);render();break;
  case "tab":closeLayers();S.tab=v;S.view=null;if(v==="docs")S.docPath=[];render();scrollTo(0,0);break;
  case "go":closeLayers();S.view=v;render();scrollTo(0,0);break;
  case "back":S.view=S.view.includes(":")?S.view.split(":")[0]:null;render();break;
  case "drawer":openDrawer();break;
  case "refresh":S.tree=null;toast("Actualisation…");await refresh();toast("À jour");break;
  case "close":closeLayers();break;
  case "filter":S.filter=v;render();break;
  case "task":taskSheet(v);break;
  case "newTask":newTaskSheet();break;
  case "editTask":newTaskSheet(v);break;
  case "toggleWho":{const on=b.getAttribute("aria-pressed")!=="true";b.setAttribute("aria-pressed",on);draft.who=on?[...draft.who,v]:draft.who.filter(x=>x!==v);break}
  case "setSt":{const t=L("taches").find(x=>x.id===b.dataset.id);t.st=v;pressSingle();save("taches",t,`Tâche « ${t.t} » : ${ST[v]}`);taskSheet(t.id);break}
  case "delTask":{if(!b.dataset.ok){confirmBtn(b);break}const t=L("taches").find(x=>x.id===b.dataset.id);closeLayers();del("taches",t.id,`Tâche supprimée : ${t.t}`);toast("Tâche supprimée");break}
  case "mkdoc":{const k=b.dataset.k,tg=b.dataset.t;
   if(tg==="draft"){const nm=$("#tt")?.value.trim()||"Nouvelle tâche";const f=await createDoc(k,nm,["Tâches"]);draft.files.push(f);drawDraftFiles()}
   else if(tg.startsWith("task:")){const t=L("taches").find(x=>x.id===tg.slice(5));const f=await createDoc(k,t.t,["Tâches"]);t.files=[...(t.files||[]),f];save("taches",t);taskSheet(t.id)}
   else if(tg.startsWith("art:")){const ar=L("artistes").find(x=>x.id===tg.slice(4));const f=await createDoc(k,ar.n,["Contrat artiste"]);ar.files=[...(ar.files||[]),f];save("artistes",ar)}
   break}
  case "newExp":newExpSheet();break;
  case "exp":newExpSheet(v);break;
  case "expSt":draft.st=v;pressSingle();break;
  case "delExp":{if(!b.dataset.ok){confirmBtn(b);break}const x=L("depenses").find(d=>d.id===b.dataset.id);closeLayers();del("depenses",x.id,`Dépense supprimée : ${x.l}`);toast("Dépense supprimée");break}
  case "ech":{const x=L("echeances").find(d=>d.id===v);x.st=x.st==="regle"?"aregler":"regle";save("echeances",x,`${x.art} · ${x.l} : ${x.st==="regle"?"réglé":"à régler"}`);toast(x.st==="regle"?"Passé en Réglé":"Repassé en À régler");break}
  case "editPoste":{const p=L("postes").find(x=>x.id===v);openSheet(`<h3>${esc(p.nm)}</h3><form id="posteform" data-id="${esc(p.id)}" class="list" style="gap:14px"><label class="f">Montant prévu (€)<input id="pp" inputmode="decimal" required value="${esc(String(p.prevu).replace(".",","))}"></label><button class="btn lemon">Enregistrer</button></form>`);break}
  case "admin":{const x=L("admin").find(d=>d.id===v);x.st={afaire:"encours",encours:"fait",fait:"afaire"}[x.st];save("admin",x,`${x.n} : ${ST[x.st]}`);break}
  case "dir":S.docPath.push(+v);render();break;
  case "crumb":S.docPath=S.docPath.slice(0,+v);render();break;
  case "copy":try{await navigator.clipboard.writeText(v);toast("Copié : "+v)}catch(_){toast(v)}break;
  case "cal":{let [y,m]=S.calMonth.split("-").map(Number);m+=+v;if(m<1){m=12;y--}if(m>12){m=1;y++}S.calMonth=`${y}-${String(m).padStart(2,"0")}`;render();break}
  case "newProb":newProbSheet();break;
  case "probCat":draft.cat=v;pressSingle();break;
  case "solve":{const p=L("problemes").find(x=>x.id===v);p.ok=true;save("problemes",p,`Problème résolu : ${p.cat}`);toast("Problème marqué résolu");break}
  case "newMat":openSheet(`<h3>Ajouter du matériel</h3><form id="matform" class="list" style="gap:14px"><label class="f">Quoi ?<input id="mn" required></label><label class="f">Quantité<input id="mq" inputmode="numeric" value="1"></label><label class="f">Qui l'a ?<select id="mw">${MEMBRES.map(m=>`<option ${m===S.user?"selected":""}>${esc(m)}</option>`).join("")}<option>Local asso</option></select></label><label class="f">Où ?<input id="mo" placeholder="Ex. Local asso"></label><button class="btn lemon">Ajouter</button></form>`);break;
  case "delMat":{const m=L("materiel").find(x=>x.id===v);del("materiel",v,`Matériel retiré : ${m?.n}`);break}
  case "newPost":postSheet();break;
  case "post":postSheet(v);break;
  case "postSt":draft.st=v;pressSingle();break;
  case "delPost":{if(!b.dataset.ok){confirmBtn(b);break}closeLayers();del("posts",b.dataset.id,"Publication supprimée");break}
  case "newMeet":{const d=new Date();d.setDate(d.getDate()+7);openSheet(`<h3>Nouvelle réunion</h3><form id="meetform" class="list" style="gap:14px"><label class="f">Date<input type="date" id="rd" required value="${d.toISOString().slice(0,10)}"></label><label class="f">Ordre du jour (un point par ligne)<textarea id="ro" required></textarea></label><button class="btn lemon">Créer la réunion</button></form>`);break}
  case "mkcr":{const r=L("reunions").find(x=>x.id===v);const f=await createDoc("doc","CR réunion du "+dfmt(r.d),["Réunions"]);r.cr=f;save("reunions",r,"Compte rendu créé : "+dfmt(r.d));break}
  case "delMeet":{if(!b.dataset.ok){confirmBtn(b);break}del("reunions",v,"Réunion supprimée");break}
  case "editArt":artSheet(v);break;
  case "newArt":artSheet();break;
  case "contact":contactSheet(v);break;
  case "newContact":contactSheet();break;
  case "delContact":{if(!b.dataset.ok){confirmBtn(b);break}closeLayers();del("annuaire",b.dataset.id,"Contact supprimé");break}
  case "switch":closeLayers();S.user=null;store.set("pb-user",null);render();break;
  case "lockout":closeLayers();S.code=null;S.user=null;S.data=null;store.set("pb-code",null);store.set("pb-user",null);store.set("pb-cache",null);render();break;
 }}catch(err){toast("Erreur : "+err.message,5000)}
});
function confirmBtn(b){b.dataset.ok=1;b.textContent="Toucher encore pour confirmer";b.style.background="var(--red)";b.style.color="#fff"}
document.addEventListener("change",async e=>{
 const inp=e.target.closest("[data-up]");if(!inp||!inp.files.length)return;const file=inp.files[0];const tg=inp.dataset.up;
 try{
  if(tg==="draft"){draft.files.push(await upload(file,["Tâches"]));drawDraftFiles()}
  else if(tg.startsWith("task:")){const t=L("taches").find(x=>x.id===tg.slice(5));const f=await upload(file,["Tâches"]);t.files=[...(t.files||[]),f];save("taches",t,`Fichier ajouté à « ${t.t} »`);taskSheet(t.id)}
  else if(tg.startsWith("art:")){const ar=L("artistes").find(x=>x.id===tg.slice(4));const f=await upload(file,["Contrat artiste"]);ar.files=[...(ar.files||[]),f];save("artistes",ar,`Document ajouté pour ${ar.n}`)}
  else if(tg==="exp"){draft.file=file;$("#jst").textContent="📎 "+file.name+" (envoyé à l'enregistrement)"}
  else if(tg==="vis"){const f=await upload(file,["Com"]);draft.url=f.url;$("#visu").innerHTML=`📎 ${esc(f.n)}`}
  else if(tg==="docs"){let node=S.tree;const path=[];S.docPath.forEach(i=>{node=node.c[i];path.push(node.n)});await upload(file,path);S.tree=null;render()}
 }catch(err){toast("Envoi impossible : "+err.message,5000)}
});
document.addEventListener("submit",async e=>{
 e.preventDefault();const f=e.target;
 if(f.id==="codeform")return;
 try{
 if(f.dataset.form==="comment"){const x=$("#cmt").value.trim();if(!x)return;const t=L("taches").find(t=>t.id===f.dataset.id);t.com=[...(t.com||[]),{a:S.user,x,d:new Date().toLocaleDateString("fr-FR",{day:"numeric",month:"short"})}];save("taches",t,`Commentaire sur « ${t.t} » : ${x}`);taskSheet(t.id);return}
 if(f.id==="taskform"){if(!draft.who.length){toast("Choisis au moins une personne.");return}
  if(draft.id){const t=L("taches").find(x=>x.id===draft.id);Object.assign(t,{t:$("#tt").value.trim(),who:draft.who,due:$("#td").value,desc:$("#tx").value.trim()});save("taches",t,`Tâche modifiée : ${t.t}`);taskSheet(t.id);toast("Tâche modifiée");return}
  const t={id:uid(),t:$("#tt").value.trim(),who:draft.who,due:$("#td").value,st:"afaire",desc:$("#tx").value.trim(),files:draft.files,com:[]};closeLayers();S.tab="taches";S.view=null;save("taches",t,`Nouvelle tâche : ${t.t} (${t.who.join(", ")})`);toast("Tâche créée");return}
 if(f.id==="expform"){const m=parseFloat($("#em").value.replace(/\s/g,"").replace(",","."));if(!(m>0)){toast("Le montant doit être un nombre, par exemple 120,50.");return}
  const btn=f.querySelector('[type="submit"]');btn.disabled=true;btn.textContent="Enregistrement…";
  const old=draft.id?L("depenses").find(x=>x.id===draft.id):{};
  const obj={...old,id:draft.id||uid(),l:$("#el").value.trim(),m,p:$("#ep").value,st:draft.st,par:old.par||S.user};
  if(draft.file){const up=await upload(draft.file,["Factures"]);obj.url=up.url;obj.fname=up.n}
  closeLayers();save("depenses",obj,`${draft.id?"Dépense modifiée":"Nouvelle dépense"} : ${obj.l} (${eur(m)})`);toast(draft.id?"Dépense enregistrée":"Dépense ajoutée");return}
 if(f.id==="probform"){const item={id:uid(),cat:draft.cat,x:$("#px").value.trim(),a:S.user,h:nowHM(),ok:false};closeLayers();const arr=D().problemes||(D().problemes=[]);arr.push(item);cache();render();
  try{await api("problem",{item});toast("Problème signalé, le bureau a reçu un mail.")}catch(err){toast("Pas envoyé : "+err.message,5000)}return}
 if(f.id==="matform"){closeLayers();save("materiel",{id:uid(),n:$("#mn").value.trim(),q:parseInt($("#mq").value)||1,who:$("#mw").value,o:$("#mo").value.trim()||"À préciser"},`Matériel ajouté : ${$("#mn")?.value||""}`);return}
 if(f.id==="postform"){const p={id:draft.id||uid(),d:$("#pd").value,t:$("#pt").value.trim(),x:$("#ptx").value.trim(),st:draft.st,url:draft.url};S.calMonth=p.d.slice(0,7);closeLayers();save("posts",p,`Publication Instagram : ${p.t} (${dfmt(p.d)})`);return}
 if(f.id==="meetform"){const r={id:uid(),d:$("#rd").value,t:"Réunion de bureau",odj:$("#ro").value.split("\n").map(s=>s.trim()).filter(Boolean),cr:null};closeLayers();save("reunions",r,`Réunion prévue le ${dfmt(r.d)}`);return}
 if(f.id==="posteform"){const p=L("postes").find(x=>x.id===f.dataset.id);const v=parseFloat($("#pp").value.replace(/\s/g,"").replace(",","."));if(!(v>=0)){toast("Montant invalide");return}p.prevu=v;closeLayers();save("postes",p,`Prévu « ${p.nm} » : ${eur(v)}`);return}
 if(f.id==="artform"){const id=f.dataset.id;const a=id?L("artistes").find(x=>x.id===id):{id:uid(),files:[]};Object.assign(a,{n:$("#an").value.trim(),cachet:$("#ac").value.trim(),passage:$("#ap").value.trim(),contrat:$("#ak").value.trim(),rider:$("#ar").value.trim()});if(a.agence)a.agence={nm:$("#agn").value.trim(),who:$("#agw").value.trim(),mail:$("#agm").value.trim()};closeLayers();save("artistes",a,`Fiche artiste mise à jour : ${a.n}`);return}
 if(f.id==="contactform"){const id=f.dataset.id;const c={id:id||uid(),n:$("#cn").value.trim(),r:$("#cr").value.trim(),c:$("#cc").value.trim(),g:$("#cg").value};closeLayers();save("annuaire",c,`Contact ${id?"modifié":"ajouté"} : ${c.n}`);return}
 }catch(err){toast("Erreur : "+err.message,5000)}
});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeLayers()});
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")refresh(true)});
setInterval(()=>{if(document.visibilityState==="visible")refresh(true)},60000);
if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});
render();
if(S.code&&S.data)refresh(true);
