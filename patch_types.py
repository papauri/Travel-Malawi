import re
import sys

with open('src/pages/ManageHotel.tsx', 'r') as f:
    content = f.read()

# 1. LIVE PREVIEW block
live_preview_block_match = re.search(r'(\{\/\* LIVE PREVIEW: How your images look to guests \*\/\}.*?)(?=\s*<form onSubmit=\{handleSaveHotel\})', content, re.DOTALL)
live_preview_block = live_preview_block_match.group(1) if live_preview_block_match else ""
content = content.replace(live_preview_block, "")

# 2. Photos & Media in Details
photos_media_match = re.search(r'(<SectionCard title="Photos & Media" description="High-quality images that showcase your property\.">.*?<div className="md:col-span-2">)(\s*<label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Category)', content, re.DOTALL)
if photos_media_match:
    content = content.replace(photos_media_match.group(1), '<SectionCard title="Property Category" description="Choose a category for your property.">\n    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">\n              <div className="md:col-span-2">')
else:
    print("Could not find Photos & Media")
    sys.exit(1)

# 3. Photos & Amenities in Rooms
photos_rooms_match = re.search(r'(<SectionCard title="Photos & Amenities">\s*<div className="grid grid-cols-1 md:grid-cols-2 gap-6">.*?)(?=\{\/\* ROOM AMENITIES \*\/\})', content, re.DOTALL)
if photos_rooms_match:
    content = content.replace(photos_rooms_match.group(1), '<SectionCard title="Room Amenities">\n                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">\n                  ')
else:
    print("Could not find Photos & Amenities")
    sys.exit(1)

# 4. Insert Media Tab
# We will insert it right before `{activeTab === 'rooms' && (`

media_tab = """
      {activeTab === 'media' && (
        <div className="space-y-6">
""" + live_preview_block + """
          <SectionCard title="Property Cover Image" description="This will be the large banner on your hotel's hero page, and the main thumbnail in search results.">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <ImageUpload
                  label="Cover Photo"
                  hint="Choose an impressive exterior or best-view shot."
                  value={editHotelData.imageUrl || ''}
                  onChange={(url) => setEditHotelData({ ...editHotelData, imageUrl: url })}
                  folder={`hotels/${id}`}
                />
                <FieldError message={detailProblems.imageUrl} />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Property Gallery" description="These appear in the main photo grid/carousel at the top of your property page.">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <GalleryUpload 
                  label="Gallery Images"
                  hint="Include common areas, dining, and surroundings. Do NOT put specific room photos here."
                  value={editHotelData.galleryUrls || []} 
                  onChange={(urls) => setEditHotelData({ ...editHotelData, galleryUrls: urls })} 
                  folder={`hotels/${id}/gallery`}
                />
              </div>
            </div>
          </SectionCard>

          <div className="flex justify-end mb-8 border-b pb-8 border-stone-200">
             <button
                type="button"
                onClick={handleSaveHotel}
                disabled={saving || !hotelDirty}
                className="bg-stone-900 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-stone-800 disabled:opacity-50 transition"
              >
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                Save Property Media
              </button>
          </div>

          <div className="mb-4 mt-8">
            <h2 className="text-2xl font-serif font-bold text-stone-900">Room-Specific Galleries</h2>
            <p className="text-stone-500 mt-1">Upload distinct photos for each room type to eliminate confusion.</p>
          </div>

          {rooms.length === 0 ? (
            <div className="bg-stone-50 p-8 rounded-2xl text-center border border-stone-200">
               <BedDouble className="h-10 w-10 text-stone-400 mx-auto mb-3" />
               <p className="text-stone-500 font-medium">You haven't added any rooms yet.</p>
               <button onClick={() => requestTab('rooms')} className="mt-4 text-emerald-600 font-bold hover:underline">Go to Rooms Tab</button>
            </div>
          ) : (
            <div className="space-y-8">
              {rooms.map(room => {
                return (
                  <div key={room.id} className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm relative">
                     <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-stone-900">{room.name}</h3>
                        <button 
                           type="button"
                           onClick={async () => {
                             // Let's create an inline save for rooms just for media? 
                             // Wait, no, we can't easily access the edited state if we map rooms directly. 
                             // I'll create a standalone component or use a wrapper inside here later.
                           }}
                        >
                        </button>
                     </div>
                     <p>Wait, I need to handle state for multiple rooms!</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
"""

content = content.replace("{activeTab === 'rooms' && (", media_tab + "\n      {activeTab === 'rooms' && (")

with open('src/pages/ManageHotel.tsx', 'w') as f:
    f.write(content)

print("Patch applied successfully.")
