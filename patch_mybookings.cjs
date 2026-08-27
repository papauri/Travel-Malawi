const fs = require('fs');
let content = fs.readFileSync('src/pages/MyBookings.tsx', 'utf8');

if (!content.includes("import BookingChat")) {
  content = content.replace("import Modal, { fieldClass, labelClass } from '../components/Modal';", "import Modal, { fieldClass, labelClass } from '../components/Modal';\nimport BookingChat from '../components/BookingChat';\nimport { MessageSquare } from 'lucide-react';");
}

const stateRegex = /const \[busyId, setBusyId\] = useState<string \| null>\(null\);/;
if (content.match(stateRegex)) {
  content = content.replace(stateRegex, "const [busyId, setBusyId] = useState<string | null>(null);\n  const [chatTarget, setChatTarget] = useState<EnrichedBooking | null>(null);");
}

// Add the "Message Host" button next to "Write a review" or "Cancel booking"
const actionsRegex = /\{booking\.status === 'pending' && \(/;
const actionsReplacement = `{booking.status !== 'cancelled' && booking.status !== 'rejected' && (
                          <button
                            type="button"
                            onClick={() => setChatTarget(booking)}
                            className="text-xs font-semibold text-stone-600 border border-stone-200 bg-white px-3 py-1.5 rounded-lg hover:bg-stone-50 hover:text-stone-900 transition flex items-center gap-1.5"
                          >
                            <MessageSquare className="w-3.5 h-3.5" /> Contact host
                          </button>
                        )}
                        {booking.status === 'pending' && (`

content = content.replace(actionsRegex, actionsReplacement);

// Add the ChatDialog
const dialogsRegex = /\{reviewTarget && \(/;
const dialogsReplacement = `{chatTarget && user && (
        <Modal
          isOpen={true}
          onClose={() => setChatTarget(null)}
          title={"Message " + (chatTarget.hotel?.name || 'Property')}
          description={"Reference: " + (chatTarget.reference || 'N/A')}
        >
          <div className="mt-2 h-[500px]">
             <BookingChat booking={chatTarget} currentUser={user} />
          </div>
        </Modal>
      )}
      {reviewTarget && (`

content = content.replace(dialogsRegex, dialogsReplacement);

fs.writeFileSync('src/pages/MyBookings.tsx', content);
