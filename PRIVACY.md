# UIAssistant privacy

**English** · [فارسی](PRIVACY.fa.md)

UIAssistant has no account system, analytics, advertising, remote code, or telemetry. It makes no network requests to an application server.

Color selections, up to 200 unique history entries, settings, custom palettes, and gradient presets are stored using the browser’s `storage.local` on the current browser profile. They are not synchronized through this extension. A last-sample record contains the page URL, tab ID, viewport, scroll position, and normalized sample coordinates so the extension can safely resample the same location. Screenshots are processed in memory and are not saved to history or transmitted.

When you explicitly analyze a page, the extension reads computed DOM styles and keeps element references in that page's isolated script context to highlight matching elements. It reads the page title and URL for the results display. Analysis is not uploaded or automatically run in the background.

Permissions:

| Permission       | Purpose                                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `activeTab`      | Temporary access to the page you invoke UIAssistant on, including screenshots.                                                             |
| `scripting`      | Inject the sampler and computed-color analyzer on request.                                                                                 |
| `storage`        | Save settings, colors, palettes and gradients locally.                                                                                     |
| `offscreen`      | Chromium only: use a local offscreen document for clipboard access after the popup closes. Firefox uses its background event page instead. |
| `clipboardWrite` | Copy the color or code you select. The extension does not read the clipboard.                                                              |

The distribution declares no persistent host permissions, content scripts on every page, or externally connectable messaging. The native screen EyeDropper is started only by a user click and follows browser-provided selection and cancellation controls.

Clear history from Color history, delete custom palettes and presets from their tools, or uninstall the extension to remove its stored profile data. The development preview uses `localStorage` on the preview origin instead of extension storage. Development browser-test artifacts are local project files and are excluded from distribution.

Frontend tools read computed styles, element identifiers and geometry only when invoked. The last selected element’s CSS/typography or two-element measurement is saved locally so the popup can show the result after selection. Audits and token reports remain in the open interface and page context. Reference images are decoded locally, remain in the target page’s memory and are removed with Restore page or page reload. Direction previews are temporary DOM changes, restored on request; no page content or reference image is uploaded.
