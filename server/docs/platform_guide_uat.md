# Platform Guide and UAT Checklist
*Quality checks, test checklists and acceptance criteria for Travel Malawi*

## 1. Purpose and audience

This guide sets out the test checklists, standards and acceptance criteria for Travel Malawi. It is for the operations team, field inspectors, marketing and partner onboarding staff.

## 2. Platform principles

* **Built for Malawi:** Supports mobile money, local bank transfers and offline maps for areas with poor connectivity.
* **No host commission during launch:** Guests deal directly with the property manager, with 0% platform commission during the launch period.
* **Two currencies:** Malawian Kwacha (MWK) rounded to the nearest 1,000; US dollars (USD) in whole dollars or rounded to the nearest $5.
* **Payment options:** Airtel Money, TNM Mpamba, bank transfer (NBM, Standard Bank, FDH Bank, Centenary Bank), Visa and Mastercard, and cash on arrival where the property allows it.
* **Ulendo AI concierge:** Answers guest and host questions at any hour, using local knowledge of Malawi.

## 3. User acceptance tests

### Suite A: Search and listings

* **A1 Destination search:** Typing filters results immediately for Lilongwe, Blantyre, Cape Maclear, Mangochi, Nkhata Bay, Nyika, Liwonde, Majete and Mulanje.
* **A2 View modes:** Switching between photo grid, compact list and map works without errors.
* **A3 Currency switch:** Switching between MWK and USD updates all prices correctly, with no layout shift.

### Suite B: Booking and guest messages

* **B1 WhatsApp enquiries:** The WhatsApp button opens a message with dates, number of guests and room already filled in.
* **B2 Offline directions:** GPS coordinates open the phone's own navigation app (Google Maps or OsmAnd) and work without mobile data when maps have been saved.
* **B3 Booking confirmation:** The confirmation shows clear payment details (Airtel Money, TNM Mpamba or bank transfer).

### Suite C: Property manager tools

* **C1 Property page:** Photos, amenities and check-in and check-out policies display clearly.
* **C2 Calendar and date blocking:** Blocking dates prevents double bookings, and check-out must be after check-in.
* **C3 Bulk rate changes:** Seasonal increases or discounts apply correctly across several rooms.

### Suite D: Partner documents

* **D1 Sharing:** WhatsApp sharing, copy link and print or save as PDF work on all partner documents.
* **D2 Partner submissions:** Survey responses, listing requests and field notes arrive in the Admin Documentation Hub.

## 4. Reporting issues

Report test results, bugs or incorrect property details through the form at `/uat`, or contact the Travel Malawi operations team.
