import re

with open('src/pages/ManageHotel.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Put callsEnabled back in useEffect where editHotelData is initialized
init_regex = r"(chatEnabled: data\.chatEnabled !== false,\n)(?!\s*callsEnabled)"
text = re.sub(init_regex, r"\1      callsEnabled: data.callsEnabled !== false,\n", text)

# Put the callsEnabled checkbox back
broken_label = r"""                      <label className="flex items-center gap-3 cursor-pointer mb-6 ml-8">\s*<input \s*type="checkbox" \s*className="w-5 h-5 text-stone-900 border-stone-300 rounded focus:ring-stone-900 disabled:opacity-50"\s*disabled=\{editHotelData\.chatEnabled === false \|\| editHotelData\.adminChatEnabled === false\}\s*/>\s*</label>"""
correct_label = """                      <label className="flex items-center gap-3 cursor-pointer mb-6 ml-8">
                        <input 
                          type="checkbox" 
                          checked={editHotelData.callsEnabled !== false} 
                          onChange={(e) => setEditHotelData({...editHotelData, callsEnabled: e.target.checked})}
                          className="w-5 h-5 text-stone-900 border-stone-300 rounded focus:ring-stone-900 disabled:opacity-50"
                          disabled={editHotelData.chatEnabled === false || editHotelData.adminChatEnabled === false}
                        />
                        <span className={`font-medium ${editHotelData.chatEnabled === false || editHotelData.adminChatEnabled === false ? 'text-stone-400' : 'text-stone-700'}`}>Allow Voice/Video Calls</span>
                      </label>"""

text = re.sub(broken_label, correct_label, text)

with open('src/pages/ManageHotel.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
