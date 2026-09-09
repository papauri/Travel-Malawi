const fs = require('fs');
let code = fs.readFileSync('src/components/ReminderTemplatesModal.tsx', 'utf8');

code = code.replace(
  `    const channel = whatsappEnabled ? scheduleChannel : 'email';`,
  `    const channel = scheduleChannel;`
);

code = code.replace(
  `              {whatsappEnabled ? (`,
  `              {true ? (`
);

code = code.replace(
  `                {whatsappEnabled && (`,
  `                {true && (`
);

code = code.replace(
  `                {whatsappEnabled && (`,
  `                {true && (`
);

code = code.replace(
  `                  Schedule {whatsappEnabled && scheduleChannel === 'whatsapp' ? 'WhatsApp' : 'Email'}`,
  `                  Schedule {scheduleChannel === 'whatsapp' ? 'WhatsApp' : 'Email'}`
);

fs.writeFileSync('src/components/ReminderTemplatesModal.tsx', code);
