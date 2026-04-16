import "./style.css";

import { registerBlockType } from "@wordpress/blocks";
import {
  useBlockProps,
  RichText,
  InspectorControls,
  MediaUpload,
  MediaUploadCheck,
} from "@wordpress/block-editor";
import { PanelBody, TextControl, Button } from "@wordpress/components";
import { __ } from "@wordpress/i18n";

const editor_font_size = "16px";

const label_style = {
  display: "block",
  fontSize: editor_font_size,
  fontWeight: "600",
  marginBottom: "6px",
  color: "#f0ece4",
};

const section_style = {
  marginBottom: "24px",
  paddingBottom: "24px",
  borderBottom: "1px solid #333",
};

const hint_style = {
  fontSize: "12px",
  color: "#9ca3af",
  marginTop: "6px",
  fontStyle: "italic",
};

registerBlockType("custom/qr-experience", {
  title: __("QR Experience", "custom-blocks"),
  category: "widgets",

  edit: ({ attributes, setAttributes }) => {
    const blockProps = useBlockProps();

    const AudioUpload = ({ urlAttr, idAttr, label }) =>
      wp.element.createElement(
        "div",
        { style: { marginBottom: "16px" } },
        wp.element.createElement("label", { style: label_style }, label),
        wp.element.createElement(
          MediaUploadCheck,
          null,
          wp.element.createElement(MediaUpload, {
            onSelect: (media) =>
              setAttributes({ [urlAttr]: media.url, [idAttr]: media.id }),
            allowedTypes: ["audio"],
            value: attributes[idAttr],
            render: ({ open }) =>
              wp.element.createElement(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    flexWrap: "wrap",
                  },
                },
                attributes[urlAttr]
                  ? wp.element.createElement(
                      "span",
                      {
                        style: {
                          fontSize: "13px",
                          color: "#c4bdb0",
                          wordBreak: "break-all",
                          flex: 1,
                        },
                      },
                      attributes[urlAttr].split("/").pop(),
                    )
                  : wp.element.createElement(
                      "span",
                      {
                        style: {
                          fontSize: "13px",
                          color: "#6b7280",
                          fontStyle: "italic",
                        },
                      },
                      __("No audio selected", "custom-blocks"),
                    ),
                wp.element.createElement(
                  Button,
                  {
                    onClick: open,
                    variant: "secondary",
                    style: { fontSize: "13px" },
                  },
                  attributes[urlAttr]
                    ? __("Replace", "custom-blocks")
                    : __("Upload Audio", "custom-blocks"),
                ),
                attributes[urlAttr] &&
                  wp.element.createElement(
                    Button,
                    {
                      onClick: () =>
                        setAttributes({ [urlAttr]: "", [idAttr]: 0 }),
                      variant: "tertiary",
                      isDestructive: true,
                      style: { fontSize: "13px" },
                    },
                    __("Remove", "custom-blocks"),
                  ),
              ),
          }),
        ),
      );

    return wp.element.createElement(
      "div",
      blockProps,

      // ── Inspector Controls ─────────────────────────────────
      wp.element.createElement(
        InspectorControls,
        null,
        wp.element.createElement(
          PanelBody,
          { title: __("Come Home Button", "custom-blocks"), initialOpen: true },
          wp.element.createElement(TextControl, {
            label: __("Button label", "custom-blocks"),
            value: attributes.buttonLabel,
            onChange: (val) => setAttributes({ buttonLabel: val }),
            placeholder: "Come Home",
          }),
          wp.element.createElement(TextControl, {
            label: __("Button URL", "custom-blocks"),
            value: attributes.buttonUrl,
            onChange: (val) => setAttributes({ buttonUrl: val }),
            placeholder: "https://yoursite.com",
            type: "url",
          }),
        ),
      ),

      // ── Editor canvas ──────────────────────────────────────
      wp.element.createElement(
        "div",
        {
          style: {
            background: "#111",
            color: "#f0ece4",
            padding: "24px",
            borderRadius: "6px",
          },
        },

        wp.element.createElement(
          "p",
          {
            style: {
              fontSize: "11px",
              color: "#6b7280",
              marginBottom: "20px",
              fontStyle: "italic",
            },
          },
          "QR Experience Block — fill in each section below",
        ),

        // ── Intro text ───────────────────────────────────────
        wp.element.createElement(
          "div",
          { style: section_style },
          wp.element.createElement(
            "label",
            { style: label_style },
            "Intro Text (shown before mode selection)",
          ),
          wp.element.createElement(RichText, {
            tagName: "p",
            placeholder: __(
              "e.g. Learn how to prevent dog bites with Be BiteSmart",
              "custom-blocks",
            ),
            value: attributes.introText,
            onChange: (val) => setAttributes({ introText: val }),
            style: {
              fontSize: editor_font_size,
              color: "#e8e0d0",
              lineHeight: "1.7",
            },
          }),
        ),

        // ── Opening audio ────────────────────────────────────
        wp.element.createElement(
          "div",
          { style: section_style },
          wp.element.createElement(AudioUpload, {
            urlAttr: "openingAudioUrl",
            idAttr: "openingAudioId",
            label: "Opening Audio (Step 1)",
          }),
          wp.element.createElement(
            "label",
            { style: { ...label_style, marginTop: "16px" } },
            "Opening Transcript (toggle-able by user)",
          ),
          wp.element.createElement(RichText, {
            tagName: "p",
            placeholder: __(
              "Full transcript of the opening audio…",
              "custom-blocks",
            ),
            value: attributes.openingTranscript,
            onChange: (val) => setAttributes({ openingTranscript: val }),
            style: { fontSize: "14px", color: "#c4bdb0", lineHeight: "1.7" },
          }),
        ),

        // ── Vimeo ID ─────────────────────────────────────────
        wp.element.createElement(
          "div",
          { style: section_style },
          wp.element.createElement(
            "label",
            { style: label_style },
            "Vimeo Video ID (Step 2)",
          ),
          wp.element.createElement("input", {
            type: "text",
            placeholder: "e.g. 123456789",
            value: attributes.vimeoId || "",
            onChange: (e) => setAttributes({ vimeoId: e.target.value }),
            style: {
              width: "100%",
              padding: "6px 10px",
              fontSize: "14px",
              background: "#1a1a1a",
              border: "1px solid #444",
              borderRadius: "4px",
              color: "#f0ece4",
              outline: "none",
            },
          }),
          wp.element.createElement(
            "p",
            { style: hint_style },
            "Find the ID in your Vimeo URL: vimeo.com/123456789",
          ),
        ),

        // ── Closing audio ────────────────────────────────────
        wp.element.createElement(
          "div",
          { style: { color: "#f0ece4" } },
          wp.element.createElement(AudioUpload, {
            urlAttr: "closingAudioUrl",
            idAttr: "closingAudioId",
            label: "Closing Audio (Step 3)",
          }),
          wp.element.createElement(
            "label",
            { style: { ...label_style, marginTop: "16px" } },
            "Closing Transcript (toggle-able by user)",
          ),
          wp.element.createElement(RichText, {
            tagName: "p",
            placeholder: __(
              "Full transcript of the closing audio…",
              "custom-blocks",
            ),
            value: attributes.closingTranscript,
            onChange: (val) => setAttributes({ closingTranscript: val }),
            style: { fontSize: "14px", color: "#c4bdb0", lineHeight: "1.7" },
          }),
        ),
      ),
    );
  },

  // Dynamic block — frontend rendered by render.php
  save: () => null,
});
