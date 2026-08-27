const fs = require('fs');
let content = fs.readFileSync('firestore.rules', 'utf8');

const target = `    match /bookings/{bookingId}/messages/{messageId} {
      allow read: if isAuthenticated() && (
        resource.data.guestId == request.auth.uid ||
        resource.data.managerId == request.auth.uid ||
        isAdmin()
      );`;

const replacement = `    match /bookings/{bookingId}/messages/{messageId} {
      allow read: if isAuthenticated() && (
        bookingDoc(bookingId).guestId == request.auth.uid ||
        bookingDoc(bookingId).managerId == request.auth.uid ||
        isAdmin()
      );`;

content = content.replace(target, replacement);
fs.writeFileSync('firestore.rules', content);
