"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"
import Image from "next/image"
import { addCraftPhotoUrls, removeCraftPhoto } from "../../actions"
import { compressImageTo } from "@/lib/compress-image"
import { BLUR_DATA_URL } from "@/lib/blur-data-url"
import styles from "../../crafts.module.css"

type UploadItem = {
  id: string
  name: string
  previewUrl: string
  status: "optimising" | "uploading" | "done" | "error"
  error?: string
}

export default function PhotoUpload({
  craftId,
  imageUrls,
}: {
  craftId: string
  imageUrls: string[]
}) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const dragCounterRef = useRef(0)
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploading, setUploading] = useState<UploadItem[]>([])
  const [removingUrl, setRemovingUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const isProcessing = uploading.some((u) => u.status !== "done" && u.status !== "error")
  const doneCount = uploading.filter((u) => u.status === "done").length

  // ── Upload (parallel, per-file progress) ──────────────────────────────
  const handleFiles = async (files: FileList) => {
    setError(null)
    const fileArray = Array.from(files).filter((f) => f.type.startsWith("image/"))
    if (!fileArray.length) return

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const items: UploadItem[] = fileArray.map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: f.name,
      previewUrl: URL.createObjectURL(f),
      status: "optimising" as const,
    }))
    setUploading(items)

    const updateItem = (id: string, patch: Partial<UploadItem>) =>
      setUploading((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)))

    const uploadedUrls: string[] = []

    await Promise.allSettled(
      fileArray.map(async (file, i) => {
        const id = items[i].id
        const compressed = await compressImageTo(file, 400, 0.6)
        updateItem(id, { status: "uploading" })

        const baseName = compressed.name.replace(/[^a-z0-9_.-]/gi, "-")
        const path = `${craftId}/${id}-${baseName}`

        const { error: uploadError } = await supabase.storage
          .from("craft-images")
          .upload(path, compressed, { contentType: compressed.type, upsert: false })

        if (uploadError) {
          updateItem(id, { status: "error", error: uploadError.message })
          throw uploadError
        }

        const { data: { publicUrl } } = supabase.storage.from("craft-images").getPublicUrl(path)
        uploadedUrls.push(publicUrl)
        updateItem(id, { status: "done" })
      })
    )

    items.forEach((u) => URL.revokeObjectURL(u.previewUrl))

    if (uploadedUrls.length) {
      const res = await addCraftPhotoUrls(craftId, uploadedUrls)
      if ("error" in res) setError(res.error)
    }

    setTimeout(() => {
      setUploading([])
      if (fileRef.current) fileRef.current.value = ""
      router.refresh()
    }, 1200)
  }

  // ── Remove ─────────────────────────────────────────────────────────────
  const handleRemove = (url: string) => {
    setRemovingUrl(url)
    setError(null)
    startTransition(async () => {
      const res = await removeCraftPhoto(craftId, url)
      if ("error" in res) setError(res.error)
      setRemovingUrl(null)
      router.refresh()
    })
  }

  // ── Drop zone handlers ─────────────────────────────────────────────────
  const handleDragEnter = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("Files")) return
    e.preventDefault()
    dragCounterRef.current++
    setIsDragOver(true)
  }

  const handleDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("Files")) return
    e.preventDefault()
    e.dataTransfer.dropEffect = "copy"
  }

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("Files")) return
    dragCounterRef.current--
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0
      setIsDragOver(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current = 0
    setIsDragOver(false)
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files)
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div
      className={`${styles.photoUploadZone} ${isDragOver ? styles.photoUploadZoneDragOver : ""}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <div className={styles.photoDropOverlay}>
          <span className={styles.photoDropOverlayText}>Drop photos here</span>
        </div>
      )}

      {imageUrls.length > 0 && (
        <div className={styles.photoGrid}>
          {imageUrls.map((url) => (
            <div key={url} className={styles.photoThumb}>
              <Image
                src={url}
                alt=""
                fill
                sizes="600px"
                className={styles.photoThumbImg}
                placeholder="blur"
                blurDataURL={BLUR_DATA_URL}
              />
              <button
                className={styles.photoRemoveBtn}
                disabled={removingUrl === url}
                onClick={() => handleRemove(url)}
                title="Remove photo"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className={styles.photoError}>{error}</p>}

      {/* Per-file upload progress */}
      {uploading.length > 0 && (
        <div className={styles.photoProgress}>
          <div className={styles.photoProgressCounter}>
            {doneCount} of {uploading.length} uploaded
          </div>
          <div className={styles.photoProgressList}>
            {uploading.map((u) => (
              <div key={u.id} className={styles.photoProgressItem}>
                <div className={styles.photoProgressThumb}>
                  {/* blob URL — plain img only, not next/image */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u.previewUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <span className={styles.photoProgressName}>{u.name}</span>
                {u.status === "done" ? (
                  <span className={`${styles.photoProgressStatus} ${styles.photoProgressStatusDone}`}>✓ Done</span>
                ) : u.status === "error" ? (
                  <span className={`${styles.photoProgressStatus} ${styles.photoProgressStatusError}`}>{u.error ?? "Failed"}</span>
                ) : (
                  <>
                    <span className={styles.photoProgressStatus}>
                      {u.status === "optimising" ? "Optimising" : "Uploading"}
                    </span>
                    <div className={styles.photoSpinner} />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files?.length) handleFiles(e.target.files)
        }}
      />
      <button
        className={styles.uploadBtn}
        disabled={isProcessing}
        onClick={() => fileRef.current?.click()}
      >
        {isProcessing
          ? `Uploading… (${doneCount} of ${uploading.length})`
          : imageUrls.length > 0
          ? "+ Add More Photos"
          : "+ Add Photos"}
      </button>
    </div>
  )
}
