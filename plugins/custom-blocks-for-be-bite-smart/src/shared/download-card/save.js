import { useBlockProps, RichText } from "@wordpress/block-editor";
import { convertToDirectDownload } from "./convert-to-direct-download";
import { renderLanguageRow } from "./render-language-row";

export function DownloadCardSave({ attributes, config }) {
  const blockProps = useBlockProps.save();
  const { wrapperClassName, blockIdPrefix, features } = config;

  const blockId = attributes.blockId || blockIdPrefix + "-block";
  const enId = blockIdPrefix + "-en-" + blockId;
  const esId = blockIdPrefix + "-es-" + blockId;
  const groupId = blockIdPrefix + "-grp-" + blockId;

  const downloadUrlEn = features.downloadLinks
    ? convertToDirectDownload(attributes.downloadUrlEn)
    : null;
  const downloadUrlEs = features.downloadLinks
    ? convertToDirectDownload(attributes.downloadUrlEs)
    : null;

  const episodeAndContentType = [
    attributes.episodeNumber ? "Episode " + attributes.episodeNumber : "",
    attributes.contentType ? attributes.contentType : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const wp = window.wp;

  const enRow = renderLanguageRow(wp, {
    lang: "en",
    pdfUrl: attributes.pdfUrl,
    downloadUrl: downloadUrlEn,
    targetId: enId,
    groupId,
    features,
  });
  const esRow = renderLanguageRow(wp, {
    lang: "es",
    pdfUrl: attributes.pdfUrlEs,
    downloadUrl: downloadUrlEs,
    targetId: esId,
    groupId,
    features,
  });

  const hasButtons =
    enRow || esRow || (features.comingSoonWhenEmpty && features.pdf);
  const downloadOnlyButtons = features.downloadLinks && !features.pdf;
  const buttonsClassName =
    "download-card-buttons" +
    (downloadOnlyButtons ? " download-card-buttons--inline" : "");

  return wp.element.createElement(
    "section",
    {
      ...blockProps,
      // Stable per-instance anchor so a Resource entry's URL can link
      // straight to this block wherever it's placed on a page — same
      // "give the real embed a stable anchor id, link to it" pattern as
      // Episode's bitesmart_episode_anchor_id(). blockId is set once in
      // edit.js and persisted in the saved attributes, so it survives
      // re-saves.
      id: blockId,
      ...(features.pdf && attributes.trackingId
        ? { "data-track": attributes.trackingId }
        : {}),
      className:
        (blockProps.className ? blockProps.className + " " : "") +
        "download-card-block " +
        wrapperClassName,
    },

    attributes.episodeNumber &&
      wp.element.createElement(
        "div",
        { className: "bright-chip" },
        attributes.episodeNumber,
      ),

    wp.element.createElement(
      "div",
      { className: "ecd-header" },
      episodeAndContentType &&
        wp.element.createElement(
          "span",
          { className: "capitalized-and-colored" },
          episodeAndContentType,
        ),
      attributes.episodeTitle &&
        wp.element.createElement(RichText.Content, {
          tagName: "h3",
          className: "ecd-title",
          value: attributes.episodeTitle,
        }),
    ),

    hasButtons &&
      wp.element.createElement(
        "div",
        { className: buttonsClassName },
        enRow,
        esRow,
      ),

    features.pdf &&
      attributes.pdfUrl &&
      wp.element.createElement(
        "div",
        { id: enId, className: "ecd-viewer" },
        wp.element.createElement("iframe", {
          "data-src": attributes.pdfUrl,
          width: "100%",
          height: "600px",
          title: "PDF Document (ENG)",
        }),
      ),

    features.pdf &&
      attributes.pdfUrlEs &&
      wp.element.createElement(
        "div",
        { id: esId, className: "ecd-viewer" },
        wp.element.createElement("iframe", {
          "data-src": attributes.pdfUrlEs,
          width: "100%",
          height: "600px",
          title: "PDF Document (ES)",
        }),
      ),
  );
}
