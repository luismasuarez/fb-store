const TIMEOUT_MS = 15_000

export interface DownloadedImage {
  url: string
  mime: string
  data: string
}

export async function downloadImagesAsBase64(urls: string[]): Promise<DownloadedImage[]> {
  const results: DownloadedImage[] = []

  for (const url of urls) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

      const res = await fetch(url, { signal: controller.signal })
      clearTimeout(timer)

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const mime = res.headers.get("content-type") || "image/jpeg"
      const buffer = await res.arrayBuffer()
      const base64 = Buffer.from(buffer).toString("base64")

      results.push({ url, mime, data: base64 })
    } catch {
      results.push({ url, mime: "image/jpeg", data: "" })
    }
  }

  return results
}
