# ZeroThink original-to-desktop restoration

The earlier ZERO ONE 8.0 integration introduced a small research engine. It did
not preserve the original ZeroThink Studio experience or conversational agent
workflow. This repair restores the original concepts as native desktop code,
with an explicit feature map and testable local storage.

## Original source material inspected

Only public application source was inspected from the owner's retained backups.
No credentials, account tables, private chat history, DNA data, database dumps,
`.env` files or owner server configuration were imported into this release.

- `zerothink_master_backup_23Jan2026.tar`: extracted public application files.
- `ZeroThink_Swarm_18Jan.tar.gz`: public agent entry point.
- `ZeroThink_v4_Swarm.zip`: public Swarm orchestration implementation.
- `1ZeroThink_v3_2_max.zip`: public Studio, routing and grounded-agent flow.
- The owner's later `ZeroThink/api_agent.php` and public Studio source for the
  named ALPHA/BETA/GAMMA/DELTA/EPSILON public Zero mode brief.

### Public January source hashes

Paths below are relative to the application web root in the January archive.
They identify inspected code, not private deployment files.

| Original source | SHA-256 |
| --- | --- |
| `app/core/Swarm.php` | `deb0a8344928ec4a4a6fa5c6800e5c883f419b1553cc634cef91415442b9bc3a` |
| `app/core/Memory.php` | `c3766f112faececa0fc51cf630f1e476e6ae98fbdc8a9a4535d980b54fabc38a` |
| `app/core/agents.php` | `512f9c80cd60dcec05735e248392769403129f400744f8ca628df8dd607943d6` |
| `api_agent.php` | `b4debf537825a699ff50ffc0374cfe976f13c7babbfe25a97a347f4047887647` |
| `app/views/studio.php` | `b5f2eb0261bac9a4bfc8d4c0d95aaf63b2625f7e46cab95ce57eb27a65f14396` |

## Feature map

| Original capability | Desktop implementation |
| --- | --- |
| ZeroThink Studio chat interface and conversation history | Native React Studio with Chat, Research and Agent sections; new chat, saved history, follow-ups, pinning, rename, copy and export |
| Groq/OpenAI/user-selected provider | Inline model and private-key settings using ZERO ONE's existing protected backend; no owner-hosted inference dependency |
| User persona in `Swarm::orchestrate` | Explicit editable persona, encrypted locally and supplied to the selected model |
| Latest five Cortex memories in `Memory::recall` | Up to 20 explicitly saved facts, with the most recent five included in context; no automatic extraction of personal information |
| Research → Critic → Final in `agent_run_chat` | Separate bounded model calls at depth three, with cancellation, visible progress and a final answer |
| Zero Library / RAG grounded answers | Persistent encrypted source library; up to eight selected sources per run; deterministic excerpt retrieval and source IDs |
| Serper web research | Real user-key search returning labeled source snippets that can enter the library; snippets remain distinguishable from full-text papers |
| v4 Orchestrator → Researcher → Serper → Sovereign | Optional Automatic web research: a bounded model decision/query, real Serper retrieval when needed, then an answer grounded in labeled snippets; off until the user enables it |
| Later Zero mode named lanes | ALPHA logic, BETA creative context, GAMMA counterpoints, DELTA impact and EPSILON evidence in a concise public brief |
| Chat exports | Whole conversation Markdown export, per-result Markdown/JSON export, and save-to-ZNotes |
| Local work execution | Native Agent section uses the desktop executor's selected-project tools; proposed changes and commands follow its visible approval rules |

The archived v4 Swarm's automatic web-search decision and query flow is restored
as an optional setting. One bounded planning call combines the original decision
and query-generation steps, preserving the chosen provider and token ceiling.
Malformed decisions and search failures remain visible and do not become invented
web results. Automatic queries contain the current question, not the whole chat
transcript, library, persona or saved memories.

## Local storage and compatibility

`electron/zerothink-studio-store.cjs` stores conversation history, selected-source
references, library text, persona and explicit memories in a separate encrypted
workspace. It uses the operating system's secure storage, serialized atomic
writes and checked size limits. An older workspace without a profile receives an
empty profile while retaining its conversations and sources. Corrupt existing
state is preserved and raises an error; it is never silently replaced.

ZNotes and ZeroThink maintain separate stores. Exported Markdown/JSON is readable
plaintext and is saved only to the user's selected file. Source imports are
explicit. A configured model receives recent conversation context, selected
excerpts and the user's explicit persona/memory, not the entire library or
unselected desktop files.

The portable research engine under `electron/zerothink/` remains unchanged, with
its original published provenance. `electron/zerothink-studio.cjs` adds the actual
conversation and Zero mode orchestration around it.

## Scientific and implementation boundaries

The old prompt framework referred to Zero Lattice Maximus, Probability of
Goodness, quantum equations and numerical telemetry. In the inspected chat
routes these were prompt text, not independently measured model cognition or
scientific validation. This release preserves the author's research separately
and does not fabricate those measurements in the user interface.

Named lanes are public work summaries, not five independently executing agents.
Private model scratchpads and `<think>` blocks are removed from displayed and
saved completion text. Review passes do not establish that a claim is true.

The desktop implementation removes hosted account/payment/admin dependencies.
It does not copy the old service's authentication flow, shared user database,
legacy server permissions or fake generation responses. Provider capabilities
and availability still depend on the model/server the user selects. Full parity
with every historical route is not claimed.

## Focused regression coverage

`electron/zerothink-studio.node.cjs` covers real model-adapter invocation,
follow-up context, offline Research, rejection of fake offline chat, separate
three-pass orchestration, source-ID warnings, public briefs, private-block
removal, bounded conversation inputs, cancellation, encrypted persistence and
restart, pinning, library/profile preservation, migration, corrupt-state handling,
unavailable secure storage, concurrent writes and size limits.
