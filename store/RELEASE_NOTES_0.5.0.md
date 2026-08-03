# ZERO ONE 0.5.0

## Private local OpenZero, made understandable

- **Local** is now the recommended OpenZero Assistant mode for most people.
- Local mode connects to Ollama on the same computer and uses `openzerogemma:latest` by default.
- Setup distinguishes Ollama installation, service availability, model download and chat readiness instead of showing one ambiguous connection state.
- **Server** remains available as an advanced option for people who operate an OpenZero node.
- Existing encrypted server credentials are retained unless the user explicitly replaces or clears them.
- Groq and OpenAI remain optional bring-your-own-key providers.

Local mode means private model chat through Ollama's loopback API. It does not claim to provide the full OpenZero server orchestration stack, remote skills, browser control, tools or multi-step agent runtime. Those capabilities require a compatible OpenZero server or a separately implemented local orchestration layer.

Ollama is a separate runtime and local models can require several gigabytes of disk space. Use the official [Ollama download](https://ollama.com/download), [quickstart](https://docs.ollama.com/quickstart) and [chat API documentation](https://docs.ollama.com/api/chat).
