import type { DisplayEvent } from './models'
import { withEventDefaults } from './eventSchema'

export const demoEvents: DisplayEvent[] = [
  withEventDefaults({
    id: 'demo-1',
    title: 'Game Jam · 夜光城市场',
    description: '48 小时创作冲刺，主题现场公布，最终进行 DEMO 展示。',
    start_time: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
    end_time: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
    location: '徐汇创意工坊',
    team_max_size: 80,
    status: 'published',
    created_at: new Date().toISOString(),
    is_demo: true,
  }),
  withEventDefaults({
    id: 'demo-2',
    title: 'Game Jam · 像素风周末',
    description: '以像素叙事为核心的轻量 Game Jam，适合初次参与。',
    start_time: new Date(Date.now() + 13 * 24 * 60 * 60 * 1000).toISOString(),
    end_time: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    location: '静安共享办公区',
    team_max_size: 60,
    status: 'draft',
    created_at: new Date().toISOString(),
    is_demo: true,
  }),
  withEventDefaults({
    id: 'demo-3',
    title: 'Game Jam · 叙事试验场',
    description: '偏重叙事体验与互动设计的 Game Jam，欢迎跨学科组合。',
    start_time: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
    end_time: null,
    location: '线上 + 线下混合',
    team_max_size: 120,
    status: 'published',
    created_at: new Date().toISOString(),
    is_demo: true,
  }),
]

