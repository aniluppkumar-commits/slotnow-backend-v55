/**
 * Client-side image compression → base64 dataURL.
 * Downscales the largest side to `maxDim` and encodes as JPEG at `quality`.
 * Returns a Promise<string> containing a data:image/jpeg;base64 URL.
 */
export async function compressImageToDataURL(file, { maxDim = 800, quality = 0.75 } = {}) {
  if (!file) throw new Error("No file");
  if (!file.type?.startsWith("image/")) throw new Error("Not an image file");
  if (file.size > 20 * 1024 * 1024) throw new Error("Image too large (>20MB)");

  const bitmap = await createImageBitmap(file).catch(async () => {
    // Fallback for old browsers
    const url = URL.createObjectURL(file);
    const img = await new Promise((res, rej) => {
      const el = new Image();
      el.onload = () => res(el);
      el.onerror = rej;
      el.src = url;
    });
    URL.revokeObjectURL(url);
    return img;
  });

  const w = bitmap.width;
  const h = bitmap.height;
  const scale = Math.min(1, maxDim / Math.max(w, h));
  const targetW = Math.round(w * scale);
  const targetH = Math.round(h * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);

  return canvas.toDataURL("image/jpeg", quality);
}
