# ZERO ONE 7.8.2

## Local model routing repair

- Keeps an explicitly selected model on local Ollama whenever that exact model is installed locally.
- Prevents a stored OpenZero browser/panel token from silently rerouting local Assistant messages to the OpenZero server.
- Enables the verified OpenZero Fusion Qwen3-4B Agentic GGUF and other installed OpenZero GGUF variants to work as local Assistant selections.
- Retains the server token for browser workflows without weakening credential storage or exposing it to the local model.

The default remains OpenZero Qwen3-1.7B Agentic Q4_K_M. Operators can select the stronger Fusion Qwen3-4B Q4_K_M model when additional local memory and compute are available.
