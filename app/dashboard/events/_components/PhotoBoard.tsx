"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"
import { updateEventPhotoUrls } from "../photo-actions"
import type { PhotoEntry } from "../photo-actions"
import styles from "../folder.module.css"

// ── Types ─────────────────────────────────────────────────────────────────

type PhotoTag = "Inspo" | "Client Provided" | "Venue" | "Past Event" | "Other"

const TAGS: PhotoTag[] = ["Inspo", "Client Provided", "Venue", "Past Event", "Other"]

// ── Image compression ─────────────────────────────────────────────────────

async function compress(
  file: File
): Promise<{ blob: Blob; ext: string; mime: string }> {
  // Preserve GIF animation — don't canvas-ify
  if (file.type === "image/gif") {
    return { blob: file, ext: "gif", mime: "image/gif" }
  }

  return new Promise((resolve) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg"
      resolve({ blob: file, ext, mime: file.type })
    }

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const MAX = 1200
      const scale = img.naturalWidth > MAX ? MAX / img.naturalWidth : 1
      const w = Math.round(img.naturalWidth * scale)
      const h = Math.round(img.naturalHeight * scale)
      const canvas = document.createElement("canvas")
      canvas.width = w
      canvas.height = h
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h)

      // Prefer webp; fall back to jpeg; fall back to original
      canvas.toBlob(
        (webp) => {
          if (webp) return resolve({ blob: webp, ext: "webp", mime: "image/webp" })
          canvas.toBlob(
            (jpeg) => {
              if (jpeg) return resolve({ blob: jpeg, ext: "jpg", mime: "image/jpeg" })
              const fallbackExt = file.name.split(".").pop()?.toLowerCase() ?? "jpg"
              resolve({ blob: file, ext: fallbackExt, mime: file.type })
            },
            "image/jpeg",
            0.85
          )
        },
        "image/webp",
        0.8
      )
    }

    img.src = objectUrl
  })
}

// ── Main component ────────────────────────────────────────────────────────

export default function PhotoBoard({
  eventKind,
  eventId,
  initialPhotos,
}: {
  eventKind: "offsite" | "in-studio"
  eventId: string
  initialPhotos: PhotoEntry[]
}) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [, startTransition] = useTransition()

  const [photos, setPhotos] = useState<PhotoEntry[]>(initialPhotos)
  const [filter, setFilter] = useState<PhotoTag | "All">("All")
  const [uploadTag, setUploadTag] = useState<PhotoTag>("Inspo")
  const [uploading, setUploading] = useState(false)
  const [uploadLabel, setUploadLabel] = useState("")
  const [error, setError] = useState<string | null>(null)

  // Lightbox — tracked by URL so it survives photo reorders
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  // Drag reorder
  const [dragSrc, setDragSrc] = useState<number | null>(null)

  // Derived
  const filtered = filter === "All" ? photos : photos.filter((p) => p.tag === filter)
  const tagCounts = photos.reduce<Record<string, number>>((acc, p) => {
    acc[p.tag] = (acc[p.tag] ?? 0) + 1
    return acc
  }, {})

  const lightboxPhoto = lightboxUrl ? photos.find((p) => p.url === lightboxUrl) ?? null : null
  const lightboxIdx = lightboxUrl ? photos.findIndex((p) => p.url === lightboxUrl) : -1

  // ── Keyboard nav for lightbox ──────────────────────────────────────────
  useEffect(() => {
    if (!lightboxUrl) return
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLightboxUrl(null)
      } else if (e.key === "ArrowRight" && lightboxIdx < photos.length - 1) {
        setLightboxUrl(photos[lightboxIdx + 1].url)
      } else if (e.key === "ArrowLeft" && lightboxIdx > 0) {
        setLightboxUrl(photos[lightboxIdx - 1].url)
      }
    }
    window.addEventListener("keydown", handle)
    return () => window.removeEventListener("keydown", handle)
  }, [lightboxUrl, lightboxIdx, photos])

  // ── Upload ────────────────────────────────────────────────────────────
  const handleFiles = async (files: FileList) => {
    setError(null)
    setUploading(true)

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const fileArray = Array.from(files)
    const added: PhotoEntry[] = []

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i]
      setUploadLabel(`${i + 1} / ${fileArray.length}`)

      const { blob, ext, mime } = await compress(file)
      const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]/gi, "-")
      const storagePath = `${eventKind}/${eventId}/${Date.now()}-${baseName}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from("event-photos")
        .upload(storagePath, blob, { contentType: mime, upsert: false })

      if (uploadError) {
        setError(`Upload failed: ${uploadError.message}`)
        setUploading(false)
        setUploadLabel("")
        if (fileRef.current) fileRef.current.value = ""
        return
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("event-photos").getPublicUrl(storagePath)

      added.push({ url: publicUrl, tag: uploadTag, uploaded_at: new Date().toISOString() })
    }

    const merged = [...photos, ...added]
    setPhotos(merged)
    setUploading(false)
    setUploadLabel("")
    if (fileRef.current) fileRef.current.value = ""

    const res = await updateEventPhotoUrls(eventKind, eventId, merged)
    if ("error" in res) setError(res.error)
    router.refresh()
  }

  // ── Delete ─────────────────────────────────────────────────────────────
  const handleDelete = (url: string) => {
    if (lightboxUrl === url) setLightboxUrl(null)
    const next = photos.filter((p) => p.url !== url)
    setPhotos(next)
    startTransition(async () => {
      await updateEventPhotoUrls(eventKind, eventId, next)
      router.refresh()
    })
  }

  // ── Drag reorder (only active in "All" view) ───────────────────────────
  const handleDragStart = (idx: number) => setDragSrc(idx)

  const handleDragOver = (e: React.DragEvent, toIdx: number) => {
    e.preventDefault()
    if (dragSrc === null || dragSrc === toIdx) return
    const next = [...photos]
    const [moved] = next.splice(dragSrc, 1)
    next.splice(toIdx, 0, moved)
    setPhotos(next)
    setDragSrc(toIdx)
  }

  const handleDragEnd = () => {
    setDragSrc(null)
    startTransition(async () => {
      await updateEventPhotoUrls(eventKind, eventId, photos)
    })
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Upload bar */}
      <div className={styles.pbBar}>
        <label className={styles.pbTagLabel}>Tag as</label>
        <select
          className={styles.addSelect}
          style={{ width: 160 }}
          value={uploadTag}
          onChange={(e) => setUploadTag(e.target.value as PhotoTag)}
          disabled={uploading}
        >
          {TAGS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          className={styles.addBtn}
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? `Uploading ${uploadLabel}…` : "+ Add Photos"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files)
          }}
        />
        {error && <span className={styles.addError}>{error}</span>}
      </div>

      {/* Filter tabs */}
      {photos.length > 0 && (
        <div className={styles.pbFilters}>
          <button
            className={`${styles.pbFilter} ${filter === "All" ? styles.pbFilterActive : ""}`}
            onClick={() => setFilter("All")}
          >
            All
            <span className={styles.pbFilterBadge}>{photos.length}</span>
          </button>
          {TAGS.filter((t) => tagCounts[t] > 0).map((t) => (
            <button
              key={t}
              className={`${styles.pbFilter} ${filter === t ? styles.pbFilterActive : ""}`}
              onClick={() => setFilter(filter === t ? "All" : t)}
            >
              {t}
              <span className={styles.pbFilterBadge}>{tagCounts[t]}</span>
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      {photos.length === 0 ? (
        <p className={styles.emptyState}>
          No photos yet. Add inspiration, venue shots, client-provided images, or past event photos.
        </p>
      ) : filtered.length === 0 ? (
        <p className={styles.emptyState}>No photos tagged &ldquo;{filter}&rdquo;.</p>
      ) : (
        <div className={styles.pbGrid}>
          {filtered.map((photo) => {
            const fullIdx = photos.indexOf(photo)
            const isDragging = dragSrc === fullIdx
            const canDrag = filter === "All"
            return (
              <div
                key={photo.url}
                className={`${styles.pbCell} ${isDragging ? styles.pbCellDragging : ""}`}
                draggable={canDrag}
                onDragStart={canDrag ? () => handleDragStart(fullIdx) : undefined}
                onDragOver={canDrag ? (e) => handleDragOver(e, fullIdx) : undefined}
                onDragEnd={canDrag ? handleDragEnd : undefined}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={photo.tag}
                  className={styles.pbImg}
                  loading="lazy"
                  onClick={() => setLightboxUrl(photo.url)}
                />
                <div className={styles.pbOverlay}>
                  <span className={styles.pbTagPill}>{photo.tag}</span>
                  <button
                    className={styles.pbDeleteBtn}
                    title="Remove photo"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(photo.url)
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {filter === "All" && photos.length > 1 && (
        <p className={styles.pbHint}>Drag photos to reorder.</p>
      )}

      {/* Lightbox */}
      {lightboxPhoto && (
        <div
          className={styles.pbLightbox}
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className={styles.pbLbClose}
            onClick={() => setLightboxUrl(null)}
            aria-label="Close"
          >
            ×
          </button>

          {lightboxIdx > 0 && (
            <button
              className={`${styles.pbLbNav} ${styles.pbLbPrev}`}
              onClick={(e) => {
                e.stopPropagation()
                setLightboxUrl(photos[lightboxIdx - 1].url)
              }}
              aria-label="Previous"
            >
              ‹
            </button>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxPhoto.url}
            alt={lightboxPhoto.tag}
            className={styles.pbLbImg}
            onClick={(e) => e.stopPropagation()}
          />

          {lightboxIdx < photos.length - 1 && (
            <button
              className={`${styles.pbLbNav} ${styles.pbLbNext}`}
              onClick={(e) => {
                e.stopPropagation()
                setLightboxUrl(photos[lightboxIdx + 1].url)
              }}
              aria-label="Next"
            >
              ›
            </button>
          )}

          <div className={styles.pbLbMeta} onClick={(e) => e.stopPropagation()}>
            <span className={styles.pbTagPill}>{lightboxPhoto.tag}</span>
            <span className={styles.pbLbDate}>
              {new Date(lightboxPhoto.uploaded_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
