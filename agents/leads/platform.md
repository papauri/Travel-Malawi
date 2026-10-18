# Lead: platform — Security, Auth, Data Contracts & Build
Owned files: see `agents/README.md` (platform rows + unclaimed `server.ts`). Protocol: `agents/PROTOCOL.md`.

## Mission
The data layer is secure and consistent: rules, types and real reads/writes agree, and the app
builds and runs.

## Checklist
- `firestore.rules` / `storage.rules`: every collection the app writes (grep `collection(` /
  `doc(` in src+server) has a rule; guests/managers/admins limited to their tenant; bulk writes
  must keep `hotelId`; no `allow ... if true` on private data; role fields not self-writable.
- **Contract integrity:** `src/types.ts` enums/fields vs what code writes vs what rules check —
  report mismatches (e.g. a status value written that rules or types don't know). This is your
  main cross-department duty; hand off consumer fixes.
- `server.ts` middleware: auth token verification (`server/auth.ts`) on every non-public route,
  admin checks on `/api/admin/*`, CORS, body-size limits, upload type/size validation, error
  handler doesn't leak stacks/secrets, rate limiting on public POSTs (telemetry, surveys).
- AuthContext/AuthDialog: role resolution, sign-out clears state/listeners, password reset path.
- Env: no secret in `vite.config.ts` `define`, `.env.example` complete, envSanitizer applied.
- Build: `esbuild` bundling of server, `package.json` scripts, tsconfig strictness.

## Usual handoffs
everyone — when a rule/type/auth change affects their files (grep consumers, notify each owner).
