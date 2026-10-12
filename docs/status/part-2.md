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
- 254 controlled frontend tests passed in 11 files: validation, money, permissions, hashing, async route/wallet/stage changes, operation recovery, creation, receipt feedback, accessibility and motion safeguards. Twelve additional creation cases cover selected arbiters, duplicate/invalid addresses, draft migration and review invalidation.
- Three actual read-only Devnet checks passed: completed deal, resolved/refund deal, and exact public asset hashes against completed on-chain submissions.
- Latest production build passed: 303 modules, JavaScript 984.86 kB / 295.68 kB gzip, CSS 66.27 kB / 14.48 kB gzip.
- Clean clone of implementation commit 05cb977: `npm ci` and `npm run build` passed without installing or editing sibling SDK dependencies; Git working tree stayed clean. All three demo hashes remained exact after checkout on Windows.
- Baseline Chrome browser QA: 360 px Home/Create/completed deal, 768 px Home/Create, and 1440 px Home/resolved dispute. No horizontal page overflow. Invalid deal addresses show accessible feedback. Direct dispute reload works without a wallet. Navigation from the lower gallery opens a deal at the top.
- Latest in-app browser QA: 360, 835 and 1440 px Home; no horizontal overflow. Main copy is 16 px desktop, 15.2 px tablet and 14.4 px mobile; the network note is 12 px. Sticky navigation has real destinations, mobile Tab enters the menu and Escape restores its trigger. Hash navigation focuses its heading below the sticky header (104 px heading offset against an 89 px header on desktop).
- Actual scrolling changes room depth/rotation: progress 0.793 at scrollY 633 px produced the expected 3D transform while the room remained visible. Staggered cards respond to viewport progress. Motion off resets the room transform and stops the camera, with copy fully visible. Initial/change reduced motion, stale callbacks and cleanup have controlled coverage; changing the OS setting in-browser remains unrun.
- GLOW gallery contains three loaded violet static covers, zero video elements and zero download links. Covers are separate previews; original on-chain delivery assets and hashes are unchanged.
- CSS strict parsing passed with zero warnings; financial/body metadata and colored status labels meet contrast checks. Copy feedback and Back-focus behavior have controlled component coverage.
- Public demo SVG bytes are protected against Windows newline conversion.

## Handoff

Integration checkpoint — 2026-10-13: PR #1 remains open/unmerged. Its current head a3502cafabaa0c8ca8b9b4963bc868d9cbb01e51 is already an ancestor of this branch; SDK, contracts, deployment and shared API match that head exactly. No merge conflict or additional source integration was needed. Technical handoff, SDK README and Devnet manifest were read again; all three real read-only Devnet checks passed again.

The create form now accepts a human-controlled arbiter wallet before creation, defaulting to the deployment address. This removes dependence on the demo arbiter during joint acceptance without changing SDK, contract, immutable roles or settlement rules. The chosen address is validated and reviewed; editing it invalidates the old confirmation. Phantom selection and the fresh test draft were checked in the browser. Signing remains NOT RUN.

Three fresh local Devnet test wallets were generated at the user's request. Their private keys are stored outside the repository with restricted directory access and never printed. Initial public balances were checked at zero. Read-only Devnet RPC verified 1 SOL (1,000,000,000 lamports) in each wallet at 2026-10-12T22:55:57.5107378Z, confirmed slot 510421280; genesis and public deployment metadata matched the manifest. Phantom import and human signatures remain pending / NOT RUN; the test plan is in docs/usability.md.

Frontend implementation baseline: 05cb977; the latest local visual checkpoint is recorded in the branch history.
Public test site: https://americans-gardening-banners-keep.trycloudflare.com/ — a temporary Cloudflare Quick Tunnel requested by the user on 2026-10-13 for testing with a friend. It serves the existing production build through loopback preview on port 4173; the computer, preview and tunnel must stay running. Vercel publication remains deferred.
Local preview: http://127.0.0.1:5173/; new deal: http://127.0.0.1:5173/create while the development server runs. Use a browser with Phantom on this PC; this loopback URL is not remotely accessible.
Public browser checks: Home, direct completed-deal and resolved-dispute routes loaded over HTTPS and fetched their real Devnet state; direct /create loaded. Production assets contain no Vite dev client, sourcemaps or key files. No human signing has been performed. Localhost drafts/receipts do not transfer to the public hostname; keep one URL/tab for each pending operation.
SDK integration: actual part 1 source and deployed Devnet program.
Program ID: 8ddYBcE1uxzxke9T9ivLqXN9gJiXNY5kGbNYwBfiqCgX.
GitHub handoff — 2026-10-13: the user requested committing and pushing all project work to am1cs/aic-bazaar on codex/part-2-web. This checkpoint includes the frontend, SDK integration, working spec, validation notes and four supplied design-reference files. Local test-wallet private keys remain outside Git. Remote push verification is recorded in the chat. PR: not opened.
Demo walkthrough: docs/demo.md. Human acceptance plan and agent QA: docs/usability.md.

## Remaining acceptance

- Real human Phantom signing from this frontend: create, accept, submissions/replacement, approvals, cancellation and all settlement outcomes. Showing part 1's existing deals is not a substitute.
- Two human usability sessions and a product-demo recording.
- Vercel publication and hosted direct-route checks, deferred by the user.
- Peer review before merge to main.

Recovery limitation: reloading before the SDK returns a signature requires manual wallet/Explorer verification. An uncertain creation does not expose its generated deal address through the SDK error; confirmed recovery explains how to find it in Explorer.

Dependency audit after the scoped bn.js patch reports 27 findings (15 high, 12 moderate), largely propagated through Node/native tooling. Browser export paths were reviewed; no claim of zero vulnerabilities or mainnet readiness is made.
