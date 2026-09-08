export interface ReminderTemplate {
  id: string;
  title: string;
  category: 'arrival' | 'stay' | 'payment' | 'departure';
  badge: string;
  recommendedTiming: string;
  defaultSubject: string;
  defaultBody: string;
  channel: 'email' | 'whatsapp' | 'both';
}

export interface ReminderVariables {
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  hotelName: string;
  hotelLocation?: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  bookingRef: string;
  arrivalPin?: string;
  totalPrice?: string;
  depositAmount?: string;
  depositInstructions?: string;
  wifiName?: string;
  wifiPassword?: string;
  managerPhone?: string;
  managerEmail?: string;
}

export const READY_REMINDER_TEMPLATES: ReminderTemplate[] = [
  {
    id: 'pre_arrival_3d',
    title: '3-Day Pre-Arrival Welcome & Directions',
    category: 'arrival',
    badge: '3 Days Before',
    recommendedTiming: '3 days before check-in',
    channel: 'both',
    defaultSubject: 'Looking forward to welcoming you to {hotelName} in 3 days!',
    defaultBody: `Dear {guestName},

Greetings from sunny Malawi! We are delighted to confirm that your stay at {hotelName} is just 3 days away.

Your Reservation Summary:
- Booking Reference: #{bookingRef}
- Room: {roomName}
- Check-in Date: {checkIn} (from 2:00 PM)
- Check-out Date: {checkOut} (until 10:30 AM)

Preparation & Packing Tips for Malawi:
- If driving from Lilongwe or Blantyre, please let us know your estimated time of arrival so our front-desk team can greet you.
- Evenings along the lake and in the highlands can have a refreshing breeze; light sweaters and insect repellent are recommended.
- Need airport transfer assistance or special dietary arrangements for your arrival meal? Simply reply to this email or call us at {managerPhone}.

We look forward to hosting you soon!

Warm regards,
The Hospitality Team at {hotelName}`
  },

  {
    id: 'arrival_24h_pin',
    title: '24-Hour Final Arrival & Access PIN',
    category: 'arrival',
    badge: '24h Before',
    recommendedTiming: '24 hours before check-in',
    channel: 'both',
    defaultSubject: 'Your stay tomorrow at {hotelName} — Check-in & Arrival PIN',
    defaultBody: `Dear {guestName},

Your visit to {hotelName} begins tomorrow, {checkIn}! Your room ({roomName}) is being thoroughly prepared and sanitized for your arrival.

Quick Check-in Pass:
- Booking Reference: #{bookingRef}
- Arrival / Gate PIN: {arrivalPin}
- Check-in Window: 2:00 PM – 9:00 PM (Late check-in accommodated upon request)
- Property Host Contact: {managerPhone}

Directions & Access:
Show your Arrival PIN #{arrivalPin} or booking voucher at our security gate for express entry. Complimentary parking is available directly on premises.

If you hit traffic or your flight is delayed, please send us a quick message so we can hold your room.

Safe travels tomorrow!

Warm regards,
{hotelName}`
  },

  {
    id: 'check_in_welcome',
    title: 'Check-In Welcome & WiFi / Amenities Guide',
    category: 'stay',
    badge: 'Check-In Day',
    recommendedTiming: 'On arrival day morning or at check-in',
    channel: 'both',
    defaultSubject: 'Welcome to {hotelName}! Here is everything you need for your stay',
    defaultBody: `Dear {guestName},

Welcome to {hotelName}! We hope you have settled comfortably into {roomName}.

Helpful Guest Information:
- Complimentary Guest WiFi: {wifiName}
- WiFi Password: {wifiPassword}
- Breakfast Hours: 06:30 AM – 10:00 AM daily
- Dinner / Restaurant Service: 12:00 PM – 09:30 PM
- Front Desk / Room Service Extension: Dial 0 or reach us at {managerPhone}

Need extra towels, lake excursion bookings, laundry service, or local recommendations? Our staff is here to make your time in Malawi unforgettable.

Enjoy your stay!

With best regards,
The Management & Staff at {hotelName}`
  },

  {
    id: 'deposit_payment',
    title: 'Deposit & Payment Details (Airtel / Mpamba / Bank)',
    category: 'payment',
    badge: 'Payment & Deposit',
    recommendedTiming: 'Upon booking confirmation or when balance is due',
    channel: 'both',
    defaultSubject: 'Reservation #{bookingRef} — Deposit & Payment Details for {hotelName}',
    defaultBody: `Dear {guestName},

Thank you for choosing {hotelName} for your upcoming trip to Malawi.

Below are the payment and deposit details for your reservation:
- Booking Reference: #{bookingRef}
- Reserved Room: {roomName}
- Stay Dates: {checkIn} to {checkOut}
- Total Amount: {totalPrice}

Deposit & Payment Instructions:
{depositInstructions}

We accept National Bank of Malawi, Standard Bank transfers, as well as Airtel Money and TNM Mpamba. Please include your Booking Reference #{bookingRef} as the payment remark, and share the proof of payment with us via email or WhatsApp ({managerPhone}).

Thank you for your prompt cooperation.

Kind regards,
Reservations Desk · {hotelName}`
  },

  {
    id: 'check_out_logistics',
    title: 'Morning Check-Out & Departure Logistics',
    category: 'departure',
    badge: 'Departure Morning',
    recommendedTiming: 'Morning of departure (8:00 AM)',
    channel: 'both',
    defaultSubject: 'Check-out Information & Safe Travels from {hotelName}',
    defaultBody: `Dear {guestName},

Good morning! We hope you enjoyed your time with us at {hotelName}.

Departure Logistics for Today ({checkOut}):
- Standard check-out time is 10:30 AM.
- If you have an afternoon flight or tour, feel free to leave your luggage with our front desk team free of charge.
- Need a taxi or airport shuttle arranged? Let reception know 30 minutes before your planned departure.
- Room key cards can be dropped off at the main desk upon settling any incidental charges.

Thank you for staying with us. We wish you a smooth and safe onward journey!

Warmest regards,
The Team at {hotelName}`
  },

  {
    id: 'post_stay_review',
    title: 'Post-Stay Review & Thank You',
    category: 'departure',
    badge: 'Post-Stay',
    recommendedTiming: '1 day after check-out',
    channel: 'both',
    defaultSubject: 'Thank you for staying at {hotelName} — We would love your feedback!',
    defaultBody: `Dear {guestName},

Thank you for choosing {hotelName} during your recent trip to Malawi. It was our absolute pleasure hosting you!

We are committed to delivering the warmest Malawian hospitality. If you have a minute, we would truly appreciate it if you could share your experience on Travel Malawi. Your review helps fellow travelers discover our lodge and helps our team continue improving.

We hope to welcome you back again very soon!

Warm regards,
{hotelName} Management`
  },

  {
    id: 'custom',
    title: 'Custom Reminder Message',
    category: 'stay',
    badge: 'Custom',
    recommendedTiming: 'Anytime',
    channel: 'both',
    defaultSubject: 'Update regarding your reservation #{bookingRef} at {hotelName}',
    defaultBody: `Dear {guestName},

We are writing regarding your reservation #{bookingRef} at {hotelName} for {checkIn} to {checkOut}.

[Enter your custom message here]

If you have any questions or require special assistance, please do not hesitate to reach out to us at {managerPhone}.

Warm regards,
{hotelName}`
  }
];

export function fillTemplate(
  templateText: string,
  vars: ReminderVariables
): string {
  return templateText
    .replace(/{guestName}/g, vars.guestName || 'Guest')
    .replace(/{hotelName}/g, vars.hotelName || 'our property')
    .replace(/{hotelLocation}/g, vars.hotelLocation || 'Malawi')
    .replace(/{roomName}/g, vars.roomName || 'Reserved Room')
    .replace(/{checkIn}/g, vars.checkIn || 'your check-in date')
    .replace(/{checkOut}/g, vars.checkOut || 'your check-out date')
    .replace(/{bookingRef}/g, vars.bookingRef || 'N/A')
    .replace(/{arrivalPin}/g, vars.arrivalPin || 'Available at desk')
    .replace(/{totalPrice}/g, vars.totalPrice || 'Contact property')
    .replace(/{depositAmount}/g, vars.depositAmount || '50% deposit')
    .replace(/{depositInstructions}/g, vars.depositInstructions || 'Bank transfer (Standard Bank / National Bank of Malawi) or Mobile Money (Airtel Money / Mpamba). Please contact reception for account details.')
    .replace(/{wifiName}/g, vars.wifiName || `${vars.hotelName} Guest WiFi`)
    .replace(/{wifiPassword}/g, vars.wifiPassword || 'Provided at check-in')
    .replace(/{managerPhone}/g, vars.managerPhone || '+265 999 000 000')
    .replace(/{managerEmail}/g, vars.managerEmail || 'reservations@travelmalawi.com');
}

export function formatReminderEmailHtml(
  subject: string,
  bodyText: string,
  hotelName: string,
  bookingRef: string
): string {
  const paragraphs = bodyText
    .split('\n\n')
    .map(p => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      // Format bullet points nicely
      if (trimmed.includes('\n- ') || trimmed.startsWith('- ')) {
        const items = trimmed
          .split('\n')
          .filter(line => line.trim().startsWith('- '))
          .map(line => `<li style="margin-bottom: 6px;">${line.replace(/^-\s*/, '')}</li>`)
          .join('');
        const nonListText = trimmed.split('\n').filter(line => !line.trim().startsWith('- ')).join('<br/>');
        return `${nonListText ? `<p style="margin: 0 0 8px; line-height: 1.6;">${nonListText}</p>` : ''}<ul style="margin: 0 0 14px; padding-left: 20px; line-height: 1.6;">${items}</ul>`;
      }
      return `<p style="margin: 0 0 14px; line-height: 1.6; color: #292524;">${trimmed.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('');

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; background: #fafaf9; color: #1c1917;">
      <div style="background: #ffffff; border-radius: 16px; border: 1px solid #e7e5e4; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
        
        <!-- Header banner -->
        <div style="background: #1c1917; padding: 24px 28px; color: #ffffff;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #a8a29e; margin-bottom: 4px;">
            Travel Malawi · Guest Reservation
          </div>
          <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #ffffff;">${hotelName}</h1>
          <div style="margin-top: 6px; font-size: 12px; color: #d6d3d1;">
            Booking Ref: <span style="font-family: monospace; font-weight: 700; background: rgba(255,255,255,0.15); padding: 2px 6px; border-radius: 4px;">#${bookingRef}</span>
          </div>
        </div>

        <!-- Body content -->
        <div style="padding: 28px; font-size: 14px; color: #292524;">
          ${paragraphs}
        </div>

        <!-- Footer -->
        <div style="background: #f5f5f4; padding: 20px 28px; border-top: 1px solid #e7e5e4; text-align: center; font-size: 12px; color: #78716c;">
          <p style="margin: 0 0 6px; font-weight: 600; color: #44403c;">${hotelName} · Powered by Travel Malawi Stay OS</p>
          <p style="margin: 0; font-size: 11px; color: #a8a29e;">
            This email was sent directly by property management regarding your confirmed booking.
          </p>
        </div>

      </div>
    </div>
  `;
}
