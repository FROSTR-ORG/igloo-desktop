export const nip19 = {
  decode: jest.fn().mockImplementation((input: string) => {
    if (!input || typeof input !== 'string') {
      throw new Error('Invalid input');
    }

    if (input.startsWith('nsec')) {
      return { 
        type: 'nsec', 
        data: 'd5511c9ab0ef3578c939da718bf7bcfebd3a8bacce7cd7e58dcd7d8bf9aa374e'
      };
    }
    
    if (input.startsWith('npub')) {
      return { 
        type: 'npub', 
        data: '95e86b7341bf616a89753fde329e1a6376580af7161d9c805144c021e0c7220e'
      };
    }
    
    throw new Error('Invalid format');
  }),
  
  nsecEncode: jest.fn().mockImplementation((hexData: Uint8Array | Buffer) => {
    if (!hexData || typeof hexData !== 'object') {
      throw new Error('Invalid hex data');
    }
    return 'nsec1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
  }),
  
  npubEncode: jest.fn().mockImplementation((hexData: Uint8Array | Buffer) => {
    if (!hexData || typeof hexData !== 'object') {
      throw new Error('Invalid hex data');
    }
    return 'npub1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
  })
};

// Define types for the Relay class
interface RelayInterface {
  url: string;
  status: string;
  connect(): Promise<RelayInterface>;
  disconnect(): Promise<void>;
  publish(event: any): Promise<boolean>;
  subscribe(filters: any): { on: jest.Mock; off: jest.Mock; unsub: jest.Mock };
}

// Simple mock for relay connections
export class Relay implements RelayInterface {
  url: string;
  status: string;
  
  constructor(url: string) {
    this.url = url;
    this.status = 'disconnected';
  }
  
  connect(): Promise<Relay> {
    this.status = 'connected';
    return Promise.resolve(this);
  }
  
  disconnect(): Promise<void> {
    this.status = 'disconnected';
    return Promise.resolve();
  }
  
  publish(event: any): Promise<boolean> {
    return Promise.resolve(true);
  }
  
  subscribe(filters: any) {
    return {
      on: jest.fn(),
      off: jest.fn(),
      unsub: jest.fn(),
    };
  }
}

// Simple mock for generating keys
export const generatePrivateKey = jest.fn().mockReturnValue('d5511c9ab0ef3578c939da718bf7bcfebd3a8bacce7cd7e58dcd7d8bf9aa374e');
export const getPublicKey = jest.fn().mockReturnValue('95e86b7341bf616a89753fde329e1a6376580af7161d9c805144c021e0c7220e');

// Simple mock for signing events
export const signEvent = jest.fn().mockImplementation((event: any, privateKey: string) => {
  return {
    ...event,
    sig: 'mockedsignature000000000000000000000000000000000000000000000000000000000000000000',
  };
});

// Simple mock for verifying signatures
export const verifySignature = jest.fn().mockReturnValue(true); 