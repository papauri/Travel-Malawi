with open("temp.tsx", "r") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if line.startswith("      <div className=\"mx-auto max-w-7xl px-4 lg:px-8 py-10"):
        print("Wrapper start:", i)
    if "Booking request" in line:
        print("Booking start:", i)
