import re

with open('src/components/PropertyChat.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Remove imports
text = re.sub(r"import \{ useWebRTC \} from '../lib/useWebRTC';\n", "", text)
text = re.sub(r"import \{ CallModal \} from './CallModal';\n", "", text)
text = re.sub(r"import \{ Phone, Video \} from 'lucide-react';\n?", "", text)

# Just manually patch Phone and Video out of the lucide-react import
text = text.replace("Phone, Video,", "")
text = text.replace("Phone, Video", "")
text = text.replace(", Phone", "")
text = text.replace(", Video", "")
text = text.replace("Video,", "")
text = text.replace("Phone,", "")

# 2. Remove the useWebRTC hook call
webrtc_hook = r"""\s*const \{\s*localStream,\s*remoteStream,\s*isCalling,\s*incomingCall,\s*startCall,\s*answerCall,\s*rejectCall,\s*endCall\s*\} = useWebRTC\([^;]+;\n"""
text = re.sub(webrtc_hook, "\n", text)

# 3. Remove handleStartCall function
handle_start = r"""\s*const handleStartCall = \(video: boolean\) => \{.*?^\s*\};\n"""
text = re.sub(handle_start, "\n", text, flags=re.MULTILINE | re.DOTALL)

# 4. Remove the call buttons from the header
call_buttons = r"""\s*\{hotel\.callsEnabled !== false && \(\s*<div className="flex items-center gap-1">\s*<button.*?<Phone className="w-4 h-4" />.*?<\/button>\s*<button.*?<Video className="w-4 h-4" />.*?<\/button>\s*<\/div>\s*\)\}"""
text = re.sub(call_buttons, "", text, flags=re.MULTILINE | re.DOTALL)

# 5. Remove CallModal from the render output
call_modal = r"""\s*<CallModal[^>]+/>"""
text = re.sub(call_modal, "", text, flags=re.MULTILINE)

with open('src/components/PropertyChat.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
