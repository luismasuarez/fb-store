export interface RawPost {
  fbPostId: string;
  text: string;
  images: string[];
  author: string;
  authorUrl: string;
  timestamp: string;
  postUrl: string;
  _debugImgs?: { src: string; dataSrc: string; w: number; h: number; visible: boolean }[];
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
    var debugImgs = [];

    // Debug: dump ALL img elements in this post
    var allImgEls = el.querySelectorAll('img');
    for (var n = 0; n < allImgEls.length; n++) {
      var img = allImgEls[n];
      var src = img.src || "";
      var dataSrc = img.getAttribute("data-src") || "";
      var rect = img.getBoundingClientRect();
      debugImgs.push({
        src: src.substring(0, 120),
        dataSrc: dataSrc.substring(0, 120),
        w: Math.round(img.offsetWidth),
        h: Math.round(img.offsetHeight),
        visible: rect.width > 0 && rect.height > 0,
      });

      // Try to collect image URLs from multiple sources
      var candidates = [src, dataSrc];
      if (window.getComputedStyle) {
        var bg = window.getComputedStyle(img).backgroundImage || "";
        if (bg && bg.indexOf("fbcdn") > -1) {
          var m = bg.match(/url\("?(.*?)"?\)/);
          if (m) candidates.push(m[1]);
        }
      }
      for (var c = 0; c < candidates.length; c++) {
        var candidate = candidates[c];
        if (candidate && candidate.indexOf("/") > -1 && !candidate.startsWith("data:")) {
          imgs.push(candidate);
        }
      }
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
      _debugImgs: debugImgs,
      author: authorLink ? (authorLink.textContent || "").split("\\n")[0].trim() : "",
      authorUrl: authorLink ? authorLink.getAttribute("href") : "",
      timestamp: abbr ? (abbr.getAttribute("title") || abbr.textContent) : (timeEl ? timeEl.textContent : ""),
      postUrl: photoHref,
    });
  }
  return extracted;
})()
`;
