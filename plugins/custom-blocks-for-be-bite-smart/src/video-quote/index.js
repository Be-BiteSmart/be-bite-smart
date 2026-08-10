import "./style.css";

import { registerBlockType } from "@wordpress/blocks";
import {
  useBlockProps,
  RichText,
  InspectorControls,
  MediaUpload,
  MediaUploadCheck,
} from "@wordpress/block-editor";
import {
  PanelBody,
  TextControl,
  CheckboxControl,
  Notice,
  Button,
} from "@wordpress/components";
import { __, sprintf } from "@wordpress/i18n";
import { ensureDefaultLanguage, getSiteLanguages } from "../shared/languages";
import { useVimeoTrackCheck } from "../shared/vimeo-track-check";

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
    availableLanguages: { type: "array", default: ["en"] },
  },

  edit: ({ attributes, setAttributes, isSelected }) => {
    const blockProps = useBlockProps();
    const languages = getSiteLanguages();
    const availableLanguages = attributes.availableLanguages || ["en"];
    const trackCheck = useVimeoTrackCheck(attributes.vimeoUrl, isSelected);

    const toggleLanguage = (code, checked) => {
      if (code === "en") return; // English is always available, locked on
      const next = checked
        ? [...availableLanguages, code]
        : availableLanguages.filter((c) => c !== code);
      setAttributes({ availableLanguages: ensureDefaultLanguage(next) });
    };

    return wp.element.createElement(
      "div",
      blockProps,

      // Hidden offscreen Vimeo embed used only to check which caption/audio
      // tracks this video actually has on Vimeo — never visible, only
      // mounted while the block is selected (see useVimeoTrackCheck).
      wp.element.createElement("div", {
        ref: trackCheck.containerRef,
        style: trackCheck.offscreenStyle,
        "aria-hidden": "true",
      }),

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

      // Available Languages
      wp.element.createElement(
        InspectorControls,
        null,
        wp.element.createElement(
          PanelBody,
          { title: __("Available Languages", "custom-blocks") },
          __(
            "Check off which languages this video has subtitles and dubbed audio for on Vimeo.",
            "custom-blocks",
          ),

          trackCheck.status === "error" &&
            wp.element.createElement(
              Notice,
              { status: "warning", isDismissible: false },
              __(
                "Couldn't check Vimeo for available languages.",
                "custom-blocks",
              ),
            ),

          languages.map((lang) => {
            const isChecked = availableLanguages.includes(lang.code);
            const skipValidation =
              lang.code === "en" || trackCheck.status !== "ready";

            let helpText =
              lang.code === "en"
                ? __("English is always available.", "custom-blocks")
                : undefined;
            let warning = null;

            if (!skipValidation) {
              const hasCaptions = trackCheck.captionLangs.includes(lang.code);
              const hasAudio = trackCheck.audioLangs.includes(lang.code);

              if (hasCaptions && hasAudio) {
                helpText = __("✓ captions + audio on Vimeo", "custom-blocks");
              } else if (hasCaptions) {
                helpText = __(
                  "⚠ captions only — no dubbed audio yet",
                  "custom-blocks",
                );
              } else {
                helpText = __("⚠ not found on Vimeo yet", "custom-blocks");
              }

              if (isChecked && !hasCaptions && !hasAudio) {
                warning = wp.element.createElement(
                  Notice,
                  {
                    status: "warning",
                    isDismissible: false,
                    key: `${lang.code}-warning`,
                  },
                  sprintf(
                    __(
                      '"%s" is checked, but Vimeo has no captions or audio track for it yet — visitors won\'t be able to switch to it.',
                      "custom-blocks",
                    ),
                    lang.name,
                  ),
                );
              }
            }

            return wp.element.createElement(
              wp.element.Fragment,
              { key: lang.code },
              wp.element.createElement(CheckboxControl, {
                label: lang.name,
                checked: isChecked,
                disabled: lang.code === "en",
                help: helpText,
                onChange: (checked) => toggleLanguage(lang.code, checked),
              }),
              warning,
            );
          }),
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
