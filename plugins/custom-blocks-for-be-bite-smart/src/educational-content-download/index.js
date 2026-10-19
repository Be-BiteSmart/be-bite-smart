import "../shared/download-card/style.css";
import { registerDownloadCardBlock } from "../shared/download-card/register";

registerDownloadCardBlock({
  name: "custom/educational-content-download",
  title: "Educational Content Download",
  icon: "download",
  description:
    "Worksheets and guides: per-language rows with View PDF + Download when a PDF is uploaded, or a download link alone.",
  wrapperClassName: "educational-content-download-block",
  blockIdPrefix: "ecd",
  features: {
    pdf: true,
    downloadLinks: true,
    trackingSlug: true,
    resourcePageLink: true,
  },
  text: {
    showNumber: false,
    contentTypePlaceholder: "Content type (e.g. Article)",
    titlePlaceholder: "Title",
    mediaLabel: "PDF",
    itemLabel: "PDF",
    resourcePageLinkLabel: "Go to resource's page",
  },
  editorHelp:
    "Use this shared card for articles, worksheets, guides, or other materials. Set the content type, then add a PDF or download link for each language.",
});
