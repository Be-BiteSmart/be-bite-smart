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
    "episode-card/index": "./src/episode-card/index.js",
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
  },
  output: {
    path: path.resolve(__dirname, "build"),
    filename: "[name].js",
  },
};
