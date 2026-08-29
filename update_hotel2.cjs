const fs = require('fs');

const file = 'src/pages/HotelDetails.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  '  return (\n      <div className="min-h-screen bg-white pb-24">',
  `  return (
      <div className="min-h-screen bg-white pb-24">
        <Helmet>
          <title>{hotel.name} - Travel Malawi</title>
          <meta name="description" content={hotel.description.substring(0, 160)} />
          <meta property="og:title" content={\`\${hotel.name} - Travel Malawi\`} />
          <meta property="og:description" content={hotel.description.substring(0, 160)} />
          <meta property="og:image" content={hotel.imageUrl} />
        </Helmet>`
);

fs.writeFileSync(file, content);
