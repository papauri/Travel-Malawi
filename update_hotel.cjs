const fs = require('fs');

const file = 'src/pages/HotelDetails.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "import { useAuth } from '../contexts/AuthContext';",
  "import { useAuth } from '../contexts/AuthContext';\nimport { Helmet } from 'react-helmet-async';"
);

content = content.replace(
  "return (\n    <div className=\"min-h-screen bg-stone-50 pb-20\">",
  `return (
    <div className="min-h-screen bg-stone-50 pb-20">
      <Helmet>
        <title>{hotel.name} - MalawiScapes</title>
        <meta name="description" content={hotel.description.substring(0, 160)} />
        <meta property="og:title" content={\`\${hotel.name} - MalawiScapes\`} />
        <meta property="og:description" content={hotel.description.substring(0, 160)} />
        <meta property="og:image" content={hotel.imageUrl} />
      </Helmet>`
);

fs.writeFileSync(file, content);
