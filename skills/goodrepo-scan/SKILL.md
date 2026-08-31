---
name: goodrepo-scan
description: Scan the current public GitHub repository with GoodRepo, explain its agent-readiness findings, and let the user choose which reported issues to fix. Use for GoodRepo audits, agent-readiness improvements, or requests to scan and improve the repository; do not use for general code review or private/local-only repositories.
---

# GoodRepo Scan

Use the GoodRepo website as the source of findings, then inspect the local checkout before proposing or applying a fix. The website currently analyzes JavaScript and TypeScript repositories whose root contains `package.json`.

Use capabilities, not product-specific tool names: any available terminal can resolve the repository, any browser or HTTP-capable tool can read the report, and any file-editing mechanism can apply an approved fix. If a capability is unavailable, explain what is missing instead of assuming a particular agent or vendor.

## Start the scan

1. Resolve paths relative to this `SKILL.md`, then run `python3 scripts/resolve_target.py --path <working-directory>`. Pass `--site-url` or set `GOODREPO_URL` only when using a non-production GoodRepo deployment. If Python 3 is unavailable, reproduce the script's read-only Git checks with the available terminal rather than installing a runtime without permission.
2. If the resolver rejects the remote, explain the exact limitation. Ask for a public GitHub repository URL only if another suitable remote cannot be discovered without guessing.
3. Warn before scanning when the resolver reports working-tree changes, unpushed commits, or a detached HEAD. GoodRepo reads the public remote's default-branch HEAD, not local-only state. Continue the read-only scan unless the user asked to stop in this situation.
4. Open the emitted `scan_url` with any available browser, HTTP client, or web-reading capability and wait for the report. Prefer rendered or semantically extracted page content over scraping raw framework payloads. Do not substitute a local audit, GitHub metadata, or assumptions for the GoodRepo report. Never push merely to make the scan current.

## Read the report

Capture the scanned `owner/repo` and commit, overall score, partial-scan warning, category scores, failed signals, and ranked recommendations. Treat “not measured” as unknown, not failed. Preserve each recommendation's impact, evidence, proposed fix, and bullets.

If the page reports a failure such as private/not found, non-JavaScript repository, rate limiting, empty repository, or oversized tree, relay it and stop. Do not invent findings.

## Give the user control

Before editing, present a compact numbered list of actionable recommendations, ordered as the website orders them. Include impact, the evidence in one sentence, and the likely local files or area after a quick read-only inspection. Then ask which findings to fix.

Accept natural-language scope or concise controls such as recommendation numbers, `high`, `high+medium`, `all`, `docs-only`, `max N`, excluded paths, and a validation-time limit. Read [references/controls.md](references/controls.md) when selection is ambiguous or the user wants advanced control.

Do not edit until the user selects a scope. A request that already explicitly names a fix scope and asks to apply it counts as selection; still show what is in scope before changing files. `none`, `report only`, or equivalent ends after the report.

## Fix the selected findings

- Verify every selected finding against the local repository. Explain and skip a recommendation if it is stale, inapplicable, or would require product/architecture decisions the user has not made.
- Make the smallest coherent change that addresses the evidence. Preserve unrelated local changes and repository instructions.
- Do not broaden a documentation recommendation into a code refactor, add dependencies, create CI that needs secrets, or change public behavior without specific user authorization.
- Use exact commands and conventions found in the repository; never fabricate instructions merely to satisfy a signal.
- Run focused validation appropriate to the changed files and the repository's documented workflow. Show remaining failures and a concise diff summary.

Do not claim the GoodRepo score improved from local edits. Offer a rescan URL after the selected changes are committed and pushed by the user; rescan automatically only if the website can actually see the updated remote state.
