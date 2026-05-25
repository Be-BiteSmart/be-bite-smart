import { renderPdfButton } from "../../components/pdf-button";

const LABELS = {
  en: {
    viewPdf: "View PDF (ENG)",
    hidePdf: "Hide PDF (ENG)",
    download: "Download (ENG)",
    dataLang: "en",
  },
  es: {
    viewPdf: "Ver PDF (ESP)",
    hidePdf: "Ocultar PDF (ESP)",
    download: "Descargar (ESP)",
    dataLang: "es",
  },
};

/**
 * One language row: View PDF + Download when a PDF is uploaded (pdf-toggle pattern),
 * or a single tracked download link when only an external URL is set.
 * Returns null when that language has no resources (row hidden).
 */
export function renderLanguageRow(
  wp,
  { lang, pdfUrl, downloadUrl, targetId, groupId, features },
) {
  const labels = LABELS[lang];
  const hasPdf = Boolean(features.pdf && pdfUrl);
  const externalUrl = features.downloadLinks ? downloadUrl : null;

  if (!hasPdf && !externalUrl) {
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
    rowChildren.push(
      wp.element.createElement(
        "a",
        {
          href: externalUrl,
          className: "ecd-toggle block-toggle-btn ecd-toggle--download",
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
