const fs = require('fs');
let content = fs.readFileSync('firestore.rules', 'utf8');

const target = `    match /bookings/{bookingId} {`;

const messagesMatch = `    match /bookings/{bookingId}/messages/{messageId} {
      allow read: if isAuthenticated() && (
        resource.data.guestId == request.auth.uid ||
        resource.data.managerId == request.auth.uid ||
        isAdmin()
      );
      allow create: if isAuthenticated() && (
        request.resource.data.guestId == request.auth.uid ||
        request.resource.data.managerId == request.auth.uid ||
        isAdmin()
      )
      && request.resource.data.bookingId == bookingId
      && request.resource.data.guestId == bookingDoc(bookingId).guestId
      && request.resource.data.hotelId == bookingDoc(bookingId).hotelId
      && request.resource.data.managerId == bookingDoc(bookingId).managerId
      && request.resource.data.text is string
      && request.resource.data.text.size() > 0
      && request.resource.data.text.size() <= 2000
      && request.resource.data.senderId == request.auth.uid
      && request.resource.data.createdAt is number
      && request.resource.data.senderName is string
      && request.resource.data.senderName.size() <= 100;
      
      allow update, delete: if false;
    }

    match /bookings/{bookingId} {`;

content = content.replace(target, messagesMatch);

fs.writeFileSync('firestore.rules', content);
