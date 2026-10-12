# AIC Bazaar

Milestone escrow for businesses commissioning AI content from human creators.
Solana Devnet MVP. Anchor program, TypeScript SDK, and test suites are implemented.
Deployment and on-chain verification progress are recorded in
[part 1 status](docs/status/part-1.md); an address alone is not proof of deployment.

**Part 1 verified:** real Devnet program, completed and refunded demonstration
orders, genuine IDL, SDK and reproducible tests. The web interface is owned by
part 2. Public configuration and receipts are in [deployment/devnet.json](deployment/devnet.json).

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

## Part 1 checks

The contract and TypeScript client use Anchor 0.32.1, web3.js 1.98.4, and Agave
2.3.0. Node.js 22 or newer is suitable for the TypeScript checks.

```sh
cd sdk
npm ci
npm run typecheck
npm test
```

With Rust installed:

```sh
cd contracts
cargo test --workspace --lib --locked
```

See [technical documentation](docs/technical.md) for the actual integration-test
command and verified evidence, and [SDK documentation](sdk/README.md) for frontend
integration. The generated IDL is in contracts/idl and bundled in sdk/src/idl.json.

## Trust and limitations

The named human arbiter can award remaining funds according to the three agreed
outcomes; there is no independent arbitration network. The deployment owner holds
the program upgrade authority and can change program behavior. There is no
mainnet deployment or external audit. Files remain in external storage; a stored
SHA-256 fingerprint does not prove authorship, quality, or legal IP transfer.
