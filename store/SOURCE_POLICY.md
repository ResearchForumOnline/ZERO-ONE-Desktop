# ZERO ONE source and release policy

ZERO ONE Desktop's public client repository is licensed under Apache-2.0. The source may be inspected, modified, and redistributed subject to that licence.

## Public open-source boundary

- Desktop renderer, Electron policy shell, tests, CI, documentation, and reviewed public assets.
- Versioned interfaces for optional external engines.
- No credentials, signing material, production access, private datasets, or unpublished research.

## Proprietary boundary

Experimental ZMath research and cipher implementations remain separate and are not compiled into the public Electron client. A separately delivered local binary can still be reverse engineered, so production designs should prefer a narrow authenticated service or a signed, independently reviewed component over claims of invisibility.

`"private": true` in `package.json` prevents accidental npm registry publication; it does not change the Apache-2.0 source licence.

## Release rules

1. Build only from a reviewed commit and clean dependency lock.
2. Keep credentials, private keys, unpublished research, and server configuration out of source and artifacts.
3. Verify the exact ZSEC dependency identity and package inventory.
4. Sign the installer and every shipped executable before public binary distribution.
5. Publish immutable hashes, provenance, limitations, and tested platform scope.
6. Never describe an unsigned source preview as Store-approved, certified antivirus, real-time protection, or quantum encryption.
