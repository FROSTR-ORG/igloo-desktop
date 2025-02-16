import { BifrostNode } from '@frostr/bifrost'
import { decode_group_pkg, decode_share_pkg } from '@frostr/bifrost/lib'
import { EventEmitter } from 'events'

interface SignerConfig {
  groupCredential: string
  shareCredential: string
  relayUrl?: string
}

export class BifrostSigner {
  private node: BifrostNode
  private relay: WebSocket | null = null
  private emitter: EventEmitter
  private connected: boolean = false
  private readonly relayUrl: string

  constructor(config: SignerConfig) {
    const { groupCredential, shareCredential, relayUrl = 'ws://localhost:8002' } = config
    
    // Decode the credentials
    const group = decode_group_pkg(groupCredential)
    const share = decode_share_pkg(shareCredential)
    
    // Initialize the node with a single relay
    this.node = new BifrostNode(group, share, [relayUrl])
    this.relayUrl = relayUrl
    this.emitter = new EventEmitter()
  }

  public async start(): Promise<void> {
    if (this.connected) {
      throw new Error('Signer is already running')
    }

    try {
      // Set up node event handlers
      this.node.client.on('ready', () => {
        this.emitter.emit('ready')
        console.log('Node connected')
      })

      this.node.client.on('message', (msg) => {
        console.log('Received message:', msg)
        this.emitter.emit('message', msg)
      })

      // Connect to relay using browser's WebSocket
      return new Promise((resolve, reject) => {
        this.relay = new WebSocket(this.relayUrl)
        
        this.relay.onopen = async () => {
          console.log('Relay connected')
          this.emitter.emit('relay_connected')
          
          try {
            // Connect the node after relay is connected
            await this.node.connect()
            this.connected = true
            resolve()
          } catch (error) {
            console.error('Failed to connect node:', error)
            this.relay?.close()
            reject(error)
          }
        }

        this.relay.onerror = (error: Event) => {
          console.error('Relay error:', error)
          this.emitter.emit('error', error)
          reject(error)
        }

        // Add timeout
        setTimeout(() => {
          if (!this.connected) {
            this.relay?.close()
            reject(new Error('Connection timeout'))
          }
        }, 5000) // 5 second timeout
      })
      
    } catch (error) {
      console.error('Failed to start signer:', error)
      throw error
    }
  }

  public async stop(): Promise<void> {
    if (!this.connected) {
      return
    }

    try {
      // Close relay connection
      if (this.relay) {
        this.relay.close()
        this.relay = null
      }

      this.connected = false
      this.emitter.emit('stopped')
      
    } catch (error) {
      console.error('Error stopping signer:', error)
      throw error
    }
  }

  public onReady(callback: () => void): void {
    this.emitter.on('ready', callback)
  }

  public onMessage(callback: (msg: any) => void): void {
    this.emitter.on('message', callback)
  }

  public onRelayConnected(callback: () => void): void {
    this.emitter.on('relay_connected', callback)
  }

  public onError(callback: (error: Error) => void): void {
    this.emitter.on('error', callback)
  }

  public onStopped(callback: () => void): void {
    this.emitter.on('stopped', callback)
  }

  public isConnected(): boolean {
    return this.connected
  }
}
