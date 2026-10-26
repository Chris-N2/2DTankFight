---
name: qa
description: Run independent QA on an implemented OpenSpec change before archiving. Launches the `qa` sub-agent in its own context to verify code against the change's specs, run build/tests, and write a PASS/FAIL qa-report.md. Use after /opsx:apply and before /opsx:archive, or when the user types /qa.
---

Run QA for an OpenSpec change. QA must pass before `/opsx:archive` (see CLAUDE.md, "QA feedback loop").

**Input:** optionally a change name.

## Steps

1. **Select the change.** Use the name given. Otherwise infer it from the conversation, or run
   `openspec list --json` and auto-select if there is exactly one active change. If it's ambiguous, ask the user.
   Announce: "Running QA on: <name>".

2. **Launch the QA sub-agent.** Use the Agent tool with `subagent_type: "qa"` so it runs in its own context,
   independent of whoever wrote the code. Give it only the change name and the instruction to follow its
   process. Do **not** pass your own view of whether the implementation is correct.

   > Run QA on OpenSpec change `<name>` in this repository. Follow your process and write
   > `openspec/changes/<name>/qa-report.md`.

3. **Report back.** When it finishes, read `openspec/changes/<name>/qa-report.md` and give the user the verdict
   and the blocking findings.

4. **Route the findings** as CLAUDE.md describes:
   - **PASS** → the change is ready for `/opsx:archive`.
   - **Implementation bugs** → the implementing agent fixes the code, then re-runs `/qa`. Amending the spec here
     needs the human developer's approval.
   - **Spec gaps** → update the change via `/opsx:propose` (or `/opsx:update`), re-run `/opsx:apply`, then `/qa`.

   Don't start fixing things automatically. Present the findings and the proposed route, and let the user decide.
