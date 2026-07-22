import type { WhatsAppProfile } from '../../shared/whatsapp'

export async function performProfileRemoval(
  profile: Pick<WhatsAppProfile, 'id' | 'partition'>,
  clearSession: boolean,
  operations: { destroyView: (tabId: string) => void; clearPartition: (partition: string) => Promise<void> },
) {
  operations.destroyView(`whatsapp:${profile.id}`)
  if (clearSession) await operations.clearPartition(profile.partition)
}
