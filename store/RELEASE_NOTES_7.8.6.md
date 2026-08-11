# ZERO ONE 7.8.6

- Adds **OpenZero Ministral 8B Runtime Agent Q5_K_M** as an explicit, optional local Assistant selection.
- Keeps the behavior-tested Gemma4 E4B local Assistant as the default; the 8B runtime edition is for capable CPUs and is not silently selected.
- Preserves an intentional published OpenZero GGUF selection at startup instead of replacing it with Gemma.
- Uses the selected model for the in-app download action and reports the selected local model during setup.
- The Ministral release is a runtime-template edition: upstream model weights are unchanged. Local chat remains separate from the permission-gated full OpenZero orchestration runtime.
