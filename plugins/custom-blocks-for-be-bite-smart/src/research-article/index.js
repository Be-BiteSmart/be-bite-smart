import "./style.css";

import { registerBlockType } from "@wordpress/blocks";
import {
  useBlockProps,
  RichText,
  InspectorControls,
} from "@wordpress/block-editor";
import { PanelBody, ToggleControl } from "@wordpress/components";
import { __ } from "@wordpress/i18n";
/**
 * Centralized Quote Configuration
 * Labels as translation keys - will be translated at render time
 */
const QUOTE_CONFIG = [
  {
    key: "Conclusion",
    className: "conclusion-quote",
    labelKey: "Conclusion Quote",
  },
  {
    key: "Medical",
    className: "medical-quote",
    labelKey: "Verbatim Medical Quote",
  },
  {
    key: "Verbatim",
    className: "verbatim-quote",
    labelKey: "Verbatim Quote",
  },
  {
    key: "EducatedSupervision",
    className: "educated-supervision-quote",
    labelKey: "Quote – Need for Educated Supervision",
  },
];

const editor_font_size = "18px";

registerBlockType("custom/research-article", {
  title: __("Research Article", "custom-blocks"),
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
    typography: {
      fontSize: true,
      fontWeight: true,
      lineHeight: true,
    },
  },

  attributes: {
    title: { type: "string", default: "" },
    link: { type: "string" },
    citation: { type: "string", default: "" },

    whyItMatters: { type: "string", default: "" },

    showConclusionQuote: { type: "boolean", default: false },
    conclusionQuote: { type: "string", default: "" },
    conclusionQuoteSource: { type: "string", default: "" },

    showMedicalQuote: { type: "boolean", default: false },
    medicalQuote: { type: "string", default: "" },
    medicalQuoteSource: { type: "string", default: "" },

    showVerbatimQuote: { type: "boolean", default: false },
    verbatimQuote: { type: "string", default: "" },
    verbatimQuoteSource: { type: "string", default: "" },

    showEducatedSupervisionQuote: { type: "boolean", default: false },
    educatedSupervisionQuote: { type: "string", default: "" },
    educatedSupervisionQuoteSource: { type: "string", default: "" },
  },

  edit: ({ attributes, setAttributes }) => {
    const blockProps = useBlockProps();

    return wp.element.createElement(
      "div",
      blockProps,

      // Inspector Controls
      wp.element.createElement(
        InspectorControls,
        null,
        wp.element.createElement(
          PanelBody,
          { title: __("Optional Fields", "custom-blocks") },
          QUOTE_CONFIG.map((quote) =>
            wp.element.createElement(ToggleControl, {
              key: quote.key,
              label: __(quote.labelKey, "custom-blocks"),
              checked: attributes[`show${quote.key}Quote`],
              onChange: (val) =>
                setAttributes({ [`show${quote.key}Quote`]: val }),
            }),
          ),
        ),
      ),

      // Title
      wp.element.createElement(
        "div",
        {
          className: "title-section",
          style: {
            display: "flex",
            alignItems: "center",
            gap: "8px",
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
          "Title:",
        ),
        wp.element.createElement(RichText, {
          tagName: "h4",
          placeholder: __("Title", "custom-blocks"),
          className: "",
          value: attributes.title,
          onChange: (val) => setAttributes({ title: val }),
          style: {
            fontSize: editor_font_size,
            fontWeight: "400",
          },
        }),
      ),

      // Link input with label
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
          "Hyperlink for Title:",
        ),
        wp.element.createElement("input", {
          type: "url",
          placeholder: __("https://...", "custom-blocks"),
          value: attributes.link || "",
          onChange: (e) => setAttributes({ link: e.target.value }),
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

      // Article citation with label
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
              whiteSpace: "nowrap",
            },
          },
          "Citation:",
        ),
        wp.element.createElement(RichText, {
          tagName: "p",
          className: "capitalized-and-colored ",
          placeholder: __("Author, Journal, Year", "custom-blocks"),
          value: attributes.citation,
          onChange: (val) => setAttributes({ citation: val }),
          style: {
            flex: 1,
            fontSize: editor_font_size,
            margin: 0,
          },
        }),
      ),

      // Why it matters
      wp.element.createElement(
        "div",
        { className: "why-it-matters-section" },
        wp.element.createElement(
          "p",
          {
            className: "why-it-matters-label",
            style: {
              fontSize: editor_font_size,
            },
          },
          wp.element.createElement(
            "strong",
            null,
            __("Why it matters", "custom-blocks"),
          ),
        ),
        wp.element.createElement(RichText, {
          tagName: "p",
          className: "why-it-matters-content",
          value: attributes.whyItMatters,
          onChange: (val) => setAttributes({ whyItMatters: val }),
          placeholder: __("Add explanation here…", "custom-blocks"),
          style: {
            fontSize: editor_font_size,
          },
        }),
      ),

      // Quotes (Editor View)
      QUOTE_CONFIG.map((quote) => {
        const show = attributes[`show${quote.key}Quote`];
        const value =
          attributes[
            `${quote.key.charAt(0).toLowerCase() + quote.key.slice(1)}Quote`
          ];
        const source =
          attributes[
            `${
              quote.key.charAt(0).toLowerCase() + quote.key.slice(1)
            }QuoteSource`
          ];

        if (!show) return null;

        return wp.element.createElement(
          "blockquote",
          { key: quote.key, className: quote.className },
          wp.element.createElement(
            "p",
            {
              className: "quote-label",
              style: {
                fontSize: editor_font_size,
              },
            },
            wp.element.createElement(
              "strong",
              null,
              __(quote.labelKey, "custom-blocks"),
            ),
          ),
          wp.element.createElement(
            "p",
            { className: "quote-content" },
            wp.element.createElement("span", null, "\u201c"),
            wp.element.createElement(RichText, {
              tagName: "span",
              value: value,
              onChange: (val) =>
                setAttributes({
                  [`${
                    quote.key.charAt(0).toLowerCase() + quote.key.slice(1)
                  }Quote`]: val,
                }),
              placeholder: __("Enter quote…", "custom-blocks"),
              style: {
                fontSize: editor_font_size,
              },
            }),
            wp.element.createElement("span", null, "\u201d"),
            wp.element.createElement(
              "cite",
              null,
              " — ",
              wp.element.createElement(RichText, {
                tagName: "span",
                value: source,
                onChange: (val) =>
                  setAttributes({
                    [`${
                      quote.key.charAt(0).toLowerCase() + quote.key.slice(1)
                    }QuoteSource`]: val,
                  }),
                placeholder: __("Source (optional)", "custom-blocks"),
                style: {
                  fontSize: editor_font_size,
                },
              }),
            ),
          ),
        );
      }),
    );
  },

  save: ({ attributes }) => {
    const blockProps = useBlockProps.save();

    return wp.element.createElement(
      "article",
      {
        ...blockProps,
        className: `${
          blockProps.className || ""
        } custom-block-card custom-block-border`.trim(),
      },

      attributes.title &&
        (attributes.link
          ? wp.element.createElement(
              "a",
              {
                href: attributes.link,
                target: "_blank",
                rel: "noopener noreferrer",
              },
              wp.element.createElement(RichText.Content, {
                tagName: "h4",
                className: "wp-block-heading has-large-font-size",
                value: attributes.title,
              }),
            )
          : wp.element.createElement(RichText.Content, {
              tagName: "h4",
              className: "wp-block-heading has-large-font-size",
              value: attributes.title,
            })),

      // title citation
      attributes.citation &&
        wp.element.createElement(RichText.Content, {
          tagName: "p",
          className: "capitalized-and-colored authors",
          value: attributes.citation,
        }),

      attributes.whyItMatters &&
        wp.element.createElement(
          "div",
          { className: "why-it-matters-section" },
          wp.element.createElement(
            "p",
            { className: "why-it-matters-label" },
            wp.element.createElement(
              "strong",
              null,
              __("Why it matters", "custom-blocks"),
            ),
          ),
          wp.element.createElement(RichText.Content, {
            tagName: "p",
            className: "why-it-matters-content",
            value: attributes.whyItMatters,
          }),
        ),

      QUOTE_CONFIG.map((quote) => {
        const show = attributes[`show${quote.key}Quote`];
        const value =
          attributes[
            `${quote.key.charAt(0).toLowerCase() + quote.key.slice(1)}Quote`
          ];
        const source =
          attributes[
            `${
              quote.key.charAt(0).toLowerCase() + quote.key.slice(1)
            }QuoteSource`
          ];

        if (!show || !value) return null;

        return wp.element.createElement(
          "blockquote",
          { key: quote.key, className: quote.className },
          wp.element.createElement(
            "p",
            { className: "quote-label" },
            wp.element.createElement(
              "strong",
              null,
              __(quote.labelKey, "custom-blocks"),
            ),
          ),
          wp.element.createElement(
            "p",
            { className: "quote-content" },
            wp.element.createElement("span", null, "\u201c"),
            wp.element.createElement(RichText.Content, {
              tagName: "span",
              value: value,
            }),
            wp.element.createElement("span", null, "\u201d"),
            source &&
              wp.element.createElement(
                "cite",
                null,
                " — ",
                wp.element.createElement(RichText.Content, {
                  tagName: "span",
                  value: source,
                }),
              ),
          ),
        );
      }),
    );
  },
});
