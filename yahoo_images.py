
import requests
from bs4 import BeautifulSoup
import json
import urllib.parse

hotels = [
    "Pumulani Lodge Lake Malawi",
    "Kaya Mawa Likoma Island",
    "Sunbird Ku Chawe Zomba",
    "Blue Zebra Island Lodge Malawi",
    "Mvuu Camp Liwonde Malawi"
]

results = {}

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}

for h in hotels:
    print(f"Fetching {h}...")
    q = urllib.parse.quote(h)
    url = f"https://images.search.yahoo.com/search/images?p={q}"
    res = requests.get(url, headers=headers)
    soup = BeautifulSoup(res.text, "html.parser")
    
    images = []
    for li in soup.select("li.ld a img"):
        src = li.get("data-src") or li.get("src")
        if src and src.startswith("http"):
            images.append(src)
        if len(images) == 3:
            break
            
    # Also fetch exact coordinates from Nominatim
    lat, lon = None, None
    try:
        nom_url = f"https://nominatim.openstreetmap.org/search?q={urllib.parse.quote(h)}&format=json&limit=1"
        nom_res = requests.get(nom_url, headers={"User-Agent": "MyScraper/1.0"}).json()
        if nom_res:
            lat = float(nom_res[0]["lat"])
            lon = float(nom_res[0]["lon"])
    except Exception as e:
        print("Nom error:", e)

    results[h] = {
        "images": images,
        "lat": lat,
        "lon": lon
    }

with open("hotel_data.json", "w") as f:
    json.dump(results, f, indent=2)

print("Done!")

