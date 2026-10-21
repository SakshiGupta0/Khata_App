/* Shared profile manager for Khata & Hisaab.
   - Picker screen at launch, optional 4-digit PIN per profile (this device only)
   - Auto-lock when the app returns from background
   - Add / edit (name, colour, PIN) / remove (with reassign) profiles
   NOTE: the PIN is a privacy screen on a shared phone, not encryption. */
(function(){
"use strict";
let C = null;           // config from the host app
let active = null;      // active profile id
let unlockedAt = 0;
let hiddenAt = 0;
let pending = null;     // profile awaiting PIN
let pinBuf = "";
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const K = k => C.app + "_" + k;
const lsGet = (k, d) => { try { const v = localStorage.getItem(K(k)); return v == null ? d : JSON.parse(v); } catch(e){ return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(K(k), JSON.stringify(v)); } catch(e){} };
const initial = n => (String(n||"?").trim()[0] || "?").toUpperCase();

async function hashPin(pin, salt){
  const data = new TextEncoder().encode(salt + ":" + pin);
  if (crypto && crypto.subtle){
    const buf = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
  }
  let h = 5381; for (const b of data) h = ((h<<5)+h+b)|0; return String(h);   // fallback (very old WebView)
}
const pins = () => lsGet("pins", {});
const hasPin = id => !!pins()[id];
async function setPin(id, pin){
  const salt = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const p = pins(); p[id] = { s: salt, h: await hashPin(pin, salt) }; lsSet("pins", p);
}
function clearPin(id){ const p = pins(); delete p[id]; lsSet("pins", p); }
async function checkPin(id, pin){ const e = pins()[id]; return !!e && (await hashPin(pin, e.s)) === e.h; }

/* ---------- styles ---------- */
function injectCss(){
  if ($("pf-css")) return;
  const a = C.accent || "#7D2A2A", d = C.accentDeep || "#5E1F1F", g = C.gold || "#D8B978";
  const st = document.createElement("style"); st.id = "pf-css";
  st.textContent = `
#pf{position:fixed;inset:0;z-index:9000;background:linear-gradient(180deg,${a},${d});color:#F7EFE2;display:none;flex-direction:column;align-items:center;overflow-y:auto;padding:calc(36px + env(safe-area-inset-top)) 22px calc(28px + env(safe-area-inset-bottom));font-family:var(--sans,system-ui)}
#pf.open{display:flex}
#pf h1{font-family:var(--disp,serif);font-weight:600;font-size:30px;letter-spacing:.3px;margin-top:6px}
#pf h1 small{font-size:20px;opacity:.8;margin-left:8px}
#pf .tag{margin:6px 0 26px;font-size:14px;color:#E8D9BE}
#pf .rule{width:120px;height:3px;background:repeating-linear-gradient(90deg,${g} 0 14px,transparent 14px 22px);opacity:.85;margin:14px 0 4px}
#pf .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;width:100%;max-width:360px}
#pf .pcard{background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.18);border-radius:18px;padding:18px 8px 14px;display:flex;flex-direction:column;align-items:center;gap:8px;color:inherit;font-size:15px;font-weight:600;position:relative}
#pf .pcard:active{background:rgba(255,255,255,.2)}
#pf .av,.pf-av{width:62px;height:62px;border-radius:50%;display:grid;place-items:center;font-family:var(--disp,serif);font-size:28px;font-weight:600;color:#fff;border:2px solid ${g}}
#pf .lock{position:absolute;top:8px;right:10px;font-size:12px;opacity:.85}
#pf .link{margin-top:22px;background:none;border:0;color:#E8D9BE;font-size:14px;text-decoration:underline;padding:8px}
#pf .pad{display:grid;grid-template-columns:repeat(3,72px);gap:14px;margin-top:20px}
#pf .pad button{height:62px;border-radius:50%;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:#fff;font-size:24px;font-family:var(--mono,monospace)}
#pf .pad button:active{background:rgba(255,255,255,.28)}
#pf .dots{display:flex;gap:16px;margin:18px 0 4px;height:16px}
#pf .dots i{width:14px;height:14px;border-radius:50%;border:2px solid ${g};display:block}
#pf .dots i.on{background:${g}}
#pf .msg{min-height:20px;font-size:13px;color:#FFD6CF;margin-top:8px}
#pf .shake{animation:pfshake .35s}
@keyframes pfshake{25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}
#pf .panel{background:#fff;color:#211E1A;border-radius:18px;width:100%;max-width:380px;padding:18px;margin-top:6px}
#pf .panel h2{font-family:var(--disp,serif);font-size:20px;margin-bottom:10px;color:${a}}
#pf .panel label{display:block;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#6E675C;margin:12px 0 5px}
#pf .panel input,#pf .panel select{width:100%;padding:11px 12px;border:1px solid #E4E0D6;border-radius:10px;background:#FAF8F3;font-size:16px;color:#211E1A}
#pf .swatches{display:flex;gap:9px;flex-wrap:wrap}
#pf .sw{width:32px;height:32px;border-radius:50%;border:3px solid transparent;padding:0}
#pf .sw.on{border-color:#211E1A}
#pf .row{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #E4E0D6}
#pf .row:last-child{border:0}
#pf .row .pf-av{width:40px;height:40px;font-size:18px;border-width:0}
#pf .row .nm{flex:1;font-weight:600;font-size:15px}
#pf .row .nm small{display:block;font-weight:400;color:#6E675C;font-size:12px}
#pf .pb{border:1px solid #E4E0D6;background:#fff;border-radius:10px;padding:8px 12px;font-size:13px;color:#211E1A}
#pf .pb.pri{background:${a};border-color:${a};color:#fff}
#pf .pb.dng{color:#B3362B;border-color:#E9C3BE}
#pf .btns{display:flex;gap:10px;margin-top:16px;flex-wrap:wrap}
#pf .btns .pb{flex:1;padding:12px}
#pf .note{font-size:12px;color:#6E675C;line-height:1.5;margin-top:10px}
.pf-chip{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.3);color:#F7EFE2;border-radius:20px;padding:3px 10px 3px 3px;font-size:12px;font-weight:600}
.pf-chip .pf-av{width:22px;height:22px;font-size:11px;border-width:1px}
#pfMenu{position:fixed;inset:0;z-index:8990;display:none}
#pfMenu.open{display:block}
#pfMenu .m{position:absolute;right:14px;top:calc(54px + env(safe-area-inset-top));background:#fff;color:#211E1A;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.28);min-width:200px;overflow:hidden}
#pfMenu .m button{display:block;width:100%;text-align:left;background:none;border:0;padding:14px 16px;font-size:15px;border-bottom:1px solid #E4E0D6;color:#211E1A}
#pfMenu .m button:last-child{border:0}
#pfMenu .m .who{padding:12px 16px;font-size:12px;color:#6E675C;background:#FAF8F3;border-bottom:1px solid #E4E0D6}
`;
  document.head.appendChild(st);
}

/* ---------- screens ---------- */
function root(){
  let el = $("pf");
  if (!el){ el = document.createElement("div"); el.id = "pf"; document.body.appendChild(el); }
  return el;
}
function header(sub){
  return `<div class="rule"></div><h1>${esc(C.title)}<small>${esc(C.hindi||"")}</small></h1><div class="tag">${esc(sub)}</div>`;
}
function av(p){ return `<span class="pf-av" style="background:${p.color}">${esc(initial(p.name))}</span>`; }

function showPicker(){
  const el = root(); el.classList.add("open"); pending = null; pinBuf = "";
  const list = C.list();
  el.innerHTML = header(C.pickTag || "Who is this?") +
    `<div class="grid">${list.map(p=>`<button class="pcard" data-pick="${esc(p.id)}">${hasPin(p.id)?'<span class="lock">🔒</span>':""}${av(p)}<span>${esc(p.name)}</span></button>`).join("")}
      <button class="pcard" data-act="add"><span class="pf-av" style="background:transparent;border-style:dashed;font-size:30px">+</span><span>Add profile</span></button></div>
     <button class="link" data-act="manage">Manage profiles</button>`;
  el.onclick = e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.pick) return choose(b.dataset.pick);
    if (b.dataset.act === "add") return showEditor(null, showPicker);
    if (b.dataset.act === "manage") return showManage();
  };
}
async function choose(id){
  const p = C.list().find(x=>x.id===id); if (!p) return;
  if (!hasPin(id)) return enter(id);
  showPin(p);
}
function showPin(p, mode, onDone){
  const el = root(); el.classList.add("open"); pinBuf = ""; pending = p;
  const title = mode === "new" ? "Choose a 4-digit PIN" : mode === "confirm" ? "Enter it once more" : "Enter PIN";
  el.innerHTML = header(title) + `${av(p)}<div style="margin-top:8px;font-weight:600">${esc(p.name)}</div>
    <div class="dots" id="pfDots"><i></i><i></i><i></i><i></i></div><div class="msg" id="pfMsg"></div>
    <div class="pad">${[1,2,3,4,5,6,7,8,9].map(n=>`<button data-k="${n}">${n}</button>`).join("")}<button data-k="x" style="font-size:16px">✕</button><button data-k="0">0</button><button data-k="b" style="font-size:20px">⌫</button></div>
    ${mode ? "" : '<button class="link" data-k="forgot">Forgot PIN?</button>'}
    <button class="link" data-k="back">← Back</button>`;
  const dots = () => el.querySelectorAll("#pfDots i").forEach((d,i)=>d.classList.toggle("on", i < pinBuf.length));
  let first = null;
  el.onclick = async e => {
    const b = e.target.closest("button"); if (!b) return; const k = b.dataset.k;
    if (k === "back" || k === "x") return mode ? onDone(false) : showPicker();
    if (k === "forgot"){
      if (confirm("Remove the PIN for " + p.name + " on this device? Anyone holding this phone will be able to open this profile.")){ clearPin(p.id); enter(p.id); }
      return;
    }
    if (k === "b"){ pinBuf = pinBuf.slice(0,-1); return dots(); }
    if (pinBuf.length >= 4) return;
    pinBuf += k; dots();
    if (pinBuf.length < 4) return;
    const entered = pinBuf;
    if (!mode){
      if (await checkPin(p.id, entered)) return enter(p.id);
      $("pfMsg").textContent = "Wrong PIN, try again."; $("pfDots").classList.add("shake");
      setTimeout(()=>{ pinBuf = ""; if ($("pfDots")){ $("pfDots").classList.remove("shake"); dots(); } }, 400);
    } else if (mode === "new"){
      first = entered; pinBuf = ""; mode = "confirm";
      el.querySelector(".tag").textContent = "Enter it once more"; dots();
    } else {
      if (entered === first){ await setPin(p.id, entered); onDone(true); }
      else { $("pfMsg").textContent = "PINs didn't match. Start again."; first = null; mode = "new"; pinBuf = ""; el.querySelector(".tag").textContent = "Choose a 4-digit PIN"; dots(); }
    }
  };
}

function swatches(sel){
  return `<div class="swatches" id="pfSw">${C.colors.map(c=>`<button type="button" class="sw ${c===sel?"on":""}" data-c="${c}" style="background:${c}" aria-label="colour"></button>`).join("")}</div>`;
}
function showEditor(id, back){
  const el = root(); el.classList.add("open");
  const p = id ? C.list().find(x=>x.id===id) : null;
  let color = p ? p.color : C.colors[C.list().length % C.colors.length];
  el.innerHTML = header(p ? "Edit profile" : "New profile") + `<div class="panel">
    <label for="pfName" style="margin-top:0">Name</label><input id="pfName" maxlength="24" value="${esc(p?p.name:"")}" placeholder="e.g. Mummy" autocomplete="off">
    <label>Colour</label>${swatches(color)}
    ${p ? `<label>PIN lock (this device)</label><div class="btns" style="margin-top:0">
      <button class="pb" data-a="pin">${hasPin(p.id)?"Change PIN":"Set a PIN"}</button>${hasPin(p.id)?'<button class="pb dng" data-a="nopin">Remove PIN</button>':""}</div>` : ""}
    <div class="btns"><button class="pb" data-a="cancel">Cancel</button><button class="pb pri" data-a="save">${p?"Save":"Add profile"}</button></div>
    ${p ? `<div class="btns" style="margin-top:6px"><button class="pb dng" data-a="remove">Remove this profile</button></div>` : ""}</div>`;
  el.onclick = async e => {
    const sw = e.target.closest(".sw");
    if (sw){ color = sw.dataset.c; el.querySelectorAll(".sw").forEach(s=>s.classList.toggle("on", s===sw)); return; }
    const b = e.target.closest("button[data-a]"); if (!b) return;
    const name = $("pfName").value.trim();
    switch (b.dataset.a){
      case "cancel": return back();
      case "save": {
        if (!name) return alert("Please enter a name.");
        if (C.list().some(x=>x.id!==id && x.name.toLowerCase()===name.toLowerCase())) return alert("Someone already has that name.");
        if (p){ C.onEdit(p.id, {name, color}); }
        else { const nid = C.onAdd(name, color); if (nid && !active) active = nid; }
        return back();
      }
      case "pin": return showPin(p, "new", ok => showEditor(id, back));
      case "nopin": clearPin(p.id); return showEditor(id, back);
      case "remove": return showRemove(p, back);
    }
  };
}
function showRemove(p, back){
  const el = root(); const others = C.list().filter(x=>x.id!==p.id);
  if (!others.length){ alert("You can't remove the only profile."); return showEditor(p.id, back); }
  const cnt = C.countOf ? C.countOf(p.id) : 0;
  el.innerHTML = header("Remove " + p.name + "?") + `<div class="panel">
    ${cnt ? `<p style="font-size:14px;line-height:1.5">${esc(p.name)} has <b>${cnt}</b> ${esc(C.countLabel||"records")}. Nothing is deleted — they move to:</p>
      <label>Move to</label><select id="pfMove">${others.map(o=>`<option value="${esc(o.id)}">${esc(o.name)}</option>`).join("")}</select>`
      : `<p style="font-size:14px">${esc(p.name)} has no ${esc(C.countLabel||"records")}.</p>`}
    <div class="btns"><button class="pb" data-a="cancel">Cancel</button><button class="pb dng" data-a="go">Remove</button></div></div>`;
  el.onclick = e => {
    const b = e.target.closest("button[data-a]"); if (!b) return;
    if (b.dataset.a === "cancel") return showEditor(p.id, back);
    const to = cnt ? $("pfMove").value : (others[0] && others[0].id);
    C.onRemove(p.id, to); clearPin(p.id);
    if (active === p.id){ active = null; lsSet("active", null); return showPicker(); }
    back();
  };
}
function showManage(back){
  const el = root(); el.classList.add("open");
  const list = C.list();
  const done = back || (()=> active ? close() : showPicker());
  el.innerHTML = header("Manage profiles") + `<div class="panel">
    ${list.map(p=>`<div class="row">${av(p)}<div class="nm">${esc(p.name)}<small>${hasPin(p.id)?"🔒 PIN set":"No PIN"}${C.countOf?" · "+C.countOf(p.id)+" "+esc(C.countLabel||""):""}</small></div><button class="pb" data-e="${esc(p.id)}">Edit</button></div>`).join("")}
    <div class="btns"><button class="pb" data-a="add">+ Add profile</button><button class="pb pri" data-a="done">Done</button></div>
    <p class="note">PINs protect against casual snooping on a shared phone and are stored only on this device. They are not encryption.</p></div>`;
  el.onclick = e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.e) return showEditor(b.dataset.e, ()=>showManage(back));
    if (b.dataset.a === "add") return showEditor(null, ()=>showManage(back));
    if (b.dataset.a === "done") return done();
  };
}

/* ---------- enter / lock ---------- */
function enter(id){
  active = id; lsSet("active", id); unlockedAt = Date.now();
  close(); updateChips();
  if (C.onSwitch) C.onSwitch(id);
}
function close(){ const el = $("pf"); if (el){ el.classList.remove("open"); el.innerHTML = ""; el.onclick = null; } }
function lock(){ if (C.list().length) showPicker(); }

function updateChips(){
  const p = C.list().find(x=>x.id===active);
  document.querySelectorAll("[data-pf-chip]").forEach(el=>{
    el.className = "pf-chip";
    el.innerHTML = p ? `${av(p)}<span>${esc(p.name)}</span>` : "Profile";
    el.onclick = openMenu;
  });
}
function openMenu(){
  let m = $("pfMenu");
  if (!m){ m = document.createElement("div"); m.id = "pfMenu"; document.body.appendChild(m); }
  const p = C.list().find(x=>x.id===active);
  m.innerHTML = `<div class="m"><div class="who">Signed in as <b>${esc(p?p.name:"—")}</b></div>
    <button data-m="switch">Switch profile</button><button data-m="manage">Manage profiles</button><button data-m="lock">Lock now</button></div>`;
  m.classList.add("open");
  m.onclick = e => {
    const b = e.target.closest("button"); m.classList.remove("open");
    if (!b) return;
    if (b.dataset.m === "switch" || b.dataset.m === "lock") showPicker();
    if (b.dataset.m === "manage") showManage(()=>{ active && C.list().some(x=>x.id===active) ? close() : showPicker(); });
  };
}

window.Profiles = {
  init(cfg){
    C = Object.assign({ colors:["#7D2A2A","#2B577D","#1E6B4F","#A87B2C","#5B3E86","#8A5A44","#3E7C7B","#9C4573"], autolockSec:60 }, cfg);
    injectCss();
    active = lsGet("active", null);
    if (!C.list().some(p=>p.id===active)) active = null;
    // lock again after being in the background for a while (only matters when a PIN exists)
    const gone = () => { hiddenAt = Date.now(); };
    const back = () => {
      if (!hiddenAt) return; const away = (Date.now()-hiddenAt)/1000; hiddenAt = 0;
      if (away >= C.autolockSec && active && hasPin(active)) showPicker();
    };
    document.addEventListener("visibilitychange", () => document.hidden ? gone() : back());
    const cap = window.Capacitor;
    if (cap && cap.Plugins && cap.Plugins.App){
      cap.Plugins.App.addListener("pause", gone); cap.Plugins.App.addListener("resume", back);
    }
  },
  start(){ showPicker(); },
  active: () => active,
  refresh(){ if (active && !C.list().some(p=>p.id===active)){ active = null; lsSet("active", null); } updateChips(); },
  manage(){ showManage(()=>{ active ? close() : showPicker(); }); },
  openEditor(id){ showEditor(id, ()=>{ close(); updateChips(); }); },
  lock
};
})();
