const fs = require('fs');
let code = fs.readFileSync('src/pages/ManageHotel.tsx', 'utf8');

code = code.replace(
  `                  <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-1 flex-wrap">`,
  `                  <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-4">
                    <div className="w-full">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-1 sm:flex-wrap w-full">
                        <div className="flex items-center gap-3 flex-wrap">`
);

code = code.replace(
  `                          {booking.status !== 'cancelled' && booking.status !== 'rejected' && (
                            <div className="ml-auto flex items-center gap-2 flex-wrap">`,
  `                        </div>
                        {booking.status !== 'cancelled' && booking.status !== 'rejected' && (
                            <div className="sm:ml-auto flex items-center gap-2 flex-wrap w-full sm:w-auto">`
);

fs.writeFileSync('src/pages/ManageHotel.tsx', code);
