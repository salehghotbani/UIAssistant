# Reviewer notes / یادداشت بازبین

Publisher: **saleh ghotbani**. No login, server, payment, credentials, native helper or special hardware is required. Load the browser-specific extension package and open an ordinary HTTP(S) page. Browser/store-internal pages are intentionally excluded.

## Reproduce the package

Extract `UIAssistant-source.zip` into an empty folder. Use Node.js 24 (locally checked on Windows; build is portable built-in Node code). Run:

```sh
node scripts/build.mjs
```

No package installation or network is required for the build. Generated ZIPs/unpacked folders are under `dist/`. The build copies explicit application inputs, generates deterministic PNG icons and the Firefox manifest, and writes deterministic uncompressed ZIPs. No first-party JS is bundled, minified or obfuscated. Filenames, ordering and ZIP date are deterministic. Do not modify files or normalize vendored bytes before comparison.

DOMPurify 3.4.17 is the only runtime third-party code: `vendor/purify.es.mjs` and `vendor/purify.min.js` are unmodified npm distributions. Their upstream readable JS and TypeScript are supplied at `review/DOMPurify/` in the source archive; original licenses are included. The pinned npm lockfile provides integrity/provenance. UIAssistant's build does not rebuild or change these upstream files. To verify them against npm, optionally run `npm ci --ignore-scripts` and compare `node_modules/dompurify/dist/` with `vendor/`. Do not run the upstream package's own prepare/build scripts as part of UIAssistant reproduction.

Optional development checks after `npm ci`: `npm test`, `npm run check`, `npm run format:check`, `npm run lint:firefox`. `npm run test:browser` uses isolated headless Edge on Windows; `BROWSER_PATH` can point to a compatible Chromium. Installed Chrome 156 was tested with `BROWSER_LOAD_METHOD=cdp`, which enables the extension development protocol only in a newly created test profile. The harness adds host/clipboard-read access only to its test copy; these permissions are absent from release packages. Browser integration profiles and fixture screenshots are not runtime inputs. `npm run package:stores` creates source/kit ZIPs and checksums; it requires the pinned development dependency to supply readable upstream sources.

## Exercise features

1. Open the toolbar popup; pick a page color. Verify automatic copy and HEX/RGB editing. Save a palette, import/export JSON and edit a gradient.
2. Frontend tools: select Element inspector/Typography, click an element, use the two-element ruler, and run layout/contrast/accessibility/token scans. Results are heuristics; some cases explicitly need manual review. Restore page removes temporary layers/direction changes.
3. CSS workshop: use the unit/fluid/shadow tools and new responsive/fixed Grid, radius and easing tools. Invalid values disable Copy. Motion plays only on request and respects reduced-motion preferences.
4. Screenshots: choose a mode, inspect the target URL/title and confirm within 30 seconds. Test viewport, drag-selected area, whole document and a chosen internal scroller. The browser may close its native popup; reopening the toolbar icon retrieves the short-lived RAM result. Save PNG/JPEG or delete it. Esc/cancel restores scroll/styles. Capture requires an active visible source page; navigation invalidates it.
5. Switch English/Persian; inspect RTL layout and compact/expanded layouts. Settings and palettes persist locally. No external network traffic is required by the extension.

The source-page preview-status port has a random token/document binding and carries no pixels or capture commands. Screenshot messages are accepted only from the exact trusted top-level extension UI, with a single-use mode-bound confirmation. There is no web-accessible resource, external capture API or native messaging bridge. Browser/admin privileges are outside that boundary. See `SECURITY.md` for limitations and the disclosed development-only dependency advisory.

## فارسی

برای بازسازی آفلاین، سورس ZIP را باز و با Node.js 24 دستور `node scripts/build.mjs` را اجرا کنید؛ نصب وابستگی یا شبکه برای ساخت لازم نیست. فایل‌های DOMPurify بدون تغییر توزیع می‌شوند و سورس خوانا/مجوز آن‌ها برای بررسی در پوشهٔ `review/DOMPurify` قرار دارد. ابزارهای رنگ، بررسی صفحه، کارگاه CSS، چهار حالت عکس، لغو/بازگردانی و رابط فارسی/انگلیسی مطابق مراحل بالا بررسی شوند. هیچ حساب یا رمز تستی لازم نیست. بستهٔ Firefox قبل از نصب دائمی به امضای Mozilla نیاز دارد.
