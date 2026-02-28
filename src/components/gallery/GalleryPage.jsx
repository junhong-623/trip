import { useState, useEffect } from "react";
import { useTrip } from "../../contexts/TripContext";
import { subscribePhotos, addPhoto, deletePhoto } from "../../services/firestore";
import { uploadToDrive, deleteFromDrive } from "../../services/api";
import { formatDateShort } from "../../utils/utils";
import "./GalleryPage.css";

export default function GalleryPage({ toast }) {
  const { activeTrip } = useTrip();
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null); // lightbox
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingPreview, setPendingPreview] = useState(null);
  const [photoForm, setPhotoForm] = useState({ note: "", googleMapLink: "", lat: "", lng: "" });

  useEffect(() => {
    if (!activeTrip?.id) return;
    return subscribePhotos(activeTrip.id, setPhotos);
  }, [activeTrip?.id]);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPendingPreview(ev.target.result);
    reader.readAsDataURL(file);
    setShowPhotoModal(true);
  };

  const handleUpload = async () => {
    if (!pendingFile) return;
    setUploading(true);
    try {
      let imageUrl = pendingPreview;
      let fileId = null;

      if (activeTrip.driveFolderId) {
        const result = await uploadToDrive(pendingFile, activeTrip.driveFolderId);
        imageUrl = result.imageUrl;
        fileId = result.fileId;
      }

      await addPhoto(activeTrip.id, {
        imageUrl,
        fileId,
        note: photoForm.note,
        googleMapLink: photoForm.googleMapLink,
        lat: photoForm.lat ? Number(photoForm.lat) : null,
        lng: photoForm.lng ? Number(photoForm.lng) : null,
      });

      toast.show("Photo uploaded ✓", "success");
      setShowPhotoModal(false);
      setPendingFile(null);
      setPendingPreview(null);
      setPhotoForm({ note: "", googleMapLink: "", lat: "", lng: "" });
    } catch (err) {
      toast.show(`Upload failed: ${err.message}`, "error");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (photo) => {
    if (!confirm("Delete this photo?")) return;
    try {
      if (photo.fileId) await deleteFromDrive(photo.fileId);
      await deletePhoto(activeTrip.id, photo.id);
      toast.show("Photo deleted");
    } catch (e) {
      toast.show(e.message, "error");
    }
  };

  if (!activeTrip) return (
    <div className="empty-state">
      <div className="empty-state-icon">✈️</div>
      <div className="empty-state-title">No trip selected</div>
    </div>
  );

  return (
    <div>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20}}>
        <div>
          <h1 className="page-title">Gallery</h1>
          <p className="page-subtitle">{photos.length} photo{photos.length!==1?"s":""}</p>
        </div>
        <label className="btn btn-primary" style={{cursor:"pointer"}}>
          + Upload
          <input type="file" accept="image/*" onChange={handleFileSelect} style={{display:"none"}} />
        </label>
      </div>

      {photos.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📸</div>
          <div className="empty-state-title">No photos yet</div>
          <div className="empty-state-text">Upload photos from your trip to preserve memories.</div>
          <label className="btn btn-primary" style={{marginTop:16, cursor:"pointer"}}>
            Upload First Photo
            <input type="file" accept="image/*" onChange={handleFileSelect} style={{display:"none"}} />
          </label>
        </div>
      ) : (
        <div className="photo-grid">
          {photos.map(photo => (
            <div key={photo.id} className="photo-item" onClick={() => setPreview(photo)}>
              <img src={photo.imageUrl} alt={photo.note || "photo"} className="photo-thumb" />
              <div className="photo-overlay">
                <div className="photo-overlay-actions">
                  {photo.googleMapLink && (
                    <a href={photo.googleMapLink} target="_blank" rel="noopener"
                      className="btn btn-icon" style={{background:"rgba(255,255,255,0.9)"}}
                      onClick={e => e.stopPropagation()}>📍</a>
                  )}
                  <button className="btn btn-icon" style={{background:"rgba(255,255,255,0.9)"}}
                    onClick={e => { e.stopPropagation(); handleDelete(photo); }}>🗑</button>
                </div>
                {photo.note && <div className="photo-note">{photo.note}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {preview && (
        <div className="lightbox" onClick={() => setPreview(null)}>
          <button className="lightbox-close">✕</button>
          <img src={preview.imageUrl} alt="" className="lightbox-img" onClick={e => e.stopPropagation()} />
          <div className="lightbox-info" onClick={e => e.stopPropagation()}>
            {preview.note && <div className="lightbox-note">{preview.note}</div>}
            <div className="lightbox-meta">
              {formatDateShort(preview.createdAt)}
              {preview.googleMapLink && (
                <a href={preview.googleMapLink} target="_blank" rel="noopener" className="lightbox-map">
                  📍 View on map
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload modal */}
      {showPhotoModal && (
        <div className="modal-overlay" onClick={() => setShowPhotoModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-header">
              <h2 className="modal-title">Upload Photo</h2>
              <button className="btn btn-icon" onClick={() => setShowPhotoModal(false)}>✕</button>
            </div>
            {pendingPreview && (
              <img src={pendingPreview} alt="preview"
                style={{width:"100%",height:200,objectFit:"cover",borderRadius:14,marginBottom:16}} />
            )}
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div className="form-group">
                <label className="form-label">Note (optional)</label>
                <input className="form-input" value={photoForm.note}
                  onChange={e => setPhotoForm(f => ({...f, note: e.target.value}))}
                  placeholder="Add a caption..." />
              </div>
              <div className="form-group">
                <label className="form-label">Google Maps Link (optional)</label>
                <input className="form-input" value={photoForm.googleMapLink}
                  onChange={e => setPhotoForm(f => ({...f, googleMapLink: e.target.value}))}
                  placeholder="https://maps.google.com/..." />
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <input className="form-input" type="number" step="any"
                  value={photoForm.lat} onChange={e => setPhotoForm(f=>({...f,lat:e.target.value}))}
                  placeholder="Latitude" />
                <input className="form-input" type="number" step="any"
                  value={photoForm.lng} onChange={e => setPhotoForm(f=>({...f,lng:e.target.value}))}
                  placeholder="Longitude" />
              </div>
              <div style={{display:"flex",gap:10,marginTop:4}}>
                <button className="btn btn-secondary" style={{flex:1}}
                  onClick={() => setShowPhotoModal(false)}>Cancel</button>
                <button className="btn btn-primary" style={{flex:1}}
                  onClick={handleUpload} disabled={uploading}>
                  {uploading ? "Uploading…" : activeTrip.driveFolderId ? "Upload to Drive" : "Save Photo"}
                </button>
              </div>
              {!activeTrip.driveFolderId && (
                <p className="form-hint" style={{textAlign:"center"}}>
                  ⚠ No Drive folder set. Photo will be saved as data URL only.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
