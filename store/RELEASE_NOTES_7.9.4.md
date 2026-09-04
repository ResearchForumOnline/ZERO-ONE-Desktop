# ZERO ONE 7.9.4

## Microsoft Store certification repair

- The Microsoft Store edition no longer offers local AI model downloading, because that operation requires the separately installed Ollama desktop runtime and is not self-contained in the Store package.
- The Store interface now states that the AI assistant is optional and that ZERO ONE's command centre, connected workspaces, Browser Pilot and ZSEC features do not require a downloaded AI model.
- Local model controls remain available in the direct desktop edition for users who intentionally install and run Ollama.
- Gemma4 E2B remains the recommended lightweight local model for that direct-edition workflow.
- The Fusion model remains excluded and blocked from every release input.
- The Store boundary is enforced in both the renderer interface and the trusted main-process IPC handler, so a hidden or stale renderer cannot initiate a local model pull.

## Reviewer test path

1. Launch ZERO ONE Desktop and complete the short welcome screen.
2. Use the Command Centre, open any connected workspace tile, or open Browser Pilot. These primary functions do not require an AI model download.
3. Open Settings > Assistant drawer. The Store edition explains that local model downloading is not included; optional OpenAI and Groq providers require the user's own key.
4. Confirm that no control labelled "Download AI model" or "Download selected OpenZero model" is offered by the Microsoft Store package.

This release removes the unusable Store-only feature reported under Microsoft Store policy 10.1.2.10 while preserving the privacy-first local-model workflow in the separately distributed desktop edition.
