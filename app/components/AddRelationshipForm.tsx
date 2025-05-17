import React, { useState } from 'react';
import { Person } from '../../types';

interface AddRelationshipFormProps {
  personId: string;
  allPersons: Person[];
  onAddRelationship: (rel: { person1_id: string; person2_id: string; relationship_type: 'parent' | 'child' | 'spouse' }) => Promise<void>;
}

const AddRelationshipForm: React.FC<AddRelationshipFormProps> = ({ personId, allPersons, onAddRelationship }) => {
  const [otherPersonId, setOtherPersonId] = useState('');
  const [relationshipType, setRelationshipType] = useState<'parent' | 'child' | 'spouse'>('parent');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!otherPersonId) {
      setError('Select a person');
      return;
    }
    if (otherPersonId === personId) {
      setError('Cannot relate a person to themselves');
      return;
    }
    setIsSubmitting(true);
    try {
      let rel: { person1_id: string; person2_id: string; relationship_type: 'parent' | 'child' | 'spouse' };
      if (relationshipType === 'parent') {
        rel = {
          person1_id: personId, // parent
          person2_id: otherPersonId, // child
          relationship_type: 'parent',
        };
      } else {
        rel = {
          person1_id: personId,
          person2_id: otherPersonId,
          relationship_type: 'spouse',
        };
      }
      await onAddRelationship(rel);
      setOtherPersonId('');
      setRelationshipType('parent');
    } catch (err) {
      setError('Failed to add relationship');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 border-t pt-2 mt-2">
      <div className="flex gap-2 items-center">
        <select
          value={relationshipType}
          onChange={e => setRelationshipType(e.target.value as 'parent' | 'child' | 'spouse')}
          className="border rounded px-1 py-0.5 text-xs"
        >
          <option value="parent">Parent of</option>
          <option value="spouse">Spouse of</option>
        </select>
        <select
          value={otherPersonId}
          onChange={e => setOtherPersonId(e.target.value)}
          className="border rounded px-1 py-0.5 text-xs"
        >
          <option value="">Select person</option>
          {allPersons.filter(p => p.id !== personId).map(p => (
            <option key={p.id} value={p.id}>{p.name}{p.nickname ? ` (${p.nickname})` : ''}</option>
          ))}
        </select>
        <button
          type="submit"
          className="bg-stone-700 text-white px-2 py-1 rounded text-xs"
          disabled={isSubmitting}
        >
          Add
        </button>
      </div>
      {error && <div className="text-xs text-red-600">{error}</div>}
    </form>
  );
};

export default AddRelationshipForm;
