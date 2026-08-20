import {
  BookOpen,
  BrainCircuit,
  MessagesSquare,
  Timer,
  Waves,
  type LucideProps,
} from 'lucide-react'

const presetIcons = {
  timer: Timer,
  'book-open': BookOpen,
  brain: BrainCircuit,
  'messages-square': MessagesSquare,
  waves: Waves,
}

interface PresetIconProps extends LucideProps {
  name: string
}

export function PresetIcon({ name, ...props }: PresetIconProps) {
  const Icon = presetIcons[name as keyof typeof presetIcons] ?? Timer
  return <Icon aria-hidden="true" {...props} />
}
