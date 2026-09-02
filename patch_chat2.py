import re

with open('src/components/PropertyChat.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Remove useWebRTC hook
text = re.sub(
    r'\s*const \{\s*activeCall,\s*incomingCall,\s*localVideoRef,\s*remoteVideoRef,\s*localStream,\s*remoteStream,\s*networkQuality,\s*startCall,\s*answerCall,\s*rejectCall,\s*endCall\s*\} = useWebRTC[^\n]+\n',
    '\n',
    text
)

# 2. Remove handleStartCall function
handle_start = r"""\s*const handleStartCall = \(video: boolean\) => \{.*?^\s*\};\n"""
text = re.sub(handle_start, "\n", text, flags=re.MULTILINE | re.DOTALL)

# 3. Remove CallModal from render
text = re.sub(r'\s*<CallModal[^>]+/>\n', '\n', text, flags=re.MULTILINE | re.DOTALL)

# 4. Remove WebRTC imports
text = re.sub(r"import \{ useWebRTC \} from '../lib/useWebRTC';\n", "", text)
text = re.sub(r"import \{ CallModal \} from './CallModal';\n", "", text)

# 5. Remove WebRTC lucide icons
text = re.sub(r',\s*Phone\s*,', ',', text)
text = re.sub(r',\s*Phone\n', '\n', text)
text = re.sub(r',\s*Video\s*,', ',', text)
text = re.sub(r',\s*Video\n', '\n', text)
text = re.sub(r'Phone\s*,', '', text)
text = re.sub(r'Video\s*,', '', text)

# 6. Remove the buttons
call_buttons = r"""\s*\{liveHotel\.callsEnabled !== false && \(\s*<div className="flex items-center gap-1">\s*<button.*?</button>\s*<button.*?</button>\s*</div>\s*\)\}"""
text = re.sub(call_buttons, "", text, flags=re.MULTILINE | re.DOTALL)

call_buttons2 = r"""\s*\{hotel\.callsEnabled !== false && \(\s*<div className="flex items-center gap-1">\s*<button.*?</button>\s*<button.*?</button>\s*</div>\s*\)\}"""
text = re.sub(call_buttons2, "", text, flags=re.MULTILINE | re.DOTALL)

with open('src/components/PropertyChat.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
