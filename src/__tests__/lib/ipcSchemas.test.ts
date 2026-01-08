/**
 * Functional unit tests for IPC validation schemas.
 *
 * These tests verify that Zod schemas correctly accept valid input
 * and reject invalid input at runtime, providing stronger guarantees
 * than regex-based code existence checks.
 */

import {
  ShareIdSchema,
  HexSaltSchema,
  RelayUrlSchema,
  ShareCredentialSchema,
  GroupCredentialSchema,
  SaveShareSchema,
  RelayPlanArgsSchema,
  EchoStartArgsSchema,
  EchoStopArgsSchema,
} from '@/lib/ipcSchemas';

describe('IPC Validation Schemas', () => {
  // ==========================================================================
  // ShareIdSchema
  // ==========================================================================
  describe('ShareIdSchema', () => {
    it('accepts valid share IDs', () => {
      expect(ShareIdSchema.safeParse('share_1').success).toBe(true);
      expect(ShareIdSchema.safeParse('my-share.v2').success).toBe(true);
      expect(ShareIdSchema.safeParse('Share123').success).toBe(true);
      expect(ShareIdSchema.safeParse('a').success).toBe(true);
    });

    it('rejects empty string', () => {
      const result = ShareIdSchema.safeParse('');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Share ID is required');
      }
    });

    it('rejects IDs exceeding 255 characters', () => {
      const longId = 'a'.repeat(256);
      const result = ShareIdSchema.safeParse(longId);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Share ID exceeds maximum length');
      }
    });

    it('rejects IDs with invalid characters', () => {
      const invalidIds = ['share 1', 'share@1', 'share/1', 'share\\1', 'share:1'];
      for (const id of invalidIds) {
        const result = ShareIdSchema.safeParse(id);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Share ID contains invalid characters');
        }
      }
    });

    it('accepts ID at exactly 255 characters', () => {
      const maxId = 'a'.repeat(255);
      expect(ShareIdSchema.safeParse(maxId).success).toBe(true);
    });
  });

  // ==========================================================================
  // HexSaltSchema
  // ==========================================================================
  describe('HexSaltSchema', () => {
    it('accepts valid hex strings of 32+ characters', () => {
      expect(HexSaltSchema.safeParse('a'.repeat(32)).success).toBe(true);
      expect(HexSaltSchema.safeParse('0123456789abcdef'.repeat(4)).success).toBe(true);
      expect(HexSaltSchema.safeParse('ABCDEF0123456789'.repeat(4)).success).toBe(true);
    });

    it('rejects hex strings shorter than 32 characters', () => {
      const result = HexSaltSchema.safeParse('a'.repeat(31));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Salt must be at least 32 hex characters');
      }
    });

    it('rejects hex strings exceeding 128 characters', () => {
      const result = HexSaltSchema.safeParse('a'.repeat(129));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Salt exceeds maximum length');
      }
    });

    it('rejects non-hex characters', () => {
      const result = HexSaltSchema.safeParse('g'.repeat(32)); // 'g' is not hex
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Salt must be a valid hex string');
      }
    });

    it('rejects strings with spaces', () => {
      const result = HexSaltSchema.safeParse('abcd efgh ijkl mnop qrst uvwx yzab');
      expect(result.success).toBe(false);
    });
  });

  // ==========================================================================
  // RelayUrlSchema
  // ==========================================================================
  describe('RelayUrlSchema', () => {
    it('accepts valid relay URLs', () => {
      expect(RelayUrlSchema.safeParse('wss://relay.example.com').success).toBe(true);
      expect(RelayUrlSchema.safeParse('ws://localhost:8080').success).toBe(true);
      expect(RelayUrlSchema.safeParse('wss://relay.damus.io').success).toBe(true);
    });

    it('accepts empty string (no min length)', () => {
      expect(RelayUrlSchema.safeParse('').success).toBe(true);
    });

    it('rejects URLs exceeding 500 characters', () => {
      const longUrl = 'wss://' + 'a'.repeat(500);
      const result = RelayUrlSchema.safeParse(longUrl);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Relay URL exceeds maximum length');
      }
    });
  });

  // ==========================================================================
  // ShareCredentialSchema
  // ==========================================================================
  describe('ShareCredentialSchema', () => {
    it('accepts valid share credentials', () => {
      expect(ShareCredentialSchema.safeParse('bfshare1abc123').success).toBe(true);
      expect(ShareCredentialSchema.safeParse('x'.repeat(5000)).success).toBe(true);
    });

    it('rejects empty string', () => {
      const result = ShareCredentialSchema.safeParse('');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Share credential is required');
      }
    });

    it('rejects credentials exceeding 5000 characters', () => {
      const result = ShareCredentialSchema.safeParse('x'.repeat(5001));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Share credential exceeds maximum length');
      }
    });
  });

  // ==========================================================================
  // GroupCredentialSchema
  // ==========================================================================
  describe('GroupCredentialSchema', () => {
    it('accepts valid group credentials', () => {
      expect(GroupCredentialSchema.safeParse('bfgroup1abc123').success).toBe(true);
      expect(GroupCredentialSchema.safeParse('x'.repeat(5000)).success).toBe(true);
    });

    it('rejects empty string', () => {
      const result = GroupCredentialSchema.safeParse('');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Group credential is required');
      }
    });

    it('rejects credentials exceeding 5000 characters', () => {
      const result = GroupCredentialSchema.safeParse('x'.repeat(5001));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Group credential exceeds maximum length');
      }
    });
  });

  // ==========================================================================
  // SaveShareSchema
  // ==========================================================================
  describe('SaveShareSchema', () => {
    const validShare = {
      id: 'test_share_1',
      name: 'Test Share',
      share: 'encrypted-share-data',
      salt: 'a'.repeat(32),
      groupCredential: 'bfgroup1abc123',
    };

    it('accepts valid minimal share', () => {
      expect(SaveShareSchema.safeParse(validShare).success).toBe(true);
    });

    it('accepts share with all optional fields', () => {
      const fullShare = {
        ...validShare,
        version: 1,
        savedAt: '2024-01-01T00:00:00Z',
        shareCredential: 'bfshare1abc123',
        metadata: { binder_sn: 'abcd1234' },
        policy: {
          defaults: { allowSend: true, allowReceive: true },
          peers: {
            'peer1': { allowSend: false, allowReceive: true, updatedAt: '2024-01-01T00:00:00Z' }
          },
          updatedAt: '2024-01-01T00:00:00Z',
        },
      };
      expect(SaveShareSchema.safeParse(fullShare).success).toBe(true);
    });

    it('rejects share data exceeding 10000 characters', () => {
      const result = SaveShareSchema.safeParse({
        ...validShare,
        share: 'x'.repeat(10001),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const shareIssue = result.error.issues.find(i => i.path.includes('share'));
        expect(shareIssue?.message).toBe('Share data exceeds maximum length');
      }
    });

    it('rejects invalid share ID', () => {
      const result = SaveShareSchema.safeParse({
        ...validShare,
        id: 'invalid id with spaces',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid hex salt', () => {
      const result = SaveShareSchema.safeParse({
        ...validShare,
        salt: 'not-valid-hex!',
      });
      expect(result.success).toBe(false);
    });

    it('rejects name exceeding 255 characters', () => {
      const result = SaveShareSchema.safeParse({
        ...validShare,
        name: 'x'.repeat(256),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const nameIssue = result.error.issues.find(i => i.path.includes('name'));
        expect(nameIssue?.message).toBe('Name exceeds maximum length');
      }
    });

    it('rejects empty name', () => {
      const result = SaveShareSchema.safeParse({
        ...validShare,
        name: '',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const nameIssue = result.error.issues.find(i => i.path.includes('name'));
        expect(nameIssue?.message).toBe('Name is required');
      }
    });

    it('rejects version outside valid range', () => {
      expect(SaveShareSchema.safeParse({ ...validShare, version: -1 }).success).toBe(false);
      expect(SaveShareSchema.safeParse({ ...validShare, version: 101 }).success).toBe(false);
      expect(SaveShareSchema.safeParse({ ...validShare, version: 100 }).success).toBe(true);
    });

    it('rejects binder_sn exceeding 64 characters', () => {
      const result = SaveShareSchema.safeParse({
        ...validShare,
        metadata: { binder_sn: 'x'.repeat(65) },
      });
      expect(result.success).toBe(false);
    });
  });

  // ==========================================================================
  // RelayPlanArgsSchema
  // ==========================================================================
  describe('RelayPlanArgsSchema', () => {
    it('accepts empty object', () => {
      expect(RelayPlanArgsSchema.safeParse({}).success).toBe(true);
    });

    it('accepts valid arguments', () => {
      expect(RelayPlanArgsSchema.safeParse({
        groupCredential: 'bfgroup1abc123',
        decodedGroup: { threshold: 2, commits: [] },
        explicitRelays: ['wss://relay1.example.com', 'wss://relay2.example.com'],
        envRelay: 'wss://env-relay.example.com',
      }).success).toBe(true);
    });

    it('rejects explicitRelays exceeding 50 items', () => {
      const result = RelayPlanArgsSchema.safeParse({
        explicitRelays: Array(51).fill('wss://relay.example.com'),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Too many relays');
      }
    });

    it('rejects envRelay exceeding 500 characters', () => {
      const result = RelayPlanArgsSchema.safeParse({
        envRelay: 'wss://' + 'a'.repeat(500),
      });
      expect(result.success).toBe(false);
    });

    it('accepts undefined for optional fields (not null)', () => {
      // This tests the fix for the null vs undefined issue
      expect(RelayPlanArgsSchema.safeParse({
        groupCredential: 'bfgroup1abc123',
        explicitRelays: undefined,
        envRelay: undefined,
      }).success).toBe(true);
    });

    it('rejects null for optional fields', () => {
      // Zod .optional() accepts undefined, not null
      expect(RelayPlanArgsSchema.safeParse({
        explicitRelays: null,
      }).success).toBe(false);

      expect(RelayPlanArgsSchema.safeParse({
        envRelay: null,
      }).success).toBe(false);
    });
  });

  // ==========================================================================
  // EchoStartArgsSchema
  // ==========================================================================
  describe('EchoStartArgsSchema', () => {
    const validArgs = {
      listenerId: 'listener-1',
      groupCredential: 'bfgroup1abc123',
      shareCredentials: ['bfshare1abc123'],
    };

    it('accepts valid arguments', () => {
      expect(EchoStartArgsSchema.safeParse(validArgs).success).toBe(true);
    });

    it('rejects empty listenerId', () => {
      const result = EchoStartArgsSchema.safeParse({
        ...validArgs,
        listenerId: '',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find(i => i.path.includes('listenerId'));
        expect(issue?.message).toBe('Listener ID is required');
      }
    });

    it('rejects listenerId exceeding 100 characters', () => {
      const result = EchoStartArgsSchema.safeParse({
        ...validArgs,
        listenerId: 'x'.repeat(101),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find(i => i.path.includes('listenerId'));
        expect(issue?.message).toBe('Listener ID exceeds maximum length');
      }
    });

    it('rejects empty shareCredentials array', () => {
      const result = EchoStartArgsSchema.safeParse({
        ...validArgs,
        shareCredentials: [],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('At least one share credential is required');
      }
    });

    it('rejects shareCredentials exceeding 100 items', () => {
      const result = EchoStartArgsSchema.safeParse({
        ...validArgs,
        shareCredentials: Array(101).fill('bfshare1abc123'),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Too many share credentials');
      }
    });
  });

  // ==========================================================================
  // EchoStopArgsSchema
  // ==========================================================================
  describe('EchoStopArgsSchema', () => {
    it('accepts valid listenerId', () => {
      expect(EchoStopArgsSchema.safeParse({ listenerId: 'listener-1' }).success).toBe(true);
    });

    it('rejects empty listenerId', () => {
      const result = EchoStopArgsSchema.safeParse({ listenerId: '' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Listener ID is required');
      }
    });

    it('rejects listenerId exceeding 100 characters', () => {
      const result = EchoStopArgsSchema.safeParse({ listenerId: 'x'.repeat(101) });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Listener ID exceeds maximum length');
      }
    });

    it('rejects missing listenerId', () => {
      const result = EchoStopArgsSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});
