import React, { useState, useEffect, useRef } from "react"
import ShareList from "@/components/ShareList"
import Create from "@/components/Create"
import Keyset from "@/components/Keyset"
import Signer, { SignerHandle } from "@/components/Signer"
import Recover from "@/components/Recover"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { HelpCircle, Plus } from "lucide-react"
import { clientShareManager } from "@/lib/clientShareManager"
import { Tooltip } from "@/components/ui/tooltip"
import { PageLayout } from "@/components/ui/page-layout"
import { AppHeader } from "@/components/ui/app-header"
import { ContentCard } from "@/components/ui/content-card"

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
  const [showTooltip, setShowTooltip] = useState(false);
  const [hasShares, setHasShares] = useState(false);
  const [showMainTooltip, setShowMainTooltip] = useState(false);
  const [activeTab, setActiveTab] = useState("signer");
  // Reference to the Signer component to call its stop method
  const signerRef = useRef<SignerHandle>(null);

  useEffect(() => {
    // Check if there are any shares saved
    const checkForShares = async () => {
      const shares = await clientShareManager.getShares();
      setHasShares(Array.isArray(shares) && shares.length > 0);
    };
    
    checkForShares();
  }, []);

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
    // Stop signer before navigating away
    if (signerRef.current) {
      signerRef.current.stopSigner();
    }
    setSignerData(null);
    setShowingCreate(false);
  };

  const handleTabChange = (value: string) => {
    // If switching away from signer tab, stop the signer
    if (activeTab === "signer" && value !== "signer" && signerRef.current) {
      signerRef.current.stopSigner();
    }
    setActiveTab(value);
  };

  const handleFinish = () => {
    setKeysetData(null);
    setShowingNewKeyset(false);
    setShowingCreate(false);
  };

  // Show new keyset view
  if (showingNewKeyset && keysetData) {
    return (
      <PageLayout>
        <AppHeader />
        
        <ContentCard
          title="New Keyset Created"
          headerRight={
            <Tooltip 
              trigger={<HelpCircle size={20} className="text-blue-400 cursor-pointer" />}
              content={
                <>
                  <p className="mb-2 font-semibold">Important!</p>
                  <p className="mb-2">This is the only screen where your complete keyset is shown. You must save each share you want to keep on this device (each with its own password) and/or copy and move individual shares to other devices, like our browser extension signer <a href="https://github.com/FROSTR-ORG/frost2x" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Frost2x</a>.</p>
                  <p>Once you click "Finish", the keyset will be removed from memory and remain distributed where you manually saved them.</p>
                </>
              }
            />
          }
        >
          <Keyset 
            name={keysetData.name}
            groupCredential={keysetData.groupCredential}
            shareCredentials={keysetData.shareCredentials}
            onFinish={handleFinish}
          />
        </ContentCard>
      </PageLayout>
    );
  }

  // Show signer view when share is loaded
  if (signerData) {
    return (
      <PageLayout>
        <AppHeader />
        
        <ContentCard
          title="Signer"
          headerRight={
            <Button
              variant="ghost"
              onClick={handleBackToShares}
              className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/30"
            >
              Back to Shares
            </Button>
          }
        >
          <Tabs 
            defaultValue="signer" 
            className="w-full"
            value={activeTab}
            onValueChange={handleTabChange}
          >
            <TabsList className="grid grid-cols-2 mb-4 bg-gray-800/50 w-full">
              <TabsTrigger value="signer" className="text-sm py-2 text-blue-400 data-[state=active]:bg-blue-900/60 data-[state=active]:text-blue-200">
                Signer
              </TabsTrigger>
              <TabsTrigger value="recover" className="text-sm py-2 text-blue-400 data-[state=active]:bg-blue-900/60 data-[state=active]:text-blue-200">
                Recover
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="signer" className="border border-blue-900/30 rounded-lg p-4">
              <Signer 
                initialData={signerData} 
                ref={signerRef}
              />
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
        </ContentCard>
      </PageLayout>
    );
  }

  // Show main view
  return (
    <PageLayout>
      <AppHeader subtitle="Frostr keyset manager and remote signer." />

      <ContentCard>
        {showingCreate ? (
          <Create onKeysetCreated={handleKeysetCreated} onBack={() => setShowingCreate(false)} />
        ) : (
          <>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-blue-300">Available Shares</h2>
              <div className="flex items-center gap-2">
                {hasShares && (
                  <Tooltip 
                    trigger={<HelpCircle size={20} className="text-blue-400 cursor-pointer mr-2" />}
                    content={
                      <>
                        <p className="mb-2 font-semibold">How to use Igloo:</p>
                        <p className="mb-2">To start signing Nostr notes, you need to load one of your saved shares by clicking the "Load" button.</p>
                        <p>Once loaded, you'll be taken to the Signer interface where you can configure relays and start the signer to handle requests.</p>
                      </>
                    }
                  />
                )}
                <Button
                  onClick={() => setShowingCreate(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-blue-100 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create New
                </Button>
              </div>
            </div>
            <ShareList onShareLoaded={handleShareLoaded} onNewKeyset={() => setShowingCreate(true)} />
          </>
        )}
      </ContentCard>
    </PageLayout>
  )
}

export default App;
