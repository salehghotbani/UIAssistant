# Publication QA / کنترل کیفیت انتشار

Version: **0.8.0**. Automated results are recorded in the release notes after the final run. Packaging/manifest validation is separate from actual browser execution or store approval.

| Area             | Automated coverage                                                                                                                                                          | Remaining owner/manual check                                                                                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chrome           | Full isolated Chrome 156 suite, including all capture modes, CSS tools, clipboard, security denials and EN/FA layouts; loaded via browser-level CDP in a fresh test profile | Real toolbar popup dismissal, shortcut assignment, OS save dialog and native EyeDropper                                                                                                   |
| Edge             | Full isolated Edge suite: page tools, clipboard, all capture modes, popup recovery, EN/FA layouts and CSS generators                                                        | Real toolbar popup dismissal, OS save dialog and shortcut conflicts in a clean user profile                                                                                               |
| Firefox          | Native namespace/event-page/clipboard compatibility tests; `web-ext` validation of Firefox package                                                                          | Actual Firefox desktop 140+ installation, color pick/copy, all capture modes including internal scrollers, event-page preview lifetime, file export and shortcuts; Mozilla signing/review |
| Store assets     | PNG dimension checks, own-vector artwork, actual 1280×800 fixture screenshots                                                                                               | Inspect selected screenshots in each store's preview; update any rejected image/metadata fields                                                                                           |
| Privacy/security | Exact trusted sender checks, external/page denial, temporary capability expiry, navigation revocation and bounded screenshot previews                                       | Check final dashboard disclosures against this version's privacy policy and each store's definitions                                                                                      |

Chrome and Edge executed the integration suite; no actual Firefox runtime or store approval is implied by these tests. Do not mark manual checks complete without running them. Android is not validated or promoted. Chrome submission is explicitly on hold.

Firefox/Edge public submission also remains pending owner enrollment/contact requirements and the checks above. The project does not request or embed a personal email and does not bypass store-required contact/identity fields.

## فارسی

تست خودکار Edge و اعتبارسنجی فایل‌ها، جای تست واقعی Chrome و Firefox یا تأیید فروشگاه را نمی‌گیرد. موارد دستی جدول باید روی مرورگر مقصد بررسی شوند؛ نصب دائمی Firefox به امضای Mozilla نیاز دارد. ارسال Chrome فعلاً متوقف است. حساب ناشر و اطلاعات اجباری فروشگاه را مالک تکمیل می‌کند؛ ایمیل شخصی در پروژه درج نشده است.
