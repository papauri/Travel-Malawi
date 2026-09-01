import re
import sys

with open('src/pages/ManageHotel.tsx', 'r') as f:
    content = f.read()

# 1. We will extract the "LIVE PREVIEW" block from `activeTab === 'details'` and put it in `activeTab === 'media'`
# Find the LIVE PREVIEW block.
live_preview_start = content.find("{/* LIVE PREVIEW: How your images look to guests */}")
live_preview_end = content.find("<form onSubmit={handleSaveHotel}", live_preview_start)
if live_preview_start == -1 or live_preview_end == -1:
    print("Could not find LIVE PREVIEW block")
    sys.exit(1)

# Wait, the closing of LIVE PREVIEW is at `)}` before `<form onSubmit={handleSaveHotel}`
# Let's use regex.
live_preview_block_match = re.search(r'(\{\/\* LIVE PREVIEW: How your images look to guests \*\/\}.*?)(?=\s*<form onSubmit=\{handleSaveHotel\})', content, re.DOTALL)
live_preview_block = live_preview_block_match.group(1) if live_preview_block_match else ""

# Remove LIVE PREVIEW from details
content = content.replace(live_preview_block, "")

# 2. Find and remove Photos & Media from Details tab
photos_media_match = re.search(r'<SectionCard title="Photos & Media" description="High-quality images that showcase your property\.">.*?(?=\s*\{\/\* The category decides which home-page filter)', content, re.DOTALL)
if photos_media_match:
    photos_media_content = photos_media_match.group(0)
    # Actually, let's keep the SectionCard but change its title to "Category"
    content = content.replace(photos_media_content, '<SectionCard title="Property Category" description="Choose a category for your property.">')
else:
    print("Could not find Photos & Media in Details")
    sys.exit(1)


# 3. Find and remove Photos & Amenities in Rooms tab
photos_rooms_match = re.search(r'<SectionCard title="Photos & Amenities">\s*<div className="grid grid-cols-1 md:grid-cols-2 gap-6">\s*<div className="md:col-span-2">\s*<ImageUpload.*?</FieldError>\s*</div>\s*\{\/\* `room_gallery`.*?</div>\s*\{\/\* ROOM AMENITIES \*\/\}', content, re.DOTALL)
if photos_rooms_match:
    photos_rooms_content = photos_rooms_match.group(0)
    # Replace with just SectionCard for Room Amenities
    content = content.replace(photos_rooms_content, '<SectionCard title="Room Amenities">\s*<div className="grid grid-cols-1 md:grid-cols-2 gap-6">\n                  {/* ROOM AMENITIES */}')
else:
    print("Could not find Photos & Amenities in Rooms")
    # We will try a simpler replace
    
