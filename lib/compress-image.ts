export async function compressImage(file: File): Promise<File> {
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
      const maxSize = 1200
      let { width, height } = img
      if (width > height && width > maxSize) {
        height = (height * maxSize) / width
        width = maxSize
      } else if (height > maxSize) {
        width = (width * maxSize) / height
        height = maxSize
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
        0.82
      )
    }

    img.src = objectUrl
  })
}
