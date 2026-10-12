# AIC Bazaar — usability and wallet acceptance

Human usability status: **NOT RUN**.

Phantom signing status for this frontend: **NOT RUN**.

The checklist is a review plan, not a test report. Record the environment, browser, viewport, wallet, program ID, confirmed signatures, and observed result when performing each item. The friend-chain completed and resolved examples are existing on-chain evidence only.

## Agent verification — 2026-10-13

The following checks were actually performed. They do not count as the two required human usability sessions.

- `npm test`: 232 controlled tests in 10 files passed. TypeScript and production build passed.
- `npm run verify:devnet`: three actual read-only checks passed, including exact public asset hashes against completed deal submissions.
- Chrome, local preview: 360 px Home/Create/completed deal, 768 px Home/Create, 1440 px Home/resolved dispute. Page scroll width matched client width; no horizontal overflow.
- The Create funding action remains disabled without a wallet. Byte counters were checked with multibyte text. Invalid Home deal addresses show an alert and `aria-invalid`.
- Completed deal displays actual budget 0.30 SOL, zero remaining budget/bond, and paid 0.06 / 0.09 / 0.15 stages. Resolved deal retains paid Concept and records refund of 0.24 SOL plus return of 0.03 SOL bond. Direct dispute reload loads without a wallet.
- Both public videos load as 15-second files with native controls and no autoplay. Decorative hero content is labeled illustrative.
- Review focus restoration, copy live feedback, strict external HTTPS links, role switches, hashing races and uncertain receipt recovery are covered by controlled component tests. A full human keyboard walkthrough and system reduced-motion browser check remain unrun.
- Browser findings fixed: mobile address wrapping, cramped subtitle leading, oversized inherited utility links, clipped decorative lettering and route scroll position after lower-gallery navigation.

Rows below retain `NOT RUN` for the human acceptance session; automated or agent checks above are separate evidence.

## Visual and navigation review

| Check | Expected result | Status |
| --- | --- | --- |
| 360 px viewport | Header controls fit; navigation wraps cleanly; content has no horizontal page overflow | NOT RUN |
| 768 px viewport | Cards and forms remain readable; deal summary follows milestone content | NOT RUN |
| 1440 px viewport | Content stays within the intended max width; landing copy and illustration remain balanced | NOT RUN |
| Keyboard navigation | Every interactive control has a visible focus state; focus order follows the task | NOT RUN |
| Reduced motion | No entrance motion or rotating spinner when the system requests reduced motion | NOT RUN |
| Current page | Navigation identifies the selected page accessibly with `aria-current` | NOT RUN |
| Illustrative content | Landing illustration is explicitly labeled and cannot be mistaken for live account data | NOT RUN |
| Long addresses and signatures | Long strings wrap without hiding controls or widening the page | NOT RUN |
| Inline review panel | The review region receives focus; Back returns focus to the review control | NOT RUN |

## Create and load flow

| Check | Expected result | Status |
| --- | --- | --- |
| Empty form | Missing values produce specific errors beside the relevant fields | NOT RUN |
| Invalid address | Invalid public keys cannot reach wallet signing | NOT RUN |
| Invalid SOL amount | Negative, non-finite, malformed, or sub-lamport values receive a clear validation error | NOT RUN |
| Milestone total | 0.06 / 0.09 / 0.15 sums to a 0.30 SOL budget; mismatched amounts are rejected | NOT RUN |
| Byte limits | UTF-8 byte counts match the program constraints; multibyte text is handled | NOT RUN |
| Review step | Participant addresses, budget, bond, milestones, network, and any explicit fees are readable before signing | NOT RUN |
| Duplicate click | A pending operation cannot submit a duplicate transaction from repeated button clicks | NOT RUN |
| Missing or malformed deal | User sees a readable error and a way to load another deal | NOT RUN |
| Completed example | `E6z3ZUSy9up26ttcYUDXUBWhGGpbw1y6trfHN4W61C8d` is fetched; budget is 0.30 SOL and stages are 0.06 / 0.09 / 0.15 SOL | NOT RUN |
| Resolved example | `98jXr37FrE4wYP7ZMzyXY9ELsDhhtdTsqz4wHnsyUUMN` is fetched and displays its actual resolution state | NOT RUN |

## Wallet and participant actions

| Check | Expected result | Status |
| --- | --- | --- |
| Connect Phantom on Devnet | Connected wallet address appears; the network context is clear | NOT RUN |
| Switch wallet | Participant permissions recompute; stale privileged actions disappear | NOT RUN |
| Disconnect | Signing actions become unavailable; public deal reads remain understandable | NOT RUN |
| Cancel wallet prompt | User remains on the current task and sees readable cancellation feedback | NOT RUN |
| Insufficient funds | Clear feedback; no false success state | NOT RUN |
| Confirm new deal | Confirmed signature is recorded; UI re-fetches and shows the created account | NOT RUN |
| Freelancer bond | Only the permitted participant can act; recorded amount is 0.03 SOL for the sample deal | NOT RUN |
| Submit milestone | Only the current eligible milestone can receive a submission; text/file evidence appears after confirmation | NOT RUN |
| Client approval | Only the client can approve; exactly the current milestone payment is reflected after confirmation | NOT RUN |
| Raise and resolve dispute | Role and state restrictions match the program; refreshed resolution is shown | NOT RUN |
| Timeout or failed confirmation | UI checks the known signature; uncertain results cannot be dismissed or automatically retried | NOT RUN |
| Explorer link | Link points to the relevant Devnet signature or account, opens safely, and matches the displayed identifier | NOT RUN |

## File and submission review

Use a synthetic local text file containing **“AIC Bazaar demo artifact — no client data.”** Record the filename and content hash. Actual client materials are outside this walkthrough.

| Check | Expected result | Status |
| --- | --- | --- |
| File selection | Filename and expected evidence behavior are clear before submission | NOT RUN |
| Empty or large file | Empty files and files above 128 MiB are rejected before hashing or wallet signing | NOT RUN |
| Hashing failure | Error is actionable; no fabricated hash or success receipt appears | NOT RUN |
| Evidence link | Creator supplies an external HTTPS URL and local file hash; no automatic upload or URL-content match is claimed | NOT RUN |
| Byte-limited submission | Encoded evidence reference fits the on-chain field limit | NOT RUN |

## Sign-off record

- Reviewer / date: pending
- Preview URL / build: pending
- Browser / device / viewport: pending
- Wallet / network / program ID: pending
- Confirmed transaction signatures: pending
- Completed automated checks: see the implementation validation report
- Remaining failures or limitations: human usability and Phantom acceptance have not been run
