const fs = require('fs');

let content = fs.readFileSync('src/components/Navbar.tsx', 'utf8');

// 1. Add dot indicator to avatar
content = content.replace(
  '{initials}\n                      </div>',
  `{initials}
                      </div>
                      {hosting && presence && (
                        <div className={\`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white \${
                          presence.status === 'online' ? 'bg-emerald-500' :
                          presence.status === 'away' ? 'bg-amber-400' : 'bg-stone-300'
                        }\`} />
                      )}`
);

content = content.replace(
  '<ChevronDown className="h-3.5 w-3.5 text-stone-400" />',
  `<ChevronDown className="h-3.5 w-3.5 text-stone-400" />
                    </button>`
);
// wait, let's just do it cleanly

content = fs.readFileSync('src/components/Navbar.tsx', 'utf8');

// The avatar container replacement
const avatarTarget = `<div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold tracking-wide">
                        {initials}
                      </div>`;
const avatarReplacement = `<div className="relative">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold tracking-wide">
                          {initials}
                        </div>
                        {hosting && presence && (
                          <div className={\`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white \${
                            presence.status === 'online' ? 'bg-emerald-500' :
                            presence.status === 'away' ? 'bg-amber-400' : 'bg-stone-400'
                          }\`} />
                        )}
                      </div>`;
content = content.replace(avatarTarget, avatarReplacement);

// The menu options replacement
const menuTarget = `<div className="py-1 border-b border-stone-100">
                          <Link
                            to="/profile"`;
const menuReplacement = `
                        {hosting && presence && (
                          <div className="py-2 border-b border-stone-100 px-4">
                            <p className="text-xs text-stone-400 font-semibold mb-2">Availability</p>
                            <div className="flex flex-col gap-1">
                              {(['online', 'away', 'offline'] as PresenceStatus[]).map(status => (
                                <button
                                  key={status}
                                  onClick={() => setManualStatus(status)}
                                  className={\`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition \${presence.status === status ? 'bg-stone-100 text-stone-900 font-medium' : 'text-stone-600 hover:bg-stone-50'}\`}
                                >
                                  <div className={\`h-2 w-2 rounded-full \${
                                    status === 'online' ? 'bg-emerald-500' :
                                    status === 'away' ? 'bg-amber-400' : 'bg-stone-400'
                                  }\`} />
                                  <span className="capitalize">{status}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="py-1 border-b border-stone-100">
                          <Link
                            to="/profile"`;
content = content.replace(menuTarget, menuReplacement);

fs.writeFileSync('src/components/Navbar.tsx', content);
