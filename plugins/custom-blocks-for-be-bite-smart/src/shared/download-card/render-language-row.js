import { renderPdfButton } from "../../components/pdf-button";

/** English UI copy only — TranslatePress handles Spanish on the front end. */
function labelsForLang(lang) {
  const tag = lang === "es" ? "ES" : "ENG";
  return {
    viewPdf: "View PDF (" + tag + ")",
    hidePdf: "Hide PDF (" + tag + ")",
    download: "Download (" + tag + ")",
    dataLang: lang === "es" ? "es" : "en",
  };
}

/**
 * One language row: View PDF + Download when a PDF is uploaded (pdf-toggle pattern),
 * or a single tracked download link when only an external URL is set.
 * Returns null when that language has no resources (row hidden).
 */
export function renderLanguageRow(
  wp,
  { lang, pdfUrl, downloadUrl, targetId, groupId, features },
) {
  const labels = labelsForLang(lang);
  const hasPdf = Boolean(features.pdf && pdfUrl);
  const externalUrl = features.downloadLinks ? downloadUrl : null;

  if (!hasPdf && !externalUrl) {
    if (features.comingSoonWhenEmpty && features.pdf) {
      const isOutline = lang === "es";
      return wp.element.createElement(
        "div",
        { className: "download-card-language-row" },
        wp.element.createElement(
          "button",
          {
            className:
              "ecd-toggle block-toggle-btn ecd-toggle--coming-soon" +
              (isOutline ? " is-style-outline ecd-toggle--outline" : ""),
            disabled: true,
            "aria-disabled": "true",
          },
          wp.element.createElement(
            "span",
            { className: "btn-label" },
            "Coming Soon (" + (lang === "es" ? "ES" : "ENG") + ")",
          ),
        ),
      );
    }
    return null;
  }

  const rowChildren = [];

  if (hasPdf) {
    rowChildren.push(
      renderPdfButton(
        wp,
        "ecd-toggle block-toggle-btn",
        targetId,
        groupId,
        labels.viewPdf,
        labels.hidePdf,
        labels.dataLang,
      ),
      wp.element.createElement(
        "a",
        {
          href: pdfUrl,
          download: true,
          className: "block-toggle-btn is-style-outline",
        },
        labels.download,
      ),
    );
  } else if (externalUrl) {
    const downloadClass =
      lang === "es"
        ? "ecd-toggle block-toggle-btn is-style-outline ecd-toggle--outline ecd-toggle--download"
        : "ecd-toggle block-toggle-btn ecd-toggle--download";

    rowChildren.push(
      wp.element.createElement(
        "a",
        {
          href: externalUrl,
          className: downloadClass,
          download: true,
          "data-lang": labels.dataLang,
        },
        wp.element.createElement(
          "span",
          { className: "btn-label" },
          labels.download,
        ),
      ),
    );
  }

  return wp.element.createElement(
    "div",
    { className: "download-card-language-row" },
    ...rowChildren,
  );
}
