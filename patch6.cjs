const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

code = code.replace(
  `                          <td className="px-6 py-4 text-sm font-medium text-stone-900">
                            <PriceDisplay amount={b.total || 0} currency={b.currency} />
                          </td>`,
  `                          <td className="px-6 py-4 text-sm font-medium text-stone-400">
                            ***
                          </td>`
);

code = code.replace(
  `                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {b.status === 'pending' && (
                                <>
                                  <button
                                    onClick={() => handleUpdateBookingStatus(b.id!, 'confirmed')}
                                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                                    title="Confirm Booking"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleUpdateBookingStatus(b.id!, 'rejected')}
                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                                    title="Reject Booking"
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => handleDeleteBooking(b.id!)}
                                className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                title="Delete Booking"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>`,
  `                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end">
                              <select
                                value={b.status}
                                onChange={(e) => handleUpdateBookingStatus(b.id!, e.target.value as any)}
                                className="bg-stone-50 border border-stone-200 text-stone-600 text-xs rounded-lg focus:ring-stone-500 focus:border-stone-500 block w-full p-1.5 cursor-pointer"
                              >
                                <option value="pending">Pending</option>
                                <option value="confirmed">Confirmed</option>
                                <option value="rejected">Rejected</option>
                                <option value="cancelled">Cancelled</option>
                              </select>
                            </div>
                          </td>`
);

fs.writeFileSync('src/pages/AdminDashboard.tsx', code);
