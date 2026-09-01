import re

with open('src/pages/ManageHotel.tsx', 'r') as f:
    content = f.read()

# Replace the condition for Room Images
# Old: {rooms.some(r => r.imageUrl || (r.galleryUrls && r.galleryUrls.length > 0)) && (
# New: {rooms.length > 0 && (

old_condition = "{rooms.some(r => r.imageUrl || (r.galleryUrls && r.galleryUrls.length > 0)) && ("
new_condition = "{rooms.length > 0 && ("

content = content.replace(old_condition, new_condition)

# Old: {rooms.filter(r => r.imageUrl || (r.galleryUrls && r.galleryUrls.length > 0)).map(room => (
# New: {rooms.map(room => (

old_filter = "{rooms.filter(r => r.imageUrl || (r.galleryUrls && r.galleryUrls.length > 0)).map(room => ("
new_filter = "{rooms.map(room => ("

content = content.replace(old_filter, new_filter)

with open('src/pages/ManageHotel.tsx', 'w') as f:
    f.write(content)

