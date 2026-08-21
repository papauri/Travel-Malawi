const fs = require('fs');
let code = fs.readFileSync('src/pages/HotelDetails.tsx', 'utf-8');
code = code.replace(/\r\n/g, '\n');

// 1. Redesign Hero to full-bleed cinematic (Rosello style)
const oldHero = `<div className="w-full max-w-[90rem] mx-auto px-4 lg:px-12 mt-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:h-[70vh]">
          {/* Main Hero Image */}
          <div className="md:col-span-2 md:row-span-2 relative rounded-2xl overflow-hidden h-[40vh] md:h-full">
            <img src={hotel.imageUrl} alt={hotel.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 w-full p-8 md:p-12">
              <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-5xl md:text-7xl lg:text-[6rem] font-serif font-medium tracking-tight text-white mb-4 leading-none"
              >
                {hotel.name}
              </motion.h1>
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex items-center text-white/90 gap-2 text-lg"
              >
                <MapPin className="h-5 w-5" />
                <span>{hotel.location}</span>
              </motion.div>
            </div>
          </div>
          
          {/* Secondary Gallery Images */}
          {hotel.galleryUrls && hotel.galleryUrls.map((url, index) => (
            <div key={index} className={\`relative rounded-2xl overflow-hidden hidden md:block \${index === 0 ? 'md:col-span-2 md:row-span-1' : 'md:col-span-2 md:row-span-1'}\`}>
              <img src={url} alt={\`\${hotel.name} surroundings \${index + 1}\`} className="w-full h-full object-cover hover:scale-105 transition duration-700 ease-out" />
            </div>
          ))}
          {!hotel.galleryUrls && (
            <>
              <div className="relative rounded-2xl overflow-hidden hidden md:block md:col-span-2 md:row-span-1 bg-stone-100 flex items-center justify-center">
                <span className="text-stone-400">No additional photo</span>
              </div>
              <div className="relative rounded-3xl overflow-hidden hidden md:block md:col-span-2 md:row-span-1 bg-stone-100 flex items-center justify-center">
                <span className="text-stone-400">No additional photo</span>
              </div>
            </>
          )}
        </div>
      </div>`;

const newHero = `
      {/* Rosello Full-Bleed Hero */}
      <div className="relative w-full h-[85vh] lg:h-[95vh] overflow-hidden bg-stone-900">
        <motion.img 
          initial={{ scale: 1 }}
          animate={{ scale: 1.05 }}
          transition={{ duration: 25, repeat: Infinity, repeatType: "reverse", ease: "linear" }}
          src={hotel.imageUrl} 
          alt={hotel.name} 
          className="absolute inset-0 w-full h-full object-cover opacity-80" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-900 via-stone-900/40 to-transparent" />
        
        <div className="absolute bottom-0 left-0 w-full px-6 lg:px-16 pb-16 md:pb-24 max-w-[100rem] mx-auto flex flex-col justify-end h-full">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="flex items-center gap-3 text-emerald-400 mb-6 font-medium tracking-[0.2em] uppercase text-sm">
              <MapPin className="h-4 w-4" />
              {hotel.location}
            </div>
            <h1 className="text-5xl sm:text-7xl md:text-[8rem] lg:text-[10rem] font-serif font-normal tracking-tighter text-white leading-[0.9] mb-8 max-w-6xl">
              {hotel.name}
            </h1>
            <div className="flex items-center gap-8 text-white/80">
              <span className="uppercase tracking-widest text-xs font-bold border-b border-white/30 pb-1">Scroll to explore</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Rosello Mini-Gallery Row */}
      {hotel.galleryUrls && hotel.galleryUrls.length > 0 && (
        <div className="w-full px-6 lg:px-16 -mt-12 relative z-10 max-w-[100rem] mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {hotel.galleryUrls.slice(0, 4).map((url, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="aspect-square md:aspect-[4/3] rounded-xl overflow-hidden shadow-2xl"
              >
                <img src={url} className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" alt="Gallery" />
              </motion.div>
            ))}
          </div>
        </div>
      )}
`;

code = code.replace(oldHero, newHero);

// 2. Redesign Rooms Section to Rosello Horizontal Cards
const oldRoomsRegex = /<div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">([\s\S]*?)<\/div>\n          \)}/m;

const newRooms = `<div className="flex flex-col gap-20 mb-24">
              {rooms.map((room, idx) => (
                <motion.div 
                  key={room.id} 
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                  className={\`flex flex-col \${idx % 2 === 1 ? 'lg:flex-row-reverse' : 'lg:flex-row'} gap-10 lg:gap-20 items-center\`}
                >
                  <div className="w-full lg:w-1/2 aspect-[4/3] lg:aspect-[4/5] overflow-hidden rounded-2xl relative shadow-xl">
                    {room.imageUrl ? (
                      <img src={room.imageUrl} alt={room.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-1000" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-stone-100 text-stone-400 font-serif">No Photo</div>
                    )}
                  </div>
                  
                  <div className="w-full lg:w-1/2 flex flex-col justify-center py-6">
                    <h3 className="text-4xl md:text-5xl lg:text-6xl font-serif text-stone-900 mb-6 tracking-tight leading-none">{room.name}</h3>
                    <p className="text-stone-500 text-lg md:text-xl leading-relaxed mb-10 font-light">{room.description}</p>
                    
                    <div className="grid grid-cols-2 gap-6 text-stone-900 mb-10 border-y border-stone-200 py-8">
                      <div className="flex items-center gap-3">
                        <Users className="h-5 w-5 text-emerald-600" /> 
                        <span className="font-serif text-lg">{room.maxGuests} Guests Max</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" /> 
                        <span className="font-serif text-lg">{room.quantity} Available</span>
                      </div>
                    </div>
                    
                    {room.packages && room.packages.length > 0 && (
                      <div className="flex flex-wrap gap-3 mb-10">
                        {room.packages.map(pkg => (
                          <span key={pkg.id} className="px-4 py-2 bg-stone-100 text-stone-700 rounded-full text-sm font-medium tracking-wide">
                            + {pkg.name}{pkg.price > 0 ? \` (\$\${pkg.price})\` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mt-auto">
                      <div>
                        <span className="text-4xl font-serif text-stone-900">\${room.price}</span>
                        <span className="text-stone-500 ml-2 tracking-widest uppercase text-xs font-bold">/ night</span>
                        {room.showDualCurrency && room.priceMWK ? (
                          <div className="text-sm text-stone-400 mt-1">MWK {room.priceMWK?.toLocaleString()} / night</div>
                        ) : null}
                      </div>
                      <button 
                        onClick={() => initiateBooking(room)}
                        className="bg-stone-900 text-white px-10 py-4 rounded-full font-bold uppercase tracking-widest text-xs hover:bg-emerald-700 transition-colors duration-300"
                      >
                        Reserve
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}`;

code = code.replace(oldRoomsRegex, newRooms);

fs.writeFileSync('src/pages/HotelDetails.tsx', code, 'utf-8');
console.log('Rosello room aesthetic applied');
