## What

<!-- One sentence: what does this PR do? -->

## Issue

Closes #

## How to test

1. 
2. 

## Checklist

- [ ] CI passes
- [ ] No secrets committed (`.env`, keys, tokens)
- [ ] RLS / `tenant_id` considered (if DB touched)
- [ ] No sync CNN inference in API handlers (if scan/ML touched)
- [ ] Redis keys namespaced `tenant:{tenant_id}:...` (if cache/queue touched)

## Screenshots / demo

<!-- Optional: UI changes, API response, etc. -->
