import type { PokerCard } from '../types'
import { POKER_CARDS } from '../types'

interface VoteDeckProps {
  selected: PokerCard | null
  disabled: boolean
  onSelect: (value: PokerCard) => void
}

export function VoteDeck({ selected, disabled, onSelect }: VoteDeckProps) {
  return (
    <div className="panel rounded-3xl p-4">
      <h2 className="text-muted mb-3 text-sm font-semibold uppercase tracking-wide">
        Your estimate
      </h2>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-11">
        {POKER_CARDS.map((card) => {
          const active = selected === card
          return (
            <button
              key={card}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(card)}
              className={`aspect-[3/4] rounded-xl border-2 text-lg font-bold transition sm:text-xl ${
                active
                  ? 'scale-105 border-brand-yellow bg-card-face text-brand-black shadow-lg shadow-amber-200/80'
                  : 'border-black/10 bg-white text-brand-black shadow-sm hover:-translate-y-1 hover:border-brand-yellow/50 hover:shadow-md'
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {card}
            </button>
          )
        })}
      </div>
    </div>
  )
}
