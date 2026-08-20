import {
  ArrowRight,
  BookOpenCheck,
  Bot,
  CheckCircle2,
  FolderKanban,
  Play,
  Sparkles,
  TimerReset,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import styles from './TutorialPage.module.css'

const steps = [
  {
    icon: TimerReset,
    title: '选一套舒服的节奏',
    text: '经典番茄适合入门；深度工作适合编程和写作。方案会同时带上休息规则与声景。',
    action: '前往专注',
    to: '/focus',
  },
  {
    icon: FolderKanban,
    title: '把番茄放回真实任务',
    text: '先建项目和任务，再在专注页指定本轮在做什么。完成后，番茄会自动累计到任务进度。',
    action: '管理任务',
    to: '/tasks',
  },
  {
    icon: Bot,
    title: '让 AI 帮你找到下一步',
    text: '输入目标、背景和约束，番茄智库会将大目标拆成一颗颗可以执行和验收的番茄。',
    action: '试试拆解',
    to: '/ai-studio',
  },
]

export default function TutorialPage() {
  return (
    <>
      <PageHeader
        eyebrow="GETTING STARTED"
        title="第一次来？三步就能开始"
        description="教程不会在打开网页时强制出现。随时从导航回来，找到刚好需要的那一步。"
      />
      <section className={styles.hero}>
        <div>
          <span>
            <Sparkles size={16} />
            建议从这里开始
          </span>
          <h2>现在就完成第一颗番茄</h2>
          <p>不用先搭一套复杂系统。选择“经典番茄”，写下一句要做的事，然后按下开始。</p>
          <Link to="/focus">
            <Play size={18} />
            开始第一轮
          </Link>
        </div>
        <div className={styles.miniTimer}>
          <i>🍅</i>
          <strong>25:00</strong>
          <span>一次，只做好一件事</span>
        </div>
      </section>
      <div className={styles.steps}>
        {steps.map(({ icon: Icon, title, text, action, to }, index) => (
          <article key={title}>
            <header>
              <span>0{index + 1}</span>
              <Icon />
            </header>
            <h2>{title}</h2>
            <p>{text}</p>
            <Link to={to}>
              {action}
              <ArrowRight size={16} />
            </Link>
          </article>
        ))}
      </div>
      <section className={styles.tips}>
        <div>
          <BookOpenCheck />
          <h2>一颗好番茄的标准</h2>
        </div>
        <ul>
          <li>
            <CheckCircle2 />
            开始前，目标能用一句话说清楚
          </li>
          <li>
            <CheckCircle2 />
            结束时，有一个看得见的产出
          </li>
          <li>
            <CheckCircle2 />
            被打断后，能快速回到原来的位置
          </li>
        </ul>
      </section>
    </>
  )
}
