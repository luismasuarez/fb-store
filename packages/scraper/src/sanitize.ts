export function sanitizeFacebookText(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/(Facebook\s*){2,}/gi, "")
    .replace(/\bFacebook\b/gi, "")
    .replace(/\bVer\s+más\b/gi, "")
    .replace(/\bCompartir\b/gi, "")
    .replace(/\bReaccion(es)?\b/gi, "")
    .replace(/\d+[.,]?\d*[Kk]?\s*(me gusta|compartido|comentarios|reacciones?)/gi, "")
    .replace(/https?:\/\/[^\s]+/g, "")
    .replace(/\s+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
