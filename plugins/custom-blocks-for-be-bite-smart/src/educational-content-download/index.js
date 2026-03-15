import "./style.css";

import { registerBlockType } from "@wordpress/blocks";
import {
  useBlockProps,
  InspectorControls,
  MediaUpload,
  RichText,
} from "@wordpress/block-editor";
import { PanelBody } from "@wordpress/components";
import { __ } from "@wordpress/i18n";

// Shared editor preview styles
const previewStyles = {
  wrapper: {
    border: "1px solid #d0e4eb",
    borderRadius: "12px",
    overflow: "hidden",
    fontFamily: "Urbanist, sans-serif",
  },
  header: {
    padding: "14px 20px",
    background: "#f0f6f9",
    borderBottom: "1px solid #d0e4eb",
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },

  meta: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  episodeAndContentType: {
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "1.5px",
    textTransform: "uppercase",
    color: "#d4700a",
  },
  title: {
    fontSize: "17px",
    fontWeight: "800",
    color: "#1a2e35",
  },
  uploadArea: {
    padding: "16px 20px",
    display: "flex",
    gap: "24px",
    flexWrap: "wrap",
  },
  uploadGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  uploadLabel: {
    fontSize: "12px",
    fontWeight: "700",
    color: "#6b7c84",
    textTransform: "uppercase",
    letterSpacing: "1px",
  },
  fileChip: {
    fontSize: "12px",
    color: "#1a6e8a",
    background: "#e8f4f8",
    borderRadius: "6px",
    padding: "4px 10px",
    maxWidth: "200px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
};

registerBlockType("custom/educational-content-download", {
  title: "Educational Content Download",
  category: "widgets",
  icon: "download",
  description: "Displays an episode's downloadable PDF files.",

  supports: {
    spacing: { margin: true, padding: true },
  },

  attributes: {
    episodeNumber: { type: "string", default: "" },
    contentType: { type: "string", default: "" },
    episodeTitle: { type: "string", default: "" },
    pdfUrl: { type: "string", default: "" },
    pdfUrlEs: { type: "string", default: "" },
    downloadUrlEn: { type: "string", default: "" }, // ← Google Drive or direct link
    downloadUrlEs: { type: "string", default: "" },
    // Unique ID so EN/ES viewers don't bleed across episodes on the same page
    blockId: { type: "string", default: "" },
  },

  edit: ({ attributes, setAttributes, clientId }) => {
    const blockProps = useBlockProps();

    // Auto-generate a stable blockId on first insert
    wp.element.useEffect(() => {
      if (!attributes.blockId) {
        setAttributes({ blockId: "ecd-" + clientId.slice(0, 8) });
      }
    }, []);

    return wp.element.createElement(
      "div",
      blockProps,

      // ── Sidebar ────────────────────────────────────────────────
      wp.element.createElement(
        InspectorControls,
        null,
        wp.element.createElement(
          PanelBody,
          { title: "About this block", initialOpen: true },
          wp.element.createElement(
            "p",
            {
              style: {
                fontSize: "13px",
                color: "#50575e",
                marginBottom: "8px",
              },
            },
            "Choose ONE format for both languages — either upload PDFs to view inline, or paste download links. Don't mix the two.",
          ),
          wp.element.createElement(
            "p",
            { style: { fontSize: "13px", color: "#50575e", margin: 0 } },
            "Priority if both are set: PDF viewer wins.",
          ),
        ),
      ),

      // ── Editor canvas ──────────────────────────────────────────
      wp.element.createElement(
        "div",
        { style: previewStyles.wrapper },

        // Header: num chip + orange label + title
        wp.element.createElement(
          "div",
          { style: previewStyles.header },

          wp.element.createElement(RichText, {
            tagName: "div",
            value: attributes.episodeNumber,
            onChange: (val) => setAttributes({ episodeNumber: val }),
            placeholder: "#",
            className: "bright-chip",
            style: { padding: "0 16px" },
            onSplit: () => {},
            disableLineBreaks: true,
          }),

          wp.element.createElement(
            "div",
            { style: previewStyles.meta },

            // "EPISODE X · " prefix (static) + editable content type
            wp.element.createElement(
              "div",
              {
                style: { display: "flex", alignItems: "center", gap: "4px" },
              },
              wp.element.createElement(
                "span",
                { className: "capitalized-and-colored" },
                attributes.episodeNumber
                  ? "EPISODE " + attributes.episodeNumber + " · "
                  : "EPISODE # · ",
              ),
              wp.element.createElement(RichText, {
                tagName: "span",
                value: attributes.contentType,
                onChange: (val) => setAttributes({ contentType: val }),
                placeholder: "Content type",
                className: "capitalized-and-colored",
                onSplit: () => {},
                disableLineBreaks: true,
              }),
            ),

            wp.element.createElement(RichText, {
              tagName: "div",
              value: attributes.episodeTitle,
              onChange: (val) => setAttributes({ episodeTitle: val }),
              placeholder: "Episode title",
              style: previewStyles.title,
              onSplit: () => {},
              disableLineBreaks: true,
            }),
          ),
        ),

        // PDF upload area
        wp.element.createElement(
          "div",
          { style: previewStyles.uploadArea },

          // English PDF
          wp.element.createElement(
            "div",
            { style: previewStyles.uploadGroup },
            wp.element.createElement(
              "span",
              { style: previewStyles.uploadLabel },
              "English PDF",
            ),
            wp.element.createElement(MediaUpload, {
              onSelect: (media) => setAttributes({ pdfUrl: media.url }),
              allowedTypes: ["application/pdf"],
              value: attributes.pdfUrl,
              render: ({ open }) =>
                wp.element.createElement(
                  "button",
                  { onClick: open, className: "button" },
                  attributes.pdfUrl
                    ? "Change English PDF"
                    : "Upload English PDF",
                ),
            }),
            attributes.pdfUrl &&
              wp.element.createElement(
                "span",
                { style: previewStyles.fileChip },
                attributes.pdfUrl.split("/").pop(),
              ),
          ),

          // Spanish PDF
          wp.element.createElement(
            "div",
            { style: previewStyles.uploadGroup },
            wp.element.createElement(
              "span",
              { style: previewStyles.uploadLabel },
              "Spanish PDF",
            ),
            wp.element.createElement(MediaUpload, {
              onSelect: (media) => setAttributes({ pdfUrlEs: media.url }),
              allowedTypes: ["application/pdf"],
              value: attributes.pdfUrlEs,
              render: ({ open }) =>
                wp.element.createElement(
                  "button",
                  { onClick: open, className: "button" },
                  attributes.pdfUrlEs
                    ? "Change Spanish PDF"
                    : "Upload Spanish PDF",
                ),
            }),
            attributes.pdfUrlEs &&
              wp.element.createElement(
                "span",
                { style: previewStyles.fileChip },
                attributes.pdfUrlEs.split("/").pop(),
              ),
          ),
        ),

        // ── Divider ──
        wp.element.createElement(
          "div",
          {
            style: {
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "4px 0",
            },
          },
          wp.element.createElement("hr", {
            style: {
              flex: 1,
              border: "none",
              borderTop: "1px solid #d0e4eb",
            },
          }),
          wp.element.createElement(
            "span",
            {
              style: {
                fontSize: "11px",
                fontWeight: "700",
                color: "#6b7c84",
                textTransform: "uppercase",
                letterSpacing: "1px",
                whiteSpace: "nowrap",
              },
            },
            "— or use download links instead —",
          ),
          wp.element.createElement("hr", {
            style: {
              flex: 1,
              border: "none",
              borderTop: "1px solid #d0e4eb",
            },
          }),
        ),

        // English download link (alternative to PDF viewer)
        wp.element.createElement(
          "div",
          { style: previewStyles.uploadGroup },
          wp.element.createElement(
            "span",
            { style: previewStyles.uploadLabel },
            "English Download Link",
          ),
          wp.element.createElement("input", {
            type: "text",
            value: attributes.downloadUrlEn,
            onChange: (e) => setAttributes({ downloadUrlEn: e.target.value }),
            placeholder: "https://drive.google.com/...",
            style: { width: "100%", padding: "4px 8px", fontSize: "12px" },
          }),
        ),

        // Spanish download link (alternative to PDF viewer)
        wp.element.createElement(
          "div",
          { style: previewStyles.uploadGroup },
          wp.element.createElement(
            "span",
            { style: previewStyles.uploadLabel },
            "Spanish Download Link",
          ),
          wp.element.createElement("input", {
            type: "text",
            value: attributes.downloadUrlEs,
            onChange: (e) => setAttributes({ downloadUrlEs: e.target.value }),
            placeholder: "https://drive.google.com/...",
            style: { width: "100%", padding: "4px 8px", fontSize: "12px" },
          }),
        ),
      ),
    );
  },

  save: ({ attributes }) => {
    const blockProps = useBlockProps.save();

    const blockId = attributes.blockId || "ecd-block";
    const enId = "ecd-en-" + blockId;
    const esId = "ecd-es-" + blockId;
    const groupId = "ecd-grp-" + blockId;

    // Convert Google Drive and Dropbox URLs to direct download links
    const convertToDirectDownload = (url) => {
      if (!url) return null;
      const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^\/]+)/);
      if (driveMatch) {
        return (
          "https://drive.google.com/uc?export=download&id=" + driveMatch[1]
        );
      }
      if (url.includes("dropbox.com")) {
        if (url.includes("?dl=")) return url.replace(/\?dl=0/, "?dl=1");
        return url + (url.includes("?") ? "&dl=1" : "?dl=1");
      }
      return url;
    };

    const downloadUrlEn = convertToDirectDownload(attributes.downloadUrlEn);
    const downloadUrlEs = convertToDirectDownload(attributes.downloadUrlEs);

    const episodeAndContentType = [
      attributes.episodeNumber ? "Episode " + attributes.episodeNumber : "",
      attributes.contentType ? attributes.contentType : "",
    ]
      .filter(Boolean)
      .join(" · ");

    // Per-language button helper — viewer > download > coming soon
    const renderButton = (hasPdf, hasDownload, isOutline, targetId, label) => {
      const base =
        "ecd-toggle block-toggle-btn" +
        (isOutline ? " is-style-outline ecd-toggle--outline" : "");

      if (hasPdf) {
        return wp.element.createElement(
          "button",
          {
            className: base,
            "data-target": targetId,
            "data-group": groupId,
            "data-expanded": "false",
          },
          "View PDF (" + label + ")",
        );
      }
      if (hasDownload) {
        return wp.element.createElement(
          "a",
          {
            href: hasDownload,
            className: base + " ecd-toggle--download",
            download: true,
            "aria-label": "Download " + label + " version",
          },
          "Download (" + label + ")",
        );
      }
      return wp.element.createElement(
        "button",
        {
          className: base + " ecd-toggle--coming-soon",
          disabled: true,
          "aria-disabled": "true",
        },
        "Coming Soon (" + label + ")",
      );
    };

    return wp.element.createElement(
      "section",
      {
        ...blockProps,
        className:
          (blockProps.className ? blockProps.className + " " : "") +
          "educational-content-download-block",
      },

      // Yellow number chip
      attributes.episodeNumber &&
        wp.element.createElement(
          "div",
          { className: "bright-chip" },
          attributes.episodeNumber,
        ),

      // Orange label + title
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

      // Toggle/download buttons
      wp.element.createElement(
        "div",
        { className: "ecd-buttons" },
        renderButton(attributes.pdfUrl, downloadUrlEn, false, enId, "EN"),
        renderButton(attributes.pdfUrlEs, downloadUrlEs, true, esId, "ES"),
      ),

      // PDF viewers — only rendered when a PDF (not a download link) is provided
      attributes.pdfUrl &&
        wp.element.createElement(
          "div",
          { id: enId, className: "ecd-viewer" },
          wp.element.createElement("iframe", {
            "data-src": attributes.pdfUrl,
            width: "100%",
            height: "600px",
            title: "PDF Document (English)",
          }),
        ),

      attributes.pdfUrlEs &&
        wp.element.createElement(
          "div",
          { id: esId, className: "ecd-viewer" },
          wp.element.createElement("iframe", {
            "data-src": attributes.pdfUrlEs,
            width: "100%",
            height: "600px",
            title: "PDF Document (Spanish)",
          }),
        ),
    );
  },
});
