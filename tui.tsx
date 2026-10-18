/** @jsxImportSource @opentui/solid */
import { Plugin, usePlugin } from "@opencode/plugin/tui"
import { SyntaxStyle, TextAttributes } from "@opentui/core"
import type { ResolvedTheme } from "@opencode/theme/tui"
import { Show, createSignal } from "solid-js"

const RECENT_MESSAGES = 10
const PROMPTS_UNTIL_STALE = 3
const TIMEOUT_MS = 45_000
const DEFAULT_KEYBIND = "<leader>v"

type ModelChoice = {
  providerID: string
  modelID: string
  variant?: string
}

type SignalPair<T> = [() => T, (value: T) => void]

const recaps = new Map<string, SignalPair<string | null>>()
const loadings = new Map<string, SignalPair<boolean>>()
const promptCounts = new Map<string, number>()
const lastStatus = new Map<string, string>()

function signalFor<T>(map: Map<string, SignalPair<T>>, sessionID: string, initial: T): SignalPair<T> {
  let pair = map.get(sessionID)
  if (!pair) {
    pair = createSignal<T>(initial) as SignalPair<T>
    map.set(sessionID, pair)
  }
  return pair
}

function recapFor(sessionID: string) {
  return signalFor(recaps, sessionID, null)
}

function loadingFor(sessionID: string) {
  return signalFor(loadings, sessionID, false)
}

let cachedTheme: ResolvedTheme | undefined
let cachedStyle: SyntaxStyle | undefined

function syntaxStyle(theme: ResolvedTheme): SyntaxStyle {
  if (theme !== cachedTheme || !cachedStyle) {
    cachedTheme = theme
    cachedStyle = SyntaxStyle.fromStyles({
      comment: { fg: theme.syntax.comment },
      keyword: { fg: theme.syntax.keyword },
      function: { fg: theme.syntax.function },
      variable: { fg: theme.syntax.variable },
      string: { fg: theme.syntax.string },
      number: { fg: theme.syntax.number },
      type: { fg: theme.syntax.type },
      operator: { fg: theme.syntax.operator },
      punctuation: { fg: theme.syntax.punctuation },
    })
  }
  return cachedStyle
}

function readConfiguredModel(options: Readonly<Record<string, any>>): {
  model?: ModelChoice
  error?: string
} {
  const providerID = typeof options.providerID === "string" ? options.providerID.trim() : ""
  const modelID = typeof options.modelID === "string" ? options.modelID.trim() : ""

  if (Boolean(providerID) !== Boolean(modelID)) {
    return { error: "Set both providerID and modelID, or neither" }
  }
  if (!providerID) return {}
  return { model: { providerID, modelID } }
}

function readKeybind(options: Readonly<Record<string, any>>): string {
  const value = typeof options.keybind === "string" ? options.keybind.trim() : ""
  return value || DEFAULT_KEYBIND
}

function messageText(message: any): string | null {
  if (message?.type === "user") {
    const text = typeof message.text === "string" ? message.text.trim() : ""
    return text ? `user: ${text}` : null
  }
  if (message?.type === "assistant") {
    const text = (message.content ?? [])
      .filter((part: any) => part?.type === "text")
      .map((part: any) => part.text ?? "")
      .join(" ")
      .trim()
    return text ? `assistant: ${text}` : null
  }
  return null
}

function inferSessionModel(messages: any[]): ModelChoice | undefined {
  for (const message of [...messages].reverse()) {
    if (message?.type !== "assistant") continue
    const providerID = message?.model?.providerID
    const modelID = message?.model?.id
    if (typeof providerID === "string" && typeof modelID === "string") {
      return { providerID, modelID, variant: message?.model?.variant }
    }
  }
  return undefined
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Recap timed out")), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

function buildPrompt(transcript: string, previousRecap: string | null): string {
  return `You are a summarization assistant. Output only Markdown - no tools, no files, no questions.

Summarize this coding session in ~40 words across these sections:

**Working on:** one sentence - what is being built or explored
**Done:** max 2 bullets, <=6 words each (skip if nothing yet)
**Next:** max 1 bullet - the immediate next step (skip if none)

No intro, no outro, no extra sections. Output only the Markdown.
${previousRecap ? `\nPREVIOUS RECAP (context for earlier history):\n${previousRecap}\n` : ""}
RECENT TRANSCRIPT (last ${RECENT_MESSAGES} messages):
${transcript}`
}

function RecapSidebar(props: { sessionID: string; onRecap: () => void }) {
  const context = usePlugin()
  const [recap] = recapFor(props.sessionID)
  const [loading] = loadingFor(props.sessionID)

  return (
    <box flexDirection="column">
      <text
        fg={loading() ? context.theme.text.muted : context.theme.text.base}
        attributes={TextAttributes.BOLD}
        onMouseDown={() => {
          if (!loading()) props.onRecap()
        }}
      >
        {loading() ? "Recapping..." : "Recap"}
      </text>
      <Show when={recap() !== null && !loading()}>
        <markdown
          content={recap()!}
          syntaxStyle={syntaxStyle(context.theme)}
          fg={context.theme.text.muted}
        />
      </Show>
    </box>
  )
}

export default Plugin.define({
  id: "opencode-recap.sidebar",
  setup(context) {
    const configured = readConfiguredModel(context.options)
    const keybind = readKeybind(context.options)

    const generate = async (sessionID: string) => {
      const [, setRecap] = recapFor(sessionID)
      const [isLoading, setLoading] = loadingFor(sessionID)
      if (isLoading()) return

      setLoading(true)
      try {
        if (configured.error) throw new Error(configured.error)

        const response = await context.client.message.list({
          sessionID,
          limit: RECENT_MESSAGES,
          order: "desc",
        })
        const messages = [...(response.data ?? [])].reverse()

        const transcript = messages
          .map(messageText)
          .filter((line): line is string => line !== null)
          .join("\n\n")

        if (!transcript) {
          setRecap("*Nothing to summarize yet.*")
          return
        }

        const selected = context.ui.model.current()
        const model =
          configured.model ??
          (selected
            ? { providerID: selected.providerID, modelID: selected.modelID, variant: selected.variant }
            : undefined) ??
          inferSessionModel(messages)

        if (!model) throw new Error("No model selected")

        const result = await withTimeout(
          context.client.generate.text({
            prompt: buildPrompt(transcript, recapFor(sessionID)[0]()),
            model: {
              providerID: model.providerID,
              id: model.modelID,
              ...(model.variant ? { variant: model.variant } : {}),
            },
          }),
          TIMEOUT_MS,
        )

        const text = result.text?.trim()
        setRecap(text || "*No summary generated.*")
        promptCounts.set(sessionID, 0)
      } catch (error) {
        setRecap(`*Recap failed: ${errorMessage(error)}*`)
      } finally {
        setLoading(false)
      }
    }

    const stopStatus = context.data.on("session.status", (event) => {
      const sessionID = event.data.sessionID
      const [recap] = recapFor(sessionID)
      if (recap() === null) return

      const status = event.data.status.type
      if (status === "busy" && lastStatus.get(sessionID) !== "busy") {
        const count = (promptCounts.get(sessionID) ?? 0) + 1
        promptCounts.set(sessionID, count)
        if (count >= PROMPTS_UNTIL_STALE) {
          recapFor(sessionID)[1](null)
          promptCounts.set(sessionID, 0)
        }
      }
      lastStatus.set(sessionID, status)
    })

    const stopSidebar = context.ui.slot({
      append: "sidebar.content",
      render: (input) => (
        <RecapSidebar sessionID={input.sessionID} onRecap={() => void generate(input.sessionID)} />
      ),
    })

    context.keymap.layer(() => ({
      mode: "global",
      priority: 10,
      commands: [
        {
          id: "recap.generate",
          title: "Recap this session",
          description: "Summarize the recent conversation in the sidebar",
          group: "Recap",
          bind: keybind,
          palette: true,
          run: () => {
            const route = context.ui.router.current()
            if (route.type !== "session") {
              context.ui.toast.show({
                variant: "warning",
                message: "Open a session to generate a recap",
              })
              return
            }
            void generate(route.sessionID)
          },
        },
      ],
      bindings: ["recap.generate"],
    }))

    return () => {
      stopStatus()
      stopSidebar()
    }
  },
})
