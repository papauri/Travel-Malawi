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
    title: 'Pre-Launch Concept Validation Survey',
    subtitle: "Partner discovery framework and survey for lodges, cottages, hotels and camps in Malawi",
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
    title: 'What You Get as a Partner Property',
    subtitle: "A one-page summary for lodge, cottage and hotel owners",
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
    title: 'Marketing and Commercial Strategy',
    subtitle: "Direct booking for independent stays in Malawi: audiences, positioning and launch plan",
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
    title: 'Operations and Field Playbook',
    subtitle: "Partner outreach, common objections and listing quality checks",
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
    title: 'Host Onboarding Starter Pack',
    subtitle: "How to set up a clear, trustworthy listing for an independent property in Malawi",
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
    title: 'Property Listing Reference',
    subtitle: "How to write clear listings that answer travellers' questions before they ask",
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
    title: 'Platform Guide and UAT Checklist',
    subtitle: "Quality checks, test checklists and acceptance criteria for Travel Malawi",
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
 * Generates a plain, standalone HTML version of a document.
 * Uses the same stylesheet as the hand-built guides in server/docs/*.html.
 */
function generateStyledHtml(docMeta: AdminDocMeta, rawMarkdown: string): string {
  const plainText = markdownToReadableText(rawMarkdown);
  const updated = docMeta.lastEditedAt
    ? `Updated ${new Date(docMeta.lastEditedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(docMeta.title)} — Travel Malawi</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #ffffff; color: #44403c; font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; }
    main { max-width: 720px; margin: 48px auto; padding: 0 20px; }
    .category { margin: 0 0 4px; font-size: 13px; color: #78716c; }
    h1, h2, h3 { color: #1c1917; font-weight: 600; line-height: 1.3; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    .subtitle { margin: 0; color: #78716c; }
    .rule { margin: 20px 0 0; border: 0; border-top: 1px solid #e7e5e4; }
    h2 { margin: 36px 0 12px; font-size: 20px; }
    h3 { margin: 24px 0 8px; font-size: 16px; }
    p { margin: 0 0 12px; }
    ul, ol { margin: 0 0 12px; padding-left: 24px; }
    li { margin: 4px 0; }
    strong { color: #1c1917; font-weight: 600; }
    a { color: #1c1917; }
    table { width: 100%; margin: 0 0 16px; border-collapse: collapse; font-size: 14px; }
    th, td { padding: 8px 12px; border: 1px solid #e7e5e4; text-align: left; vertical-align: top; }
    th { background: #fafaf9; color: #1c1917; font-weight: 600; }
    .note { margin: 0 0 16px; padding: 12px 16px; background: #fafaf9; border-left: 2px solid #d6d3d1; }
    .note p:last-child { margin-bottom: 0; }
    code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; }
    pre { margin: 24px 0 0; white-space: pre-wrap; word-break: break-word; color: #44403c; }
    fieldset { margin: 0 0 16px; padding: 0; border: 0; }
    legend { margin: 0 0 4px; padding: 0; color: #1c1917; font-weight: 600; }
    label { display: block; margin: 12px 0 4px; color: #1c1917; font-weight: 600; font-size: 14px; }
    label.option { margin: 4px 0; color: #44403c; font-weight: 400; }
    input, select, textarea, button { font: inherit; }
    input[type="text"], input[type="email"], input[type="tel"], input[type="number"], select, textarea { width: 100%; padding: 8px 10px; color: #1c1917; background: #ffffff; border: 1px solid #d6d3d1; border-radius: 4px; }
    button { margin-top: 16px; padding: 8px 16px; color: #ffffff; background: #1c1917; border: 1px solid #1c1917; border-radius: 4px; cursor: pointer; }
    footer { display: flex; justify-content: space-between; gap: 16px; margin-top: 48px; padding-top: 12px; border-top: 1px solid #e7e5e4; font-size: 13px; color: #78716c; }
    @media (max-width: 600px) { h1 { font-size: 24px; } }
    @media print { main { max-width: none; margin: 0; padding: 0; } body, h1, h2, h3, strong, a, .category, .subtitle, footer { color: #000000; } button { display: none; } }
  </style>
</head>
<body>
<main>
  <header>
    <p class="category">${escapeHtml(docMeta.category)}</p>
    <h1>${escapeHtml(docMeta.title)}</h1>
    <p class="subtitle">${escapeHtml(docMeta.subtitle)}</p>
    <hr class="rule">
  </header>
  <pre>${escapeHtml(plainText)}</pre>
  <footer>
    <span>Travel Malawi</span>
    <span>${escapeHtml(updated)}</span>
  </footer>
</main>
</body>
</html>
`;
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
