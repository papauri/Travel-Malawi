const fs = require("fs");
const path = require("path");
const { image_search } = require("duckduckgo-images-api");
const https = require("https");
const http = require("http");

const hotels = [
  { name: "Pumulani Lodge Lake Malawi", id: "pumulani" },
  { name: "Kaya Mawa Likoma Island", id: "kaya-mawa" },
  { name: "Sunbird Ku Chawe Zomba", id: "ku-chawe" },
  { name: "Blue Zebra Island Lodge Malawi", id: "blue-zebra" },
  { name: "Mvuu Camp Liwonde Malawi", id: "mvuu" }
];

const downloadImage = (url, filepath) => {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    client.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
      if (res.statusCode === 200) {
        res.pipe(fs.createWriteStream(filepath))
           .on("error", reject)
           .once("close", () => resolve(filepath));
      } else {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
           return downloadImage(res.headers.location, filepath).then(resolve).catch(reject);
        }
        res.resume();
        reject(new Error("Request Failed With a Status Code: " + res.statusCode));
      }
    }).on("error", reject).setTimeout(5000, function() {
        this.destroy();
        reject(new Error("Request timeout"));
    });
  });
};

const main = async () => {
  const dir = path.join(__dirname, "public", "images", "hotels");
  if (!fs.existsSync(dir)){
    fs.mkdirSync(dir, { recursive: true });
  }

  for (const hotel of hotels) {
    console.log("Searching for: " + hotel.name);
    try {
      const results = await image_search({ query: hotel.name, moderate: true });
      if (results && results.length > 0) {
        let downloadedCount = 0;
        let attempt = 0;
        
        while (downloadedCount < 3 && attempt < results.length) {
          const imgUrl = results[attempt].image;
          try {
            console.log("Downloading " + imgUrl);
            const ext = ".jpg";
            const filename = hotel.id + "-" + (downloadedCount + 1) + ext;
            await downloadImage(imgUrl, path.join(dir, filename));
            downloadedCount++;
          } catch (e) {
            console.log("Failed to download " + imgUrl + ": " + e.message);
          }
          attempt++;
        }
      }
    } catch (error) {
      console.error("Error searching for " + hotel.name + ":", error.message);
    }
  }
};

main();
