const fs = require('fs');
let code = fs.readFileSync('src/pages/ManageHotel.tsx', 'utf8');

code = code.replace(
  `                                title={whatsappEnabled ? "Open ready-to-go email & WhatsApp reminder templates (3-Day Arrival, 24h PIN, Deposit, Check-out)" : "Open ready-to-go email reminder templates"}
                              >
                                <Mail className="w-3.5 h-3.5 text-emerald-600" />
                                {whatsappEnabled ? 'Reminders & Templates' : 'Email Templates'}`,
  `                                title="Open ready-to-go email & WhatsApp reminder templates (3-Day Arrival, 24h PIN, Deposit, Check-out)"
                              >
                                <Mail className="w-3.5 h-3.5 text-emerald-600" />
                                Reminders & Templates`
);

fs.writeFileSync('src/pages/ManageHotel.tsx', code);
