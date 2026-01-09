import React, { useState, useEffect, useRef } from "react"
import ShareList from "@/components/ShareList"
import Create from "@/components/Create"
import Keyset from "@/components/Keyset"
import Signer, { SignerHandle } from "@/components/Signer"
import Recover from "@/components/Recover"
import AddShare from "@/components/AddShare"
import OnboardingWelcome from "@/components/OnboardingWelcome"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { HelpCircle, Plus, Upload } from "lucide-react"
import { clientShareManager } from "@/lib/clientShareManager"
import { Tooltip } from "@/components/ui/tooltip"
import { PageLayout } from "@/components/ui/page-layout"
import { AppHeader } from "@/components/ui/app-header"
import { ContentCard } from "@/components/ui/content-card"
import type { IglooShare } from '@/lib/clientShareManager';

interface KeysetData {
  groupCredential: string;
  shareCredentials: string[];
  name: string;
}

interface SignerData {
  decryptedShare: string;
  groupCredential: string;
  shareRecord: IglooShare;
  threshold?: number;
  totalShares?: number;
}

const App: React.FC = () => {
  const [showingCreate, setShowingCreate] = useState(false);
  const [showingRecover, setShowingRecover] = useState(false);
  const [showingAddShare, setShowingAddShare] = useState(false);
  const [showingOnboarding, setShowingOnboarding] = useState(true);
  const [keysetData, setKeysetData] = useState<KeysetData | null>(null);
  const [showingNewKeyset, setShowingNewKeyset] = useState(false);
  const [signerData, setSignerData] = useState<SignerData | null>(null);
  const [hasShares, setHasShares] = useState(false);
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

  const handleShareLoaded = ({ decryptedShare, groupCredential, shareRecord }: {
    decryptedShare: string;
    groupCredential: string;
    shareRecord: IglooShare;
  }) => {
    setSignerData({ decryptedShare, groupCredential, shareRecord });
    // Ensure we're on the signer tab when a share is loaded
    const signerTab = document.querySelector('[data-state="active"][value="signer"]');
    if (!signerTab) {
      const signerTabTrigger = document.querySelector('[value="signer"]');
      if (signerTabTrigger instanceof HTMLElement) {
        signerTabTrigger.click();
      }
    }
  };

  const handleBackToShares = async () => {
    // Stop signer before navigating away
    await signerRef.current?.stopSigner().catch(console.error);
    setSignerData(null);
    setShowingCreate(false);
    setShowingRecover(false);
    setShowingAddShare(false);
  };

  const handleTabChange = async (value: string) => {
    // If switching away from signer tab, stop the signer
    if (activeTab === "signer" && value !== "signer") {
      await signerRef.current?.stopSigner().catch(console.error);
    }
    setActiveTab(value);
  };

  const handleFinish = () => {
    setKeysetData(null);
    setShowingNewKeyset(false);
    setShowingCreate(false);
  };

  const handleRecoverBack = () => {
    setShowingRecover(false);
  };

  const handleAddShareComplete = async () => {
    setShowingAddShare(false);
    // Refresh shares list
    const shares = await clientShareManager.getShares();
    setHasShares(Array.isArray(shares) && shares.length > 0);
  };

  const handleAddShareCancel = () => {
    setShowingAddShare(false);
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
                  <p>Once you click &quot;Finish&quot;, the keyset will be removed from memory and remain distributed where you manually saved them.</p>
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

  // Show standalone recovery view
  if (showingRecover) {
    return (
      <PageLayout>
        <AppHeader />

        <ContentCard
          title="Recover NSEC"
          headerRight={
            <div className="flex items-center gap-2">
              <Tooltip
                trigger={<HelpCircle size={20} className="text-blue-400 cursor-pointer" />}
                content={
                  <>
                    <p className="mb-2 font-semibold">Standalone Recovery:</p>
                    <p className="mb-2">This flow allows you to recover your nsec without loading a saved share first.</p>
                    <p className="mb-2">Start by pasting your group credential (bfgroup...), which will determine how many shares you need.</p>
                    <p>Then paste the required number of share credentials to reconstruct your private key.</p>
                  </>
                }
              />
              <Button
                variant="ghost"
                onClick={handleRecoverBack}
                className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/30"
              >
                Back
              </Button>
            </div>
          }
        >
          <Recover mode="standalone" />
        </ContentCard>
      </PageLayout>
    );
  }

  // Show add share wizard
  if (showingAddShare) {
    return (
      <PageLayout>
        <AppHeader />

        <ContentCard
          title="Add Existing Share"
          headerRight={
            <Tooltip
              trigger={<HelpCircle size={20} className="text-blue-400 cursor-pointer" />}
              content={
                <>
                  <p className="mb-2 font-semibold">Import a Share:</p>
                  <p className="mb-2">This flow allows you to import an existing share without creating a new keyset.</p>
                  <p className="mb-2">First, paste your group credential to see keyset details.</p>
                  <p>Then, paste one share credential and save it with a password.</p>
                </>
              }
            />
          }
        >
          <AddShare onComplete={handleAddShareComplete} onCancel={handleAddShareCancel} />
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
                initialShare={signerData?.decryptedShare} 
                initialGroupCredential={signerData?.groupCredential}
                defaultThreshold={signerData?.threshold}
                defaultTotalShares={signerData?.totalShares}
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
        ) : !hasShares && showingOnboarding ? (
          <OnboardingWelcome onGetStarted={() => setShowingOnboarding(false)} />
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
                        <p className="mb-2">To start signing Nostr notes, you need to load one of your saved shares by clicking the &quot;Load&quot; button.</p>
                        <p className="mb-2">Once loaded, you&apos;ll be taken to the Signer interface where you can configure relays and start the signer to handle requests.</p>
                        <p className="mb-2">Igloo does not allow you to publish notes at this time only participate in signing.</p>
                        <p className="mb-2">Checkout <a href="https://frostr.org/apps" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">frostr.org/apps</a> for our other frostr clients including Frost2x which allows you to publish notes through the browser.</p>
                      </>
                    }
                  />
                )}
                <Button
                  onClick={() => setShowingAddShare(true)}
                  className="bg-green-600 hover:bg-green-700 text-green-100 transition-colors"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Add
                </Button>
                <Button
                  onClick={() => setShowingRecover(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-purple-100 transition-colors"
                >
                  Recover
                </Button>
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
