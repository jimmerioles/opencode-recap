# opencode-recap

An [OpenCode](https://opencode.ai) v2 TUI plugin that generates a short AI recap
of the current session and renders it in the sidebar, outside the chat thread.

- Click **Recap** in the sidebar, or press **`<leader>v`**.
- Also available from the command palette as **Recap this session**.
- Summarizes the last 10 messages with the session's own model.
- Reuses the previous recap for continuity and clears after 3 new prompts.
- Read-only: it never writes to the session transcript.

This is a v2 port of [streetturtle/opencode-recap](https://github.com/streetturtle/opencode-recap),
which targets the OpenCode v1 plugin API.

Where the project is heading is in [ROADMAP.md](./ROADMAP.md); ideas are tracked
in the [issue tracker](https://github.com/jimmerioles/opencode-recap/issues).

## Requirements

- OpenCode **2.0.0 or newer** (the v1 plugin API is not supported).
- At least one configured provider.

## Install

From GitHub:

```sh
opencode plugin add github:jimmerioles/opencode-recap
```

Pin the release tag:

```sh
opencode plugin add github:jimmerioles/opencode-recap#v0.1.0
```

From npm, once published:

```sh
opencode plugin add opencode-recap
```

Restart OpenCode afterwards if the plugin does not appear.

Or add it manually to `opencode.json(c)`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["opencode-recap"]
}
```

## Usage

Open a session and either:

- click **Recap** in the sidebar, or
- press `<leader>v` (`ctrl+x`, then `v` with the default leader).

The recap appears in the sidebar and disappears once you send 3 more prompts.
Regenerating before then reuses the previous recap as context, so it stays
coherent across a long session.

If the sidebar is hidden, toggle it with `<leader>b`.

## Configuration

Options are read from the plugin's `options` object:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    {
      "package": "opencode-recap",
      "options": {
        "keybind": "<leader>v",
        "providerID": "opencode-go",
        "modelID": "deepseek-v4.1-flash"
      }
    }
  ]
}
```

| Option | Default | Description |
| --- | --- | --- |
| `keybind` | `<leader>v` | OpenCode keybind used to trigger a recap. |
| `providerID` | session model | Provider ID for the recap model. Set with `modelID`. |
| `modelID` | session model | Model ID for the recap model. Set with `providerID`. |

`providerID` and `modelID` must be set together or not at all; setting only one
reports a configuration error in the sidebar.

When no model is configured, the plugin uses the prompt's current model, falling
back to the model of the last assistant message.

A direct chord such as `ctrl+shift+r` is not the default because many terminals
report it as plain `ctrl+r`, which renames the session in OpenCode. A leader
chord always reaches OpenCode, and you can change `keybind` to any valid
OpenCode binding.

## How it works

1. Reads the last 10 messages of the session with the client.
2. Builds a compact transcript from user text and assistant text.
3. Calls `generate.text` — a transient generation that creates no session and
   adds nothing to session history.
4. Renders the Markdown result in the `sidebar.content` slot.

The recap prompt asks for a fixed shape, so recaps stay short and consistent:

```md
**Working on:** one sentence
**Done:** up to 2 short bullets
**Next:** one next step
```

## Development

```sh
git clone https://github.com/jimmerioles/opencode-recap
cd opencode-recap
bun install
bun run typecheck
```

Load a local checkout while developing, either through `cli.json`:

```jsonc
{
  "$schema": "https://opencode.ai/v2/cli.json",
  "plugins": ["/absolute/path/to/opencode-recap"]
}
```

or by symlinking it into the discovery directory:

```sh
ln -s "$PWD" ~/.config/opencode/plugins/opencode-recap
```

The TUI half is `tui.tsx`; `index.ts` is an intentionally empty server half so
the package loads cleanly from `plugins`.

## License

MIT
