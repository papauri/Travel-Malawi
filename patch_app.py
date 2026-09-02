import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = re.sub(r"import \{ PermissionProvider \} from '\./contexts/PermissionContext';\n", "", text)
text = re.sub(r"\s*<PermissionProvider>", "", text)
text = re.sub(r"\s*</PermissionProvider>", "", text)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
print("Cleaned App.tsx")
