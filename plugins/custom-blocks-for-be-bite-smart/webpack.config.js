const defaultConfig = require("@wordpress/scripts/config/webpack.config");
const path = require("path");

module.exports = {
  ...defaultConfig,
  entry: {
    "article-or-commentary/index": "./src/article-or-commentary/index.js",
    "bio-card/index": "./src/bio-card/index.js",
    "bio-card/bio-toggle": "./src/bio-card/bio-toggle.js",
    "educational-content-download/index":
      "./src/educational-content-download/index.js",
    "educational-video-download/index":
      "./src/educational-video-download/index.js",
    "educational-coloring-book-download/index":
      "./src/educational-coloring-book-download/index.js",
    "episode-card/index": "./src/episode-card/index.js",
    "episode-fields/index": "./src/episode-fields/index.js",
    "episode-display/index": "./src/episode-display/index.js",
    "resource-fields/index": "./src/resource-fields/index.js",
    "resource-display/index": "./src/resource-display/index.js",
    "qa-entry-fields/index": "./src/qa-entry-fields/index.js",
    "qa-entry-display/index": "./src/qa-entry-display/index.js",
    "hero/index": "./src/hero/index.js",
    "news-and-coverage/index": "./src/news-and-coverage/index.js",
    "pdf-toggle/index": "./src/pdf-toggle/index.js",
    "press-release/index": "./src/press-release/index.js",
    "research-article/index": "./src/research-article/index.js",
    "sponsorship-contact/index": "./src/sponsorship-contact/index.js",
    "unfunded-episode/index": "./src/unfunded-episode/index.js",
    "video-quote/index": "./src/video-quote/index.js",
    "read-more": "./src/read-more.js",
    "toggle-system": "./src/toggle-system.js",
    "video-toggle": "./src/video-toggle.js",
    "qr-experience/index": "./src/qr-experience/index.js",
    "qr-experience/frontend": "./src/qr-experience/frontend.js",
    "read-more/index": "./src/read-more/index.js",
  },
  output: {
    path: path.resolve(__dirname, "build"),
    filename: "[name].js",
  },
};
