/* global React */
const { useState, useMemo, useCallback, useEffect, createContext, useContext } = React;

/* ==========================================================
   Icons (line, 20×20) — minimal, original
   ========================================================== */
const I = {
  home: (p) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-7H10v7H6a2 2 0 0 1-2-2v-9z"/></svg>,
  calendar: (p) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>,
  book: (p) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 4h12a3 3 0 0 1 3 3v13H7a3 3 0 0 0-3 3V4z"/><path d="M4 20a3 3 0 0 1 3-3h12"/></svg>,
  card: (p) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/></svg>,
  users: (p) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="9" cy="8" r="3.5"/><path d="M2 21c0-3.5 3-6 7-6s7 2.5 7 6"/><circle cx="17" cy="7" r="2.5"/><path d="M22 18c0-2.4-1.5-4-4-4"/></svg>,
  spark: (p) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 17l4-4 4 4 4-6 6 8"/><path d="M3 21h18"/></svg>,
  bell: (p) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>,
  gear: (p) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.3l2-1.6-2-3.5-2.4.9a7 7 0 0 0-2.2-1.3L14 3h-4l-.3 2.2a7 7 0 0 0-2.2 1.3l-2.4-.9-2 3.5 2 1.6A7 7 0 0 0 5 12c0 .4 0 .9.1 1.3l-2 1.6 2 3.5 2.4-.9c.7.5 1.4 1 2.2 1.3L10 21h4l.3-2.2c.8-.3 1.5-.7 2.2-1.3l2.4.9 2-3.5-2-1.6c.1-.4.1-.9.1-1.3z"/></svg>,
  add: (p) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 5v14M5 12h14"/></svg>,
  arrow: (p) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 12h14M13 5l7 7-7 7"/></svg>,
  back: (p) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M19 12H5M11 5l-7 7 7 7"/></svg>,
  star: (p) => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M12 2l2.9 6.9L22 10l-5.5 4.7L18.2 22 12 18l-6.2 4 1.7-7.3L2 10l7.1-1.1L12 2z"/></svg>,
  star_o: (p) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" {...p}><path d="M12 3l2.6 6.2 6.7.5-5.1 4.4 1.6 6.5L12 17.3 6.2 20.6l1.6-6.5L2.7 9.7l6.7-.5L12 3z"/></svg>,
  check: (p) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 12l5 5L20 7"/></svg>,
  cross: (p) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><path d="M6 6l12 12M18 6L6 18"/></svg>,
  search: (p) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...p}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/></svg>,
  filter: (p) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...p}><path d="M4 6h16M7 12h10M10 18h4"/></svg>,
  more: (p) => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" {...p}><circle cx="6" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18" cy="12" r="1.6"/></svg>,
  tg: (p) => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M22 4L2.5 11.5c-.7.3-.7 1.3 0 1.5l4.7 1.5 1.8 5.6c.2.7 1 .9 1.5.4l2.6-2.4 4.6 3.4c.7.5 1.6.1 1.7-.7L22.9 5.3c.2-.9-.7-1.7-.9-1.3zm-3.7 4.6l-7.4 6.6-.3 3.3-1.4-4.2 8.6-5.6c.4-.3.9.2.5.5z"/></svg>,
  phone: (p) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/></svg>,
  bot: (p) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="4" y="7" width="16" height="12" rx="3"/><path d="M12 4v3M9 13h.01M15 13h.01M9 16c1 .8 5 .8 6 0"/><path d="M2 13v2M22 13v2"/></svg>,
  robot: (p) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="5" y="8" width="14" height="11" rx="2"/><circle cx="9.5" cy="13" r="1.2"/><circle cx="14.5" cy="13" r="1.2"/><path d="M12 4v4M10 4h4M3 13v3M21 13v3M9 19v2M15 19v2"/></svg>,
  chip: (p) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M3 9h3M3 12h3M3 15h3M18 9h3M18 12h3M18 15h3M9 3v3M12 3v3M15 3v3M9 18v3M12 18v3M15 18v3"/></svg>,
  cube: (p) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3l9 5v8l-9 5-9-5V8l9-5z"/><path d="M3 8l9 5 9-5M12 13v10"/></svg>,
  lightning: (p) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
  drone: (p) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><rect x="9" y="9" width="6" height="6" rx="1.5"/><path d="M8.5 8.5L6 6M15.5 8.5L18 6M8.5 15.5L6 18M15.5 15.5L18 18"/></svg>,
  code: (p) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9 8l-5 4 5 4M15 8l5 4-5 4M14 4l-4 16"/></svg>,
  paper: (p) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M6 3h9l5 5v13H6z"/><path d="M14 3v6h6M9 13h7M9 17h5"/></svg>,
  play: (p) => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M7 4l13 8-13 8V4z"/></svg>,
  exit: (p) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5"/><path d="M10 8l-4 4 4 4M6 12h11"/></svg>,
};

/* ==========================================================
   Avatar — initials with deterministic pastel
   ========================================================== */
const palettes = ['#d6e9aa','#ffd6b8','#f6c9c2','#d3cdf5','#b9e3df','#f6e4a8'];
const Avatar = ({ name = '?', size = 30 }) => {
  const ch = name[0] || '?';
  const idx = (name.charCodeAt(0) || 0) % palettes.length;
  return (
    <span className="avatar" style={{ width: size, height: size, background: palettes[idx], borderColor: '#fff' }}>
      {ch}
    </span>
  );
};

/* ==========================================================
   App context — current role + screen, navigation
   ========================================================== */
const NavCtx = createContext(null);
const useNav = () => useContext(NavCtx);

/* ==========================================================
   Stage — top-level layout: desktop frame + mobile frame
   ========================================================== */
function Stage({ children }) {
  return <div className="stage">{children}</div>;
}

function StageHeader({ role, setRole, screen }) {
  return (
    <div className="stage-header">
      <div className="stage-brand">
        <div className="stage-brand-mark">D</div>
        <div className="stage-brand-text">
          Дарси́-онлайн
          <small>Робоцентр · pilot</small>
        </div>
      </div>
      <div className="stage-controls">
        <span className="screen-pill">{screen}</span>
        <div className="role-switch" role="tablist" aria-label="Сценарий">
          <button className={role === 'auth' ? 'active' : ''} onClick={() => setRole('auth')}>Вход</button>
          <button className={role === 'parent' ? 'active' : ''} onClick={() => setRole('parent')}>Родитель</button>
          <button className={role === 'teacher' ? 'active' : ''} onClick={() => setRole('teacher')}>Преподаватель</button>
        </div>
      </div>
    </div>
  );
}

function DesktopFrame({ children }) {
  return (
    <div className="frame frame-desktop">
      <span className="frame-label">Desktop · 1280</span>
      <div className="viewport">{children}</div>
    </div>
  );
}

function MobileFrame({ children, time = '9:41' }) {
  return (
    <div className="frame frame-mobile">
      <div className="phone">
        <div className="phone-screen">
          <div className="phone-notch" />
          <div className="phone-status">
            <span>{time}</span>
            <span className="right">
              <svg width="14" height="9" viewBox="0 0 14 9" fill="currentColor"><rect x="0" y="6" width="2" height="3" rx="0.5"/><rect x="3" y="4" width="2" height="5" rx="0.5"/><rect x="6" y="2" width="2" height="7" rx="0.5"/><rect x="9" y="0" width="2" height="9" rx="0.5"/></svg>
              <svg width="14" height="9" viewBox="0 0 14 9" fill="none" stroke="currentColor" strokeWidth="1.2"><rect x="0.5" y="0.5" width="11" height="8" rx="2"/><rect x="2" y="2" width="8" height="5" rx="0.5" fill="currentColor"/></svg>
            </span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ==========================================================
   Sidebar (desktop) for parent / teacher
   ========================================================== */
function Sidebar({ items, current, onChange, name, onLogout }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">D</div>
      {items.map((it) => (
        <button
          key={it.id}
          className={`nav-btn ${current === it.id ? 'active' : ''}`}
          onClick={() => onChange(it.id)}
          title={it.title}>
          {it.icon}
          {it.alert && <span className="dot" />}
        </button>
      ))}
      <div className="sidebar-spacer" />
      <button className="nav-btn" title="Настройки"><I.gear/></button>
      <button className="nav-btn" title="Выйти из аккаунта" onClick={onLogout}><I.exit/></button>
      <div className="sidebar-avatar">{name ? name[0] : 'А'}</div>
    </aside>
  );
}

/* ==========================================================
   Mobile tabbar for parent / teacher
   ========================================================== */
function MobileTabbar({ items, current, onChange }) {
  return (
    <nav className="mobile-tabbar">
      {items.map((it) => (
        <button
          key={it.id}
          className={current === it.id ? 'active' : ''}
          onClick={() => onChange(it.id)}
          title={it.title}>
          {it.icon}
        </button>
      ))}
    </nav>
  );
}

/* ==========================================================
   Mobile header
   ========================================================== */
function MobileHeader({ left, right, title }) {
  const nav = useContext(NavCtx);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 18px 12px' }}>
      <div style={{ width: 40, display: 'flex', justifyContent: 'flex-start' }}>
        {left || <button className="btn btn-ghost btn-icon" style={{ background: '#fff' }}><I.bell/></button>}
      </div>
      {title && <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>}
      <div style={{ width: 40, display: 'flex', justifyContent: 'flex-end' }}>
        {right || <button className="btn btn-ghost btn-icon" style={{ background: '#fff' }} title="Выйти" onClick={nav?.onLogout}><I.exit/></button>}
      </div>
    </div>
  );
}

/* ==========================================================
   Mock data
   ========================================================== */
const COURSES = [
  { id: 'robotics', title: 'Робототехника. База', cat: 'Робототехника', icon: <I.robot/>, color: 'var(--c-robotics)', students: 28, rating: 4.9, top: true,
    desc: 'Сборка, моторы, датчики. Lego SPIKE Prime. От нуля до своего робота за полугодие.', age: '8–11', price: 600, sub: 9000, lessons: 16 },
  { id: 'arduino', title: 'Электроника на Arduino', cat: 'Электроника', icon: <I.chip/>, color: 'var(--c-arduino)', students: 18, rating: 4.8,
    desc: 'Светодиоды, кнопки, ШИМ, датчики. Свой проект к концу курса.', age: '11–14', price: 700, sub: 10500, lessons: 16 },
  { id: 'python', title: 'Python. Микро-проекты', cat: 'Программирование', icon: <I.code/>, color: 'var(--c-code)', students: 22, rating: 4.9,
    desc: 'Логика, циклы, мини-игры на pygame. Каждое занятие — рабочий результат.', age: '10–14', price: 700, sub: 10500, lessons: 16 },
  { id: '3d', title: '3D-моделирование', cat: 'Tinkercad / Fusion', icon: <I.cube/>, color: 'var(--c-3d)', students: 14, rating: 5.0, top: true,
    desc: 'Моделирование деталей, печать на 3D-принтере центра.', age: '9–13', price: 800, sub: 12000, lessons: 16 },
  { id: 'lego', title: 'Lego WeDo для младших', cat: 'Конструирование', icon: <I.cube/>, color: 'var(--c-lego)', students: 24, rating: 4.7,
    desc: 'Первое знакомство с программируемой техникой. Игровой формат.', age: '6–8', price: 550, sub: 8500, lessons: 16 },
  { id: 'drones', title: 'Дроны и квадрокоптеры', cat: 'Полёты и программирование', icon: <I.drone/>, color: 'var(--c-drones)', students: 12, rating: 4.9,
    desc: 'Принципы полёта, сборка, программирование маршрутов.', age: '12–16', price: 900, sub: 13500, lessons: 16 },
];
const courseById = (id) => COURSES.find(c => c.id === id) || COURSES[0];

const GROUPS = [
  { id: 'g1', courseId: 'robotics', day: 'Вт', time: '17:30', dur: 90, capacity: 8, count: 6, room: 'Зал 1' },
  { id: 'g2', courseId: 'robotics', day: 'Сб', time: '11:00', dur: 90, capacity: 8, count: 7, room: 'Зал 1' },
  { id: 'g3', courseId: 'arduino',  day: 'Чт', time: '18:00', dur: 90, capacity: 6, count: 5, room: 'Зал 2' },
  { id: 'g4', courseId: 'python',   day: 'Ср', time: '17:00', dur: 90, capacity: 8, count: 8, room: 'Зал 2' },
  { id: 'g5', courseId: '3d',       day: 'Пт', time: '17:30', dur: 90, capacity: 6, count: 4, room: 'Зал 3' },
  { id: 'g6', courseId: 'lego',     day: 'Сб', time: '10:00', dur: 60, capacity: 10, count: 9, room: 'Зал 1' },
  { id: 'g7', courseId: 'drones',   day: 'Сб', time: '14:00', dur: 90, capacity: 6, count: 4, room: 'Полигон' },
];

const CHILDREN = [
  { id: 'c1', name: 'Артём', surname: 'Соколов', age: 10, color: 'var(--c-robotics)', courses: ['robotics','python'], avatar: 'А' },
  { id: 'c2', name: 'Мира',  surname: 'Соколова', age: 8, color: 'var(--c-3d)', courses: ['lego'], avatar: 'М' },
];

const STUDENTS = [
  { id: 's1', name: 'Артём Соколов',  age: 10, parent: 'Анна Соколова',   phone: '+7 916 111-22-33', groups: ['g1'],       att: 92,  paid: true,  sub_used: 6, sub_total: 9  },
  { id: 's2', name: 'Мира Соколова',  age: 8,  parent: 'Анна Соколова',   phone: '+7 916 111-22-33', groups: ['g6'],       att: 100, paid: true,  sub_used: 4, sub_total: 9  },
  { id: 's3', name: 'Иван Петров',    age: 11, parent: 'Олег Петров',      phone: '+7 903 222-33-44', groups: ['g1','g3'], att: 85,  paid: false, sub_used: 7, sub_total: 8  },
  { id: 's4', name: 'Софья Лебедева', age: 9,  parent: 'Мария Лебедева',  phone: '+7 925 333-44-55', groups: ['g4'],       att: 100, paid: true,  sub_used: 3, sub_total: 9  },
  { id: 's5', name: 'Кирилл Зайцев', age: 12, parent: 'Игорь Зайцев',    phone: '+7 499 444-55-66', groups: ['g3','g7'], att: 78,  paid: true,  sub_used: 9, sub_total: 9  },
  { id: 's6', name: 'Алиса Морозова', age: 7,  parent: 'Юлия Морозова',   phone: '+7 926 555-66-77', groups: ['g6'],       att: 95,  paid: true,  sub_used: 2, sub_total: 8  },
  { id: 's7', name: 'Никита Орлов',   age: 13, parent: 'Сергей Орлов',    phone: '+7 985 666-77-88', groups: ['g3'],       att: 90,  paid: false, sub_used: 6, sub_total: 8  },
  { id: 's8', name: 'Дима Васильев',  age: 11, parent: 'Анна Васильева',  phone: '+7 917 777-88-99', groups: ['g4','g1'], att: 88,  paid: true,  sub_used: 5, sub_total: 9  },
];

const TODAY = '14 мая, четверг';

/* lessons for the next 14 days, mixed across groups */
function buildLessons(){
  const start = new Date(2026, 4, 11); // 11 May 2026 Mon
  const list = [];
  const dayMap = { 'Пн':0,'Вт':1,'Ср':2,'Чт':3,'Пт':4,'Сб':5,'Вс':6 };
  for (let i=0; i<14; i++){
    const d = new Date(start); d.setDate(start.getDate()+i);
    const wd = (d.getDay()+6) % 7; // Mon=0
    GROUPS.forEach((g, gi) => {
      if (dayMap[g.day] === wd){
        list.push({
          id: `l-${g.id}-${i}`,
          groupId: g.id,
          courseId: g.courseId,
          date: d,
          time: g.time,
          dur: g.dur,
          status: i < 3 ? 'done' : 'planned',
          topic: ['Введение в датчики','Моторы и редукторы','Светодиоды и кнопки','Циклы и условия','Свой проект'][gi % 5],
        });
      }
    });
  }
  return list;
}
const LESSONS = buildLessons();

const fmtDate = (d) => {
  const m = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
  return `${d.getDate()} ${m[d.getMonth()]}`;
};
const dayShort = (d) => ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'][(d.getDay()+6)%7];

window.DarsiUI = { I, Avatar, Stage, StageHeader, DesktopFrame, MobileFrame, Sidebar, MobileTabbar, MobileHeader, NavCtx, useNav, COURSES, courseById, GROUPS, CHILDREN, STUDENTS, LESSONS, TODAY, fmtDate, dayShort };
