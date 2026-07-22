import { MessageCircle } from 'lucide-react'
import type { WhatsAppProfile } from '../../../shared/whatsapp'

function profileInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'WA'
}

export function ProfileAvatar({ profile, size = 'md' }: { profile: WhatsAppProfile; size?: 'sm' | 'md' | 'lg' }) {
  const dimensions = size === 'sm' ? 'h-6 w-6 text-[9px]' : size === 'lg' ? 'h-12 w-12 text-sm' : 'h-9 w-9 text-xs'
  const style = { borderColor: profile.accentColor, backgroundColor: `${profile.accentColor}18` }
  if (profile.iconUrl) {
    return <img src={profile.iconUrl} alt="" className={`${dimensions} rounded-lg border object-cover`} style={style} />
  }
  return (
    <span className={`${dimensions} grid shrink-0 place-items-center rounded-lg border font-semibold text-slate-100`} style={style}>
      {profile.icon === 'builtin:message' ? <MessageCircle size={size === 'lg' ? 21 : 16} /> : profileInitials(profile.name)}
    </span>
  )
}
