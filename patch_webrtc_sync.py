import re

with open('src/lib/useWebRTC.ts', 'r', encoding='utf-8') as f:
    text = f.read()

pattern = re.compile(r"const setupMedia = async.*?return null;\n\s*\}\n\s*\};", re.DOTALL)

new_setup = """const setupMedia = async (video: boolean = true): Promise<MediaStream | null> => {
    return new Promise((resolveMedia) => {
      let mediaPromise: Promise<MediaStream> | null = null;

      // Executed synchronously inside the click handler to preserve the user-gesture token
      const performMediaRequest = () => {
        mediaPromise = navigator.mediaDevices.getUserMedia({ video, audio: true });
      };

      requestPermission('camera_mic', performMediaRequest).then(async (granted) => {
        if (!granted) {
          return resolveMedia(null);
        }

        if (!mediaPromise) {
           mediaPromise = navigator.mediaDevices.getUserMedia({ video, audio: true });
        }

        try {
          const stream = await mediaPromise;
          setLocalStream(stream);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
          resolveMedia(stream);
        } catch (err: any) {
          setError(err.message);
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            toast('Call cancelled. Camera/mic access denied. If you are in an embedded preview window, open the app in a new tab!', { icon: '🚫', duration: 5000 });
          } else {
            toast.error('Could not access camera/microphone. Please check your device settings.');
          }
          resolveMedia(null);
        }
      });
    });
  };"""

if pattern.search(text):
    text = pattern.sub(new_setup, text)
    with open('src/lib/useWebRTC.ts', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Replaced successfully")
else:
    print("Could not find pattern")
