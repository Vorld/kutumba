'use client';

import React, { useState, useEffect } from 'react';
import { Person } from '../../types';

interface AddPersonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddPerson: (personData: Partial<Person>, relationshipType: string, relatedPersonId: string | null) => Promise<void>;
  existingPersons: Person[];
}

const AddPersonModal: React.FC<AddPersonModalProps> = ({ 
  isOpen, 
  onClose, 
  onAddPerson, 
  existingPersons 
}) => {
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [birthday, setBirthday] = useState('');
  const [gender, setGender] = useState('');
  const [relationshipType, setRelationshipType] = useState('none');
  const [relatedPersonId, setRelatedPersonId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setName('');
      setNickname('');
      setBirthday('');
      setGender('');
      setRelationshipType('none');
      setRelatedPersonId('');
      setError('');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (relationshipType !== 'none' && !relatedPersonId) {
      setError('Please select a person to establish the relationship');
      return;
    }

    const personData: Partial<Person> = {
      name: name.trim(),
      nickname: nickname.trim() || null,
      birthday: birthday || null,
      gender: gender || null,
    };

    try {
      setIsSubmitting(true);
      await onAddPerson(
        personData, 
        relationshipType, 
        relationshipType === 'none' ? null : relatedPersonId
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add person');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Add Family Member</h2>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="name">
              Name*
            </label>
            <input
              type="text"
              id="name"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="nickname">
              Nickname
            </label>
            <input
              type="text"
              id="nickname"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="birthday">
              Birthday
            </label>
            <input
              type="date"
              id="birthday"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="gender">
              Gender
            </label>
            <select
              id="gender"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
            >
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="relationshipType">
              Relationship
            </label>
            <select
              id="relationshipType"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700"
              value={relationshipType}
              onChange={(e) => setRelationshipType(e.target.value)}
            >
              <option value="none">No relationship (root person)</option>
              <option value="spouse">Spouse of existing person</option>
              <option value="child">Child of existing person</option>
              <option value="parent">Parent of existing person</option>
            </select>
          </div>
          
          {relationshipType !== 'none' && (
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="relatedPerson">
                {relationshipType === 'spouse' ? 'Spouse of' : 
                 relationshipType === 'child' ? 'Child of' : 'Parent of'}
              </label>
              <select
                id="relatedPerson"
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700"
                value={relatedPersonId}
                onChange={(e) => setRelatedPersonId(e.target.value)}
                required
              >
                <option value="">Select a person</option>
                {existingPersons.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name} {person.nickname ? `(${person.nickname})` : ''}
                  </option>
                ))}
              </select>
              
              {/* Help text for relationships */}
              {relationshipType === 'child' && (
                <p className="mt-2 text-sm text-gray-500">
                  If this person has two parents and one parent is the spouse of the selected person, 
                  both parent relationships will be automatically created.
                </p>
              )}
              {relationshipType === 'parent' && (
                <p className="mt-2 text-sm text-gray-500">
                  This will add the new person as a parent of the selected person. If the selected person
                  already has a parent of the same gender, you may want to add as a spouse instead.
                </p>
              )}
            </div>
          )}
          
          <div className="flex items-center justify-between mt-6">
            <button
              type="button"
              className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Adding...' : 'Add Person'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddPersonModal;
