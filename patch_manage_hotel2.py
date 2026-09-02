import re

with open('src/pages/ManageHotel.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace using a simpler regex matching the entire label tag
text = re.sub(r'<label className="flex items-center gap-3">\s*<input\s*type="checkbox"\s*checked=\{editHotelData\.callsEnabled !== false\}[^>]+>\s*<span[^>]+>Allow Voice/Video Calls</span>\s*</label>', '', text, flags=re.DOTALL)

with open('src/pages/ManageHotel.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
