const fs = require('fs');
let code = fs.readFileSync('src/pages/ManageHotel.tsx', 'utf8');

if (!code.includes('ManagerWhatsAppTemplatesHub')) {
  code = code.replace(
    `import ManagerEmailTemplatesHub from '../components/ManagerEmailTemplatesHub';`,
    `import ManagerEmailTemplatesHub from '../components/ManagerEmailTemplatesHub';
import ManagerWhatsAppTemplatesHub from '../components/ManagerWhatsAppTemplatesHub';`
  );

  code = code.replace(
    `      {/* TAB CONTENT: EMAIL TEMPLATES & AUTOMATION */}
      {activeTab === 'templates' && (
        <ManagerEmailTemplatesHub`,
    `      {/* TAB CONTENT: EMAIL TEMPLATES & AUTOMATION */}
      {activeTab === 'templates' && (
        <>
          <ManagerWhatsAppTemplatesHub
            hotel={hotel}
            onHotelUpdate={updated => {
              setHotel(updated);
              setEditHotelData(updated);
            }}
          />
          <ManagerEmailTemplatesHub`
  );

  code = code.replace(
    `        <ManagerEmailTemplatesHub
          hotel={hotel}
          onHotelUpdate={updated => {
            setHotel(updated);
            setEditHotelData(updated);
          }}
          currentUserEmail={user?.email}
        />
      )}`,
    `        <ManagerEmailTemplatesHub
          hotel={hotel}
          onHotelUpdate={updated => {
            setHotel(updated);
            setEditHotelData(updated);
          }}
          currentUserEmail={user?.email}
        />
        </>
      )}`
  );

  fs.writeFileSync('src/pages/ManageHotel.tsx', code);
}
