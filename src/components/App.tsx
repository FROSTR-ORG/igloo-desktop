import React, { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, Play, RotateCcw, Square, Trash2, Upload, Snowflake } from "lucide-react"

const App: React.FC = () => {
  const [isSignerRunning, setIsSignerRunning] = useState(false)
  const [signerEndpoint, setSignerEndpoint] = useState("")

  const toggleSigner = () => {
    setIsSignerRunning(!isSignerRunning)
    if (!isSignerRunning) {
      setSignerEndpoint("192.168.1.100:8080/sign")
    } else {
      setSignerEndpoint("")
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 to-blue-950 text-blue-100 p-8 flex flex-col items-center">
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-center mb-12">
          <Snowflake className="w-10 h-10 mr-3" />
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-300 to-cyan-300">Igloo</h1>
        </div>
        <p className="mb-12 text-blue-400 text-center max-w-xl mx-auto text-sm">
          Frostr keyset generator, rotator, and remote signer.
        </p>

        <Tabs defaultValue="generate" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8 bg-gray-900/50">
            <TabsTrigger value="generate" className="text-sm py-2 text-blue-400 data-[state=active]:bg-blue-900/60 data-[state=active]:text-blue-200">Generate/Rotate Keyset</TabsTrigger>
            <TabsTrigger value="signer" className="text-sm py-2 text-blue-400 data-[state=active]:bg-blue-900/60 data-[state=active]:text-blue-200">Remote Signer</TabsTrigger>
          </TabsList>
          <TabsContent value="generate">
            <Card className="bg-gray-900/30 border-blue-900/30 backdrop-blur-sm shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl text-blue-200">Keyset Management</CardTitle>
                <CardDescription className="text-blue-400 text-sm">Generate or rotate your Frostr keyset</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Button className="w-full py-5 bg-blue-600 hover:bg-blue-700 transition-colors duration-200 text-sm font-medium">
                  Generate Keyset
                </Button>
                <div>
                  <Button className="w-full py-5 bg-purple-600 hover:bg-purple-700 transition-colors duration-200 text-sm font-medium mb-4">
                    Rotate Keyset
                  </Button>
                  <div className="relative">
                    <Input
                      id="rotate-file"
                      type="file"
                      className="bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 pl-10 text-sm file:text-blue-300"
                    />
                    <Upload className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-400" size={16} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="signer">
            <Card className="bg-gray-900/30 border-blue-900/30 backdrop-blur-sm shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl text-blue-200">Remote Signer</CardTitle>
                <CardDescription className="text-blue-400 text-sm">Manage your remote signer endpoint</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Button onClick={toggleSigner} className={`w-full py-5 transition-colors duration-200 text-sm font-medium ${isSignerRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}>
                    {isSignerRunning ? "Stop Remote Signer" : "Start Remote Signer"}
                  </Button>
                  <div className="relative mt-4">
                  <Input
                      id="rotate-file"
                      type="file"
                      className="bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 pl-10 text-sm file:text-blue-300"
                    />
                    <Upload className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-400" size={16} />
                  </div>
                </div>
                {isSignerRunning && (
                  <div className="bg-green-900/20 p-3 rounded-md flex items-center justify-between border border-green-700/30">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="text-green-400" size={16} />
                      <span className="text-green-300 text-sm">Remote Signer Running</span>
                    </div>
                    <span className="text-green-400 font-mono text-sm">{signerEndpoint}</span>
                  </div>
                )}
              </CardContent>
              {isSignerRunning && (
                <CardFooter className="flex justify-between pt-6">
                  <Button variant="outline" size="icon" onClick={toggleSigner} className="bg-gray-800/30 border-gray-700/50 hover:bg-gray-700/50">
                    <Square className="h-4 w-4 text-blue-300" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => setIsSignerRunning(true)} className="bg-gray-800/30 border-gray-700/50 hover:bg-gray-700/50">
                    <Play className="h-4 w-4 text-blue-300" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => {
                    setIsSignerRunning(false)
                    setTimeout(() => setIsSignerRunning(true), 1000)
                  }} className="bg-gray-800/30 border-gray-700/50 hover:bg-gray-700/50">
                    <RotateCcw className="h-4 w-4 text-blue-300" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => {
                    setIsSignerRunning(false)
                    setSignerEndpoint("")
                  }} className="bg-gray-800/30 border-gray-700/50 hover:bg-gray-700/50">
                    <Trash2 className="h-4 w-4 text-blue-300" />
                  </Button>
                </CardFooter>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default App;
