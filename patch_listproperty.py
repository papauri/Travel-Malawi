import re

with open('src/pages/ListProperty.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = re.sub(r"import \{ usePermission \} from '\.\./contexts/PermissionContext';\n", "", text)
text = re.sub(r"\s*const \{ requestPermission \} = usePermission\(\);\n", "\n", text)
text = re.sub(r"\s*const allowed = await requestPermission\('location'\);\n\s*if \(\!allowed\) return;\n", "\n", text)

with open('src/pages/ListProperty.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
print("Cleaned ListProperty.tsx")
