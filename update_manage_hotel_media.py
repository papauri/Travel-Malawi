import re

with open('src/pages/ManageHotel.tsx', 'r') as f:
    content = f.read()

# 1. Add 'media' to Tab type
content = content.replace("type Tab = 'details' | 'media' | 'rooms'", "type Tab = 'details' | 'media' | 'rooms'")
# already done in bash

# 2. Add 'media' to rendering in Tabs
# already done in bash

# Let's verify what's inside
