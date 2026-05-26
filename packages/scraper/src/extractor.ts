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
(function() {
  var feed = document.querySelector('[role="feed"]');
  if (!feed) return [];
  var postEls = feed.querySelectorAll('[aria-posinset]');
  var seen = new Map();
  var extracted = [];

  for (var j = 0; j < postEls.length; j++) {
    var el = postEls[j];
    if (el.querySelector('[data-virtualized="true"]')) continue;

    var links = el.querySelectorAll('a');
    var photoId = "", photoHref = "";
    for (var k = 0; k < links.length; k++) {
      var href = links[k].getAttribute("href") || "";
      var m = href.match(/fbid=(\\d+)/);
      if (m) { photoId = m[1]; photoHref = href; break; }
    }
    if (!photoId || seen.has(photoId)) continue;
    seen.set(photoId, true);

    var imgs = [];
    var imgEls = el.querySelectorAll('img[src*="scontent"]');
    for (var n = 0; n < imgEls.length; n++) {
      var src = imgEls[n].src;
      if (src.indexOf("/") > -1) imgs.push(src);
    }

    var rawText = (el.innerText || "").trim();
    var cleanText = rawText.replace(/(Facebook\\s*){2,}/g, "").replace(/\\s+/g, " ").trim();

    var authorLink = el.querySelector('a[href*="/user/"]');
    var abbr = el.querySelector("abbr");
    var timeEl = el.querySelector("time");

    extracted.push({
      fbPostId: "fb-" + photoId,
      text: cleanText || "(solo imagenes)",
      images: imgs,
      author: authorLink ? (authorLink.textContent || "").split("\\n")[0].trim() : "",
      authorUrl: authorLink ? authorLink.getAttribute("href") : "",
      timestamp: abbr ? (abbr.getAttribute("title") || abbr.textContent) : (timeEl ? timeEl.textContent : ""),
      postUrl: photoHref,
    });
  }
  return extracted;
})()
`;
