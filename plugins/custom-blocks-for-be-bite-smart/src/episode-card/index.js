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
import { getSiteLanguages } from "../shared/languages";
import {
  episodeArticleDataAttributes,
  migrateEpisodeAttributes,
  renderLanguagePicker,
  videosFromAttributes,
} from "./episode-helpers";
import { LangRestartDialogPanel } from "./lang-restart-dialog-panel";

const EPISODE_ATTRIBUTES = {
  episodeNumber: { type: "string", default: "" },
  title: { type: "string", default: "" },
  description: { type: "string", default: "" },
  videosByLang: {
    type: "object",
    default: {},
  },
  thumbnailUrl: { type: "string", default: "" },
  thumbnailId: { type: "number" },
  downloadsPageUrl: { type: "string", default: "" },
  fundedByName: { type: "string", default: "" },
  fundedByLogoUrl: { type: "string", default: "" },
  fundedByLogoId: { type: "number" },
};

const LEGACY_EPISODE_ATTRIBUTES = {
  ...EPISODE_ATTRIBUTES,
  vimeoUrlEn: { type: "string", default: "" },
  vimeoUrlEs: { type: "string", default: "" },
};

function EpisodeCardSave({ attributes }) {
  const blockProps = useBlockProps.save();
  const urlsByLang = videosFromAttributes(attributes);
  const dataAttrs = episodeArticleDataAttributes(attributes);
  const languages = getSiteLanguages();
  const defaultWatch =
    languages.find((lang) => lang.code === "en")?.watchLabel ?? "Watch Now";

  return wp.element.createElement(
    "article",
    {
      ...blockProps,
      className: `${blockProps.className || ""} video-episode-block`.trim(),
      ...dataAttrs,
    },

    wp.element.createElement(
      "div",
      {
        className:
          "episode-card-container custom-block-card custom-block-border",
      },

      wp.element.createElement(
        "div",
        { className: "episode-card-main" },

        wp.element.createElement(
          "div",
          { className: "episode-thumbnail-section" },
          wp.element.createElement(
            "div",
            { className: "video-thumbnail-wrapper" },
            wp.element.createElement(
              "div",
              { className: "video-thumbnail" },
              attributes.thumbnailUrl &&
                wp.element.createElement("img", {
                  src: attributes.thumbnailUrl,
                  alt: attributes.title || "Video thumbnail",
                  loading: "lazy",
                }),
              wp.element.createElement(
                "div",
                { className: "video-overlay" },
                wp.element.createElement("button", {
                  className: "play-button",
                  "aria-label": "Play video",
                  type: "button",
                }),
              ),
            ),
            wp.element.createElement("div", { className: "video-player" }),
          ),
        ),

        wp.element.createElement(
          "div",
          { className: "episode-content-section" },

          attributes.title &&
            wp.element.createElement(
              "span",
              { className: "episode-number" },
              "Episode " + attributes.episodeNumber,
            ),

          attributes.title &&
            wp.element.createElement(RichText.Content, {
              tagName: "h3",
              className: "episode-title",
              value: attributes.title,
            }),

          attributes.description &&
            wp.element.createElement(RichText.Content, {
              tagName: "p",
              className: "episode-description",
              value: attributes.description,
            }),

          wp.element.createElement(
            "div",
            { className: "episode-controls" },

            renderLanguagePicker(wp, urlsByLang, { activeCode: "en" }),

            wp.element.createElement(
              "button",
              {
                className: "watch-now-button block-toggle-btn",
                type: "button",
              },
              wp.element.createElement(
                "span",
                { className: "button-text" },
                defaultWatch,
              ),
            ),
          ),
        ),
      ),

      attributes.downloadsPageUrl &&
        wp.element.createElement(
          "div",
          { className: "download-note" },
          wp.element.createElement(
            "p",
            { className: "download-note-text" },
            wp.element.createElement(
              "strong",
              null,
              "Videos and coloring books are available to download.",
            ),
          ),
          wp.element.createElement(
            "a",
            {
              href: attributes.downloadsPageUrl,
              className: "download-link-btn block-toggle-btn is-style-outline",
            },
            "Go to Downloads",
          ),
        ),

      attributes.fundedByName &&
        wp.element.createElement(
          "div",
          { className: "episode-funded-by" },
          wp.element.createElement(
            "span",
            { className: "episode-funded-by-label" },
            "Funded by:",
          ),
          wp.element.createElement(
            "span",
            { className: "episode-funded-by-credit" },
            attributes.fundedByLogoUrl &&
              wp.element.createElement("img", {
                src: attributes.fundedByLogoUrl,
                alt: attributes.fundedByName,
                className: "episode-funded-by-logo",
                "aria-hidden": "true",
              }),
            wp.element.createElement(
              "span",
              { className: "episode-funded-by-name" },
              attributes.fundedByName,
            ),
          ),
        ),
    ),
  );
}

function EpisodeCardEdit({ attributes, setAttributes }) {
  const blockProps = useBlockProps();
  const urlsByLang = videosFromAttributes(attributes);
  const languages = getSiteLanguages();

  const setVideoUrl = (code, url) => {
    setAttributes({
      videosByLang: {
        ...urlsByLang,
        [code]: url,
      },
    });
  };

  return wp.element.createElement(
    "div",
    blockProps,

    wp.element.createElement(
      InspectorControls,
      null,

      wp.element.createElement(
        PanelBody,
        { title: __("Video Settings", "custom-blocks") },

        languages.map((lang) =>
          wp.element.createElement(TextControl, {
            key: lang.code,
            label: __("Vimeo URL", "custom-blocks") + ` (${lang.name})`,
            value: urlsByLang[lang.code] || "",
            onChange: (val) => setVideoUrl(lang.code, val),
            placeholder: "https://vimeo.com/123456789",
            help: __("Paste the full Vimeo URL", "custom-blocks"),
          }),
        ),

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

        wp.element.createElement("hr", { style: { margin: "20px 0" } }),

        wp.element.createElement(TextControl, {
          label: __("Downloads Page URL", "custom-blocks"),
          value: attributes.downloadsPageUrl,
          onChange: (val) => setAttributes({ downloadsPageUrl: val }),
          placeholder: "https://yoursite.com/downloads",
          help: __(
            "Link to the page where visitors can download videos and coloring books.",
            "custom-blocks",
          ),
        }),
      ),
    ),

    wp.element.createElement(
      InspectorControls,
      null,
      wp.element.createElement(LangRestartDialogPanel, null),
    ),

    wp.element.createElement(
      InspectorControls,
      null,
      wp.element.createElement(
        PanelBody,
        {
          title: __("Funding Credit", "custom-blocks"),
          initialOpen: false,
        },

        wp.element.createElement(TextControl, {
          label: __("Funded By", "custom-blocks"),
          value: attributes.fundedByName,
          onChange: (val) => setAttributes({ fundedByName: val }),
          placeholder: "e.g. The Horne Foundation",
          help: __("Leave blank to hide the funded-by bar.", "custom-blocks"),
        }),

        wp.element.createElement("hr", { style: { margin: "20px 0" } }),

        wp.element.createElement(
          "p",
          { style: { marginBottom: "8px", fontWeight: "500" } },
          __("Sponsor Logo (optional)", "custom-blocks"),
        ),
        wp.element.createElement(
          MediaUploadCheck,
          null,
          wp.element.createElement(MediaUpload, {
            onSelect: (media) =>
              setAttributes({
                fundedByLogoUrl: media.url,
                fundedByLogoId: media.id,
              }),
            allowedTypes: ["image"],
            value: attributes.fundedByLogoId,
            render: ({ open }) =>
              wp.element.createElement(
                "div",
                null,
                attributes.fundedByLogoUrl
                  ? wp.element.createElement(
                      "div",
                      null,
                      wp.element.createElement("img", {
                        src: attributes.fundedByLogoUrl,
                        alt: "Sponsor logo preview",
                        style: { maxWidth: "100%", marginBottom: "8px" },
                      }),
                      wp.element.createElement(
                        Button,
                        {
                          onClick: open,
                          variant: "secondary",
                          style: { marginRight: "8px" },
                        },
                        __("Replace Logo", "custom-blocks"),
                      ),
                      wp.element.createElement(
                        Button,
                        {
                          onClick: () =>
                            setAttributes({
                              fundedByLogoUrl: "",
                              fundedByLogoId: null,
                            }),
                          variant: "tertiary",
                          isDestructive: true,
                        },
                        __("Remove", "custom-blocks"),
                      ),
                    )
                  : wp.element.createElement(
                      Button,
                      { onClick: open, variant: "secondary" },
                      __("Upload Logo", "custom-blocks"),
                    ),
              ),
          }),
        ),
      ),
    ),

    wp.element.createElement(
      "div",
      { className: "episode-editor-fields" },

      wp.element.createElement(
        "div",
        { className: "episode-editor-field" },
        wp.element.createElement("label", null, "Episode Number"),
        wp.element.createElement(
          "p",
          { className: "episode-field-hint" },
          "Just the number, e.g. 1",
        ),
        wp.element.createElement(TextControl, {
          placeholder: "e.g. 1",
          value: attributes.episodeNumber,
          onChange: (val) => setAttributes({ episodeNumber: val }),
        }),
      ),

      wp.element.createElement(
        "div",
        { className: "episode-editor-field" },
        wp.element.createElement("label", null, "Episode Title"),
        wp.element.createElement(
          "p",
          { className: "episode-field-hint" },
          "The full episode title, e.g. Respect the Bubble",
        ),
        wp.element.createElement(TextControl, {
          placeholder: "e.g. Respect the Bubble",
          value: attributes.title,
          onChange: (val) => setAttributes({ title: val }),
        }),
      ),

      wp.element.createElement(
        "div",
        { className: "episode-editor-field" },
        wp.element.createElement("label", null, "Lesson Description"),
        wp.element.createElement(
          "p",
          { className: "episode-field-hint" },
          "Short description shown below the title",
        ),
        wp.element.createElement(RichText, {
          tagName: "p",
          placeholder: "e.g. Introducing a dog's stress signals.",
          value: attributes.description,
          onChange: (val) => setAttributes({ description: val }),
        }),
      ),
    ),

    wp.element.createElement(
      "div",
      { className: "video-preview-editor" },
      attributes.thumbnailUrl
        ? wp.element.createElement("img", {
            src: attributes.thumbnailUrl,
            alt: "Video thumbnail",
            style: {
              maxWidth: "300px",
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
  );
}

registerBlockType("custom/episode-card", {
  title: __("Video Episode", "custom-blocks"),
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

  attributes: EPISODE_ATTRIBUTES,

  edit: EpisodeCardEdit,

  save: EpisodeCardSave,

  deprecated: [
    {
      attributes: LEGACY_EPISODE_ATTRIBUTES,
      isEligible: (attributes) =>
        Boolean(attributes.vimeoUrlEn || attributes.vimeoUrlEs) &&
        (!attributes.videosByLang ||
          Object.keys(attributes.videosByLang).length === 0),
      migrate: migrateEpisodeAttributes,
      save: ({ attributes }) =>
        EpisodeCardSave({ attributes: migrateEpisodeAttributes(attributes) }),
    },
  ],
});
