chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message.target !== 'offscreen' || sender.id !== chrome.runtime.id) return;
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
