"""Dựng trang chấm mù A/B cho Folio từ một đợt đánh giá.
Dùng: py -3.12 scripts/tao-trang-ab.py <thư mục đợt> <tên trang .html> "<tiêu đề>" <đề:tên hiện:mô tả>...
Ảnh lấy từ <đợt>/.shots (design-kit check --shots), cắt phần đầu, đặt nhãn theo <đợt>/.khoa.json (X/Y)."""
import json, sys, os
from PIL import Image

dot, page, title = sys.argv[1], sys.argv[2], sys.argv[3]
briefs = [a.split(":", 2) for a in sys.argv[4:]]
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
khoa = json.load(open(os.path.join(root, dot, ".khoa.json"), encoding="utf-8"))
slug_dot = dot.replace("/", "~").replace("\\", "~")
out_dir = os.path.join(root, ".folio", "anh", os.path.basename(dot))
os.makedirs(out_dir, exist_ok=True)
VIEWS = (("light", 1280, 1500, "Máy tính, sáng (phần đầu trang)"), ("light", 390, 1700, "Điện thoại, sáng"), ("dark", 390, 1700, "Điện thoại, tối"))

sections = []
for i, (b, name, desc) in enumerate(briefs, 1):
    sides = []
    for lbl in ("X", "Y"):
        src = khoa[b][lbl]
        figs = []
        for sc, w, maxh, cap in VIEWS:
            p = os.path.join(root, dot, ".shots", f"{slug_dot}~{b}~{src}~index", f"{sc}-{w}.png")
            im = Image.open(p)
            rel = f"anh/{os.path.basename(dot)}/{b}-{lbl}-{sc}-{w}.png"
            im.crop((0, 0, im.width, min(im.height, maxh))).convert("RGB").save(os.path.join(root, ".folio", rel), optimize=True)
            alt = f"Bản {lbl} đề {name}, {cap.lower()}"
            figs.append(f'<figure class="shot"><img src="{rel}" alt="{alt}" loading="lazy"><figcaption>{cap}</figcaption></figure>')
        sides.append(f'<div class="side"><h3>{lbl} <span>{name}</span></h3>{figs[0]}<div class="phones">{figs[1]}{figs[2]}</div></div>')
    sections.append(f'<section class="brief" aria-labelledby="b{i}"><h2 id="b{i}">Đề {i}: {name}</h2><p>{desc}</p><div class="pair">{"".join(sides)}</div></section>')

tpl = open(os.path.join(root, ".folio", "danh-gia-ab.html"), encoding="utf-8").read()
head = tpl[: tpl.index('<main class="wrap">')]
html = head.replace("<title>Chấm mù A/B</title>", f"<title>{title}</title>") + f'''<main class="wrap">
  <header>
    <h1>{title}</h1>
    <p>Ba đề mới, mỗi đề hai bản do hai agent cùng model Opus làm độc lập. Một bản làm theo skill design-kit, bản kia làm như Opus mặc định. Nhãn X và Y được đặt lại theo khoá mới, khác với đợt trước.</p>
  </header>
  <div class="how">
    <p><strong>Cách chấm:</strong> với mỗi đề, chọn bản thấy đẹp hơn và dễ dùng hơn.</p>
    <p>Điểm máy đo và đáp án sẽ công bố sau khi chủ chấm xong.</p>
  </div>
  {"".join(sections)}
</main>
</body>
</html>
'''
open(os.path.join(root, ".folio", page), "w", encoding="utf-8", newline="\n").write(html)
print(page, len(briefs), "briefs")
