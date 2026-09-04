# ZERO ONE 7.9.3

## Microsoft Store certification repair

- The Microsoft Store build now sends local Ollama requests through Electron's Chromium-native network stack.
- ZERO ONE checks that Ollama is running immediately before starting a model download and gives a clear recovery action if the separate local runtime stops.
- Interrupted downloads now show a concise explanation instead of exposing a raw `fetch failed` or IPC error.
- Cancellation and bounded error reporting from Ollama remain intact.

## Product boundaries and safeguards

- Ollama remains an optional, separately installed local runtime. ZERO ONE does not silently install it or bundle it into the Store package.
- Gemma4 E2B remains the recommended lightweight local model for the packaged model-chat path.
- The Fusion model remains excluded and blocked from release inputs.
- Local model chat remains separate from advanced OpenZero server orchestration and Browser Pilot capabilities.
- Microsoft Store installs use Store-managed application updates, avoid unsupported startup registration, and keep Store-local security state isolated.

This release addresses the model-download path reported under Microsoft Store functionality policy 10.1.2.10. A fresh package must pass the repository checks and Windows App Certification Kit before resubmission.
