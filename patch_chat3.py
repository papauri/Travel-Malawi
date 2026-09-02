import re

with open('src/components/PropertyChat.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Remove the call buttons
call_buttons = r"""\s*\{/\* Call Buttons \*/\}\s*\{!isChatEnded && currentUser && \(liveHotel\.callsEnabled !== false\) && \(\s*<>\s*<button.*?</button>\s*<button.*?</button>\s*</>\s*\)\}"""
text = re.sub(call_buttons, "", text, flags=re.MULTILINE | re.DOTALL)

with open('src/components/PropertyChat.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
