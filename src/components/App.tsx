import React from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import FrostrLogo from "@/assets/frostr-logo-transparent.png"
import Create from "@/components/Create"
import Signer from "@/components/Signer"
import ShareList from "@/components/ShareList"
import LoadShare from "@/components/LoadShare"
import SaveShare from "@/components/SaveShare"
import Manage from "@/components/Manage"

const App: React.FC = () => {
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

        <Tabs defaultValue="keys" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8 bg-gray-900/50">
            <TabsTrigger value="keys" className="text-sm py-2 text-blue-400 data-[state=active]:bg-blue-900/60 data-[state=active]:text-blue-200">Keys</TabsTrigger>
            <TabsTrigger value="manage" className="text-sm py-2 text-blue-400 data-[state=active]:bg-blue-900/60 data-[state=active]:text-blue-200">Manage</TabsTrigger>
            <TabsTrigger value="signer" className="text-sm py-2 text-blue-400 data-[state=active]:bg-blue-900/60 data-[state=active]:text-blue-200">Signer</TabsTrigger>
            <TabsTrigger value="shares" className="text-sm py-2 text-blue-400 data-[state=active]:bg-blue-900/60 data-[state=active]:text-blue-200">Shares</TabsTrigger>
            <TabsTrigger value="loadshare" className="text-sm py-2 text-blue-400 data-[state=active]:bg-blue-900/60 data-[state=active]:text-blue-200">Load Share</TabsTrigger>
            <TabsTrigger value="saveshare" className="text-sm py-2 text-blue-400 data-[state=active]:bg-blue-900/60 data-[state=active]:text-blue-200">Save Share</TabsTrigger>
          </TabsList>

          <TabsContent value="keys">
            <Create />
          </TabsContent>

          <TabsContent value="manage">
            <Manage />
          </TabsContent>

          <TabsContent value="signer">
            <Signer />
          </TabsContent>

          <TabsContent value="shares">
            <ShareList />
          </TabsContent>

          <TabsContent value="loadshare">
            <LoadShare />
          </TabsContent>

          <TabsContent value="saveshare">
            <SaveShare />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default App;
