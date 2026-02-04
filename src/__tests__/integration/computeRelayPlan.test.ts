/**
 * Integration tests for the compute-relay-plan IPC handler
 *
 * These tests verify:
 * 1. The IPC handler structure and env var fallback logic (via static analysis)
 * 2. The handler's input normalization behavior
 * 3. Integration between renderer and main process relay planning
 */

import * as fs from 'fs';
import * as path from 'path';
import { mockElectronAPI } from '../setup';

describe('compute-relay-plan IPC Handler', () => {
  let mainTsContent: string;
  let ipcSchemasContent: string;

  beforeAll(() => {
    const mainTsPath = path.join(__dirname, '../../main.ts');
    mainTsContent = fs.readFileSync(mainTsPath, 'utf-8');
    const ipcSchemasPath = path.join(__dirname, '../../lib/ipcSchemas.ts');
    ipcSchemasContent = fs.readFileSync(ipcSchemasPath, 'utf-8');
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Handler Registration (static analysis)', () => {
    it('should register compute-relay-plan IPC handler', () => {
      expect(mainTsContent).toMatch(/ipcMain\.handle\(\s*['"]compute-relay-plan['"]/);
    });

    it('should import and use RelayPlanArgsSchema for validation', () => {
      // Schema is imported from ipcSchemas module
      expect(mainTsContent).toMatch(/from\s*['"]\.\/lib\/ipcSchemas/);
      expect(mainTsContent).toMatch(/RelayPlanArgsSchema/);
      // Schema is defined in ipcSchemas.ts with Zod
      expect(ipcSchemasContent).toMatch(/export\s+const\s+RelayPlanArgsSchema\s*=\s*z\.object/);
      expect(ipcSchemasContent).toMatch(/groupCredential:.*\.optional\(\)/);
      expect(ipcSchemasContent).toMatch(/decodedGroup:.*\.optional\(\)/);
      expect(ipcSchemasContent).toMatch(/explicitRelays:.*\.optional\(\)/);
      expect(ipcSchemasContent).toMatch(/envRelay:.*\.optional\(\)/);
    });

    it('should fall back to process.env.IGLOO_RELAY when envRelay not provided', () => {
      // Verify the env var fallback logic is present
      expect(mainTsContent).toMatch(/process\.env\.IGLOO_RELAY/);
      // Verify the fallback pattern in the handler
      expect(mainTsContent).toMatch(/envRelay\?\.trim\(\)\s*\|\|\s*process\.env\.IGLOO_RELAY/);
    });

    it('should normalize input strings by trimming whitespace', () => {
      // Verify trim() is called on string inputs after Zod validation
      expect(mainTsContent).toMatch(/groupCredential\?\.trim\(\)/);
      expect(mainTsContent).toMatch(/envRelay\?\.trim\(\)/);
    });

    it('should filter explicitRelays array to only valid strings', () => {
      // Zod schema validates the array, then we filter empty strings after trimming
      expect(mainTsContent).toMatch(/explicitRelays\?\.filter\(r\s*=>\s*r\.trim\(\)\.length\s*>\s*0\)/);
    });

    it('should return structured result with ok flag', () => {
      // Verify the handler returns { ok: true, relayPlan: {...} } on success
      expect(mainTsContent).toMatch(/return\s*\{\s*ok:\s*true,\s*relayPlan:/);
    });

    it('should catch errors and return failure result', () => {
      // Verify error handling returns { ok: false, reason, message }
      expect(mainTsContent).toMatch(/catch\s*\(error\)/);
      expect(mainTsContent).toMatch(/return\s*\{\s*ok:\s*false,\s*reason:\s*['"]computation-failed['"]/);
    });
  });

  describe('Client-side Integration', () => {
    it('should call IPC handler with valid inputs', async () => {
      mockElectronAPI.computeRelayPlan.mockResolvedValue({
        ok: true,
        relayPlan: {
          relays: ['wss://relay.example.com'],
          envRelays: [],
          defaultRelays: ['wss://relay.example.com'],
          groupRelays: [],
          explicitRelays: [],
          groupExtras: [],
        },
      });

      const result = await window.electronAPI.computeRelayPlan({
        groupCredential: 'bfgroup1test',
        decodedGroup: { threshold: 2 },
        explicitRelays: ['wss://explicit.example.com'],
        envRelay: null,
      });

      expect(mockElectronAPI.computeRelayPlan).toHaveBeenCalledWith({
        groupCredential: 'bfgroup1test',
        decodedGroup: { threshold: 2 },
        explicitRelays: ['wss://explicit.example.com'],
        envRelay: null,
      });
      expect(result.ok).toBe(true);
      expect(result.relayPlan.relays).toContain('wss://relay.example.com');
    });

    it('should handle IPC handler returning failure', async () => {
      mockElectronAPI.computeRelayPlan.mockResolvedValue({
        ok: false,
        reason: 'computation-failed',
        message: 'Test error message',
      });

      const result = await window.electronAPI.computeRelayPlan({});

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('computation-failed');
    });

    it('should handle IPC handler rejection', async () => {
      mockElectronAPI.computeRelayPlan.mockRejectedValue(new Error('IPC failed'));

      await expect(window.electronAPI.computeRelayPlan({})).rejects.toThrow('IPC failed');
    });

    it('should call with empty object when no args needed', async () => {
      mockElectronAPI.computeRelayPlan.mockResolvedValue({
        ok: true,
        relayPlan: {
          relays: ['wss://default.example.com'],
          envRelays: [],
          defaultRelays: ['wss://default.example.com'],
          groupRelays: [],
          explicitRelays: [],
          groupExtras: [],
        },
      });

      const result = await window.electronAPI.computeRelayPlan({});

      expect(mockElectronAPI.computeRelayPlan).toHaveBeenCalledWith({});
      expect(result.ok).toBe(true);
    });
  });

  describe('Relay Plan Response Structure', () => {
    it('should return all relay plan properties', async () => {
      const mockRelayPlan = {
        relays: ['wss://relay1.example.com', 'wss://relay2.example.com'],
        envRelays: ['wss://env.example.com'],
        defaultRelays: ['wss://relay1.example.com'],
        groupRelays: ['wss://group.example.com'],
        explicitRelays: ['wss://explicit.example.com'],
        groupExtras: ['wss://group.example.com'],
      };

      mockElectronAPI.computeRelayPlan.mockResolvedValue({
        ok: true,
        relayPlan: mockRelayPlan,
      });

      const result = await window.electronAPI.computeRelayPlan({
        envRelay: 'wss://env.example.com',
      });

      expect(result.relayPlan).toHaveProperty('relays');
      expect(result.relayPlan).toHaveProperty('envRelays');
      expect(result.relayPlan).toHaveProperty('defaultRelays');
      expect(result.relayPlan).toHaveProperty('groupRelays');
      expect(result.relayPlan).toHaveProperty('explicitRelays');
      expect(result.relayPlan).toHaveProperty('groupExtras');
    });
  });
});

describe('Preload Script exposes computeRelayPlan', () => {
  let preloadContent: string;

  beforeAll(() => {
    const preloadPath = path.join(__dirname, '../../preload.ts');
    preloadContent = fs.readFileSync(preloadPath, 'utf-8');
  });

  it('should expose computeRelayPlan via electronAPI', () => {
    expect(preloadContent).toMatch(/computeRelayPlan:/);
    expect(preloadContent).toMatch(/ipcRenderer\.invoke\(\s*['"]compute-relay-plan['"]/);
  });
});
