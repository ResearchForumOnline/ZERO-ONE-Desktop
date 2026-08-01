# ZERO ONE store-readiness gate

Status: preview candidate. No store submission is authorized by this document.

## Verified now

- TypeScript, Vitest and production Vite build pass on Windows.
- A Windows x64 unpacked package can be produced with hardened Electron fuses.
- BrowserWindow sandboxing, context isolation and Node isolation are enabled.
- Remote webviews have separate partitions, no preload and an owned-origin allowlist.
- CallChat media is denied by default and limited to its exact HTTPS origin when enabled.
- The ZSEC bridge accepts only `zsec.shield.status.v1` contract version 1 from a fixed installed path.
- Diagnostics omit API tokens, cookies, content, message bodies and call data.

## Blocking release gates

| Gate | Windows | macOS | Linux |
|---|---|---|---|
| Native package built on target OS | x64 preview verified | Not yet verified | Not yet verified |
| Publisher signature | Authenticode absent | Developer ID absent | Package/repository signing absent |
| Store identity | Partner Center identity not reserved | App Store Connect identity not created | Distribution accounts not configured |
| Compliance test | WACK/clean VM pending | Notarization/Gatekeeper pending | Clean VM/package-manager tests pending |
| Accessibility | Keyboard, 200% scale, Narrator and High Contrast pending | VoiceOver pending | Orca/desktop scaling pending |
| Legal metadata | Licence/EULA and third-party review pending on all platforms |
| ZSEC dependency | Separate binary has no signed native installer; no bundling contract yet |
| Updates | App binary update channel and rollback metadata not implemented |

Do not upload an unsigned package or publish a mutable installer URL.

## Windows release sequence

1. Reserve the exact Partner Center identity and choose MSIX or a Store-listed signed EXE/MSI route.
2. Obtain a trusted Authenticode/Trusted Signing identity matching the public publisher.
3. Build x64 and arm64 immutable versioned artifacts in CI; sign the installer and every shipped PE.
4. Verify Electron fuses, ASAR integrity, install, launch, update, rollback and clean uninstall on clean Windows 10 and 11 VMs.
5. Run WACK where applicable and capture exact results.
6. Supply screenshots, description, age rating, support URL, endpoint-specific privacy URL and limitation wording.
7. Submit only after the ZSEC dependency is either excluded from the package or independently signed and installed through a documented mechanism.

## macOS release sequence

1. Build x64 and arm64 on macOS using the configured hardened runtime.
2. Replace the PNG fallback with reviewed `.icns` artwork and verify every helper signature.
3. Sign with Developer ID, submit with `notarytool`, staple and validate offline Gatekeeper behaviour.
4. Use direct notarized DMG distribution first. A Mac App Store build requires a separate MAS target, App Sandbox design and entitlement review.
5. Do not claim real-time endpoint monitoring without an approved EndpointSecurity entitlement and user-approved system extension.

## Linux release sequence

1. Build AppImage and DEB on clean x64/arm64 Linux runners.
2. Sign DEB repository metadata with a dedicated offline-managed release key and publish an SBOM plus hashes.
3. Keep any host-wide ZSEC scanner daemon outside Flatpak confinement and separate privileged code from the UI.
4. Test install, update, rollback, quarantine permissions and uninstall on supported distributions.

## Evidence required before the word antivirus

The desktop may say deterministic on-demand scanner or endpoint-security preview. It must not say complete antivirus, real-time protection, ransomware protection, zero-day protection, certified, Microsoft/Apple approved, or publish detection percentages until those exact capabilities are shipped, independently tested and supported.
