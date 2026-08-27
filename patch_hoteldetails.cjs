const fs = require('fs');
let content = fs.readFileSync('src/pages/HotelDetails.tsx', 'utf8');

// The mobile sticky bar to inject
const stickyBar = `
      {/* Mobile Sticky Book Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-stone-200 px-6 py-4 pb-safe-4 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-0.5">Rooms from</div>
          <div className="text-xl font-serif text-stone-900">
            {rooms.length > 0 ? (
              formatMoney(
                Math.min(...rooms.map(r => roomPrice(r, currency) || 0).filter(p => p > 0)),
                currency
              )
            ) : (
              '--'
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            document.getElementById('rooms-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
          className="bg-stone-900 text-white px-8 py-3.5 rounded-full font-semibold hover:bg-emerald-700 transition"
        >
          Select room
        </button>
      </div>
    </>
  );
}`;

content = content.replace(/<\/>\n\s*\);\n\}/, stickyBar);

fs.writeFileSync('src/pages/HotelDetails.tsx', content);
