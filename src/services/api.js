// api.js — All backend API calls

// Ensure BASE_URL is always a clean absolute URL with no trailing slash
function getBaseUrl() {
  const raw = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";
  // Strip any accidental path prefix that Vite's base might inject
  try {
    const url = new URL(raw);
    return url.origin; // e.g. "https://trip-production-61af.up.railway.app"
  } catch {
    return "http://localhost:3001";
  }
}

const BASE_URL = getBaseUrl();

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

// ─── Cloudinary / Storage ─────────────────────────────────────────────────────

export async function uploadToDrive(file, folderId, fileName) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("folderId", folderId || "");
  if (fileName) formData.append("fileName", fileName);

  const res = await fetch(`${BASE_URL}/api/drive/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Upload failed");
  return res.json(); // { fileId, imageUrl }
}

export async function deleteFromDrive(fileId) {
  return request(`/api/drive/file/${encodeURIComponent(fileId)}`, { method: "DELETE" });
}

export async function createDriveFolder(name, parentFolderId) {
  return request("/api/drive/folder", {
    method: "POST",
    body: JSON.stringify({ name, parentFolderId }),
  });
}

// ─── Google Vision OCR ────────────────────────────────────────────────────────

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
