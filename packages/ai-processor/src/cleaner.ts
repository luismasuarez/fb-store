const COMMENT_LINES = [
  /^Comentar como.*$/gim,
  /^Ver m\u00e1s comentarios.*$/gim,
  /^Me gusta$/gim,
  /^Reacciona.*$/gim,
  /^Compartir.*$/gim,
  /^\d+ comentarios.*$/gim,
  /^\d+ veces compartido.*$/gim,
  /^Te gusta.*$/gim,
  /^Escribe un comentario.*$/gim,
]

export function cleanPostText(text: string): string {
  let cleaned = text
  for (const pattern of COMMENT_LINES) {
    cleaned = cleaned.replace(pattern, "")
  }
  return cleaned.replace(/\n{3,}/g, "\n\n").trim()
}
