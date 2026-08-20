export interface AudioCatalogItem {
  id: string
  name: string
  description: string
  icon: string
  src: string
}

export const AMBIENT_SOUNDS: AudioCatalogItem[] = [
  {
    id: 'spring-rain',
    name: '窗边春雨',
    description: '细雨轻落窗沿，安静包裹阅读与书写',
    icon: 'cloud-rain',
    src: '/assets/audio/soundscape/ambient-long/spring-rain.m4a',
  },
  {
    id: 'meadow-crickets',
    name: '草间虫鸣',
    description: '夏夜虫声疏密起伏，适合安静的深夜学习',
    icon: 'bug',
    src: '/assets/audio/soundscape/ambient-long/meadow-crickets.m4a',
  },
  {
    id: 'fireplace',
    name: '炉火燃响',
    description: '木柴噼啪燃烧，为长时间工作添一层暖意',
    icon: 'flame',
    src: '/assets/audio/soundscape/ambient-long/fireplace.m4a',
  },
  {
    id: 'meadow-wind',
    name: '原野长风',
    description: '风越过开阔草地，适合整理思绪与自由创作',
    icon: 'wind',
    src: '/assets/audio/soundscape/ambient-long/meadow-wind.m4a',
  },
  {
    id: 'eaves-rain',
    name: '屋檐听雨',
    description: '雨点落在屋檐，节奏均匀而克制',
    icon: 'umbrella',
    src: '/assets/audio/soundscape/ambient-long/eaves-rain.m4a',
  },
  {
    id: 'forest-stream',
    name: '林间溪流',
    description: '清水穿过石缝，带来持续而轻盈的流动感',
    icon: 'waves',
    src: '/assets/audio/soundscape/ambient-long/forest-stream.m4a',
  },
  {
    id: 'forest-birds',
    name: '晨林鸟语',
    description: '林间鸟鸣与微风交织，适合清晨启动',
    icon: 'bird',
    src: '/assets/audio/soundscape/ambient-long/forest-birds.m4a',
  },
  {
    id: 'ocean-tide',
    name: '远海潮汐',
    description: '潮水缓慢推进回落，给思考留出宽阔呼吸',
    icon: 'shell',
    src: '/assets/audio/soundscape/ambient-long/ocean-tide.m4a',
  },
  {
    id: 'cafe-room',
    name: '午后咖啡馆',
    description: '低声交谈与杯碟轻响，适合需要陪伴感的工作',
    icon: 'coffee',
    src: '/assets/audio/soundscape/ambient-long/cafe-room.m4a',
  },
  {
    id: 'fan-breeze',
    name: '夏日轻扇',
    description: '稳定风声铺开柔和底噪，帮助屏蔽环境干扰',
    icon: 'fan',
    src: '/assets/audio/soundscape/ambient-long/fan-breeze.m4a',
  },
  {
    id: 'garden-fountain',
    name: '庭院水声',
    description: '喷泉细流层叠回响，适合轻量阅读与整理',
    icon: 'droplets',
    src: '/assets/audio/soundscape/ambient-long/garden-fountain.m4a',
  },
  {
    id: 'mountain-waterfall',
    name: '山涧飞瀑',
    description: '充沛水声形成稳定声墙，适合高强度专注',
    icon: 'mountain-snow',
    src: '/assets/audio/soundscape/ambient-long/mountain-waterfall.m4a',
  },
  {
    id: 'night-owl',
    name: '夜林低语',
    description: '遥远夜鸟与林声相伴，适合夜间沉浸',
    icon: 'moon-star',
    src: '/assets/audio/soundscape/ambient-long/night-owl.m4a',
  },
  {
    id: 'river-flow',
    name: '长河缓流',
    description: '持续河水向前流动，让节奏保持平稳',
    icon: 'route',
    src: '/assets/audio/soundscape/ambient-long/river-flow.m4a',
  },
  {
    id: 'summer-frogs',
    name: '夏塘蛙声',
    description: '池塘蛙鸣此起彼伏，为重复练习增加生气',
    icon: 'music-2',
    src: '/assets/audio/soundscape/ambient-long/summer-frogs.m4a',
  },
]

export const MUSIC_TRACKS: AudioCatalogItem[] = [
  {
    id: 'chill',
    name: '松弛节拍',
    description: '轻柔节拍保持清醒，不催促也不打断',
    icon: 'headphones',
    src: '/assets/audio/soundscape/music/chill.m4a',
  },
  {
    id: 'space',
    name: '星海',
    description: '宽阔氛围向远处延伸，适合夜间沉浸',
    icon: 'orbit',
    src: '/assets/audio/soundscape/music/space.m4a',
  },
  {
    id: 'slow',
    name: '慢行',
    description: '从容节奏不催不赶，适合长时间推进任务',
    icon: 'footprints',
    src: '/assets/audio/soundscape/music/slow.m4a',
  },
  {
    id: 'guitar',
    name: '木吉他',
    description: '温暖拨弦陪伴阅读、写作与轻量创作',
    icon: 'guitar',
    src: '/assets/audio/soundscape/music/guitar.m4a',
  },
  {
    id: 'calm',
    name: '静水',
    description: '旋律平缓展开，适合让情绪慢慢归位',
    icon: 'waves',
    src: '/assets/audio/soundscape/music/calm.m4a',
  },
  {
    id: 'dark',
    name: '夜航',
    description: '低调暗色旋律，适合深夜编码与独立思考',
    icon: 'moon',
    src: '/assets/audio/soundscape/music/dark.m4a',
  },
  {
    id: 'flute',
    name: '竹影清音',
    description: '通透笛声留出呼吸，适合阅读与整理笔记',
    icon: 'music',
    src: '/assets/audio/soundscape/music/flute.m4a',
  },
  {
    id: 'light',
    name: '微光',
    description: '明净旋律缓缓亮起，为思绪留一束微光',
    icon: 'sparkles',
    src: '/assets/audio/soundscape/music/light.m4a',
  },
  {
    id: 'pianissimo',
    name: '弱音钢琴',
    description: '轻触琴键、克制留白，适合安静阅读',
    icon: 'piano',
    src: '/assets/audio/soundscape/music/pianissimo.m4a',
  },
]
