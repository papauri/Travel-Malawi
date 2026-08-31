import re

with open('firestore.rules', 'r') as f:
    content = f.read()

broadcasts_rule = """
    match /broadcasts/{broadcastId} {
      allow read: if true;
      allow create: if isAuthenticated() && isManager(request.resource.data.hotelId)
                    && request.resource.data.managerId == request.auth.uid;
      allow update: if isAuthenticated() && isManager(resource.data.hotelId)
                    && request.resource.data.hotelId == resource.data.hotelId;
      allow delete: if isAuthenticated() && (isManager(resource.data.hotelId) || isAdmin());
    }
"""

if "match /broadcasts" not in content:
    content = content.replace("match /reviews/{reviewId} {", broadcasts_rule + "\n    match /reviews/{reviewId} {")
    with open('firestore.rules', 'w') as f:
        f.write(content)
