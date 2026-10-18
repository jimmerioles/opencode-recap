# Roadmap

Where `opencode-recap` is heading. This file is curated: individual ideas live in
the [issue tracker](https://github.com/jimmerioles/opencode-recap/issues) and only
vetted themes land here.

## Milestone: v1.0 — production ready

`v1.0` is the bar at which the plugin is production quality: **well engineered,
simple, effective, and efficient** — something users can trust at a glance and
in day-to-day use. It is also the first npm publish, but that release is the
*consequence* of reaching the bar, not a goal of its own. Until then, install
from GitHub.

**Definition of done:**

- [ ] The parity rewrite has landed; no port-era scaffolding remains.
- [ ] The read-only guarantee holds and is documented.
- [ ] The config surface is frozen and documented in the README.
- [ ] Pure logic is covered by tests, running in CI alongside `bun run typecheck`.
- [ ] Failure modes surface in the sidebar — no silent no-ops, no unhandled
      rejections.
- [ ] Packaging is sane: `files`, `engines`, semver, and release notes in place.
- [ ] A clean `opencode plugin add` works on a fresh setup.

Order of work: parity rewrite → **Next** items → v1.0.

## Now

- **Re-engineer the plugin against the OpenCode v2 TUI API.** The current code
  is a port of the v1 plugin and still carries port-shaped scaffolding:
  hand-rolled signal maps (`signalFor`), a manual sidebar remount hack working
  around how slots mount, module-level theme/style caching, and a single
  `setup()` that does everything. The goal is a smaller, v2-native design —
  proper reactive primitives, the sidebar slot handled the way v2 intends, and
  logic split into focused modules — so later features are cheap to add.

  **Approach:** a from-scratch rewrite on a branch, with today's `tui.tsx` kept
  as the behavior reference. Cut over only once behavior reaches parity. Scope
  is parity-only — the **Next** items are designed *around*, not built into,
  the rewrite.

## Next

- **Settle the configuration surface** before v1.0: a custom recap prompt or
  section shape, and an explicit word budget.
- **A test harness** for the pure helpers (`buildPrompt`,
  `readConfiguredModel`, `inferSessionModel`), wired into CI next to
  `bun run typecheck`.
- **Persist the last recap per session** so it survives an OpenCode restart
  (recaps are in-memory maps today).

## Later

- **Stream the recap** into the sidebar instead of waiting for the full
  generation.
- **Copy the recap** to the clipboard, or open it in a file.
- **Tool-call awareness.** The transcript keeps user and assistant text only;
  folding in tool activity would sharpen "Done" for agent-heavy sessions.
- **Optional auto-recap** on a cadence, not just on demand.

## Not planned

- Anything that writes to the session transcript — the plugin is deliberately
  read-only (see the README).

## How ideas are tracked

Open an [idea issue](https://github.com/jimmerioles/opencode-recap/issues/new?template=idea.yml)
for anything, small or large. Vetted themes get promoted into the sections
above; everything else stays in the issue tracker so this file never becomes a
graveyard.
