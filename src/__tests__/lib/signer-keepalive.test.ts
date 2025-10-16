// Mock external packages used by the module so this test remains self-contained
jest.mock('@frostr/igloo-core', () => ({
  createConnectedNode: jest.fn(async () => ({ node: { on: jest.fn(), off: jest.fn() }, state: {} })),
}));
jest.mock('@frostr/bifrost', () => ({}));

import { createSignerKeepAlive } from '@/lib/signer-keepalive';

// Use modern fake timers so we can advance heartbeats deterministically
jest.useFakeTimers();

describe('signer-keepalive — no peers should not trigger heal', () => {
  it('does not call heal() when there are zero discovered peers', async () => {
    // Arrange a minimal Bifrost-like node shape that the keepalive expects
    const fakeNode: any = {
      req: {
        ping: jest.fn().mockResolvedValue({ ok: true }),
      },
      // No discovered peers (common at startup or small groups)
      peers: [] as Array<{ pubkey: string; status?: string }>,
      // Event hooks used by the keepalive to track activity
      on: jest.fn(),
      off: jest.fn(),
      // Minimal emit to satisfy optional calls when heal replaces nodes
      emit: jest.fn(),
    };

    const logs: Array<{ level: string; message: string; ctx?: Record<string, unknown> }> = [];
    const logger = (level: 'debug' | 'info' | 'warn' | 'error', message: string, ctx?: Record<string, unknown>) => {
      logs.push({ level, message, ctx });
    };

    const handle = createSignerKeepAlive({
      node: fakeNode,
      groupCredential: 'bfgroup_test',
      shareCredential: 'bfshare_test',
      relays: ['wss://relay.example'],
      selfPubkey: 'selfpk',
      logger,
      options: {
        // Tighten timings so a few heartbeats elapse quickly in tests
        heartbeatMs: 20,
        timeoutMs: 5,
        staleMs: 5, // would classify as inactive between beats if we didn’t refresh
        maxBackoffMs: 10,
      },
    });

    // Act: start keepalive and advance several heartbeats with no peers present
    handle.start();

    // Let the immediate tick run
    await Promise.resolve();

    // Advance enough time for multiple heartbeat cycles
    jest.advanceTimersByTime(200);

    // Flush any pending microtasks
    await Promise.resolve();

    // Cleanup
    handle.stop();

    // Assert: no heal attempts (which would have logged at warn level)
    const warnLogs = logs.filter(l => l.level === 'warn' && l.message.includes('Keep-alive triggered heal'));
    expect(warnLogs.length).toBe(0);

    // Also verify we never counted this state as failures
    const heartbeatFailures = logs.filter(l => l.message === 'Heartbeat failed');
    expect(heartbeatFailures.length).toBe(0);
  });
});
