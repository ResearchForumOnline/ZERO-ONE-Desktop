# ZERO ONE 7.9.0

- Keeps **OpenZero Gemma4 E2B Agentic Q4_K_M** as the recommended lightweight local Assistant and **OpenZero Ministral 8B Runtime Agent** as the standard full OpenZero server model.
- Separates the local Assistant selection from the full OpenZero server model, so connecting the full runtime cannot silently replace everyday local chat.
- Preserves legacy OpenZero server routing and its selected server model when upgrading settings that predate the explicit local/server mode field.
- The rejected Fusion model and Qwen3 1.7B release are blocked at the local-model boundary and excluded from the visible selector after response-quality testing.
- Adds low-memory, balanced and performance profiles, reports relevant loaded Ollama models, unloads competing OpenZero models before chat without disturbing unrelated Ollama workloads, prevents concurrent local chats and exposes an explicit unload action.
- Updates first-party copy and packaged smoke tests to validate the actual Gemma E2B default instead of the historical Qwen default.
- Improves keyboard focus visibility for links, selects and disclosure controls, and makes the always-visible version label easier to read.
- Keeps historical release evidence explicitly separate from claims about this source revision. The 7.9.0 build remains an unsigned public preview until the documented signing and final-candidate gates are complete.

Direct local Ollama chat generates text on this computer. It does not independently gain OpenZero tools, browser control or autonomous action authority. Full OpenZero and Tab Pilot capabilities remain separately configured and permission-gated.
