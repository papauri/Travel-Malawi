sed -i -e '/match \/hotel_chats\/{chatId}\/messages\/{messageId} {/,/allow create:/c\
    match /hotel_chats/{chatId}/messages/{messageId} {\
      allow read: if isAuthenticated() && (\
        (exists(/databases/$(database)/documents/hotel_chats/$(chatId)) && (\
          get(/databases/$(database)/documents/hotel_chats/$(chatId)).data.guestId == request.auth.uid ||\
          get(/databases/$(database)/documents/hotel_chats/$(chatId)).data.managerId == request.auth.uid\
        )) ||\
        chatId.matches(".*_" + request.auth.uid) ||\
        isAdmin()\
      );\
      allow create:' firestore.rules
