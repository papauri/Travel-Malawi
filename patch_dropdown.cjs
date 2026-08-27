const fs = require('fs');
let content = fs.readFileSync('src/pages/Home.tsx', 'utf8');

const targetDropdown = `{showRecentSearches && recentSearches.length > 0 && (
                <div className="absolute left-0 top-full mt-2 w-full min-w-[280px] bg-white rounded-2xl shadow-xl ring-1 ring-stone-950/5 overflow-hidden z-50">
                  <div className="p-3">
                    <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2 px-3">Recent Searches</h4>
                    <ul className="space-y-1">
                      {recentSearches.map((rs, i) => (
                        <li key={i}>
                          <button
                            type="button"
                            onClick={() => {
                              setSearchLocation(rs.location);
                              setAdults(rs.adults);
                              setChildren(rs.children);
                              setRoomsWanted(rs.roomsWanted);
                              setShowRecentSearches(false);
                            }}
                            className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-stone-50 transition flex items-center gap-3 group/item"
                          >
                            <div className="h-8 w-8 rounded-full bg-stone-100 flex items-center justify-center shrink-0 group-hover/item:bg-white group-hover/item:shadow-sm transition">
                              <Clock className="w-4 h-4 text-stone-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-stone-700 text-sm truncate">{rs.location}</div>
                              <div className="text-xs text-stone-400 truncate">
                                {rs.adults + rs.children} Guest{rs.adults + rs.children !== 1 ? 's' : ''}
                              </div>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}`;

const replacementDropdown = `{showRecentSearches && (searchSuggestions.length > 0 || (!searchLocation.trim() && recentSearches.length > 0)) && (
                <div className="absolute left-0 top-full mt-2 w-full min-w-[280px] bg-white rounded-2xl shadow-xl ring-1 ring-stone-950/5 overflow-hidden z-50">
                  <div className="p-3">
                    {searchLocation.trim() && searchSuggestions.length > 0 ? (
                      <>
                        <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2 px-3">Suggestions</h4>
                        <ul className="space-y-1">
                          {searchSuggestions.map((suggestion, i) => (
                            <li key={i}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSearchLocation(suggestion.text);
                                  setShowRecentSearches(false);
                                  applySearch({
                                    location: suggestion.text,
                                    checkIn: searchCheckIn,
                                    checkOut: searchCheckOut,
                                    guests: totalGuests,
                                    coords: null,
                                    proximity: searchProximity,
                                  });
                                }}
                                className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-stone-50 transition flex items-center gap-3 group/item"
                              >
                                <div className="h-8 w-8 rounded-full bg-stone-100 flex items-center justify-center shrink-0 group-hover/item:bg-white group-hover/item:shadow-sm transition">
                                  {suggestion.type === 'location' ? <MapPin className="w-4 h-4 text-stone-400" /> : <Search className="w-4 h-4 text-stone-400" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-stone-700 text-sm truncate">{suggestion.text}</div>
                                  {suggestion.subtitle && (
                                    <div className="text-xs text-stone-400 truncate">{suggestion.subtitle}</div>
                                  )}
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : !searchLocation.trim() && recentSearches.length > 0 ? (
                      <>
                        <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2 px-3">Recent Searches</h4>
                        <ul className="space-y-1">
                          {recentSearches.map((rs, i) => (
                            <li key={i}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSearchLocation(rs.location);
                                  setAdults(rs.adults);
                                  setChildren(rs.children);
                                  setRoomsWanted(rs.roomsWanted);
                                  setShowRecentSearches(false);
                                }}
                                className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-stone-50 transition flex items-center gap-3 group/item"
                              >
                                <div className="h-8 w-8 rounded-full bg-stone-100 flex items-center justify-center shrink-0 group-hover/item:bg-white group-hover/item:shadow-sm transition">
                                  <Clock className="w-4 h-4 text-stone-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-stone-700 text-sm truncate">{rs.location}</div>
                                  <div className="text-xs text-stone-400 truncate">
                                    {rs.adults + rs.children} Guest{rs.adults + rs.children !== 1 ? 's' : ''}
                                  </div>
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                </div>
              )}`;

if (content.includes(targetDropdown)) {
  content = content.replace(targetDropdown, replacementDropdown);
  fs.writeFileSync('src/pages/Home.tsx', content);
  console.log('Dropdown patched successfully');
} else {
  console.log('Dropdown patch failed, target not found');
}
