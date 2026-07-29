# Agent Instructions

## Project Status

Current milestone: version 1.1.8 is published to npm and GitHub with OIDC
provenance from the verified release workflow.

Known blockers: macOS/iOS WKWebView has not been run; the independent WebKit
engine smoke is not native Apple platform certification.

Next highest-leverage step: run the media integration smoke in a native Apple
WKWebView host when macOS hardware is available. Future npm releases use the
configured Trusted Publisher for `Bandonker/desktop-audio-proxy` and
`publish.yml`; do not add an `NPM_TOKEN` write secret.

## How To Run

- Install dependencies: `npm ci`
- CI/development verification targets Node 20, 22, and 24; Node 24 is the
  release-quality gate.
- Build all package entry points: `npm run build`
- Start the standalone proxy example: `npm run proxy:start`
- Start the browser demo: `npm run demo`

## How To Test

- Focused/full Jest suite: `npm test -- --runInBand`
- Build plus tests: `npm run test:all`
- Export/consumer checks after a build: `npm run verify:exports`
- Strict NodeNext declaration consumer check after a build: `npm run verify:types`
- Parse/compile every shipped example: `npm run verify:examples`
- Validate README inventory and local links: `npm run verify:docs`
- Lint and formatting check: `npm run lint`
- Demo HTTP smoke test after a build: `npm run test:demo-smoke`
- Electron runtime smoke: `npm run test:native:electron`
- Tauri 2/WebView2 runtime smoke: `npm run test:native:tauri`
- WebKit engine smoke: `npm run test:webkit` (first run:
  `npx playwright install webkit`)

## Verification Gates

- Server changes require focused route tests, including invalid URL, upstream failure, and stream cleanup paths.
- Client or framework-adapter changes require unit tests plus package export verification.
- Packaging changes require `npm run build`, `npm run verify:exports`,
  `npm run verify:types`, and `npm run verify:package`; `npm run build` must
  remain a clean build.
- Demo changes require `npm run test:demo-smoke`; significant UI changes also require a browser check.
- The release workflow runs Electron and Tauri on Windows, and the independent
  Playwright WebKit engine smoke on Ubuntu with Playwright's system
  dependencies. Neither substitutes for native Apple WKWebView certification.
- README/example changes require `npm run verify:examples`, `npm run
verify:docs`, and a demo smoke test; referenced screenshots must come from a
  browser-verified local build.
- README claims must distinguish the unreleased workspace from the npm
  `latest` tag, built-in proxy behavior from optional native host bridges, and
  verified standard HLS rewriting from untested third-party dialects.
- Replace screenshots from real current browser or terminal runs; do not reuse
  captures with stale versions, obsolete security language, or dynamic results
  presented as universal guarantees.

## Architecture Notes

- `src/server-impl.ts` owns the Express proxy implementation; `src/server.ts` is its public server entry.
- `src/client.ts` owns proxy selection and URL conversion.
- `src/media-element.ts` owns the race-safe controller for existing
  `<audio>`/`<video>` elements.
- `src/media-compatibility.ts` owns runtime engine detection, typed source
  selection, and media-element compatibility defaults.
- `src/tauri-service.ts` and `src/electron-service.ts` implement desktop host adapters.
- `src/browser.ts`, `src/react.ts`, and `src/vue.ts` are environment-specific public entry points.
- `rollup.config.js` defines ESM/CommonJS builds and must keep browser bundles free of Node server code.

## Safety Rules

- Treat proxy target URLs as untrusted input and fail closed on validation or DNS-safety uncertainty.
- Do not weaken loopback binding, private-network blocking, redirect validation, timeouts, or stream cleanup without explicit evidence and tests.
- Keep upstream environment proxies disabled while destination safety is active;
  otherwise the proxy can bypass connection-time DNS enforcement.
- Never log credentials embedded in target URLs or authorization headers.
- Preserve unrelated worktree changes and avoid broad formatting churn.

## Agent Handoff Notes

- Distinguish unit/build proof from native Tauri/Electron runtime proof.
- Windows Electron/Chromium, Tauri/WebView2, and Playwright WebKit media/range
  smokes passed locally on July 28, 2026; do not extend that claim to WKWebView.
- Keep `README.md`, `SECURITY.md`, package exports, and implemented behavior synchronized when public contracts change.
