const fs = require('fs');
let code = fs.readFileSync('src/pages/HotelDetails.tsx', 'utf-8');
code = code.replace(/\r\n/g, '\n');

// Update room card price display in HotelDetails to show dual currency
const oldPriceCard = `<span className="text-3xl font-serif text-stone-900">{room.currency === 'MWK' ? 'MWK ' : '$'}{room.price}</span>
                          <span className="text-sm font-medium text-stone-500 ml-1">/ night</span>`;

const newPriceCard = `<span className="text-3xl font-serif text-stone-900">\${room.price}</span>
                          <span className="text-sm font-medium text-stone-500 ml-1">/ night</span>
                          {room.showDualCurrency && room.priceMWK ? (
                            <div className="text-sm text-stone-500 font-medium mt-1">MWK {room.priceMWK?.toLocaleString()} / night</div>
                          ) : null}`;

if (code.includes(oldPriceCard)) {
  code = code.replace(oldPriceCard, newPriceCard);
  console.log('1. Dual currency on guest room cards');
} else {
  console.log('1. Could not find old price card');
}

fs.writeFileSync('src/pages/HotelDetails.tsx', code, 'utf-8');
console.log('HotelDetails patched!');
