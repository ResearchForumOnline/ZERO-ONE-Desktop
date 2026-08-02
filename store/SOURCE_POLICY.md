# ZERO ONE source and release policy

ZERO ONE Desktop is proprietary software. Its GitHub repository and source history remain private. Do not publish source archives, source bundles, debug symbols, unminified source maps, repository snapshots, private CI logs, credentials, or unsigned public installers.

`"license": "UNLICENSED"` in `package.json` prevents accidental npm publication; it is not an end-user licence or Store EULA. Public distribution remains blocked until approved consumer terms are selected and published.

## Public/private boundary

- **Private:** ZERO ONE application source, tests, CI configuration, internal release evidence, unsigned installers, reviewer credentials, service tokens, signing material, and Store drafts.
- **Public:** factual product pages, privacy/support/reporting routes, reviewed screenshots, signed final installers, hashes/provenance for those installers, and the separately maintained ZSEC Shield project.
- **Third party:** ZSEC Shield is intentionally public under Apache-2.0. Its licence and third-party notices must remain in every ZERO ONE package that bundles it.

A private repository reduces accidental disclosure; it does not make an Electron executable opaque. Packaged JavaScript can be inspected or reconstructed from `app.asar`, even when minified and integrity-protected. Never place credentials, private keys, signing secrets, unpublished research data, or server passwords in client code.

## Release rules

1. Build only from a reviewed private commit and a clean dependency lock.
2. Stage ZSEC from its exact immutable release and verify the embedded private identity, manifest inventory, hashes, licences, contracts, and PE architecture.
3. Reject source maps, `.env` files, tests, repository metadata, and unrelated source files from the packaged inventory.
4. Sign the installer, ZERO ONE executable, every bundled Electron PE, and every ZSEC EXE/DLL/PYD with a trusted publisher identity.
5. Record the exact commit, installer URL, SHA-256, signature subject, package inventory, screenshots, SBOM/provenance, clean-machine tests, and Store submission ID.
6. Keep unsigned or incomplete candidates as private drafts. Do not mark a draft, uploaded asset, validation pass, or visible Submit button as published.
7. Before a public release, repeat anonymous checks against repository, raw, archive, release-asset, and package-registry paths.
