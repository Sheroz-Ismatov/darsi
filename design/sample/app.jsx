/* global React, ReactDOM, DarsiUI, AuthScreens, ParentScreens, MParentScreens, TeacherScreens */
const { useState } = React;
const { I, Stage, StageHeader, DesktopFrame, MobileFrame, Sidebar, MobileTabbar, NavCtx } = DarsiUI;

/* ==========================================================
   App: side-by-side desktop + mobile, shared state
   ========================================================== */

const PARENT_NAV = [
  { id:'home',     icon:<I.home/>,     title:'Главная' },
  { id:'children', icon:<I.users/>,    title:'Дети' },
  { id:'courses',  icon:<I.book/>,     title:'Курсы' },
  { id:'schedule', icon:<I.calendar/>, title:'Расписание', alert:true },
  { id:'payments', icon:<I.card/>,     title:'Оплаты' },
  { id:'events',   icon:<I.lightning/>,title:'Мероприятия' },
];
const TEACHER_NAV = [
  { id:'home',     icon:<I.home/>,     title:'Сегодня', alert:true },
  { id:'courses',  icon:<I.book/>,     title:'Курсы' },
  { id:'students', icon:<I.users/>,    title:'Ученики' },
  { id:'stats',    icon:<I.spark/>,    title:'Статистика' },
];

const SCREEN_LABEL = {
  auth: { landing:'/ — Лендинг', login:'/login — Вход', verify:'/login/verify — Код' },
  parent: { home:'/parent — Главная', children:'/parent/children', courses:'/parent/courses', course:'/parent/courses/:id', enroll:'/parent/enroll/:groupId', schedule:'/parent/schedule', lesson:'/parent/lessons/:id', payments:'/parent/payments', events:'/parent/events' },
  teacher: { home:'/teacher — Сегодня', courses:'/teacher/courses', course:'/teacher/courses/:id', group:'/teacher/groups/:id', lesson:'/teacher/lessons/:id', students:'/teacher/students', stats:'/teacher/stats' },
};

function App() {
  const [role, setRole] = useState('parent'); // auth | parent | teacher
  const [screen, setScreen] = useState({ auth:'landing', parent:'home', teacher:'home' });
  const [params, setParams] = useState({});

  const cur = role === 'auth' ? screen.auth : screen[role];

  const go = (s, p = {}) => {
    setScreen(prev => ({ ...prev, [role]: s }));
    setParams(p);
  };
  const goRole = (r) => setRole(r);
  const onLogout = () => {
    setRole('auth');
    setScreen(prev => ({ ...prev, auth: 'landing' }));
    setParams({});
  };

  // Map screens
  const renderDesktop = () => {
    if (role === 'auth') {
      const { AuthLanding, AuthLogin, AuthVerify } = AuthScreens;
      if (cur === 'landing') return <AuthLanding onContinue={() => setScreen({...screen, auth:'login'})}/>;
      if (cur === 'login')   return <AuthLogin onTg={() => { setRole('parent'); setScreen({...screen, parent:'home'}); }} onPhone={() => setScreen({...screen, auth:'verify'})}/>;
      if (cur === 'verify')  return <AuthVerify onDone={() => { setRole('parent'); setScreen({...screen, parent:'home'}); }}/>;
    }
    if (role === 'parent') {
      const P = ParentScreens;
      const map = { home:P.PHome, children:P.PChildren, courses:P.PCourses, course:P.PCourse, enroll:P.PEnroll, schedule:P.PSchedule, lesson:P.PLesson, payments:P.PPayments, events:P.PEvents };
      const Comp = map[cur] || P.PHome;
      return (
        <>
          <Sidebar items={PARENT_NAV} current={cur} onChange={go} name="А" onLogout={onLogout}/>
          <main className="main">
            <Comp params={params} go={go}/>
          </main>
        </>
      );
    }
    if (role === 'teacher') {
      const T = TeacherScreens;
      const map = { home:T.THome, courses:T.TCourses, course:T.TCourses, group:T.TGroup, lesson:T.TLesson, students:T.TStudents, stats:T.TStats };
      const Comp = map[cur] || T.THome;
      return (
        <>
          <Sidebar items={TEACHER_NAV} current={cur==='group'||cur==='lesson'||cur==='course'?'courses':cur} onChange={go} name="С" onLogout={onLogout}/>
          <main className="main">
            <Comp params={params} go={go}/>
          </main>
        </>
      );
    }
  };

  const renderMobile = () => {
    if (role === 'auth') {
      const { MAuthLanding, MAuthVerify } = AuthScreens;
      if (cur === 'verify') return <MAuthVerify onDone={() => { setRole('parent'); setScreen({...screen, parent:'home'}); }}/>;
      return <MAuthLanding onContinue={() => setScreen({...screen, auth:'verify'})}/>;
    }
    if (role === 'parent') {
      const M = MParentScreens;
      const map = { home:M.MPHome, children:M.MPChildren, courses:M.MPCourses, course:M.MPCourse, enroll:M.MPEnroll, schedule:M.MPSchedule, lesson:M.MPLesson, payments:M.MPPayments, events:M.MPEvents };
      const Comp = map[cur] || M.MPHome;
      return (
        <>
          <Comp params={params} go={go}/>
          <MobileTabbar items={PARENT_NAV.slice(0,5)} current={cur} onChange={go}/>
        </>
      );
    }
    if (role === 'teacher') {
      const T = TeacherScreens;
      const map = { home:T.MTHome, courses:T.MTCourses, course:T.MTCourses, group:T.MTCourses, lesson:T.MTLesson, students:T.MTStudents, stats:T.MTStats };
      const Comp = map[cur] || T.MTHome;
      return (
        <>
          <Comp params={params} go={go}/>
          <MobileTabbar items={TEACHER_NAV} current={cur==='lesson'?'home':cur} onChange={go}/>
        </>
      );
    }
  };

  const screenLabel = SCREEN_LABEL[role]?.[cur] || cur;

  return (
    <NavCtx.Provider value={{ role, screen: cur, go, params, onLogout }}>
      <Stage>
        <StageHeader role={role} setRole={goRole} screen={screenLabel}/>
        <div className="stage-body">
          <DesktopFrame>{renderDesktop()}</DesktopFrame>
          <MobileFrame>{renderMobile()}</MobileFrame>
        </div>
        <footer style={{ display:'flex', justifyContent:'space-between', color:'var(--muted)', fontSize:12, marginTop: 12 }} className="mono">
          <span>Дарси́-онлайн · Робоцентр · pilot</span>
          <span>Кликабельный прототип · {role}/{cur}</span>
        </footer>
      </Stage>
    </NavCtx.Provider>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App/>);
