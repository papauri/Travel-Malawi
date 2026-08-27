sed -i -e '/match \/hotel_chats\/{chatId} {/,/match \/hotel_chats\/{chatId}\/messages\/{messageId} {/c\
    match /hotel_chats/{chatId} {\
      allow read: if isAuthenticated() && (\
        resource == null ||\
        resource.data.guestId == request.auth.uid ||\
        resource.data.managerId == request.auth.uid ||\
        isAdmin()\
      );\
      allow create: if isAuthenticated() && (\
        request.resource.data.guestId == request.auth.uid ||\
        request.resource.data.managerId == request.auth.uid ||\
        isAdmin()\
      )\
      && request.resource.data.hotelId is string\
      && request.resource.data.managerId is string\
      && request.resource.data.guestId is string;\
      allow update: if isAuthenticated() && (\
        resource.data.guestId == request.auth.uid ||\
        resource.data.managerId == request.auth.uid ||\
        isAdmin()\
      );\
      allow delete: if isAdmin();\
    }\
    match /hotel_chats/{chatId}/messages/{messageId} {' firestore.rules
