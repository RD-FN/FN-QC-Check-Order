/**
 * QC เช็คสินค้าก่อนจัดส่ง — Google Apps Script backend
 * ------------------------------------------------------------
 * วางโค้ดนี้ใน Apps Script ของ Google Sheet (ส่วนขยาย > Apps Script)
 * แล้ว Deploy เป็น Web app (ดูขั้นตอนใน README.md)
 *
 * เว็บจะเรียกใช้:
 *   GET  ?action=ping | products | records
 *   POST {action:"saveRecord", record:{...}}
 *   POST {action:"saveProducts", products:[...]}
 *   POST {action:"deleteRecord", id:"QC-...", pin:"..."}
 *   POST {action:"deleteRecords", ids:["QC-...", ...], pin:"..."}   (ลบหลายรายการ + ย้ายรูป/ลายเซ็นไปถังขยะ)
 *   POST {action:"verifyPin", pin:"..."}
 *   POST {action:"uploadProductImage", pin:"...", data:"data:image/jpeg;base64,...", name:"..."}
 *
 * รหัสผู้ดูแล (สำหรับนำเข้า/แก้ไขรายการสินค้า และลบบันทึก) เก็บใน
 * Project Settings > Script Properties ชื่อ ADMIN_PIN — ไม่ได้อยู่ในโค้ดนี้
 */

// ====== ตั้งค่า ======
const SHEET_ID = '1I-YOecZH3ta4vUnclPpoubh7ywMQ8XIT1XXxxGQSWiU'; // ID ของ Google Sheet (เว้นว่างได้ถ้าโค้ดอยู่ในชีตนั้นเอง)
const API_KEY = '';                 // ใส่รหัสลับถ้าต้องการ (ต้องตรงกับ API_KEY ใน config.js) เว้นว่าง = ไม่ตรวจ
const PHOTO_FOLDER_NAME = 'QC Photos'; // โฟลเดอร์ใน Google Drive สำหรับเก็บรูปและลายเซ็น
const SHARE_FILES_BY_LINK = true;   // true = เปิดสิทธิ์ "ทุกคนที่มีลิงก์ดูได้" ให้รูป เพื่อให้เว็บแสดงรูปได้
const TIMEZONE = 'Asia/Bangkok';
const MAX_RECORDS_RETURNED = 300;

const SHEET_RECORDS = 'QC_Records';
const SHEET_ITEMS = 'QC_Items';
const SHEET_PRODUCTS = 'Products';

const RECORD_HEADERS = [
  'รหัสบันทึก', 'วันที่', 'เวลา', 'เลขออร์เดอร์', 'ช่องทาง', 'ลูกค้า', 'ขนส่ง', 'เลขพัสดุ', 'ผู้ตรวจ QC',
  'สถานะ', 'จำนวนรายการที่เช็ค', 'จำนวนที่ต้องมี', 'รายการสินค้า', 'ยังไม่ได้เช็ค', 'หมายเหตุ',
  'จำนวนรูป', 'ลิงก์รูป', 'ลิงก์ลายเซ็น', 'อุปกรณ์', 'เวลาเริ่มเช็ค', 'เวอร์ชันเว็บ',
  'createdAt', 'items_json', 'missing_json', 'photos_json', 'signature_json'
];
const ITEM_HEADERS = ['รหัสบันทึก', 'วันที่', 'เลขออร์เดอร์', 'รหัสสินค้า', 'ชื่อสินค้า', 'จำนวนที่แพ็ก', 'จำนวนที่ต้องมี', 'หน่วย', 'เวลาเช็ค', 'ผู้ตรวจ QC'];
const PRODUCT_HEADERS = ['รหัสสินค้า', 'ชื่อสินค้า', 'จำนวน', 'หน่วย', 'เลขออร์เดอร์', 'หมวดหมู่', 'รูปสินค้า'];
const STATUS_LABEL = { complete: 'ครบตามออร์เดอร์', incomplete: 'ไม่ครบ', checked: 'ตรวจแล้ว' };

// ====== เมนูใน Google Sheet ======
function onOpen() {
  if (SHEET_ID) return;
  SpreadsheetApp.getUi().createMenu('QC')
    .addItem('สร้าง/ซ่อมหัวตาราง', 'setup')
    .addToUi();
}

/** รันครั้งแรกครั้งเดียว: สร้างชีตและหัวตาราง */
function setup() {
  ensureSheet_(SHEET_RECORDS, RECORD_HEADERS, 5);
  ensureSheet_(SHEET_ITEMS, ITEM_HEADERS, 0);
  ensureSheet_(SHEET_PRODUCTS, PRODUCT_HEADERS, 0);
  getPhotoFolder_();
  return 'ok';
}

// ====== HTTP ======
function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    checkKey_(p.key);
    switch (p.action) {
      case 'products': return json_({ ok: true, products: getProducts_() });
      case 'records':  return json_({ ok: true, records: getRecords_(Number(p.limit) || MAX_RECORDS_RETURNED) });
      case 'ping':
      default:         return json_({ ok: true, app: 'qc-check', time: new Date().toISOString() });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    checkKey_(body.key);
    lock.waitLock(30000);
    switch (body.action) {
      case 'saveRecord':   return json_({ ok: true, record: saveRecord_(body.record, body.appVersion) });
      case 'verifyPin':    checkPin_(body.pin); return json_({ ok: true });
      case 'saveProducts': checkPin_(body.pin); return json_({ ok: true, count: saveProducts_(body.products || []) });
      case 'deleteRecord': checkPin_(body.pin); return json_({ ok: true, deleted: deleteRecords_([body.id]).deleted > 0 });
      case 'deleteRecords': checkPin_(body.pin); return json_(Object.assign({ ok: true }, deleteRecords_(body.ids)));
      case 'uploadProductImage': checkPin_(body.pin); return json_(Object.assign({ ok: true }, uploadProductImage_(body.data, body.name)));
      default: throw new Error('ไม่รู้จักคำสั่ง: ' + body.action);
    }
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

// ====== Records ======
function saveRecord_(rec, appVersion) {
  if (!rec || !rec.id || !rec.orderNo) throw new Error('ข้อมูลบันทึกไม่ครบ');
  const sh = ensureSheet_(SHEET_RECORDS, RECORD_HEADERS, 5);

  // กันบันทึกซ้ำเมื่อกดส่งซ้ำ
  const found = sh.getRange('A:A').createTextFinder(rec.id).matchEntireCell(true).findNext();
  if (found) return rowToRecord_(sh.getRange(found.getRow(), 1, 1, RECORD_HEADERS.length).getValues()[0]);

  const created = rec.createdAt ? new Date(rec.createdAt) : new Date();
  const dateStr = Utilities.formatDate(created, TIMEZONE, 'yyyy-MM-dd');
  const timeStr = Utilities.formatDate(created, TIMEZONE, 'HH:mm:ss');
  const folder = getDayFolder_(dateStr);

  const photos = (rec.photos || []).map(function (p, i) {
    if (!p || !p.data) return p;
    const f = saveDataUrl_(folder, p.data, rec.id + '_photo' + (i + 1) + '.jpg');
    return { id: f.getId(), url: f.getUrl(), thumb: thumbUrl_(f.getId()) };
  });
  let signature = null;
  if (rec.signature && String(rec.signature).indexOf('data:') === 0) {
    const f = saveDataUrl_(folder, rec.signature, rec.id + '_signature.png');
    signature = { id: f.getId(), url: f.getUrl(), thumb: thumbUrl_(f.getId()) };
  }

  const items = rec.items || [], missing = rec.missing || [];
  const row = [
    rec.id, dateStr, timeStr, text_(rec.orderNo), rec.channel || '', rec.customer || '', rec.carrier || '', text_(rec.tracking || ''), rec.inspector || '',
    STATUS_LABEL[rec.status] || rec.status || '', items.length, rec.expectedCount == null ? '' : rec.expectedCount,
    items.map(function (i) { return (i.code ? i.code + ' ' : '') + i.name + ' x' + i.qty; }).join('; '),
    missing.map(function (i) { return i.name + ' x' + i.qty; }).join('; '),
    rec.note || '', photos.length,
    photos.map(function (p) { return p && p.url || ''; }).join('\n'),
    signature ? signature.url : '',
    rec.device || '', rec.startedAt ? Utilities.formatDate(new Date(rec.startedAt), TIMEZONE, 'HH:mm:ss') : '',
    rec.appVersion || appVersion || '',
    created.toISOString(), JSON.stringify(items), JSON.stringify(missing), JSON.stringify(photos), JSON.stringify(signature)
  ];
  sh.appendRow(row);

  if (items.length) {
    const ish = ensureSheet_(SHEET_ITEMS, ITEM_HEADERS, 0);
    const rows = items.map(function (i) {
      return [rec.id, dateStr, text_(rec.orderNo), text_(i.code || ''), i.name || '', i.qty, i.expected == null ? '' : i.expected, i.unit || '',
        i.checkedAt ? Utilities.formatDate(new Date(i.checkedAt), TIMEZONE, 'HH:mm:ss') : '', rec.inspector || ''];
    });
    ish.getRange(ish.getLastRow() + 1, 1, rows.length, ITEM_HEADERS.length).setValues(rows);
  }
  return rowToRecord_(row);
}

function getRecords_(limit) {
  const sh = ensureSheet_(SHEET_RECORDS, RECORD_HEADERS, 5);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const n = Math.min(limit, last - 1);
  const values = sh.getRange(last - n + 1, 1, n, RECORD_HEADERS.length).getValues();
  return values.reverse().filter(function (r) { return r[0]; }).map(rowToRecord_);
}

// ลบบันทึกผลตรวจ (QC_Records + QC_Items) และย้ายรูป/ลายเซ็นของบันทึกนั้นไปถังขยะใน Drive (กู้คืนได้ 30 วัน)
function deleteRecords_(ids) {
  const want = {};
  (ids || []).forEach(function (i) { if (i) want[String(i)] = true; });
  if (!Object.keys(want).length) throw new Error('ไม่ได้เลือกบันทึกที่จะลบ');
  let deleted = 0, files = 0;
  const sh = ensureSheet_(SHEET_RECORDS, RECORD_HEADERS, 5);
  const iPh = RECORD_HEADERS.indexOf('photos_json'), iSig = RECORD_HEADERS.indexOf('signature_json');
  deleteRowsWhere_(sh, RECORD_HEADERS.length, function (r) {
    if (!want[String(r[0])]) return false;
    const fids = parse_(r[iPh], []).map(function (p) { return p && p.id; });
    const sig = parse_(r[iSig], null); if (sig && sig.id) fids.push(sig.id);
    fids.forEach(function (fid) { if (!fid) return; try { DriveApp.getFileById(fid).setTrashed(true); files++; } catch (e) {} });
    deleted++;
    return true;
  });
  const ish = ss_().getSheetByName(SHEET_ITEMS);
  if (ish) deleteRowsWhere_(ish, 1, function (r) { return !!want[String(r[0])]; });
  return { deleted: deleted, files: files };
}
// ลบแถวที่ตรงเงื่อนไข จากล่างขึ้นบน รวบแถวที่ติดกันเป็นก้อนเดียว (ไม่เขียนค่าใหม่ทับ เลข 0 นำหน้าจึงไม่หาย)
function deleteRowsWhere_(sh, width, match) {
  const last = sh.getLastRow();
  if (last < 2) return 0;
  const vals = sh.getRange(2, 1, last - 1, width).getValues();
  let n = 0, runEnd = -1;
  for (let i = vals.length - 1; i >= -1; i--) {
    const hit = i >= 0 && match(vals[i]);
    if (hit && runEnd < 0) runEnd = i;
    if (!hit && runEnd >= 0) { sh.deleteRows(i + 3, runEnd - i); n += runEnd - i; runEnd = -1; }
  }
  return n;
}

function rowToRecord_(r) {
  const H = {}; RECORD_HEADERS.forEach(function (h, i) { H[h] = r[i]; });
  const status = Object.keys(STATUS_LABEL).filter(function (k) { return STATUS_LABEL[k] === H['สถานะ']; })[0] || 'checked';
  const sig = parse_(H['signature_json'], null);
  return {
    id: String(H['รหัสบันทึก']), orderNo: untext_(H['เลขออร์เดอร์']), channel: H['ช่องทาง'], customer: H['ลูกค้า'], carrier: H['ขนส่ง'] || '',
    tracking: untext_(H['เลขพัสดุ']), inspector: H['ผู้ตรวจ QC'], status: status,
    itemCount: Number(H['จำนวนรายการที่เช็ค']) || 0, expectedCount: H['จำนวนที่ต้องมี'] === '' ? null : Number(H['จำนวนที่ต้องมี']),
    note: H['หมายเหตุ'], device: H['อุปกรณ์'], appVersion: H['เวอร์ชันเว็บ'],
    createdAt: H['createdAt'] instanceof Date ? H['createdAt'].toISOString() : String(H['createdAt']),
    startedAt: null,
    items: parse_(H['items_json'], []), missing: parse_(H['missing_json'], []), photos: parse_(H['photos_json'], []),
    signature: sig ? sig.thumb : ''
  };
}

// ====== Products ======
function getProducts_() {
  const sh = ensureSheet_(SHEET_PRODUCTS, PRODUCT_HEADERS, 0);
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, PRODUCT_HEADERS.length).getDisplayValues()
    .filter(function (r) { return r[1]; })
    .map(function (r) { return { code: r[0], name: r[1], qty: Number(r[2]) || 1, unit: r[3], order: r[4], category: r[5], image: r[6] }; });
}

function saveProducts_(list) {
  const sh = ensureSheet_(SHEET_PRODUCTS, PRODUCT_HEADERS, 0);
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, PRODUCT_HEADERS.length).clearContent();
  if (!list.length) return 0;
  const rows = list.map(function (p) { return [text_(p.code || ''), p.name || '', Number(p.qty) || 1, p.unit || '', text_(p.order || ''), p.category || '', p.image || '']; });
  sh.getRange(2, 1, rows.length, PRODUCT_HEADERS.length).setValues(rows);
  return rows.length;
}

/** รูปสินค้า: เก็บใน Drive โฟลเดอร์ QC Photos/สินค้า แล้วคืนลิงก์รูปสำหรับแสดงบนเว็บ */
function uploadProductImage_(data, name) {
  const root = getPhotoFolder_();
  const it = root.getFoldersByName('สินค้า');
  const folder = it.hasNext() ? it.next() : root.createFolder('สินค้า');
  const safe = String(name || 'product').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);
  const f = saveDataUrl_(folder, data, safe + '_' + Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMdd-HHmmss') + '.jpg');
  return { id: f.getId(), url: 'https://drive.google.com/thumbnail?id=' + f.getId() + '&sz=w600' };
}

// ====== Helpers ======
function ss_() { return SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActive(); }
function ensureSheet_(name, headers, hideLastN) {
  const ss = ss_();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  let cur = sh.getRange(1, 1, 1, headers.length).getValues()[0];
  // v1.5.0: เพิ่มคอลัมน์ "ขนส่ง" ก่อน "เลขพัสดุ" ในชีตเดิม โดยแทรกคอลัมน์ (ข้อมูลเก่าเลื่อนไปตรงตำแหน่ง ไม่เพี้ยน)
  const iCarrier = headers.indexOf('ขนส่ง');
  if (iCarrier > 0 && cur[0] === headers[0] && cur.indexOf('ขนส่ง') < 0 && cur[iCarrier] === 'เลขพัสดุ') {
    sh.insertColumnBefore(iCarrier + 1);
    cur = sh.getRange(1, 1, 1, headers.length).getValues()[0];
  }
  if (cur.join('|') !== headers.join('|')) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold').setBackground('#11875f').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    if (hideLastN) sh.hideColumns(headers.length - hideLastN + 1, hideLastN);
  }
  return sh;
}

function getPhotoFolder_() {
  const it = DriveApp.getFoldersByName(PHOTO_FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(PHOTO_FOLDER_NAME);
}
function getDayFolder_(dateStr) {
  const root = getPhotoFolder_();
  const it = root.getFoldersByName(dateStr);
  return it.hasNext() ? it.next() : root.createFolder(dateStr);
}
function saveDataUrl_(folder, dataUrl, name) {
  const m = String(dataUrl).match(/^data:([^;]+);base64,(.*)$/);
  if (!m) throw new Error('รูปแบบไฟล์รูปไม่ถูกต้อง');
  const blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], name);
  const f = folder.createFile(blob);
  if (SHARE_FILES_BY_LINK) {
    try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { /* โดเมนอาจไม่อนุญาตแชร์ลิงก์ */ }
  }
  return f;
}
function thumbUrl_(id) { return 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1000'; }
function text_(v) { v = String(v == null ? '' : v); return /^[0-9+\-=]/.test(v) ? "'" + v : v; } // เก็บเลขออร์เดอร์/เลขพัสดุเป็นข้อความ ไม่ให้เลข 0 นำหน้าหาย
function untext_(v) { return String(v == null ? '' : v).replace(/^'/, ''); }
function parse_(s, d) { try { return s ? JSON.parse(s) : d; } catch (e) { return d; } }
/** ตรวจรหัสผู้ดูแล: ผิดเกิน 5 ครั้งใน 10 นาที จะล็อก 10 นาที */
function checkPin_(pin) {
  const adminPin = PropertiesService.getScriptProperties().getProperty('ADMIN_PIN');
  if (!adminPin) throw new Error('ยังไม่ได้ตั้งรหัสผู้ดูแล (ADMIN_PIN) ใน Apps Script');
  const cache = CacheService.getScriptCache();
  const fails = Number(cache.get('pin_fails') || 0);
  if (fails >= 5) throw new Error('ใส่รหัสผิดหลายครั้ง ระบบล็อกไว้ 10 นาที');
  if (String(pin || '') !== String(adminPin)) {
    cache.put('pin_fails', String(fails + 1), 600);
    throw new Error('รหัสผู้ดูแลไม่ถูกต้อง');
  }
  cache.remove('pin_fails');
}
function checkKey_(k) { if (API_KEY && k !== API_KEY) throw new Error('รหัส API ไม่ถูกต้อง'); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
