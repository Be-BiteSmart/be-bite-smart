import { registerBlockType } from "@wordpress/blocks";
import { attributesForFeatures } from "./attributes";
import { DownloadCardEdit } from "./edit";
import { DownloadCardSave } from "./save";

/**
 * Register a download card block with shared edit/save and per-block features.
 *
 * @param {object} options
 * @param {string} options.name - Block name, e.g. custom/educational-video-download
 * @param {string} options.title
 * @param {string} options.description
 * @param {string} options.icon
 * @param {string} options.wrapperClassName - Front-end wrapper class for analytics/CSS
 * @param {string} options.blockIdPrefix - Stable id prefix for toggles/viewers
 * @param {{ pdf: boolean, downloadLinks: boolean, trackingSlug?: boolean, comingSoonWhenEmpty?: boolean }} options.features
 * @param {string} [options.editorHelp] - Inspector sidebar help text
 */
export function registerDownloadCardBlock({
  name,
  title,
  description,
  icon,
  wrapperClassName,
  blockIdPrefix,
  features,
  editorHelp,
}) {
  const config = {
    wrapperClassName,
    blockIdPrefix,
    features: {
      trackingSlug: false,
      comingSoonWhenEmpty: false,
      ...features,
    },
    editorHelp,
  };

  registerBlockType(name, {
    title,
    category: "widgets",
    icon,
    description,
    supports: {
      spacing: { margin: true, padding: true },
    },
    attributes: attributesForFeatures(config.features),
    edit: (props) =>
      DownloadCardEdit({ ...props, config }),
    save: (props) =>
      DownloadCardSave({ ...props, config }),
  });
}
