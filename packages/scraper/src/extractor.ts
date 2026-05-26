export interface RawPost {
  fbPostId: string;
  text: string;
  images: string[];
  author: string;
  authorUrl: string;
  timestamp: string;
  postUrl: string;
}

export const EXTRACTOR_SCRIPT = `
window.__fbScrape = (maxScrolls, delayMs) => {
  const sanitize = (raw) => raw
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\\s+/g, " ")
    .replace(/\\n{3,}/g, "\\n\\n")
    .trim();

  const extractPost = (el) => {
    const msgSel = '[data-ad-preview="message"], [data-ad-comet-preview="message"]';
    const text = sanitize(el.querySelector(msgSel)?.textContent ?? "");
    if (!text) return null;

    const images = Array.from(el.querySelectorAll('img[src*="scontent"], img[src*="fbcdn"]'))
      .map(img => img.src)
      .filter(src => src.includes("/") && !src.includes("emoji"));

    const authorEl = el.querySelector("h2 a, h3 a, h4 a, strong a");
    const timeEl = el.querySelector("abbr");
    const linkEl = el.querySelector('a[href*="/posts/"], a[href*="/photo/"]');
    const storeAttr = el.getAttribute("data-store");

    let fbPostId = "";
    try {
      const parsed = JSON.parse(storeAttr || "{}");
      fbPostId = parsed?.postID || parsed?.share_id || "";
    } catch {
      const parts = (linkEl?.getAttribute("href") || "").split("/posts/");
      fbPostId = parts[1]?.split("?")[0] || "";
    }
    if (!fbPostId) fbPostId = crypto.randomUUID();

    return {
      fbPostId,
      text,
      images,
      author: authorEl?.textContent ?? "",
      authorUrl: authorEl?.getAttribute("href") ?? "",
      timestamp: timeEl?.getAttribute("title") ?? timeEl?.textContent ?? "",
      postUrl: linkEl?.getAttribute("href") ?? "",
    };
  };

  const seen = new Map();
  const units = () => document.querySelectorAll('[data-pagelet^="FeedUnit"], [role="article"]');

  return (async () => {
    for (let i = 0; i < maxScrolls; i++) {
      for (const el of units()) {
        const p = extractPost(el);
        if (p && !seen.has(p.fbPostId)) seen.set(p.fbPostId, p);
      }
      if (i < maxScrolls - 1) {
        window.scrollBy(0, 900);
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
    return Array.from(seen.values());
  })();
};
`;

export function buildExtractorScript(maxScrolls: number, delayMs: number): string {
  return `window.__fbScrape(${maxScrolls}, ${delayMs})`;
}
