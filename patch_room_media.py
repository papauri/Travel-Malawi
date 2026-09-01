import re

with open('src/pages/ManageHotel.tsx', 'r') as f:
    content = f.read()

room_media_component = """
function RoomMediaEditor({ room, hotelId, onUpdate }: { room: RoomType, hotelId: string, onUpdate: (room: RoomType) => void }) {
  const [imageUrl, setImageUrl] = useState(room.imageUrl || '');
  const [galleryUrls, setGalleryUrls] = useState<string[]>(room.galleryUrls || []);
  const [saving, setSaving] = useState(false);

  const isDirty = imageUrl !== (room.imageUrl || '') || JSON.stringify(galleryUrls) !== JSON.stringify(room.galleryUrls || []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'room_types', room.id!), { imageUrl, galleryUrls });
      onUpdate({ ...room, imageUrl, galleryUrls });
      toast.success(`${room.name} media saved.`);
    } catch (e) {
      toast.error('Failed to save room media.');
    }
    setSaving(false);
  };

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h3 className="text-xl font-bold text-stone-900">{room.name}</h3>
          <p className="text-sm text-stone-500 mt-1">Upload distinct photos for this room type to eliminate confusion.</p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || saving}
          className="bg-stone-100 text-stone-700 px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 hover:bg-stone-200 disabled:opacity-50 transition"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Room Media
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <ImageUpload
            label="Room Cover Photo"
            hint="This is the first picture guests see for this room type. Make it a well-lit, wide shot of the bed and room."
            value={imageUrl}
            onChange={setImageUrl}
            folder={`hotels/${hotelId}/rooms`}
          />
        </div>
        <div className="md:col-span-2">
          <GalleryUpload
            label="Room Gallery"
            hint="These photos form the image carousel when guests click to view this specific room."
            value={galleryUrls}
            onChange={setGalleryUrls}
            folder={`hotels/${hotelId}/rooms`}
          />
        </div>
      </div>
    </div>
  );
}

"""

# Insert `RoomMediaEditor` before `export default function ManageHotel() {`
content = content.replace("export default function ManageHotel() {", room_media_component + "export default function ManageHotel() {")

# Now replace the dummy content in `ManageHotel.tsx`
dummy_content = """<div key={room.id} className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm relative">
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
                  </div>"""

real_content = """<RoomMediaEditor 
                    key={room.id} 
                    room={room} 
                    hotelId={id!} 
                    onUpdate={(updated) => setRooms(rooms.map(r => r.id === updated.id ? updated : r))} 
                  />"""

content = content.replace(dummy_content, real_content)

with open('src/pages/ManageHotel.tsx', 'w') as f:
    f.write(content)

