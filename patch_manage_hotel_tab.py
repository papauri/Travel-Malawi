import re

with open('src/pages/ManageHotel.tsx', 'r') as f:
    content = f.read()

# Add BroadcastManager import
if "import BroadcastManager" not in content:
    content = content.replace("import StayOSManager from '../components/StayOSManager';", "import StayOSManager from '../components/StayOSManager';\nimport BroadcastManager from '../components/BroadcastManager';")

# Add Megaphone to lucide-react imports if not there
if "Megaphone" not in content:
    content = content.replace("import { MessageSquare } from 'lucide-react';", "import { MessageSquare, Megaphone } from 'lucide-react';")

# Add tab config
if "{ id: 'broadcasts' as Tab," not in content:
    content = content.replace("{ id: 'stayos' as Tab, label: 'Stay OS', icon: ShieldCheck },", "{ id: 'stayos' as Tab, label: 'Stay OS', icon: ShieldCheck },\n          { id: 'broadcasts' as Tab, label: 'Broadcasts', icon: Megaphone },")

# Add rendering logic
render_logic = """
      {activeTab === 'broadcasts' && hotel && user && (
        <BroadcastManager hotelId={hotel.id!} managerId={user.uid} />
      )}
"""
if "activeTab === 'broadcasts'" not in content:
    content = content.replace("{activeTab === 'stayos' && hotel && (", render_logic + "\n      {activeTab === 'stayos' && hotel && (")

with open('src/pages/ManageHotel.tsx', 'w') as f:
    f.write(content)
