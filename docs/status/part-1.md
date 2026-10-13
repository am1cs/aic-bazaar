# Part 1 status

Status: IMPLEMENTED — human Devnet flows verified; assigned wallet/media fixes ready for frontend integration and review.
Owner: @am1cs (macOS).
Branch: codex/part-1-contract-sdk.

## Verified

- Shared API v1 and role boundaries documented.
- All seven Anchor instructions implemented against the shared API v1.
- Native Rust build and seven unit tests passed.
- SDK typecheck and 53 unit tests passed. Genuine compiler IDL bundled.
- All seven IDL instructions serialize; largest maximum-field transaction is 825 bytes.
- Compiled SBF program passed 11 raw integration scenarios (12 TAP tests) locally.
- Raw suite: 65 confirmed transactions and 73 expected program/preflight rejections.
- Actual SDK integration: five scenarios passed on the compiled local program.
- Devnet program deployed; downloaded program binary matches the tested artifact.
- Two final Devnet demo deals confirmed: completed and resolved by refund.
- Seventeen public receipts checked (deployment plus sixteen demo operations/funding).
- Actual payout and refund deltas checked from Devnet transaction metadata.

## Next checkpoint

The human explicitly assigned part 1 the wallet provider, new shared frontend
media validator/tests, Devnet verification and Vercel publication. Part 2 still
owns delivery/preview/receipt/dispute UI and calls the validator before hashing.
Integrate both participants' fixes, repeat with real delivery links, then publish
the combined build. Contract, SDK and financial semantics remain unchanged.

## Assigned frontend fixes — 2026-10-13

- Integrated latest main 318cb00, including part 2's Phantom transport bridge.
- Enabled WalletProvider restoration of the remembered wallet; the legacy adapter
  uses Phantom's onlyIfTrusted connection, and Wallet Standard uses silent connect.
  Explicit disconnect clears the remembered selection. No signing runs on restore.
- Seven provider tests cover first visit, actual Wallet Standard registration,
  reload, StrictMode, explicit disconnect, revoked permission and account switching.
- Added validateMilestoneFile(file, index): Promise<void> in web/src/lib/media.ts.
  Concept: PNG/JPEG/WebP/GIF/SVG; Draft/Final: MP4 with video-track metadata and
  media payload. Checks nonempty/128 MiB limit, extension, reported MIME and
  structural content. Accept constants are exported for the frontend owner.
- Thirty-four media tests pass, including all three real public demo assets.
  Personal screenshot bytes were not copied into the repository.
- These checks do not decode media, assess quality/duration/resolution, verify
  remote delivery contents, upload files or replace client review.
- Forty-one scoped tests passed. TypeScript and production build passed.
- Full suite found one existing cross-platform failure from main in
  sdkTransportBridge.test.ts: the Windows importer string is not normalized on
  macOS/Linux by Vite normalizePath. Part 2 must normalize backslashes explicitly
  in transportBridgePlugin.ts before normalizePath; root did not edit that file.
- Vercel CLI installed in ignored .local and authenticated by the human.
  Project aic-bazaar created in the human's amanbekov10-4248s-projects scope.
  Publication and hosted acceptance are not yet claimed. Upload only clean,
  committed source; the working checkout contains ignored private-key files.

## Repeatable human Devnet verification — 2026-10-13

- deployment/verify-human-deals.mjs reads public accounts and bounded receipt
  history without a wallet. Optional arguments select deals; its default finds
  deals for the supplied human client/creator pair.
- Fifteen finalized receipts independently checked: nine completed-flow and six
  refund-flow transactions. Required signers, revision/hash guards and exact
  lamport deltas match replayed obligations and the final accounts.
- Both accounts retain only 10,322,560 lamports of rent, with zero budget/bond
  obligations. Discovery found exactly the two known human deals and no newer one.
- Public normalized evidence: deployment/human-verification.json. This verifies
  on-chain state/payments, not human acceptance of the new frontend changes.

## Human refund-dispute verification — 2026-10-13

- Read the supplied Devnet deal FtFChaQZEEdPuTnkVeXGxk4JHE5fku6u3qicVN4hyz7b.
- All six transactions succeeded: create, accept, submit Concept, approve Concept,
  open dispute signed by the client, and resolve dispute signed by the fixed arbiter.
- Budget 20,000,000 lamports, bond 2,000,000. Concept payment of 4,000,000 is retained.
- Refund metadata confirms client +16,000,000 lamports, creator +2,000,000 and
  escrow -18,000,000. The arbiter pays a 5,000-lamport fee and receives no funds.
- Final status resolved/refund; remaining budget and locked bond zero, rent retained
  at 10,322,560 lamports. Draft and Final were never submitted or paid.
- The human run confirms refund without penalty after the first payment. It does
  not confirm the two other settlement outcomes or live cancellation through Phantom.
- Read-only evidence: .local/human-dispute-transaction-verification.json.

## Human successful-deal verification — 2026-10-13

- Reviewed the supplied screenshots and read the actual Devnet deal account:
  qQHGbT4YgPGArdtPX3wLjVc5fWSrzSSkCHSM4FpAmnV.
- All nine account transactions were successful: creation, acceptance, three
  initial submissions, one Draft replacement, and three approvals.
- Transaction metadata confirms creator credits of 2,000,000, 3,000,000 and
  6,000,000 lamports; the last includes the 1,000,000-lamport bond return.
- Status completed, all three milestones paid, Draft revision 2 retained,
  remaining budget and locked bond zero. Only 10,322,560 lamports of rent remain.
- This confirms the financial flow reported by the humans using Phantom; it does
  not validate video delivery or arbitration. Concept points to the site homepage,
  Draft points to the Explorer homepage, and the supplied screenshots show JPEG
  files selected for Draft/Final instead of the required video deliverables.
- Frontend findings for part 2: WalletProvider explicitly disables autoConnect;
  file selection calculates a local fingerprint without uploading or sharing the
  file; submitted materials are shown only as external links. Clarify the delivery
  steps, add trusted wallet reconnection, and test actual accessible materials.
- Read-only evidence is saved locally in .local/human-deal-review.json and
  .local/human-deal-transaction-verification.json. No signatures were requested
  or transactions submitted by this verification.

## Integrated frontend verification — 2026-10-13

- Fetched origin and fast-forwarded the clean part 1 checkout to origin/main,
  commit 341ee1f (merged PR #2). No source changes were made during verification.
- Installed web dependencies with its existing lockfile (`npm ci`).
- Frontend tests: 254 passed in 11 files.
- Production build including TypeScript: passed, 303 modules; JS 984.86 kB
  (295.68 kB gzip), CSS 66.27 kB (14.48 kB gzip).
- Three actual read-only Devnet checks passed: completed deal, refund resolution,
  and exact hashes of the public fixtures against the on-chain submissions.
- Reviewed creation, participant permissions, exact amount parsing, SDK calls,
  hash/revision guards, and confirmed/unknown transaction recovery in the code.
- Opening the supplied Cloudflare URL in Chrome was rejected by browser access
  control with a saved-permission block. No remote page inspection, screenshot,
  local browser substitute, or human signing is claimed for this checkpoint.

## Handoff

Program ID deployed on Devnet: 8ddYBcE1uxzxke9T9ivLqXN9gJiXNY5kGbNYwBfiqCgX.
IDL: generated and published in contracts/idl/aic_bazaar.json and sdk/src/idl.json.
Implementation PR: https://github.com/am1cs/aic-bazaar/pull/1. Its code is now
included in main through merged PR #2: https://github.com/am1cs/aic-bazaar/pull/2.
Test results: seven native Rust tests, 53 SDK unit tests, 11 raw program scenarios,
and five actual SDK scenarios passed. Network integration suite ran on local validator;
public Devnet demonstrations and their seventeen successful receipts are also verified.

Completed demo: E6z3ZUSy9up26ttcYUDXUBWhGGpbw1y6trfHN4W61C8d.
Resolved demo: 98jXr37FrE4wYP7ZMzyXY9ELsDhhtdTsqz4wHnsyUUMN.
Public configuration: deployment/devnet.json.
Evidence: deployment/verification.json and docs/technical.md.

## Blockers

No blocker remains for part 1. The RPC faucet failure was resolved by the human
funding the dedicated Devnet deployer. Public RPC calls are paced to avoid rate
limits. One setup demo had an incorrect asset commit reference and was retired
through the actual dispute/refund path; its receipts are preserved separately.

Web/SDK integration and its automated/read-only checks passed. The reported human
successful Phantom flow and refund dispute are confirmed by real Devnet receipts.
Other settlement outcomes and cancellation acceptance, actual material delivery, browser inspection of the
supplied site, product-demo recording, founder-name verification, pitch recording
and final hackathon submission remain joint/part 2 work. The temporary Cloudflare preview depends on the other
participant's running computer and tunnel; a stable deployment remains pending.

Update this file with verified results and remaining blockers at each checkpoint.
