# ZERO ONE 7.8.3

- Adds a dedicated conversational system prompt for local Ollama models.
- Removes leaked OpenZero operator-policy responses from chat history and rejects them as empty model output.
- Increases the local reply budget and adds repetition control for models that spend tokens on internal reasoning.
- Recognises both legacy `Zero-*` and current `OpenZero-*` published GGUF repositories as local models when installed.
- Uses the locally benchmarked OpenZero Gemma4 E4B release as the reliable default; the smaller experimental fine-tunes remain optional pending stronger conversational evaluation.
