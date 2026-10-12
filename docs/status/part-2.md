# Part 2 status

Status: IMPLEMENTED — local validation passed; human Phantom acceptance pending.
Owner: @destinesia7187 (Windows).
Branch: codex/part-2-web.

## Verified

- Four English screens: overview, create, deal, and dispute/resolution. Dark editorial design follows the user-supplied design reference, with readable financial data and mobile layouts.
- Real SDK integrated from part 1 commit a3502ca; shared API, SDK, contract and financial semantics unchanged by part 2.
- Phantom adapter, public wallet-free reads, participant permissions, exact BigInt amounts, local SHA-256, revision guards, explicit reviews and three settlement calculations implemented.
- Operation controller prevents overlapping mutations. Confirmed, failed and unknown receipts are distinct; unknown outcomes cannot be dismissed or automatically repeated. Creation reviews are consumed before signing and cannot reactivate after recovered confirmation.
- TypeScript passed, including SDK source, verification checks and Vite configurations.
- 232 controlled frontend tests passed in 10 files: validation, money, permissions, hashing, async route/wallet/stage changes, operation recovery, creation, receipt feedback and accessibility.
- Three actual read-only Devnet checks passed: completed deal, resolved/refund deal, and exact public asset hashes against completed on-chain submissions.
- Production build passed: 297 modules, JavaScript 976.43 kB / 293.24 kB gzip.
- Clean clone of implementation commit 05cb977: `npm ci` and `npm run build` passed without installing or editing sibling SDK dependencies; Git working tree stayed clean. All three demo hashes remained exact after checkout on Windows.
- Chrome browser QA: 360 px Home/Create/completed deal, 768 px Home/Create, and 1440 px Home/resolved dispute. No horizontal page overflow. Both demo videos load as 15-second media and remain paused. Invalid deal addresses show accessible feedback. Direct dispute reload works without a wallet. Navigation from the lower gallery opens a deal at the top.
- CSS strict parsing passed with zero warnings; financial/body metadata and colored status labels meet contrast checks. Copy feedback and Back-focus behavior have controlled component coverage.
- Public demo SVG bytes are protected against Windows newline conversion.

## Handoff

Frontend implementation commit: 05cb977.
Public site: not deployed; user explicitly chose local-only work.
Local preview: http://127.0.0.1:5173/ while the development server runs.
SDK integration: actual part 1 source and deployed Devnet program.
Program ID: 8ddYBcE1uxzxke9T9ivLqXN9gJiXNY5kGbNYwBfiqCgX.
PR: not opened; local implementation is committed.
Demo walkthrough: docs/demo.md. Human acceptance plan and agent QA: docs/usability.md.

## Remaining acceptance

- Real human Phantom signing from this frontend: create, accept, submissions/replacement, approvals, cancellation and all settlement outcomes. Showing part 1's existing deals is not a substitute.
- Two human usability sessions and a product-demo recording.
- Vercel publication and hosted direct-route checks, deferred by the user.
- Peer review before merge to main.

Recovery limitation: reloading before the SDK returns a signature requires manual wallet/Explorer verification. An uncertain creation does not expose its generated deal address through the SDK error; confirmed recovery explains how to find it in Explorer.

Dependency audit after the scoped bn.js patch reports 27 findings (15 high, 12 moderate), largely propagated through Node/native tooling. Browser export paths were reviewed; no claim of zero vulnerabilities or mainnet readiness is made.
