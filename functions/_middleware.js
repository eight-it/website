// Markdown content negotiation for AI agents.
// When a client sends `Accept: text/markdown`, serve the pre-generated Markdown
// representation of the page (built by scripts/build-md.js) instead of HTML.
// Any non-markdown request, unknown path, or error falls through to normal serving.

const MD_PAGES = new Set([
  "index",
  "services",
  "accessibility",
  "privacy",
  "do-not-sell",
  "terms",
  "downloads",
]);

export async function onRequest(context) {
  const { request, env, next } = context;
  try {
    const accept = request.headers.get("Accept") || "";
    if (request.method !== "GET" || !/text\/markdown/i.test(accept) || !env.ASSETS) {
      return next();
    }

    const url = new URL(request.url);
    const slug =
      url.pathname === "/"
        ? "index"
        : url.pathname.replace(/^\//, "").replace(/\.html$/, "").replace(/\/$/, "");

    if (!MD_PAGES.has(slug)) return next();

    const asset = await env.ASSETS.fetch(new Request(new URL(`/${slug}.md`, url.origin)));
    if (!asset.ok) return next();

    const body = await asset.text();
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "X-Markdown-Tokens": String(Math.ceil(body.length / 4)),
        "Content-Signal": "search=yes, ai-input=yes, ai-train=no",
        "Cache-Control": "public, max-age=3600",
        "Vary": "Accept",
      },
    });
  } catch {
    return next();
  }
}
