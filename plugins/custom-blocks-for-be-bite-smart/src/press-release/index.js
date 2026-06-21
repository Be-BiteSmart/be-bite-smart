import "./style.css";

import { registerBlockType, createBlock } from "@wordpress/blocks";
import {
  useBlockProps,
  RichText,
  InspectorControls,
  InnerBlocks,
  MediaUpload,
  MediaUploadCheck,
} from "@wordpress/block-editor";
import { PanelBody, RadioControl, Button } from "@wordpress/components";
import { __ } from "@wordpress/i18n";
import { useDispatch } from "@wordpress/data";

const editor_font_size = "18px";
const TEXT_BLOCKS = [
  "core/paragraph",
  "core/heading",
  "core/list",
  "core/quote",
  "core/image",
];
const PDF_BLOCKS = ["custom/pdf-toggle"];

registerBlockType("custom/press-release", {
  title: __("Press Release", "custom-blocks"),
  category: "widgets",

  supports: {
    fontSize: true,
    color: {
      background: true,
      text: true,
    },
    spacing: {
      margin: true,
      padding: true,
    },
  },

  attributes: {
    headline: { type: "string", default: "" },
    date: { type: "string", default: "" },
    summary: { type: "string", default: "" },
    expandableType: { type: "string", default: "none" }, // "none", "text", "pdf"
    outletType: { type: "string", default: "text" }, // "text" or "logo"
    outletName: { type: "string", default: "" },
    logoUrl: { type: "string", default: "" },
    logoAlt: { type: "string", default: "" },
    logoId: { type: "number", default: 0 },
  },

  edit: ({ attributes, setAttributes, clientId }) => {
    const blockProps = useBlockProps();
    const { replaceInnerBlocks } = useDispatch("core/block-editor");

    // When the user switches expandable type, clear inner blocks and
    // insert the correct starting template for the new mode.
    // NOTE: switching modes clears any content already entered.
    const handleExpandableTypeChange = (val) => {
      setAttributes({ expandableType: val });

      if (val === "text") {
        replaceInnerBlocks(
          clientId,
          [createBlock("core/paragraph", {})],
          false,
        );
      } else if (val === "pdf") {
        replaceInnerBlocks(
          clientId,
          [createBlock("custom/pdf-toggle", {})],
          false,
        );
      } else {
        // "none" — wipe everything
        replaceInnerBlocks(clientId, [], false);
      }
    };

    return wp.element.createElement(
      "div",
      blockProps,

      // ── Inspector Controls ──────────────────────────────────────────
      wp.element.createElement(
        InspectorControls,
        null,
        wp.element.createElement(
          PanelBody,
          { title: __("Media Outlet", "custom-blocks") },
          wp.element.createElement(RadioControl, {
            label: __("Show outlet as", "custom-blocks"),
            selected: attributes.outletType,
            options: [
              { label: "Text name", value: "text" },
              { label: "Logo image", value: "logo" },
            ],
            onChange: (val) => setAttributes({ outletType: val }),
          }),
        ),
        wp.element.createElement(
          PanelBody,
          { title: __("Expandable Content", "custom-blocks") },
          wp.element.createElement(RadioControl, {
            label: __("Attach additional content?", "custom-blocks"),
            selected: attributes.expandableType,
            options: [
              { label: "None", value: "none" },
              { label: "Full Text", value: "text" },
              { label: "PDF", value: "pdf" },
            ],
            onChange: handleExpandableTypeChange,
          }),
          attributes.expandableType === "text" &&
            wp.element.createElement(
              "p",
              {
                style: {
                  fontSize: "12px",
                  color: "#6b7280",
                  marginTop: "8px",
                },
              },
              "Paste or type your full text below. Bold, italics, headings, and lists are supported.",
            ),
        ),
      ),

      // ── Outlet Name / Logo ──────────────────────────────────────────
      wp.element.createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "12px",
          },
        },
        wp.element.createElement(
          "label",
          {
            style: {
              fontSize: editor_font_size,
              fontWeight: "600",
              flexShrink: 0,
            },
          },
          "Media Outlet:",
        ),

        attributes.outletType === "text"
          ? wp.element.createElement("input", {
              type: "text",
              placeholder: __("e.g., The New York Times", "custom-blocks"),
              value: attributes.outletName || "",
              onChange: (e) => setAttributes({ outletName: e.target.value }),
              style: {
                flex: 1,
                padding: "4px 8px",
                border: "none",
                backgroundColor: "transparent",
                fontSize: editor_font_size,
                outline: "none",
              },
            })
          : wp.element.createElement(
              MediaUploadCheck,
              null,
              wp.element.createElement(MediaUpload, {
                onSelect: (media) =>
                  setAttributes({
                    logoUrl: media.url,
                    logoAlt: media.alt || "",
                    logoId: media.id,
                  }),
                allowedTypes: ["image"],
                value: attributes.logoId,
                render: ({ open }) =>
                  wp.element.createElement(
                    "div",
                    {
                      style: {
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      },
                    },
                    attributes.logoUrl
                      ? wp.element.createElement("img", {
                          src: attributes.logoUrl,
                          alt: attributes.logoAlt,
                          style: {
                            maxHeight: "40px",
                            maxWidth: "160px",
                            objectFit: "contain",
                          },
                        })
                      : null,
                    wp.element.createElement(
                      Button,
                      {
                        onClick: open,
                        variant: "secondary",
                        style: { fontSize: "13px" },
                      },
                      attributes.logoUrl
                        ? __("Replace Logo", "custom-blocks")
                        : __("Upload Logo", "custom-blocks"),
                    ),
                    attributes.logoUrl
                      ? wp.element.createElement(
                          Button,
                          {
                            onClick: () =>
                              setAttributes({
                                logoUrl: "",
                                logoAlt: "",
                                logoId: 0,
                              }),
                            variant: "tertiary",
                            isDestructive: true,
                            style: { fontSize: "13px" },
                          },
                          __("Remove", "custom-blocks"),
                        )
                      : null,
                  ),
              }),
            ),
      ),

      // ── Headline ────────────────────────────────────────────────────
      wp.element.createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "10px",
          },
        },
        wp.element.createElement(
          "label",
          {
            style: {
              fontSize: editor_font_size,
              fontWeight: "600",
              flexShrink: 0,
            },
          },
          "Headline:",
        ),
        wp.element.createElement(RichText, {
          tagName: "h3",
          placeholder: __("Enter press release headline", "custom-blocks"),
          value: attributes.headline,
          onChange: (val) => setAttributes({ headline: val }),
          style: {
            fontSize: editor_font_size,
            flex: 1,
            margin: 0,
          },
        }),
      ),

      // ── Date ────────────────────────────────────────────────────────
      wp.element.createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "10px",
          },
        },
        wp.element.createElement(
          "label",
          {
            style: {
              fontSize: editor_font_size,
              fontWeight: "600",
              flexShrink: 0,
            },
          },
          "Date:",
        ),
        wp.element.createElement("input", {
          type: "date",
          value: attributes.date || "",
          onChange: (e) => setAttributes({ date: e.target.value }),
          style: {
            flex: 1,
            padding: "4px 8px",
            border: "none",
            backgroundColor: "transparent",
            fontSize: editor_font_size,
            outline: "none",
          },
        }),
      ),

      // ── Summary ─────────────────────────────────────────────────────
      wp.element.createElement(
        "div",
        { style: { marginBottom: "15px" } },
        wp.element.createElement(
          "label",
          {
            style: {
              display: "block",
              fontSize: editor_font_size,
              fontWeight: "600",
              marginBottom: "5px",
            },
          },
          "Summary (1–2 paragraphs):",
        ),
        wp.element.createElement(RichText, {
          tagName: "div",
          multiline: "p",
          placeholder: __("Enter summary paragraphs", "custom-blocks"),
          value: attributes.summary,
          onChange: (val) => setAttributes({ summary: val }),
          style: {
            fontSize: editor_font_size,
            margin: 0,
          },
        }),
      ),

      // ── Expandable InnerBlocks (text or pdf) ─────────────────────────
      attributes.expandableType !== "none" &&
        wp.element.createElement(
          "div",
          { style: { marginBottom: "15px" } },
          wp.element.createElement(
            "label",
            {
              style: {
                display: "block",
                fontSize: editor_font_size,
                fontWeight: "600",
                marginBottom: "8px",
              },
            },
            attributes.expandableType === "pdf"
              ? "PDF Toggle Block:"
              : "Full Text (expandable):",
          ),
          wp.element.createElement(
            "div",
            {
              style: {
                border: "1px dashed #aaa",
                padding: "10px",
                borderRadius: "4px",
              },
            },
            wp.element.createElement(InnerBlocks, {
              allowedBlocks:
                attributes.expandableType === "pdf" ? PDF_BLOCKS : TEXT_BLOCKS,
              template:
                attributes.expandableType === "pdf"
                  ? [["custom/pdf-toggle", {}]]
                  : [["core/paragraph", {}]],
              templateLock: attributes.expandableType === "pdf" ? "all" : false,
            }),
          ),
        ),

      // ── No expandable content hint ───────────────────────────────────
      attributes.expandableType === "none" &&
        wp.element.createElement(
          "span",
          {
            style: {
              display: "block",
              fontSize: "14px",
              color: "#6b7280",
              fontStyle: "italic",
            },
          },
          "No expandable content attached. Add full text or a PDF in the block settings panel.",
        ),
    );
  },

  save: ({ attributes }) => {
    const blockProps = useBlockProps.save();

    const formatDate = (dateStr) => {
      if (!dateStr) return "";
      const [year, month, day] = dateStr.split("-");
      const months = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      return `${months[parseInt(month, 10) - 1]} ${parseInt(day, 10)}, ${year}`;
    };

    // Generate a stable ID from the headline for scroll-back behaviour.
    // Note: if the headline is changed after publishing, the ID will change.
    const slugify = (str) =>
      "pr-" +
      (str || "")
        .toLowerCase()
        .replace(/<[^>]+>/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60);

    return wp.element.createElement(
      "article",
      {
        ...blockProps,
        // custom-block-card — shared card styles (border, shadow, padding) live in global CSS
        className:
          "press-release-block expandable-article-block custom-block-card custom-block-border",
        id: slugify(attributes.headline),
      },

      // ── Outlet badge ─────────────────────────────────────────────────
      (attributes.outletName || attributes.logoUrl) &&
        wp.element.createElement(
          "div",
          { className: "press-release-outlet outlet-badge-wrapper" },
          attributes.outletType === "logo" && attributes.logoUrl
            ? wp.element.createElement("img", {
                src: attributes.logoUrl,
                alt: attributes.logoAlt || "",
                className: "press-release-logo outlet-badge-logo",
              })
            : wp.element.createElement(
                "span",
                { className: "press-release-outlet-name outlet-badge-name" },
                attributes.outletName,
              ),
        ),

      // ── Headline ─────────────────────────────────────────────────────
      attributes.headline &&
        wp.element.createElement(RichText.Content, {
          tagName: "h3",
          value: attributes.headline,
          className: "press-release-headline article-headline",
        }),

      // ── Date ─────────────────────────────────────────────────────────
      attributes.date &&
        wp.element.createElement(
          "div",
          { className: "press-release-meta" },
          wp.element.createElement(
            "time",
            {
              className: "press-release-date",
              dateTime: attributes.date,
            },
            formatDate(attributes.date),
          ),
        ),

      // ── Summary ──────────────────────────────────────────────────────
      attributes.summary &&
        wp.element.createElement(RichText.Content, {
          tagName: "div",
          value: attributes.summary,
          className: "press-release-summary",
        }),

      // ── Expandable InnerBlocks (text or pdf) ──────────────────────────
      attributes.expandableType !== "none"
        ? attributes.expandableType === "pdf"
          ? wp.element.createElement(InnerBlocks.Content)
          : wp.element.createElement(
              "div",
              null,
              wp.element.createElement(
                "div",
                { className: "expandable-content" },
                wp.element.createElement(InnerBlocks.Content),
              ),
              wp.element.createElement(
                "button",
                {
                  className: "read-more-toggle block-toggle-btn",
                  "data-expanded": "false",
                  type: "button",
                },
                "Read More",
              ),
            )
        : null,
    );
  },
});
