import { z } from 'zod';

// =============================================================================
// IPC Input Validation Schemas
// =============================================================================
// SECURITY: These schemas enforce strict input validation with length limits
// to prevent DoS attacks and ensure data integrity across the IPC boundary.
//
// Extracted to a shared module so schemas can be:
// 1. Imported in main.ts for runtime validation
// 2. Unit tested directly with valid/invalid payloads

/** Share ID: alphanumeric with dots, underscores, hyphens; max 255 chars */
export const ShareIdSchema = z.string()
  .min(1, 'Share ID is required')
  .max(255, 'Share ID exceeds maximum length')
  .regex(/^[A-Za-z0-9._-]+$/, 'Share ID contains invalid characters');

/** Hex string validation for salt (min 32 chars = 16 bytes) */
export const HexSaltSchema = z.string()
  .min(32, 'Salt must be at least 32 hex characters')
  .max(128, 'Salt exceeds maximum length')
  .regex(/^[0-9a-fA-F]+$/, 'Salt must be a valid hex string');

/** Relay URL: reasonable length limit */
export const RelayUrlSchema = z.string().max(500, 'Relay URL exceeds maximum length');

/** Share credential: base64url encoded, reasonable max for FROST shares */
export const ShareCredentialSchema = z.string()
  .min(1, 'Share credential is required')
  .max(5000, 'Share credential exceeds maximum length');

/** Group credential: encoded group key data */
export const GroupCredentialSchema = z.string()
  .min(1, 'Group credential is required')
  .max(5000, 'Group credential exceeds maximum length');

/** Schema for save-share IPC handler */
export const SaveShareSchema = z.object({
  id: ShareIdSchema,
  name: z.string()
    .min(1, 'Name is required')
    .max(255, 'Name exceeds maximum length'),
  share: z.string()
    .min(1, 'Share data is required')
    .max(10000, 'Share data exceeds maximum length'),
  salt: HexSaltSchema,
  groupCredential: GroupCredentialSchema,
  version: z.number().int().min(0).max(100).optional(),
  savedAt: z.string().optional(),
  shareCredential: ShareCredentialSchema.optional(),
  metadata: z.object({
    binder_sn: z.string().max(64).optional(),
  }).optional(),
  policy: z.object({
    defaults: z.object({
      allowSend: z.boolean(),
      allowReceive: z.boolean(),
    }),
    peers: z.record(z.object({
      allowSend: z.boolean(),
      allowReceive: z.boolean(),
      updatedAt: z.string().optional(),
    })).optional(),
    updatedAt: z.string().optional(),
  }).optional(),
});

/** Schema for compute-relay-plan IPC handler */
export const RelayPlanArgsSchema = z.object({
  groupCredential: GroupCredentialSchema.optional(),
  decodedGroup: z.record(z.unknown()).optional(),
  explicitRelays: z.array(RelayUrlSchema).max(50, 'Too many relays').optional(),
  envRelay: z.string().max(500).optional(),
});

/** Schema for echo-start IPC handler */
export const EchoStartArgsSchema = z.object({
  listenerId: z.string()
    .min(1, 'Listener ID is required')
    .max(100, 'Listener ID exceeds maximum length'),
  groupCredential: GroupCredentialSchema,
  shareCredentials: z.array(ShareCredentialSchema)
    .min(1, 'At least one share credential is required')
    .max(100, 'Too many share credentials'),
  relays: z.array(RelayUrlSchema).max(50).optional(),
});

/** Schema for echo-stop IPC handler */
export const EchoStopArgsSchema = z.object({
  listenerId: z.string()
    .min(1, 'Listener ID is required')
    .max(100, 'Listener ID exceeds maximum length'),
});

// =============================================================================
// Inferred Types
// =============================================================================

export type SaveShareInput = z.infer<typeof SaveShareSchema>;
export type RelayPlanArgs = z.infer<typeof RelayPlanArgsSchema>;
export type EchoStartArgs = z.infer<typeof EchoStartArgsSchema>;
export type EchoStopArgs = z.infer<typeof EchoStopArgsSchema>;
