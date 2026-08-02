# ZMath Secure boundary

ZMath Secure is ZERO ONE's security-policy and compatibility layer. The open-source desktop currently composes audited platform protections; it does not ship or claim an experimental new cipher.

## Active protections

- Remote owned workspaces must use HTTPS.
- The only permitted cleartext model endpoint is loopback (`127.0.0.1` or `localhost`) on the local OpenZero port.
- URL credentials, unexpected query data, and unapproved origins are rejected.
- OpenZero tokens use Electron `safeStorage`; insecure fallback storage is refused.
- Windows disk-protection status is read without changing the machine.
- The only disk-encryption action opens Windows' own Device encryption settings.

## Private extension boundary

Unpublished ZMath algorithms, research notes, keys, datasets, and experimental implementations are deliberately absent from Git history and release artifacts. A future engine may implement a versioned, least-privilege interface, but it must pass cryptographic review, threat modelling, interoperability testing, update signing, rollback, and incident-response gates before it can be described as active protection.

The public app must fail safely when such an engine is absent. Standard TLS and operating-system encryption remain the protection baseline.

## Full-disk encryption consent

Disk encryption is opt-in and managed by the operating system. ZERO ONE must never enable it silently, export or retain a recovery key, or imply that enabling it secures an already-compromised running session. Users should confirm recovery-key custody and power availability before beginning initial encryption.
