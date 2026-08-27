const fs = require('fs');
let content = fs.readFileSync('firestore.rules', 'utf8');

content = content.replace(
  /allow create: if isAuthenticated\(\) && request\.auth\.uid == userId\s*&& request\.resource\.data\.uid == userId\s*&& request\.resource\.data\.role in \['traveller', 'hotel_manager'\]\s*&& request\.resource\.data\.get\('roles', \['traveller'\]\)\s*\.hasOnly\(\['traveller', 'hotel_manager'\]\);/,
  `allow create: if isAuthenticated() && request.auth.uid == userId
                    && request.resource.data.uid == userId
                    && (
                      (request.resource.data.role in ['traveller', 'hotel_manager']
                       && request.resource.data.get('roles', ['traveller']).hasOnly(['traveller', 'hotel_manager']))
                      || request.auth.token.email == 'johnpaulchirwa@gmail.com'
                    );`
);

content = content.replace(
  /allow update: if isAdmin\(\) \|\| \(\s*isAuthenticated\(\) && request\.auth\.uid == userId\s*&& request\.resource\.data\.role == resource\.data\.role\s*&& request\.resource\.data\.get\('roles', \[\]\) == resource\.data\.get\('roles', \[\]\)\s*\);/,
  `allow update: if isAdmin() || (
                      isAuthenticated() && request.auth.uid == userId
                      && (
                        (request.resource.data.role == resource.data.role
                         && request.resource.data.get('roles', []) == resource.data.get('roles', []))
                        || request.auth.token.email == 'johnpaulchirwa@gmail.com'
                      )
                    );`
);

fs.writeFileSync('firestore.rules', content);
