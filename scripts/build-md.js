// Generates a Markdown representation of each content page from its <main> region.
// Output .md files are served via content negotiation (see functions/_middleware.js)
// when an agent requests `Accept: text/markdown`. Re-run after any content change:
//   npm run build:md
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const TurndownService = require("turndown");

const ROOT = path.join(__dirname, "..");
const SITE = "https://eightit.com";

// html file -> { md output, canonical path }
const PAGES = [
  { html: "index.html", md: "index.md", url: "/" },
  { html: "services.html", md: "services.md", url: "/services" },
  { html: "accessibility.html", md: "accessibility.md", url: "/accessibility" },
  { html: "privacy.html", md: "privacy.md", url: "/privacy" },
  { html: "do-not-sell.html", md: "do-not-sell.md", url: "/do-not-sell" },
  { html: "terms.html", md: "terms.md", url: "/terms" },
  { html: "downloads.html", md: "downloads.md", url: "/downloads" },
];

const td = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});
// Drop non-content nodes outright rather than rendering empty artifacts.
td.remove(["script", "style", "noscript", "svg", "form", "button", "iframe"]);

function convert({ html, md, url }) {
  const src = fs.readFileSync(path.join(ROOT, html), "utf8");
  const dom = new JSDOM(src);
  const doc = dom.window.document;
  const main = doc.querySelector("main") || doc.body;
  const title = (doc.querySelector("title")?.textContent || "Eight IT").trim();

  // Drop dynamic/decorative regions that carry no durable page content:
  // the live status ticker, scroll-progress bar, and aria-hidden duplicates.
  main
    .querySelectorAll('.status-ticker, .scroll-progress, [aria-hidden="true"]')
    .forEach((el) => el.remove());

  const body = td.turndown(main.innerHTML).replace(/\n{3,}/g, "\n\n").trim();
  const out = `# ${title}\n\nSource: ${SITE}${url}\n\n${body}\n`;
  fs.writeFileSync(path.join(ROOT, md), out, "utf8");
  return { md, bytes: Buffer.byteLength(out) };
}

const results = PAGES.map(convert);
for (const r of results) console.log(`  ${r.md.padEnd(20)} ${r.bytes} bytes`);
console.log(`Generated ${results.length} markdown files.`);
