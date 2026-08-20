import {
  Bird,
  Bug,
  CircleOff,
  CloudRain,
  Coffee,
  Droplets,
  Fan,
  Flame,
  Footprints,
  Guitar,
  Headphones,
  Moon,
  MoonStar,
  MountainSnow,
  Music,
  Music2,
  Orbit,
  Piano,
  Route,
  Shell,
  Sparkles,
  Umbrella,
  Waves,
  Wind,
  type LucideProps,
} from 'lucide-react'

const audioIcons = {
  none: CircleOff,
  'cloud-rain': CloudRain,
  bug: Bug,
  flame: Flame,
  wind: Wind,
  umbrella: Umbrella,
  waves: Waves,
  bird: Bird,
  shell: Shell,
  coffee: Coffee,
  fan: Fan,
  droplets: Droplets,
  'mountain-snow': MountainSnow,
  'moon-star': MoonStar,
  route: Route,
  'music-2': Music2,
  headphones: Headphones,
  orbit: Orbit,
  footprints: Footprints,
  guitar: Guitar,
  moon: Moon,
  music: Music,
  sparkles: Sparkles,
  piano: Piano,
}

interface AudioIconProps extends LucideProps {
  name: string
}

export function AudioIcon({ name, ...props }: AudioIconProps) {
  const Icon = audioIcons[name as keyof typeof audioIcons] ?? Music2
  return <Icon aria-hidden="true" {...props} />
}
