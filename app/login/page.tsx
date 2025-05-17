'use client';

import { useState, FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { LoginFormData } from '@/types';

// Component that uses useSearchParams must be wrapped in Suspense
function LoginForm() {
  const [formData, setFormData] = useState<LoginFormData>({
    password: '',
    name: '',
    phone: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';
  
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      if (response.ok) {
        // If successful, redirect to the original URL or home page
        router.push(redirect);
      } else {
        // If not successful, show error message
        const data = await response.json();
        setError(data.message || 'Invalid password');
      }
    } catch (err) {
      setError('An error occurred: ' + err + '. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-stone-900">
      <div className="w-full max-w-md p-6 bg-stone-800 rounded-lg shadow-xl border border-stone-700">
        <h1 className="text-2xl font-bold mb-6 text-center text-stone-100">Kutumba</h1>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-stone-300 mb-1">
              Shared Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              required
              value={formData.password}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-stone-600 rounded-md bg-stone-700 text-white focus:outline-none focus:ring-2 focus:ring-stone-500 placeholder-stone-400"
              placeholder="Enter the family password"
            />
          </div>
          
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-stone-300 mb-1">
              Your Name (Optional)
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-stone-600 rounded-md bg-stone-700 text-white focus:outline-none focus:ring-2 focus:ring-stone-500 placeholder-stone-400"
              placeholder="Enter your name"
            />
          </div>
          
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-stone-300 mb-1">
              Phone Number (Optional)
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-stone-600 rounded-md bg-stone-700 text-white focus:outline-none focus:ring-2 focus:ring-stone-500 placeholder-stone-400"
              placeholder="+91 12345 67890"
              pattern="^\+[0-9\s\-()]{5,20}$"
            />
            <p className="text-xs text-stone-400 mt-1">
              Include country code (e.g., +91 for India). I&apos;ll only use this to notify you if the family password changes.
            </p>
          </div>
          
          {error && (
            <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded">
              {error}
            </div>
          )}
          
          <button
            type="submit"
            disabled={isLoading || !formData.password}
            className="w-full bg-stone-600 hover:bg-stone-700 text-white font-medium py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-stone-500 focus:ring-offset-2 focus:ring-offset-stone-800 disabled:bg-stone-500 disabled:text-stone-300"
          >
            {isLoading ? 'Loading...' : 'Log In'}
          </button>
        </form>
      </div>
    </div>
  );
}

// Loading fallback component for the Suspense boundary
function LoginFormFallback() {
  return (
    <div className="flex flex-col items-center justify-center p-4 bg-stone-900">
        <h1 className="text-2xl font-bold mb-6 text-center text-stone-100">Kutumba</h1>
        <div className="flex justify-center">
          <div className="animate-pulse text-stone-300">Loading...</div>
        </div>
    </div>
  );
}

// Main component that wraps the LoginForm in a Suspense boundary
export default function Login() {
  return (
    <Suspense fallback={<LoginFormFallback />}>
      <LoginForm />
    </Suspense>
  );
}
