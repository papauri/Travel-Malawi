sed -i -e 's/allow create:/allow create: if isAuthenticated() \&\& (/' firestore.rules
