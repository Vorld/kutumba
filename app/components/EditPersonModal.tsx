'use client';

import React, { useState, useEffect } from 'react';
import { Person } from '../../types';

interface EditPersonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdatePerson: (personData: Partial<Person>) => Promise<void>;
  onDeletePerson: (personId: string) => Promise<void>;
  person: Person | null;
}

const EditPersonModal: React.FC<EditPersonModalProps> = ({ 
  isOpen, 
  onClose, 
  onUpdatePerson,
  onDeletePerson,
  person 
}) => {
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [birthday, setBirthday] = useState('');
  const [gender, setGender] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  // Update form when person changes
  useEffect(() => {
    if (person) {
      setName(person.name || '');
      setNickname(person.nickname || '');
      setBirthday(person.birthday || '');
      setGender(person.gender || '');
      setError('');
      setShowDeleteConfirmation(false);
    }
  }, [person]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (!person) {
      setError('No person selected for editing');
      return;
    }

    const personData: Partial<Person> = {
      id: person.id,
      name: name.trim(),
      nickname: nickname.trim() || null,
      birthday: birthday || null,
      gender: gender || null,
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
