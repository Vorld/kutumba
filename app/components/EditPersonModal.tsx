'use client';

import React, { useState, useEffect } from 'react';
import { Person } from '../../types';
import AddRelationshipForm from './AddRelationshipForm';

interface EditPersonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdatePerson: (personData: Partial<Person>) => Promise<void>;
  onDeletePerson: (personId: string) => Promise<void>;
  person: Person | null;
  allPersons: Person[];
  relationships: Array<{
    id: string;
    person1_id: string;
    person2_id: string;
    relationship_type: 'parent' | 'child' | 'spouse';
  }>;
  onAddRelationship: (relationship: Omit<{ id: string; person1_id: string; person2_id: string; relationship_type: 'parent' | 'child' | 'spouse' }, 'id'>) => Promise<void>;
  onUpdateRelationship: (id: string, updates: Partial<{ id: string; person1_id: string; person2_id: string; relationship_type: 'parent' | 'child' | 'spouse' }>) => Promise<void>;
  onDeleteRelationship: (id: string) => Promise<void>;
}

const EditPersonModal: React.FC<EditPersonModalProps> = ({ 
  isOpen, 
  onClose, 
  onUpdatePerson,
  onDeletePerson,
  person,
  allPersons,
  relationships,
  onAddRelationship,
  onUpdateRelationship,
  onDeleteRelationship
}) => {
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState<string | null>(null);
  const [birthday, setBirthday] = useState<string | null>(null);
  const [gender, setGender] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [dateOfDeath, setDateOfDeath] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  // Update form when person changes
  useEffect(() => {
    if (person) {
      setName(person.name || '');
      setNickname(person.nickname ?? null);
      setBirthday(person.birthday ?? null);
      setGender(person.gender ?? null);
      setLocation(person.location ?? null);
      setDateOfDeath(person.date_of_death ?? null);
      setError('');
      setShowDeleteConfirmation(false);
    }
  }, [person]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Full name is required.');
      return;
    }
    if (birthday && !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
      setError('Birthday must be in YYYY-MM-DD format.');
      return;
    }
    if (dateOfDeath && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfDeath)) {
      setError('Date of death must be in YYYY-MM-DD format.');
      return;
    }
    if (!person) {
      setError('No person selected for editing');
      return;
    }

    const personData: Partial<Person> = {
      id: person.id,
      name: name.trim(),
      nickname: nickname && nickname.trim() ? nickname.trim() : null,
      birthday: birthday && birthday !== '' ? birthday : null,
      gender: gender === 'male' || gender === 'female' ? gender : null,
      location: location && location.trim() ? location.trim() : null,
      date_of_death: dateOfDeath && dateOfDeath !== '' ? dateOfDeath : null,
    };

    try {
      setIsSubmitting(true);
      await onUpdatePerson(personData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update person');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!person) {
      return;
    }
    
    try {
      setIsSubmitting(true);
      await onDeletePerson(person.id);
      setShowDeleteConfirmation(false);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete person');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !person) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        {!showDeleteConfirmation ? (
          <>
            <h2 className="text-xl font-semibold mb-4">Edit Family Member</h2>
            
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}
            
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="name">
                  Full Name<span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                  placeholder="e.g. Venugopal Kulkarni"
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="nickname">
                  Nickname (optional)
                </label>
                <input
                  type="text"
                  id="nickname"
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700"
                  value={nickname ?? ''}
                  onChange={(e) => setNickname(e.target.value === '' ? null : e.target.value)}
                  placeholder="e.g. Venu"
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="birthday">
                  Birthday (YYYY-MM-DD)
                </label>
                <input
                  type="date"
                  id="birthday"
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700"
                  value={birthday ?? ''}
                  onChange={(e) => setBirthday(e.target.value === '' ? null : e.target.value)}
                  placeholder="e.g. 1990-05-17"
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="gender">
                  Gender
                </label>
                <select
                  id="gender"
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700"
                  value={gender ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setGender(val === '' ? null : (val as 'male' | 'female'));
                  }}
                >
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="location">
                  Location (current or last known)
                </label>
                <input
                  type="text"
                  id="location"
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700"
                  value={location ?? ''}
                  onChange={(e) => setLocation(e.target.value === '' ? null : e.target.value)}
                  placeholder="e.g. Belgaum"
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="dateOfDeath">
                  Date of Death (YYYY-MM-DD, optional)
                </label>
                <input
                  type="date"
                  id="dateOfDeath"
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700"
                  value={dateOfDeath ?? ''}
                  onChange={(e) => setDateOfDeath(e.target.value === '' ? null : e.target.value)}
                  placeholder="e.g. 2020-01-01"
                />
              </div>
              <div className="flex items-center justify-between mt-6">
                <div>
                  <button
                    type="button"
                    className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded mr-2"
                    onClick={onClose}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                    onClick={() => setShowDeleteConfirmation(true)}
                    disabled={isSubmitting}
                  >
                    Delete
                  </button>
                </div>
                <button
                  type="submit"
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Updating...' : 'Update'}
                </button>
              </div>
            </form>
            {/* Relationships Section (outside the form) */}
            <div className="mt-8">
              <h3 className="text-lg font-bold mb-2">Relationships</h3>
              {relationships.length === 0 && (
                <div className="text-gray-500 mb-2">No relationships for this person.</div>
              )}
              <ul className="mb-4">
                {relationships.map(rel => {
                  if (!person) return null;
                  const otherPersonId = rel.person1_id === person.id ? rel.person2_id : rel.person1_id;
                  const otherPerson = allPersons.find(p => p.id === otherPersonId);
                  let label = '';
                  if (rel.relationship_type === 'spouse') {
                    label = 'Spouse of';
                  } else if (
                    (rel.relationship_type === 'parent' && rel.person1_id === person.id) ||
                    (rel.relationship_type === 'child' && rel.person2_id === person.id)
                  ) {
                    label = 'Parent of';
                  } else if (
                    (rel.relationship_type === 'parent' && rel.person2_id === person.id) ||
                    (rel.relationship_type === 'child' && rel.person1_id === person.id)
                  ) {
                    label = 'Child of';
                  } else {
                    label = rel.relationship_type.charAt(0).toUpperCase() + rel.relationship_type.slice(1);
                  }
                  return (
                    <li key={rel.id} className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{label}:</span>
                      <span>{otherPerson ? otherPerson.name : otherPersonId}</span>
                      <select
                        value={rel.relationship_type}
                        onChange={e => onUpdateRelationship(rel.id, { relationship_type: e.target.value as 'parent' | 'child' | 'spouse' })}
                        className="border rounded px-1 py-0.5 text-xs"
                      >
                        <option value="parent">Parent</option>
                        <option value="child">Child</option>
                        <option value="spouse">Spouse</option>
                      </select>
                      <button
                        type="button"
                        className="text-red-600 hover:underline text-xs ml-2"
                        onClick={() => onDeleteRelationship(rel.id)}
                        title="Delete relationship"
                      >
                        Delete
                      </button>
                    </li>
                  );
                })}
              </ul>
              {/* Add Relationship Form (outside the main form) */}
              <AddRelationshipForm
                personId={person?.id || ''}
                allPersons={allPersons}
                onAddRelationship={onAddRelationship}
              />
            </div>
          </>
        ) : (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-red-600">Confirm Delete</h2>
            
            <p className="mb-4">
              Are you sure you want to delete {person.name}? This will also remove all their relationships.
            </p>
            
            <div className="flex items-center justify-between mt-6">
              <button
                type="button"
                className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
                onClick={() => setShowDeleteConfirmation(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="bg-red-600 hover:bg-red-800 text-white font-bold py-2 px-4 rounded"
                onClick={handleDelete}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EditPersonModal;