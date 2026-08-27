const fs = require('fs');
let content = fs.readFileSync('src/pages/ManageHotel.tsx', 'utf8');

const modalStr = `      {chatTarget && user && (
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
      <ConfirmDialog
        isOpen={!!bookingToDelete}`;

content = content.replace(`<ConfirmDialog
        isOpen={!!bookingToDelete}`, modalStr);

fs.writeFileSync('src/pages/ManageHotel.tsx', content);
