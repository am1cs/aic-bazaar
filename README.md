# AIC Bazaar

**Milestone escrow for businesses commissioning AI-assisted content from human creators.**

Agree on the work. Fund the deal. Review each delivery. Release payment one milestone at a time.

[Live demo](https://aic-bazaar.vercel.app) · [Create a deal](https://aic-bazaar.vercel.app/create) · [Try media previews](https://aic-bazaar.vercel.app/demo/materials) · [Technical documentation](docs/technical.md)

> **Working Solana Devnet MVP.** All payments use test SOL. Successful completion and a dispute with a refund have been verified on-chain.

## Why we built it

A client wants to see progress before paying for the whole project. A creator wants to know the budget is available before starting work. AIC Bazaar gives both sides an agreed sequence of deliveries, approvals, and payments, with a named human arbitrator for disagreements.

The current template is a **15-second vertical AI advertisement**, delivered through three milestones.

## How a deal works

1. **Agree on the terms.** The client selects the creator and arbitrator, writes the brief, and sets the budget and deadlines. Participants and terms are fixed once the deal is created.
2. **Reserve the budget.** The client funds the full budget in the Solana smart contract.
3. **Accept the work.** The named creator accepts and deposits a **10% performance bond**.
4. **Deliver and review.** The creator submits a delivery link and file fingerprint. The client reviews the material and approves each milestone in order.
5. **Complete the deal.** The final approval pays the remaining budget and returns the creator's bond.

| Milestone | Deliverable | Share of the budget |
| --- | --- | --- |
| Concept | Storyboard and scene order | 20% |
| Draft | Rough video cut | 30% |
| Final | Final MP4 with the agreed CTA | Remaining 50% |

Amounts are calculated in integer lamports; percentage rounding is applied to the first two stages. Network fees and account rent are separate from the budget. There is no platform fee in this version.

### When there is a disagreement

Either party can open a dispute while the deal is active. Normal submissions and approvals then stop. Only the arbitrator chosen at creation can resolve it:

- **Pay the current milestone:** pay the submitted stage, refund future stages to the client, and return the bond to the creator.
- **Refund:** return the unpaid budget to the client and the bond to the creator.
- **Creator breach:** return the unpaid budget and the bond to the client.

Every resolution closes the deal. Previously completed payments stay unchanged; funds cannot be redirected to an arbitrary third-party wallet. The client can also cancel before the creator accepts.

## Built for an understandable handoff

- **Phantom connection** with restoration of a previously trusted wallet.
- **Read-only deal pages** that can be shared and opened without connecting a wallet.
- **Image previews and MP4 playback** from saved HTTPS delivery links, with an external link retained if a preview fails.
- **File validation and SHA-256 fingerprints** before submission.
- **Amount confirmations, clear next steps, and compact receipts** with Explorer links in technical details.
- **Transaction recovery** that blocks repeat operations while an outcome is pending or unknown.
- **Responsive interface** with optional motion and reduced-motion support.

### Delivering a file

**Host your file → Paste its delivery link → Select the same delivered file.**

Selecting a file does **not** upload it. The client receives the delivery link. The browser checks the selected file and computes its SHA-256 fingerprint locally; the deal stores the link and fingerprint on-chain. Use a direct HTTPS image or MP4 URL for an inline preview. Other links can be opened externally.

Files remain in external storage. A fingerprint identifies the selected bytes; it does not prove authorship, quality, copyright ownership, or that the remote file matches those bytes.

## Try the demo

Start at **[aic-bazaar.vercel.app](https://aic-bazaar.vercel.app)**. Viewing deals and the [media preview check](https://aic-bazaar.vercel.app/demo/materials) requires no wallet.

To test a new deal, enable **Devnet in Phantom**, fund the participants with test SOL, and use three distinct accounts: client, creator, and arbitrator. Each signer needs test SOL for network fees; the client funds the budget and the creator funds the bond.

| Verified human workflow | Application | On-chain account |
| --- | --- | --- |
| Successful completion | [Open deal](https://aic-bazaar.vercel.app/deal/qQHGbT4YgPGArdtPX3wLjVc5fWSrzSSkCHSM4FpAmnV) | [Solana Explorer](https://explorer.solana.com/address/qQHGbT4YgPGArdtPX3wLjVc5fWSrzSSkCHSM4FpAmnV?cluster=devnet) |
| Dispute resolved by refund | [Open dispute](https://aic-bazaar.vercel.app/deal/FtFChaQZEEdPuTnkVeXGxk4JHE5fku6u3qicVN4hyz7b/dispute) | [Solana Explorer](https://explorer.solana.com/address/FtFChaQZEEdPuTnkVeXGxk4JHE5fku6u3qicVN4hyz7b?cluster=devnet) |

These records demonstrate transaction and settlement flows. Accessible image/video playback is checked separately on the media preview page. Demo materials are synthetic fixtures, not customer traction.

## Run locally

You need **Git, Node.js 24, and npm**. Rust and Solana CLI are not required to run the web app against the deployed Devnet program.

```sh
git clone https://github.com/am1cs/aic-bazaar.git
cd aic-bazaar/web
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. Keep the full repository layout: the web app uses the sibling `sdk/` and `shared/` sources. Public Devnet configuration comes from the deployment manifest; no private keys or deployment credentials are needed.

### Checks and production build

From `web/`:

```sh
npm test
npm run build
npm run verify:devnet
```

`verify:devnet` reads the deployed demonstration accounts and runs an unsigned SDK preflight check. It does not sign or broadcast a transaction. See the [SDK README](sdk/README.md) and [technical documentation](docs/technical.md) for SDK and contract checks.

## Architecture

| Component | Stack | Responsibility |
| --- | --- | --- |
| `web/` | React, TypeScript, Vite, Solana Wallet Adapter | User interface, Phantom, delivery previews, transaction feedback |
| `sdk/` | TypeScript, Anchor, web3.js | Transaction preparation, signing flow, confirmation, normalized state |
| `contracts/` | Rust, Anchor | Escrow, participant permissions, milestone and dispute rules |
| `shared/` | TypeScript types | Shared API boundary |
| `deployment/` | Public configuration and evidence | Devnet deployment, demo receipts, verification reports |

**Devnet program:** [`8ddYBcE1uxzxke9T9ivLqXN9gJiXNY5kGbNYwBfiqCgX`](https://explorer.solana.com/address/8ddYBcE1uxzxke9T9ivLqXN9gJiXNY5kGbNYwBfiqCgX?cluster=devnet)

## Verification

The latest combined integration checkpoint on **13 October 2026** records:

- **380 frontend tests** passing, plus TypeScript and the production build.
- **4 read-only Devnet SDK/preflight checks** passing.
- **15 confirmed receipts** across the human completion and refund workflows, with participant signatures and exact payout/refund balance deltas checked.
- **13 hosted route and asset checks**, including direct deal routes, media files, and the shared validator chunk.
- Browser checks for image decoding, both MP4 players, unavailable-media feedback, and remembered Phantom reconnection on the stable Vercel origin.

Evidence: [human Devnet verification](deployment/human-verification.json), [hosted verification](deployment/vercel-verification.json), [contract and SDK verification](docs/technical.md), and [integration status](docs/status/part-1.md). These are recorded results, not a guarantee that future changes pass. Automated frontend tests alone do not prove live wallet signing.

## Current scope and trust

This is a **Devnet prototype**, without a mainnet deployment or external security audit. The named human arbitrator has the settlement authority described above. The program is upgradeable: its deployment owner holds upgrade authority [`wg7zLEvr1EYuhimLDMTYGnqbMwDoeaKd8CXcZteCPup`](https://explorer.solana.com/address/wg7zLEvr1EYuhimLDMTYGnqbMwDoeaKd8CXcZteCPup?cluster=devnet) and can change program behavior.

Deadlines and the review period are informational; there are no automatic payments or deadline penalties. Quality is reviewed by people. Creator discovery, hosted uploads, chat, ratings, fiat/USDC payments, automated AI quality assessment, and legal IP transfer are outside this release.

## Documentation and contributors

- [Technical design and reproducible checks](docs/technical.md)
- [SDK usage](sdk/README.md)
- [Web setup and deployment](web/README.md)
- [Demo walkthrough](docs/demo.md) and [usability checks](docs/usability.md)
- [Shared integration agreement](docs/INTEGRATION.md)
- [Contribution and ownership rules](AGENTS.md)

Built by **[@am1cs](https://github.com/am1cs)** — contract, SDK, Devnet and deployment — and **[@destinesia7187](https://github.com/destinesia7187)** — web interface, SDK integration and product demo.

Never commit seed phrases, private keys, wallet keypairs, `.env` files, or deployment credentials.
