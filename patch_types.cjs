const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf8');

code = code.replace(
  `export interface HotelEmailAutomationSettings {`,
  `export interface WhatsAppTemplate {
  id: string;
  title: string;
  body: string;
  createdAt: number;
}

export interface HotelEmailAutomationSettings {`
);

code = code.replace(
  `  emailAutomationSettings?: HotelEmailAutomationSettings;
}`,
  `  emailAutomationSettings?: HotelEmailAutomationSettings;
  whatsappTemplates?: WhatsAppTemplate[];
}`
);

fs.writeFileSync('src/types.ts', code);
