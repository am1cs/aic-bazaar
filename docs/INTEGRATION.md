# Integration contract v1

This is the shared agreement between part 1 (program + SDK) and part 2 (web).
The TypeScript interface in shared/api.ts is the boundary. UI code must not
depend on Anchor account layout or import IDL directly.

## Layout and dependencies

- contracts/: Anchor Rust program, generated IDL and program tests. Part 1.
- sdk/: TypeScript client exported from sdk/src/index.ts. Part 1.
- web/: Vite application, its own package.json and package-lock.json. Part 2.
- shared/: dependency-free normalized types. Joint ownership; freeze before work.
- deployment/devnet.json: public deployment manifest, populated by part 1.
- docs/status/part-1.md and part-2.md: independent progress snapshots.

The SDK package is @aic-bazaar/sdk. The web package consumes it using file:../sdk.
The SDK exports createBazaarClient({ connection, wallet, programId }): BazaarClient.
Connection and PublicKey are @solana/web3.js v1 types. wallet is null for read-only
access, otherwise an Anchor-compatible wallet with publicKey and signTransaction /
signAllTransactions. Part 1 must document the exact exported constructor types.
Mutating methods reject a missing wallet; the program enforces each signer's role.
Keep the SDK's web3.js and wallet ecosystem compatible with the Anchor build.

Both packages can import shared/api.ts by relative path. Configure TypeScript and
Vite to include the sibling source directories. Each owner updates their own lockfile.
No root npm workspace or shared root lockfile during this sprint.

## Financial and state rules

Devnet only. Amounts cross the UI/SDK boundary as unsigned base-10 integer lamport
strings, never floating-point SOL or JS number. Convert using BigInt.
Budget is between 1,000,000 and 1,000,000,000 lamports inclusive for this demo.
Concept = floor(budget * 20 / 100), Draft = floor(budget * 30 / 100),
Final = remaining budget, bond = floor(budget / 10). No platform fee.

Customer, creator and arbiter must be distinct non-default public keys. The customer
funds the entire budget on creation. Only the named creator can accept and post
the bond. Only the customer can cancel before acceptance. No unilateral withdrawal
after acceptance. Three stages must execute in order. The final approval also
returns the entire bond. Previously paid milestones remain accessible after closure.

The PDA stores both data and escrow lamports; rent is excluded from spendable
obligations and retained for the account history. Track obligations explicitly:
unsolicited transfers are not budget and must not alter payout calculations.
Never let a caller choose arbitrary payout recipients.

States: awaiting_creator -> active -> completed;
awaiting_creator -> cancelled; active -> disputed -> resolved.
All terminal states reject subsequent mutations. Disputed state freezes submission
and normal approval. No automatic approval, payout, fine, or deadline enforcement.
Three deadlines are increasing future Unix timestamps at creation. Review time is
24h after the latest submission, informational only.

## Immutable terms and submissions

Template v1 is a 15-second vertical AI advertisement:
Concept: a three-frame storyboard collage and scene order (20%).
Draft: a 15-second 9:16 rough cut following approved concept (30%).
Final: 1080x1920 MP4, agreed CTA, no watermark (remaining 50%).

UTF-8 limits: title 64 bytes, brief 200 bytes, references URL 200 bytes,
submission URL 200 bytes, dispute reason 200 bytes, resolution reason 200 bytes.
Title, brief and dispute/resolution reasons must not be blank. References URL may
be empty. All supplied URLs must be HTTPS. UI must render text safely and links
with rel=noopener noreferrer; do not fetch arbitrary URLs from a server.

Terms, three deadlines and participants cannot change after creation. Each stage
allows an initial submission and one replacement before payment. Submissions have
revisions 1 and 2. A replacement must carry the previous expected revision.
The approved URL and hash are retained. A submitted hash is exactly 32 bytes,
represented in the SDK as 64 lowercase hexadecimal characters, calculated locally
from the selected file. It is a fingerprint, not proof of authorship or quality.

Both submit and approve identify milestone index 0, 1 or 2. Approval checks index,
expected revision and expected hash to prevent a stale UI approving a replacement
or the next stage using an identical hash. The program, not just SDK, checks these.

## Disputes

Either party may open a dispute while active, even before submission. Reason is
stored. Only the immutable named arbiter can resolve, with a non-blank reason.
Resolution always terminates the deal:

- pay_current: requires a submitted current stage; pay it, refund all future budget
  to customer, return bond to creator.
- refund: return all remaining budget to customer, return bond to creator.
- creator_breach: return all remaining budget and the entire bond to customer.

Arbiter cannot reverse prior payouts or send money to a third party. No partial
award within the current stage in v1. No legal copyright-transfer automation.
Disclose the human arbiter's authority and program upgrade authority in README.

## Mutation results and errors

SDK simulates/builds transactions, requests the wallet signature, submits, confirms
using signature + blockhash validity, then refetches the deal. It returns the actual
signature. Rejected/expired/failed transactions never return success.
If confirmed but refetch fails, return signature with deal=null and refreshError;
UI displays a confirmed receipt and a refresh action, not an invitation to pay again.
If confirmation is uncertain, error includes signature and outcomeUnknown=true;
UI checks that signature before offering another attempt.

Normalized SDK errors: wallet_required, wrong_role, invalid_input, invalid_state,
stale_submission, revision_limit, insufficient_funds, user_rejected, rpc_error,
transaction_failed, not_found, not_deployed. Preserve actionable context without
logging secrets. Never invent a Program ID or use the system program as a placeholder.

## Parallel development and integration checkpoints

1. Commit this agreement and role instructions before either implementation starts.
2. Part 2 builds against BazaarClient with visibly labeled developer-only fixtures.
3. Part 1 delivers read/create/accept + IDL + deployment manifest in first PR.
4. Part 2 replaces the development client with SDK and tests real wallets.
5. Add submission/approval, then dispute/resolution, in separate small PRs.
6. Each participant reviews the other one's changes before merge to main. Agreement
   changes need an explicit review; chat context does not silently override code.
7. Record real test results and current blockers in separate status files.

Plan ~5-6 hours of focused implementation per participant, overlapping, followed
by joint integration, tests and separately owned media work. Stop adding features
at 07:30 Asia/Almaty on 2026-10-13; target submission by 10:30, official deadline
11:59. If starting later, shorten polish, never omit payment correctness checks.
