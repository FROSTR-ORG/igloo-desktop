import { computeRelayPlan, normalizeRelayUrl } from '../../lib/echoRelays';
import { decodeGroup, DEFAULT_ECHO_RELAYS } from '@frostr/igloo-core';
import fs from 'node:fs';

// Mock fs module
jest.mock('node:fs', () => ({
  readFileSync: jest.fn(),
}));

// Mock os module for consistent cross-platform tests
jest.mock('node:os', () => ({
  platform: jest.fn(() => 'darwin'),
  homedir: jest.fn(() => '/Users/testuser'),
}));

describe('echoRelays', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no config file exists
    (fs.readFileSync as jest.Mock).mockImplementation(() => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    });
  });

  describe('normalizeRelayUrl', () => {
    it('should return empty string for empty input', () => {
      expect(normalizeRelayUrl('')).toBe('');
      expect(normalizeRelayUrl('   ')).toBe('');
    });

    it('should preserve wss:// URLs', () => {
      expect(normalizeRelayUrl('wss://relay.example.com')).toBe('wss://relay.example.com');
    });

    it('should upgrade ws:// to wss://', () => {
      expect(normalizeRelayUrl('ws://relay.example.com')).toBe('wss://relay.example.com');
    });

    it('should convert http:// to wss://', () => {
      expect(normalizeRelayUrl('http://relay.example.com')).toBe('wss://relay.example.com');
    });

    it('should convert https:// to wss://', () => {
      expect(normalizeRelayUrl('https://relay.example.com')).toBe('wss://relay.example.com');
    });

    it('should add wss:// prefix to bare hostnames', () => {
      expect(normalizeRelayUrl('relay.example.com')).toBe('wss://relay.example.com');
    });

    it('should handle case-insensitive protocols', () => {
      expect(normalizeRelayUrl('WS://relay.example.com')).toBe('wss://relay.example.com');
      expect(normalizeRelayUrl('WSS://relay.example.com')).toBe('wss://relay.example.com');
      expect(normalizeRelayUrl('HTTP://relay.example.com')).toBe('wss://relay.example.com');
    });

    it('should trim whitespace', () => {
      expect(normalizeRelayUrl('  wss://relay.example.com  ')).toBe('wss://relay.example.com');
    });
  });

  describe('computeRelayPlan', () => {
    describe('with no inputs', () => {
      it('should return default relays when no options provided', () => {
        const result = computeRelayPlan({});

        expect(result.relays).toEqual(DEFAULT_ECHO_RELAYS);
        expect(result.defaultRelays).toEqual(DEFAULT_ECHO_RELAYS);
        expect(result.envRelays).toEqual([]);
        expect(result.groupRelays).toEqual([]);
        expect(result.explicitRelays).toEqual([]);
        expect(result.groupExtras).toEqual([]);
      });

      it('should use baseRelays when provided', () => {
        const baseRelays = ['wss://custom1.example.com', 'wss://custom2.example.com'];
        const result = computeRelayPlan({ baseRelays });

        expect(result.relays).toEqual(baseRelays);
        expect(result.defaultRelays).toEqual(baseRelays);
      });
    });

    describe('with envRelay', () => {
      it('should use only envRelay when provided', () => {
        const result = computeRelayPlan({
          envRelay: 'wss://env-relay.example.com',
        });

        expect(result.relays).toEqual(['wss://env-relay.example.com']);
        expect(result.envRelays).toEqual(['wss://env-relay.example.com']);
      });

      it('should combine envRelay with explicitRelays', () => {
        const result = computeRelayPlan({
          envRelay: 'wss://env-relay.example.com',
          explicitRelays: ['wss://explicit.example.com'],
        });

        // Explicit relays come first, then env relays
        expect(result.relays).toEqual([
          'wss://explicit.example.com',
          'wss://env-relay.example.com',
        ]);
      });

      it('should normalize envRelay URL', () => {
        const result = computeRelayPlan({
          envRelay: 'ws://insecure-relay.example.com',
        });

        expect(result.envRelays).toEqual(['wss://insecure-relay.example.com']);
      });
    });

    describe('with explicitRelays', () => {
      it('should prioritize explicit relays over defaults', () => {
        const result = computeRelayPlan({
          explicitRelays: ['wss://explicit.example.com'],
        });

        expect(result.relays[0]).toBe('wss://explicit.example.com');
        expect(result.explicitRelays).toEqual(['wss://explicit.example.com']);
      });

      it('should filter out invalid relay entries', () => {
        const result = computeRelayPlan({
          explicitRelays: ['wss://valid.example.com', '', '   ', 123 as unknown as string],
        });

        expect(result.explicitRelays).toEqual(['wss://valid.example.com']);
      });

      it('should deduplicate explicit relays', () => {
        const result = computeRelayPlan({
          explicitRelays: [
            'wss://relay.example.com',
            'wss://relay.example.com',
            'WSS://relay.example.com',
          ],
        });

        expect(result.explicitRelays).toEqual(['wss://relay.example.com']);
      });
    });

    describe('with groupCredential', () => {
      it('should extract relays from decoded group credential', () => {
        (decodeGroup as jest.Mock).mockReturnValue({
          relays: ['wss://group-relay1.example.com', 'wss://group-relay2.example.com'],
        });

        const result = computeRelayPlan({
          groupCredential: 'bfgroup1testcredential',
        });

        expect(result.groupRelays).toEqual([
          'wss://group-relay1.example.com',
          'wss://group-relay2.example.com',
        ]);
        expect(decodeGroup).toHaveBeenCalledWith('bfgroup1testcredential');
      });

      it('should handle decodeGroup returning relayUrls property', () => {
        (decodeGroup as jest.Mock).mockReturnValue({
          relayUrls: ['wss://group-relay.example.com'],
        });

        const result = computeRelayPlan({
          groupCredential: 'bfgroup1testcredential',
        });

        expect(result.groupRelays).toEqual(['wss://group-relay.example.com']);
      });

      it('should handle decodeGroup returning relay_urls property', () => {
        (decodeGroup as jest.Mock).mockReturnValue({
          relay_urls: ['wss://group-relay.example.com'],
        });

        const result = computeRelayPlan({
          groupCredential: 'bfgroup1testcredential',
        });

        expect(result.groupRelays).toEqual(['wss://group-relay.example.com']);
      });

      it('should handle decodeGroup throwing error', () => {
        (decodeGroup as jest.Mock).mockImplementation(() => {
          throw new Error('Invalid group credential');
        });

        const result = computeRelayPlan({
          groupCredential: 'invalid-credential',
        });

        expect(result.groupRelays).toEqual([]);
      });

      it('should skip decoding when decodedGroup is already provided', () => {
        const result = computeRelayPlan({
          groupCredential: 'bfgroup1testcredential',
          decodedGroup: {
            relays: ['wss://pre-decoded.example.com'],
          },
        });

        expect(result.groupRelays).toEqual(['wss://pre-decoded.example.com']);
        expect(decodeGroup).not.toHaveBeenCalled();
      });

      it('should ignore empty groupCredential', () => {
        const result = computeRelayPlan({
          groupCredential: '   ',
        });

        expect(decodeGroup).not.toHaveBeenCalled();
        expect(result.groupRelays).toEqual([]);
      });
    });

    describe('with decodedGroup', () => {
      it('should extract relays from decodedGroup object', () => {
        const result = computeRelayPlan({
          decodedGroup: {
            relays: ['wss://decoded-relay.example.com'],
          },
        });

        expect(result.groupRelays).toEqual(['wss://decoded-relay.example.com']);
      });

      it('should handle null decodedGroup', () => {
        const result = computeRelayPlan({
          decodedGroup: null,
        });

        expect(result.groupRelays).toEqual([]);
      });

      it('should handle decodedGroup with no relay property', () => {
        const result = computeRelayPlan({
          decodedGroup: { threshold: 2, group_pk: 'abc' },
        });

        expect(result.groupRelays).toEqual([]);
      });
    });

    describe('groupExtras calculation', () => {
      it('should identify group relays not in defaults', () => {
        const result = computeRelayPlan({
          decodedGroup: {
            relays: [
              'wss://relay.damus.io', // Already in defaults
              'wss://group-only.example.com', // Not in defaults
            ],
          },
        });

        expect(result.groupExtras).toEqual(['wss://group-only.example.com']);
      });

      it('should return empty groupExtras when all group relays are defaults', () => {
        const result = computeRelayPlan({
          decodedGroup: {
            relays: DEFAULT_ECHO_RELAYS,
          },
        });

        expect(result.groupExtras).toEqual([]);
      });
    });

    describe('relay deduplication', () => {
      it('should deduplicate relays across sources', () => {
        const result = computeRelayPlan({
          explicitRelays: ['wss://relay.damus.io'],
          decodedGroup: {
            relays: ['wss://relay.damus.io', 'wss://group-only.example.com'],
          },
        });

        // Should not have duplicate relay.damus.io entries
        const damusCount = result.relays.filter(r => r.includes('relay.damus.io')).length;
        expect(damusCount).toBe(1);
      });

      it('should treat URLs with different cases as same relay', () => {
        const result = computeRelayPlan({
          explicitRelays: ['wss://RELAY.example.com'],
          decodedGroup: {
            relays: ['wss://relay.example.com'],
          },
        });

        const exampleCount = result.relays.filter(r =>
          r.toLowerCase().includes('relay.example.com')
        ).length;
        expect(exampleCount).toBe(1);
      });
    });

    describe('with configured relays file', () => {
      it('should use configured relays from file when present', () => {
        (fs.readFileSync as jest.Mock).mockReturnValue(
          JSON.stringify({
            relays: ['wss://configured1.example.com', 'wss://configured2.example.com'],
          })
        );

        const result = computeRelayPlan({});

        expect(result.defaultRelays).toEqual([
          'wss://configured1.example.com',
          'wss://configured2.example.com',
        ]);
      });

      it('should fall back to baseRelays when config file is empty', () => {
        (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ relays: [] }));

        const result = computeRelayPlan({
          baseRelays: ['wss://fallback.example.com'],
        });

        expect(result.defaultRelays).toEqual(['wss://fallback.example.com']);
      });

      it('should fall back to DEFAULT_ECHO_RELAYS when config file has invalid format', () => {
        (fs.readFileSync as jest.Mock).mockReturnValue('not json');

        const result = computeRelayPlan({});

        expect(result.defaultRelays).toEqual(DEFAULT_ECHO_RELAYS);
      });
    });

    describe('relay ordering priority', () => {
      it('should order: explicit, defaults, group (when no envRelay)', () => {
        const result = computeRelayPlan({
          explicitRelays: ['wss://explicit.example.com'],
          decodedGroup: {
            relays: ['wss://group.example.com'],
          },
          baseRelays: ['wss://default.example.com'],
        });

        expect(result.relays[0]).toBe('wss://explicit.example.com');
        expect(result.relays[1]).toBe('wss://default.example.com');
        expect(result.relays[2]).toBe('wss://group.example.com');
      });

      it('should order: explicit, env (when envRelay provided)', () => {
        const result = computeRelayPlan({
          explicitRelays: ['wss://explicit.example.com'],
          envRelay: 'wss://env.example.com',
          decodedGroup: {
            relays: ['wss://group.example.com'],
          },
        });

        expect(result.relays).toEqual([
          'wss://explicit.example.com',
          'wss://env.example.com',
        ]);
        // Group and defaults not included when envRelay is set
        expect(result.relays).not.toContain('wss://group.example.com');
      });
    });

    describe('return type structure', () => {
      it('should return all expected properties', () => {
        const result = computeRelayPlan({});

        expect(result).toHaveProperty('relays');
        expect(result).toHaveProperty('envRelays');
        expect(result).toHaveProperty('defaultRelays');
        expect(result).toHaveProperty('groupRelays');
        expect(result).toHaveProperty('explicitRelays');
        expect(result).toHaveProperty('groupExtras');

        expect(Array.isArray(result.relays)).toBe(true);
        expect(Array.isArray(result.envRelays)).toBe(true);
        expect(Array.isArray(result.defaultRelays)).toBe(true);
        expect(Array.isArray(result.groupRelays)).toBe(true);
        expect(Array.isArray(result.explicitRelays)).toBe(true);
        expect(Array.isArray(result.groupExtras)).toBe(true);
      });
    });
  });
});
