import React, { useEffect, useState } from 'react';

// This interface mirrors the one in the main process
interface IglooProfile {
  id: string;
  name: string;
  [key: string]: any;
}

// For Electron IPC in renderer process (non-contextIsolation mode)
const { ipcRenderer } = window.require('electron');

const ProfileManager: React.FC = () => {
  const [profiles, setProfiles] = useState<IglooProfile[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [newProfileName, setNewProfileName] = useState<string>('');

  // Load profiles on component mount
  useEffect(() => {
    loadProfiles();
  }, []);

  // Function to load profiles from the main process
  const loadProfiles = async () => {
    setLoading(true);
    try {
      const result = await ipcRenderer.invoke('get-profiles');
      if (result === false) {
        setProfiles([]);
      } else {
        setProfiles(result);
      }
      setError(null);
    } catch (err) {
      setError('Failed to load profiles');
      console.error('Error loading profiles:', err);
    } finally {
      setLoading(false);
    }
  };

  // Function to create a new profile
  const createProfile = async () => {
    if (!newProfileName.trim()) {
      setError('Profile name cannot be empty');
      return;
    }

    try {
      const newProfile: IglooProfile = {
        id: `profile_${Date.now()}`, // Simple ID generation
        name: newProfileName.trim(),
        createdAt: new Date().toISOString()
      };

      const success = await ipcRenderer.invoke('save-profile', newProfile);
      
      if (success) {
        setNewProfileName('');
        await loadProfiles(); // Reload profiles
        setError(null);
      } else {
        setError('Failed to create profile');
      }
    } catch (err) {
      setError('Error creating profile');
      console.error('Error creating profile:', err);
    }
  };

  // Function to delete a profile
  const deleteProfile = async (profileId: string) => {
    try {
      const success = await ipcRenderer.invoke('delete-profile', profileId);
      
      if (success) {
        await loadProfiles(); // Reload profiles
        setError(null);
      } else {
        setError(`Failed to delete profile ${profileId}`);
      }
    } catch (err) {
      setError('Error deleting profile');
      console.error('Error deleting profile:', err);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Profile Manager</h2>
      
      {/* Create new profile form */}
      <div className="mb-6 p-4 border rounded-md">
        <h3 className="text-lg font-semibold mb-2">Create New Profile</h3>
        <div className="flex items-center">
          <input
            type="text"
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
            placeholder="Profile Name"
            className="flex-1 p-2 border rounded-md mr-2"
          />
          <button
            onClick={createProfile}
            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
          >
            Create
          </button>
        </div>
      </div>
      
      {/* Error display */}
      {error && (
        <div className="mb-4 p-2 bg-red-100 text-red-800 rounded-md">
          {error}
        </div>
      )}
      
      {/* Profiles list */}
      <div>
        <h3 className="text-lg font-semibold mb-2">Your Profiles</h3>
        
        {loading ? (
          <p>Loading profiles...</p>
        ) : profiles && profiles.length > 0 ? (
          <ul className="border rounded-md divide-y">
            {profiles.map(profile => (
              <li key={profile.id} className="p-3 flex justify-between items-center">
                <span>{profile.name}</span>
                <button
                  onClick={() => deleteProfile(profile.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">No profiles found. Create one to get started.</p>
        )}
      </div>
    </div>
  );
};

export default ProfileManager; 