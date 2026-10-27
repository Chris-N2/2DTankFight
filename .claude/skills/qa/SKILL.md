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

2. **Launch the QA sub-agent.**
   - **First run for a change:** use the Agent tool with `subagent_type: "qa"`, so it runs in its own context,
     independent of whoever wrote the code. Give it only the change name and the instruction to follow its process.
     Do **not** pass your own view of whether the implementation is correct.

     > Run QA on OpenSpec change `<name>` in this repository. Follow your process and write
     > `openspec/changes/<name>/qa-report.md`.

   - **Re-runs after fixes:** resume the **same** QA agent with SendMessage rather than spawning a new one. It
     knows what it flagged, can re-run its own probes against the fix, and judges the fixes rather than starting
     a fresh hunt. A fresh agent tends to come back with new findings each time, which moves the goalposts. Tell it
     factually what changed and where (files, tests added, design or spec edits, and any findings deliberately left
     alone, with the reason). Still don't claim the fixes are correct. Ask it to rewrite `qa-report.md` with its
     updated verdict.
   - **If the original agent is no longer available** (a new session, or someone else's contribution): launch a
     fresh `qa` agent. Point it at the existing `openspec/changes/<name>/qa-report.md` as the previous round, and
     include the same factual list of changes since then.

3. **Report back.** When it finishes, read `openspec/changes/<name>/qa-report.md` and give the user the verdict
   and the blocking findings.

4. **Route the findings** as CLAUDE.md describes:
   - **PASS** → the change is ready for `/opsx:archive`.
   - **Implementation bugs** → the implementing agent fixes the code, then re-runs `/qa`. Amending the spec here
     needs the human developer's approval.
   - **Spec gaps** → update the change via `/opsx:propose` (or `/opsx:update`), re-run `/opsx:apply`, then `/qa`.

   Don't start fixing things automatically. Present the findings and the proposed route, and let the user decide.
