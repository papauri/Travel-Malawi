import re

with open('src/pages/ManageHotel.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = re.sub(r'callsEnabled: data\.callsEnabled !== false,\n\s*', '', text)
text = re.sub(r'<label className="flex items-center gap-3">\s*<input\s*type="checkbox"\s*checked=\{editHotelData\.callsEnabled !== false\}\s*onChange=\{\(e\) => setEditHotelData\(\{.*?callsEnabled: e\.target\.checked\}\)\}\s*className=".*?"\s*disabled=\{.*?\}.*?/>\s*<span className=\{.*?\}>Allow Voice/Video Calls</span>\s*</label>\s*', '', text, flags=re.DOTALL)

with open('src/pages/ManageHotel.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
