const fs = require('fs');

let file = 'src/pages/HotelDetails.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('useAuthDialog')) {
  content = content.replace(
    "import { useAuth } from '../contexts/AuthContext';",
    "import { useAuth } from '../contexts/AuthContext';\nimport { useAuthDialog } from '../contexts/AuthDialogContext';"
  );
}

const targetHook = `  const { user } = useAuth();
  const { openInquiryChat, activeChat } = useChatModal();`;

const replacementHook = `  const { user } = useAuth();
  const { openAuth } = useAuthDialog();
  const { openInquiryChat, activeChat } = useChatModal();

  const handleOpenChat = () => {
    if (!hotel) return;
    if (!user) {
      openAuth();
      return;
    }
    openInquiryChat(hotel);
  };`;

content = content.replace(targetHook, replacementHook);
content = content.replace(targetHook.replace(/\n/g, '\r\n'), replacementHook);

content = content.replace(/onClick=\{\(\) => openInquiryChat\(hotel\)\}/g, "onClick={handleOpenChat}");

fs.writeFileSync(file, content);
