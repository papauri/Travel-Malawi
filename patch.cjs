const fs = require("fs");
let code = fs.readFileSync("src/pages/Home.tsx", "utf-8");

const regex = /const testHotels = \[[\s\S]*?\];/;
const replacement = `const testHotels = [
        {
          name: "Pumulani Lodge",
          location: "Lake Malawi National Park",
          coordinates: { lat: -14.0152, lng: 34.8258 },
          description: "Situated on the lush hills of the Nankumba Peninsula, Pumulani offers luxurious villas with stunning views over Lake Malawi. The ultimate in elegant, sustainable luxury.",
          imageUrl: "https://www.robinpopesafaris.net/wp-content/uploads/camporlodge-pumulani-lodge-84.jpg",
          categories: ["Lake & Beach", "Luxury", "Romantic Escape"],
          galleryUrls: [
            "https://www.robinpopesafaris.net/wp-content/uploads/safari-safari-october-21-1000x563.jpg",
            "https://www.robinpopesafaris.net/wp-content/uploads/Pumulani004reduced-1000x563.jpg"
          ],
          reviews: [
            { author: "Sarah M.", rating: 5, text: "Paradise on Lake Malawi! Spectacular location and views. The villas are incredibly spacious and the staff goes above and beyond.", source: "TripAdvisor", date: "Oct 2023" },
            { author: "David K.", rating: 5, text: "Most relaxing place we've ever been. The sunset cruise on the traditional dhow was unforgettable.", source: "TripAdvisor", date: "Sep 2023" }
          ]
        },
        {
          name: "Kaya Mawa",
          location: "Likoma Island, Lake Malawi",
          coordinates: { lat: -12.0939, lng: 34.7044 },
          description: "An award-winning luxury eco-lodge offering exclusive accommodation on a beautiful crescent beach on Likoma Island. Voted one of the most romantic places on earth.",
          imageUrl: "https://greensafaris.com/img/processed/kaya-new/kaya-mawa-lodge-dinner-on-the-deck.jpg",
          categories: ["Lake & Beach", "Luxury", "Romantic Escape"],
          galleryUrls: [
            "https://greensafaris.com/img/processed/kaya-new/kaya-mawa-lodge-madimba-pool.jpg",
            "https://greensafaris.com/img/processed/kaya-new/kaya-mawa-lodge-reviews.jpg"
          ],
          reviews: [
            { author: "Jessica T.", rating: 5, text: "A slice of heaven. The rooms are stunning and right on the beach. You can literally walk out of your room into the crystal clear water.", source: "TripAdvisor", date: "Aug 2023" },
            { author: "Mark R.", rating: 5, text: "The perfect honeymoon destination. Private, romantic, and the food is Michelin-star quality.", source: "TripAdvisor", date: "Jul 2023" }
          ]
        },
        {
          name: "Sunbird Ku Chawe",
          location: "Zomba Plateau",
          coordinates: { lat: -15.3524, lng: 35.3023 },
          description: "Perched on the edge of the Zomba Plateau, this premier mountain resort offers breathtaking panoramic views of southern Malawi and serene forest walks.",
          imageUrl: "https://upload.wikimedia.org/wikipedia/commons/1/15/Mulunguzi_dam_on_Zomba_Plateau.jpg",
          categories: ["Adventure", "Family"],
          galleryUrls: [
            "https://images.unsplash.com/photo-1542314831-c6a4d1409e1c?q=80&w=2865&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=2940&auto=format&fit=crop"
          ],
          reviews: [
            { author: "Emily B.", rating: 4, text: "The view from the restaurant terrace is unmatched. A great base for hiking the plateau.", source: "TripAdvisor", date: "Nov 2023" },
            { author: "James W.", rating: 4, text: "Beautiful location in the clouds. Very peaceful, especially sitting by the log fire in the evenings.", source: "TripAdvisor", date: "Aug 2023" }
          ]
        },
        {
          name: "Blue Zebra Island Lodge",
          location: "Nankoma Island",
          coordinates: { lat: -13.8862, lng: 34.6085 },
          description: "A wild paradise on a private island, part of the UNESCO World Heritage Site, offering safari tents and chalets hidden in the pristine wilderness.",
          imageUrl: "https://bluezebra.mw/wp-content/uploads/2020/03/blue-zebra-lodge-accomodation-bookings-malawi-lodge-accomodation-activites-nature-pool-drinks-1.jpg",
          categories: ["Safari & Wildlife", "Lake & Beach", "Adventure"],
          galleryUrls: [
            "https://bluezebra.mw/wp-content/uploads/2020/05/WETU-1.jpg",
            "https://bluezebra.mw/wp-content/uploads/2025/06/10-Blue-Zebra-Island-Lodge-Dry-season-Michael-Wendel-scaled.jpg"
          ],
          reviews: [
            { author: "Oliver C.", rating: 5, text: "Incredible snorkeling right off the island. We saw so many colorful cichlid fish. A true eco-lodge.", source: "TripAdvisor", date: "Dec 2023" },
            { author: "Anna S.", rating: 5, text: "Felt like we were on our own private island. The birdlife is spectacular.", source: "TripAdvisor", date: "Oct 2023" }
          ]
        },
        {
          name: "Mvuu Camp & Lodge",
          location: "Liwonde National Park",
          coordinates: { lat: -14.8398, lng: 35.2974 },
          description: "Nestled along the banks of the Shire River, this lodge offers unparalleled wildlife viewing and incredible river safaris with elephants and hippos.",
          imageUrl: "https://upload.wikimedia.org/wikipedia/commons/4/4e/Liwonde_National_Park.jpg",
          categories: ["Safari & Wildlife", "Family", "Adventure"],
          galleryUrls: [
            "https://images.unsplash.com/photo-1516426122078-c23e76319801?q=80&w=2936&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1614531341773-3bff8b7cb3fc?q=80&w=2932&auto=format&fit=crop"
          ],
          reviews: [
            { author: "Robert T.", rating: 5, text: "The boat safari on the Shire river is an absolute must! Saw hundreds of hippos and elephants bathing.", source: "TripAdvisor", date: "Jan 2024" },
            { author: "Linda P.", rating: 5, text: "Authentic wilderness experience. Waking up to the sound of hippos outside our tent was incredible.", source: "TripAdvisor", date: "Nov 2023" }
          ]
        }
      ];`;

code = code.replace(regex, replacement);
code = code.replace(
  "coordinates: { lat: -13.9626 + (Math.random() - 0.5), lng: 34.7816 + (Math.random() - 0.5) }",
  "coordinates: h.coordinates"
);

fs.writeFileSync("src/pages/Home.tsx", code, "utf-8");
