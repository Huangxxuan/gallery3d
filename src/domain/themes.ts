// 展厅主题体系（LUMEN 视觉：每厅一个主题色温，灯带/光环/展名/背光晕共用）
// 色彩决策（老板拍板）：H1 暖金 / H2 品红 / H3 冷青 / H4 翠绿
export interface HallTheme {
  name: string
  en: string
  /** 主题色（UI/贴图/中性面片） */
  accent: string
  /** 发光色（toneMapped=false 面片用，代码里再乘亮度系数喂 Bloom） */
  glow: string
}

export const THEMES: Record<string, HallTheme> = {
  H1: { name: '香港故事', en: 'HONG KONG STORIES', accent: '#ffb054', glow: '#ffcf8a' },
  H2: { name: '双城纪事', en: 'TWIN CITIES', accent: '#ff4d9d', glow: '#ff8ac0' },
  H3: { name: '海与港', en: 'SEA & HARBOUR', accent: '#46d8ff', glow: '#9fe9ff' },
  H4: { name: '林间生灵', en: 'FOREST LIFE', accent: '#46ffa2', glow: '#a4ffd0' },
}

/** 中性色（入口/出口/暗廊公共区，白盒灰调） */
export const NEUTRAL = { accent: '#63676d', glow: '#e8e8e6' }
