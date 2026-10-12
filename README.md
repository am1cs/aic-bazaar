# AIC Bazaar

Milestone escrow for businesses commissioning AI content from human creators.
Solana Devnet only. This repository starts as a collaboration scaffold: no program
has been built, deployed, audited, or funded yet.

## Start here

- Read [AGENTS.md](AGENTS.md) before changing files.
- Participant 1: [contract, SDK, and Devnet](docs/PART-1.md).
- Participant 2: [web application, integration, and product demo](docs/PART-2.md).
- Shared agreement: [integration contract](docs/INTEGRATION.md) and [API types](shared/api.ts).
- Progress: [part 1](docs/status/part-1.md), [part 2](docs/status/part-2.md).

Both participants clone this repository onto their own computers. A shared chat
link carries context, not live code or automatic synchronization between agents.
GitHub branches, pull requests, and the two status files carry progress.

## Product scope

The client funds the entire budget; the named creator accepts and deposits a 10%
bond. Three stages pay 20%, 30%, and the remaining 50%. A pre-agreed human arbiter
can settle a dispute and terminate the deal. Only test SOL is supported.

No creator discovery, contests, AI agents, cards, USDC, chat, ratings, or hosted
file uploads in this release. Materials are linked by HTTPS and fingerprinted
locally with SHA-256. Quality is assessed by people, not by the contract.

## Collaboration

Use `codex/part-1-contract-sdk` and `codex/part-2-web`. Keep `main` runnable;
merge small PRs after the other participant reviews them. Do not force-push,
commit credentials, replace your teammate's files, or push directly to `main`
after the initial scaffold.

The project is not submitted to a hackathon merely by creating this repository.
Submission, access to videos, and completed team profiles must be verified separately.
