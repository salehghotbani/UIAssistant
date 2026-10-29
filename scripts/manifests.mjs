export function firefoxManifest(chromium) {
  const manifest = structuredClone(chromium);
  delete manifest.minimum_chrome_version;
  manifest.background = { scripts: ['background.js'], type: 'module' };
  manifest.permissions = manifest.permissions.filter((p) => p !== 'offscreen');
  manifest.browser_specific_settings = {
    gecko_android: { strict_min_version: '142.0' },
    gecko: {
      id: 'uiassistant@uiassistant.local',
      strict_min_version: '140.0',
      data_collection_permissions: { required: ['none'] },
    },
  };
  return manifest;
}
