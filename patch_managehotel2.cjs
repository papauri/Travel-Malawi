const fs = require('fs');
let content = fs.readFileSync('src/pages/ManageHotel.tsx', 'utf8');

// Hide financials for non-managers (i.e. global admins)
const performanceSnapshotRegex = /\{\/\* Performance snapshot \*\/\}([\s\S]*?)<div className="flex gap-1 border-b border-stone-200 mb-8 overflow-x-auto scrollbar-hide -mx-6 px-6 lg:mx-0 lg:px-0">/;
if (content.match(performanceSnapshotRegex)) {
  const replacement = `{/* Performance snapshot */}
      {user?.uid === hotel.managerId && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 text-stone-400 mb-2">
              <Percent className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Occupancy · 30d</span>
            </div>
            <p className="text-3xl font-serif font-bold text-stone-900">{stats.occupancy.toFixed(0)}%</p>
            <p className="text-xs text-stone-400 mt-1">{stats.occupiedNights} of {stats.availableNights} room-nights</p>
          </div>
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 text-stone-400 mb-2">
              <Wallet className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Upcoming revenue</span>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {stats.upcomingRevenue.length === 0
                ? <p className="text-3xl font-serif font-bold text-stone-900">&mdash;</p>
                : stats.upcomingRevenue.map(([code, total]) => (
                    <p key={code} className="text-3xl font-serif font-bold text-stone-900">{formatMoney(total, code)}</p>
                  ))}
            </div>
            <p className="text-xs text-stone-400 mt-1">Confirmed stays not yet completed</p>
          </div>
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 text-stone-400 mb-2">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wider">All-time revenue</span>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {stats.allTimeRevenue.length === 0
                ? <p className="text-3xl font-serif font-bold text-stone-900">&mdash;</p>
                : stats.allTimeRevenue.map(([code, total]) => (
                    <p key={code} className="text-3xl font-serif font-bold text-stone-900">{formatMoney(total, code)}</p>
                  ))}
            </div>
            <p className="text-xs text-stone-400 mt-1">{stats.confirmedCount} confirmed booking{stats.confirmedCount === 1 ? '' : 's'}</p>
          </div>
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 text-stone-400 mb-2">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Awaiting reply</span>
            </div>
            <p className="text-3xl font-serif font-bold text-stone-900">{stats.pending}</p>
            <p className="text-xs text-stone-400 mt-1">Avg stay {stats.averageStay.toFixed(1)} nights</p>
          </div>
        </div>
      )}
      <div className="flex gap-1 border-b border-stone-200 mb-8 overflow-x-auto scrollbar-hide -mx-6 px-6 lg:mx-0 lg:px-0">`;
  content = content.replace(performanceSnapshotRegex, replacement);
}

// In the Bookings tab, hide the Total Price
const bookingCardRegex = /<div className="text-right ml-4">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<\/li>/g;
content = content.replace(bookingCardRegex, (match, inner) => {
  return `{user?.uid === hotel.managerId && (
                      <div className="text-right ml-4">
                        ${inner}
                      </div>
                    )}
                  </div>
                </div>
              </li>`;
});

// Admin Dashboard delete function
// Not here

fs.writeFileSync('src/pages/ManageHotel.tsx', content);
