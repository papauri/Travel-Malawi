with open('src/pages/HotelDetails.tsx', 'r') as f:
    text = f.read()

def get_indent(line):
    return len(line) - len(line.lstrip())

lines = text.split('\n')
for i, line in enumerate(lines):
    if "grid-cols-1 lg:grid-cols-3" in line:
        print(f"{i+1}: {line}")
    if "lg:col-span-2" in line:
        print(f"{i+1}: {line}")
    if i > 1090 and i < 1120:
        if "</div>" in line or "<div" in line or "DirectionsPanel" in line:
            print(f"{i+1}: {line}")
