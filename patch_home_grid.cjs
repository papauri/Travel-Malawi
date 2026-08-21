const fs = require('fs');

let code = fs.readFileSync('src/pages/Home.tsx', 'utf-8');
code = code.replace(/\r\n/g, '\n');

if (!code.includes('import HotelCard')) {
  code = code.replace(
    "import { Link, useNavigate } from 'react-router-dom';",
    "import { Link, useNavigate } from 'react-router-dom';\nimport HotelCard from '../components/HotelCard';"
  );
}

// Ensure getBentoClasses is removed
const bentoStart = code.indexOf('const getBentoClasses =');
if (bentoStart > -1) {
  const bentoEnd = code.indexOf('};', bentoStart) + 2;
  code = code.substring(0, bentoStart) + code.substring(bentoEnd);
}

// Find Main Property Grid section
const startIdx = code.indexOf('{/* Main Property Grid */}');
const nextSectionIdx = code.indexOf('{/* List Your Property CTA */}');

if (startIdx > -1 && nextSectionIdx > -1) {
  const newContent = `{/* Main Property Grid */}
      <section className="max-w-7xl mx-auto px-6 lg:px-8 py-20 w-full flex-1">
        <div className="mb-12">
          <h2 className="text-3xl font-serif text-stone-900 mb-3">
            {(appliedSearch.location || appliedSearch.coords || appliedSearch.guests) ? 'Search Results' : 'Exceptional Stays'}
          </h2>
          <p className="text-stone-500 text-lg">
            {(appliedSearch.location || appliedSearch.coords || appliedSearch.guests) ? 'Based on your search filters.' : 'Curated properties offering the best of Malawi.'}
          </p>
        </div>
        
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 gap-y-10">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex flex-col gap-3">
                <div className="animate-pulse bg-stone-200 rounded-2xl aspect-[4/3] w-full" />
                <div className="animate-pulse bg-stone-200 h-5 w-2/3 rounded mt-1" />
                <div className="animate-pulse bg-stone-200 h-4 w-1/2 rounded" />
              </div>
            ))}
          </div>
        ) : hotels.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 gap-y-10">
            {filteredHotels.length > 0 ? filteredHotels.map((hotel, index) => (
              <HotelCard key={hotel.id} hotel={hotel} index={index} searchParams={appliedSearch} />
            )) : (
              <div className="col-span-full py-20 text-center text-stone-500 text-lg">
                No properties found matching your search. Try different dates or locations.
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-20 text-stone-500">
            No properties available at the moment.
          </div>
        )}
      </section>

      `;
        
  code = code.substring(0, startIdx) + newContent + code.substring(nextSectionIdx);
  console.log('Replaced correctly');
} else {
  console.log('ERROR: Could not find section markers');
}

fs.writeFileSync('src/pages/Home.tsx', code, 'utf-8');
