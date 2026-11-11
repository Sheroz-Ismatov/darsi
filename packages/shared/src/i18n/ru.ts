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
    inviteWelcome:
      'Здравствуйте! Вас пригласили в школу в Дарси. Нажмите кнопку ниже, чтобы принять приглашение.',
    openApp: 'Открыть Дарси',
    menuButton: 'Дарси',
    unavailable: 'Приложение временно недоступно. Попробуйте позже.',
  },
  invite: {
    loading: 'Принимаем приглашение…',
    acceptedTitle: 'Приглашение принято',
    school: 'Школа',
    role: 'Ваша роль',
    roleOwner: 'Владелец',
    roleAdmin: 'Администратор',
    roleTeacher: 'Преподаватель',
    roleParent: 'Родитель',
    panelHint:
      'Школой управляют в веб-панели. Откройте её в браузере на компьютере или телефоне и войдите через Telegram.',
    openPanel: 'Открыть панель',
    toSchedule: 'К расписанию',
    continue: 'Продолжить',
    errorTitle: 'Не удалось принять приглашение',
    errorUsed: 'Эта ссылка уже использована.',
    errorExpired: 'Срок действия ссылки истёк.',
    errorNotFound: 'Ссылка не найдена — возможно, её скопировали не полностью.',
    errorBlocked: 'Школа временно недоступна.',
    errorUnknown: 'Что-то пошло не так. Попробуйте ещё раз.',
    askNewLink: 'Попросите школу прислать новую ссылку.',
    joinLoading: 'Подключаем вас к школе…',
    joinErrorTitle: 'Не удалось подключиться к школе',
    joinNotFound: 'Школа с такой ссылкой не найдена.',
    joinDeactivated: 'Школа отключила ваш доступ. Свяжитесь с администратором школы.',
    toHome: 'На главную',
  },
  placeholder: {
    title: 'Раздел в разработке',
    text: 'Он появится в одной из следующих версий.',
  },
} as const;

export type Dictionary = {
  [Section in keyof typeof ru]: { [Key in keyof (typeof ru)[Section]]: string };
};
