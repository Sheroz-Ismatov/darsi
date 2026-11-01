/** Source dictionary. Every other locale must have exactly the same keys (see Dictionary). */
export const ru = {
  common: {
    appName: 'Дарси',
    loading: 'Загрузка…',
    error: 'Что-то пошло не так',
    retry: 'Повторить',
    save: 'Сохранить',
    cancel: 'Отмена',
    back: 'Назад',
    logout: 'Выйти',
    collapseMenu: 'Свернуть меню',
    expandMenu: 'Развернуть меню',
  },
  nav: {
    dashboard: 'Главная',
    schedule: 'Расписание',
    courses: 'Курсы',
    students: 'Ученики',
    requests: 'Заявки',
    subscriptions: 'Абонементы',
    payments: 'Оплаты',
    reports: 'Отчёты',
    staff: 'Сотрудники',
    settings: 'Настройки',
    platform: 'Школы',
    home: 'Главная',
    profile: 'Профиль',
    today: 'Сегодня',
    groups: 'Группы',
  },
  attendance: {
    present: 'Был',
    absent: 'Пропуск',
    excused: 'Уваж.',
  },
  tma: {
    openInTelegramTitle: 'Откройте через Telegram',
    openInTelegramText:
      'Это приложение работает внутри Telegram. Откройте бота школы и нажмите кнопку «Дарси».',
    greeting: 'Привет, {{name}}!',
    authError: 'Не удалось войти. Закройте приложение и откройте его снова.',
  },
  bot: {
    welcome:
      'Здравствуйте! Это Дарси — расписание, посещения и оплаты занятий в одном месте. Нажмите кнопку ниже, чтобы открыть приложение.',
    openApp: 'Открыть Дарси',
    menuButton: 'Дарси',
    unavailable: 'Приложение временно недоступно. Попробуйте позже.',
  },
  placeholder: {
    title: 'Раздел в разработке',
    text: 'Он появится в одной из следующих версий.',
  },
} as const;

export type Dictionary = {
  [Section in keyof typeof ru]: { [Key in keyof (typeof ru)[Section]]: string };
};
