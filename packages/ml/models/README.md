# Local model artifacts

Copy the trained checkpoints to `identity-v1.pt` and `freshness-v1.pt` before
building the worker image. Model weights are intentionally excluded from Git by
the root `*.pt` rule; retain training metadata and SHA-256 digests with each
release.

The current local checkpoint is documented by `identity-v1.metadata.json` and
`identity-v1.metrics.json`. Freshness-v1 has matching metadata and metrics files.
Verify both before building:

```bash
sha256sum -c <(printf '%s  %s\n' \
  50ad4b0be1f74c0ad678646e83010f2438a5ae3c6475f173ae67cd9c846ca646 \
  identity-v1.pt)

sha256sum -c <(printf '%s  %s\n' \
  c2f945ad1e6028eb2d7a3765efed6f774e0e35b061e961d230793a2ddceb4b10 \
  freshness-v1.pt)
```
