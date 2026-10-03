import fs from 'fs';
import path from 'path';

export interface AdminDocMeta {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  filename: string;
  htmlFilename?: string;
  liveUrl?: string;
  hasHtml?: boolean;
  sizeBytes: number;
  wordCount: number;
  estimatedReadMinutes: number;
  lastEditedBy?: string;
  lastEditedAt?: string;
  isCustomized?: boolean;
}

export const ADMIN_DOCS: AdminDocMeta[] = [
  {
    id: 'concept-validation-survey',
    title: 'Pre-Launch Concept Validation Survey & Pitch Deck',
    subtitle: 'Three-pillar partner discovery framework (1. Habits & Pain Points, 2. Value Validation, 3. Commitment) with dashboard mockups & blurred metrics',
    category: 'Concept Discovery',
    filename: 'concept_validation_survey.md',
    htmlFilename: 'concept_validation_survey.html',
    hasHtml: true,
    liveUrl: '/concept-validation',
    sizeBytes: 0,
    wordCount: 0,
    estimatedReadMinutes: 4,
  },
  {
    id: 'stay-owner-leaflet',
    title: 'Stay Owner Acquisition Leaflet ("What You Get")',
    subtitle: 'Simple, illustrative one-pager leaflet for lodge & cottage owners: 0% launch commission, Airtel/Mpamba payouts, Ulendo AI concierge',
    category: 'Partner Leaflet',
    filename: 'stay_owner_leaflet.md',
    htmlFilename: 'stay_owner_leaflet.html',
    hasHtml: true,
    liveUrl: '/stay-owner-leaflet',
    sizeBytes: 0,
    wordCount: 0,
    estimatedReadMinutes: 3,
  },
  {
    id: 'marketing-presentation',
    title: 'Marketing & Commercial Strategy Deck',
    subtitle: 'The Sovereign Hospitality Rail: audience segmentation, loss aversion math, and the Trojan Horse acquisition formula',
    category: 'Marketing',
    filename: 'marketing_presentation.md',
    htmlFilename: 'marketing_presentation.html',
    hasHtml: true,
    liveUrl: '/marketing',
    sizeBytes: 0,
    wordCount: 0,
    estimatedReadMinutes: 4,
  },
  {
    id: 'operations-starter-pack',
    title: 'Operations & Field Conversion Playbook',
    subtitle: 'Zero-inertia protocols: the 3-Touch WhatsApp sequence, psychological objection disarming, and quality control pillars',
    category: 'Operations',
    filename: 'operations_starter_pack.md',
    htmlFilename: 'operations_starter_pack.html',
    hasHtml: true,
    liveUrl: '/operations-guide',
    sizeBytes: 0,
    wordCount: 0,
    estimatedReadMinutes: 5,
  },
  {
    id: 'host-onboarding-pack',
    title: 'Host Acquisition & Onboarding Starter Pack',
    subtitle: 'The 8-minute storefront: the 4 golden photos that sell sleep/aspiration, price anchoring, and zero-headache setup',
    category: 'Host Acquisition',
    filename: 'host_onboarding_starter_pack.md',
    htmlFilename: 'host_onboarding_starter_pack.html',
    hasHtml: true,
    liveUrl: '/host-guide',
    sizeBytes: 0,
    wordCount: 0,
    estimatedReadMinutes: 4,
  },
  {
    id: 'property-listing-guide',
    title: 'Property Listing Master Reference',
    subtitle: 'Merchandising psychology: evocative room naming, the 5 essential Malawian amenities, and remote road anxiety disarming',
    category: 'Property Onboarding',
    filename: 'property_listing_guide.md',
    htmlFilename: 'property_listing_guide.html',
    hasHtml: true,
    liveUrl: '/listing-guide',
    sizeBytes: 0,
    wordCount: 0,
    estimatedReadMinutes: 3,
  },
  {
    id: 'platform-guide-uat',
    title: 'Platform Guide & UAT Verification Manual',
    subtitle: 'Quality assurance protocols, verification checklists, and end-to-end user acceptance standards',
    category: 'Platform Standards & QA',
    filename: 'platform_guide_uat.md',
    htmlFilename: 'platform_guide_uat.html',
    hasHtml: true,
    liveUrl: '/uat',
    sizeBytes: 0,
    wordCount: 0,
    estimatedReadMinutes: 4,
  },
];

export function getDocsDir(): string {
  const candidates = [
    path.join(process.cwd(), 'server', 'docs'),
    path.join(process.cwd(), 'docs'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  const defaultDir = path.join(process.cwd(), 'server', 'docs');
  if (!fs.existsSync(defaultDir)) {
    fs.mkdirSync(defaultDir, { recursive: true });
  }
  return defaultDir;
}

export function getDataDir(): string {
  const dir = path.join(process.cwd(), 'server', 'data');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getDocDefaultsDir(): string {
  const dir = path.join(getDataDir(), 'doc_defaults');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

interface CustomMetaStore {
  [docId: string]: {
    title?: string;
    subtitle?: string;
    category?: string;
    lastEditedBy?: string;
    lastEditedAt?: string;
    isCustomized?: boolean;
  };
}

function getCustomMetaFilePath(): string {
  return path.join(getDataDir(), 'custom_docs_meta.json');
}

function loadCustomMeta(): CustomMetaStore {
  try {
    const file = getCustomMetaFilePath();
    if (fs.existsSync(file)) {
      const data = fs.readFileSync(file, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn('[docUtils] Failed to load custom metadata:', err);
  }
  return {};
}

function saveCustomMeta(meta: CustomMetaStore): void {
  try {
    const file = getCustomMetaFilePath();
    fs.writeFileSync(file, JSON.stringify(meta, null, 2), 'utf-8');
  } catch (err) {
    console.error('[docUtils] Failed to save custom metadata:', err);
  }
}

// Backup original baseline files if not already backed up
function ensureDefaultBackup(filename: string): void {
  try {
    const docsDir = getDocsDir();
    const defaultsDir = getDocDefaultsDir();
    const backupPath = path.join(defaultsDir, filename);
    const sourcePath = path.join(docsDir, filename);

    if (!fs.existsSync(backupPath) && fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, backupPath);
    }
  } catch (err) {
    console.warn(`[docUtils] Failed to backup default for ${filename}:`, err);
  }
}

/**
 * Converts markdown content into clean, universally readable plain text (.txt)
 * removing distracting markdown syntax while preserving hierarchy and structure.
 */
export function markdownToReadableText(md: string): string {
  if (!md) return '';

  let text = md;

  // 1. Normalize line endings
  text = text.replace(/\r\n/g, '\n');

  // 2. Format mermaid diagrams into clear text notes
  text = text.replace(/```mermaid[\s\S]*?```/g, (match) => {
    const lines = match.split('\n').filter(l => l.trim() && !l.includes('mermaid') && !l.includes('```'));
    const flowSteps = lines
      .map(l => l.replace(/[\[\]"']/g, '').replace(/-->/g, ' -> ').trim())
      .filter(Boolean)
      .join('\n    ');
    return `\n[ WORKFLOW DIAGRAM ]\n    ${flowSteps}\n`;
  });

  // 3. Format other code blocks cleanly
  text = text.replace(/```[a-z0-9_-]*\n([\s\S]*?)```/gi, (_, code) => {
    return `\n-------------------- CODE / SCRIPT --------------------\n${code.trim()}\n-------------------------------------------------------\n`;
  });

  // 4. Format GitHub callouts / alerts: > [!NOTE], > [!IMPORTANT], > [!TIP]
  text = text.replace(/^>\s*\[!(NOTE|IMPORTANT|TIP|WARNING|CAUTION)\]\s*(.*)$/gim, (_, type, rest) => {
    return `\n[${type.toUpperCase()}] ${rest.trim()}`;
  });
  // Strip blockquote markers
  text = text.replace(/^>\s?(.*)$/gm, '  $1');

  // 5. Format Headers into clear readable section dividers
  // Level 1: # Title
  text = text.replace(/^#\s+(.+)$/gm, (_, title) => {
    const border = '='.repeat(Math.max(title.length, 60));
    return `\n${border}\n${title.toUpperCase()}\n${border}\n`;
  });

  // Level 2: ## Section
  text = text.replace(/^##\s+(.+)$/gm, (_, title) => {
    const border = '-'.repeat(Math.max(title.length, 50));
    return `\n\n${title.toUpperCase()}\n${border}\n`;
  });

  // Level 3: ### Subsection
  text = text.replace(/^###\s+(.+)$/gm, (_, title) => {
    return `\n[ ${title} ]\n`;
  });

  // Level 4: #### Sub-subsection
  text = text.replace(/^####\s+(.+)$/gm, (_, title) => {
    return `\n  * ${title}:\n`;
  });

  // 6. Format Markdown tables to clean readable columnar text
  text = text.replace(/(\|[^\n]+\|\n)+/g, (tableBlock) => {
    const lines = tableBlock.trim().split('\n');
    if (lines.length < 2) return tableBlock;

    const rows = lines
      .filter(line => !line.match(/^\|[\s\-:|]+\|$/)) // remove divider line |---|---|
      .map(line => line.split('|').slice(1, -1).map(c => c.trim()));

    if (rows.length === 0) return '';

    // Calculate max width for each column
    const colCount = Math.max(...rows.map(r => r.length));
    const colWidths: number[] = Array(colCount).fill(0);
    rows.forEach(r => {
      r.forEach((cell, idx) => {
        if (cell.length > colWidths[idx]) colWidths[idx] = cell.length;
      });
    });

    const formattedRows = rows.map((r, rIdx) => {
      const lineStr = r.map((cell, idx) => cell.padEnd(colWidths[idx] || 10, ' ')).join('  |  ');
      if (rIdx === 0) {
        const divider = colWidths.map(w => '-'.repeat(w)).join('--+--');
        return `  ${lineStr}\n  ${divider}`;
      }
      return `  ${lineStr}`;
    });

    return `\n\n${formattedRows.join('\n')}\n\n`;
  });

  // 7. Format images: ![alt](url) -> [IMAGE: alt]
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, (_, alt) => {
    return alt ? `[IMAGE: ${alt}]` : '[IMAGE]';
  });

  // 8. Format links: [text](url) -> text (url) or just text if anchor
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
    if (url.startsWith('#')) return label;
    if (label.toLowerCase() === url.toLowerCase()) return url;
    return `${label} (${url})`;
  });

  // 9. Remove bold / italic markers
  text = text.replace(/\*\*\*([^*]+)\*\*\*/g, '$1');
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/\*([^*]+)\*/g, '$1');
  text = text.replace(/___([^_]+)___/g, '$1');
  text = text.replace(/__([^_]+)__/g, '$1');
  text = text.replace(/_([^_]+)_/g, '$1');

  // 10. Inline code: `code` -> 'code'
  text = text.replace(/`([^`]+)`/g, "'$1'");

  // 11. Clean bullet lists: -, *, +
  text = text.replace(/^[\*\-\+]\s+(.+)$/gm, '  • $1');

  // 12. Clean horizontal rules: ---, ***, ___
  text = text.replace(/^[\-\*_]{3,}\s*$/gm, '------------------------------------------------------------');

  // 13. Collapse excess blank lines (max 2 consecutive)
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim() + '\n';
}

/**
 * Returns metadata for all available admin documents with any customizations merged.
 */
export function getAdminDocsList(): AdminDocMeta[] {
  const docsDir = getDocsDir();
  const customMeta = loadCustomMeta();

  return ADMIN_DOCS.map(baseDoc => {
    const custom = customMeta[baseDoc.id] || {};
    const doc: AdminDocMeta = {
      ...baseDoc,
      title: custom.title || baseDoc.title,
      subtitle: custom.subtitle || baseDoc.subtitle,
      category: custom.category || baseDoc.category,
      lastEditedBy: custom.lastEditedBy,
      lastEditedAt: custom.lastEditedAt,
      isCustomized: !!custom.isCustomized,
    };

    const filePath = path.join(docsDir, doc.filename);
    try {
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        const content = fs.readFileSync(filePath, 'utf-8');
        const words = content.trim().split(/\s+/).length;
        doc.sizeBytes = stats.size;
        doc.wordCount = words;
        doc.estimatedReadMinutes = Math.max(1, Math.ceil(words / 200));
      }
    } catch {
      // ignore
    }
    return doc;
  });
}

/**
 * Retrieves the document content in plain text format, raw markdown, or standalone HTML.
 */
export function getAdminDocContent(id: string, format: 'text' | 'md' | 'html' = 'text'): {
  doc: AdminDocMeta;
  content: string;
  format: 'text' | 'md' | 'html';
  filename: string;
} | null {
  const allDocs = getAdminDocsList();
  const docMeta = allDocs.find(d => d.id === id || d.filename === id || d.htmlFilename === id);
  if (!docMeta) return null;

  const docsDir = getDocsDir();

  // If HTML format is specifically requested and an htmlFilename is provided
  if (format === 'html' && docMeta.htmlFilename) {
    const htmlPath = path.join(docsDir, docMeta.htmlFilename);
    if (fs.existsSync(htmlPath)) {
      const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
      return {
        doc: docMeta,
        content: htmlContent,
        format: 'html',
        filename: docMeta.htmlFilename,
      };
    }
  }

  const filePath = path.join(docsDir, docMeta.filename);
  if (!fs.existsSync(filePath)) return null;

  const rawMarkdown = fs.readFileSync(filePath, 'utf-8');
  let content = rawMarkdown;
  let extension = 'md';

  if (format === 'text') {
    content = markdownToReadableText(rawMarkdown);
    extension = 'txt';
  } else if (format === 'html') {
    content = generateStyledHtml(docMeta, rawMarkdown);
    extension = 'html';
  }

  const outFilename = docMeta.filename.replace(/\.md$/, `.${extension}`);

  return {
    doc: docMeta,
    content,
    format,
    filename: outFilename,
  };
}

/**
 * Generates clean, responsive, editorial standalone HTML for a document
 */
function generateStyledHtml(docMeta: AdminDocMeta, rawMarkdown: string): string {
  const plainText = markdownToReadableText(rawMarkdown);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(docMeta.title)} — Travel Malawi</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 840px; margin: 40px auto; padding: 0 24px; color: #1c1917; line-height: 1.6; background-color: #fafaf9; }
    .card { background: #ffffff; border: 1px solid #e7e5e4; border-radius: 16px; padding: 36px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .badge { display: inline-block; background: #e7e5e4; color: #1c1917; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 12px; }
    h1 { font-size: 26px; font-family: Georgia, serif; color: #0c0a09; margin-top: 0; margin-bottom: 8px; border-bottom: 2px solid #1c1917; padding-bottom: 12px; }
    .subtitle { font-size: 14px; color: #57534e; margin-bottom: 24px; font-style: italic; }
    pre { background: #f5f5f4; border: 1px solid #e7e5e4; border-radius: 12px; padding: 20px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; color: #292524; }
    .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e7e5e4; font-size: 12px; color: #78716c; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">${escapeHtml(docMeta.category)}</div>
    <h1>${escapeHtml(docMeta.title)}</h1>
    <div class="subtitle">${escapeHtml(docMeta.subtitle)}</div>
    <pre>${escapeHtml(plainText)}</pre>
    <div class="footer">
      <span>Travel Malawi Hospitality Rail &bull; Official Partner Document</span>
      <span>${docMeta.lastEditedAt ? `Updated: ${new Date(docMeta.lastEditedAt).toLocaleDateString()}` : 'Live Standard'}</span>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Saves edited document content and metadata. Accessible to Marketing and Super Admin.
 */
export function saveAdminDoc(
  id: string,
  updates: {
    title?: string;
    subtitle?: string;
    category?: string;
    content?: string;
    lastEditedBy?: string;
  }
): { success: boolean; doc?: AdminDocMeta; error?: string } {
  const baseDoc = ADMIN_DOCS.find(d => d.id === id);
  if (!baseDoc) {
    return { success: false, error: 'Document not found' };
  }

  const docsDir = getDocsDir();
  const filePath = path.join(docsDir, baseDoc.filename);

  // Ensure default copy is backed up prior to first modification
  ensureDefaultBackup(baseDoc.filename);

  // 1. Update Markdown content on disk if provided
  if (typeof updates.content === 'string') {
    try {
      fs.writeFileSync(filePath, updates.content, 'utf-8');
    } catch (err: any) {
      console.error(`[docUtils] Failed to write ${baseDoc.filename}:`, err);
      return { success: false, error: err?.message || 'Failed to write document content file' };
    }
  }

  // 2. Update metadata in custom store
  const customMeta = loadCustomMeta();
  const existing = customMeta[id] || {};
  const now = new Date().toISOString();

  customMeta[id] = {
    ...existing,
    title: updates.title?.trim() || existing.title || baseDoc.title,
    subtitle: updates.subtitle?.trim() || existing.subtitle || baseDoc.subtitle,
    category: updates.category?.trim() || existing.category || baseDoc.category,
    lastEditedBy: updates.lastEditedBy || existing.lastEditedBy || 'Administrator',
    lastEditedAt: now,
    isCustomized: true,
  };
  saveCustomMeta(customMeta);

  // 3. Update or regenerate the standalone HTML version
  if (baseDoc.htmlFilename) {
    try {
      const currentMarkdown = typeof updates.content === 'string' 
        ? updates.content 
        : fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
      const updatedMeta: AdminDocMeta = {
        ...baseDoc,
        title: customMeta[id].title || baseDoc.title,
        subtitle: customMeta[id].subtitle || baseDoc.subtitle,
        category: customMeta[id].category || baseDoc.category,
        lastEditedAt: now,
      };
      const htmlContent = generateStyledHtml(updatedMeta, currentMarkdown);
      const htmlPath = path.join(docsDir, baseDoc.htmlFilename);
      fs.writeFileSync(htmlPath, htmlContent, 'utf-8');
    } catch (err) {
      console.warn(`[docUtils] Failed to update HTML for ${baseDoc.id}:`, err);
    }
  }

  const updatedDocList = getAdminDocsList();
  const updatedDoc = updatedDocList.find(d => d.id === id);

  return {
    success: true,
    doc: updatedDoc,
  };
}

/**
 * Resets a document to its factory original defaults.
 */
export function resetAdminDoc(id: string): { success: boolean; doc?: AdminDocMeta; content?: string; error?: string } {
  const baseDoc = ADMIN_DOCS.find(d => d.id === id);
  if (!baseDoc) {
    return { success: false, error: 'Document not found' };
  }

  const docsDir = getDocsDir();
  const defaultsDir = getDocDefaultsDir();
  const targetPath = path.join(docsDir, baseDoc.filename);
  const backupPath = path.join(defaultsDir, baseDoc.filename);

  let restoredContent = '';

  // 1. Restore file from backup if available
  if (fs.existsSync(backupPath)) {
    try {
      restoredContent = fs.readFileSync(backupPath, 'utf-8');
      fs.writeFileSync(targetPath, restoredContent, 'utf-8');
    } catch (err: any) {
      return { success: false, error: 'Failed to restore default content file' };
    }
  }

  // 2. Clear custom metadata overrides
  const customMeta = loadCustomMeta();
  delete customMeta[id];
  saveCustomMeta(customMeta);

  // 3. Regenerate standalone HTML from default content
  if (baseDoc.htmlFilename && restoredContent) {
    try {
      const htmlPath = path.join(docsDir, baseDoc.htmlFilename);
      const defaultHtml = generateStyledHtml(baseDoc, restoredContent);
      fs.writeFileSync(htmlPath, defaultHtml, 'utf-8');
    } catch {
      // non-fatal
    }
  }

  const updatedDocList = getAdminDocsList();
  const updatedDoc = updatedDocList.find(d => d.id === id);

  return {
    success: true,
    doc: updatedDoc,
    content: restoredContent,
  };
}
