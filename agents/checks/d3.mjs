#!/usr/bin/env node
// D3 gate: booking / in-app chat surfaces must be gated by the platform mode switch
// (agents/directives/D3-directory-mode.md).
// Usage: node agents/checks/d3.mjs [file ...]   (no args = src/, server/docs/*.md)
//  - .ts/.tsx: a file that renders or writes a booking/chat surface must reference the switch
//    (usePlatformMode / bookingsEnabled / requireBookingMode / getPlatformMode).
//  - server/docs/*.md: booking/chat wording must sit inside <!-- booking-only --> ... <!-- /booking-only -->.
import fs from 'node:fs';
import path from 'node:path';

const SURFACE = [
  ['booking-ui', /\b(Book now|Book this|Reserve( now)?|Request to book|Confirm (your )?booking|Complete booking|Check availability)\b/g],
  ['chat-ui', /\b(Chat with|Message (the )?(host|property|guest)|Start (a )?chat|Call (the )?(host|property|guest))\b/g],
  ['booking-write', /collection\(db,\s*['"](bookings|booking_slots)['"]\)[^;]*\)\s*[,;]?\s*$|addDoc\(collection\(db,\s*['"]bookings['"]|createBooking\(|useConfirmBooking\(/gm],
  ['chat-mount', /<(BookingChat|PropertyChat|CallModal|ActiveChatsMenu)\b|openChat\(|useChatModal\(/g],
];
const GATE = /usePlatformMode|bookingsEnabled|requireBookingMode|getPlatformMode/;
const DOC_WORDS = /\b(book(ing|ings|ed)?|reserv(e|ation|ations)|in-app chat|chat with|message the host|deposit|check-?in reminder|confirm(ed)? stay)\b/gi;

const walk = (dir, re) => fs.existsSync(dir)
  ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      return e.isDirectory() ? walk(p, re) : re.test(e.name) ? [p] : [];
    })
  : [];
const args = process.argv.slice(2);
const files = args.length ? args : [...walk('src', /\.(tsx|ts)$/), ...walk('server/docs', /\.md$/)];

let total = 0;
const rows = [];
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const name = f.replace(/\\/g, '/');
  if (name.endsWith('.md')) {
    const outside = src.replace(/<!--\s*booking-only\s*-->[\s\S]*?<!--\s*\/booking-only\s*-->/g, '');
    const n = (outside.match(DOC_WORDS) || []).length;
    if (n) rows.push([n, name, `ungated-doc-wording:${n}`]);
    total += n;
    continue;
  }
  if (GATE.test(src) || name.endsWith('PlatformModeContext.tsx')) continue;
  const hits = SURFACE.map(([k, re]) => [k, (src.match(re) || []).length]).filter(([, n]) => n);
  const n = hits.reduce((s, [, c]) => s + c, 0);
  if (n) rows.push([n, name, hits.map(([k, c]) => `${k}:${c}`).join(' ')]);
  total += n;
}
rows.sort((a, b) => b[0] - a[0]).forEach(([n, f, d]) => console.log(`${String(n).padStart(4)}  ${f}  ${d}`));
console.log(`\nD3 hits: ${total} in ${rows.length} files (a hit = a booking/chat surface not gated by the platform mode switch; review each)`);
