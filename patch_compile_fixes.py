import re

with open('src/pages/ManageHotel.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Remove callsEnabled checkbox block
checkbox_regex = r'<label className="flex items-center gap-3">\s*<input\s*type="checkbox"\s*checked=\{editHotelData\.callsEnabled !== false\}\s*onChange=\{\(e\) => setEditHotelData\(\{\.\.\.editHotelData, callsEnabled: e\.target\.checked\}\)\}.*?Allow Voice/Video Calls</span>\s*</label>'
text = re.sub(checkbox_regex, '', text, flags=re.DOTALL)

with open('src/pages/ManageHotel.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

with open('src/components/PropertyChat.tsx', 'r', encoding='utf-8') as f:
    chat_text = f.read()

# Add Phone and Video back to lucide-react import
chat_text = chat_text.replace(
    'PhoneMissed\n} from \'lucide-react\';',
    'PhoneMissed,\n  Phone,\n  Video\n} from \'lucide-react\';'
)

with open('src/components/PropertyChat.tsx', 'w', encoding='utf-8') as f:
    f.write(chat_text)
