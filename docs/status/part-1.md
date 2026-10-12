# Part 1 status

Status: IMPLEMENTED AND VERIFIED — ready for part 2 integration and PR review.
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

Frontend owner integrates the SDK from PR #1, verifies Phantom flows, and reviews
the PR before merging into main. Part 1 does not edit web/.

## Handoff

Program ID deployed on Devnet: 8ddYBcE1uxzxke9T9ivLqXN9gJiXNY5kGbNYwBfiqCgX.
IDL: generated and published in contracts/idl/aic_bazaar.json and sdk/src/idl.json.
PR: https://github.com/am1cs/aic-bazaar/pull/1 (ready for review).
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

Web/Phantom integration, product-demo recording, founder-name verification,
pitch recording and final hackathon submission remain joint/part 2 work.

Update this file with verified results and remaining blockers at each checkpoint.
