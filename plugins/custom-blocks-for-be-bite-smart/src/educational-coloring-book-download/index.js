import "../shared/download-card/style.css";
import { registerDownloadCardBlock } from "../shared/download-card/register";

registerDownloadCardBlock({
  name: "custom/educational-coloring-book-download",
  title: "Educational Coloring Book Download",
  icon: "art",
  description:
    "Coloring book PDFs per episode — View PDF and Download in EN/ES rows when uploaded.",
  wrapperClassName: "educational-coloring-book-download-block",
  blockIdPrefix: "ecd",
  anchorPrefix: "coloring-books",
  features: {
    pdf: true,
    downloadLinks: false,
    comingSoonWhenEmpty: true,
  },
  editorHelp:
    "Upload English and/or Spanish PDFs. Each language appears as its own row with View PDF and Download, like the PDF Toggle block.",
});
