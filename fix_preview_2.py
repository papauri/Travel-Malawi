import re

with open('src/pages/ManageHotel.tsx', 'r') as f:
    content = f.read()

# Replace the condition for Property Gallery
old_prop_cond = "{(editHotelData.imageUrl || (editHotelData.galleryUrls && editHotelData.galleryUrls.length > 0)) && ("
new_prop_cond = "{true && ("
content = content.replace(old_prop_cond, new_prop_cond)

# Wait, the inner conditions:
# {editHotelData.imageUrl && (
# Since getHotelImage() always returns something, we should always render the Main image preview.
old_inner_prop_cond = "{editHotelData.imageUrl && ("
new_inner_prop_cond = "{true && ("
content = content.replace(old_inner_prop_cond, new_inner_prop_cond)

# For room image:
old_inner_room_cond = "{room.imageUrl && ("
new_inner_room_cond = "{true && ("
content = content.replace(old_inner_room_cond, new_inner_room_cond)

with open('src/pages/ManageHotel.tsx', 'w') as f:
    f.write(content)

