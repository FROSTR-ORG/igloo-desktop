import { BifrostNode } from '@frostr/bifrost'

import {
  decode_group_pkg,
  decode_share_pkg
} from '@frostr/bifrost/lib'

export function get_node ({ group, share, relays }: { group: string, share: string, relays: string[] }) {
  if (!relays || relays.length === 0) {
    throw new Error('At least one relay URL must be provided')
  }

  const decodedGroup  = decode_group_pkg(group)
  const decodedShare  = decode_share_pkg(share)

  return new BifrostNode(decodedGroup, decodedShare, relays)
}