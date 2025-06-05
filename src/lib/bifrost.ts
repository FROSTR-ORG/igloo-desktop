import { 
  generateKeysetWithSecret,
  createAndConnectNode,
  awaitShareEcho,
  startListeningForAllEchoes,
  decodeShare,
  decodeGroup,
  recoverSecretKeyFromCredentials,
  igloo,
  type BifrostNode,
  type KeysetCredentials,
  type EchoListener
} from '@frostr/igloo-core'

// Re-export the main functions for backwards compatibility
export {
  generateKeysetWithSecret,
  decodeShare as decode_share,
  decodeGroup as decode_group,
  recoverSecretKeyFromCredentials as recover_nsec,
  awaitShareEcho,
  startListeningForAllEchoes
}

// Legacy function for backwards compatibility
export function get_node({ group, share, relays }: { group: string, share: string, relays: string[] }): Promise<BifrostNode> {
  return createAndConnectNode({ group, share, relays })
}

// Export the igloo instance for easier usage
export { igloo }

// Export types
export type { BifrostNode, KeysetCredentials, EchoListener }