# Contributing to UIAssistant

**English** · [فارسی](CONTRIBUTING.fa.md) · [Overview](README.md)

Contributions can include bug reports, browser fixes, translations, accessibility improvements, tests and documentation.

## Start here

Check [existing issues](https://github.com/salehghotbani/UIAssistant/issues) and documented limits first. Discuss substantial features or new permissions in an issue; small fixes can go directly to a pull request. Keep discussions respectful and focused on the work.

Never post credentials, private URLs, customer information or personal browsing screenshots. For security-sensitive findings, use GitHub private vulnerability reporting **if available**, or a private contact channel on the maintainer's profile. Do not assume private reporting is enabled or publish exploit details in an issue.

## Setup

```sh
git clone https://github.com/salehghotbani/UIAssistant.git
cd UIAssistant
npm ci
npm run build
```

Use Node.js 20+; Node.js 24 is tested. Load `dist/UIAssistant` in Chrome/Edge, or `dist/UIAssistant-firefox/manifest.json` temporarily in Firefox. Create a descriptive branch such as `fix/clipboard-error`. Rebuild, reload the extension and reload the fixture after changes. `npm run preview` has no extension page privileges.

## Architecture

| Path                                         | Responsibility                                                             |
| -------------------------------------------- | -------------------------------------------------------------------------- |
| `background.js`                              | Tab routing, capture queue, storage and clipboard coordination             |
| `content.js`                                 | Screenshot sampler and overlay lifecycle                                   |
| `popup.*`, `styles.css`                      | Main workspace and color interface                                         |
| `lib/browser.js`, `lib/clipboard.js`         | Firefox/Chromium API and clipboard adapters                                |
| `lib/page-tools.js`, `lib/tools-ui.js`       | Injected frontend tools and their interface                                |
| `lib/css-tools.js`, `lib/workshop-ui.js`     | CPU-based CSS calculations and bilingual workshop                          |
| `lib/icons.js`                               | Local SVG icons and coverage of dynamically rendered buttons               |
| `lib/color.js`, `lib/gradient*.js`           | Color math, parsing and export                                             |
| `lib/i18n.js`                                | Main translations; frontend/workshop strings also live in their UI modules |
| `scripts/manifests.mjs`, `scripts/build.mjs` | Browser manifests and ZIP packaging                                        |
| `tests/`                                     | Unit, compatibility and browser tests                                      |
| `vendor/`                                    | Unmodified DOMPurify distributions and license                             |

Injected `pageAnalyzer` and `pageTools` functions are serialized by the browser. Keep them self-contained: imported closures are unavailable in the target page.

## Implementation expectations

`lib/capture-container.js` captures a chosen scroller through a temporary marker and restores all ancestor scroll offsets/styles. `lib/preview-jobs.js` holds at most two RAM-only results; its internal status port must remain bound to the source document and random token, carry no pixels and accept no capture commands. Do not reintroduce a forced workspace tab or save preview pixels to storage.

`lib/capture-page.js` is serialized into the isolated top frame; keep it self-contained and return explicit success/error envelopes. `lib/screenshot-capture.js` crops/stitches in the trusted background context; `lib/screenshot-math.js` enforces tile/pixel bounds. Preserve the restoration finally path and page watchdog, document/mode authorization and trusted-event checks. New screenshot modes require browser checks for pixel accuracy and cleanup on cancellation/failure.

Read [SECURITY.md](SECURITY.md) before changing capture, messaging or storage. Keep capabilities scoped/expiring, external connections disabled, screenshot saves manual, and security regression tests intact. The documented unpatched development-tool advisory must not be hidden by downgrading or disabling audit checks.

- Preserve Firefox and Chromium behavior through the `api` adapter. Do not assume Firefox has service workers/offscreen documents.
- Discuss new permissions, networking or stored data explicitly. Keep releases free of test-only permissions and remote code.
- Restore page attributes/styles and priorities exactly. Remove listeners and overlays when finished or cancelled.
- Use DOM APIs and `textContent` for page-derived strings; existing markup uses bundled DOMPurify. Validate imports and cap expensive scans.
- Maintain English/Persian parity, RTL layout, keyboard operation, focus indicators and accessible labels.
- Keep changes focused; add behavioral tests for changed logic rather than tests that mirror implementation. Preserve third-party notices.

## Checks

```sh
npm test
npm run check
npm run format:check
npm run build
npm run lint:firefox
```

For browser APIs, clipboard, page tools and overlay changes, also run `npm run test:browser`. The harness defaults to Windows Edge; set a compatible executable when needed:

```powershell
$env:BROWSER_PATH = 'C:\path\to\msedge.exe'
npm run test:browser
```

For installed Chrome 156+, set `BROWSER_PATH` to its executable and `BROWSER_LOAD_METHOD=cdp`; this enables only the isolated test profile’s browser-level extension development protocol. Edge uses command-line loading by default. Use a browser build supporting unpacked extensions under automation. Tests use an isolated profile and local fixture, not your daily browser profile. Broad host and clipboard-read grants are test-only; never add them to distribution manifests.

Manually check toolbar `activeTab` grants, shortcuts, native EyeDropper where available, Firefox clipboard behavior, zoom/DPR, English/Persian UI, cancellation and exact undo when relevant. Record what actually ran; manifest lint is not a Firefox runtime test.

## Documentation and screenshots

English `README.md` is primary; keep `README.fa.md` current for user-facing changes. Maintain language-switch links in README, contribution and license files. English `LICENSE` remains authoritative.

Curated images live in `docs/images/`. Capture only the local fixture, never private pages or accounts. Browser tests write to ignored `artifacts/`; inspect and copy selected images into the documentation folder and update its provenance README. Do not commit profiles, temporary extensions, `node_modules/` or build archives.

## Issues and pull requests

For bugs, include browser/OS, extension version, exact steps, expected/actual behavior and a minimal public/local reproduction. For a PR, explain the problem, final behavior, relevant limits and checks; include UI screenshots when useful.

Do not force-push shared branches or rewrite unrelated history. The maintainer reviews and merges contributions; no review SLA is promised. No CLA is required. By submitting first-party changes you agree to distribute them under [MIT](LICENSE); upstream dependencies retain their licenses.

## Maintainer release checklist

1. For a version change, synchronize `manifest.json`, `package.json`, `package-lock.json` and the displayed version. Documentation-only changes may retain the current version.
2. Run applicable checks, update English/Persian docs and bilingual release notes.
3. Build browser-specific ZIPs and the source/publication kit; verify manifest version, ZIP integrity, licenses and production permissions.
4. Commit/push source to `main`; create a tag at the intended commit, such as `v0.3.0`. Do not move an already-published tag without discussion.
5. Publish the browser, source and publication-kit ZIPs plus `SHA256SUMS.txt` in GitHub Releases. Document unsigned/developer installation and Firefox testing status.
6. Verify public links and asset downloads. Store submission and Mozilla signing are separate steps; a GitHub archive is not store-signed.
