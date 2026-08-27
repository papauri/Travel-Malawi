const fs = require('fs');
let content = fs.readFileSync('src/pages/HotelDetails.tsx', 'utf8');

if (!content.includes('import DatePicker from')) {
  content = content.replace("import { Plus, CheckCircle2, XCircle, Clock, MapPin, Check, X, Star, ChevronLeft, ChevronRight, Phone, Send, Info, Calendar } from 'lucide-react';", "import { Plus, CheckCircle2, XCircle, Clock, MapPin, Check, X, Star, ChevronLeft, ChevronRight, Phone, Send, Info, Calendar } from 'lucide-react';\nimport DatePicker from '../components/DatePicker';");
}

const inputsRegex = /<div className="grid grid-cols-2 gap-4">\s*<div>\s*<label className=\{labelClass\}>Check in<\/label>\s*<input\s*type="date"\s*min=\{today\}\s*value=\{checkIn\}\s*onChange=\{e => setCheckIn\(e\.target\.value\)\}\s*aria-invalid=\{!!fieldErrors\.checkIn\}\s*className=\{`\$\{fieldClass\} \$\{fieldErrors\.checkIn \? 'border-red-400 focus:border-red-500' : ''\}`\}\s*\/>\s*\{fieldErrors\.checkIn && <p className="text-xs text-red-600 mt-1\.5">\{fieldErrors\.checkIn\}<\/p>\}\s*<\/div>\s*<div>\s*<label className=\{labelClass\}>Check out<\/label>\s*<input\s*type="date"\s*min=\{checkIn \|\| today\}\s*value=\{checkOut\}\s*onChange=\{e => setCheckOut\(e\.target\.value\)\}\s*aria-invalid=\{!!fieldErrors\.checkOut\}\s*className=\{`\$\{fieldClass\} \$\{fieldErrors\.checkOut \? 'border-red-400 focus:border-red-500' : ''\}`\}\s*\/>\s*\{fieldErrors\.checkOut && <p className="text-xs text-red-600 mt-1\.5">\{fieldErrors\.checkOut\}<\/p>\}\s*<\/div>\s*<\/div>/;

const datePickerHTML = `<div className="mb-4">
                  <label className={labelClass}>Stay Dates</label>
                  <DatePicker
                    checkIn={checkIn}
                    checkOut={checkOut}
                    onSelect={(inDate, outDate) => {
                      setCheckIn(inDate);
                      setCheckOut(outDate);
                      setFieldErrors(prev => {
                        const next = {...prev};
                        delete next.checkIn;
                        delete next.checkOut;
                        return next;
                      });
                    }}
                    blockedDates={[]}
                  />
                  {(fieldErrors.checkIn || fieldErrors.checkOut) && (
                    <p className="text-xs text-red-600 mt-1.5">{fieldErrors.checkIn || fieldErrors.checkOut}</p>
                  )}
                </div>`;

if (content.match(inputsRegex)) {
  content = content.replace(inputsRegex, datePickerHTML);
  fs.writeFileSync('src/pages/HotelDetails.tsx', content);
} else {
  console.log("Could not find inputsRegex in HotelDetails");
}
