# ZeroThink June backup recovery inventory

Review date: 3 October 2026.

This inventory compares the user-supplied `ZEROTHINK_5THJUNE26TALKTOAI_BACKUP_20260605_080041` application source with the native ZERO ONE desktop implementation. It records code actually inspected, rather than treating names such as “Swarm” or “Cortex” as proof of capability.

The historical `AGENTS.md` focuses on DNA Lab. The current user request expressly excludes DNA Lab, administration and hosted user accounts. No DNA data, environment files, private keys, storage records, uploads, user memories or database contents were imported or read for this review.

## Recovery map

| Historical source | Mechanism observed | Native implementation and gap |
| --- | --- | --- |
| `app/core/agents.php` | Bounded sequential research, critic and final provider calls; selected-document grounding | `electron/zerothink-studio.cjs` and `electron/zerothink/engine.cjs` already implement bounded draft/review/final calls, source IDs and cancellation. The historical code does not run independent parallel agents. |
| `app/core/research_tools.php` | Nine research template definitions; provenance and human-approval requirements; Serper search and evidence log | Native templates, custom encrypted templates, source retrieval and Serper search already exist. Narrative review, separate supervisor discovery, and explicit researcher correction/review deserve clearer native entry points. Approval was metadata in the old templates; an executable review step is a concrete improvement. |
| `app/core/Memory.php` | Recall the five most recent explicitly saved statements | Native encrypted persona/facts and persisted conversations cover this mechanism. The historical query ignores its query argument, so it is not semantic retrieval. |
| `app/core/rag.php` | Overlapping text chunks and MySQL full-text retrieval | Native local retrieval already chunks and ranks selected documents without MySQL. Preserve source IDs and source access boundaries. |
| `app/views/studio.php` | Simple dominant chat surface, task starter cards, history, optional vault and research pages | Restore the task-first entry pattern with plain-language choices and progressive disclosure. Do not restore subscription, master/admin, account or external-site controls. |
| `assets/js/app.js` | Text/image attachments, browser microphone transcription, speech output | Native text/PDF attachments exist. The inspected ZeroThink workspace does not offer comparable image/vision or microphone controls. Porting these requires actual native/provider capability, preview, consent and failure handling; browser-only recognition must not be advertised as offline speech. |
| `api_cortex.php` | Append a submitted statement to a shared JSON file | Do not copy the shared append-only storage implementation. Native explicitly chosen memory is a better fit for a single-device app. |
| `api_oracle.php` | Structured verdict, drivers, risks, next steps and model-produced integer probability/confidence | Native scenario templates cover scenario comparison. Structured decision cards would improve readability. Model-generated percentages do not establish calibration and should not be presented as measured forecasts. |
| `api_quantum_zero.php` | Experiment catalogue, circuits, IonQ job submission/polling, probability metrics and job evidence | Native Quantum already offers real local statevector simulation and IonQ/IBM adapters. More named experiment presets are recoverable; quantum randomness must not be presented as verification of unrelated propositions. |
| `api_media.php` | Provider speech, image and asynchronous video generation/status/download routes | A native media workspace remains a separate substantial integration. Preserve user-owned vault keys, visible provider/cost consent and real job state. Do not copy hosted login, entitlement or server credentials. |

## Additional desktop sources inspected

- The desktop `ZeroThink` source contains the later IBM Qiskit/Python integration. Native ZERO ONE already has IBM REST adapters; Qiskit execution and advanced named experiments are separate mechanisms and should be described precisely.
- `zerothink-local-release-20260930/PROVENANCE.json` records a dependency-free native implementation informed by historical agents, router, templates and CLI workflows. Its existing excluded-data boundary remains suitable.
- `_zerothink_release_final_20260714` contains frozen candidate/runtime archives. Their presence is recorded; archives were not extracted or treated as the current production source in this review.

## Highest-value next actions

1. Present Chat, Research and Project Agent as plain-language tasks. Keep Vault, Quantum, templates and detailed settings discoverable without dominating the default conversation.
2. Offer useful starter prompts from the old studio: explain a difficult idea, build a script, improve a project, review literature, draft a paper and compare scenarios.
3. Make source review a real saved action: record accepted/rejected/needs-review evidence, researcher corrections and exportable status. Describe it as researcher review, not independent scientific verification.
4. Restore the remaining research workflow distinctions and preserve custom stages instead of collapsing every specialist task into a paper prompt.
5. Add image/vision, speech and media only when their complete native/provider workflows are implemented and exercised. Do not expose inactive buttons or placeholders.

## Inspected source fingerprints

These hashes identify historical source files; source code was reviewed selectively and not copied wholesale.

| Relative June source | SHA-256 |
| --- | --- |
| `app/core/agents.php` | `512f9c80cd60dcec05735e248392769403129f400744f8ca628df8dd607943d6` |
| `app/core/research_tools.php` | `9c887449f209ad52ca11b3c28eccf4312e2903b0fc802a476c17d6f81bf03801` |
| `app/core/Memory.php` | `c3766f112faececa0fc51cf630f1e476e6ae98fbdc8a9a4535d980b54fabc38a` |
| `app/core/rag.php` | `25e6798b73c61735d4c4bcae0b11a243a792765db0f109d5f3ca55544fe8ca14` |
| `app/views/studio.php` | `2090aaa065ade8fe93b68689e8e1d93b10f39d9f4eb8d2d8d03da8f1446341a3` |
| `assets/js/app.js` | `f17302f00a5ed62bedab022c764f4fc20604f3398c850874ec87173397f3f78e` |
| `api_cortex.php` | `6b0abe2dde82f2d780078671d428c20acb1cf78725d1694dfa9cbaad50d806dc` |
| `api_oracle.php` | `89ce5538b9c56856b87ed77f79344d676c6fcb643833977cb5f38dada43a3f1b` |
| `api_quantum_zero.php` | `4c1c55370d132557d8fcfcf72f1c1b647c201f7eef1a0f43b5998c0900bc7b16` |
| `api_media.php` | `66301ef60884844b9043705ec495a22782d399ac6e463ac5ff8eb5f15c5ca0e6` |
