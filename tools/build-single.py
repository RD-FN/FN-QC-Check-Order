#!/usr/bin/env python3
"""รวม index.html + assets/style.css + config.js + assets/app.js เป็นไฟล์เดียวที่ dist/qc-check.html
ใช้: python3 tools/build-single.py"""
from pathlib import Path
root = Path(__file__).resolve().parent.parent
html = (root / "index.html").read_text(encoding="utf-8")
css = (root / "assets/style.css").read_text(encoding="utf-8")
cfg = (root / "config.js").read_text(encoding="utf-8")
js = (root / "assets/app.js").read_text(encoding="utf-8")
html = html.replace('<link rel="stylesheet" href="assets/style.css">', "<style>\n" + css + "</style>")
html = html.replace('<script src="config.js"></script>', "<script>\n" + cfg + "</script>")
html = html.replace('<script src="assets/app.js"></script>', "<script>\n" + js + "</script>")
out = root / "dist" / "qc-check.html"
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding="utf-8")
print("เขียนไฟล์", out)
