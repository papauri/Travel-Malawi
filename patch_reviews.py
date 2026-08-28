import re

with open("src/pages/HotelDetails.tsx", "r") as f:
    text = f.read()

# 1. Add state
text = text.replace("const [currentReviewPage, setCurrentReviewPage] = useState(1);", "const [currentReviewPage, setCurrentReviewPage] = useState(1);\n  const [reviewSort, setReviewSort] = useState<'recent' | 'highest'>('recent');")

# 2. Modify useMemo
old_usememo = """  const allReviews = useMemo(() => {
    const written = reviews.map(r => ({
      key: r.id ?? `review-${r.createdAt}`,
      author: r.authorName || 'Guest',
      rating: r.rating,
      text: r.text,
      date: new Date(r.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      source: 'Travel-Malawi',
      verified: true,
    }));

    const imported = (hotel?.reviews ?? []).map((r, i) => ({
      key: `imported-${i}`,
      author: r.author || 'Guest',
      rating: r.rating,
      text: r.text,
      date: r.date,
      source: r.source,
      verified: false,
    }));

    return [...written, ...imported];
  }, [hotel?.reviews, reviews]);"""

new_usememo = """  const allReviews = useMemo(() => {
    const written = reviews.map(r => ({
      key: r.id ?? `review-${r.createdAt}`,
      author: r.authorName || 'Guest',
      rating: r.rating,
      text: r.text,
      date: new Date(r.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      timestamp: r.createdAt,
      source: 'Travel-Malawi',
      verified: true,
    }));

    const imported = (hotel?.reviews ?? []).map((r, i) => {
      let ts = 0;
      try { ts = new Date(r.date).getTime(); } catch (e) {}
      if (isNaN(ts)) ts = 0;
      return {
        key: `imported-${i}`,
        author: r.author || 'Guest',
        rating: r.rating,
        text: r.text,
        date: r.date,
        timestamp: ts,
        source: r.source,
        verified: false,
      };
    });

    const combined = [...written, ...imported];
    if (reviewSort === 'highest') {
      combined.sort((a, b) => b.rating - a.rating || b.timestamp - a.timestamp);
    } else {
      combined.sort((a, b) => b.timestamp - a.timestamp);
    }
    return combined;
  }, [hotel?.reviews, reviews, reviewSort]);"""

text = text.replace(old_usememo, new_usememo)

# 3. Add dropdown UI
old_reviews_header = """          <div id="reviews" className="mb-24 mt-8 border-t border-stone-200 pt-12">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
              <div className="flex flex-wrap items-baseline gap-4">
                <h2 className="text-4xl md:text-5xl font-serif text-stone-900 tracking-tight">Guest Reviews</h2>
                {ratingSummary && (
                  <span className="text-stone-500 text-lg">
                    {ratingSummary.average.toFixed(1)} average from {ratingSummary.count} review{ratingSummary.count === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              <button
                onClick={() => setIsReviewModalOpen(true)}
                className="flex items-center gap-2 bg-stone-900 hover:bg-emerald-700 text-white px-6 py-3 rounded-full font-bold transition whitespace-nowrap active:scale-95 shadow-sm self-start sm:self-auto"
              >
                <Star className="h-4 w-4" />
                Write a Review
              </button>
            </div>"""

new_reviews_header = """          <div id="reviews" className="mb-24 mt-8 border-t border-stone-200 pt-12">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-baseline gap-4">
                  <h2 className="text-4xl md:text-5xl font-serif text-stone-900 tracking-tight">Guest Reviews</h2>
                  {ratingSummary && (
                    <span className="text-stone-500 text-lg">
                      {ratingSummary.average.toFixed(1)} average from {ratingSummary.count} review{ratingSummary.count === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
                {allReviews.length > 0 && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-sm font-medium text-stone-500 uppercase tracking-wider">Sort by</span>
                    <select
                      value={reviewSort}
                      onChange={(e) => {
                        setReviewSort(e.target.value as 'recent' | 'highest');
                        setCurrentReviewPage(1); // reset pagination
                      }}
                      className="bg-stone-50 border border-stone-200 text-stone-700 text-sm rounded-full px-4 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition-shadow appearance-none pr-8 relative cursor-pointer"
                      style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2378716c%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '1em' }}
                    >
                      <option value="recent">Most Recent</option>
                      <option value="highest">Highest Rated</option>
                    </select>
                  </div>
                )}
              </div>
              <button
                onClick={() => setIsReviewModalOpen(true)}
                className="flex items-center gap-2 bg-stone-900 hover:bg-emerald-700 text-white px-6 py-3 rounded-full font-bold transition whitespace-nowrap active:scale-95 shadow-sm self-start sm:self-auto"
              >
                <Star className="h-4 w-4" />
                Write a Review
              </button>
            </div>"""

text = text.replace(old_reviews_header, new_reviews_header)

with open("src/pages/HotelDetails.tsx", "w") as f:
    f.write(text)

