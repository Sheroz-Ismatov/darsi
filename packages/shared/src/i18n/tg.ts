import type { Dictionary } from './ru';

// TODO(Q-4): proofreading by a native Tajik speaker before the pilot.
export const tg: Dictionary = {
  common: {
    appName: 'Дарси',
    loading: 'Боргирӣ…',
    error: 'Хатое рух дод',
    retry: 'Такрор кардан',
    save: 'Нигоҳ доштан',
    cancel: 'Бекор кардан',
    back: 'Бозгашт',
    logout: 'Баромадан',
    collapseMenu: 'Менюро печонидан',
    expandMenu: 'Менюро кушодан',
  },
  nav: {
    dashboard: 'Асосӣ',
    schedule: 'Ҷадвал',
    courses: 'Курсҳо',
    students: 'Хонандагон',
    requests: 'Дархостҳо',
    subscriptions: 'Абонементҳо',
    payments: 'Пардохтҳо',
    reports: 'Ҳисоботҳо',
    staff: 'Кормандон',
    settings: 'Танзимот',
    platform: 'Мактабҳо',
    home: 'Асосӣ',
    profile: 'Профил',
    today: 'Имрӯз',
    groups: 'Гурӯҳҳо',
  },
  attendance: {
    present: 'Ҳозир',
    absent: 'Ғоиб',
    excused: 'Узрнок',
  },
  tma: {
    openInTelegramTitle: 'Тавассути Telegram кушоед',
    openInTelegramText:
      'Ин барнома дар дохили Telegram кор мекунад. Боти мактабро кушоед ва тугмаи «Дарси»-ро пахш кунед.',
    greeting: 'Салом, {{name}}!',
    authError: 'Ворид шудан нашуд. Барномаро пӯшед ва аз нав кушоед.',
  },
  bot: {
    welcome:
      'Ассалому алайкум! Ин Дарси аст — ҷадвал, ҳузур ва пардохти дарсҳо дар як ҷо. Барои кушодани барнома тугмаи поёнро пахш кунед.',
    openApp: 'Кушодани Дарси',
    menuButton: 'Дарси',
    unavailable: 'Барнома муваққатан дастрас нест. Баъдтар кӯшиш кунед.',
  },
  placeholder: {
    title: 'Бахш дар ҳоли таҳия',
    text: 'Он дар яке аз версияҳои оянда пайдо мешавад.',
  },
};
