const fs = require('fs');
let content = fs.readFileSync('src/pages/ManageHotel.tsx', 'utf8');

if (!content.includes("import BookingChat")) {
  content = content.replace("import Modal, { fieldClass, labelClass } from '../components/Modal';", "import Modal, { fieldClass, labelClass } from '../components/Modal';\nimport BookingChat from '../components/BookingChat';\nimport { MessageSquare } from 'lucide-react';");
}

const stateRegex = /const \[deletingReviewId, setDeletingReviewId\] = useState<string \| null>\(null\);/;
if (content.match(stateRegex)) {
  content = content.replace(stateRegex, "const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);\n  const [chatTarget, setChatTarget] = useState<Booking | null>(null);");
}

// Add the "Message Guest" button in the booking list
const actionsRegex = /<span className="font-bold text-stone-900 text-lg">\{booking.guestName\}<\/span>/;
const actionsReplacement = `<span className="font-bold text-stone-900 text-lg">{booking.guestName}</span>
                        {booking.status !== 'cancelled' && booking.status !== 'rejected' && (
                          <button
                            type="button"
                            onClick={() => setChatTarget(booking)}
                            className="ml-2 text-xs font-semibold text-stone-600 border border-stone-200 bg-white px-2 py-1 rounded-md hover:bg-stone-50 hover:text-stone-900 transition inline-flex items-center gap-1"
                          >
                            <MessageSquare className="w-3.5 h-3.5" /> Message
                          </button>
                        )}`;

if (content.match(actionsRegex)) {
  content = content.replace(actionsRegex, actionsReplacement);
}

// Add the ChatDialog
const dialogsRegex = /\{exportBookingTarget && \(/;
const dialogsReplacement = `{chatTarget && user && (
        <Modal
          open={true}
          onClose={() => setChatTarget(null)}
          title={"Message " + (chatTarget.guestName || 'Guest')}
          description={"Reference: " + (chatTarget.reference || 'N/A')}
        >
          <div className="mt-2 h-[500px]">
             <BookingChat booking={chatTarget} currentUser={user} />
          </div>
        </Modal>
      )}
      {exportBookingTarget && (`

if (content.match(dialogsRegex)) {
  content = content.replace(dialogsRegex, dialogsReplacement);
}

fs.writeFileSync('src/pages/ManageHotel.tsx', content);
