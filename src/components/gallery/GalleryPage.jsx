import { useState, useEffect } from "react";
import { useTrip } from "../../contexts/TripContext";
import { useLang } from "../../contexts/LangContext";
import { subscribePhotos, addPhoto, deletePhoto } from "../../services/firestore";
import { uploadToDrive, deleteFromDrive } from "../../services/api";
import { formatDateShort } from "../../utils/utils";
import "./GalleryPage.css";

const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm", "video/avi", "video/mov"];
const isVideo = (file) => file && (VIDEO_TYPES.includes(file.type) || /\.(mp4|mov|webm|avi)$/i.test(file.name || ""));
const isVideoUrl = (url) => url && /\.(mp4|mov|webm|avi)(\?|$)/i.test(url);
const MAX_VIDEO_MB = 100;

// Generate Cloudinary thumbnail URL from a video URL
// e.g. .../video/upload/wandersplit/xxx.mp4 → .../video/upload/so_0/wandersplit/xxx.jpg
function getVideoThumbnail(videoUrl) {
  if (!videoUrl) return null;
  return videoUrl
    .replace("/upload/", "/upload/so_0,w_400,h_400,c_fill/")
    .replace(/\.(mp4|mov|webm|avi)(\?.*)?$/i, ".jpg");
}

export default function GalleryPage({ toast }) {
  const { activeTrip } = useTrip();
  const { tr, t } = useLang();
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(null); // index into photos array
  const [showModal, setShowModal] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingPreview, setPendingPreview] = useState(null);
  const [pendingIsVideo, setPendingIsVideo] = useState(false);
  const [photoForm, setPhotoForm] = useState({ note: "", googleMapLink: "", lat: "", lng: "" });

  const lightbox = lightboxIdx !== null ? photos[lightboxIdx] : null;

  const openLightbox = (idx) => setLightboxIdx(idx);
  const closeLightbox = () => setLightboxIdx(null);
  const goPrev = (e) => { e?.stopPropagation(); setLightboxIdx(i => (i - 1 + photos.length) % photos.length); };
  const goNext = (e) => { e?.stopPropagation(); setLightboxIdx(i => (i + 1) % photos.length); };

  // Keyboard navigation
  useEffect(() => {
    if (lightboxIdx === null) return;
    const handler = (e) => {
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "Escape") closeLightbox();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxIdx, photos.length]);

  useEffect(() => {
    if (!activeTrip?.id) return;
    return subscribePhotos(activeTrip.id, setPhotos);
  }, [activeTrip?.id]);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Video size check
    if (isVideo(file) && file.size > MAX_VIDEO_MB * 1024 * 1024) {
      toast.show(`Video exceeds ${MAX_VIDEO_MB}MB limit`, "error");
      e.target.value = "";
      return;
    }

    const fileIsVideo = isVideo(file);
    setPendingFile(file);
    setPendingIsVideo(fileIsVideo);

    if (fileIsVideo) {
      // For video, create object URL for preview
      setPendingPreview(URL.createObjectURL(file));
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => setPendingPreview(ev.target.result);
      reader.readAsDataURL(file);
    }

    setShowModal(true);
    e.target.value = "";
  };

  const handleUpload = async () => {
    if (!pendingFile) return;
    setUploading(true);
    try {
      let mediaUrl = pendingPreview;
      let fileId = null;
      if (activeTrip.driveFolderId) {
        const result = await uploadToDrive(pendingFile, activeTrip.driveFolderId);
        mediaUrl = result.imageUrl;
        fileId = result.fileId;
      }
      await addPhoto(activeTrip.id, {
        imageUrl: mediaUrl,
        fileId,
        isVideo: pendingIsVideo,
        note: photoForm.note,
        googleMapLink: photoForm.googleMapLink,
        lat: photoForm.lat ? Number(photoForm.lat) : null,
        lng: photoForm.lng ? Number(photoForm.lng) : null,
      });
      toast.show(pendingIsVideo ? "Video uploaded!" : tr.photoUploaded, "success");
      setShowModal(false);
      setPendingFile(null);
      setPendingPreview(null);
      setPendingIsVideo(false);
      setPhotoForm({ note: "", googleMapLink: "", lat: "", lng: "" });
    } catch (err) {
      toast.show(t(tr.uploadFailed, err.message), "error");
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (photo) => {
    const url = photo.imageUrl;
    const isVid = photo.isVideo || isVideoUrl(url);
    try {
      const ext = isVid
        ? (url.match(/\.(mp4|mov|webm|avi)/i)?.[1] || "mp4")
        : (url.match(/\.(jpg|jpeg|png|gif|webp)/i)?.[1] || "jpg");
      const filename = `wandersplit_${photo.id || Date.now()}.${ext}`;
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      toast.show("Download failed", "error");
    }
  };

  const handleDelete = async (photo) => {
    if (!confirm(tr.confirmDeletePhoto)) return;
    try {
      if (photo.fileId) await deleteFromDrive(photo.fileId);
      await deletePhoto(activeTrip.id, photo.id);
      toast.show(tr.photoDeleted);
      closeLightbox();
    } catch (e) {
      toast.show(e.message, "error");
    }
  };

  if (!activeTrip) return (
    <div className="empty-state">
      <div className="empty-state-icon">✈️</div>
      <div className="empty-state-title">{tr.noTripSelected}</div>
    </div>
  );

  const mediaCount = photos.length;
  const countLabel = mediaCount === 1
    ? t(tr.photosCount, mediaCount)
    : t(tr.photosCountPlural, mediaCount);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 className="page-title">{tr.galleryTitle}</h1>
          <p className="page-subtitle">{countLabel}</p>
        </div>
        <label className="btn btn-primary" style={{ cursor: "pointer" }}>
          {tr.uploadPhoto}
          <input type="file" accept="image/*,video/*" onChange={handleFileSelect} style={{ display: "none" }} />
        </label>
      </div>

      {photos.length > 0 && (
        <div className="gallery-ios-hint">
          📱 iPhone 用户：长按图片可直接存储到相册
        </div>
      )}

      {photos.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📸</div>
          <div className="empty-state-title">{tr.noPhotosYet}</div>
          <div className="empty-state-text">{tr.preserveMemories}</div>
          <label className="btn btn-primary" style={{ marginTop: 16, cursor: "pointer" }}>
            {tr.uploadFirstPhoto}
            <input type="file" accept="image/*,video/*" onChange={handleFileSelect} style={{ display: "none" }} />
          </label>
        </div>
      ) : (
        <div className="photo-grid">
          {photos.map((photo, idx) => {
            const itemIsVideo = photo.isVideo || isVideoUrl(photo.imageUrl);
            return (
              <div key={photo.id} className="photo-item" onClick={() => openLightbox(idx)}>
                {itemIsVideo ? (
                  <div className="video-thumb">
                    <img
                      src={getVideoThumbnail(photo.imageUrl) || photo.imageUrl}
                      alt={photo.note || "video"}
                      className="photo-thumb"
                      onError={e => { e.target.style.display = "none"; }}
                    />
                    <div className="video-play-badge">▶</div>
                  </div>
                ) : (
                  <img src={photo.imageUrl} alt={photo.note || "photo"} className="photo-thumb" />
                )}
                {photo.note && (
                  <div className="photo-note-overlay">{photo.note}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (() => {
        const lbIsVideo = lightbox.isVideo || isVideoUrl(lightbox.imageUrl);
        return (
          <div className="lightbox" onClick={closeLightbox}>

            {/* Top bar */}
            <div className="lightbox-topbar" onClick={e => e.stopPropagation()}>
              <span className="lightbox-counter">{lightboxIdx + 1} / {photos.length}</span>
              <div className="lightbox-topbar-actions">
                {lightbox.googleMapLink && (
                  <a href={lightbox.googleMapLink} target="_blank" rel="noopener"
                    className="lightbox-action-btn">📍</a>
                )}
                <button className="lightbox-action-btn" onClick={() => handleDownload(lightbox)}>⬇</button>
                <button className="lightbox-action-btn" onClick={() => handleDelete(lightbox)}>🗑</button>
                <button className="lightbox-action-btn lightbox-close-btn" onClick={closeLightbox}>✕</button>
              </div>
            </div>

            {/* Main media */}
            <div className="lightbox-media-wrap" onClick={e => e.stopPropagation()}>
              {photos.length > 1 && (
                <button className="lightbox-nav lightbox-prev" onClick={goPrev}>‹</button>
              )}
              {lbIsVideo ? (
                <video
                  key={lightbox.id}
                  src={lightbox.imageUrl}
                  className="lightbox-img"
                  controls autoPlay
                />
              ) : (
                <img key={lightbox.id} src={lightbox.imageUrl} alt="" className="lightbox-img" />
              )}
              {photos.length > 1 && (
                <button className="lightbox-nav lightbox-next" onClick={goNext}>›</button>
              )}
            </div>

            {/* Note */}
            {lightbox.note && (
              <div className="lightbox-note" onClick={e => e.stopPropagation()}>
                {lightbox.note}
              </div>
            )}

            {/* Thumbnail strip */}
            {photos.length > 1 && (
              <div className="lightbox-thumbstrip" onClick={e => e.stopPropagation()}>
                {photos.map((p, idx) => {
                  const isVid = p.isVideo || isVideoUrl(p.imageUrl);
                  return (
                    <div
                      key={p.id}
                      className={`lightbox-thumb ${idx === lightboxIdx ? "active" : ""}`}
                      onClick={() => setLightboxIdx(idx)}
                    >
                      <img
                        src={isVid ? (getVideoThumbnail(p.imageUrl) || p.imageUrl) : p.imageUrl}
                        alt=""
                      />
                      {isVid && <div className="thumb-play">▶</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Upload modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-header">
              <h2 className="modal-title">
                {pendingIsVideo ? "Upload Video" : tr.uploadPhotoTitle}
              </h2>
              <button className="btn btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>

            {/* Preview */}
            {pendingPreview && (
              pendingIsVideo ? (
                <video src={pendingPreview} controls
                  style={{ width: "100%", height: 200, objectFit: "cover", borderRadius: 14, marginBottom: 16 }} />
              ) : (
                <img src={pendingPreview} alt="preview"
                  style={{ width: "100%", height: 200, objectFit: "cover", borderRadius: 14, marginBottom: 16 }} />
              )
            )}

            {pendingIsVideo && (
              <div style={{ fontSize: 12, color: "var(--ink-muted)", marginBottom: 10, textAlign: "center" }}>
                ⚠ Max {MAX_VIDEO_MB}MB · mp4 / mov / webm
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="form-group">
                <label className="form-label">{tr.note}</label>
                <input className="form-input" value={photoForm.note}
                  onChange={e => setPhotoForm(f => ({ ...f, note: e.target.value }))}
                  placeholder={tr.notePlaceholder} />
              </div>
              <div className="form-group">
                <label className="form-label">{tr.mapsLink}</label>
                <input className="form-input" value={photoForm.googleMapLink}
                  onChange={e => setPhotoForm(f => ({ ...f, googleMapLink: e.target.value }))}
                  placeholder="https://maps.google.com/..." />
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowModal(false)}>
                  {tr.cancel}
                </button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleUpload} disabled={uploading}>
                  {uploading
                    ? `${tr.saving}...`
                    : activeTrip.driveFolderId
                      ? (pendingIsVideo ? "Upload Video" : tr.uploadToDrive)
                      : (pendingIsVideo ? "Save Video" : tr.savePhoto)
                  }
                </button>
              </div>
              {!activeTrip.driveFolderId && (
                <p className="form-hint" style={{ textAlign: "center" }}>{tr.noDriveFolderWarning}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
