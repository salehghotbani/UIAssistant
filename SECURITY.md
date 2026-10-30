# Security policy and review

**English** · [فارسی](SECURITY.fa.md)

## Scope

UIAssistant is a browser extension, not an operating-system security boundary. Its screenshot and sampling interfaces are intended for the user of the current browser profile. This review covers the extension's messaging, screenshot authorization, injected tools, local storage, content policy and dependency advisories. It is an implementation review with automated regression tests, not an independent penetration-test certification.

## Controls in v0.8.0

- External messaging is explicitly disabled with empty `externally_connectable.ids` and `matches`. There are no external-message listeners, native-messaging bridge, localhost service, debugger API or web-accessible extension pages.
- Privileged commands require this extension's browser-supplied sender ID, the exact top-level `popup.html` URL and an active document. Checking an extension-origin prefix alone is no longer sufficient.
- Screenshot capture has a two-step interface with real click/keyboard activation. Confirmation issues a random, **single-use 30-second** capability bound to the requesting workspace, target tab, window, document and screenshot mode. After consumption, a full-page/region operation has a separate two-minute deadline; it cannot be replayed or used as a general capture endpoint. Preparing does not capture pixels. A replay, wrong sender, changed tab, navigation or expired capability fails closed.
- The window-scoped screenshot API is serialized and rate-limited. The active tab, page URL and isolated document identity are checked before capture, after the wait, and after the API returns. A changed target causes pixels to be discarded. This check cannot make the browser's window-scoped API atomic, but prevents delivering a detected mismatched capture.
- Eyedropper refreshes and picked results require a separate **two-minute** page-bound capability; resampling uses 30 seconds. Completion/cancellation/navigation/tab closure revokes access. Requests without a valid session cannot request screenshot pixels. Inspector result/copy messages require a five-minute tool capability.
- Synthetic page pointer/keyboard events cannot commit a color, refresh a capture or select inspector targets. These checks do not distinguish a human from privileged OS/browser automation.
- Local and session storage are restricted to trusted extension contexts where the browser supports `setAccessLevel`. Capabilities are kept in `storage.session` rather than disk-backed local storage; tokens are not exposed in DOM attributes or page messages. Screenshots are never placed in extension storage.
- Screenshot status, preview retrieval and deletion accept only the exact trusted UI sender. Up to two images remain RAM-only for up to five minutes from job creation, independent of the popup lifetime. A random-token, source-document-bound internal port reports status only: no pixels and no capture commands. Expiry, deletion or source navigation/closure destroys the cache and connection. Forced background termination loses unsaved results.
- The Chromium clipboard offscreen page accepts bounded text only from the extension background context, not arbitrary content-script messages. Settings accept an allowlist of keys and values.
- CSP blocks runtime network connections, object embedding, framing of extension pages and base-URL changes. Scripts remain local. Inline styles are allowed for the existing interactive style controls; inline JavaScript and dynamic evaluation are not allowed.
- Page-derived text is rendered through DOM text APIs or bundled DOMPurify. Production packages keep temporary `activeTab` access and do not request persistent host access, desktop capture, clipboard read or automatic-download permissions.

These controls follow [Chrome extension security guidance](https://developer.chrome.com/docs/extensions/develop/security-privacy/stay-secure), [external connection rules](https://developer.chrome.com/docs/extensions/reference/manifest/externally-connectable) and [storage access controls](https://developer.chrome.com/docs/extensions/reference/api/storage).

## Residual limits

- Malware, an administrator, a compromised browser/extension context, a process able to alter the unpacked extension or control its DevTools, and privileged UI automation are outside this boundary. Such software may capture the screen through its own OS/browser permissions or operate the extension as the user. This extension cannot guarantee that no other software can ever take a screenshot.
- Pixel sampling requires image data in this extension's isolated content-script context. Session and document binding restrict that flow; a fully compromised extension context is not protected by these checks. Do not treat a closed shadow root or a hidden token as protection against a compromised extension.
- Screenshots cover the viewport, a mouse-selected area, or a stitched main scrolling document. Each tile can include cross-origin content rendered inside it; Scrollable element captures one chosen nested scroller, not every descendant or iframe. The injected selector returns geometry only; all image processing stays in the trusted background. There is no desktop capture. Full-page limits are 64 tiles, 24 megapixels, 32,760 px per side, 24 MB PNG and two minutes. Page dimensions, zoom and scroll are rechecked for each tile. Dynamic/virtualized pages can fail or need manual capture. Temporary scroll/visibility styles are restored in a finally path, with a page watchdog as a fallback. Inspect the preview before saving; downloaded files are ordinary local files accessible according to OS permissions.
- Chrome/Edge behavior is tested locally. Firefox packages pass `web-ext` validation; actual Firefox runtime and native screen EyeDropper remain untested here. Storage restrictions are feature-detected for browser compatibility.

## Dependency review — 2026-10-30

`npm audit` reports one underlying **low-severity** advisory, [GHSA-gcqx-w48m-w2h4 / CVE-2026-93753](https://github.com/advisories/GHSA-gcqx-w48m-w2h4), through `web-ext → addons-linter → deepmerge 4.3.1` (three affected package entries). The advisory and npm registry list no patched current version. This chain is development tooling only and is excluded from both extension ZIPs. DOMPurify 3.4.17 is bundled unchanged; no advisory against it was reported by this audit.

The advisory remains unresolved in the developer dependency tree. We did not suppress it or downgrade the validator to an obsolete major release. Run development tools only on trusted project inputs, and check for an upstream fix before future releases. A clean application review must not be described as a clean full dependency audit.

## Validation and reporting

Run `npm test`, `npm run check`, `npm run test:browser`, `npm run build` and `npm run lint:firefox`. Security regressions cover exact sender matching, frames, malformed settings, grant expiration/replay/revocation, worker restart and capture races. Browser tests add a second extension that attempts external screenshot requests, forged content-script requests, synthetic page events, trusted-only storage, manual PNG/JPEG exports and same-URL reload rejection. Preview tests cover expiry, bounded memory, wrong tab/job IDs and deletion; browser coverage closes/reopens the compact popup during nested capture and checks all quadrant pixels, original scroll/styles and downloads. Full-page/region tests additionally cover cropped pixels at 125% zoom, two-axis stitching, exact style/scroll restoration on success/cancellation/failure and inactive-tab rejection.

If GitHub private vulnerability reporting is available, use it for sensitive reports. Do not post screenshots, tokens, credentials or private page contents in public issues. Include the browser/version, UIAssistant version, minimal reproduction and expected/observed behavior with private information removed. Current fixes target the latest release.
