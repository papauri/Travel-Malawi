# Lead Protocol — how every department lead works and talks

Any agent (Claude, Codex, Gemini, Cursor, Copilot…) can act as a lead: read this file, then your
brief in `agents/leads/<lead>.md`, then do the task you were given. Nothing else is required reading
(`AGENTS.md` holds the project rules every lead must enforce).

## 1. Token budget rules (mandatory)
1. **Grep first, read second.** Locate with search; read only the line ranges you need (≤400 lines
   per read). Never read a whole file >600 lines in one go. Never re-read a range you already hold.
2. **Stay in your lane.** Read files you do not own only to confirm a contract (grep the symbol,
   read ≤60 lines around it). Do not audit other leads' files.
3. **Fix, don't narrate.** For files you own, patch the bug immediately. Log one line per fix.
4. **No speculation.** A finding needs `file:line` + a concrete failure (input/state → wrong result).
   "Could be improved" is not a finding.
5. **No FYIs.** Only send a handoff when the rules in §3 require it.
6. **Short final reply** (≤10 lines): counts fixed/logged, handoffs sent, open risks. Details live
   on the board, not in the reply.
7. Don't run `npm run build`; run `npx tsc --noEmit` once when done and only fix errors in your files
   (errors in other leads' files may be their in-progress edits — ignore them).
8. Never commit or push. The orchestrator verifies and ships.

## 2. Severity & what to fix
| Sev | Meaning | Action |
|---|---|---|
| P0 | security hole, data loss/corruption, double-booking, crash, leaked key/PII | fix now |
| P1 | feature broken or wrong result (wrong price, wrong status, dead button) | fix now |
| P2 | inconsistency between screens/files, missing loading/empty/error state, rule violation from `AGENTS.md` | fix now |
| P3 | polish | fix only if ≤5 lines, else log |

Fixes must be minimal and match surrounding code style. Don't refactor working code, rename files,
or change public contracts unless that *is* the fix (then §3b applies).

## 3. When to talk to another lead (and only then)
a. The fix needs an edit in a file another lead owns (see ownership map in `agents/README.md`).
b. You changed a **shared contract**: a field/enum in `src/types.ts`, a Firestore document shape,
   an `/api/*` request/response shape, a `firestore.rules` condition, a shared hook's signature.
   Notify every lead whose files consume it (grep for consumers first).
c. The root cause lives in another domain and patching your side would only hide it.

**Shared files.** `src/types.ts`: any lead may add *optional* fields; anything else → hand off to
`platform`. `server.ts`: a lead may edit the body of routes in its own path prefix (see README);
re-read the exact range right before each edit and keep edits small. Middleware, auth guards and
unclaimed routes belong to `platform`.

## 4. The board (file-based message bus)
```
agents/board/<lead>.md          your log (only you write it)
agents/board/inbox/<lead>.md    handoffs addressed to <lead> (others append, owner reads)
```
**Log line** (in your own board file):
```
- [<lead>-<n>] P1 FIXED  src/lib/availability.ts:88 — checkOut==checkIn accepted → now rejected
- [<lead>-<n>] P2 LOGGED src/pages/Home.tsx:1201 — reason it was not fixed
```
**Handoff line** — append with a shell append so parallel writers never clobber each other:
```bash
echo "- [H-<from>-<n>] P1 → <to> | src/x.tsx:120 | problem → requested change | contract: <none|what changed>" >> agents/board/inbox/<to>.md
```
(PowerShell: `Add-Content agents/board/inbox/<to>.md "<line>"`.)

When you process your inbox, append the outcome to your own board:
`- [H-<from>-<n>] DONE|REJECTED <one-line reason>`.

## 5. Done criteria for a lead
- Every item on your brief's checklist was checked against your owned files.
- All P0–P2 in your files fixed; P3 fixed or logged.
- Every handoff in your inbox is DONE or REJECTED with a reason.
- `npx tsc --noEmit` shows no errors in your files.
