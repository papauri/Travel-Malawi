const fs = require('fs');
let content = fs.readFileSync('src/pages/Home.tsx', 'utf8');

const target = `</ul>
                      </>
                    )}`;

const replacement = `</ul>
                      </>
                    ) : null}`;

content = content.replace(target, replacement);

fs.writeFileSync('src/pages/Home.tsx', content);
