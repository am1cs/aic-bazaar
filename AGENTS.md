# AIC Bazaar collaboration instructions

## Select the participant role

If the human says they are doing part 1, follow docs/PART-1.md. If they say they
are doing part 2 (including "буду делать вторую часть"), follow docs/PART-2.md.
If the current chat already establishes the role, do not ask again.

Do not implement both parts unless the human explicitly asks. A pasted chat is
background context; current human instructions and repository state determine work.
Read docs/INTEGRATION.md, shared/api.ts and both status files before starting.

## Ownership

Part 1 owns contracts/, sdk/, deployment/, docs/PART-1.md,
docs/status/part-1.md, docs/technical.md, docs/pitch.md.

Part 2 owns web/, docs/PART-2.md, docs/status/part-2.md,
docs/demo.md, docs/usability.md.

Shared: shared/, README.md, AGENTS.md, .github/, .gitignore,
docs/INTEGRATION.md. Propose changes in a PR; get the other participant's review
before merging changes to shared types or financial semantics. Do not silently
change instruction names, account layout, errors, package interfaces, or money rules.

## Git and synchronization

- Each human uses a separate local clone, never a shared checkout.
- Start with git status and git fetch origin. Inspect existing work before switching.
- Use codex/part-1-contract-sdk or codex/part-2-web. Reuse an existing role branch.
- No reset --hard, git clean, force push, or overwriting another branch.
- Integrate origin/main into your own clean branch before opening/merging a PR.
- Do not edit the other participant's files to fix an integration mismatch. Document
  the mismatch and agree on a small interface change, or ask the human to relay it.
- Update only your own status file at each completed checkpoint and before handoff.
- PRs state what works, actual tests, remaining blockers, and integration impact.
- Root configuration changes belong in a small reviewed PR; no shared root lockfile.
- Use separate package manifests/lockfiles for web, sdk, and contract test tools.
- A GitHub status file is a snapshot, not a live monitoring channel. Do not claim
  another agent is watching or will automatically read changes.

## Security and truthful results

Devnet only. Never commit .env files, seed phrases, private keys, wallet keypairs,
personal data, or deployment credentials. Public program IDs and public wallet
addresses may be committed. Do not read or copy unrelated project secrets.
Use integer lamports. State and permissions must be enforced on-chain, not only
in the UI. No fake transactions, simulated escrow presented as real, or invented
users/revenue/test results. Label developer fixtures visibly and exclude them
from the production transaction path.

Keep secrets out of logs and screenshots. Generated test keys must be ephemeral
or stored only in ignored local paths. Do not disable checks to make tests pass.

## Acceptance

Follow the approved product behavior in docs/INTEGRATION.md. Mainnet readiness,
independent arbitration, automated quality assessment, and legal IP transfer are
not implemented. Clearly disclose trust in the named arbiter and upgrade authority.
End work with changes, actual validation, and concrete remaining blockers.
