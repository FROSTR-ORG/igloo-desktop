import React, { useState } from "react"
import FrostrLogo from "@/assets/frostr-logo-transparent.png"
import ShareList from "@/components/ShareList"
import Create from "@/components/Create"
import Keyset from "@/components/Keyset"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface KeysetData {
  groupCredential: string;
  shareCredentials: string[];
  name: string;
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState("shares");
  const [keysetData, setKeysetData] = useState<KeysetData | null>(null);
  const [showingNewKeyset, setShowingNewKeyset] = useState(false);

  const handleKeysetCreated = (data: KeysetData) => {
    setKeysetData(data);
    setShowingNewKeyset(true);
  };

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
            />
          </div>
        </div>
      </div>
    );
  }

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
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 bg-gray-900/50">
              <TabsTrigger 
                value="shares" 
                className="text-sm py-2 text-blue-400 data-[state=active]:bg-blue-900/60 data-[state=active]:text-blue-200"
              >
                Available Profiles
              </TabsTrigger>
              <TabsTrigger 
                value="create" 
                className="text-sm py-2 text-blue-400 data-[state=active]:bg-blue-900/60 data-[state=active]:text-blue-200"
              >
                Create New
              </TabsTrigger>
            </TabsList>

            <TabsContent value="shares">
              <ShareList />
            </TabsContent>

            <TabsContent value="create">
              <Create onKeysetCreated={handleKeysetCreated} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

export default App;
