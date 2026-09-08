## Summary

<!-- What user-visible problem does this change solve? -->

## Scope and authority

- Affected area: <!-- UI, timeline, renderer, animation, persistence, backend, infrastructure, docs -->
- Canonical authority reused: <!-- hook, utility, evaluator, renderer, serializer, or other -->
- Out of scope:

## Verification

- [ ] `npx tsc --noEmit`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] Relevant Playwright or `npm run qa:v6` checks
- [ ] Browser verification for UI/rendering changes
- [ ] Screenshots attached for visual changes

## Compatibility and risk

- [ ] Legacy import/export and saved-project behavior preserved
- [ ] No parallel evaluator, clock, serializer, history store, clipboard, or compositor introduced
- Regression risk and remaining limitations:

## Review checklist

- [ ] Scope is focused; unrelated refactors are excluded
- [ ] Tests defend observable behavior or compatibility where applicable
- [ ] No secrets, private files, or generated artifacts are included
- [ ] Commit messages follow Conventional Commits

## Related issues

<!-- Fixes #123 or Related to #123 -->
