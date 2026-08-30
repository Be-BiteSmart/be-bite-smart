import "./style.css";

import { registerBlockType } from "@wordpress/blocks";
import {
  useBlockProps,
  RichText,
  InspectorControls,
  URLInput,
} from "@wordpress/block-editor";
import { PanelBody, TextControl } from "@wordpress/components";
import { __ } from "@wordpress/i18n";

// Same open-quote glyph used for both marks; the closing mark is mirrored
// with CSS (transform: scaleX(-1)) rather than a second path.
const QUOTE_SVG =
  '<svg width="34" height="26" viewBox="0 0 34 26" fill="none"><path d="M0 26V14.6C0 6.2 5.6 0.6 14.6 0H16V6.4C11 7 8.4 9.6 8 14H16V26H0ZM18 26V14.6C18 6.2 23.6 0.6 32.6 0H34V6.4C29 7 26.4 9.6 26 14H34V26H18Z" fill="#F5C842"/></svg>';

registerBlockType("custom/callout-card", {
  title: __("Callout Card", "custom-blocks"),
  category: "widgets",

  supports: {
    align: ["wide"],
  },

  attributes: {
    align: { type: "string", default: "wide" },
    leadIn: {
      type: "string",
      default:
        "Despite the decades long call for age-appropriate education, structured prevention education designed specifically for children remains inadequate and relatively ineffective. Much is static Do and Don’t advice.",
    },
    quote: {
      type: "string",
      default:
        "Be BiteSmart<sup>SM</sup> addresses this gap through proactive education grounded in canine behavioral science, early child development, and pediatric injury-prevention research.",
    },
    body: {
      type: "string",
      default:
        "Be BiteSmart<sup>SM</sup> educational materials are provided free of charge and are publicly accessible worldwide. All videos and learning resources may be shared and used for non-commercial educational purposes by families, schools, healthcare providers, and community organizations.",
    },
    quoteSource: { type: "string", default: "" },
    quoteSourceUrl: { type: "string", default: "" },
    btn1Text: { type: "string", default: "Free Educational Material" },
    btn1Url: { type: "string", default: "#" },
    btn2Text: { type: "string", default: "Evidence Library" },
    btn2Url: { type: "string", default: "#" },
  },

  edit: ({ attributes, setAttributes }) => {
    const blockProps = useBlockProps({
      className: "cc-card",
    });

    return wp.element.createElement(
      "div",
      blockProps,

      // ── Inspector Controls ──────────────────────────────────────
      wp.element.createElement(
        InspectorControls,
        null,
        wp.element.createElement(
          PanelBody,
          { title: __("Quote Source", "custom-blocks"), initialOpen: true },
          wp.element.createElement(
            "p",
            { style: { fontSize: "12px", color: "#757575", marginTop: 0 } },
            __(
              "Set the name in the quote panel below. Optional — link it to the source here.",
              "custom-blocks",
            ),
          ),
          wp.element.createElement(
            "div",
            { style: { marginBottom: "16px" } },
            wp.element.createElement(
              "label",
              {
                style: {
                  display: "block",
                  marginBottom: "4px",
                  fontSize: "11px",
                  fontWeight: 500,
                },
              },
              __("Source Link (optional)", "custom-blocks"),
            ),
            wp.element.createElement(URLInput, {
              value: attributes.quoteSourceUrl,
              onChange: (val) => setAttributes({ quoteSourceUrl: val }),
            }),
          ),
        ),
        wp.element.createElement(
          PanelBody,
          { title: __("Buttons", "custom-blocks"), initialOpen: true },
          wp.element.createElement(TextControl, {
            label: __("Button 1 Text", "custom-blocks"),
            value: attributes.btn1Text,
            onChange: (val) => setAttributes({ btn1Text: val }),
          }),
          wp.element.createElement(
            "div",
            { style: { marginBottom: "16px" } },
            wp.element.createElement(
              "label",
              {
                style: {
                  display: "block",
                  marginBottom: "4px",
                  fontSize: "11px",
                  fontWeight: 500,
                },
              },
              __("Button 1 URL", "custom-blocks"),
            ),
            wp.element.createElement(URLInput, {
              value: attributes.btn1Url,
              onChange: (val) => setAttributes({ btn1Url: val }),
            }),
          ),
          wp.element.createElement(TextControl, {
            label: __("Button 2 Text", "custom-blocks"),
            value: attributes.btn2Text,
            onChange: (val) => setAttributes({ btn2Text: val }),
          }),
          wp.element.createElement(
            "div",
            { style: { marginBottom: "16px" } },
            wp.element.createElement(
              "label",
              {
                style: {
                  display: "block",
                  marginBottom: "4px",
                  fontSize: "11px",
                  fontWeight: 500,
                },
              },
              __("Button 2 URL", "custom-blocks"),
            ),
            wp.element.createElement(URLInput, {
              value: attributes.btn2Url,
              onChange: (val) => setAttributes({ btn2Url: val }),
            }),
          ),
        ),
      ),

      // ── Editor Preview ──────────────────────────────────────────
      wp.element.createElement(
        "div",
        { className: "cc-panel cc-panel--quote" },
        wp.element.createElement("span", {
          className: "cc-quote-mark cc-quote-mark--open",
          "aria-hidden": "true",
          dangerouslySetInnerHTML: { __html: QUOTE_SVG },
        }),
        wp.element.createElement(RichText, {
          tagName: "p",
          className: "cc-quote",
          value: attributes.quote,
          onChange: (val) => setAttributes({ quote: val }),
          placeholder: __("Pull-quote…", "custom-blocks"),
        }),
        wp.element.createElement("span", {
          className: "cc-quote-mark cc-quote-mark--close",
          "aria-hidden": "true",
          dangerouslySetInnerHTML: { __html: QUOTE_SVG },
        }),
        wp.element.createElement(RichText, {
          tagName: "p",
          className: "cc-quote-source",
          value: attributes.quoteSource,
          onChange: (val) => setAttributes({ quoteSource: val }),
          allowedFormats: [],
          placeholder: __("Source name (optional)…", "custom-blocks"),
        }),
      ),

      wp.element.createElement(
        "div",
        { className: "cc-panel cc-panel--body" },
        wp.element.createElement(RichText, {
          tagName: "p",
          className: "cc-lead",
          value: attributes.leadIn,
          onChange: (val) => setAttributes({ leadIn: val }),
          placeholder: __("Lead-in paragraph…", "custom-blocks"),
        }),
        wp.element.createElement("div", { className: "cc-divider" }),
        wp.element.createElement(RichText, {
          tagName: "p",
          className: "cc-support",
          value: attributes.body,
          onChange: (val) => setAttributes({ body: val }),
          placeholder: __("Supporting paragraph…", "custom-blocks"),
        }),
        wp.element.createElement(
          "div",
          { className: "cc-buttons" },
          wp.element.createElement(
            "span",
            { className: "block-toggle-btn" },
            attributes.btn1Text,
          ),
          wp.element.createElement(
            "span",
            { className: "block-toggle-btn is-style-outline" },
            attributes.btn2Text,
          ),
        ),
      ),
    );
  },

  save: () => {
    // Dynamic block — rendered server-side via render_callback in PHP.
    return null;
  },
});
