# ZERO ONE 7.8.8

- Makes **OpenZero Ministral 3 8B Runtime Agent Q5_K_M** the default local Assistant for new installs.
- Safely migrates recognized older managed defaults, including OpenZero Gemma4 E4B, when the new model is already installed; explicitly selected custom models remain untouched.
- Keeps OpenZero Gemma4 E4B available as a compatibility fallback.
- Aligns the embedded OpenZero panel and ZERO ONE quick chat on the same recommended model.
- Preserves the always-visible version label and review-first update center introduced in 7.8.7.

The Ministral release uses unchanged upstream weights plus an embedded OpenZero runtime template. It is a runtime-template edition, not a weight fine-tune. Full OpenZero tool execution remains permission-gated by the OpenZero runtime; the quick local Assistant does not independently execute tools.
