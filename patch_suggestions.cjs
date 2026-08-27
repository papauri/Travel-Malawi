const fs = require('fs');
const content = fs.readFileSync('src/pages/Home.tsx', 'utf8');

const target = 'const hasSearch = !!(appliedSearch.location || appliedSearch.coords || appliedSearch.checkIn || appliedSearch.guests);';

const replacement = `
  const searchSuggestions = useMemo(() => {
    if (!searchLocation.trim()) return [];
    
    const query = searchLocation.toLowerCase().trim();
    const suggestions = [];
    
    // Extract unique locations
    const locations = Array.from(new Set(hotels.map(h => h.location.trim()))).filter(loc => loc.toLowerCase().includes(query));
    
    locations.forEach(loc => {
      suggestions.push({ type: 'location', text: loc });
    });
    
    // Extract hotels
    const matchingHotels = hotels.filter(h => 
      h.name.toLowerCase().includes(query) || 
      (h.locationNotes && h.locationNotes.toLowerCase().includes(query))
    );
    
    matchingHotels.forEach(h => {
      suggestions.push({ type: 'hotel', text: h.name, id: h.id, subtitle: h.location });
    });
    
    return suggestions.slice(0, 8); // Limit to top 8 suggestions
  }, [searchLocation, hotels]);

  const hasSearch = !!(appliedSearch.location || appliedSearch.coords || appliedSearch.checkIn || appliedSearch.guests);
`;

fs.writeFileSync('src/pages/Home.tsx', content.replace(target, replacement));
