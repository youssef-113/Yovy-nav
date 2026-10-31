// Copied image / screenshot: a toast with the thumbnail; clicking it saves the image to the
// Pictures\YOVY-NAV folder and puts it on the Shelf, ready to drag into any app.
(() => {
  bridge.onScreenshot((s) => {
    $('.t-shot').src = s.thumb;
    const portrait = s.height > s.width;
    showToast('shot', portrait ? 'Image copied' : 'Screenshot copied', feat('tabShelf') ? 'Add to Shelf' : '', 0, 6000);
    if (feat('tabShelf')) state.toastAction = () => bridge.shotToShelf();
  });
  bridge.onShotSaved((s) => showToast('shot-saved', s.name, 'On the Shelf', 0, 2600));
})();
