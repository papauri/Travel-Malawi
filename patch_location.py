import re

with open('src/components/LocationPicker.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = re.sub(r"import \{ usePermission \} from '\.\./contexts/PermissionContext';\n", "", text)
text = re.sub(r"\s*const \{ requestPermission \} = usePermission\(\);\n", "\n", text)
text = re.sub(r"\s*const granted = await requestPermission\('location'\);\n\s*if \(\!granted\) return;\n", "\n", text)

with open('src/components/LocationPicker.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
print("Cleaned LocationPicker.tsx")
