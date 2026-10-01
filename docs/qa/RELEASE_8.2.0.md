# ZERO ONE 8.2.0 restoration receipt

Prepared 1 October 2026. This receipt distinguishes tested source, native acceptance, installable publication and Microsoft Store delivery.

## Restored features

- Private OS-encrypted API Vault: 64 named profiles, eight chat adapters and separate Serper, IonQ and IBM integrations. The selected chat profile drives Assistant, ZeroThink Chat, Research and Agent. Keys are not returned in public renderer snapshots.
- Exact-endpoint credential binding, legacy-key migration, selected-profile retention and backup-preserving credential reset. Connecting another OpenZero server creates a separate profile rather than replacing the previous server's credential. Pairing and planner requests refuse redirects and do not reflect sensitive provider errors.
- Native Quantum workspace with actual bounded ideal statevector simulation, IonQ v0.4 backend/job/probability/cost queries and explicitly reviewed cloud submissions. Hardware approval is tied to the displayed circuit/backend/shots/key and a current estimate; its review ceiling is not an enforced spending cap. IBM supports IAM authentication and read-only backend/status discovery only.
- Research Workbench: ten built-in workflows, up to 32 encrypted custom templates, Paper Creator and scenario fields, deterministic prompt preview and handoff into existing Research.
- Local PDF text extraction and explicit readable PDF report export, alongside selected text/ZNote sources and Markdown/JSON export.

The [restoration map](../ZEROTHINK_PARITY_8.2.0.md) records the inspected original public modules and remaining differences. No original owner database, account, key, restricted grant result or private research data was imported.

## Source and native verification

- Final `npm run check`: **55 Vitest and 188 Node tests passed**, with no skipped/cancelled tests, followed by successful TypeScript and Vite production build. The existing static-site metadata validator passed; this does not establish a new talktoai.org deployment.
- Immutable pinned ZSEC 0.1.2 verification passed: 89 files, 60 PE files, source `78efb1186c50efeeedf68bc14044cbc019fc0e8e`, entrypoint SHA-256 `6bc60026691fff00319e23c7ba9d49d1ab9f893715766177226062baa069d501`.
- [Native Vault acceptance](NATIVE_VAULT_8.2.0.json): actual Electron 43.7.7 Windows OS encryption, ciphertext/public-snapshot checks, save/reopen, active profile retention, migration/deletion, exact-endpoint credentials and encrypted custom-template round trips. A mocked provider transport was used; zero actual provider requests and zero visible windows.
- [Native Quantum acceptance](NATIVE_QUANTUM_8.2.0.json): actual Bell/GHZ ideal probabilities and seeded counts, OS-encrypted report save/reopen and cleanup, with zero cloud requests.
- [Native packaged PDF acceptance](NATIVE_PDF_8.2.0.json) checks the sandboxed, JavaScript-disabled renderer's `printToPDF`, actual packaged PDF.js worker and extracted two-page text. All nine targeted package/source SHA-256 pairs matched. Process exit 0, empty stderr, zero visible windows and zero remote requests.
- Labelled Brave layout review inspected Vault, Quantum and Research Workbench navigation. This development layout review is separate from OS storage and installed Store-signed UI acceptance.

No live paid quantum job or private-account API call was run by this release verification. Provider access, quotas and model availability remain account-dependent.

## Distribution evidence

The final package, tagged CI, public download and Store submission receipts are appended after their returned checks. The preceding 8.1 update's Submission 4 was confirmed available in Microsoft Store on 1 October 2026; that is not evidence of 8.2 publication or installation.

Final Store upload package: `ZERO-ONE-8.2.0-win-x64.appx`, **197,017,209 bytes**, SHA-256 `7a6783e2959a5a05c2b4c952e6123b0559772b066d148e87fca95a7bbda073f6`. Identity `talktoai.ZEROONEDesktop`, x64 **8.2.0.0**, existing publisher and `runFullTrust`. The ZIP integrity check passed for 178 entries. The archived ASAR matches the staged ASAR; all **26 Electron production modules and three renderer files** match current source/build hashes. Name/version/main/production dependencies match builder-normalized package metadata. The Store edition marker, PDF.js modules and pinned scanner entrypoint are present and verified. [Package receipt](PACKAGE_8.2.0.json). The AppX is an unsigned Store upload candidate; Microsoft controls certification and signing.

The [product privacy notice](https://researchforumonline.github.io/OpenZero/zero-one-privacy.html) was updated for Vault, templates, PDF sources, quantum requests/costs and retained recovery copies. OpenZero commit `9a1a56ed99070f67e99eb7602975b7a69005c47e`; [Pages deployment](https://github.com/ResearchForumOnline/OpenZero/actions/runs/36796750464) and public checks passed. The exact policy URL returned HTTP 200 with the 8.2 disclosures.

## Remaining original-system differences

Media generation/local Piper, whole research-project autosave/export, a general full-page URL reader, bundled Qiskit and IBM hardware execution are not included. IBM instance CRN/region currently require re-entry after restart. The discontinued hosted accounts/admin/DNA/mail/calling and central Hive services remain excluded. There is no claim of complete historical parity, AGI, calibrated research predictions or quantum advantage.
