# ZERO ONE 7.8.1

ZERO ONE now uses the verified OpenZero Qwen3-1.7B Agentic Q4_K_M GGUF as its fast local assistant default.

## What changed

- Replaces the stock `qwen3:1.7b` default with `hf.co/shafire/OpenZero-Qwen3-1.7B-Agentic-GGUF:Q4_K_M`.
- Migrates existing users still on the former stock fast-model default while preserving deliberate custom model selections.
- Updates setup, readiness, download, and assistant labels with the exact OpenZero model and approximately 1.1 GB download size.
- Removes leading Qwen thinking markers from displayed assistant replies when thinking is disabled.
- Updates packaged Windows smoke tests and runtime regression coverage for the new model alias.

The model runs through a separately installed local Ollama runtime. Model weights are not bundled inside the desktop installer. The first local-assistant setup downloads the GGUF from the verified Hugging Face repository.

Model card: https://huggingface.co/shafire/OpenZero-Qwen3-1.7B-Agentic-GGUF

These public packages remain unsigned. Windows SmartScreen or macOS Gatekeeper may show an unknown-publisher warning. Verify downloads with `SHA256SUMS.txt`.
