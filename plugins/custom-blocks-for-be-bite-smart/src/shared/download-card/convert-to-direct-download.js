/** Convert Google Drive, Dropbox, and R2 URLs to browser-friendly download URLs. */
export function convertToDirectDownload(url) {
  if (!url) return null;
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (driveMatch) {
    return "https://drive.google.com/uc?export=download&id=" + driveMatch[1];
  }
  if (url.includes("dropbox.com")) {
    if (url.includes("?dl=")) return url.replace(/\?dl=0/, "?dl=1");
    return url + (url.includes("?") ? "&dl=1" : "?dl=1");
  }
  if (url.includes("r2.dev")) {
    return url.replace(
      "pub-280e86f4e3a9426085703634463f9bc7.r2.dev",
      "bbs-downloads.janet-spellman.workers.dev",
    );
  }
  return url;
}
