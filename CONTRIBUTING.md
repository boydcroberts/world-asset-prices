# Contributing to World Asset Prices

## Setup

1. Use Node.js `24.x` to match production and CI.
2. Install dependencies: `npm install`
3. Start dev server: `npm run dev`
4. Run validation checks before opening a PR: `npm run check`

## Branching and commits

1. Create a feature branch from `main`.
2. Use clear commit messages in imperative form, for example: `Add review-age validation for private-company marks`.
3. Keep commits focused and avoid unrelated changes in the same PR.

## Pull requests

1. Fill out the pull request template completely.
2. Link related issues using `Fixes #<id>` when applicable.
3. Include screenshots for UI changes.
4. Run `npm run test:e2e` for UI-affecting changes.
5. Ensure CI is green before requesting review.

## Code standards

- Keep TypeScript strict-mode safe.
- Prefer small, composable functions.
- Avoid introducing dependencies unless they provide clear long-term value.
- Keep README and docs updated when behavior changes.

## Reporting issues

- Use the GitHub issue templates.
- Provide steps to reproduce, expected behavior, and actual behavior.
