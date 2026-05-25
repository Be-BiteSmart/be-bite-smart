import "../shared/download-card/style.css";
import { registerDownloadCardBlock } from "../shared/download-card/register";

registerDownloadCardBlock({
  name: "custom/educational-video-download",
  title: "Episode Video Download",
  icon: "video-alt3",
  description:
    "EN/ES video file download links for one episode (no PDF viewer).",
  wrapperClassName: "educational-video-download-block",
  blockIdPrefix: "ecd",
  features: {
    pdf: false,
    downloadLinks: true,
  },
  editorHelp:
    "Paste English and/or Spanish download links. Each language gets its own row with a Download button when a link is added.",
});
