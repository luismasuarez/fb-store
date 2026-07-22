"use client"

import { useEffect, useCallback, useRef, useState } from "react"
import { X, ChevronLeft, ChevronRight, Expand } from "@/lib/icon"

interface GalleryImage {
  url: string
  mime: string
  data: string
}

interface GalleryLightboxProps {
  images: GalleryImage[]
  initialIndex: number
  onClose: () => void
}

function GalleryFilmstrip({
  images,
  currentIndex,
  onSelect,
}: {
  images: GalleryImage[]
  currentIndex: number
  onSelect: (i: number) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current?.children[currentIndex] as HTMLElement | undefined
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })
  }, [currentIndex])

  if (images.length <= 1) return null

  return (
    <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex justify-center bg-gradient-to-t from-black/60 to-transparent pt-10 pb-3">
      <div
        ref={scrollRef}
        className="pointer-events-auto flex max-w-[90vw] gap-1.5 overflow-x-auto px-2 scrollbar-none"
      >
        {images.map((img, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(i)}
            className={`h-12 w-16 shrink-0 overflow-hidden rounded border-2 transition-all duration-200 focus-visible:outline-none ${
              i === currentIndex
                ? "border-white opacity-100"
                : "border-transparent opacity-50 hover:opacity-90"
            }`}
          >
            <img
              src={`data:${img.mime || "image/jpeg"};base64,${img.data}`}
              alt=""
              className="h-full w-full object-cover"
            />
          </button>
        ))}
      </div>
    </div>
  )
}

export default function GalleryLightbox({ images, initialIndex, onClose }: GalleryLightboxProps) {
  const [index, setIndex] = useState(initialIndex)
  const [zoomed, setZoomed] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const goTo = useCallback(
    (i: number) => {
      setIndex(Math.max(0, Math.min(i, images.length - 1)))
      setZoomed(false)
    },
    [images.length],
  )

  const goPrev = useCallback(() => goTo(index - 1), [goTo, index])
  const goNext = useCallback(() => goTo(index + 1), [goTo, index])

  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return }
      if (e.key === "ArrowLeft") { goPrev(); return }
      if (e.key === "ArrowRight") { goNext(); return }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose, goPrev, goNext])

  useEffect(() => {
    containerRef.current?.focus()
  }, [])

  const img = images[index]
  const mime = img?.mime || "image/jpeg"
  const src = img?.data ? `data:${mime};base64,${img.data}` : ""

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Image gallery"
      tabIndex={-1}
      className="fixed inset-0 isolate z-50 flex animate-in fade-in duration-200"
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") e.preventDefault()
      }}
    >
      <div className="absolute inset-0 bg-black/90" onClick={onClose} />

      <div className="relative flex flex-1 items-center justify-center">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full bg-black/50 p-2 text-white/80 transition-colors hover:bg-black/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          aria-label="Close gallery"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Counter */}
        <div className="pointer-events-none absolute bottom-16 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-sm text-white/80">
          {index + 1} / {images.length}
        </div>

        {/* Previous */}
        {images.length > 1 && (
          <button
            onClick={goPrev}
            disabled={index === 0}
            className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white/70 transition-all hover:bg-black/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        {/* Next */}
        {images.length > 1 && (
          <button
            onClick={goNext}
            disabled={index === images.length - 1}
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white/70 transition-all hover:bg-black/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            aria-label="Next image"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}

        {/* Zoom toggle */}
        <button
          onClick={() => setZoomed((z) => !z)}
          className="absolute bottom-6 right-6 z-20 rounded-full bg-black/40 p-2 text-white/70 transition-all hover:bg-black/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          aria-label={zoomed ? "Fit to screen" : "Zoom in"}
        >
          <Expand className="h-4 w-4" />
        </button>

        {/* Image */}
        <div className="flex max-h-screen max-w-full items-center justify-center p-4">
          {src ? (
            <img
              key={index}
              src={src}
              alt=""
              className={`animate-in zoom-in-95 duration-200 ${
                zoomed
                  ? "max-h-none max-w-none"
                  : "max-h-[calc(100vh-14rem)] max-w-full"
              } object-contain`}
              style={zoomed ? { maxHeight: "none", maxWidth: "none" } : undefined}
            />
          ) : (
            <div className="text-white/50">No image data</div>
          )}
        </div>

        {/* Filmstrip at the bottom */}
        {images.length > 1 && (
          <GalleryFilmstrip images={images} currentIndex={index} onSelect={goTo} />
        )}
      </div>
    </div>
  )
}
