# Lead: cleanup — Hygiene (runs last, alone)
Owns nothing but may edit any file **only** for the removals below. Protocol: `agents/PROTOCOL.md`.

## Mission
Remove what is provably unused or stale without changing behaviour.

## Rules
- Prove before removing: grep the symbol/file across `src/ server/ scripts/ server.ts index.html`
  (including dynamic imports and string route names). If unsure, log it instead.
- Never touch behaviour, styling or public API shapes. No renames of files/components.
- Run `npx tsc --noEmit` after each batch of removals.

## Checklist
- Unused imports, unused local variables/functions, unexported dead helpers.
- Orphan files (component/lib/script no longer imported or referenced in package.json).
- Duplicated utilities (`src/lib/docUtils.ts` vs `server/docUtils.ts`,
  `src/lib/localMenuParser.ts` vs `server/localMenuParser.ts`): log divergence; only dedupe if
  trivially safe.
- Leftover debug `console.log` (keep `console.error/warn` and the logger).
- Stale legacy naming in user-facing strings: "StayOS Copilot" → "Ulendo".
- Stray tracked artefacts (`.aistudio/`, backup files, screenshots) — list them; delete only if
  nothing references them.
- Unused dependencies in `package.json` (grep imports) — log, don't remove without proof.
- Read the other leads' board files only to skip what they already fixed.
