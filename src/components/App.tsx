import React, { useState } from "react"
import FrostrLogo from "@/assets/frostr-logo-transparent.png"
import ShareList from "@/components/ShareList"
import Create from "@/components/Create"
import Keyset from "@/components/Keyset"
import Signer from "@/components/Signer"
import { Button } from "@/components/ui/button"

interface KeysetData {
  groupCredential: string;
  shareCredentials: string[];
  name: string;
}

interface SignerData {
  share: string;
  groupCredential: string;
}

const App: React.FC = () => {
  const [showingCreate, setShowingCreate] = useState(false);
  const [keysetData, setKeysetData] = useState<KeysetData | null>(null);
  const [showingNewKeyset, setShowingNewKeyset] = useState(false);
  const [signerData, setSignerData] = useState<SignerData | null>(null);

  const handleKeysetCreated = (data: KeysetData) => {
    setKeysetData(data);
    setShowingNewKeyset(true);
    setShowingCreate(false);
  };

  const handleShareLoaded = (share: string, groupCredential: string) => {
    setSignerData({ share, groupCredential });
  };

  const handleBackToShares = () => {
    setSignerData(null);
    setShowingCreate(false);
  };

  const handleFinish = () => {
    setKeysetData(null);
    setShowingNewKeyset(false);
    setShowingCreate(false);
  };

  // Show new keyset view
  if (showingNewKeyset && keysetData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 to-blue-950 text-blue-100 p-8 flex flex-col items-center">
        <div className="w-full max-w-3xl">
          <div className="flex items-center justify-center mb-8">
            <img src={FrostrLogo} alt="Frostr Logo" className="w-12 h-12 mr-2" />
            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-300 to-cyan-300">Igloo</h1>
          </div>
          
          <div className="bg-gray-900/40 rounded-lg p-6 shadow-lg">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-blue-300">New Keyset Created</h2>
            </div>
            <Keyset 
              name={keysetData.name}
              groupCredential={keysetData.groupCredential}
              shareCredentials={keysetData.shareCredentials}
              onFinish={handleFinish}
            />
          </div>
        </div>
      </div>
    );
  }

  // Show signer view when share is loaded
  if (signerData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 to-blue-950 text-blue-100 p-8 flex flex-col items-center">
        <div className="w-full max-w-3xl">
          <div className="flex items-center justify-center mb-8">
            <img src={FrostrLogo} alt="Frostr Logo" className="w-12 h-12 mr-2" />
            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-300 to-cyan-300">Igloo</h1>
          </div>
          
          <div className="bg-gray-900/40 rounded-lg p-6 shadow-lg">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-blue-300">Signer</h2>
              <Button
                variant="ghost"
                onClick={handleBackToShares}
                className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/30"
              >
                Back to Shares
              </Button>
            </div>
            <Signer initialData={signerData} />
          </div>
        </div>
      </div>
    );
  }

  // Show main view
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 to-blue-950 text-blue-100 p-8 flex flex-col items-center">
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-center mb-8">
          <img src={FrostrLogo} alt="Frostr Logo" className="w-12 h-12 mr-2" />
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-300 to-cyan-300">Igloo</h1>
        </div>
        <p className="mb-8 text-blue-400 text-center max-w-xl mx-auto text-sm">
          Frostr keyset manager and remote signer.
        </p>

        <div className="bg-gray-900/40 rounded-lg p-6 shadow-lg">
          {showingCreate ? (
            <Create onKeysetCreated={handleKeysetCreated} onBack={() => setShowingCreate(false)} />
          ) : (
            <ShareList onShareLoaded={handleShareLoaded} onNewKeyset={() => setShowingCreate(true)} />
          )}
        </div>
      </div>
    </div>
  )
}

export default App;
