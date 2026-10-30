chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (
    !message ||
    message.target !== 'offscreen' ||
    sender.id !== chrome.runtime.id ||
    sender.tab ||
    (sender.url && sender.url !== chrome.runtime.getURL('background.js')) ||
    typeof message.text !== 'string' ||
    message.text.length > 100000
  )
    return;
  const textarea = document.querySelector('#clipboard');
  textarea.value = message.text;
  textarea.select();
  try {
    respond({ ok: document.execCommand('copy') });
  } catch {
    respond({ ok: false });
  }
  textarea.value = '';
});
