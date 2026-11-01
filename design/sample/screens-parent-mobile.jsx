/* global React, DarsiUI */
const { useState } = React;
const { I, Avatar, COURSES, courseById, GROUPS, CHILDREN, LESSONS, fmtDate, dayShort, MobileHeader } = DarsiUI;

/* ==========================================================
   MOBILE — Parent screens (compact versions)
   ========================================================== */
function MPHome({ go }) {
  return (
    <>
      <MobileHeader/>
      <div style={{ padding: '0 18px 100px' }}>
        <div className="eyebrow">Сегодня · 14 мая</div>
        <h1 style={{ fontSize: 32, lineHeight: 1.0, letterSpacing:'-0.03em', margin: '4px 0 18px', fontWeight: 700 }}>
          Привет,<br/>Анна!
        </h1>

        <div className="m-card" style={{ padding: 14 }}>
          <div className="row gap-2" style={{ flexWrap:'wrap' }}>
            {CHILDREN.map(c => (
              <div key={c.id} className="row gap-2" style={{ background: c.color, padding: '6px 12px 6px 6px', borderRadius: 999 }}>
                <Avatar name={c.name} size={26}/> <span className="fw-700 text-sm">{c.name}</span>
              </div>
            ))}
            <button className="btn btn-ghost btn-sm" style={{padding:'6px 10px'}}><I.add/></button>
          </div>
        </div>

        <div className="m-card" style={{ background:'var(--ink)', color:'#fff', padding: 18, position:'relative', overflow:'hidden' }}>
          <div className="circuit" style={{ opacity: 0.15 }}/>
          <div style={{ position:'relative' }}>
            <div className="text-xs mono" style={{ opacity:0.6, textTransform:'uppercase', letterSpacing:'0.08em' }}>Сегодня</div>
            <div className="fw-700 mt-2" style={{ fontSize: 18 }}>Робототехника · 17:30</div>
            <div className="text-sm" style={{ opacity:0.7 }}>Артём · Зал 1 · Сергей В.</div>
            <div className="row gap-2 mt-3">
              <button className="btn btn-lime btn-sm" style={{flex:1, justifyContent:'center'}}><I.check/> Придёт</button>
              <button className="btn btn-ghost btn-sm" style={{background:'#fff', flex:1, justifyContent:'center'}}>Не придёт</button>
            </div>
          </div>
        </div>

        <div className="m-section-title" style={{margin:'14px 0 10px'}}>Каталог курсов</div>
        <div className="row gap-2 mb-3" style={{ overflowX:'auto', paddingBottom: 4 }}>
          <button className="chip active" style={{flex:'0 0 auto'}}>Все</button>
          {['Робото','Электр','Питон','3D'].map(t => <button key={t} className="chip" style={{flex:'0 0 auto'}}>{t}</button>)}
        </div>
        <div className="grid-2 gap-3">
          {COURSES.slice(0,4).map(c => (
            <div key={c.id} className="course-card" style={{ background: c.color, minHeight: 156, padding: 14 }} onClick={() => go('course', { id: c.id })}>
              <div className="course-card-head">
                <div className="course-card-icon" style={{ width:30, height:30 }}>{c.icon}</div>
                <span className="rating-pill" style={{ padding:'3px 8px', fontSize: 11 }}><I.star/>{c.rating}</span>
              </div>
              <h3 style={{ fontSize: 15 }}>{c.title}</h3>
              <div className="course-card-meta mono text-xs">{c.students} учеников</div>
            </div>
          ))}
        </div>

        <div className="m-section-title">Ближайшие занятия</div>
        {LESSONS.filter(l => l.status==='planned').slice(0,2).map(l => {
          const c = courseById(l.courseId);
          const g = GROUPS.find(x => x.id === l.groupId);
          return (
            <div key={l.id} className="m-card" style={{ padding: 14, cursor: 'pointer' }} onClick={() => go('lesson', { id: l.id })}>
              <div className="row gap-3">
                <div className="date-block" style={{ width: 56 }}><div className="d">{l.date.getDate()}</div><div className="m">{dayShort(l.date)}</div></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row gap-2 mb-2"><span className="tag" style={{ background: c.color, borderColor:'transparent', padding:'4px 8px', fontSize: 11 }}>{c.cat}</span></div>
                  <div className="fw-700 text-sm">{c.title}</div>
                  <div className="muted text-xs mt-2">{l.time} · {g.room}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function MPChildren() {
  return (
    <>
      <MobileHeader title="Мои дети" right={<button className="btn btn-icon btn-ghost" style={{background:'#fff'}}><I.add/></button>}/>
      <div style={{ padding: '0 18px 100px' }}>
        <div className="col gap-3">
          {CHILDREN.map(ch => (
            <div key={ch.id} className="m-card" style={{ padding: 0, overflow:'hidden' }}>
              <div style={{ background: ch.color, padding: 18 }}>
                <div className="row gap-3">
                  <div style={{ width: 48, height: 48, borderRadius: 14, background:'#fff', display:'grid', placeItems:'center', fontWeight:700, fontSize: 18 }}>{ch.avatar}</div>
                  <div>
                    <div className="fw-700">{ch.name} {ch.surname}</div>
                    <div className="text-xs muted">{ch.age} лет</div>
                  </div>
                </div>
              </div>
              <div style={{ padding: 14 }}>
                {ch.courses.map(cid => {
                  const c = courseById(cid);
                  return (
                    <div key={cid} className="row-between mb-2">
                      <div className="row gap-2"><div style={{ width:24, height:24, borderRadius: 6, background: c.color, display:'grid', placeItems:'center' }}>{c.icon}</div><span className="text-sm fw-600">{c.title}</span></div>
                      <span className="att-dot present"/>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function MPCourses({ go }) {
  return (
    <>
      <MobileHeader title="Курсы"/>
      <div style={{ padding: '0 18px 100px' }}>
        <div className="row gap-2 mb-3" style={{ overflowX:'auto', paddingBottom: 4 }}>
          <button className="chip active" style={{flex:'0 0 auto'}}>Все</button>
          {['Робото','Электр','Программ','3D','Lego','Дроны'].map(t => <button key={t} className="chip" style={{flex:'0 0 auto'}}>{t}</button>)}
        </div>
        <div className="grid-2 gap-3">
          {COURSES.map(c => (
            <div key={c.id} className="course-card" style={{ background: c.color, minHeight: 170, padding: 14 }} onClick={() => go('course', { id: c.id })}>
              <div className="course-card-head">
                <div className="course-card-icon" style={{ width:30, height:30 }}>{c.icon}</div>
                <span className="rating-pill" style={{ padding:'3px 8px', fontSize: 11 }}><I.star/>{c.rating}</span>
              </div>
              <h3 style={{ fontSize: 15 }}>{c.title}</h3>
              <div className="course-card-meta mono text-xs">{c.age} лет · ₽{c.price}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function MPCourse({ params, go }) {
  const c = courseById(params?.id || 'robotics');
  const groups = GROUPS.filter(g => g.courseId === c.id);
  return (
    <>
      <MobileHeader left={<button className="btn btn-icon btn-ghost" style={{background:'#fff'}} onClick={() => go('courses')}><I.back/></button>} title=""/>
      <div style={{ padding: '0 18px 100px' }}>
        <div className="m-card" style={{ background: c.color, border:0, padding: 20 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.6)', display:'grid', placeItems:'center', marginBottom: 12 }}>{c.icon}</div>
          <div className="text-xs fw-600" style={{ opacity: 0.7 }}>{c.cat}</div>
          <div className="fw-700" style={{ fontSize: 22, letterSpacing:'-0.02em', marginTop: 4 }}>{c.title}</div>
          <div className="text-sm mt-2" style={{ opacity: 0.85 }}>{c.desc}</div>
          <div className="row gap-2 mt-3">
            <span className="tag mono" style={{background:'#fff', borderColor:'transparent'}}>{c.age} лет</span>
            <span className="tag" style={{background:'#fff', borderColor:'transparent'}}><I.star/> {c.rating}</span>
          </div>
        </div>
        <div className="m-section-title" style={{margin:'14px 0 10px'}}>Группы</div>
        <div className="col gap-2">
          {groups.map(g => {
            const free = g.capacity - g.count;
            return (
              <div key={g.id} className="m-card row-between" style={{ padding: 14 }}>
                <div className="row gap-3">
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: c.color, display:'grid', placeItems:'center', textAlign:'center' }}>
                    <div><div className="fw-700">{g.day}</div><div className="text-xs mono">{g.time}</div></div>
                  </div>
                  <div>
                    <div className="fw-700 text-sm">{g.room}</div>
                    <div className="muted text-xs">Свободно {free} из {g.capacity}</div>
                  </div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => go('enroll', { groupId: g.id })} disabled={free<=0}>{free<=0?'Лист ож.':'Записать'}</button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function MPSchedule({ go }) {
  const days = [];
  for (let i=0;i<14;i++) { const d = new Date(2026,4,11); d.setDate(d.getDate()+i); days.push(d); }
  return (
    <>
      <MobileHeader title="Расписание"/>
      <div style={{ padding: '0 18px 100px' }}>
        <div className="row gap-2 mb-3" style={{ overflowX:'auto', paddingBottom: 4 }}>
          {days.slice(0,7).map((d,i) => {
            const has = LESSONS.some(l => l.date.getDate()===d.getDate());
            const today = i===3;
            return (
              <div key={i} className="card" style={{ padding: '8px 10px', minWidth: 48, textAlign:'center', flex:'0 0 auto', background: today?'var(--ink)':'#fff', color: today?'#fff':'var(--ink)', borderColor: today?'var(--ink)':'var(--hairline)' }}>
                <div className="text-xs mono" style={{ opacity:0.7 }}>{dayShort(d)}</div>
                <div className="fw-700" style={{ fontSize: 16, marginTop: 2 }}>{d.getDate()}</div>
                <div style={{ height: 4, marginTop: 4 }}>
                  {has && <span style={{ display:'inline-block', width:4, height:4, borderRadius:99, background: today?'var(--lime)':'var(--ink)' }}/>}
                </div>
              </div>
            );
          })}
        </div>
        {LESSONS.slice(0,5).map(l => {
          const c = courseById(l.courseId);
          const g = GROUPS.find(x => x.id === l.groupId);
          return (
            <div key={l.id} className="m-card" style={{ padding: 14, cursor: 'pointer' }} onClick={() => go('lesson', { id: l.id })}>
              <div className="row gap-3">
                <div className="date-block" style={{ width: 52 }}><div className="d" style={{fontSize:16}}>{l.date.getDate()}</div><div className="m">{dayShort(l.date)}</div></div>
                <div style={{ flex:1, minWidth: 0 }}>
                  <div className="text-xs muted mono">{l.time}</div>
                  <div className="fw-700 text-sm">{c.title}</div>
                  <div className="muted text-xs">{g.room} · Артём</div>
                </div>
                {l.status==='done' ? <span className="att-dot present" style={{width:14, height:14}}/> : <span className="status info text-xs" style={{padding:'4px 8px'}}>Скоро</span>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function MPLesson({ params, go }) {
  const l = LESSONS.find(x => x.id === params?.id) || LESSONS[5];
  const c = courseById(l.courseId);
  const g = GROUPS.find(x => x.id === l.groupId);
  return (
    <>
      <MobileHeader left={<button className="btn btn-icon btn-ghost" style={{background:'#fff'}} onClick={() => go('schedule')}><I.back/></button>} title=""/>
      <div style={{ padding: '0 18px 100px' }}>
        <div className="m-card" style={{ background: c.color, border:0, padding: 20 }}>
          <div className="row gap-2 mb-2"><span className="tag" style={{ background:'#fff', borderColor:'transparent', fontSize: 11 }}>{c.cat}</span></div>
          <div className="fw-700" style={{ fontSize: 22, letterSpacing:'-0.02em' }}>{c.title}</div>
          <div className="text-sm mt-2">{l.topic}</div>
          <div className="text-sm mt-3 fw-600">{fmtDate(l.date)} · {l.time} · {g.room}</div>
        </div>
        <div className="m-card">
          <div className="fw-700 mb-3 text-sm">Артём придёт?</div>
          <div className="row gap-2">
            <button className="btn btn-lime btn-sm" style={{flex:1, justifyContent:'center'}}><I.check/> Придёт</button>
            <button className="btn btn-ghost btn-sm" style={{background:'#fff', flex:1, justifyContent:'center'}}>Не придёт</button>
          </div>
        </div>
        <div className="m-section-title" style={{margin:'14px 0 10px'}}>Материалы</div>
        <div className="m-card row-between" style={{padding:12}}>
          <div className="row gap-3"><div style={{width:36, height:36, borderRadius:10, background:'var(--bg)', display:'grid', placeItems:'center'}}><I.paper/></div><div><div className="fw-700 text-sm">Конспект</div><div className="text-xs muted">PDF · 12 стр.</div></div></div>
          <I.arrow/>
        </div>
        <div className="m-card row-between" style={{padding:12}}>
          <div className="row gap-3"><div style={{width:36, height:36, borderRadius:10, background:'var(--c-3d)', display:'grid', placeItems:'center'}}><I.play/></div><div><div className="fw-700 text-sm">Видеозапись</div><div className="text-xs muted">42 мин</div></div></div>
          <I.arrow/>
        </div>
        <div className="m-section-title">Домашнее задание</div>
        <div className="m-card">
          <div className="fw-700 text-sm mb-2">Программа на ультразвуковой датчик</div>
          <div className="text-xs muted mb-3">Робот должен останавливаться за 15 см до препятствия.</div>
          <div className="row-between">
            <span className="status warn">Срок 18 мая</span>
            <button className="btn btn-primary btn-sm">Сдать</button>
          </div>
        </div>
      </div>
    </>
  );
}

function MPPayments() {
  return (
    <>
      <MobileHeader title="Оплаты"/>
      <div style={{ padding: '0 18px 100px' }}>
        <div className="m-card" style={{ background:'var(--c-robotics)', border:0 }}>
          <div className="text-xs mono mb-1" style={{ textTransform:'uppercase', letterSpacing:'0.08em' }}>Абонемент</div>
          <div className="fw-700">Робототехника</div>
          <div className="text-sm">Артём · 6 / 9</div>
          <div className="bar mt-3"><span style={{ width:'67%', background:'var(--ink)' }}/></div>
        </div>
        <div className="m-card" style={{ background:'var(--c-lego)', border:0 }}>
          <div className="text-xs mono mb-1" style={{ textTransform:'uppercase', letterSpacing:'0.08em' }}>Абонемент</div>
          <div className="fw-700">Lego WeDo</div>
          <div className="text-sm">Мира · 5 / 8</div>
          <div className="bar mt-3"><span style={{ width:'62%', background:'var(--ink)' }}/></div>
        </div>
        <div className="m-section-title" style={{margin:'14px 0 10px'}}>История</div>
        {[
          { date:'7 мая', t:'Робототехника', a:9000, status:'paid', kind:'sub' },
          { date:'5 мая', t:'Lego WeDo', a:4250, status:'paid', kind:'sub' },
          { date:'12 мая', t:'Сборка дрона', a:1500, status:'pending', kind:'event' },
        ].map((it, i) => (
          <div key={i} className="m-card row-between" style={{ padding: 14 }}>
            <div className="row gap-3">
              <div style={{ width: 36, height: 36, borderRadius: 10, background: it.kind==='event'?'var(--c-arduino)':'var(--c-robotics)', display:'grid', placeItems:'center' }}>
                {it.kind==='event'?<I.lightning/>:<I.book/>}
              </div>
              <div><div className="fw-700 text-sm">{it.t}</div><div className="text-xs muted">{it.date}</div></div>
            </div>
            <div className="col" style={{alignItems:'flex-end'}}>
              <div className="fw-700 mono text-sm">₽{it.a.toLocaleString('ru')}</div>
              <span className={`status ${it.status==='paid'?'ok':'warn'}`} style={{fontSize: 10, padding:'3px 8px'}}>{it.status==='paid'?'Оплачено':'Ждёт'}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function MPEvents() {
  const events = [
    { id:'e1', title:'Открытый урок «Робо-рука»', date:'18 мая', time:'12:00', color:'var(--c-robotics)', icon:<I.robot/>, free:true, count:18, capacity:30 },
    { id:'e2', title:'Мастер-класс по 3D-печати', date:'25 мая', time:'15:00', color:'var(--c-3d)', icon:<I.cube/>, price:1200, count:8, capacity:12 },
    { id:'e3', title:'Соревнование «Робо-гонки»', date:'1 июня', time:'11:00', color:'var(--c-drones)', icon:<I.lightning/>, price:500, count:24, capacity:32 },
  ];
  return (
    <>
      <MobileHeader title="Мероприятия"/>
      <div style={{ padding: '0 18px 100px' }}>
        {events.map(e => (
          <div key={e.id} className="m-card" style={{ padding: 0, overflow:'hidden' }}>
            <div style={{ background: e.color, padding: 16, position:'relative' }}>
              <div className="circuit"/>
              <div style={{ position:'relative' }}>
                <div className="row-between">
                  <div>
                    <div className="text-xs mono" style={{ textTransform:'uppercase' }}>{e.date}</div>
                    <div className="fw-700" style={{ fontSize: 22 }}>{e.time}</div>
                  </div>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background:'rgba(255,255,255,0.6)', display:'grid', placeItems:'center' }}>{e.icon}</div>
                </div>
              </div>
            </div>
            <div style={{ padding: 14 }}>
              <div className="fw-700">{e.title}</div>
              <div className="row-between mt-3">
                <span className="tag mono">{e.free ? 'Бесплатно' : `₽${e.price}`}</span>
                <button className="btn btn-primary btn-sm">Записаться</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function MPEnroll({ params, go }) {
  const [step, setStep] = useState(1);
  const g = GROUPS.find(x => x.id === params?.groupId) || GROUPS[0];
  const c = courseById(g.courseId);
  const [child, setChild] = useState('c1');
  const [pay, setPay] = useState('sub');
  return (
    <>
      <MobileHeader left={<button className="btn btn-icon btn-ghost" style={{background:'#fff'}} onClick={() => go('course', { id: c.id })}><I.back/></button>} title={`Шаг ${step}/3`}/>
      <div style={{ padding: '0 18px 100px' }}>
        <div className="m-card" style={{ background: c.color, border:0, padding: 16 }}>
          <div className="fw-700 text-sm">{c.title}</div>
          <div className="text-xs">{g.day} {g.time} · {g.room}</div>
        </div>
        {step === 1 && (
          <>
            <div className="m-section-title" style={{margin:'14px 0 10px'}}>Кого записываем?</div>
            {CHILDREN.map(ch => (
              <label key={ch.id} className="m-card row-between" style={{ padding: 14, cursor:'pointer', borderColor: child===ch.id?'var(--ink)':'var(--hairline)', borderWidth: 2 }}>
                <div className="row gap-2"><div style={{width:36, height:36, borderRadius:10, background:ch.color, display:'grid', placeItems:'center', fontWeight:700}}>{ch.avatar}</div><div className="fw-700 text-sm">{ch.name}</div></div>
                <input type="radio" checked={child===ch.id} onChange={() => setChild(ch.id)}/>
              </label>
            ))}
            <button className="btn btn-primary full mt-3" style={{ justifyContent:'center' }} onClick={() => setStep(2)}>Дальше <I.arrow/></button>
          </>
        )}
        {step === 2 && (
          <>
            <div className="m-section-title" style={{margin:'14px 0 10px'}}>Оплата</div>
            {[['sub',`Абонемент ${c.lessons} занятий`,c.sub,'-15%'],['single','Поштучно',c.price,'/занятие']].map(([k,t,price,note]) => (
              <label key={k} className="m-card" style={{ padding: 14, cursor:'pointer', borderColor: pay===k?'var(--ink)':'var(--hairline)', borderWidth: 2 }}>
                <div className="row-between"><span className="fw-700 text-sm">{t}</span><input type="radio" checked={pay===k} onChange={() => setPay(k)}/></div>
                <div className="fw-700 mt-2" style={{fontSize: 22}}>₽{price.toLocaleString('ru')}<span className="text-xs muted fw-600"> {note}</span></div>
              </label>
            ))}
            <div className="row gap-2 mt-3">
              <button className="btn btn-ghost btn-sm" style={{background:'#fff'}} onClick={() => setStep(1)}><I.back/></button>
              <button className="btn btn-primary" style={{ flex:1, justifyContent:'center' }} onClick={() => setStep(3)}>К оплате <I.arrow/></button>
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <div className="m-section-title" style={{margin:'14px 0 10px'}}>Подтверждение</div>
            <div className="m-card">
              <SumRowM l="Ребёнок" r={CHILDREN.find(x=>x.id===child).name}/>
              <SumRowM l="Курс" r={c.title}/>
              <SumRowM l="Группа" r={`${g.day} ${g.time}`}/>
              <SumRowM l="Тариф" r={pay==='sub'?'Абонемент':'Поштучно'}/>
              <div className="divider"/>
              <SumRowM l={<span className="fw-700">Итого</span>} r={<span className="fw-700">₽{(pay==='sub'?c.sub:c.price).toLocaleString('ru')}</span>}/>
            </div>
            <button className="btn btn-lime full" style={{justifyContent:'center'}} onClick={() => go('home')}>ЮKassa <I.arrow/></button>
          </>
        )}
      </div>
    </>
  );
}
const SumRowM = ({l,r}) => <div className="row-between" style={{ padding: '6px 0' }}><span className="muted text-sm">{l}</span><span className="text-sm">{r}</span></div>;

window.MParentScreens = { MPHome, MPChildren, MPCourses, MPCourse, MPSchedule, MPLesson, MPPayments, MPEvents, MPEnroll };
