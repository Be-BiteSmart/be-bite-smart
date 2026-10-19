/** Core fields shared by all download card block types. */
export const coreAttributes = {
  episodeNumber: { type: "string", default: "" },
  contentType: { type: "string", default: "" },
  episodeTitle: { type: "string", default: "" },
  blockId: { type: "string", default: "" },
};

/** PDF inline viewer fields. */
export const pdfAttributes = {
  pdfUrl: { type: "string", default: "" },
  pdfUrlEs: { type: "string", default: "" },
  trackingId: { type: "string", default: "" },
};

/** Controls which PDF actions are displayed by blocks that expose the setting. */
export const pdfDisplayModeAttribute = {
  pdfDisplayMode: { type: "string", default: "view-and-download" },
};

/** Direct download link fields (Drive, Dropbox, R2, etc.). */
export const downloadLinkAttributes = {
  downloadUrlEn: { type: "string", default: "" },
  downloadUrlEs: { type: "string", default: "" },
};

/** Optional page link for the downloaded resource's landing page. */
export const resourcePageLinkAttributes = {
  resourcePageUrl: { type: "string", default: "" },
};

export function attributesForFeatures(features) {
  return {
    ...coreAttributes,
    ...(features.pdf ? pdfAttributes : {}),
    ...(features.pdfDisplayMode ? pdfDisplayModeAttribute : {}),
    ...(features.downloadLinks ? downloadLinkAttributes : {}),
    ...(features.resourcePageLink ? resourcePageLinkAttributes : {}),
  };
}
