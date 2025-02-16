import { EventEmitter } from 'events'

export class NostrRelay {
  private readonly _emitter: EventEmitter
  private _socket: WebSocket | null = null
  private readonly _port: number
  private _isConnected: boolean = false

  constructor(port: number) {
    this._emitter = new EventEmitter()
    this._port = port
  }

  async start(): Promise<void> {
    if (this._socket) {
      throw new Error('Relay is already running')
    }

    return new Promise((resolve, reject) => {
      try {
        this._socket = new window.WebSocket(`ws://localhost:${this._port}`);
        
        this._socket.onopen = () => {
          console.log('Connected to relay server');
          this._isConnected = true;
          this._emitter.emit('connected');
          resolve();
        };

        this._socket.onerror = (error) => {
          console.error('Relay connection error:', error);
          this._isConnected = false;
          reject(error);
        };

        this._socket.onclose = () => {
          console.log('Relay connection closed');
          this._isConnected = false;
          this._emitter.emit('disconnected');
        };

        this._socket.onmessage = (event) => {
          console.log('Received message:', event.data);
          this._emitter.emit('message', event.data);
        };
      } catch (error) {
        console.error('Failed to create WebSocket:', error);
        reject(error);
      }
    });
  }

  close(): void {
    if (this._socket) {
      this._socket.close();
      this._socket = null;
      this._isConnected = false;
    }
  }

  isRunning(): boolean {
    return this._isConnected && this._socket?.readyState === WebSocket.OPEN;
  }

  onMessage(callback: (data: any) => void): void {
    this._emitter.on('message', callback);
  }

  onConnected(callback: () => void): void {
    this._emitter.on('connected', callback);
  }

  onDisconnected(callback: () => void): void {
    this._emitter.on('disconnected', callback);
  }
} 