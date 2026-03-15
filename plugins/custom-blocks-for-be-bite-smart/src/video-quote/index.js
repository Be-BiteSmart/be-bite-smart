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

registerBlockType("custom/video-quote", {
  title: __("Documentary Video", "custom-blocks"),
  category: "widgets",

  supports: {
    fontSize: true,
    color: { background: true, text: true },
    spacing: { margin: true, padding: true },
  },

  attributes: {
    title: { type: "string", default: "" },
    vimeoUrl: { type: "string", default: "" },
    thumbnailUrl: { type: "string", default: "" },
    thumbnailId: { type: "number" },
    quote: { type: "string", default: "" },
    quoteSource: { type: "string", default: "" },
    note: { type: "string", default: "" },
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
          { title: __("Video Settings", "custom-blocks") },

          wp.element.createElement(TextControl, {
            label: __("Vimeo URL", "custom-blocks"),
            value: attributes.vimeoUrl,
            onChange: (val) => setAttributes({ vimeoUrl: val }),
            placeholder: "https://vimeo.com/123456789",
            help: __("Paste the full Vimeo URL", "custom-blocks"),
          }),

          wp.element.createElement("hr", { style: { margin: "20px 0" } }),

          wp.element.createElement(
            "p",
            { style: { marginBottom: "8px", fontWeight: "500" } },
            __("Thumbnail Image", "custom-blocks"),
          ),
          wp.element.createElement(
            MediaUploadCheck,
            null,
            wp.element.createElement(MediaUpload, {
              onSelect: (media) =>
                setAttributes({
                  thumbnailUrl: media.url,
                  thumbnailId: media.id,
                }),
              allowedTypes: ["image"],
              value: attributes.thumbnailId,
              render: ({ open }) =>
                wp.element.createElement(
                  "div",
                  null,
                  attributes.thumbnailUrl
                    ? wp.element.createElement(
                        "div",
                        null,
                        wp.element.createElement("img", {
                          src: attributes.thumbnailUrl,
                          alt: "Thumbnail preview",
                          style: { maxWidth: "100%", marginBottom: "8px" },
                        }),
                        wp.element.createElement(
                          Button,
                          {
                            onClick: open,
                            variant: "secondary",
                            style: { marginRight: "8px" },
                          },
                          __("Replace Image", "custom-blocks"),
                        ),
                        wp.element.createElement(
                          Button,
                          {
                            onClick: () =>
                              setAttributes({
                                thumbnailUrl: "",
                                thumbnailId: null,
                              }),
                            variant: "tertiary",
                            isDestructive: true,
                          },
                          __("Remove", "custom-blocks"),
                        ),
                      )
                    : wp.element.createElement(
                        Button,
                        { onClick: open, variant: "primary" },
                        __("Upload Thumbnail", "custom-blocks"),
                      ),
                ),
            }),
          ),
        ),
      ),

      // Title
      wp.element.createElement(RichText, {
        tagName: "h3",
        placeholder: __("Video Title", "custom-blocks"),
        value: attributes.title,
        onChange: (val) => setAttributes({ title: val }),
        style: { marginBottom: "1rem", fontWeight: "bold" },
      }),

      // Editor Preview
      wp.element.createElement(
        "div",
        { style: { marginBottom: "1rem" } },
        attributes.thumbnailUrl
          ? wp.element.createElement("img", {
              src: attributes.thumbnailUrl,
              alt: "Video thumbnail",
              style: {
                maxWidth: "400px",
                width: "100%",
                height: "auto",
                display: "block",
              },
            })
          : wp.element.createElement(
              "div",
              {
                style: {
                  padding: "60px 20px",
                  background: "#f0f0f0",
                  textAlign: "center",
                  border: "2px dashed #ddd",
                },
              },
              "Upload a thumbnail in the sidebar →",
            ),
      ),

      // Quote
      wp.element.createElement(
        "blockquote",
        { style: { marginTop: "1rem" } },
        wp.element.createElement(
          "p",
          null,
          wp.element.createElement("strong", null, "Quote: "),
          wp.element.createElement("span", null, '"'),
          wp.element.createElement(RichText, {
            tagName: "span",
            value: attributes.quote,
            onChange: (val) => setAttributes({ quote: val }),
            placeholder: __("Enter quote…", "custom-blocks"),
            style: { fontStyle: "italic", display: "inline" },
          }),
          wp.element.createElement("span", null, '"'),
        ),
        wp.element.createElement(
          "cite",
          { style: { fontStyle: "normal", marginLeft: "0.5em" } },
          "— ",
          wp.element.createElement(RichText, {
            tagName: "span",
            value: attributes.quoteSource,
            onChange: (val) => setAttributes({ quoteSource: val }),
            placeholder: __("Source (optional)", "custom-blocks"),
            style: { display: "inline" },
          }),
        ),
      ),

      // Optional note
      wp.element.createElement(
        "p",
        { style: { marginTop: "0.75rem" } },
        wp.element.createElement(RichText, {
          tagName: "span",
          value: attributes.note,
          className: "video-quote-note",
          onChange: (val) => setAttributes({ note: val }),
          placeholder: __("Additional note (optional)", "custom-blocks"),
        }),
      ),
    );
  },

  save: () => {
    return null;
  },
});
