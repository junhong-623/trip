import { useState, useEffect } from "react";
import { useTrip } from "../../contexts/TripContext";
import { subscribePeople, addPerson, updatePerson, deletePerson } from "../../services/firestore";
import { dicebearUrl, formatDate } from "../../utils/utils";
import PersonModal from "./PersonModal";
import "./PeoplePage.css";

export default function PeoplePage({ toast }) {
  const { activeTrip } = useTrip();
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
        toast.show("Person updated ✓", "success");
      } else {
        await addPerson(activeTrip.id, data);
        toast.show("Person added ✓", "success");
      }
      setShowModal(false);
      setEditPerson(null);
    } catch (e) {
      toast.show(e.message, "error");
    }
  };

  const handleDelete = async (person) => {
    if (!confirm(`Remove ${person.name}?`)) return;
    await deletePerson(activeTrip.id, person.id);
    toast.show("Person removed");
  };

  if (!activeTrip) return (
    <div className="empty-state">
      <div className="empty-state-icon">✈️</div>
      <div className="empty-state-title">No trip selected</div>
      <div className="empty-state-text">Please select or create a trip first.</div>
    </div>
  );

  return (
    <div>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20}}>
        <div>
          <h1 className="page-title">People</h1>
          <p className="page-subtitle">{people.length} participant{people.length !== 1 ? "s" : ""} in {activeTrip.name}</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditPerson(null); setShowModal(true); }}>
          + Add Person
        </button>
      </div>

      {people.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">👤</div>
          <div className="empty-state-title">No people yet</div>
          <div className="empty-state-text">Add trip participants to start splitting expenses.</div>
          <button className="btn btn-primary" style={{marginTop:16}} onClick={() => setShowModal(true)}>
            Add First Person
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
