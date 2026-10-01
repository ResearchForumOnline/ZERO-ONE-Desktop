# ZeroThink source audit and desktop restoration map

Audit date: 1 October 2026. This document compares the original public application
source with the released ZERO ONE 8.1 baseline and identifies the 8.2 restoration
work. It is a feature inventory, not a claim of complete historical parity.

## What was inspected

- `ZeroThink/`: later retained public PHP application and companion source.
- `_zerothink_full_audit_20260713T220124Z/`: July public source snapshots for
  comparison. ZMath, the PDF writer and IBM worker match the later source hashes;
  the Vault, QuantumZero, media, Oracle and research tools changed afterwards.
- `_zerothink_release_final_20260714/`: archive file listings confirm the public
  API and core modules were present in frozen release candidates. No private
  configuration, account records or runtime data were extracted.
- `zerothink_master_backup_23Jan2026.tar/`: the extracted January application
  under the owner's retained backup. Its chat/Swarm and early Oracle concepts
  predate many later integrations; January-only review misses substantial work.
- `zerothink-local-release-20260930/`: the new portable Node research engine. Its
  provenance says historical concepts were reviewed; the old application was
  not copied wholesale. It is a small research engine, not the full old product.
- ZERO ONE 8.1 source and its original-to-desktop restoration documentation.

No `.env`, SQL dump, owner API key, account database, private conversation,
research grant account, raw DNA file or personal profile was read or imported.

## Feature map

Paths in the source column are relative to the retained `ZeroThink/` application.

| Capability | Actual original source and behavior | ZERO ONE 8.1 baseline | Desktop restoration direction |
| --- | --- | --- | --- |
| Multi-service Neural Vault | `api_vault.php`, `app/core/vault_security.php`: named keys for Groq, OpenAI, Gemini, xAI, NVIDIA, IonQ, IBM, Featherless, OpenZero/ZeroThink API and Serper, plus IBM instance/region | OpenAI, Groq and Serper settings; local/server token settings | Dedicated native vault; OS-encrypted secrets, status-only renderer reads, no owner service keys or Pro/account database |
| Provider selection | `api_agent.php`, `app/core/providers.php`, `model_catalog.php`: provider-specific requests and selected model | Local Ollama/OpenZero, server, OpenAI and Groq | Restore verified provider adapters with user-selected keys/models; account quotas and supported models remain provider-dependent |
| Chat and explicit memory | `Swarm.php`, `Memory.php`, `api_agent.php`: conversation tail, explicit facts, persona | Native saved chats, pin/rename, follow-up context, persona and most recent five explicit facts | Retain and integrate new vault choices |
| Research/Critic/Final | `app/core/agents.php`: real sequential provider calls at depths 1–3 | Restored bounded separate calls | Retain cancellation and visible progress; no independent-agent-count claims |
| Serper and automatic search | `research_tools.php`, `api_agent.php`, earlier Swarm: actual search and query decision | Real search snippets; optional automatic search planner | Retain source labels and failures; search snippets are not full papers |
| Public URL content | `api_agent.php::fetch_url`: fetches and strips HTML, bounds output to 8,000 characters | Not restored in 8.1 | Future bounded URL reader with DNS/address/redirect checks; avoid blindly copying the old incomplete network controls |
| Full code/source library | `app/zero_library.php` first 385 lines: file index, outlines, SHA-256, line-numbered snippets and deterministic search | 32 selected text sources, eight per run, TXT/MD/CSV/JSON only | Broader selected code formats and visible file provenance; original allowed `.env`, which must not become default secret ingestion |
| Research templates | `api_research_templates.php`, `research_tools.php`: built-in and saved user stages, source requirements and validation checks | Nine fixed portable processes; custom process has no saved template editor | Native Research Workbench with built-ins, custom copy/edit/delete and encrypted storage |
| Research Paper Creator | `research-paper-creator.php`: topic/question/method/source policy/inclusion/exclusion fields; separate plan, ledger, outline, draft, critique and revision prompt actions | Generic paper-draft process | Native form builds source-labelled research requests; actual execution uses existing Research and selected library sources |
| PDF creation and report artifacts | `app/core/pdf_creator.php` emits actual PDF bytes; `pdf_artifacts.php` detects requested artifacts and stores downloadable files | Markdown and JSON export | Native user-selected PDF export; no hosted signed-in artifact endpoint |
| Whole research project JSON | `research-paper-creator.php`: workspace autosave and explicit project export | Not restored as a separate project object | Remains separate work unless a release explicitly documents implementation; custom template saving alone is not full project autosave |
| IonQ backend/job evidence | `api_quantum_zero.php`, `quantumzero-python/quantumzero_agent.py`: real backend telemetry, recent jobs, job detail and probabilities, evidence packets and job explanation | Missing | Native Quantum workspace using the user's separately entered key; fixed provider endpoint, read-only actions and explicit source/status labels |
| IonQ simulator experiments | `api_quantum_zero.php`: ten small circuit families, bounded shots, simulator default, job reuse and result metrics | Missing | Explicit simulator requests with exact displayed circuit and job ID; no claimed physical hardware execution or AI improvement from simulator results |
| IonQ QPU submission | Original source accepts `qpu.*` only with explicit confirmation, low shot limits and cooldown | Missing | Paid hardware must not run automatically. A general product integration must not import or spend the owner's restricted research grant account |
| IBM/Qiskit lane | `quantumibm-python/qiskit_worker.py`: actual local StatevectorSampler if installed, explicitly labelled deterministic fallback otherwise; IBM token only lists backend context | Missing | Native IBM IAM authentication and read-only Quantum Compute REST backend/status discovery using the user's Vault key, instance CRN and region. The shared native ideal statevector simulator is separate; no bundled Qiskit environment or IBM hardware submission is included |
| Oracle scenario desk | `api_oracle.php`: real model request, optional Serper, structured scenario/driver/risk fields; fallback substitutes probability/confidence constants | Missing | Native scenario form with observed evidence, alternatives, assumptions and disconfirming tests; do not restore invented fallback percentages or calibration claims |
| ZMath / ZBA tools | `app/zmath_engine.php`: deterministic modulo-9 arithmetic, signed boundary annotations, operator trace, byte/chunk summaries and SHA-256 | Missing | Native deterministic tools; descriptions and heuristic scores do not establish measured intelligence, quantum advantage or new cryptographic strength |
| Generated images/speech/video | `api_media.php`: real OpenAI image/speech requests and xAI/BytePlus/OpenAI video job/status/download requests | Missing | Remains outside this restoration unless explicitly implemented and tested; adapters require current provider documentation, keys and visible cost controls |
| Local Piper voice | `api_quantum_voice.php`, Python companion: actual locally installed Piper process with file/time checks; fallback platform speech | Browser/system speech controls are separate | A restored voice module would need explicit local executable/model setup and genuine output verification; no bundled-model claim |
| OpenZero remote agent | `api_agent.php::zt_openzero_agent_run_request`: calls `/v1/agent/runs`, returns run status/trace/verification metadata | Native selected-project file/command agent and separate OpenZero panels | Keep native tools; optional server integration must expose which computer executes actions and the server's actual permissions |
| Hive | `api_hive.php`: central SQL node registration and signed knowledge contribution/search | Not restored | Old central service is incompatible with the requested self-hosted/no-main-node direction; do not reintroduce it as if decentralized |

## Native Research Workbench contract

`electron/zerothink-templates.cjs` supplies ten visible built-in workflows and
up to 32 custom templates. The custom store uses operating-system secure storage
and serialized atomic writes. Unavailable secure storage or a Linux `basic_text`
backend is rejected; there is no plaintext fallback. Corrupt existing ciphertext
or invalid decoded state is preserved and surfaces an error.

The native editor supports save, edit, custom copy and delete. The Paper Creator
form supplies the topic, research question, methods, evidence notes, limitations,
audience, citation style and screening criteria. The scenario form adds observed
outcomes, alternatives and horizon. Its deterministic prompt preview does not
invoke an LLM, run a study or generate findings. **Use in Research** places the
prepared question in the existing Research executor for the user's chosen model
and selected library sources.

The form does not verify the user's notes or citations. Requests explicitly
separate observations, cited claims, interpretation, proposals and candidate
leads. No author credentials, endorsements, citations, DOI or experimental
results are invented by the module. Source IDs come from actual selected evidence.
Assembled questions have the same 12,000-character ceiling as the desktop executor.

Focused synthetic tests cover encrypted save/reopen, edits/deletion, immutable
built-ins, queued concurrent saves, count/size bounds, secure-storage failure,
tampering and corrupt-state preservation, and source-labelled rendering. These
tests do not establish scientific correctness or installed Store UI acceptance.

## Intentional exclusions and honest limits

Hosted login, payment/subscription, admin services, old owner databases, ZMail,
CallChat, DNA Lab and private genetic data are excluded from this app restoration
under the owner's current instructions. Their removal is not accidental loss.

An LLM answer is classical provider output. Quantum results are evidence supplied
to that classical model; they do not mean the language model runs on qubits.
Original names such as Quantum Dispatch, ethics lattice and probability math
describe research concepts or circuit choices, not proven remote effects or
independent scientific validation. Public quantum probability distributions must
not be presented as secret encryption keys.

The source contains risk-routing, refusal-repair prompts, stale model lists,
plaintext credential fallbacks and permissive upload extensions. These are not
copied automatically. Provider compatibility must be checked, limits must be
visible and operations must report real failure rather than fabricated success.

Full original media, Piper, IBM environment installation, research-project
autosave/export, public full-page reading and central Hive parity are not implied
by a repaired vault, Quantum workspace or Research Workbench. Release receipts
must identify which integrations actually ship and which were tested.

## Public source hashes

These hashes identify inspected code only; they are not private deployment data.

| Source path under `ZeroThink/` | SHA-256 |
| --- | --- |
| `api_vault.php` | `fc1e92923375eab9870d42e2eb491e29b0278a8612221371a8f487923a7ec3db` |
| `app/core/vault_security.php` | `8d36ab9f46433009b759d422611384acafd450f670b17d372a0b64816149b11d` |
| `app/core/providers.php` | `9b6c8069ad8fbab6389e56abbf456bc4152766eb115716227e3fd4eb5f8f93b8` |
| `app/core/model_catalog.php` | `7006e349f8c92bd302b2a2c9c7f7ef1d171e0bc64f660d4a01292e857287f389` |
| `api_quantum_zero.php` | `c338c5d827fe998ac88c2fe4b5385649f2e7a65ff9dd0a501ae95cd76f8fc7cb` |
| `quantumzero-python/quantumzero_agent.py` | `3e187eec127eb4bb00b868d527d8d2beae7d8c46a65cb3af279b2ba8b933c2fa` |
| `api_quantum_ibm.php` | `9f5886362da19f55ed89b1c44860f5b428905ff71ad7350c881365cf2a33e0c0` |
| `quantumibm-python/qiskit_worker.py` | `22287a396f7e3e0c814e9e89e5667f8d5d964887c0492179c4de61f1715eeeb5` |
| `api_oracle.php` | `ca531bbe6f02b1e088122fc2664b18fdf74257dfe070f0e040ae8717e4f257da` |
| `api_media.php` | `66301ef60884844b9043705ec495a22782d399ac6e463ac5ff8eb5f15c5ca0e6` |
| `research-paper-creator.php` | `f472979502edbd34f5d5b844ed239846ed68a49c45683cbcf44fadecd685d748` |
| `app/core/pdf_creator.php` | `552eca5ec7e61c3a7b52f646f674f6fe3a32a8cfbb535f12af826b2f8365a2cb` |
| `app/core/pdf_artifacts.php` | `eebffb5f5e57d2ab5f458800b770e5a66a3ee4b26acf69af0ad08422ecf410c3` |
| `api_research_templates.php` | `7f0dcde2e24e3d35bb17b380531823fafbfe462cba751d1a42110de62ca9f5cd` |
| `app/core/research_tools.php` | `6d07ed545d2c2b26420d7ba4ae3b098c1842f960f819dcff47b1d40dd2b6e8c7` |
| `app/zmath_engine.php` | `73fdb7d46d9994222d431d1b8ef495101043f0da2d1260ca31c29d35f0ae0c9b` |
| `app/zero_library.php` | `4b50465301949c00afef19826ae3919860a1158cf7dddcec993c6b3b2f9f067c` |
| `api_agent.php` | `0bdc399894431f56eead7c4358784d021963b5953606d5fef17d32ba64c0a78a` |
