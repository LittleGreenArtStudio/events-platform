export async function compressImageTo(
  file: File,
  maxPx: number,
  quality: number
): Promise<File> {
  // GIF: preserve animation, skip canvas round-trip
  if (file.type === "image/gif") return file

  return new Promise((resolve) => {
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")!
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(file)
    }

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      let { width, height } = img
      if (width > height && width > maxPx) {
        height = (height * maxPx) / width
        width = maxPx
      } else if (height > maxPx) {
        width = (width * maxPx) / height
        height = maxPx
      }
      canvas.width = width
      canvas.height = height
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return }
          resolve(
            new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), {
              type: "image/webp",
            })
          )
        },
        "image/webp",
        quality
      )
    }

    img.src = objectUrl
  })
}

export function compressImage(file: File): Promise<File> {
  return compressImageTo(file, 1200, 0.82)
}
