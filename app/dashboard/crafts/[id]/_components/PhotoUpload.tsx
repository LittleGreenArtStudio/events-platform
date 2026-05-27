"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"
import { addCraftPhotoUrl, removeCraftPhoto } from "../../actions"
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
  const [uploading, setUploading] = useState(false)
  const [removingUrl, setRemovingUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const handleFiles = async (files: FileList) => {
    setError(null)
    setUploading(true)

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    for (const file of Array.from(files)) {
      const path = `${craftId}/${Date.now()}-${file.name}`

      const { error: uploadError } = await supabase.storage
        .from("craft-images")
        .upload(path, file, { contentType: file.type, upsert: false })

      if (uploadError) {
        setError(`Upload failed: ${uploadError.message}`)
        break
      }

      const { data: { publicUrl } } = supabase.storage
        .from("craft-images")
        .getPublicUrl(path)

      const res = await addCraftPhotoUrl(craftId, publicUrl)
      if ("error" in res) {
        setError(res.error)
        break
      }
    }

    setUploading(false)
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className={styles.photoThumbImg} />
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
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
      >
        {uploading ? "Uploading…" : imageUrls.length > 0 ? "+ Add More Photos" : "+ Add Photos"}
      </button>
    </div>
  )
}
