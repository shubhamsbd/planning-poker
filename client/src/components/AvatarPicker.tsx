import { AVATAR_COLORS, AVATAR_EMOJIS, type Avatar } from '../lib/avatars'
import { UserAvatar } from './UserAvatar'

interface AvatarPickerProps {
  avatar: Avatar
  onChange: (avatar: Avatar) => void
  compact?: boolean
}

export function AvatarPicker({ avatar, onChange, compact = false }: AvatarPickerProps) {
  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <div className="flex items-center gap-3">
        <UserAvatar avatar={avatar} size="lg" ring />
        <div>
          <p className="text-sm font-medium text-brand-black">Your avatar</p>
          <p className="text-subtle text-xs">Pick an emoji and background color</p>
        </div>
      </div>

      <div>
        <p className="text-muted mb-2 text-xs font-medium uppercase tracking-wide">Emoji</p>
        <div className="grid grid-cols-10 gap-1.5 sm:grid-cols-10">
          {AVATAR_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onChange({ ...avatar, emoji })}
              className={`flex h-9 w-9 items-center justify-center rounded-lg border text-lg transition ${
                avatar.emoji === emoji
                  ? 'border-brand-yellow bg-amber-50 shadow-sm'
                  : 'border-black/8 bg-white hover:border-brand-yellow/40'
              }`}
              aria-label={`Avatar emoji ${emoji}`}
              aria-pressed={avatar.emoji === emoji}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-muted mb-2 text-xs font-medium uppercase tracking-wide">Color</p>
        <div className="flex flex-wrap gap-2">
          {AVATAR_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onChange({ ...avatar, color })}
              className={`h-8 w-8 rounded-full border-2 transition ${
                avatar.color === color ? 'border-brand-yellow-dark scale-110' : 'border-white shadow-sm'
              }`}
              style={{ backgroundColor: color }}
              aria-label="Avatar color"
              aria-pressed={avatar.color === color}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
