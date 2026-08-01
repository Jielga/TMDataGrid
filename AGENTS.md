## Where work is tracked

Start here after a break, or on a cold session:

- [BACKLOG.md](BACKLOG.md) — what is planned, in progress and done.
- [plans/scan-adoption.md](plans/scan-adoption.md) — **the tracker for the
  current 1.0 wave**: per-item status, running order, and what is waiting on
  whom. Its execution-tracker table is the only place item status lives;
  update the Status cell there when something ships.
- [plans/proposals.md](plans/proposals.md) — proposals awaiting stakeholder
  approval. Held work does not start until its proposal is approved.
- `plans/*.md` for finished waves keep a `> **Status: executed <date>**`
  stamp at the top; they are rationale, not instructions.

Do not start planned work without the stakeholder's go — the tracker names
what is cleared and what is still waiting.

## Playwright

Playwright is very expensive, use it carefully when debugging / looking at code

<!-- intent-skills:start -->

## Skill Loading

Before editing files for a substantial task:

- Run `npx @tanstack/intent@latest list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `npx @tanstack/intent@latest load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->
