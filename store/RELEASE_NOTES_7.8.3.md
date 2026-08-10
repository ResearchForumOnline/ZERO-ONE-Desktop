# ZERO ONE 7.8.3

- Adds a dedicated conversational system prompt for local Ollama models.
- Removes leaked OpenZero operator-policy responses from chat history and rejects them as empty model output.
- Increases the local reply budget and adds repetition control for models that spend tokens on internal reasoning.
- Recognises both legacy `Zero-*` and current `OpenZero-*` published GGUF repositories as local models when installed.
