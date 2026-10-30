# Store publication kit

Publisher/display name: **saleh ghotbani**. Primary language: English; second language: Persian. Public support: [GitHub Issues](https://github.com/salehghotbani/UIAssistant/issues). No personal/contact email is supplied in these files. Free, MIT, no purchases, accounts, ads, telemetry or remote code.

This kit prepares a submission; it is not a store approval or signed release. **Chrome is on hold: do not upload or submit it until the owner asks.** No store account, signature or publisher credentials are bundled.

## Files

| File                          | Destination                                                                                   |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| `UIAssistant-chrome.zip`      | Chrome Web Store upload, prepared only; currently on hold                                     |
| `UIAssistant-edge.zip`        | Microsoft Edge Add-ons upload                                                                 |
| `UIAssistant-firefox.zip`     | Firefox AMO upload; unsigned until Mozilla accepts/signs it                                   |
| `UIAssistant.zip`             | Backward-compatible Chrome/Edge unpacked developer installation                               |
| `UIAssistant-source.zip`      | Matching reviewer source, lockfile, offline build instructions and readable DOMPurify sources |
| `UIAssistant-publish-kit.zip` | This documentation, listing text and image assets                                             |
| `SHA256SUMS.txt`              | SHA-256 of all six archives                                                                   |

The release archives are alongside this kit in [GitHub Releases](https://github.com/salehghotbani/UIAssistant/releases/latest). Upload only the browser-specific extension ZIP as the extension package. The source/kit ZIPs are not installable extensions. There are no browser-store listing URLs yet.

## Listing and review

- Copy [English listing](listing.en.md) and [Persian listing](listing.fa.md) into the appropriate language fields. See [structured metadata](listing.json) for URLs and short summaries. Publisher name is not an assertion that that name is available in a store.
- Public privacy URL: <https://github.com/salehghotbani/UIAssistant/blob/main/PRIVACY.md>. Persian: <https://github.com/salehghotbani/UIAssistant/blob/main/PRIVACY.fa.md>.
- Use [permission/data explanations](PRIVACY-FIELDS.md) and [reviewer instructions](REVIEWER.md); do not invent credentials or certify unchecked statements.
- Chrome: `assets/store-icon-128.png` has transparent padding around square artwork. Choose the five `en-*-1280x800.png` screenshots; Persian has an equivalent set. Promo images are optional.
- Edge: `assets/edge-logo-300.png`, up to five prepared screenshots per language, optional 440×280 and 1400×560 promotional tiles.
- Firefox: `assets/firefox-icon-64.png` or the 128px icon. Upload the matching source archive when requested. The `uiassistant@uiassistant.local` value is a stable, email-shaped extension ID, **not a mailbox or contact email**. Keep it unchanged across updates. Select desktop platforms only; Android is not validated.

All ten screenshots are real captures of the extension with local fixture data in Edge at 1280×800. They demonstrate shared UI; they are not evidence of execution in Firefox or Chrome. Promotional graphics use the project's own SVG and text. No stock media, browser logos or personal browsing data are used. Regenerate screenshots with `npm run test:browser`, then `node scripts/generate-store-assets.mjs` (Windows Edge by default; `BROWSER_PATH` can select a compatible local Chromium).

## Submission status and remaining steps

All three packages and listing assets can be prepared without an email. **Store publishing accounts cannot be created or verified without satisfying each store's contact requirements.** Support website fields can use GitHub; required publisher/account contact fields cannot be replaced with fabricated values. No personal email will be entered or exposed by this project.

1. Review [QA](QA.md), run the remaining manual checks in each actual browser, and inspect each selected screenshot.
2. Firefox: sign in to the owner's AMO account, upload the Firefox ZIP and source, use the listing/reviewer text, and obtain Mozilla signing/review. Do not substitute the Chrome ZIP or claim that the unsigned ZIP installs permanently.
3. Edge: use the owner's verified Partner Center developer account, upload the Edge ZIP, fill listing/privacy fields, and complete certification. Select only markets for which the owner is eligible; do not bypass enrollment restrictions.
4. Chrome remains prepared only, without an account or submission, as requested.

The owner must complete required account identity, agreements and contact fields themselves if they choose to publish. Store review/signing and actual availability remain pending. GitHub release availability is separate from browser-store publication.

## Rebuild

Run `node scripts/build.mjs` for offline browser packages. After installing development dependencies, `npm run package:stores` prepares source/kit archives and checksums. It verifies the locked DOMPurify version and bundled bytes. A runtime ZIP contains only explicit allowlisted application files; tests, profiles, source-review extras and developer dependencies are excluded. See [reviewer instructions](REVIEWER.md) for reproduction.

## Official references

Requirements were checked on 2026-10-30. Dashboard validation at submission remains authoritative.

- [Chrome image dimensions](https://developer.chrome.com/docs/webstore/images), [privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy/), [account/contact requirements](https://developer.chrome.com/docs/webstore/set-up-account).
- [Edge submission and listing requirements](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension), [developer account enrollment](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/create-dev-account).
- [Firefox submission](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/), [matching source submission](https://extensionworkshop.com/documentation/publish/source-code-submission/), [listing guidance](https://extensionworkshop.com/documentation/develop/create-an-appealing-listing/).

## فارسی

نام عمومی ناشر **saleh ghotbani** است و پشتیبانی از طریق GitHub Issues انجام می‌شود. ایمیل شخصی/تماس در فایل‌های انتشار درج نشده است. شناسهٔ داخلی Firefox با ظاهر ایمیل، آدرس تماس نیست و برای حفظ هویت افزونه تغییر نکرده است.

برای هر سه مرورگر ZIP جدا، متن معرفی انگلیسی/فارسی، تصاویر واقعی، آیکون، متن حریم خصوصی، توضیح مجوزها و سورس قابل بازسازی آماده می‌شود. Chrome فعلاً **نباید ارسال شود**. فایل Firefox هنوز امضای Mozilla ندارد و هیچ‌یک از بسته‌ها به معنی تأیید فروشگاه نیستند.

برای انتشار واقعی Firefox و Edge، حساب مالک و الزامات هویت/تماس فروشگاه لازم است؛ این پروژه ایمیل وارد نمی‌کند و اطلاعات ساختگی جایگزین آن نمی‌شود. ابتدا موارد باقی‌ماندهٔ تست واقعی مرورگر در [QA](QA.md) بررسی شود، سپس فایل مخصوص همان مرورگر و متن‌های آماده در پنل فروشگاه استفاده شوند. انتشار GitHub با انتشار در فروشگاه مرورگر متفاوت است.
