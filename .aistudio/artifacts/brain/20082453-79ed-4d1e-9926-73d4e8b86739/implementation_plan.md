# Implementation Plan — Compact Collapsible Availability Calendar Beneath Date Bar

## 1. Overview & Objective
Transform the availability calendar experience in `HotelDetails.tsx` to achieve a clean, compact, clutter-free page layout:
1. **Collapsible by Default**: On page load, the monthly calendar is collapsed, allowing travellers to immediately see room options, photos, and rates without scrolling past a large calendar widget.
2. **Inline Expansion Beneath Top Date Bar**: Clicking "View Monthly Calendar" in the top date bar smoothly expands the interactive availability calendar directly below the date bar controls.
3. **Intuitive UI/UX & Clear Wording**: Provide clear state labels ("View Monthly Calendar" vs. "Hide Calendar"), helper guides on color codes (green available, red booked/blocked, neutral past), date-selection synchronization, and a "Done / Close Calendar" action.
4. **Cohesive Section Flow**: Position the "Reach the property directly" section cleanly below the room listings, and ensure Quick Navigation sidebar shortcuts smoothly expand the calendar and scroll to the appropriate sections.

---

## 2. User Experience & Design Architecture

### 2.1 State Management
- Add state: `const [isCalendarOpen, setIsCalendarOpen] = useState(false);`
- Toggled by:
  - Top date bar header button ("View Monthly Calendar" / "Hide Calendar")
  - Inline prompt links in the room availability banner ("Monthly grid", "Check Open Dates on Calendar")
  - Sidebar Quick Navigation ("Availability Calendar" link expands and scrolls)

### 2.2 Collapsible Calendar Panel (`#availability-calendar`)
- Positioned directly below the date selector controls in `HotelDetails.tsx`, above active promotions and room listings.
- Wrapped in an animated container (`motion.div` with enter/exit transition) for smooth expansion and collapse.
- **Header**:
  - Title: "Monthly Availability & Blocked Dates"
  - Badge: "Whole Property Closure" for entire-place listings or "Room Inventory" for lodge room types.
  - Collapse button: "Hide Calendar" (with chevron / close icon).
- **Body**:
  - Explanatory guidance: *"Click any open date to set your check-in, then click your departure date. Dates marked in red are blocked or fully booked."*
  - Interactive `<AvailabilityCalendar>` with live props: `hotelId`, `rooms`, `checkIn`, `checkOut`, `availableRoomNames`, `isPropertyBlocked`, and `onDateSelect`.
- **Footer**:
  - Quick action button: *"Done Selecting Dates"* / *"Browse Available Rooms"* (collapses the calendar and smoothly focuses the matching room cards).

### 2.3 Post-Room Layout & Contact Host Section
- The "Reach the property directly" card remains prominent right below the room cards list, giving travellers instant direct communication channels (Live Host Chat, WhatsApp, phone, email) if they have questions or need custom arrangements.

---

## 3. Implementation Steps

### Step 1: Add Collapsible State & Handlers (`src/pages/HotelDetails.tsx`)
- Add `isCalendarOpen` boolean state (default `false`).
- Create `handleToggleCalendar(shouldOpen?: boolean)` helper that opens/closes the calendar and smoothly scrolls to `#availability-calendar` if opening.

### Step 2: Update Top Date Bar Toggle Button
- In the top hybrid date bar header:
  - When `isCalendarOpen === false`:
    - Label: **View Monthly Calendar** with `<Calendar className="w-3.5 h-3.5 text-emerald-600" />` and `<ChevronDown className="w-3.5 h-3.5" />`.
  - When `isCalendarOpen === true`:
    - Label: **Hide Calendar** with `<Calendar className="w-3.5 h-3.5 text-stone-700" />` and `<ChevronDown className="w-3.5 h-3.5 rotate-180" />`.
- Update banner buttons ("Monthly grid", "Check Open Dates on Calendar") to call `handleToggleCalendar(true)`.

### Step 3: Relocate & Wrap `<AvailabilityCalendar>`
- Move `<AvailabilityCalendar>` from below room cards to immediately under the top date bar controls.
- Conditionally render inside an animated `motion.div` card with styled borders, header controls, legend, and bottom close button.

### Step 4: Synchronize Sidebar Quick Navigation
- Update Quick Navigation link for "Availability Calendar" so clicking it sets `isCalendarOpen` to `true` and scrolls to the top calendar container.

---

## 4. Verification & Testing Plan
- **Build Verification**: Run `compile_applet` and `lint_applet` to guarantee type safety and zero regressions.
- **UX Scenarios**:
  1. **Page Load**: Open property details -> verify calendar is hidden by default and room cards are compact and immediately visible.
  2. **Expand Calendar**: Click "View Monthly Calendar" -> verify calendar expands smoothly beneath date bar with clear wording and legend.
  3. **Date Selection**: Click an open date in the monthly calendar -> verify check-in/check-out dates populate and live room availability updates.
  4. **Collapse Calendar**: Click "Hide Calendar" or "Done Selecting Dates" -> verify calendar collapses cleanly.
  5. **Quick Navigation**: Click "Availability Calendar" in sidebar -> verify calendar auto-expands and scrolls into view.
