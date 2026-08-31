# Fix selection controls

Use these controls when the user wants more than a simple recommendation-number selection. Combine controls when they do not conflict.

| Control | Meaning |
| --- | --- |
| `1,3,5` | Fix only those numbered GoodRepo recommendations. |
| `high`, `high+medium`, `all` | Select by reported impact. `all` includes low impact. |
| `docs-only` | Limit changes to documentation or instruction files. |
| `config-only` | Limit changes to manifests, tooling configuration, and CI. |
| `max N` | Take at most the first N recommendations after other filters. |
| `exclude <paths>` | Do not modify those files or directories. |
| `validation <duration>` | Cap validation effort; report anything skipped because of the cap. |
| `report only` / `none` | Make no changes. |

If no scope is given, ask one short question that shows the available forms, for example: “Which should I fix: numbers such as `1,3`, an impact level such as `high`, or `all`? You can also add `docs-only`, `max N`, or excluded paths.”

Conflicts resolve toward the narrower scope. For example, `all, docs-only, max 2` means the first two recommendations that can be addressed only through documentation. Tell the user when a chosen filter leaves no applicable findings.

Selection authorizes only the edits reasonably required for those findings. It does not authorize pushing, deploying, opening pull requests, changing repository visibility, adding paid services, or creating credentials.

