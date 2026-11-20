(() => {
"use strict";
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const CHANNELS = ["Shopee","Makro PRO","LINE OA","Facebook","เว็บไซต์","หน้าร้าน","อื่นๆ"];
const OTHER = "อื่นๆ";
const MAX_PHOTOS = 6;
const IS_TOUCH = (window.matchMedia && matchMedia("(pointer:coarse)").matches) || /Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
const HAS_WEBCAM = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && window.isSecureContext !== false;
const CFG = Object.assign({ SHEETS_URL: "", API_KEY: "" }, window.QC_CONFIG || {});

/* ---------- version ---------- */
const APP_VERSION = "1.4.1";
const CHANGELOG = [
  { v: "1.4.1", date: "2026-11-20", notes: [
    "หน้าประวัติ: เปลี่ยนช่อง “ครบตามออร์เดอร์” และ “ไม่ครบ” เป็น “สินค้าที่เช็ค (วันนี้)” และ “ผู้ตรวจ (วันนี้)”"
  ]},
  { v: "1.4.0", date: "2026-11-20", notes: [
    "แก้ปุ่ม “ถ่ายรูป” ให้เปิดกล้องได้แน่นอนขึ้น บนคอมพิวเตอร์จะเปิดกล้องในหน้าเว็บ (เว็บแคม)",
    "มือถือ/แท็บเล็ต: ถ้ากล้องของเครื่องไม่ขึ้น กดปุ่ม “กล้องในเว็บ” แทนได้",
    "ผู้ดูแลลบข้อมูลผลตรวจได้ทีละหลายรายการ (หน้า ประวัติ > ลบข้อมูล) ต้องใส่รหัสผู้ดูแล",
    "ลบบันทึกแล้วรูปและลายเซ็นใน Google Drive จะถูกย้ายไปถังขยะด้วย (กู้คืนได้ 30 วัน)"
  ]},
  { v: "1.3.0", date: "2026-11-20", notes: [
    "ช่องทางการขาย: เอา Lazada และ TikTok Shop ออก เพิ่ม Makro PRO",
    "เลือก “อื่นๆ” แล้วต้องพิมพ์ระบุว่าเป็นช่องทางไหน",
    "เพิ่มรูปสินค้า: แนบรูปในหน้ารายการสินค้า หรือใส่ลิงก์รูปในไฟล์ CSV / Excel (คอลัมน์ รูปสินค้า)",
    "แสดงรูปสินค้าในรายการเช็ค แตะรูปเพื่อดูขนาดใหญ่"
  ]},
  { v: "1.2.0", date: "2026-11-20", notes: [
    "ต้องใส่รหัสผู้ดูแลก่อนนำเข้าไฟล์ CSV / Excel เพิ่ม หรือลบรายการสินค้า",
    "ต้องใส่รหัสผู้ดูแลก่อนลบบันทึกผลตรวจ",
    "ระบบตรวจรหัสที่ฝั่ง Google (รหัสไม่อยู่ในโค้ดเว็บ) และล็อก 10 นาทีถ้าใส่ผิดเกิน 5 ครั้ง"
  ]},
  { v: "1.1.1", date: "2026-11-20", notes: [
    "เปิดใช้งานจริงบน GitHub Pages ใช้ได้ทุกเครื่อง",
    "เชื่อม Google Sheet \"QC เช็คสินค้าก่อนจัดส่ง - ข้อมูล\" แล้ว ผลตรวจทุกรายการบันทึกลงชีตอัตโนมัติ"
  ]},
  { v: "1.1.0", date: "2026-11-20", notes: [
    "แสดงเลขเวอร์ชันที่หัวเว็บและท้ายเว็บ กดดูประวัติการอัปเดตได้",
    "รองรับการบันทึกผลตรวจลง Google Sheets (ผ่าน Google Apps Script) พร้อมเก็บรูปและลายเซ็นใน Google Drive",
    "โหลดรายการสินค้าจากชีต Products และดึงประวัติการตรวจจากชีตได้",
    "เก็บเลขเวอร์ชันของเว็บไว้ในทุกบันทึก"
  ]},
  { v: "1.0.1", date: "2026-11-20", notes: [ "เปลี่ยนช่องทางการขาย LINE เป็น LINE OA" ]},
  { v: "1.0.0", date: "2026-11-20", notes: [
    "เช็ครายการสินค้าตามออร์เดอร์ พร้อมเวลาที่เช็คแต่ละรายการ",
    "แนบรูปก่อนจัดส่ง (ประทับวันเวลาอัตโนมัติ) และเซ็นลายเซ็นผู้ตรวจ",
    "นำเข้ารายการสินค้าจาก CSV / Excel",
    "ประวัติการตรวจ ส่งออก CSV และคัดลอกไปวาง Google Sheets",
    "รองรับมือถือ แท็บเล็ต และคอมพิวเตอร์"
  ]}
];

/* ---------- state ---------- */
const S = {
  products: [], records: [],
  checks: {},          // id -> ISO time checked
  qty: {},             // id -> number
  filter: "all", q: "", channel: "",
  photos: [],          // {blob, url}
  startedAt: null,
  importMode: "merge",
  db: null, assets: null, downloads: null, mode: "local",
  pin: (() => { try { return sessionStorage.getItem("qc_pin") || ""; } catch (e) { return ""; } })(),
  canWrite: true,
  selecting: false, sel: new Set()
};

/* ---------- utils ---------- */
const pad = n => String(n).padStart(2, "0");
const thDate = d => d.toLocaleDateString("th-TH", {day:"numeric", month:"short", year:"numeric"});
const thDateLong = d => d.toLocaleDateString("th-TH", {weekday:"long", day:"numeric", month:"long", year:"numeric"});
const hms = d => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const hm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
function hash(s){ let h = 2166136261; for (let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619);} return (h>>>0).toString(36); }
function lsGet(k, d){ try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch(e){ return d; } }
function lsSet(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch(e){ return false; } }
function deviceType(){ const w = Math.min(screen.width, screen.height); if (/Mobi|Android|iPhone/i.test(navigator.userAgent) && w < 600) return "มือถือ"; if (/iPad|Tablet|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && w >= 600 && w < 1100)) return "แท็บเล็ต"; return "คอมพิวเตอร์"; }

let toastT;
function toast(msg, err){ const t = $("#toast"); t.textContent = msg; t.classList.toggle("err", !!err); t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(()=>t.classList.remove("show"), 3200); }

function modal(html){ $("#sheet").innerHTML = html; $("#modal").classList.add("open"); }
let camStream = null;
function stopCamera(){ if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; } }
function closeModal(){ stopCamera(); $("#modal").classList.remove("open"); }
$("#modal").addEventListener("click", e => { if (e.target.id === "modal" || e.target.closest("[data-close]")) closeModal(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
function confirmBox(title, body, okText, danger){
  return new Promise(res => {
    modal(`<h2>${esc(title)}</h2><p class="hint" style="font-size:.95rem">${body}</p>
      <div class="acts"><button class="btn btn-ghost" id="cNo">ยกเลิก</button><button class="btn ${danger?"btn-danger":"btn-primary"}" id="cYes">${esc(okText)}</button></div>`);
    $("#cNo").onclick = () => { closeModal(); res(false); };
    $("#cYes").onclick = () => { closeModal(); res(true); };
  });
}

/* ---------- clock ---------- */
function tick(){
  const d = new Date();
  $("#clockT").textContent = hms(d);
  $("#clockD").textContent = thDate(d);
  $("#stDate").textContent = thDate(d);
  $("#stTime").textContent = hms(d);
}
setInterval(tick, 1000); tick();

/* ---------- tabs ---------- */
function show(view){
  $$(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + view));
  $$("[data-view]").forEach(b => b.setAttribute("aria-selected", b.dataset.view === view ? "true" : "false"));
  if (view === "check") requestAnimationFrame(sigResize);
  if (location.hash.slice(1) !== view) history.replaceState(null, "", "#" + view);
  window.scrollTo({top:0});
}
$$("[data-view]").forEach(b => b.addEventListener("click", () => show(b.dataset.view)));
window.addEventListener("hashchange", () => { const h = location.hash.slice(1); if (["check","history","products"].includes(h)) show(h); });

function showChangelog(){
  modal(`<h2>ประวัติเวอร์ชัน</h2><p class="hint">ตอนนี้ใช้งานเวอร์ชัน <b>${APP_VERSION}</b></p>
    <div class="cl">${CHANGELOG.map(c => `<section class="${c.v === APP_VERSION ? "cur" : ""}"><h3>v${esc(c.v)} <span class="pill ch">${thDate(new Date(c.date + "T00:00:00"))}</span>${c.v === APP_VERSION ? `<span class="pill">เวอร์ชันปัจจุบัน</span>` : ""}</h3>
      <ul>${c.notes.map(n => `<li>${esc(n)}</li>`).join("")}</ul></section>`).join("")}</div>
    <div class="acts"><button class="btn btn-primary" data-close>ปิด</button></div>`);
}
$("#verBtn").textContent = "v" + APP_VERSION;
$("#footVer").textContent = "เวอร์ชัน " + APP_VERSION;
$("#verBtn").addEventListener("click", showChangelog);
$("#footVer").addEventListener("click", showChangelog);

/* ---------- order info ---------- */
$("#channels").innerHTML = CHANNELS.map(c => `<button class="chip" type="button" data-c="${esc(c)}" aria-pressed="false">${esc(c)}</button>`).join("");
$("#channels").addEventListener("click", e => {
  const b = e.target.closest(".chip"); if (!b) return;
  S.channel = S.channel === b.dataset.c ? "" : b.dataset.c;
  $$("#channels .chip").forEach(x => x.setAttribute("aria-pressed", x.dataset.c === S.channel ? "true" : "false"));
  $("#channelOther").hidden = S.channel !== OTHER;
  if (S.channel === OTHER) $("#channelOther").focus();
});
function channelValue(){ return S.channel === OTHER ? OTHER + ": " + $("#channelOther").value.trim() : S.channel; }
$("#inspector").value = lsGet("qc_inspector", "");
$("#inspector").addEventListener("input", e => { lsSet("qc_inspector", e.target.value.trim()); updateSigName(); });
$("#orderNo").addEventListener("input", () => { renderList(); });
function updateSigName(){ $("#sigName").textContent = "ผู้ตรวจ: " + ($("#inspector").value.trim() || "-"); }
updateSigName();

/* ---------- products helpers ---------- */
function normProduct(p){
  const o = {
    code: String(p.code ?? "").trim(), name: String(p.name ?? "").trim(),
    qty: Math.max(1, parseInt(p.qty, 10) || 1), unit: String(p.unit ?? "").trim(),
    order: String(p.order ?? "").trim(), category: String(p.category ?? "").trim(),
    image: imgUrl(p.image)
  };
  o.id = "p" + hash(o.order + "|" + (o.code || o.name));
  return o;
}
/* turn a Google Drive share link into a direct thumbnail URL; keep other http(s)/data URLs */
function imgUrl(v){
  v = String(v ?? "").trim(); if (!v) return "";
  const m = v.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=|thumbnail\?id=)([\w-]{20,})/);
  if (m) return "https://drive.google.com/thumbnail?id=" + m[1] + "&sz=w600";
  return /^(https?:|data:image\/)/i.test(v) ? v : "";
}
const BOX_ICON = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>';
function thumb(p, cls){ return p.image ? `<img class="${cls}" src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" data-zoom="${esc(p.image)}" data-noclick>` : `<div class="${cls}" aria-hidden="true">${BOX_ICON}</div>`; }
function zoomImg(src, name){ modal(`<div class="lightbox"><img src="${esc(src)}" alt="${esc(name || "")}"></div>${name ? `<p class="hint" style="margin-top:8px">${esc(name)}</p>` : ""}<div class="acts"><button class="btn btn-ghost" data-close>ปิด</button></div>`); }
function orders(){ return [...new Set(S.products.map(p => p.order).filter(Boolean))]; }
function activeOrder(){ const v = $("#orderNo").value.trim(); return v && S.products.some(p => p.order === v) ? v : ""; }
function scope(){ const o = activeOrder(); return o ? S.products.filter(p => p.order === o) : S.products; }

/* ---------- checklist ---------- */
function renderList(){
  const ao = activeOrder();
  const all = scope();
  const q = S.q.toLowerCase();
  const rows = all.filter(p => {
    if (S.filter === "todo" && S.checks[p.id]) return false;
    if (S.filter === "done" && !S.checks[p.id]) return false;
    if (q && !(`${p.name} ${p.code} ${p.category}`.toLowerCase().includes(q))) return false;
    return true;
  });
  const hint = $("#orderHint");
  if (ao) hint.innerHTML = `แสดงเฉพาะสินค้าของออร์เดอร์ <b>${esc(ao)}</b> · ต้องเช็คให้ครบ ${all.length} รายการ`;
  else if (orders().length) hint.textContent = `พิมพ์หรือเลือกเลขออร์เดอร์ที่นำเข้าไว้ (${orders().length} ออร์เดอร์) เพื่อดูเฉพาะสินค้าของออร์เดอร์นั้น หรือเช็คจากรายการสินค้าทั้งหมดด้านล่าง`;
  else hint.textContent = "แตะที่สินค้าเพื่อเช็คว่ามีอยู่ในกล่อง และปรับจำนวนให้ตรงกับที่แพ็ก";

  const list = $("#list");
  if (!S.products.length) {
    list.innerHTML = `<div class="empty"><h3>ยังไม่มีรายการสินค้า</h3><p>นำเข้าไฟล์ CSV หรือ Excel ที่หน้า “รายการสินค้า” ก่อนเริ่มตรวจ</p>
      <button class="btn btn-primary" data-go="products" style="margin-top:8px">ไปนำเข้ารายการสินค้า</button></div>`;
  } else if (!rows.length) {
    list.innerHTML = `<div class="empty"><h3>ไม่พบสินค้า</h3><p>ลองเปลี่ยนคำค้นหาหรือตัวกรอง</p></div>`;
  } else {
    list.innerHTML = rows.map(p => {
      const at = S.checks[p.id];
      const qv = S.qty[p.id] ?? p.qty;
      return `<div class="item${at ? " on" : ""}" data-id="${p.id}" role="checkbox" aria-checked="${at ? "true" : "false"}" tabindex="0">
        <span class="tick"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>
        <span class="pinfo">${thumb(p, "pthumb")}<div><div class="nm">${esc(p.name)}</div>
          <div class="meta">${p.code ? `<span>${esc(p.code)}</span>` : ""}${p.category ? `<span>${esc(p.category)}</span>` : ""}${ao ? `<span>ต้องมี ${p.qty} ${esc(p.unit)}</span>` : ""}${at ? `<span class="at num">เช็ค ${hm(new Date(at))} น.</span>` : ""}</div></div></span>
        <span class="qty" data-noclick>
          <button type="button" data-d="-1" aria-label="ลดจำนวน">−</button>
          <input type="number" inputmode="numeric" min="0" value="${qv}" aria-label="จำนวน ${esc(p.name)}">
          <button type="button" data-d="1" aria-label="เพิ่มจำนวน">+</button>
        </span></div>`;
    }).join("");
  }
  renderProgress();
}
function renderProgress(){
  const all = scope();
  const done = all.filter(p => S.checks[p.id]).length;
  const totalChecked = Object.keys(S.checks).length;
  const ao = activeOrder();
  const pct = all.length ? Math.round(done / all.length * 100) : 0;
  $("#progBar").style.width = (ao ? pct : Math.min(100, totalChecked ? 100 : 0)) + "%";
  $("#progText").textContent = ao ? `${done}/${all.length} รายการ` : `${totalChecked} รายการ`;
  $("#stCount").textContent = `${totalChecked} รายการ`;
  $("#stStart").textContent = S.startedAt ? hms(new Date(S.startedAt)) : "ยังไม่เริ่ม";
}
function toggle(id){
  if (S.checks[id]) delete S.checks[id];
  else { S.checks[id] = new Date().toISOString(); if (!S.startedAt) S.startedAt = S.checks[id]; }
  renderList();
}
$("#list").addEventListener("click", e => {
  const go = e.target.closest("[data-go]"); if (go) { show(go.dataset.go); return; }
  const z = e.target.closest("[data-zoom]"); if (z) { zoomImg(z.dataset.zoom, z.alt); return; }
  const item = e.target.closest(".item"); if (!item) return;
  const step = e.target.closest("[data-d]");
  if (step) {
    const p = S.products.find(x => x.id === item.dataset.id);
    const cur = S.qty[item.dataset.id] ?? p.qty;
    S.qty[item.dataset.id] = Math.max(0, cur + Number(step.dataset.d));
    item.querySelector("input").value = S.qty[item.dataset.id];
    return;
  }
  if (e.target.closest("[data-noclick]")) return;
  toggle(item.dataset.id);
});
$("#list").addEventListener("input", e => {
  const item = e.target.closest(".item"); if (!item || e.target.tagName !== "INPUT") return;
  S.qty[item.dataset.id] = Math.max(0, parseInt(e.target.value, 10) || 0);
});
$("#list").addEventListener("keydown", e => {
  const item = e.target.closest(".item");
  if (item && e.target === item && (e.key === " " || e.key === "Enter")) { e.preventDefault(); toggle(item.dataset.id); setTimeout(()=>{ const n = $(`.item[data-id="${item.dataset.id}"]`); n && n.focus(); }); }
});
$("#q").addEventListener("input", e => { S.q = e.target.value; renderList(); });
$("#filterSeg").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  S.filter = b.dataset.f;
  $$("#filterSeg button").forEach(x => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
  renderList();
});
$("#checkAll").addEventListener("click", () => {
  const now = new Date().toISOString();
  const vis = $$("#list .item").map(n => n.dataset.id);
  const allOn = vis.length && vis.every(id => S.checks[id]);
  vis.forEach(id => { if (allOn) delete S.checks[id]; else if (!S.checks[id]) S.checks[id] = now; });
  if (!allOn && vis.length && !S.startedAt) S.startedAt = now;
  renderList();
});

/* ---------- photos ---------- */
function renderPhotos(){
  const box = $("#photos");
  box.innerHTML = S.photos.map((p, i) => `<div class="ph"><img src="${p.url}" alt="รูปที่ ${i+1}"><button class="x" data-rm="${i}" aria-label="ลบรูป">✕</button></div>`).join("")
    + (S.photos.length < MAX_PHOTOS ? `
      <label class="addph" for="camInput" id="addCam" tabindex="0" role="button"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>ถ่ายรูป</label>
      <label class="addph" for="phInput" id="addFile" tabindex="0" role="button"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>เลือกจากเครื่อง</label>` : "")
    + (IS_TOUCH && HAS_WEBCAM && S.photos.length < MAX_PHOTOS ? `<button class="addph" type="button" id="addWebCam"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m23 7-7 5 7 5z"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>กล้องในเว็บ</button>` : "");
  $("#phCount").textContent = `${S.photos.length}/${MAX_PHOTOS}`;
}
$("#photos").addEventListener("click", e => {
  const rm = e.target.closest("[data-rm]");
  if (rm) { const p = S.photos.splice(+rm.dataset.rm, 1)[0]; URL.revokeObjectURL(p.url); renderPhotos(); return; }
  // computers: capture="environment" is ignored and only opens a file picker, so use the webcam inside the page
  if (e.target.closest("#addCam") && !IS_TOUCH && HAS_WEBCAM) { e.preventDefault(); openCamera(); return; }
  if (e.target.closest("#addWebCam")) { openCamera(); return; }
  const img = e.target.closest(".ph img");
  if (img) modal(`<div class="lightbox"><img src="${img.src}" alt=""></div><div class="acts"><button class="btn btn-ghost" data-close>ปิด</button></div>`);
});
function loadImage(file){
  return new Promise((res, rej) => { const u = URL.createObjectURL(file); const im = new Image(); im.onload = () => { res(im); URL.revokeObjectURL(u); }; im.onerror = () => { rej(new Error("อ่านรูปไม่ได้")); URL.revokeObjectURL(u); }; im.src = u; });
}
async function processPhoto(file){
  const im = await loadImage(file);
  const max = 1600, r = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
  const w = Math.round(im.naturalWidth * r), h = Math.round(im.naturalHeight * r);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d"); x.drawImage(im, 0, 0, w, h);
  // timestamp stamp
  const d = new Date(); const fs = Math.max(16, Math.round(w / 38));
  const text = `QC ${thDate(d)} ${hms(d)}`;
  x.font = `600 ${fs}px "IBM Plex Sans Thai", sans-serif`;
  const tw = x.measureText(text).width, padd = fs * .6;
  x.fillStyle = "rgba(11,79,58,.78)";
  x.fillRect(w - tw - padd * 3, h - fs - padd * 3, tw + padd * 2, fs + padd * 2);
  x.fillStyle = "#fff"; x.textBaseline = "middle";
  x.fillText(text, w - tw - padd * 2, h - fs / 2 - padd * 2);
  const blob = await new Promise(r2 => c.toBlob(r2, "image/jpeg", .82));
  return { blob, url: URL.createObjectURL(blob), w, h };
}
async function addFiles(files){
  const list = Array.from(files).filter(f => f.type.startsWith("image/") || /\.(jpe?g|png|heic|webp)$/i.test(f.name));
  for (const f of list) {
    if (S.photos.length >= MAX_PHOTOS) { toast(`แนบรูปได้สูงสุด ${MAX_PHOTOS} รูป`, true); break; }
    try { S.photos.push(await processPhoto(f)); } catch (err) { toast("เปิดรูปนี้ไม่ได้ ลองถ่ายใหม่หรือใช้ไฟล์ JPG/PNG", true); }
  }
  renderPhotos();
}
$("#photos").addEventListener("keydown", e => { const l = e.target.closest("label.addph"); if (l && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); l.click(); } });
$("#phInput").addEventListener("change", e => { addFiles(e.target.files); e.target.value = ""; });
$("#camInput").addEventListener("change", e => { addFiles(e.target.files); e.target.value = ""; });

/* in-page camera (getUserMedia) */
let camFacing = "environment";
async function openCamera(){
  if (S.photos.length >= MAX_PHOTOS) { toast(`แนบรูปได้สูงสุด ${MAX_PHOTOS} รูป`, true); return; }
  modal(`<h2>ถ่ายรูปก่อนจัดส่ง</h2><div class="cam"><video id="camVideo" autoplay playsinline muted></video><div class="flash" id="camFlash"></div></div>
    <p class="hint" id="camMsg" style="margin-top:8px">กำลังเปิดกล้อง… ถ้าเบราว์เซอร์ถาม ให้กด “อนุญาต”</p>
    <div class="camacts"><button class="btn btn-ghost" type="button" id="camFlip" hidden>สลับกล้อง</button>
    <button class="shutter" type="button" id="camSnap" aria-label="ถ่ายรูป" disabled></button>
    <button class="btn btn-primary" type="button" data-close>เสร็จ</button></div>`);
  $("#camSnap").onclick = snapCamera;
  $("#camFlip").onclick = () => { camFacing = camFacing === "environment" ? "user" : "environment"; startCamera(); };
  await startCamera();
}
async function startCamera(){
  stopCamera();
  const msg = $("#camMsg");
  try {
    camStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: camFacing }, width: { ideal: 1920 }, height: { ideal: 1440 } } });
    const v = $("#camVideo"); if (!v) { stopCamera(); return; }
    v.srcObject = camStream; await v.play().catch(() => {});
    $("#camSnap").disabled = false;
    msg.textContent = `กดปุ่มวงกลมเพื่อถ่าย (แนบแล้ว ${S.photos.length}/${MAX_PHOTOS})`;
    try { const cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === "videoinput"); $("#camFlip").hidden = cams.length < 2; } catch (e) {}
  } catch (err) {
    const n = err && err.name;
    msg.innerHTML = n === "NotAllowedError" || n === "SecurityError"
      ? "เบราว์เซอร์ไม่ได้อนุญาตให้ใช้กล้อง: กดไอคอนแม่กุญแจ/กล้องที่แถบที่อยู่ แล้วเลือก “อนุญาต” จากนั้นกดถ่ายรูปอีกครั้ง"
      : n === "NotFoundError" || n === "OverconstrainedError" ? "ไม่พบกล้องในเครื่องนี้ ใช้ปุ่ม “เลือกจากเครื่อง” แทน"
      : n === "NotReadableError" ? "กล้องถูกโปรแกรมอื่นใช้อยู่ ปิดโปรแกรมนั้น (เช่น Zoom, LINE) แล้วลองใหม่"
      : "เปิดกล้องไม่ได้ (" + esc(n || err) + ") ลองเปิดเว็บใน Chrome หรือ Safari";
    msg.classList.add("warnhint");
  }
}
async function snapCamera(){
  const v = $("#camVideo"); if (!v || !v.videoWidth) return;
  const c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight;
  c.getContext("2d").drawImage(v, 0, 0);
  const f = $("#camFlash"); f.classList.add("on"); setTimeout(() => f.classList.remove("on"), 30);
  const blob = await new Promise(r => c.toBlob(r, "image/jpeg", .92));
  try { S.photos.push(await processPhoto(blob)); renderPhotos(); } catch (e) { toast("บันทึกรูปไม่สำเร็จ", true); return; }
  if (S.photos.length >= MAX_PHOTOS) { closeModal(); toast(`ถ่ายครบ ${MAX_PHOTOS} รูปแล้ว`); return; }
  $("#camMsg").textContent = `ถ่ายแล้ว ${S.photos.length}/${MAX_PHOTOS} รูป ถ่ายต่อได้ หรือกด “เสร็จ”`;
}
document.addEventListener("visibilitychange", () => { if (document.hidden && camStream) closeModal(); });
if (IS_TOUCH && HAS_WEBCAM) $("#phHint").textContent = "รูปจะถูกประทับวันเวลาที่มุมล่างให้อัตโนมัติ · ถ้ากด “ถ่ายรูป” แล้วกล้องไม่ขึ้น ให้ใช้ปุ่ม “กล้องในเว็บ” แทน";
if (/\bLine\/|FBAN|FBAV|FB_IAB|Instagram|MicroMessenger/i.test(navigator.userAgent)) $("#inappHint").hidden = false;
renderPhotos();

/* ---------- signature ---------- */
const sig = { c: $("#sig"), strokes: [], cur: null, w: 0, h: 0 };
const sctx = sig.c.getContext("2d");
function sigResize(){
  const r = sig.c.getBoundingClientRect(); if (!r.width) return;
  if (Math.round(r.width) === sig.w && Math.round(r.height) === sig.h) return;
  sig.w = Math.round(r.width); sig.h = Math.round(r.height);
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  sig.c.width = sig.w * dpr; sig.c.height = sig.h * dpr;
  sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  sigRedraw();
}
function drawStroke(ctx, st, w, h){
  if (!st.length) return;
  ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#0b2f4f"; ctx.lineWidth = Math.max(2.2, w / 220);
  ctx.beginPath(); ctx.moveTo(st[0][0] * w, st[0][1] * h);
  if (st.length === 1) { ctx.lineTo(st[0][0] * w + .1, st[0][1] * h + .1); }
  for (let i = 1; i < st.length - 1; i++) {
    const mx = (st[i][0] + st[i+1][0]) / 2 * w, my = (st[i][1] + st[i+1][1]) / 2 * h;
    ctx.quadraticCurveTo(st[i][0] * w, st[i][1] * h, mx, my);
  }
  if (st.length > 1) ctx.lineTo(st[st.length-1][0] * w, st[st.length-1][1] * h);
  ctx.stroke();
}
function sigRedraw(){ sctx.clearRect(0, 0, sig.w, sig.h); sig.strokes.forEach(s => drawStroke(sctx, s, sig.w, sig.h)); $("#sigph").style.display = sig.strokes.length ? "none" : ""; }
function pt(e){ const r = sig.c.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; }
sig.c.addEventListener("pointerdown", e => { e.preventDefault(); sigResize(); sig.c.setPointerCapture(e.pointerId); sig.cur = [pt(e)]; sig.strokes.push(sig.cur); sigRedraw(); });
sig.c.addEventListener("pointermove", e => { if (!sig.cur) return; e.preventDefault(); const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e]; evs.forEach(ev => sig.cur.push(pt(ev))); sigRedraw(); });
["pointerup","pointercancel","pointerleave"].forEach(t => sig.c.addEventListener(t, () => { sig.cur = null; }));
$("#sigClear").addEventListener("click", () => { sig.strokes = []; sigRedraw(); });
$("#sigUndo").addEventListener("click", () => { sig.strokes.pop(); sigRedraw(); });
new ResizeObserver(() => sigResize()).observe(sig.c);
function sigExport(){
  const w = 600, h = 200, c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, w, h);
  sig.strokes.forEach(s => drawStroke(x, s, w, h));
  return c.toDataURL("image/png");
}

/* ---------- save ---------- */
function blobToDataURL(b){ return new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); }); }
async function shrink(blob, max, q){
  const im = await loadImage(blob); const r = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
  const c = document.createElement("canvas"); c.width = Math.round(im.naturalWidth * r); c.height = Math.round(im.naturalHeight * r);
  c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", q);
}
async function photosForRecord(){
  const out = [];
  if (S.mode === "sheets") { for (const p of S.photos) out.push({ data: await blobToDataURL(p.blob) }); return out; }
  if (S.assets) {
    try {
      for (const p of S.photos) { const a = await S.assets.upload(p.blob); out.push({ id: a.id, url: a.url }); }
      return out;
    } catch (err) { out.length = 0; }
  }
  // fallback: inline small JPEGs so the record stays under the document size cap
  let max = 900, q = .6;
  for (let attempt = 0; attempt < 3; attempt++) {
    out.length = 0;
    for (const p of S.photos) out.push({ data: await shrink(p.blob, max, q) });
    const size = out.reduce((a, b) => a + b.data.length, 0);
    if (size < 190000) break;
    max = Math.round(max * .7); q = Math.max(.45, q - .08);
  }
  return out;
}
function makeId(d){ return `QC-${String(d.getFullYear()).slice(2)}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-${Math.random().toString(36).slice(2,5).toUpperCase()}`; }

$("#saveBtn").addEventListener("click", async () => {
  const orderNo = $("#orderNo").value.trim(), inspector = $("#inspector").value.trim();
  const checkedIds = Object.keys(S.checks);
  const problems = [];
  if (!orderNo) problems.push("กรอกเลขออร์เดอร์");
  if (!inspector) problems.push("กรอกชื่อผู้ตรวจ QC");
  if (S.channel === OTHER && !$("#channelOther").value.trim()) problems.push("ระบุช่องทางการขาย (อื่นๆ) ว่าเป็นช่องทางไหน");
  if (!checkedIds.length) problems.push("เช็คสินค้าอย่างน้อย 1 รายการ");
  if (!S.photos.length) problems.push("แนบรูปถ่ายก่อนจัดส่งอย่างน้อย 1 รูป");
  if (!sig.strokes.length) problems.push("เซ็นลายเซ็นผู้ตรวจ");
  if (problems.length) {
    modal(`<h2>ยังบันทึกไม่ได้</h2><p class="hint" style="font-size:.95rem">กรุณาทำให้ครบก่อน:</p><ul>${problems.map(p => `<li>${esc(p)}</li>`).join("")}</ul><div class="acts"><button class="btn btn-primary" data-close>ตกลง</button></div>`);
    return;
  }
  const ao = activeOrder();
  const expected = ao ? scope() : null;
  const missing = expected ? expected.filter(p => !S.checks[p.id]) : [];
  if (missing.length) {
    const ok = await confirmBox("สินค้ายังเช็คไม่ครบ", `ออร์เดอร์นี้ยังไม่ได้เช็ค ${missing.length} รายการ: ${missing.slice(0,5).map(p => esc(p.name)).join(", ")}${missing.length > 5 ? " …" : ""}<br>ต้องการบันทึกเป็นสถานะ “ไม่ครบ” หรือไม่?`, "บันทึกว่าไม่ครบ", true);
    if (!ok) return;
  }
  const btn = $("#saveBtn"); btn.disabled = true; const label = btn.innerHTML; btn.textContent = S.mode === "sheets" ? "กำลังส่งไป Google Sheets…" : "กำลังบันทึก…";
  try {
    const now = new Date();
    const items = S.products.filter(p => S.checks[p.id]).map(p => ({ code: p.code, name: p.name, unit: p.unit, qty: S.qty[p.id] ?? p.qty, expected: ao ? p.qty : null, checkedAt: S.checks[p.id] }));
    const rec = {
      id: makeId(now), orderNo, inspector, channel: channelValue(), customer: $("#customer").value.trim(), tracking: $("#tracking").value.trim(),
      note: $("#note").value.trim(), items, itemCount: items.length, expectedCount: expected ? expected.length : null,
      missing: missing.map(p => ({ code: p.code, name: p.name, qty: p.qty })),
      status: expected ? (missing.length ? "incomplete" : "complete") : "checked",
      createdAt: now.toISOString(), startedAt: S.startedAt, device: deviceType(), appVersion: APP_VERSION,
      signature: sigExport(), photos: await photosForRecord()
    };
    await saveRecord(rec);
    lsSet("qc_inspector", inspector);
    const thumbs = S.photos.map(p => p.url);
    modal(`<div style="text-align:center"><div class="big-ok"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></div>
      <h2>บันทึกผลตรวจเรียบร้อย</h2><p class="hint">${esc(rec.id)}</p></div>
      <div class="kv"><div><small>ออร์เดอร์</small><b>${esc(orderNo)}</b></div><div><small>วันที่ / เวลา</small><b class="num">${thDate(now)} ${hms(now)}</b></div>
      <div><small>รายการที่เช็ค</small><b class="num">${items.length}${expected ? " / " + expected.length : ""}</b></div><div><small>สถานะ</small><b>${statusLabel(rec.status)}</b></div></div>
      <div class="acts"><button class="btn btn-ghost" id="goHist">ดูประวัติ</button><button class="btn btn-primary" id="nextOrder">ตรวจออร์เดอร์ถัดไป</button></div>`);
    $("#goHist").onclick = () => { closeModal(); resetForm(); show("history"); };
    $("#nextOrder").onclick = () => { closeModal(); resetForm(); $("#orderNo").focus(); };
  } catch (err) {
    console.error(err);
    toast(err && err.code === "quota_exceeded" ? "พื้นที่เก็บข้อมูลเต็ม ลบประวัติเก่าบางส่วนแล้วลองใหม่" : "บันทึกไม่สำเร็จ ลองอีกครั้ง (" + (err && (err.code || err.message) || "error") + ")", true);
  } finally { btn.disabled = false; btn.innerHTML = label; }
});
function resetForm(){
  S.checks = {}; S.qty = {}; S.startedAt = null; S.channel = "";
  $("#channelOther").value = ""; $("#channelOther").hidden = true;
  S.photos.forEach(p => URL.revokeObjectURL(p.url)); S.photos = [];
  sig.strokes = []; sigRedraw();
  ["#orderNo","#customer","#tracking","#note","#q"].forEach(s => $(s).value = ""); S.q = "";
  $$("#channels .chip").forEach(x => x.setAttribute("aria-pressed", "false"));
  renderPhotos(); renderList();
}
$("#resetBtn").addEventListener("click", async () => {
  if (Object.keys(S.checks).length || S.photos.length || sig.strokes.length) {
    if (!await confirmBox("เริ่มออร์เดอร์ใหม่?", "ข้อมูลที่ยังไม่ได้บันทึกของออร์เดอร์นี้จะหายไป", "ล้างและเริ่มใหม่", true)) return;
  }
  resetForm();
});

/* ---------- history ---------- */
const statusLabel = s => s === "complete" ? "ครบตามออร์เดอร์" : s === "incomplete" ? "ไม่ครบ" : "ตรวจแล้ว";
const photoSrc = p => p.data || p.thumb || p.url || (p.id ? "/_blob/" + p.id : "");
const photoLink = p => p.data || p.url || p.thumb || (p.id ? "/_blob/" + p.id : "");
function filteredRecords(){
  const q = $("#hq").value.trim().toLowerCase(), d = $("#hdate").value;
  return S.records.filter(r => {
    if (d && ymd(new Date(r.createdAt)) !== d) return false;
    if (q && !(`${r.orderNo} ${r.inspector} ${r.customer} ${r.tracking} ${r.id} ${r.channel}`.toLowerCase().includes(q))) return false;
    return true;
  });
}
function renderHistory(){
  const today = ymd(new Date());
  const td = S.records.filter(r => ymd(new Date(r.createdAt)) === today);
  $("#tToday").textContent = td.length;
  $("#tItems").textContent = td.reduce((n, r) => n + (Number(r.itemCount) || 0), 0);
  $("#tPeople").textContent = new Set(td.map(r => String(r.inspector || "").trim()).filter(Boolean)).size;
  $("#tAll").textContent = S.records.length;
  $("#histBadge").textContent = S.records.length;
  const rs = filteredRecords();
  $("#recs").classList.toggle("selecting", S.selecting);
  $("#selbar").hidden = !S.selecting;
  $("#hmanage").hidden = S.selecting;
  if (S.selecting) {
    [...S.sel].forEach(id => { if (!S.records.some(r => r.id === id)) S.sel.delete(id); });
    $("#selCount").textContent = `เลือก ${S.sel.size} รายการ`;
    $("#selDelete").disabled = !S.sel.size;
    $("#selDelete").textContent = S.sel.size ? `ลบที่เลือก (${S.sel.size})` : "ลบที่เลือก";
    $("#selAll").textContent = rs.length && rs.every(r => S.sel.has(r.id)) ? "ไม่เลือกทั้งหมด" : `เลือกทั้งหมดที่แสดง (${rs.length})`;
  }
  $("#recs").innerHTML = rs.length ? rs.map(r => {
    const d = new Date(r.createdAt); const ph = (r.photos || [])[0];
    return `<article class="rec ${r.status === "incomplete" ? "incomplete" : ""}${S.sel.has(r.id) ? " sel" : ""}" data-rid="${esc(r.id)}" tabindex="0">
      <span class="selbox" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>
      ${ph ? `<img class="th" src="${esc(photoSrc(ph))}" alt="" loading="lazy">` : `<div class="th"></div>`}
      <div style="min-width:0"><h3>#${esc(r.orderNo)}</h3>
      <div class="pills"><span class="pill ${r.status === "incomplete" ? "warn" : ""}">${statusLabel(r.status)}</span>${r.channel ? `<span class="pill ch">${esc(r.channel)}</span>` : ""}<span class="pill ch num">${r.itemCount}${r.expectedCount ? "/" + r.expectedCount : ""} รายการ</span></div>
      <div class="meta num">${thDate(d)} · ${hms(d)} น. · ${esc(r.inspector)}</div></div></article>`;
  }).join("") : `<div class="empty" style="grid-column:1/-1"><h3>${S.records.length ? "ไม่พบรายการตามตัวกรอง" : "ยังไม่มีประวัติการตรวจ"}</h3><p>${S.records.length ? "ลองล้างตัวกรอง" : "ผลตรวจที่บันทึกแล้วจะแสดงที่นี่"}</p></div>`;
}
["#hq","#hdate"].forEach(s => $(s).addEventListener("input", renderHistory));
$("#hclear").addEventListener("click", () => { $("#hq").value = ""; $("#hdate").value = ""; renderHistory(); });
function recActivate(id){
  if (!S.selecting) { openRecord(id); return; }
  S.sel.has(id) ? S.sel.delete(id) : S.sel.add(id);
  renderHistory();
  const n = $(`[data-rid="${CSS.escape(id)}"]`); n && n.focus();
}
$("#recs").addEventListener("click", e => { const a = e.target.closest("[data-rid]"); if (a) recActivate(a.dataset.rid); });
$("#recs").addEventListener("keydown", e => { const a = e.target.closest("[data-rid]"); if (a && (e.key === "Enter" || (S.selecting && e.key === " "))) { e.preventDefault(); recActivate(a.dataset.rid); } });
$("#hmanage").addEventListener("click", async () => {
  if (!S.records.length) { toast("ยังไม่มีข้อมูลให้ลบ", true); return; }
  if (S.mode === "sheets" && !S.pin) { const pin = await askPin("ใส่รหัสผู้ดูแลเพื่อเลือกและลบข้อมูลผลตรวจ"); if (!pin) return; }
  S.selecting = true; S.sel.clear(); renderHistory();
  toast("แตะรายการที่ต้องการลบ แล้วกด “ลบที่เลือก”");
});
$("#selCancel").addEventListener("click", () => { S.selecting = false; S.sel.clear(); renderHistory(); });
$("#selAll").addEventListener("click", () => {
  const rs = filteredRecords();
  if (rs.length && rs.every(r => S.sel.has(r.id))) rs.forEach(r => S.sel.delete(r.id)); else rs.forEach(r => S.sel.add(r.id));
  renderHistory();
});
$("#selDelete").addEventListener("click", async () => {
  const ids = [...S.sel]; if (!ids.length) return;
  const names = S.records.filter(r => S.sel.has(r.id)).slice(0, 5).map(r => "#" + esc(r.orderNo)).join(", ");
  if (!await confirmBox(`ลบ ${ids.length} รายการ?`, `${names}${ids.length > 5 ? " …" : ""}<br>ข้อมูลจะถูกลบออกจาก Google Sheets (QC_Records และ QC_Items) และกู้คืนจากหน้าเว็บไม่ได้${S.mode === "sheets" ? "<br>รูปและลายเซ็นใน Google Drive จะถูกย้ายไปถังขยะ (กู้คืนได้ภายใน 30 วัน)" : ""}`, `ลบ ${ids.length} รายการ`, true)) return;
  const btn = $("#selDelete"); btn.disabled = true; btn.textContent = "กำลังลบ…";
  try {
    const n = await deleteRecords(ids);
    S.selecting = false; S.sel.clear(); renderHistory();
    toast(`ลบแล้ว ${n} รายการ`);
  } catch (err) { renderHistory(); toast("ลบไม่สำเร็จ: " + (err.message || err.code || "error"), true); }
});
function openRecord(id){
  const r = S.records.find(x => x.id === id); if (!r) return;
  const d = new Date(r.createdAt), st = r.startedAt ? new Date(r.startedAt) : null;
  modal(`<div class="card-head" style="margin-bottom:0"><h2>ออร์เดอร์ #${esc(r.orderNo)}</h2><span class="pill ${r.status === "incomplete" ? "warn" : ""}">${statusLabel(r.status)}</span></div>
    <p class="hint">${esc(r.id)}</p>
    <div class="kv">
      <div><small>วันที่</small><b>${thDateLong(d)}</b></div>
      <div><small>เวลาบันทึก</small><b class="num">${hms(d)} น.</b></div>
      ${st ? `<div><small>เริ่มเช็ค</small><b class="num">${hms(st)} น.</b></div>` : ""}
      <div><small>ผู้ตรวจ QC</small><b>${esc(r.inspector)}</b></div>
      ${r.channel ? `<div><small>ช่องทาง</small><b>${esc(r.channel)}</b></div>` : ""}
      ${r.customer ? `<div><small>ลูกค้า</small><b>${esc(r.customer)}</b></div>` : ""}
      ${r.tracking ? `<div><small>เลขพัสดุ</small><b>${esc(r.tracking)}</b></div>` : ""}
      <div><small>อุปกรณ์</small><b>${esc(r.device || "-")}</b></div>
    </div>
    <h3 style="font-size:1rem;margin:6px 0 8px">รายการที่เช็ค (${r.itemCount})</h3>
    <div class="tablewrap"><table><thead><tr><th>รหัส</th><th>สินค้า</th><th class="r">จำนวน</th><th>เวลาเช็ค</th></tr></thead><tbody>
      ${(r.items || []).map(i => `<tr><td>${esc(i.code)}</td><td>${esc(i.name)}</td><td class="r num">${i.qty}${i.expected != null && i.expected !== i.qty ? ` <span class="pill warn">ต้องมี ${i.expected}</span>` : ""} ${esc(i.unit)}</td><td class="num">${i.checkedAt ? hm(new Date(i.checkedAt)) : "-"}</td></tr>`).join("")}
    </tbody></table></div>
    ${(r.missing || []).length ? `<h3 style="font-size:1rem;margin:14px 0 8px;color:#8a5600">ยังไม่ได้เช็ค (${r.missing.length})</h3><ul style="margin:0">${r.missing.map(m => `<li>${esc(m.name)} ${m.code ? "(" + esc(m.code) + ")" : ""} × ${m.qty}</li>`).join("")}</ul>` : ""}
    ${r.note ? `<h3 style="font-size:1rem;margin:14px 0 6px">หมายเหตุ</h3><p style="margin:0">${esc(r.note)}</p>` : ""}
    <h3 style="font-size:1rem;margin:14px 0 8px">รูปถ่ายก่อนจัดส่ง</h3>
    <div class="photos">${(r.photos || []).map(p => `<div class="ph"><a href="${esc(photoLink(p))}" target="_blank" rel="noopener"><img src="${esc(photoSrc(p))}" alt="รูปก่อนจัดส่ง"></a></div>`).join("") || `<p class="hint">ไม่มีรูป</p>`}</div>
    <h3 style="font-size:1rem;margin:14px 0 8px">ลายเซ็นผู้ตรวจ</h3>
    ${r.signature ? `<img class="sigimg" src="${esc(r.signature)}" alt="ลายเซ็น ${esc(r.inspector)}">` : "-"}
    <div class="acts"><button class="btn btn-danger" id="delRec">ลบบันทึกนี้ (ผู้ดูแล)</button><button class="btn btn-primary" data-close>ปิด</button></div>`);
  $("#delRec").onclick = async () => {
    if (!await confirmBox("ลบบันทึกนี้?", `ลบผลตรวจออร์เดอร์ #${esc(r.orderNo)} ออกจากระบบ กู้คืนจากหน้าเว็บไม่ได้${S.mode === "sheets" ? "<br>รูปและลายเซ็นใน Google Drive จะถูกย้ายไปถังขยะ (กู้คืนได้ภายใน 30 วัน)" : ""}`, "ลบ", true)) return;
    try { if (await deleteRecord(r.id)) toast("ลบแล้ว"); } catch (err) { toast("ลบไม่สำเร็จ: " + (err.message || err.code || "คุณอาจไม่มีสิทธิ์แก้ไข"), true); }
  };
}

/* ---------- export ---------- */
const HEAD = ["รหัสบันทึก","วันที่","เวลา","เลขออร์เดอร์","ช่องทาง","ลูกค้า","เลขพัสดุ","ผู้ตรวจ QC","สถานะ","จำนวนรายการที่เช็ค","จำนวนที่ต้องมี","รายการสินค้า","ยังไม่ได้เช็ค","หมายเหตุ","จำนวนรูป","อุปกรณ์","เวลาเริ่มเช็ค"];
function rowsForExport(){
  return filteredRecords().map(r => { const d = new Date(r.createdAt); return [
    r.id, ymd(d), hms(d), r.orderNo, r.channel, r.customer, r.tracking, r.inspector, statusLabel(r.status), r.itemCount, r.expectedCount ?? "",
    (r.items || []).map(i => `${i.code ? i.code + " " : ""}${i.name} x${i.qty}`).join("; "),
    (r.missing || []).map(i => `${i.name} x${i.qty}`).join("; "),
    r.note, (r.photos || []).length, r.device, r.startedAt ? hms(new Date(r.startedAt)) : ""
  ]; });
}
const csvCell = v => { const s = String(v ?? ""); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
$("#dlCsv").addEventListener("click", async () => {
  const rows = rowsForExport(); if (!rows.length) { toast("ไม่มีข้อมูลให้ดาวน์โหลด", true); return; }
  const csv = "﻿" + [HEAD, ...rows].map(r => r.map(csvCell).join(",")).join("\r\n");
  const name = `qc-records-${ymd(new Date())}.csv`;
  if (S.downloads) {
    try { await S.downloads.save({ filename: name, data: csv }); toast("ดาวน์โหลดแล้ว"); return; }
    catch (err) { if (err && err.code === "declined") return; }
  }
  try { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], {type:"text/csv"})); a.download = name; a.click(); }
  catch (err) { toast("ดาวน์โหลดในหน้านี้ไม่ได้ ใช้ปุ่มคัดลอกไปวางใน Google Sheets แทน", true); }
});
$("#copySheet").addEventListener("click", async () => {
  const rows = rowsForExport(); if (!rows.length) { toast("ไม่มีข้อมูลให้คัดลอก", true); return; }
  const tsv = [HEAD, ...rows].map(r => r.map(v => String(v ?? "").replace(/[\t\r\n]+/g, " ")).join("\t")).join("\n");
  try { await navigator.clipboard.writeText(tsv); toast(`คัดลอก ${rows.length} แถวแล้ว เปิด Google Sheets แล้วกดวาง (Ctrl/⌘+V)`); }
  catch (err) {
    modal(`<h2>คัดลอกข้อมูล</h2><p class="hint">กดค้างหรือ Ctrl/⌘+A แล้วคัดลอก จากนั้นไปวางใน Google Sheets</p><textarea class="inp" style="min-height:220px;font-size:.8rem" readonly>${esc(tsv)}</textarea><div class="acts"><button class="btn btn-primary" data-close>ปิด</button></div>`);
    const ta = $("#sheet textarea"); ta.focus(); ta.select();
  }
});

/* ---------- products page ---------- */
function renderProducts(){
  $("#prodBadge").textContent = S.products.length;
  $("#prodCount").textContent = S.products.length + " รายการ";
  const os = orders();
  $("#orderList").innerHTML = os.map(o => `<option value="${esc(o)}"></option>`).join("");
  const q = $("#pq").value.trim().toLowerCase();
  const rows = S.products.filter(p => !q || `${p.name} ${p.code} ${p.order} ${p.category}`.toLowerCase().includes(q));
  $("#ptable").innerHTML = rows.length ? rows.slice(0, 500).map(p => `<tr><td>${thumb(p, "tthumb")}</td><td>${esc(p.code) || "-"}</td><td>${esc(p.name)}${p.category ? `<div class="hint">${esc(p.category)}</div>` : ""}</td><td class="r num">${p.qty}</td><td>${esc(p.unit) || "-"}</td><td>${esc(p.order) || "-"}</td>
    <td class="r"><div class="rowacts"><button class="btn btn-ghost btn-sm admin-only" data-img="${p.id}">${p.image ? "เปลี่ยนรูป" : "เพิ่มรูป"}</button><button class="btn btn-ghost btn-sm admin-only" data-del="${p.id}" aria-label="ลบ ${esc(p.name)}">ลบ</button></div></td></tr>`).join("")
    + (rows.length > 500 ? `<tr><td colspan="7" class="hint">แสดง 500 จาก ${rows.length} รายการ ใช้ช่องค้นหาเพื่อหาสินค้าอื่น</td></tr>` : "")
    : `<tr><td colspan="7"><div class="empty" style="margin:6px 0"><h3>ยังไม่มีสินค้า</h3><p>นำเข้าไฟล์ CSV / Excel หรือเพิ่มทีละรายการ</p></div></td></tr>`;
}
$("#pq").addEventListener("input", renderProducts);
let imgTarget = "";
$("#ptable").addEventListener("click", async e => {
  const z = e.target.closest("[data-zoom]"); if (z) { zoomImg(z.dataset.zoom, z.alt); return; }
  const ib = e.target.closest("[data-img]"); if (ib) { imgTarget = ib.dataset.img; $("#prodImgInput").click(); return; }
  const b = e.target.closest("[data-del]"); if (!b) return;
  await saveProducts(S.products.filter(p => p.id !== b.dataset.del));
});
$("#clearProducts").addEventListener("click", async () => {
  if (!S.products.length) return;
  if (await confirmBox("ลบสินค้าทั้งหมด?", `ลบ ${S.products.length} รายการออกจากระบบ ประวัติการตรวจที่บันทึกแล้วจะยังอยู่`, "ลบทั้งหมด", true)) { await saveProducts([]); toast("ลบรายการสินค้าแล้ว"); }
});
$("#importMode").addEventListener("click", e => {
  const b = e.target.closest(".chip"); if (!b) return; S.importMode = b.dataset.m;
  $$("#importMode .chip").forEach(x => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
});
$("#addForm").addEventListener("submit", async e => {
  e.preventDefault();
  const p = normProduct({ name: $("#aName").value, code: $("#aCode").value, qty: $("#aQty").value, unit: $("#aUnit").value, order: $("#aOrder").value });
  if (!p.name) return;
  const f = $("#aImg").files[0];
  if (f) { try { toast("กำลังอัปโหลดรูป…"); p.image = await uploadProductImage(f, p.code || p.name); } catch (err) { toast("อัปโหลดรูปไม่สำเร็จ: " + err.message, true); return; } }
  await saveProducts(mergeProducts(S.products, [p]));
  toast("เพิ่ม “" + p.name + "” แล้ว");
  ["#aName","#aCode","#aUnit","#aImg"].forEach(s => $(s).value = ""); $("#aQty").value = 1; $("#aName").focus();
});
async function resizeToDataURL(file, max, q){
  const im = await loadImage(file); const r = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
  const c = document.createElement("canvas"); c.width = Math.round(im.naturalWidth * r); c.height = Math.round(im.naturalHeight * r);
  c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", q);
}
/* product photo: Google Drive (sheets mode) or a small inline image elsewhere */
async function uploadProductImage(file, name){
  if (S.mode === "sheets") {
    const data = await resizeToDataURL(file, 900, .82);
    const j = await sheetsApi("uploadProductImage", { pin: S.pin, data, name });
    return j.url;
  }
  return await resizeToDataURL(file, 360, .7);
}
$("#prodImgInput").addEventListener("change", async e => {
  const f = e.target.files[0]; e.target.value = ""; if (!f || !imgTarget) return;
  const p = S.products.find(x => x.id === imgTarget); if (!p) return;
  try {
    toast("กำลังอัปโหลดรูป…");
    const url = await uploadProductImage(f, p.code || p.name);
    await saveProducts(S.products.map(x => x.id === p.id ? Object.assign({}, x, { image: url }) : x));
    toast("บันทึกรูปของ “" + p.name + "” แล้ว");
  } catch (err) { if (/รหัส/.test(err.message)) setPin(""); toast("อัปโหลดรูปไม่สำเร็จ: " + err.message, true); }
});
function mergeProducts(base, incoming){
  const map = new Map(base.map(p => [p.id, p]));
  incoming.forEach(p => map.set(p.id, p));
  return [...map.values()];
}

/* file import */
function parseCSV(text){
  const delim = (text.split(/\r?\n/)[0].match(/\t/g) || []).length > (text.split(/\r?\n/)[0].match(/,/g) || []).length ? "\t" : (text.split(/\r?\n/)[0].includes(";") && !text.split(/\r?\n/)[0].includes(",") ? ";" : ",");
  const rows = []; let row = [], cell = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) { if (c === '"') { if (text[i+1] === '"') { cell += '"'; i++; } else inQ = false; } else cell += c; }
    else if (c === '"') inQ = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i+1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
const MATCH = [
  ["code", /รหัส|sku|code|barcode|บาร์โค้ด|บาร์โค๊ด/i],
  ["order", /ออร์เดอร์|ออเดอร์|order|คำสั่งซื้อ/i],
  ["qty", /จำนวน|qty|quantity|pcs|amount/i],
  ["unit", /หน่วย|unit|uom/i],
  ["category", /หมวด|ประเภท|category|type|กลุ่ม/i],
  ["image", /รูป|ภาพ|image|photo|picture|img/i],
  ["name", /ชื่อ|สินค้า|name|product|item|รายการ|description|title/i]
];
function mapRows(rows){
  rows = rows.map(r => r.map(c => String(c ?? "").trim())).filter(r => r.some(Boolean));
  if (!rows.length) return [];
  const head = rows[0].map(h => h.toLowerCase());
  const idx = {};
  MATCH.forEach(([k, re]) => { const i = head.findIndex((h, j) => re.test(h) && !Object.values(idx).includes(j)); if (i >= 0) idx[k] = i; });
  let body = rows.slice(1);
  if (idx.name === undefined) {
    // no recognisable header: guess by position
    body = rows;
    if (rows[0].length === 1) idx.name = 0;
    else { idx.code = 0; idx.name = 1; if (rows[0].length > 2) idx.qty = 2; if (rows[0].length > 3) idx.unit = 3; }
  }
  return body.map(r => normProduct({ code: r[idx.code], name: r[idx.name], qty: r[idx.qty], unit: r[idx.unit], order: r[idx.order], category: r[idx.category], image: r[idx.image] })).filter(p => p.name);
}
async function importFile(file){
  const n = file.name.toLowerCase(); const buf = await file.arrayBuffer();
  let rows;
  if (/\.(csv|txt|tsv)$/.test(n)) {
    let text; try { text = new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch (e) { text = new TextDecoder("windows-874").decode(buf); }
    rows = parseCSV(text.replace(/^﻿/, ""));
  } else {
    if (!window.XLSX) throw new Error("ตัวอ่านไฟล์ Excel โหลดไม่สำเร็จ ลองบันทึกไฟล์เป็น CSV แล้วนำเข้าใหม่");
    const wb = XLSX.read(buf, { type: "array" });
    rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: false });
  }
  const items = mapRows(rows);
  if (!items.length) throw new Error("ไม่พบรายการสินค้าในไฟล์ ตรวจว่ามีคอลัมน์ชื่อสินค้า");
  const next = S.importMode === "replace" ? mergeProducts([], items) : mergeProducts(S.products, items);
  await saveProducts(next);
  toast(`นำเข้า ${items.length} รายการจาก ${file.name} แล้ว`);
}
async function handleFiles(files){
  for (const f of files) { try { await importFile(f); } catch (err) { toast(err.message || "นำเข้าไฟล์ไม่สำเร็จ", true); } }
}
$("#fileInput").addEventListener("change", e => { handleFiles(Array.from(e.target.files)); e.target.value = ""; });
const drop = $("#drop");
["dragenter","dragover"].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave","drop"].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop", e => handleFiles(Array.from(e.dataTransfer.files)));
$("#dlTemplate").addEventListener("click", async () => {
  const csv = "﻿รหัสสินค้า,ชื่อสินค้า,จำนวน,หน่วย,เลขออร์เดอร์,หมวดหมู่,รูปสินค้า\r\nSKU-001,ตัวอย่าง สินค้า A,2,ซอง,2611200001,หมวด 1,\r\nSKU-002,ตัวอย่าง สินค้า B,1,กล่อง,2611200001,หมวด 1,\r\nSKU-003,ตัวอย่าง สินค้า C,3,ชิ้น,2611200002,หมวด 2,\r\n";
  if (S.downloads) { try { await S.downloads.save({ filename: "qc-product-template.csv", data: csv }); return; } catch (err) { if (err && err.code === "declined") return; } }
  try { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], {type:"text/csv"})); a.download = "qc-product-template.csv"; a.click(); }
  catch (err) { toast("ดาวน์โหลดไม่ได้ในหน้านี้", true); }
});

/* ---------- storage layer: Google Sheets (config.js) > shared Claude db > this browser ---------- */
function setSync(text, local){ const s = $("#sync"); s.classList.toggle("local", !!local); s.querySelector("span").textContent = text; $("#footMode").textContent = text; }

async function sheetsApi(action, payload){
  const url = new URL(CFG.SHEETS_URL);
  let res;
  if (payload === undefined) {
    url.searchParams.set("action", action);
    if (CFG.API_KEY) url.searchParams.set("key", CFG.API_KEY);
    res = await fetch(url.toString(), { redirect: "follow" });
  } else {
    // text/plain keeps this a "simple" request, so Apps Script needs no CORS preflight
    res = await fetch(url.toString(), { method: "POST", redirect: "follow", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(Object.assign({ action, key: CFG.API_KEY, appVersion: APP_VERSION }, payload)) });
  }
  if (!res.ok) throw new Error("Google Sheets ตอบกลับ HTTP " + res.status);
  const j = await res.json();
  if (!j.ok) throw new Error(j.error || "Google Sheets แจ้งข้อผิดพลาด");
  return j;
}
async function sheetsPull(){
  setSync("กำลังดึงข้อมูลจาก Google Sheets…", true);
  try {
    const [p, r] = await Promise.all([sheetsApi("products"), sheetsApi("records")]);
    S.products = (p.products || []).map(normProduct);
    S.records = r.records || [];
    lsSet("qc_products", S.products);
    setSync("เชื่อม Google Sheets แล้ว", false);
  } catch (err) {
    console.error(err);
    setSync("ต่อ Google Sheets ไม่ได้ ใช้ข้อมูลล่าสุดในเครื่อง", true);
    toast("ดึงข้อมูลจาก Google Sheets ไม่ได้: " + err.message, true);
  }
  renderAll(); renderHistory();
}

async function saveProducts(list){
  const prev = S.products; S.products = list; renderAll();
  if (S.mode === "sheets") {
    try { await sheetsApi("saveProducts", { products: list, pin: S.pin }); lsSet("qc_products", list); }
    catch (err) { S.products = prev; renderAll(); if (/รหัส/.test(err.message)) setPin(""); toast("บันทึกรายการสินค้าไม่สำเร็จ: " + err.message, true); throw err; }
  } else if (S.mode === "db") {
    try { await S.db.doc("app/products").set({ items: list, updatedAt: new Date().toISOString() }); }
    catch (err) { S.products = prev; renderAll(); toast(err && err.code === "invalid_argument" ? "บันทึกไม่ได้: รายการสินค้ายาวเกินไปหรือคุณไม่มีสิทธิ์แก้ไข" : "บันทึกรายการสินค้าไม่สำเร็จ", true); throw err; }
  } else if (!lsSet("qc_products", list)) toast("เก็บรายการสินค้าในเครื่องไม่ได้", true);
}
async function saveRecord(rec){
  if (S.mode === "sheets") {
    const j = await sheetsApi("saveRecord", { record: rec });
    S.records = [j.record || rec, ...S.records.filter(r => r.id !== rec.id)];
    renderHistory();
  } else if (S.mode === "db") { await S.db.collection("qc_records").doc(rec.id).set(rec); }
  else {
    const list = [rec, ...S.records];
    if (!lsSet("qc_records", list)) throw new Error("พื้นที่ในเครื่องเต็ม");
    S.records = list; renderHistory();
  }
}
async function deleteRecord(id){
  if (S.mode === "sheets") {
    const pin = S.pin || await askPin("ใส่รหัสผู้ดูแลเพื่อลบบันทึกนี้");
    if (!pin) return false;
    try { await sheetsApi("deleteRecord", { id, pin }); }
    catch (err) { if (/รหัส/.test(err.message)) setPin(""); throw err; }
    S.records = S.records.filter(r => r.id !== id); renderHistory(); }
  else if (S.mode === "db") await S.db.doc("qc_records/" + id).delete();
  else { S.records = S.records.filter(r => r.id !== id); lsSet("qc_records", S.records); renderHistory(); }
  closeModal();
  return true;
}
async function deleteRecords(ids){
  let n = ids.length;
  if (S.mode === "sheets") {
    if (!S.pin && !await askPin("ใส่รหัสผู้ดูแลเพื่อลบข้อมูล")) throw new Error("ยกเลิกแล้ว");
    try { const j = await sheetsApi("deleteRecords", { ids, pin: S.pin }); n = j.deleted; }
    catch (err) { if (/รหัส/.test(err.message)) { setPin(""); S.selecting = false; } throw err; }
  } else if (S.mode === "db") {
    for (const id of ids) await S.db.doc("qc_records/" + id).delete();
  }
  const set = new Set(ids);
  S.records = S.records.filter(r => !set.has(r.id));
  if (S.mode === "local") lsSet("qc_records", S.records);
  return n;
}
/* ---------- admin PIN (checked by Apps Script, never stored in this code) ---------- */
function setPin(pin){
  S.pin = pin || "";
  try { pin ? sessionStorage.setItem("qc_pin", pin) : sessionStorage.removeItem("qc_pin"); } catch (e) {}
  renderLock();
}
function renderLock(){
  const enforce = S.mode === "sheets";
  const open = !enforce || !!S.pin;
  $("#view-products").classList.toggle("locked", !open);
  const bar = $("#lockbar"); bar.hidden = !enforce; bar.classList.toggle("open", open);
  $("#lockTitle").textContent = open ? "ปลดล็อกแล้ว" : "รายการสินค้าถูกล็อก";
  $("#lockHint").textContent = open ? "นำเข้าไฟล์ เพิ่ม หรือลบสินค้าได้ กด “ล็อก” เมื่อทำเสร็จ" : "ใส่รหัสผู้ดูแลก่อน จึงจะนำเข้าไฟล์ เพิ่ม หรือลบสินค้าได้";
  $("#unlockForm").hidden = open; $("#lockBtn").hidden = !open;
}
async function verifyPin(pin){
  if (!pin) throw new Error("กรุณาใส่รหัสผู้ดูแล");
  await sheetsApi("verifyPin", { pin });
  setPin(pin);
}
$("#unlockForm").addEventListener("submit", async e => {
  e.preventDefault();
  const btn = $("#unlockBtn"); btn.disabled = true;
  try { await verifyPin($("#pinInput").value.trim()); $("#pinInput").value = ""; toast("ปลดล็อกแล้ว"); }
  catch (err) { toast(err.message, true); }
  finally { btn.disabled = false; }
});
$("#lockBtn").addEventListener("click", () => { setPin(""); toast("ล็อกรายการสินค้าแล้ว"); });
function askPin(msg){
  return new Promise(res => {
    modal(`<h2>ต้องใช้รหัสผู้ดูแล</h2><p class="hint" style="font-size:.95rem">${esc(msg)}</p>
      <form id="pinForm" autocomplete="off" style="margin-top:12px"><label class="sr" for="pinAsk">รหัสผู้ดูแล</label><input class="inp" id="pinAsk" type="password" autocomplete="off" placeholder="รหัสผู้ดูแล">
      <div class="acts"><button type="button" class="btn btn-ghost" id="pinNo">ยกเลิก</button><button type="submit" class="btn btn-primary">ยืนยัน</button></div></form>`);
    $("#pinAsk").focus();
    $("#pinNo").onclick = () => { closeModal(); res(""); };
    $("#pinForm").onsubmit = async e => {
      e.preventDefault();
      const pin = $("#pinAsk").value.trim();
      try { await verifyPin(pin); closeModal(); res(pin); } catch (err) { toast(err.message, true); }
    };
  });
}

function renderAll(){ renderLock(); renderProducts(); renderList(); }
$("#hrefresh").addEventListener("click", sheetsPull);

function useLocal(){
  S.mode = "local";
  S.products = lsGet("qc_products", []);
  S.records = lsGet("qc_records", []);
  setSync("บันทึกในเครื่องนี้", true);
  renderAll(); renderHistory();
}
async function init(){
  if (CFG.SHEETS_URL) {
    S.mode = "sheets";
    S.products = lsGet("qc_products", []);
    $("#hrefresh").hidden = false;
    renderAll(); renderHistory();
    await sheetsPull();
    return;
  }
  useLocal();
  if (!window.claude || !window.claude.use) return;
  let db = null;
  try { db = await window.claude.use("db"); } catch (e) {}
  if (!db) return;
  S.db = db; S.mode = "db";
  setSync("กำลังซิงก์…", true);
  try { S.assets = await window.claude.use("assets"); } catch (e) {}
  try { S.downloads = await window.claude.use("downloads"); } catch (e) {}
  S.products = []; S.records = []; renderAll(); renderHistory();
  let gotP = false, gotR = false;
  const timer = setTimeout(() => { if (!gotP || !gotR) setSync("ยังเชื่อมต่อไม่ได้ ข้อมูลอาจไม่ล่าสุด", true); }, 10000);
  const done = () => { if (gotP && gotR) { clearTimeout(timer); setSync("ซิงก์ทุกอุปกรณ์แล้ว", false); } };
  db.doc("app/products").onSnapshot(snap => {
    S.products = snap.exists ? ((snap.data().items) || []) : [];
    if (!snap.metadata.fromCache) { gotP = true; done(); }
    renderAll();
  }, err => { clearTimeout(timer); setSync("โหลดรายการสินค้าไม่สำเร็จ", true); });
  db.collection("qc_records").orderBy("createdAt", "desc").limit(500).onSnapshot(snap => {
    S.records = snap.docs.map(d => d.data());
    if (!snap.metadata.fromCache) { gotR = true; done(); }
    renderHistory();
  }, err => { clearTimeout(timer); setSync("โหลดประวัติไม่สำเร็จ", true); });
}

/* ---------- boot ---------- */
const h0 = location.hash.slice(1);
show(["check","history","products"].includes(h0) ? h0 : "check");
init();
})();
