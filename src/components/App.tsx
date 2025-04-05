import React, { useState } from "react"
import ShareList from "@/components/ShareList"
import Create from "@/components/Create"
import Keyset from "@/components/Keyset"
import Signer from "@/components/Signer"
import Recover from "@/components/Recover"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface KeysetData {
  groupCredential: string;
  shareCredentials: string[];
  name: string;
}

interface SignerData {
  share: string;
  groupCredential: string;
  threshold?: number;
  totalShares?: number;
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
    // Ensure we're on the signer tab when a share is loaded
    const signerTab = document.querySelector('[data-state="active"][value="signer"]');
    if (!signerTab) {
      const signerTabTrigger = document.querySelector('[value="signer"]');
      if (signerTabTrigger instanceof HTMLElement) {
        signerTabTrigger.click();
      }
    }
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
            <img src="./src/assets/frostr-logo-transparent.png" alt="Frostr Logo" className="w-12 h-12 mr-2" />
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
            <img src="./src/assets/frostr-logo-transparent.png" alt="Frostr Logo" className="w-12 h-12 mr-2" />
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
            
            <Tabs defaultValue="signer" className="w-full">
              <TabsList className="grid grid-cols-2 mb-4 bg-gray-800/50 w-full">
                <TabsTrigger value="signer" className="text-sm py-2 text-blue-400 data-[state=active]:bg-blue-900/60 data-[state=active]:text-blue-200">
                  Signer
                </TabsTrigger>
                <TabsTrigger value="recover" className="text-sm py-2 text-blue-400 data-[state=active]:bg-blue-900/60 data-[state=active]:text-blue-200">
                  Recover
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="signer" className="border border-blue-900/30 rounded-lg p-4">
                <Signer initialData={signerData} />
              </TabsContent>
              
              <TabsContent value="recover" className="border border-purple-900/30 rounded-lg p-4">
                <Recover 
                  initialShare={signerData?.share} 
                  initialGroupCredential={signerData?.groupCredential}
                  threshold={signerData?.threshold}
                  totalShares={signerData?.totalShares}
                />
              </TabsContent>
            </Tabs>
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
          <img src="./src/assets/frostr-logo-transparent.png" alt="Frostr Logo" className="w-12 h-12 mr-2" />
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
