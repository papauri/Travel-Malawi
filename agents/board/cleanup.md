status: in-progress
- [cleanup-1] P3 FIXED public/robots.txt — deleted; shadowed by server.ts GET /robots.txt (generateRobotsTxt), no other references
- [cleanup-2] P3 FIXED server/aiService.ts:3954-4289 — removed unreachable generateCuratedMalawi{Amenities,Rooms,RateAdvice,Polish,Shorten,Highlights,ListingReview,DescriptionLink}, generateCuratedOperationsChatReply, and handleCuratedActionFallback's non-review branches (ai-26); kept PropertyDraft/PropertyLookup/Reviews (used by scripts/test-*.ts and internally) and detectMalawiRegion
- [cleanup-3] P3 LOGGED src/components/EditableSection.tsx, src/lib/utils.ts — provably unreferenced (grep src server scripts index.html); deletion was blocked by the permission system, owner/orchestrator may `git rm`. utils.ts is the only user of deps clsx + tailwind-merge (then also removable from package.json)
- [cleanup-4] P3 LOGGED .aistudio/artifacts/brain/**, scripts/take-screenshots.mjs, scripts/take-auth-screenshot.mjs — tracked stray AI Studio artefact / ad-hoc screenshot scripts, referenced only by agents/leads/cleanup.md; not deleted
- [cleanup-5] P3 LOGGED noUnusedLocals reports ~400 unused imports/locals across src/pages and components (e.g. ManageHotel 20, Home 20) — in other leads' actively edited files, not bulk-removed
- [cleanup-6] OK no user-facing "StayOS Copilot" left (remaining StayOS hits are internal identifiers/comments); remaining console.log are startup/PWA/model-registry operational lines
- [H-ux-c1] DONE public/robots.txt deleted
status: done
