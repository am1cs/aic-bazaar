# Part 2 status

Status: INTERFACE CORRECTIONS VERIFIED — committed for peer review, partner validator/Phantom changes integrated. Final combined Vercel deployment belongs to the partner.
Owner: @destinesia7187 (Windows).
Branch: codex/part-2-web.

## Verified

- Four English screens: overview, create, deal, and dispute/resolution. Dark editorial design follows the user-supplied design reference, with readable financial data and mobile layouts.
- Real SDK integrated from part 1 commit a3502ca; shared API, SDK, contract and financial semantics unchanged by part 2.
- Phantom adapter, public wallet-free reads, participant permissions, exact BigInt amounts, local SHA-256, revision guards, explicit reviews and three settlement calculations implemented.
- Operation controller prevents overlapping mutations. Confirmed, failed and unknown receipts are distinct; unknown outcomes cannot be dismissed or automatically repeated. Creation reviews are consumed before signing and cannot reactivate after recovered confirmation.
- TypeScript passed, including SDK source, verification checks and Vite configurations.
- 379 controlled frontend tests passed in 16 files, including the partner's file-format/Phantom restoration checks, actual shared-validator loading of all three demo files, URL preview/failure/replacement states, expandable receipts/dispute controls, validator-before-hash ordering and preserved operation locks. Financial and Phantom encoding guards remain covered.
- Four actual read-only Devnet checks passed: completed deal, resolved/refund deal, exact public asset hashes against completed on-chain submissions, and a fresh real SDK create simulation that intentionally stops before signing or submission.
- Latest production build passed: 308 modules, main JavaScript 991.68 kB / 297.64 kB gzip, shared media chunk 4.82 kB / 2.26 kB gzip, CSS 67.91 kB / 14.84 kB gzip.
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
GitHub handoff — 2026-10-13: the user requested committing and pushing all project work to am1cs/aic-bazaar on codex/part-2-web. The frontend, SDK integration, working spec, validation notes and four supplied design-reference files were pushed. PR #2 was merged by the owner at 2026-10-12T23:31:10Z; origin/main 341ee1f was fast-forwarded into our clean branch before the Phantom fix. Local test-wallet private keys remain outside Git. The follow-up compatibility correction requires a separate peer-reviewed PR.
Demo walkthrough: docs/demo.md. Human acceptance plan and agent QA: docs/usability.md.

## Remaining acceptance

- The user reports a successful Devnet deal and a refund dispute. Further transaction verification, including other settlement outcomes, belongs to the partner for this checkpoint; no new transaction was signed or submitted by this agent.
- Two human usability sessions and a product-demo recording.
- Actual human acceptance of new materials and restored Phantom on the final combined Vercel origin; the shared validator is now present and tested.
- Partner handles final Vercel deployment after peer review and merge of the combined corrections.
- Peer review of the separate interface-correction PR; the user authorized committing on 2026-10-13.

Recovery limitation: reloading before the SDK returns a signature requires manual wallet/Explorer verification. An uncertain creation does not expose its generated deal address through the SDK error; confirmed recovery explains how to find it in Explorer.

Dependency audit after the scoped bn.js patch reports 27 findings (15 high, 12 moderate), largely propagated through Node/native tooling. Browser export paths were reviewed; no claim of zero vulnerabilities or mainnet readiness is made.

## Phantom compatibility checkpoint — 2026-10-13

The user reported `The wallet changed the transaction message. Nothing was submitted.` after creating a deal. The original SDK failure was reproduced with a controlled signer implementing Phantom's documented auto-addition of priority-fee instructions. A web-owned preparation bridge now sets the existing default compute limit (200,000 CU) and zero priority fee before the genuine SDK's wire, fee, balance, simulation and message checks. A Vite resolver redirects only the exact SDK entry's transport import; SDK/contract/shared/deployment files remain unchanged. Unexpected original instruction layouts and signatures fail before RPC/signing. Wallet changes to payer, recipient, instruction data, blockhash, fee or added instructions still reject without broadcasting; missing/invalid signatures, size, balance, simulation, confirmation and unknown-result recovery retain their original guards.

Validation: 287 controlled tests, TypeScript, production build, and four live Devnet checks passed. The live create used only a funded public address and threw an intentional signing-stop error after successful simulation; no key was read, no signature produced and no transaction sent. Public HTTPS /create loaded the new `/assets/index-XZr3LQp4.js` bundle, its deployment readiness check passed, and the browser reported zero console errors. Both loopback production preview and the existing Cloudflare tunnel remain running. The user's actual next Phantom signature and successful create receipt are pending; these tests do not claim a completed human wallet transaction.

## Delivery interface checkpoint — 2026-10-13

Started on clean `codex/part-2-web`; fetched origin and fast-forwarded to origin/main 318cb00, which includes merged PR #3. No commit/push/PR was created for these new corrections. Partner-owned `web/src/providers.tsx`, `web/src/lib/media.ts` and its tests, contract, SDK, deployment, shared types and financial rules were not edited.

The submission form now explains `Host your file → Paste its delivery link → Select the same file`, uses Delivery link / Select the same delivered file labels, explains that selection does not upload, and exposes a safe Open delivery link before submission. Changing the delivery link clears the old fingerprint and selection. `lib/milestoneValidation.ts` is integration glue, not a second validator: it loads only the partner's agreed `validateMilestoneFile(file, index): Promise<void>` export. With the module absent, selecting a file fails visibly before hashing or signing. Current error text says file checks are temporarily unavailable. The partner has not committed that module yet, as confirmed by the human.

Saved on-chain delivery URLs render native image previews or MP4 players with controls; other links remain external. Failed media retain an external link with an accessible message. No local creator file is exposed to another user, no HTML injection, new file storage or marketplace was added. Receipts show a concise outcome with addresses/signature under Technical details; pending/unknown warnings and recovery remain visible and locked. Dispute forms open via Open dispute; payment/arbiter amount confirmations remain unchanged. Chain state supplies the next step, including Concept paid / waiting for Draft.

Actual automated validation: `npm test` passed 331 tests / 14 files; `npm run build` passed TypeScript and production compilation. Independent static review found no blocker. Actual local Chrome over the public HTTPS tunnel: direct completed-deal URL loaded real Devnet state without a wallet; old GitHub blob-page links correctly fell back to external links. The separate `/demo/materials` check uses the same preview component and existing unchanged `/demo/concept.svg`, `draft.mp4`, `final.mp4`; its image decoded to 1080×760, both videos loaded with controls and duration 15s, and actual keyboard playback advanced Draft to 5.51s and Final to 11.44s. The intentionally missing file showed an error while preserving Open delivery link. No horizontal page overflow was observed on the desktop check.

Two-computer acceptance was requested with the exact public check/deal links; the human replied “мы все тест делали все было идеально”. This is recorded as human-reported results, not direct observation of the second computer. No new real file submission can be verified until the partner's validator arrives. Updated test site: https://americans-gardening-banners-keep.trycloudflare.com/demo/materials. Public preview and tunnel must remain running. Partner owns final Vercel deployment; no hackathon submission was made.

## Published partner integration and commit — 2026-10-13

After the human authorized committing, the interface changes were preserved in commit 3d313bc. Fetch revealed partner branch head 6570a39, including 0a7cd84 (Phantom restoration and agreed file validator) and public Devnet/Vercel verification evidence. That branch was merged without conflicts or hand edits to partner files. `providers.tsx`, its tests, `lib/media.ts`, its tests and `web/vercel.json` match the published partner branch exactly; SDK, contract and shared API are unchanged.

The shared validator is now a required explicit module import through our integration adapter. It runs before fingerprinting and signature requests. Three real demo asset files pass through the actual published export, and the same path rejects image files for Draft/Final; no validation stub is used in the production path. JPEG .jpe/.jfif previews also match the partner's accepted image formats. Final `npm test`: 379 passed / 16 files. Final `npm run build`: TypeScript and production build passed, with `/assets/index-DezR0FXm.js` and `/assets/media-BZCQrnPf.js` in the existing Cloudflare preview. Partner's stable Vercel origin is https://aic-bazaar.vercel.app, but its recorded deployment predates these combined interface corrections; no final deployment is claimed or performed by this agent. No wallet transaction or hackathon submission was performed.

## GitHub README checkpoint — 2026-10-13

The user requested a polished GitHub README. The root README now leads with the product, permanent Vercel demo, milestone and dispute flows, delivery semantics, local setup, architecture, recorded verification evidence and trust limits. Public Vercel home returned HTTP 200; all relative documentation/evidence links were checked against existing files. No application, SDK, contract, partner-owned source or financial rules were changed; no tests were rerun for this documentation-only update.

Fetch revealed combined main 7a984c5, with PRs #4–#7 merged and the partner reporting the final combined Vercel build, 380 frontend tests, four read-only Devnet checks and thirteen hosted checks. These README results are attributed to recorded integration evidence, not claimed as a new local run. Local role branch retains its pre-rewrite history; no reset, history merge, commit, push, PR or deployment was performed in this checkpoint. README and this status update remain uncommitted.

## README publication — 2026-10-13

The human authorized committing and publishing the README. This documentation-only update contains README.md and this status file. It will be proposed from codex/part-2-web in a separate reviewable PR; main is not changed directly. The owner-rewritten remote history is preserved by transferring only the new documentation commit onto current origin/main, with a local recovery ref retained and no force push. Application sources, contract, SDK, financial semantics and deployment are unchanged. Relative README links and Git whitespace checks passed; application tests were not repeated for prose changes.
