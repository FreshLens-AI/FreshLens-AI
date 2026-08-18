# Local model artifacts

Copy the trained identity checkpoint to `identity-v1.pt` before building the
worker image. Model weights are intentionally excluded from Git by the root
`*.pt` rule; retain the training metadata and SHA-256 digest with each release.

The current local checkpoint is documented by `identity-v1.metadata.json` and
`identity-v1.metrics.json`. Verify it before building:

```bash
sha256sum -c <(printf '%s  %s\n' \
  50ad4b0be1f74c0ad678646e83010f2438a5ae3c6475f173ae67cd9c846ca646 \
  identity-v1.pt)
```
