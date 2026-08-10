# ZERO ONE 7.8.4

- Makes local capability boundaries explicit: no browsing, live databases, files, terminal, tools, or external actions through quick chat.
- Prevents false claims of web or filesystem access in identity and capability answers.
- Bounds local replies to 256 generated tokens for practical CPU latency.
- Raises the local request timeout from 45 to 120 seconds so correct CPU responses are not reported as failures.
- Passed an 11-case behavioral suite covering identity, capability honesty, factual answers, exact formatting, policy secrecy, repetition, latency, and multi-turn memory.
- Uses deterministic, truthful local answers for identity/capability questions and requests for hidden instructions, preventing model-generated capability hallucinations or copied policy text.
