import './style.css';

import { registerBlockType } from '@wordpress/blocks';
import { useBlockProps, RichText, InspectorControls, MediaUpload, MediaUploadCheck, URLInput } from '@wordpress/block-editor';
import { PanelBody, TextControl, Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

registerBlockType("custom/hero", {
  // ... rest stays exactly the same
    title: __("Hero", "custom-blocks"),
    category: "widgets",

    supports: {
      align: ["wide", "full"],
    },

    attributes: {
      label: { type: "string", default: "Dog Bite Prevention" },
      heading: {
        type: "string",
        default:
          "Every year, thousands of children are bitten — most injuries are",
      },
      highlight: { type: "string", default: "preventable." },
      body: {
        type: "string",
        default:
          "Our educational videos teach children essential safety skills when interacting with dogs. With your support, we can reach more families and prevent injuries.",
      },
      stat1Num: { type: "string", default: "4.5M+" },
      stat1Label: { type: "string", default: "People bitten annually" },
      stat2Num: { type: "string", default: "Ages 0–2" },
      stat2Label: { type: "string", default: "Most at risk" },
      btn1Text: { type: "string", default: "Donate Now" },
      btn1Url: { type: "string", default: "#" },
      btn2Text: { type: "string", default: "Become a Sponsor" },
      btn2Url: { type: "string", default: "#" },
      bgImageId: { type: "number" },
      bgImageUrl: { type: "string", default: "" },
    },

    edit: ({ attributes, setAttributes }) => {
      const blockProps = useBlockProps({
        className: "dbp-section",
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
            {
              title: __("Background Image", "custom-blocks"),
              initialOpen: true,
            },
            wp.element.createElement(
              MediaUploadCheck,
              null,
              wp.element.createElement(MediaUpload, {
                onSelect: (media) =>
                  setAttributes({ bgImageUrl: media.url, bgImageId: media.id }),
                allowedTypes: ["image"],
                value: attributes.bgImageId,
                render: ({ open }) =>
                  wp.element.createElement(
                    "div",
                    null,
                    attributes.bgImageUrl &&
                      wp.element.createElement("img", {
                        src: attributes.bgImageUrl,
                        alt: "Background preview",
                        style: {
                          width: "100%",
                          height: "80px",
                          objectFit: "cover",
                          borderRadius: "4px",
                          marginBottom: "8px",
                        },
                      }),
                    wp.element.createElement(
                      Button,
                      {
                        onClick: open,
                        variant: "secondary",
                        style: { marginRight: "8px" },
                      },
                      attributes.bgImageUrl
                        ? __("Replace Image", "custom-blocks")
                        : __("Select Image", "custom-blocks"),
                    ),
                    attributes.bgImageUrl &&
                      wp.element.createElement(
                        Button,
                        {
                          onClick: () =>
                            setAttributes({ bgImageUrl: "", bgImageId: null }),
                          variant: "tertiary",
                          isDestructive: true,
                        },
                        __("Remove", "custom-blocks"),
                      ),
                  ),
              }),
            ),
          ),

          wp.element.createElement(
            PanelBody,
            { title: __("Statistics", "custom-blocks"), initialOpen: false },
            wp.element.createElement(TextControl, {
              label: __("Stat 1 Number", "custom-blocks"),
              value: attributes.stat1Num,
              onChange: (val) => setAttributes({ stat1Num: val }),
            }),
            wp.element.createElement(TextControl, {
              label: __("Stat 1 Label", "custom-blocks"),
              value: attributes.stat1Label,
              onChange: (val) => setAttributes({ stat1Label: val }),
            }),
            wp.element.createElement(TextControl, {
              label: __("Stat 2 Number", "custom-blocks"),
              value: attributes.stat2Num,
              onChange: (val) => setAttributes({ stat2Num: val }),
            }),
            wp.element.createElement(TextControl, {
              label: __("Stat 2 Label", "custom-blocks"),
              value: attributes.stat2Label,
              onChange: (val) => setAttributes({ stat2Label: val }),
            }),
          ),

          wp.element.createElement(
            PanelBody,
            { title: __("Buttons", "custom-blocks"), initialOpen: false },
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
          { className: "dbp-bg-wrapper" },
          wp.element.createElement("div", {
            className: "dbp-bg",
            style: attributes.bgImageUrl
              ? { "--dbp-bg-image": `url(${attributes.bgImageUrl})` }
              : {},
          }),
          wp.element.createElement("div", { className: "dbp-overlay" }),
        ),

        wp.element.createElement(
          "div",
          { className: "dbp-content" },
          wp.element.createElement(
            "div",
            { className: "dbp-text" },

            // Label pill
            wp.element.createElement(
              "div",
              { className: "dbp-label" },
              wp.element.createElement("span", {
                className: "dbp-label__dash",
              }),
              wp.element.createElement(RichText, {
                tagName: "span",
                className: "dbp-label__text",
                value: attributes.label,
                onChange: (val) => setAttributes({ label: val }),
                allowedFormats: [],
                placeholder: __("Label…", "custom-blocks"),
              }),
            ),

            // ── Unified card: heading + divider + body ──────────────
            wp.element.createElement(
              "div",
              { className: "dbp-card" },
              wp.element.createElement(
                "h2",
                { className: "dbp-heading" },
                wp.element.createElement(RichText, {
                  tagName: "span",
                  value: attributes.heading,
                  onChange: (val) => setAttributes({ heading: val }),
                  allowedFormats: [],
                  placeholder: __("Heading…", "custom-blocks"),
                }),
                " ",
                wp.element.createElement(RichText, {
                  tagName: "em",
                  className: "dbp-heading__highlight",
                  value: attributes.highlight,
                  onChange: (val) => setAttributes({ highlight: val }),
                  allowedFormats: [],
                  placeholder: __("preventable.", "custom-blocks"),
                }),
              ),
              wp.element.createElement("div", {
                className: "dbp-card__divider",
              }),
              wp.element.createElement(RichText, {
                tagName: "p",
                className: "dbp-body",
                value: attributes.body,
                onChange: (val) => setAttributes({ body: val }),
                allowedFormats: [],
                placeholder: __("Body text…", "custom-blocks"),
              }),
            ),

            // Stats
            wp.element.createElement(
              "div",
              { className: "dbp-stats" },
              wp.element.createElement(
                "div",
                { className: "dbp-stat dbp-stat--blue" },
                wp.element.createElement(
                  "span",
                  { className: "dbp-stat__num" },
                  attributes.stat1Num,
                ),
                wp.element.createElement(
                  "span",
                  { className: "dbp-stat__label" },
                  attributes.stat1Label,
                ),
              ),
              wp.element.createElement(
                "div",
                { className: "dbp-stat dbp-stat--orange" },
                wp.element.createElement(
                  "span",
                  { className: "dbp-stat__num" },
                  attributes.stat2Num,
                ),
                wp.element.createElement(
                  "span",
                  { className: "dbp-stat__label" },
                  attributes.stat2Label,
                ),
              ),
            ),

            // Buttons
            wp.element.createElement(
              "div",
              { className: "dbp-buttons" },
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
        ),
      );
    },

    save: ({ attributes }) => {
      const blockProps = useBlockProps.save({
        className: "dbp-section",
      });

      return wp.element.createElement(
        "section",
        blockProps,

        wp.element.createElement(
          "div",
          { className: "dbp-bg-wrapper" },
          wp.element.createElement("div", {
            className: "dbp-bg",
            style: attributes.bgImageUrl
              ? { "--dbp-bg-image": `url(${attributes.bgImageUrl})` }
              : {},
          }),
          wp.element.createElement("div", { className: "dbp-overlay" }),
        ),

        wp.element.createElement(
          "div",
          { className: "dbp-content" },
          wp.element.createElement(
            "div",
            { className: "dbp-text" },

            // Label pill
            wp.element.createElement(
              "div",
              { className: "dbp-label" },
              wp.element.createElement("span", {
                className: "dbp-label__dash",
              }),
              wp.element.createElement(RichText.Content, {
                tagName: "span",
                className: "dbp-label__text",
                value: attributes.label,
              }),
            ),

            // ── Unified card: heading + divider + body ──────────────
            wp.element.createElement(
              "div",
              { className: "dbp-card" },
              wp.element.createElement(
                "h2",
                { className: "dbp-heading" },
                wp.element.createElement(RichText.Content, {
                  tagName: "span",
                  value: attributes.heading,
                }),
                " ",
                wp.element.createElement(RichText.Content, {
                  tagName: "em",
                  className: "dbp-heading__highlight",
                  value: attributes.highlight,
                }),
              ),
              wp.element.createElement("div", {
                className: "dbp-card__divider",
              }),
              wp.element.createElement(RichText.Content, {
                tagName: "p",
                className: "dbp-body",
                value: attributes.body,
              }),
            ),

            // Stats
            wp.element.createElement(
              "div",
              { className: "dbp-stats" },
              wp.element.createElement(
                "div",
                { className: "dbp-stat dbp-stat--blue" },
                wp.element.createElement(
                  "span",
                  { className: "dbp-stat__num" },
                  attributes.stat1Num,
                ),
                wp.element.createElement(
                  "span",
                  { className: "dbp-stat__label" },
                  attributes.stat1Label,
                ),
              ),
              wp.element.createElement(
                "div",
                { className: "dbp-stat dbp-stat--orange" },
                wp.element.createElement(
                  "span",
                  { className: "dbp-stat__num" },
                  attributes.stat2Num,
                ),
                wp.element.createElement(
                  "span",
                  { className: "dbp-stat__label" },
                  attributes.stat2Label,
                ),
              ),
            ),

            // Buttons
            wp.element.createElement(
              "div",
              { className: "dbp-buttons" },
              wp.element.createElement(
                "a",
                { href: attributes.btn1Url, className: "block-toggle-btn" },
                attributes.btn1Text,
              ),
              wp.element.createElement(
                "a",
                {
                  href: attributes.btn2Url,
                  className: "block-toggle-btn is-style-outline",
                },
                attributes.btn2Text,
              ),
            ),
          ),
        ),
      );
    },
  });
