/**
 * shared/vimeo-sdk.js
 * Lazy-loads the Vimeo Player SDK from Vimeo's CDN (rather than a bundled
 * npm version) so newer SDK methods like selectAudioTrack() are guaranteed
 * to be available. Shared by video-toggle.js (frontend live track
 * switching) and video-quote/index.js (editor-side track validation).
 */
let vimeoSdkPromise = null;

export function ensureVimeoSdk() {
  if (vimeoSdkPromise) return vimeoSdkPromise;

  vimeoSdkPromise = new Promise((resolve, reject) => {
    if (window.Vimeo?.Player) {
      resolve(window.Vimeo);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://player.vimeo.com/api/player.js";
    script.async = true;
    script.onload = () => resolve(window.Vimeo);
    script.onerror = reject;
    document.head.appendChild(script);
  });

  return vimeoSdkPromise;
}
