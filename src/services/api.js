// api.js — All backend API calls
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || "API Error");
  }
  return res.json();
}

// ─── Google Drive ─────────────────────────────────────────────────────────────

/**
 * Upload image/file to a Google Drive folder.
 * POST /api/drive/upload
 * Body: FormData { file, folderId, fileName }
 * Returns: { fileId, imageUrl }
 */
export async function uploadToDrive(file, folderId, fileName) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("folderId", folderId);
  if (fileName) formData.append("fileName", fileName);

  const res = await fetch(`${BASE_URL}/api/drive/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Drive upload failed");
  return res.json(); // { fileId, imageUrl }
}

/**
 * Delete file from Google Drive.
 * DELETE /api/drive/file/:fileId
 */
export async function deleteFromDrive(fileId) {
  return request(`/api/drive/file/${fileId}`, { method: "DELETE" });
}

/**
 * Create a new Drive folder inside a parent.
 * POST /api/drive/folder
 * Body: { name, parentFolderId }
 * Returns: { folderId }
 */
export async function createDriveFolder(name, parentFolderId) {
  return request("/api/drive/folder", {
    method: "POST",
    body: JSON.stringify({ name, parentFolderId }),
  });
}

// ─── Google Vision OCR ────────────────────────────────────────────────────────

/**
 * Analyze receipt image with Google Vision API.
 * POST /api/ocr/receipt
 * Body: FormData { file }
 * Returns: {
 *   restaurantName, date, totalAmount,
 *   items: [{ name, price }],
 *   rawText
 * }
 */
export async function analyzeReceipt(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${BASE_URL}/api/ocr/receipt`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("OCR analysis failed");
  return res.json();
}
