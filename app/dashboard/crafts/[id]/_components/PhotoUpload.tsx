"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"
import Image from "next/image"
import { addCraftPhotoUrl, removeCraftPhoto } from "../../actions"
import { compressImage } from "@/lib/compress-image"
import { BLUR_DATA_URL } from "@/lib/blur-data-url"
import styles from "../../crafts.module.css"

export default function PhotoUpload({
  craftId,
  imageUrls,
}: {
  craftId: string
  imageUrls: string[]
}) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploadStatus, setUploadStatus] = useState<"idle" | "optimising" | "uploading">("idle")
  const [removingUrl, setRemovingUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const handleFiles = async (files: FileList) => {
    setError(null)

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    for (const file of Array.from(files)) {
      setUploadStatus("optimising")
      const compressed = await compressImage(file)

      setUploadStatus("uploading")
      const baseName = compressed.name.replace(/[^a-z0-9_.-]/gi, "-")
      const path = `${craftId}/${Date.now()}-${baseName}`

      const { error: uploadError } = await supabase.storage
        .from("craft-images")
        .upload(path, compressed, { contentType: compressed.type, upsert: false })

      if (uploadError) {
        setError(`Upload failed: ${uploadError.message}`)
        setUploadStatus("idle")
        if (fileRef.current) fileRef.current.value = ""
        return
      }

      const { data: { publicUrl } } = supabase.storage
        .from("craft-images")
        .getPublicUrl(path)

      const res = await addCraftPhotoUrl(craftId, publicUrl)
      if ("error" in res) {
        setError(res.error)
        setUploadStatus("idle")
        if (fileRef.current) fileRef.current.value = ""
        return
      }
    }

    setUploadStatus("idle")
    if (fileRef.current) fileRef.current.value = ""
    router.refresh()
  }

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

  return (
    <div>
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
        disabled={uploadStatus !== "idle"}
        onClick={() => fileRef.current?.click()}
      >
        {uploadStatus === "optimising"
          ? "Optimising image…"
          : uploadStatus === "uploading"
          ? "Uploading…"
          : imageUrls.length > 0
          ? "+ Add More Photos"
          : "+ Add Photos"}
      </button>
    </div>
  )
}
