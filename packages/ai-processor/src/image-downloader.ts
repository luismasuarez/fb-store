export interface ImageData {
  url: string;
  mime: string;
  data: string;
}

function isUrlArray(images: any): images is string[] {
  return Array.isArray(images) && images.length > 0 && typeof images[0] === "string";
}

function isImageDataArray(images: any): images is ImageData[] {
  return Array.isArray(images) && images.length > 0 && typeof images[0] === "object" && "data" in images[0];
}

export async function downloadImagesAsBase64(
  rawImages: any,
): Promise<ImageData[]> {
  if (isImageDataArray(rawImages)) {
    const missing = rawImages.filter((img) => !img.data);
    if (missing.length === 0) return rawImages;
  }

  if (!isUrlArray(rawImages)) return [];

  const results: ImageData[] = [];
  for (const url of rawImages) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) {
        results.push({ url, mime: "image/jpeg", data: "" });
        continue;
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      const mime = res.headers.get("content-type") || "image/jpeg";
      results.push({ url, mime, data: buffer.toString("base64") });
    } catch {
      results.push({ url, mime: "image/jpeg", data: "" });
    }
  }
  return results;
}
