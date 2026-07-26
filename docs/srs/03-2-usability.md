# 3.2 Usability requirements

Issue: [#39](https://github.com/FreshLens-AI/FreshLens-AI/issues/39). Priority: Must.

### NFR-U-001 Scan in few steps (Must)

A signed-in vendor shall be able to complete capture, confirm quantity, and submit in no more than four primary screens or steps (excluding OS permission dialogs).

### NFR-U-002 Clear scan status language (Must)

While a scan is `pending` or `processing`, the UI shall say that classification is in progress and must not imply a final freshness result. On `failed`, the UI shall show a non-technical error and allow retry of a new scan.

### NFR-U-003 Classification readability (Must)

Completed classifications shall be shown with clear labels corresponding to `fresh`, `medium`, and `spoiled` (user-facing wording may capitalize or phrase equivalently, for example "Fresh").

### NFR-U-004 Empty states (Must)

Scan list and alert list shall show an explicit empty state when there are no items, rather than a blank or broken screen.

### NFR-U-005 Auth error feedback (Must)

Invalid credentials or expired sessions shall produce a visible message and a path back to sign-in. The app shall not silently ignore 401 responses on protected actions.

### NFR-U-006 Camera permission handling (Must)

If camera permission is denied, the mobile app shall explain that scanning requires camera access and provide a path to settings or a gallery fallback if gallery is supported for demos.

### NFR-U-007 Admin navigation (Should)

The web admin UI shall expose primary destinations (tenants, catalogue, analytics) in a persistent navigation pattern suitable for a desktop viewport.

### NFR-U-008 Accessibility baseline (Should)

Interactive controls shall have visible labels. Status must not be conveyed by color alone; pair color with text for freshness states.
