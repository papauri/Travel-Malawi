export interface AdminDocMeta {
  id: string;
  title: string;
  subtitle: string;
  category: 'Marketing' | 'Operations' | 'Host Acquisition' | 'Property Onboarding';
  filename: string;
  sizeBytes: number;
  wordCount: number;
  estimatedReadMinutes: number;
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
