const fs = require('fs');
let code = fs.readFileSync('src/pages/MyBookings.tsx', 'utf8');

code = code.replace(
  `  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: 'upcoming', label: 'Upcoming', count: grouped.upcoming.length },
    { key: 'past', label: 'Past stays', count: grouped.past.length },
    { key: 'cancelled', label: 'Cancelled', count: grouped.cancelled.length },
  ];`,
  `  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: 'upcoming', label: 'Upcoming', count: grouped.upcoming.length },
    { key: 'past', label: 'Past stays', count: grouped.past.length },
    { key: 'cancelled', label: 'Cancelled', count: grouped.cancelled.length },
  ];
  
  const hostGrouped = useMemo(() => {
    const upcoming: EnrichedBooking[] = [];
    const past: EnrichedBooking[] = [];
    const cancelled: EnrichedBooking[] = [];
    for (const booking of hostBookings) {
      if (booking.status === 'cancelled' || booking.status === 'rejected') cancelled.push(booking);
      else if (daysUntil(booking.checkOut) < 0) past.push(booking);
      else upcoming.push(booking);
    }
    return { upcoming, past, cancelled };
  }, [hostBookings]);
  
  const hostVisible = hostGrouped[filter];
  const activeBookings = activeMainTab === 'host' ? hostVisible : visible;
  const activeTabs = activeMainTab === 'host' ? [
    { key: 'upcoming', label: 'Upcoming', count: hostGrouped.upcoming.length },
    { key: 'past', label: 'Past stays', count: hostGrouped.past.length },
    { key: 'cancelled', label: 'Cancelled', count: hostGrouped.cancelled.length },
  ] : tabs;
  `
);

code = code.replace(
  `        <h1 className="text-4xl font-serif font-bold text-stone-900 mb-2">My Itinerary</h1>
        <p className="text-stone-500 mb-8">Manage your upcoming stays and past bookings.</p>

        {broadcasts.filter(b => !hiddenBroadcastIds.includes(b.id!)).length > 0 && filter === 'upcoming' && (`,
  `        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-6">
          <div>
            <h1 className="text-4xl font-serif font-bold text-stone-900 mb-2">
              {activeMainTab === 'host' ? 'Property Bookings' : 'My Trips'}
            </h1>
            <p className="text-stone-500">
              {activeMainTab === 'host' ? 'Manage bookings across your properties.' : 'Manage your upcoming stays and past trips.'}
            </p>
          </div>
          {managerHotels.length > 0 && (
            <div className="flex bg-stone-100 p-1 rounded-xl">
              <button
                onClick={() => setActiveMainTab('host')}
                className={\`flex-1 px-4 py-2 text-sm font-bold rounded-lg transition-all \${activeMainTab === 'host' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}\`}
              >
                Property Bookings
              </button>
              <button
                onClick={() => setActiveMainTab('guest')}
                className={\`flex-1 px-4 py-2 text-sm font-bold rounded-lg transition-all \${activeMainTab === 'guest' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}\`}
              >
                My Trips
              </button>
            </div>
          )}
        </div>

        {activeMainTab === 'guest' && broadcasts.filter(b => !hiddenBroadcastIds.includes(b.id!)).length > 0 && filter === 'upcoming' && (`
);

code = code.replace(
  `        <div className="flex border-b border-stone-200 mb-8 overflow-x-auto hide-scrollbar">
          {tabs.map((t, idx) => (`,
  `        <div className="flex border-b border-stone-200 mb-8 overflow-x-auto hide-scrollbar">
          {activeTabs.map((t, idx) => (`
);

code = code.replace(
  `        <div className="space-y-6 mb-12">
          {visible.length === 0 ? (`,
  `        <div className="space-y-6 mb-12">
          {activeBookings.length === 0 ? (`
);

code = code.replace(
  `          ) : (
            visible.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((booking, bkIdx) => {`,
  `          ) : (
            activeBookings.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((booking, bkIdx) => {`
);

code = code.replace(
  `            visible.length > itemsPerPage && (
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(visible.length / itemsPerPage)}
                onPageChange={setCurrentPage}
              />
            )
          )}`,
  `            activeBookings.length > itemsPerPage && (
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(activeBookings.length / itemsPerPage)}
                onPageChange={setCurrentPage}
              />
            )
          )}`
);

fs.writeFileSync('src/pages/MyBookings.tsx', code);
