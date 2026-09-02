const fs = require('fs');
let code = fs.readFileSync('src/components/StayVoucherModal.tsx', 'utf8');

const wifiRegex = /\{\/\* Guest WiFi \*\/\}[\s\S]*?Scan QR with phone camera to connect[\s\S]*?<\/p>\s*<\/div>\s*<\/div>\s*<\/div>\s*\)\}\s*<\/div>\s*\)\}/g;

let matches = [...code.matchAll(wifiRegex)];

if (matches.length === 3) {
  // Keep the first one, delete the other two.
  code = code.substring(0, matches[1].index) + code.substring(matches[1].index + matches[1][0].length, matches[2].index) + code.substring(matches[2].index + matches[2][0].length);
  fs.writeFileSync('src/components/StayVoucherModal.tsx', code);
  console.log('Successfully patched StayVoucherModal.tsx');
} else {
  console.log('Found ' + matches.length + ' matches, expected 3.');
}
