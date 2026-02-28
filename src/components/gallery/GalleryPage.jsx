import { useState, useEffect } from "react";
import { useTrip } from "../../contexts/TripContext";
import { useLang } from "../../contexts/LangContext";
import { subscribePhotos, addPhoto, deletePhoto } from "../../services/firestore";
import { uploadToDrive, deleteFromDrive } from "../../services/api";
import { formatDateShort } from "../../utils/utils";
import "./GalleryPage.css";

export default function GalleryPage({ toast }) {
  const { activeTrip } = useTrip();
  const { tr, t } = useLang();
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [showModal, setShowModal] = useState(false);
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
    setShowModal(true);
    e.target.value = "";
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
        imageUrl, fileId,
        note: photoForm.note,
        googleMapLink: photoForm.googleMapLink,
        lat: photoForm.lat ? Number(photoForm.lat) : null,
        lng: photoForm.lng ? Number(photoForm.lng) : null,
      });
      toast.show(tr.photoUploaded, "success");
      setShowModal(false);
      setPendingFile(null);
      setPendingPreview(null);
      setPhotoForm({ note: "", googleMapLink: "", lat: "", lng: "" });
    } catch (err) {
      toast.show(t(tr.uploadFailed, err.message), "error");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (photo) => {
    if (!confirm(tr.confirmDeletePhoto)) return;
    try {
      if (photo.fileId) await deleteFromDrive(photo.fileId);
      await deletePhoto(activeTrip.id, photo.id);
      toast.show(tr.photoDeleted);
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

  const countLabel = photos.length === 1 ? t(tr.photosCount, photos.length) : t(tr.photosCountPlural, photos.length);

  return (
    <div>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20}}>
        <div>
          <h1 className="page-title">{tr.galleryTitle}</h1>
          <p className="page-subtitle">{countLabel}</p>
        </div>
        <label className="btn btn-primary" style={{cursor:"pointer"}}>
          {tr.uploadPhoto}
          <input type="file" accept="image/*" onChange={handleFileSelect} style={{display:"none"}} />
        </label>
      </div>

      {photos.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📸</div>
          <div className="empty-state-title">{tr.noPhotosYet}</div>
          <div className="empty-state-text">{tr.preserveMemories}</div>
          <label className="btn btn-primary" style={{marginTop:16,cursor:"pointer"}}>
            {tr.uploadFirstPhoto}
            <input type="file" accept="image/*" onChange={handleFileSelect} style={{display:"none"}} />
          </label>
        </div>
      ) : (
        <div className="photo-grid">
          {photos.map(photo => (
            <div key={photo.id} className="photo-item" onClick={() => setLightbox(photo)}>
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
      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <button className="lightbox-close">✕</button>
          <img src={lightbox.imageUrl} alt="" className="lightbox-img" onClick={e => e.stopPropagation()} />
          <div className="lightbox-info" onClick={e => e.stopPropagation()}>
            {lightbox.note && <div className="lightbox-note">{lightbox.note}</div>}
            <div className="lightbox-meta">
              {formatDateShort(lightbox.createdAt)}
              {lightbox.googleMapLink && (
                <a href={lightbox.googleMapLink} target="_blank" rel="noopener" className="lightbox-map">
                  {tr.viewOnMap}
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-header">
              <h2 className="modal-title">{tr.uploadPhotoTitle}</h2>
              <button className="btn btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            {pendingPreview && (
              <img src={pendingPreview} alt="preview"
                style={{width:"100%",height:200,objectFit:"cover",borderRadius:14,marginBottom:16}} />
            )}
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div className="form-group">
                <label className="form-label">{tr.note}</label>
                <input className="form-input" value={photoForm.note}
                  onChange={e => setPhotoForm(f => ({...f,note:e.target.value}))}
                  placeholder={tr.notePlaceholder} />
              </div>
              <div className="form-group">
                <label className="form-label">{tr.mapsLink}</label>
                <input className="form-input" value={photoForm.googleMapLink}
                  onChange={e => setPhotoForm(f => ({...f,googleMapLink:e.target.value}))}
                  placeholder="https://maps.google.com/..." />
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <input className="form-input" type="number" step="any"
                  value={photoForm.lat} onChange={e => setPhotoForm(f=>({...f,lat:e.target.value}))}
                  placeholder={tr.latitude} />
                <input className="form-input" type="number" step="any"
                  value={photoForm.lng} onChange={e => setPhotoForm(f=>({...f,lng:e.target.value}))}
                  placeholder={tr.longitude} />
              </div>
              <div style={{display:"flex",gap:10,marginTop:4}}>
                <button className="btn btn-secondary" style={{flex:1}} onClick={() => setShowModal(false)}>
                  {tr.cancel}
                </button>
                <button className="btn btn-primary" style={{flex:1}} onClick={handleUpload} disabled={uploading}>
                  {uploading ? tr.saving : activeTrip.driveFolderId ? tr.uploadToDrive : tr.savePhoto}
                </button>
              </div>
              {!activeTrip.driveFolderId && (
                <p className="form-hint" style={{textAlign:"center"}}>{tr.noDriveFolderWarning}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
