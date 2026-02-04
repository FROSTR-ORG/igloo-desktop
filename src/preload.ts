/**
 * Preload script for secure IPC communication
 *
 * This script runs in a privileged context before the renderer process loads.
 * It uses contextBridge to safely expose a limited API to the renderer.
 *
 * SECURITY: This is the ONLY way for the renderer to communicate with the main process.
 * Direct access to ipcRenderer or other Node.js APIs is blocked.
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { IpcRendererEvent } from 'electron';
import type { RelayPlan, IglooShare } from '@/types';

// Type definitions for the exposed API

export interface ElectronAPI {
  // Share management
  getShares: () => Promise<IglooShare[] | false>;
  saveShare: (share: IglooShare) => Promise<boolean>;
  deleteShare: (shareId: string) => Promise<boolean>;
  openShareLocation: (shareId: string) => Promise<{ ok: boolean }>;

  // Relay planning
  computeRelayPlan: (args: {
    groupCredential?: string | null;
    decodedGroup?: Record<string, unknown> | null;
    explicitRelays?: string[] | null;
    envRelay?: string | null;
  }) => Promise<{ ok: boolean; relayPlan?: RelayPlan; reason?: string; message?: string }>;

  // Echo listener management
  echoStart: (args: {
    listenerId: string;
    groupCredential: string;
    shareCredentials: string[];
  }) => Promise<{ ok: boolean; reason?: string; message?: string }>;
  echoStop: (args: { listenerId: string }) => Promise<{ ok: boolean; reason?: string }>;

  // Echo event listeners
  onEchoReceived: (
    callback: (data: {
      listenerId: string;
      shareIndex: number;
      shareCredential?: string;
      challenge?: string | null;
    }) => void
  ) => () => void;
  onEchoError: (
    callback: (data: { listenerId: string; reason: string; message?: string }) => void
  ) => () => void;
}

// Runtime validation helpers for IPC data
// These ensure main process sends correctly shaped data before passing to renderer callbacks
// Note: shareCredential and challenge are optional to match the original Keyset.tsx type
function isEchoReceivedData(data: unknown): data is {
  listenerId: string;
  shareIndex: number;
  shareCredential?: string;
  challenge?: string | null;
} {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.listenerId === 'string' &&
    typeof d.shareIndex === 'number' &&
    (d.shareCredential === undefined || typeof d.shareCredential === 'string') &&
    (d.challenge === undefined || d.challenge === null || typeof d.challenge === 'string')
  );
}

function isEchoErrorData(data: unknown): data is {
  listenerId: string;
  reason: string;
  message?: string;
} {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.listenerId === 'string' &&
    typeof d.reason === 'string' &&
    (d.message === undefined || typeof d.message === 'string')
  );
}

// Helper to normalize null values to undefined for Zod compatibility
// Zod's .optional() accepts undefined but rejects null
const nullToUndefined = <T>(value: T | null | undefined): T | undefined =>
  value === null ? undefined : value;

// Expose a safe API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Share management - invoke pattern (request/response)
  getShares: () => ipcRenderer.invoke('get-shares') as Promise<IglooShare[] | false>,
  saveShare: (share: IglooShare) => ipcRenderer.invoke('save-share', share),
  deleteShare: (shareId: string) => ipcRenderer.invoke('delete-share', shareId),
  openShareLocation: (shareId: string) => ipcRenderer.invoke('open-share-location', shareId),

  // Relay planning - normalize nulls to undefined for Zod schema compatibility
  computeRelayPlan: (args: {
    groupCredential?: string | null;
    decodedGroup?: Record<string, unknown> | null;
    explicitRelays?: string[] | null;
    envRelay?: string | null;
  }) => ipcRenderer.invoke('compute-relay-plan', {
    groupCredential: nullToUndefined(args.groupCredential),
    decodedGroup: nullToUndefined(args.decodedGroup),
    explicitRelays: nullToUndefined(args.explicitRelays),
    envRelay: nullToUndefined(args.envRelay),
  }),

  // Echo listener management
  echoStart: (args: { listenerId: string; groupCredential: string; shareCredentials: string[] }) =>
    ipcRenderer.invoke('echo-start', args),
  echoStop: (args: { listenerId: string }) => ipcRenderer.invoke('echo-stop', args),

  // Echo event listeners - returns cleanup function
  onEchoReceived: (
    callback: (data: {
      listenerId: string;
      shareIndex: number;
      shareCredential?: string;
      challenge?: string | null;
    }) => void
  ) => {
    // Validate callback is a function before registering handler
    if (typeof callback !== 'function') {
      console.error('[preload] onEchoReceived requires a function callback');
      return () => {}; // Return no-op cleanup
    }
    const handler = (_event: IpcRendererEvent, data: unknown) => {
      if (isEchoReceivedData(data)) {
        callback(data);
      } else {
        // Don't log full payload - may contain sensitive shareCredential/challenge
        console.error('[preload] Received malformed echo-received data (type:', typeof data, ')');
      }
    };
    ipcRenderer.on('echo-received', handler);
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('echo-received', handler);
    };
  },

  onEchoError: (callback: (data: { listenerId: string; reason: string; message?: string }) => void) => {
    // Validate callback is a function before registering handler
    if (typeof callback !== 'function') {
      console.error('[preload] onEchoError requires a function callback');
      return () => {}; // Return no-op cleanup
    }
    const handler = (_event: IpcRendererEvent, data: unknown) => {
      if (isEchoErrorData(data)) {
        callback(data);
      } else {
        // Don't log full payload - may contain sensitive data
        console.error('[preload] Received malformed echo-error data (type:', typeof data, ')');
      }
    };
    ipcRenderer.on('echo-error', handler);
    return () => {
      ipcRenderer.removeListener('echo-error', handler);
    };
  },
} satisfies ElectronAPI);

// Declare global type for TypeScript
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
