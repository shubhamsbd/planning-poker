import type { Avatar } from '../lib/avatars'

interface UserAvatarProps {
  avatar: Avatar
  size?: 'sm' | 'md' | 'lg'
  ring?: boolean
  className?: string
}

const sizes = {
  sm: 'h-9 w-9 text-base',
  md: 'h-11 w-11 text-lg',
  lg: 'h-14 w-14 text-2xl',
}

export function UserAvatar({ avatar, size = 'md', ring = false, className = '' }: UserAvatarProps) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full shadow-sm ${sizes[size]} ${
        ring ? 'ring-2 ring-white ring-offset-1 ring-offset-transparent' : ''
      } ${className}`}
      style={{ backgroundColor: avatar.color }}
      aria-hidden
    >
      <span className="leading-none select-none">{avatar.emoji}</span>
    </div>
  )
}
