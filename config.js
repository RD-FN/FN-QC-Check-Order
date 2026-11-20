/*
 * ตั้งค่าการเชื่อม Google Sheets
 * 1) Deploy ไฟล์ apps-script/Code.gs เป็น Web app (ดู README.md)
 * 2) วางลิงก์ Web app (ลงท้ายด้วย /exec) ใน SHEETS_URL
 * เว้น SHEETS_URL ว่าง = เว็บจะเก็บข้อมูลไว้ในเบราว์เซอร์เครื่องนั้นเท่านั้น
 */
window.QC_CONFIG = {
  SHEETS_URL: "https://script.google.com/macros/s/AKfycbwHcMOHtmZ5HJYyaz5Ym69Pa6m0fHP1oooxL3JRf9cFxg1OhS53pbf8xktl3C_bs8vVig/exec",
  API_KEY: ""       // ต้องตรงกับ API_KEY ใน Code.gs (เว้นว่างถ้าไม่ได้ตั้ง)
};
