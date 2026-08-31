# GoodRepo

GoodRepo is a helpful tool for optimizing your repos for AI development. at its core, GoodRepo is a set of tools for analyzing your repo and providing suggestions for how to improve it using static analysis and llm judgement.

## Agent skill

Install the agent-agnostic GoodRepo scan-and-fix workflow with the open Agent Skills CLI:

```sh
npx skills add jtljrdn/rigor --skill goodrepo-scan
```

The CLI detects supported coding agents and lets you choose where to install the skill. To inspect the available skills without installing anything, run:

```sh
npx skills add jtljrdn/rigor --list
```
