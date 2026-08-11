# ZERO ONE 7.8.9

- Uses **OpenZero Gemma4 E2B Agentic Q4_K_M** as the recommended lightweight ZERO ONE Assistant model.
- Keeps **OpenZero Ministral 8B Runtime Agent** as the full OpenZero server/operator default.
- Adds explicit local Assistant choices for Gemma E2B, Ministral 8B, experimental Qwen3 1.7B, and legacy Gemma E4B. The known-bad Fusion model is deliberately excluded.
- Answers simple greetings instantly without loading a multi-gigabyte model.
- Replaces stale Gemma E4B download and timeout guidance with model-aware wording.
- Migrates the managed 7.8.8 Ministral Assistant selection to Gemma E2B when E2B is already installed, while preserving explicit custom choices.

Local comparison on the target CPU found Gemma E2B materially safer for quick chat than the Qwen3 1.7B fine-tune: it correctly explained GGUF, honestly refused live-web access, and did not disclose the supplied system prompt. Qwen remains available only as an experimental manual choice.
