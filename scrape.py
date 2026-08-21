
import requests
import re
import json

hotels = [
    "Pumulani Lodge Lake Malawi",
    "Kaya Mawa Likoma Island",
    "Sunbird Ku Chawe Zomba",
    "Blue Zebra Island Lodge Malawi",
    "Mvuu Camp Liwonde Malawi"
]

def search_images(query):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    }
    # DuckDuckGo requires a vqd token first
    res = requests.get(f"https://duckduckgo.com/?q={query}&t=h_&iar=images&iax=images&ia=images", headers=headers)
    match = re.search(r"vqd=([\d-]+)", res.text)
    if not match:
        return []
    vqd = match.group(1)
    
    url = f"https://duckduckgo.com/i.js?l=us-en&o=json&q={query}&vqd={vqd}&f=,,,,,&p=1"
    res = requests.get(url, headers=headers)
    data = res.json()
    
    urls = []
    for item in data.get("results", [])[:3]:
        urls.append(item["image"])
    return urls

def search_coords(query):
    url = f"https://nominatim.openstreetmap.org/search?q={query}&format=json&limit=1"
    headers = {"User-Agent": "TravelMalawiApp/1.0"}
    res = requests.get(url, headers=headers)
    data = res.json()
    if data:
        return float(data[0]["lat"]), float(data[0]["lon"])
    return None, None

results = {}
for h in hotels:
    print(f"Fetching {h}...")
    imgs = search_images(h)
    lat, lon = search_coords(h)
    results[h] = {
        "images": imgs,
        "lat": lat,
        "lon": lon
    }

with open("hotel_data.json", "w") as f:
    json.dump(results, f, indent=2)
print("Done!")

