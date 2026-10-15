"""Builds content_calendar_30_days.csv. Run: python3 build_calendar.py
Every link carries UTM tags so GA / the site's traffic monitor can attribute visits per post."""
import csv, datetime, urllib.parse

SITE = "https://ulendomalawi.com"
START = datetime.date(2026, 10, 19)  # Monday after launch week

def link(path, platform, slug):
    q = urllib.parse.urlencode({"utm_source": platform, "utm_medium": "social",
                                "utm_campaign": "launch30", "utm_content": slug})
    return f"{SITE}{path}?{q}"

# (pillar, format, platforms, hook/caption, landing path, visual brief, cta)
POSTS = [
 ("Welcome","Reel 15s","IG,FB,TT","Takulandirani! Malawi's independent lodges, cottages and camps — booked direct, zero commission. Here's how it works.","/","Fast cuts of lake, hills, a lodge door opening; text overlay 'Takulandirani'","Link in bio: browse stays"),
 ("Destination","Carousel 6","IG,FB","Lake Malawi: 5 lakeshore bases — Cape Maclear, Mangochi, Nkhata Bay, Senga Bay, Likoma. Which is yours?","/","One slide per base, name + one-line vibe. No invented facts: use only what you've seen/verified","Save this for your trip"),
 ("Direct booking","Image","FB,IG,X","Booking direct means the lodge keeps what it earns and you talk to the host, not a call centre. Zero commission on Travel Malawi.","/","Clean card: 'Book direct. Zero commission.'","Browse stays"),
 ("Culture","Reel 10s","IG,TT,FB","Chichewa in 10 seconds: Takulandirani = welcome. Zikomo = thank you. Say it to your host.","/","Face-to-camera or text-only with audio","Comment your favourite word"),
 ("Stay spotlight","Carousel","IG,FB","[PICK A REAL LISTING] Why guests will love it — three real photos, one honest line each.","/ (use the listing's own URL)","Use photos the lodge has approved","Check dates"),
 ("Destination","Reel 20s","TT,IG,FB","Safari without the crowds: Liwonde, Majete, Nyika, Kasungu, Nkhotakota. Pick your park.","/","Park names over footage you have rights to","Plan your trip"),
 ("Poll/Engage","Story","IG,FB","Lake, mountain or safari first? Vote.","/","Poll sticker, 3 options","Vote"),
 ("Travel tip","Carousel 5","IG,FB","Paying in Malawi: Airtel Money, TNM Mpamba, bank transfer, cards, or cash on arrival where the lodge allows. Check each stay's policy.","/","Icons per payment type","Share with your travel buddy"),
 ("Destination","Image","FB,IG,X","Zomba Plateau, Mount Mulanje, Dedza: Malawi's highlands for cooler air and big views.","/","One hero photo per place","Browse highland stays"),
 ("Direct booking","Reel 15s","TT,IG,FB","OTA vs direct: where does your money go? (Only compare using figures you can source.)","/","Simple split-screen graphic","Book direct"),
 ("Food","Reel 12s","IG,TT,FB","Chambo, nsima and ndiwo — the meal you eat by the lake. What's yours?","/","Close-up food footage with host permission","Tell us your order"),
 ("Stay spotlight","Reel 15s","IG,FB,TT","[PICK A REAL LISTING] 30-second room-to-view walk-through.","/ (listing URL)","Vertical walk-through filmed with permission","Check availability"),
 ("UGC","Image","IG,FB","Been to Malawi? Tag @travelmalawi and #WarmHeartOfAfrica — we feature our favourites (with your OK).","/","Frame graphic with hashtag","Tag us"),
 ("Trip idea","Carousel 7","IG,FB","A 7-day Malawi sampler: Lilongwe → Senga Bay → Liwonde. Tweak it with Ulendo, our AI trip planner.","/","Day-by-day map graphic","Plan with Ulendo"),
 ("Poll/Engage","Story","IG,FB","Where should our next guide go: Likoma, Nyika or Mulanje?","/","Quiz sticker","Vote"),
 ("Cities","Image","FB,IG,X","Lilongwe, Blantyre, Mzuzu, Zomba: where to stay in each city, with stays you can book direct.","/","Four-panel city graphic","See city stays"),
 ("Travel tip","Reel 15s","TT,IG,FB","3 things to pack for lakeshore weekends (only list what you'd genuinely pack).","/","Flat-lay or text list","Save for later"),
 ("Stay spotlight","Carousel","IG,FB","[PICK A REAL LISTING] Meet the hosts behind the stay.","/ (listing URL)","Host portrait + quote with consent","Say hi to the host"),
 ("Host recruiting","Image","FB,LI,X","Run an independent lodge, B&B or camp? List free, keep 100% of your booking revenue.","/list-your-property","Host-facing graphic","List your stay"),
 ("Culture","Carousel 5","IG,FB","Words to know before you go: Takulandirani, Zikomo, Muli bwanji, Chonde, Pepani.","/","One word per slide with meaning","Which will you use first?"),
 ("Destination","Reel 20s","TT,IG,FB","Island time: Likoma and Chizumulu. Slow boats, slow days.","/","Footage you own or licensed","Plan your trip"),
 ("Direct booking","Image","FB,IG","How booking direct works: pick a stay → message the host → confirm → pay on the host's accepted rails.","/","4-step infographic","Start planning"),
 ("Stay spotlight","Reel 15s","IG,TT,FB","[PICK A REAL LISTING] Sunrise from the room.","/ (listing URL)","Sunrise timelapse from the stay","Check dates"),
 ("UGC","Reel/Collage","IG,FB","Your Malawi, your photos — this week's featured guests.","/","Collage with credits and permission","Tag us to be next"),
 ("Poll/Engage","Story","IG,FB","Ask us anything about travelling in Malawi. We answer in stories.","/","Question sticker","Ask away"),
 ("Trip idea","Carousel 6","IG,FB","Weekend from Lilongwe: Senga Bay lakeside escape.","/","Route + stay options","Plan your weekend"),
 ("Direct booking","Reel 12s","TT,IG,FB","Why guests message hosts directly: questions answered by the people who know the place.","/","Chat-screenshot mock (no real guest data)","Browse stays"),
 ("Safari","Carousel 5","IG,FB","Best park for you? Quick guide to Liwonde, Majete, Nyika.","/","One park per slide, facts you've verified","Save for planning"),
 ("Recap","Reel 20s","IG,TT,FB","30 days of Malawi: our favourite moments so far.","/","Best-performing clips","Follow for more"),
 ("Offer/CTA","Image","FB,IG,X","Ready to book? Browse independent stays across Malawi, zero commission.","/","Hero graphic with logo","Browse and book direct"),
]

with open("content_calendar_30_days.csv","w",newline="",encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["day","date","pillar","format","platforms","caption_idea","visual_brief","cta","utm_link_facebook","utm_link_instagram","utm_link_tiktok","utm_link_x","status"])
    for i,(pillar,fmt,plats,cap,path,visual,cta) in enumerate(POSTS):
        d = START + datetime.timedelta(days=i)
        p = path.split(" ")[0]
        slug = f"d{i+1:02d}-{pillar.lower().replace('/','-').replace(' ','-')}"
        w.writerow([i+1,d.isoformat(),pillar,fmt,plats,cap,visual,cta,
                    link(p,"facebook",slug),link(p,"instagram",slug),link(p,"tiktok",slug),link(p,"x",slug),"draft"])
print(len(POSTS),"rows")
