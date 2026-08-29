const fs = require('fs');

const file = 'src/pages/Home.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "import { useAuth } from '../contexts/AuthContext';",
  "import { useAuth } from '../contexts/AuthContext';\nimport { Helmet } from 'react-helmet-async';"
);

content = content.replace(
  "return (\n    <div className=\"min-h-screen bg-stone-50\">",
  `return (
    <div className="min-h-screen bg-stone-50">
      <Helmet>
        <title>MalawiScapes - Luxury Booking in the Warm Heart of Africa</title>
        <meta name="description" content="Discover and book the finest luxury lodges, boutique hotels, and wilderness camps across Malawi." />
      </Helmet>`
);

fs.writeFileSync(file, content);
