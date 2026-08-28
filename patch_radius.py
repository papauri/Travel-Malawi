import re

with open("src/pages/Home.tsx", "r") as f:
    text = f.read()

# 1. State
state_target = "  const [mapAmenityFilter, setMapAmenityFilter] = useState<string>('all');"
state_replacement = state_target + "\n  const [mapRadius, setMapRadius] = useState<number | 'any'>('any');"
text = text.replace(state_target, state_replacement)

# 2. count
count_target = """  const activeMapFiltersCount = useMemo(() => {
    let count = 0;
    if (mapSearchText.trim()) count++;
    if (mapPriceRange !== 'all') count++;
    if (isPriceFiltered) count++;
    if (mapMinRating > 0) count++;
    if (mapAmenityFilter !== 'all') count++;
    if (activeCategory !== 'All') count++;
    return count;
  }, [mapSearchText, mapPriceRange, isPriceFiltered, mapMinRating, mapAmenityFilter, activeCategory]);"""
count_replacement = """  const activeMapFiltersCount = useMemo(() => {
    let count = 0;
    if (mapSearchText.trim()) count++;
    if (mapPriceRange !== 'all') count++;
    if (isPriceFiltered) count++;
    if (mapMinRating > 0) count++;
    if (mapAmenityFilter !== 'all') count++;
    if (mapRadius !== 'any') count++;
    if (activeCategory !== 'All') count++;
    return count;
  }, [mapSearchText, mapPriceRange, isPriceFiltered, mapMinRating, mapAmenityFilter, activeCategory, mapRadius]);"""
text = text.replace(count_target, count_replacement)

# 3. clear
clear_target = """  const clearMapFilters = () => {
    setMapSearchText('');
    setMapPriceRange('all');
    setPriceRange([priceLimitMin, priceLimitMax]);
    setIncludeUnpricedRooms(true);
    setMapMinRating(0);
    setMapAmenityFilter('all');
    setActiveCategory('All');
    setActiveAmenities([]);
  };"""
clear_replacement = """  const clearMapFilters = () => {
    setMapSearchText('');
    setMapPriceRange('all');
    setPriceRange([priceLimitMin, priceLimitMax]);
    setIncludeUnpricedRooms(true);
    setMapMinRating(0);
    setMapAmenityFilter('all');
    setMapRadius('any');
    setActiveCategory('All');
    setActiveAmenities([]);
  };"""
text = text.replace(clear_target, clear_replacement)

# 4. filter logic
filter_target = """        // Map Minimum Rating filter
        if (mapMinRating > 0) {
          const avg = entry.rating?.average ?? 0;
          if (avg < mapMinRating) return false;
        }"""
filter_replacement = filter_target + """

        // Map Radius filter
        if (showUserLocation && userLocation && mapRadius !== 'any') {
          if (entry.userDistance === null || entry.userDistance > mapRadius) return false;
        }"""
text = text.replace(filter_target, filter_replacement)

# 5. UI dropdown
ui_target = """                      {/* Amenity Filter */}
                      <select
                        value={mapAmenityFilter}
                        onChange={(e) => setMapAmenityFilter(e.target.value)}
                        className="text-xs font-medium bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 rounded-lg px-2.5 py-1 focus:outline-none"
                      >
                        <option value="all">Amenity: Any</option>
                        <option value="beach">Lakefront / Beach</option>
                        <option value="pool">Swimming Pool</option>
                        <option value="wifi">Wi-Fi</option>
                        <option value="restaurant">Restaurant</option>
                      </select>"""
ui_replacement = ui_target + """

                      {/* Radius Filter (Only visible if location enabled) */}
                      {showUserLocation && (
                        <select
                          value={mapRadius}
                          onChange={(e) => setMapRadius(e.target.value === 'any' ? 'any' : Number(e.target.value))}
                          className="text-xs font-medium bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 rounded-lg px-2.5 py-1 focus:outline-none"
                        >
                          <option value="any">Radius: Any</option>
                          <option value={5}>Within 5 km</option>
                          <option value={10}>Within 10 km</option>
                          <option value={25}>Within 25 km</option>
                          <option value={50}>Within 50 km</option>
                          <option value={100}>Within 100 km</option>
                        </select>
                      )}"""
text = text.replace(ui_target, ui_replacement)

with open("src/pages/Home.tsx", "w") as f:
    f.write(text)

