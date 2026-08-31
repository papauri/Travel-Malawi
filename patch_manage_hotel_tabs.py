import re

with open('src/pages/ManageHotel.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "type Tab = 'details' | 'rooms' | 'restaurant' | 'bookings' | 'inquiries' | 'stayos';",
    "type Tab = 'details' | 'rooms' | 'restaurant' | 'bookings' | 'inquiries' | 'stayos' | 'broadcasts';"
)

content = content.replace(
    "const TABS: Tab[] = ['details', 'rooms', 'restaurant', 'bookings', 'inquiries', 'stayos'];",
    "const TABS: Tab[] = ['details', 'rooms', 'restaurant', 'bookings', 'inquiries', 'stayos', 'broadcasts'];"
)

with open('src/pages/ManageHotel.tsx', 'w') as f:
    f.write(content)
