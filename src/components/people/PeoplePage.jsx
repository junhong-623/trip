import { useState, useEffect } from "react";
import { useTrip } from "../../contexts/TripContext";
import { useLang } from "../../contexts/LangContext";
import { subscribePeople, addPerson, updatePerson, deletePerson } from "../../services/firestore";
import { dicebearUrl } from "../../utils/utils";
import PersonModal from "./PersonModal";
import "./PeoplePage.css";

export default function PeoplePage({ toast }) {
  const { activeTrip } = useTrip();
  const { tr, t } = useLang();
  const [people, setPeople] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editPerson, setEditPerson] = useState(null);

  useEffect(() => {
    if (!activeTrip?.id) return;
    return subscribePeople(activeTrip.id, setPeople);
  }, [activeTrip?.id]);

  const handleSave = async (data) => {
    try {
      if (editPerson) {
        await updatePerson(activeTrip.id, editPerson.id, data);
        toast.show(tr.personUpdated, "success");
      } else {
        await addPerson(activeTrip.id, data);
        toast.show(tr.personAdded, "success");
      }
      setShowModal(false);
      setEditPerson(null);
    } catch (e) {
      toast.show(e.message, "error");
    }
  };

  const handleDelete = async (person) => {
    if (!confirm(t(tr.confirmRemove, person.name))) return;
    await deletePerson(activeTrip.id, person.id);
    toast.show(tr.personRemoved);
  };

  if (!activeTrip) return (
    <div className="empty-state">
      <div className="empty-state-icon"><img src="/trip/icons/icon-192.png" alt="MateTrip" style={{width:64,height:64,borderRadius:16,opacity:0.85}} /></div>
      <div className="empty-state-title">{tr.noTripSelected}</div>
      <div className="empty-state-text">{tr.selectTripFirst}</div>
    </div>
  );

  const countLabel = people.length === 1
    ? t(tr.participants, people.length)
    : t(tr.participantsPlural, people.length);

  return (
    <div>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20}}>
        <div>
          <h1 className="page-title">{tr.peopleTitle}</h1>
          <p className="page-subtitle">{countLabel} · {activeTrip.name}</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditPerson(null); setShowModal(true); }}>
          + {tr.addPerson}
        </button>
      </div>

      {people.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">👤</div>
          <div className="empty-state-title">{tr.noPersonYet}</div>
          <div className="empty-state-text">{tr.addParticipants}</div>
          <button className="btn btn-primary" style={{marginTop:16}} onClick={() => setShowModal(true)}>
            {tr.addFirstPerson}
          </button>
        </div>
      ) : (
        <div className="people-grid">
          {people.map(person => (
            <div key={person.id} className="person-card card">
              <div className="person-avatar-wrap">
                <img
                  src={person.avatarUrl || dicebearUrl(person.name)}
                  alt={person.name}
                  className="avatar avatar-lg person-avatar"
                />
                <div className="person-gender-badge">
                  {person.gender === "male" ? "♂" : person.gender === "female" ? "♀" : "⚧"}
                </div>
              </div>
              <div className="person-name">{person.name}</div>
              <div className="person-actions">
                <button className="btn btn-icon btn-sm"
                  onClick={() => { setEditPerson(person); setShowModal(true); }}>✏</button>
                <button className="btn btn-icon btn-sm"
                  onClick={() => handleDelete(person)}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <PersonModal
          person={editPerson}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditPerson(null); }}
        />
      )}
    </div>
  );
}
