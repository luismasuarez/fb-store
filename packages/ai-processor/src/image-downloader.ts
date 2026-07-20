const TIMEOUT_MS = 30_000

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: "https://www.facebook.com/",
  Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
}

export interface DownloadedImage {
  url: string
  mime: string
  data: string
}

export async function downloadImagesAsBase64(urls: string[]): Promise<DownloadedImage[]> {
  const results: DownloadedImage[] = []

  for (const url of urls) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

        const res = await fetch(url, { signal: controller.signal, headers: FETCH_HEADERS })
        clearTimeout(timer)

        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        const mime = res.headers.get("content-type") || "image/jpeg"
        const buffer = await res.arrayBuffer()
        const base64 = Buffer.from(buffer).toString("base64")

        results.push({ url, mime, data: base64 })
        break
      } catch {
        if (attempt === 0) await new Promise((r) => setTimeout(r, 2000))
      }
    }
  }

  return results
}
