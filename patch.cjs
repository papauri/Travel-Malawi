const fs = require('fs');
let code = fs.readFileSync('src/pages/ManageHotel.tsx', 'utf8');

code = code.replace(
  `                      {(booking.guestEmail || booking.guestPhone || (whatsappEnabled && (booking.guestWhatsapp || true))) && (`,
  `                      {(booking.guestEmail || booking.guestPhone || booking.guestWhatsapp || true) && (`
);

code = code.replace(
  `                                                    {/* Manager WhatsApp controls (ONLY visible when WhatsApp is enabled in Admin Portal) */}
                          {whatsappEnabled && (
                            editingWhatsappBookingId === booking.id ? (`,
  `                                                    {/* Manager WhatsApp controls */}
                          {editingWhatsappBookingId === booking.id ? (`
);

code = code.replace(
  `                                )}
                              </div>
                            )
                          )}
                        </div>
                      )}`,
  `                                )}
                              </div>
                            )
                          }
                        </div>
                      )}`
);

fs.writeFileSync('src/pages/ManageHotel.tsx', code);
