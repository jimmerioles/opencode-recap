import { Plugin } from "@opencode/plugin"

// The recap UI lives in the TUI half (./tui). This server-side entrypoint is a
// no-op so the package loads cleanly from `plugins` in opencode.json(c).
export default Plugin.define({
  id: "opencode-recap.server",
  setup() {},
})
