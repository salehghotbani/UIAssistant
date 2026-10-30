# Store privacy and permissions

Single purpose: help frontend developers inspect and recreate the visual details of a chosen webpage using local color, layout, CSS and screenshot tools.

| Permission                     | Why it is needed                                                                                                                                                |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `activeTab`                    | Temporary access to the page the user chooses, including explicitly confirmed visible-tab screenshot capture. No persistent all-sites grant.                    |
| `scripting`                    | Inject isolated local inspectors, color tools, geometry selectors and scroll/restore helpers into that chosen page.                                             |
| `storage`                      | Save settings, palettes, color history and the latest inspection; hold short-lived authorization metadata. Screenshot pixels are not stored here.               |
| `clipboardWrite`               | Copy selected color values and user-requested CSS/text. No clipboard reading.                                                                                   |
| `offscreen` (Chrome/Edge only) | Local offscreen clipboard-write document for the background worker. It does not capture the desktop or access remote content. Firefox uses its background page. |

Remote code: **none**. No CDN, remote scripts, fetch/XHR/WebSocket endpoints or executable downloads. DOMPurify is included locally and unchanged. No telemetry, user accounts, ads, sale/transfer of data or external capture interface.

Data processing: the user's chosen page URL/title, rendered pixels, computed DOM/CSS and locally chosen reference images are processed on-device for requested tools. Palette/history/inspection data may persist in extension-local storage. Screenshot jobs/previews are RAM-only, at most two, expire up to five minutes from job creation, and are removed on source navigation/closure or extension/browser restart. Manual file export is the user's action. Reference images are not uploaded. See the full [English privacy policy](../../PRIVACY.md) and [Persian policy](../../PRIVACY.fa.md).

Store disclosure forms distinguish data accessed locally from data collected/transmitted off-device. This extension sends no such user data to the publisher or any third party. Use the store's current definitions when answering the form; do not claim it never accesses website content. Review final data-use certifications as the account owner. Firefox declares `data_collection_permissions.required: ["none"]` because nothing is transmitted off-device.

Support URL: https://github.com/salehghotbani/UIAssistant/issues. No public support email is provided. Store-required private/account contact information must be handled by the owner; it is not in this kit.

## فارسی

هدف واحد افزونه، کمک به بررسی و بازسازی جزئیات ظاهری صفحهٔ انتخابی برای توسعه‌دهندهٔ فرانت‌اند است. مجوزها برای دسترسی موقت صفحه، اجرای ابزار محلی، ذخیرهٔ تنظیمات/پالت و نوشتن متن در کلیپ‌بورد هستند. کلیپ‌بورد خوانده نمی‌شود و مجوز دائمی همهٔ سایت‌ها وجود ندارد.

افزونه محتوای سایت و پیکسل‌ها را برای ابزار درخواستی روی دستگاه پردازش می‌کند؛ هیچ داده‌ای به ناشر یا شخص ثالث نمی‌فرستد. ادعای «عدم ارسال/جمع‌آوری خارج دستگاه» به معنی «عدم دسترسی به محتوای صفحه» نیست. فرم نهایی باید با تعریف فعلی فروشگاه و سیاست کامل حریم خصوصی سازگار باشد. پشتیبانی عمومی از طریق GitHub است؛ اطلاعات اجباری حساب فروشگاه را فقط مالک تکمیل می‌کند.
