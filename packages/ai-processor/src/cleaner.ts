const COMMENT_PATTERNS = [
  /^Comentar como\s/i,
  /^Ver más comentarios/i,
  /^Ver\s+\d+\s+respuesta/i,
  /^Todas las\s*:/,
  /\b(Me gusta|Comentar|Compartir)\s*$/,
];

function isCommentLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (COMMENT_PATTERNS.some((p) => p.test(trimmed))) return true;
  if (/^\w[\wáéíóúñÁÉÍÓÚÑ\s]+\d+\s*(h|min|días?|sem|mes)\s*(Me gusta|Responder)/i.test(trimmed)) return true;
  if (/^\d+\.\d+[Kk]?\s*(me gusta|compartido|comentarios|reacciones?)/i.test(trimmed)) return true;
  return false;
}

export function cleanPostText(raw: string): string {
  return raw
    .split("\n")
    .filter((line) => !isCommentLine(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
