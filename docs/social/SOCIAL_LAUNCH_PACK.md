# Travel Malawi — Social Media Launch Pack

Goal: **send as much qualified traffic as possible to https://ulendomalawi.com** (browse → message host → book direct).
Status: no social accounts exist yet. This pack takes you from zero to a live, tracked, 30-day launch.

Honesty rules (same as `promanaged-marketing-engine/MARKETING.md`): no invented stats, awards, prices or reviews; only post stays and photos the host has approved; nothing is auto-published without the owner's approval.

---

## 1. Accounts to create (in this order)

| # | Platform | Why it matters for traffic | Handle (try in order) |
|---|---|---|---|
| 1 | **Facebook Page** | Largest Malawi audience, Meta Business Suite, WhatsApp link, ads, and the marketing engine publishes here | `travelmalawi` → `travelmalawidirect` → `ulendomalawi` |
| 2 | **Instagram (Business)** | Visual discovery, Reels, link-in-bio; connect to the Page | same handle as Facebook |
| 3 | **TikTok** | Cheapest reach for travel video | same handle |
| 4 | **WhatsApp Business** | Tap-to-chat enquiries from every post | business number for Travel Malawi |
| 5 | **YouTube** | Search traffic, long-form guides | same handle |
| 6 | **X (Twitter)** | Diaspora and travel-trade reach, low effort | same handle |
| 7 | **LinkedIn Page** | Host recruiting, tourism trade | Travel Malawi |
| 8 | **Google Business Profile** | Map/search presence | Travel Malawi |

Handle availability can only be checked on each platform. Pick one handle and use it everywhere. Use the same email for all accounts: `info@ulendomalawi.com`, or the owner's company mailbox.

### Setup checklist per account
- [ ] Profile picture: `assets/` logo (square crop, readable at 40px).
- [ ] Cover/banner: lake or highlands photo you own. Safe zone centred.
- [ ] Bio (below), website link = `https://ulendomalawi.com/?utm_source=<platform>&utm_medium=social&utm_campaign=profile`.
- [ ] Category: Travel Company / Travel Agency.
- [ ] Contact: email, WhatsApp, region = Malawi.
- [ ] Two-factor authentication on, two admins (owner + one backup).
- [ ] Connect Instagram ↔ Facebook Page ↔ WhatsApp Business in Meta Business Suite.

## 2. Bios (copy/paste)

**Instagram / TikTok (≤150 chars):**
`Malawi stays, booked direct 🇲🇼 Lodges, cottages & camps. Zero commission. Takulandirani 👇`

**Facebook About (short):**
`Travel Malawi connects travellers directly with independent lodges, lakeside cottages, guest houses and safari camps across Malawi. Book direct, zero commission.`

**X (≤160):**
`Independent stays across Malawi, booked direct with zero commission. The Warm Heart of Africa.`

**LinkedIn tagline:**
`Direct booking platform for independent lodges, guest houses and camps in Malawi.`

**YouTube channel description:**
`Travel guides, stay tours and trip ideas for Malawi — Lake Malawi, national parks, highlands and cities. Plan and book direct at https://ulendomalawi.com`

## 3. Link-in-bio (Instagram / TikTok)

Use one landing link and rotate the campaign tag, or use a link page with these buttons:
1. Browse stays → `https://ulendomalawi.com/?utm_source=instagram&utm_medium=social&utm_campaign=bio`
2. Plan with Ulendo (AI trip planner) → site home, planner section
3. WhatsApp us → `https://wa.me/<business number>`
4. List your stay (hosts) → `https://ulendomalawi.com/list-your-property?utm_source=instagram&utm_medium=social&utm_campaign=bio-host`

## 4. Content pillars and cadence

| Pillar | Share | Examples |
|---|---|---|
| Destinations (lake, parks, highlands, cities) | 30% | Carousels, Reels |
| Stay spotlights (real, host-approved listings) | 20% | Walk-throughs, hosts |
| Direct-booking value (zero commission, talk to the host) | 15% | Explainers |
| Culture and food (Chichewa words, nsima, chambo) | 10% | Short Reels |
| Trip ideas and tips | 10% | Itineraries, packing |
| Community / UGC | 10% | Tag-us features |
| Host recruiting | 5% | Free listing, keep 100% revenue |

Cadence: Facebook 1/day, Instagram 1 feed or Reel/day + 3–5 Stories, TikTok 4–5/week, X 1/day, LinkedIn 2/week, YouTube 1/week once content exists.
Best posting windows to start: weekday evenings and Sunday evening (Central Africa Time), then adjust from analytics after two weeks.

Full 30-day plan: `content_calendar_30_days.csv` (regenerate with `python3 build_calendar.py`). Rows marked `[PICK A REAL LISTING]` need a real, approved listing and its photos before posting.

## 5. Traffic engine (what drives clicks)

1. **Every post has a reason to click**: itinerary, availability, host chat, or the AI planner.
2. **Reels and TikToks first**: they are the only organic formats reaching non-followers at scale. Hook in the first 2 seconds, text on screen, link to the specific stay or destination.
3. **Comment keyword → link**: "Comment LAKE and we'll send the stays" (use the engine's keyword buyers feature, Social › Lead posts).
4. **Share loops**: end Trip-idea posts with "send this to your travel buddy".
5. **UGC**: `#WarmHeartOfAfrica` and tag-us posts bring free content and reach.
6. **Host cross-posts**: ask every listed host to share their own stay post and tag the account.
7. **Paid boosts (optional)**: create ads paused (Social › Ads). Start small on the best organic Reel. Set a spend cap before enabling.
8. **Website side**: confirm Open Graph tags (`og:title`, `og:image`, `og:description`) so shared links show a rich card. Add a "Follow us" block to the footer once handles exist. Install analytics before launch.

## 6. Tracking

All links use: `utm_source=<platform>&utm_medium=social&utm_campaign=launch30&utm_content=<day-slug>`.
Review weekly: sessions per platform, top 5 posts by clicks, enquiries and bookings by source (the site's Admin Traffic Monitor and `promanaged-marketing-engine` attribution `lib/sx_attrib.php` read these tags).
Success checks at day 30: follower count per platform, click-through to site, enquiries from social, number of bookings tagged to social.
Targets are for the owner to set after the first two weeks of real data; none are promised here.

## 7. Engagement and response rules
- Reply to comments and DMs within a few hours; offer WhatsApp for booking questions.
- Never quote prices or availability unless the host has confirmed them.
- STOP/unsubscribe requests are honoured immediately.
- Get written/DM consent before reposting a guest's photo; credit them.

## 8. Launch week (before day 1)
- [ ] Create all accounts and complete the checklist in section 1.
- [ ] Post 9 seed posts on Instagram and Facebook so the grid is not empty.
- [ ] Invite team, hosts and friends to follow.
- [ ] Add social links to the site footer and the `sameAs` JSON-LD in `index.html`.
- [ ] Load `content_calendar_30_days.csv` into Social › Content in the marketing engine (drafts need approval).
- [ ] Day 1 = Monday 2026-10-19.

## 9. Files
- `SOCIAL_LAUNCH_PACK.md` — this guide.
- `content_calendar_30_days.csv` — 30 days of posts with UTM links per platform.
- `build_calendar.py` — regenerates the CSV.
