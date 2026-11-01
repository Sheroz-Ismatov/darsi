/* global React, DarsiUI */
const { useState, useMemo } = React;
const { I, Avatar, COURSES, courseById, GROUPS, CHILDREN, LESSONS, TODAY, fmtDate, dayShort, MobileHeader } = DarsiUI;

/* ==========================================================
   DESKTOP — Parent Home
   ========================================================== */
function PHome({ go }) {
  return (
    <>
      <div className="row-between mb-4">
        <div>
          <div className="eyebrow">Среда, {TODAY}</div>
          <h1 style={{ margin: '6px 0 0' }}>Привет,<br/>Анна!</h1>
        </div>
        <div className="row gap-3">
          <button className="btn btn-ghost btn-icon" style={{ background:'#fff' }}><I.search/></button>
          <button className="btn btn-ghost btn-icon" style={{ background:'#fff', position:'relative' }}>
            <I.bell/><span style={{ position:'absolute', top:8, right:8, width:8, height:8, borderRadius:99, background:'var(--lime)' }}/>
          </button>
        </div>
      </div>

      {/* Inline kids selector + quick stats */}
      <div className="card" style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 24, alignItems: 'center' }}>
        <div className="row gap-3">
          <div className="row gap-2">
            {CHILDREN.map(c => (
              <div key={c.id} className="row gap-2" style={{ background: c.color, padding: '8px 14px 8px 8px', borderRadius: 999 }}>
                <Avatar name={c.name}/> <span className="fw-700">{c.name}</span><span className="muted text-sm">{c.age}л</span>
              </div>
            ))}
          </div>
          <button className="btn btn-ghost btn-sm" style={{ background:'#fff' }}><I.add/> Добавить ребёнка</button>
        </div>
        <Stat label="Занятий на неделе" value="4" />
        <Stat label="Абонемент" value="6 / 9" sub="Артём · Робототехника" />
        <Stat label="К оплате" value="₽1 800" tone="warn" />
      </div>

      <div className="row-between mt-4 mb-3">
        <h2 style={{ margin: 0 }}>Каталог курсов</h2>
        <a className="link-btn" onClick={() => go('courses')}>Все курсы →</a>
      </div>
      <div className="row-wrap gap-2 mb-3">
        <button className="chip active"><I.filter/> Все</button>
        {['Робототехника','Электроника','Программирование','3D','Конструирование','Дроны'].map(t => (
          <button key={t} className="chip">{t}</button>
        ))}
      </div>
      <div className="grid-2" style={{ gap: 14 }}>
        {COURSES.slice(0,4).map(c => (
          <div key={c.id} className="course-card" style={{ background: c.color }} onClick={() => go('course', { id: c.id })}>
            <div className="course-card-head">
              <div className="row gap-2">
                <div className="course-card-icon">{c.icon}</div>
                <span className="text-sm fw-600">{c.cat}</span>
              </div>
              <div className="row gap-2">
                {c.top && <span className="rating-pill"><I.lightning/> Топ</span>}
                <span className="rating-pill"><I.star/> {c.rating}</span>
              </div>
            </div>
            <h3 style={{ marginTop: 12 }}>{c.title}</h3>
            <div className="course-card-foot">
              <div className="course-card-meta mono">{c.students} учеников · {c.age} лет</div>
              <div className="avatar-stack">
                <Avatar name="М" size={28}/>
                <Avatar name="Д" size={28}/>
                <Avatar name="К" size={28}/>
              </div>
            </div>
          </div>
        ))}
      </div>

      <h2>Ближайшие занятия</h2>
      <div className="col">
        {LESSONS.filter(l => l.status==='planned').slice(0,3).map(l => {
          const c = courseById(l.courseId);
          const g = GROUPS.find(x => x.id === l.groupId);
          return (
            <div key={l.id} className="lesson-row" onClick={() => go('lesson', { id: l.id })}>
              <div className="date-block"><div className="d">{l.date.getDate()}</div><div className="m">{['янв','фев','мар','апр','мая','июн'][l.date.getMonth()]}</div></div>
              <div>
                <div className="row gap-2 mb-2"><span className="tag" style={{ background: c.color, borderColor: 'transparent' }}>{c.icon}{c.cat}</span><span className="muted text-sm">{l.topic}</span></div>
                <div className="fw-700">{c.title}</div>
                <div className="muted text-sm mt-2">{dayShort(l.date)} · {l.time} · {g.room} · Артём</div>
              </div>
              <div className="col" style={{ alignItems: 'flex-end' }}>
                <span className="status info">Через 2 дня</span>
                <button className="btn btn-ghost btn-sm mt-2" style={{background:'#fff'}}>Не придёт</button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
const Stat = ({ label, value, sub, tone }) => (
  <div>
    <div className="text-xs muted mono" style={{ textTransform:'uppercase', letterSpacing:'0.08em' }}>{label}</div>
    <div className={`fw-700`} style={{ fontSize: 22, letterSpacing: '-0.02em', color: tone==='warn'?'#8d6a18':'var(--ink)' }}>{value}</div>
    {sub && <div className="text-xs muted">{sub}</div>}
  </div>
);

/* ==========================================================
   DESKTOP — Children
   ========================================================== */
function PChildren() {
  return (
    <>
      <div className="row-between mb-4">
        <div><div className="eyebrow">Профили</div><h1 style={{ margin: '6px 0 0' }}>Мои дети</h1></div>
        <button className="btn btn-primary"><I.add/> Добавить ребёнка</button>
      </div>
      <div className="grid-2 gap-4">
        {CHILDREN.map(ch => (
          <div key={ch.id} className="card" style={{ padding: 0, overflow:'hidden' }}>
            <div style={{ background: ch.color, padding: '24px 24px 32px' }}>
              <div className="row-between">
                <div className="row gap-3">
                  <div style={{ width: 56, height: 56, borderRadius: 18, background: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 22 }}>{ch.avatar}</div>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 700, letterSpacing:'-0.02em' }}>{ch.name} {ch.surname}</div>
                    <div className="text-sm" style={{ color: 'var(--ink-2)' }}>{ch.age} лет · с сентября 2025</div>
                  </div>
                </div>
                <button className="btn btn-ghost btn-icon" style={{ background:'rgba(255,255,255,0.5)' }}><I.more/></button>
              </div>
            </div>
            <div style={{ padding: 20, marginTop: -16, background: '#fff', borderRadius: '24px 24px 0 0' }}>
              <div className="text-xs muted mono mb-2" style={{ textTransform:'uppercase', letterSpacing:'0.08em' }}>Курсы</div>
              <div className="col">
                {ch.courses.map(cid => {
                  const c = courseById(cid);
                  return (
                    <div key={cid} className="row-between" style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 12 }}>
                      <div className="row gap-2"><div style={{ width: 30, height: 30, borderRadius: 8, background: c.color, display:'grid', placeItems:'center' }}>{c.icon}</div><span className="fw-600">{c.title}</span></div>
                      <span className="status ok"><span className="att-dot present"/> Активен</span>
                    </div>
                  );
                })}
              </div>
              <div className="grid-2 mt-3">
                <Stat label="Посещаемость" value="92%" />
                <Stat label="Абонемент" value={ch.id==='c1'?'6 / 9':'5 / 8'} />
              </div>
            </div>
          </div>
        ))}
        <button className="card" style={{ padding: 24, border: '2px dashed var(--hairline)', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', minHeight: 280 }}>
          <div className="col" style={{ alignItems: 'center', textAlign: 'center', gap: 8 }}>
            <div style={{ width: 56, height: 56, borderRadius: 18, background: 'var(--lime)', display: 'grid', placeItems: 'center' }}><I.add/></div>
            <div className="fw-700">Добавить ребёнка</div>
            <div className="muted text-sm" style={{ maxWidth: 220 }}>Имя, дата рождения, школа — занимает минуту</div>
          </div>
        </button>
      </div>
    </>
  );
}

/* ==========================================================
   DESKTOP — Course catalog
   ========================================================== */
function PCourses({ go }) {
  const [filter, setFilter] = useState('all');
  return (
    <>
      <div className="row-between mb-4">
        <div><div className="eyebrow">Что изучаем</div><h1 style={{ margin: '6px 0 0' }}>Каталог<br/>курсов центра</h1></div>
        <div className="row gap-2">
          <div className="row gap-2" style={{ background:'#fff', padding:'8px 14px', borderRadius:999, border:'1px solid var(--hairline)', minWidth:240 }}>
            <I.search/> <input className="input" style={{border:0, padding:0, background:'transparent'}} placeholder="Поиск курса..."/>
          </div>
          <button className="btn btn-ghost" style={{ background:'#fff' }}><I.filter/> Фильтры</button>
        </div>
      </div>
      <div className="row-wrap gap-2 mb-4">
        {[['all','Все'],['robotics','Робототехника'],['arduino','Электроника'],['python','Программирование'],['3d','3D'],['lego','Конструирование'],['drones','Дроны']].map(([k,v]) => (
          <button key={k} className={'chip' + (filter===k?' active':'')} onClick={() => setFilter(k)}>{v}</button>
        ))}
      </div>
      <div className="grid-3 gap-4">
        {COURSES.map(c => (
          <div key={c.id} className="course-card" style={{ background: c.color, minHeight: 220 }} onClick={() => go('course', { id: c.id })}>
            <div className="course-card-head">
              <div className="course-card-icon">{c.icon}</div>
              <div className="row gap-2">
                {c.top && <span className="rating-pill"><I.lightning/> Top</span>}
                <span className="rating-pill"><I.star/> {c.rating}</span>
              </div>
            </div>
            <div>
              <div className="text-sm fw-600 mb-2" style={{ opacity: 0.7 }}>{c.cat}</div>
              <h3>{c.title}</h3>
              <div className="text-sm mt-2" style={{ opacity: 0.85 }}>{c.desc}</div>
            </div>
            <div className="course-card-foot">
              <div>
                <div className="mono text-xs" style={{ opacity: 0.7 }}>{c.age} лет · {c.lessons} занятий</div>
                <div className="fw-700 mt-2">от ₽{c.price}/занятие</div>
              </div>
              <div className="row gap-2"><Avatar name="М" size={26}/><Avatar name="Д" size={26}/></div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ==========================================================
   DESKTOP — Course detail + groups
   ========================================================== */
function PCourse({ params, go }) {
  const c = courseById(params?.id || 'robotics');
  const groups = GROUPS.filter(g => g.courseId === c.id);
  return (
    <>
      <button className="link-btn mb-3" onClick={() => go('courses')}><I.back/> &nbsp;К каталогу</button>
      <div className="row-between gap-4 mb-4" style={{ alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div className="eyebrow">{c.cat}</div>
          <h1 style={{ margin: '6px 0 16px' }}>{c.title}</h1>
          <p style={{ fontSize: 17, color: 'var(--ink-2)', maxWidth: 640 }}>{c.desc}</p>
          <div className="row gap-3 mt-4">
            <span className="tag"><I.users/> {c.students} учеников</span>
            <span className="tag"><I.star/> {c.rating}</span>
            <span className="tag mono">{c.age} лет</span>
            <span className="tag mono">{c.lessons} занятий</span>
          </div>
        </div>
        <div className="card" style={{ width: 320, background: c.color, border: 0 }}>
          <div className="course-card-icon mb-3">{c.icon}</div>
          <div className="text-xs mono mb-2" style={{ opacity: 0.7, textTransform:'uppercase' }}>Стоимость</div>
          <div className="fw-700" style={{ fontSize: 28, letterSpacing:'-0.02em' }}>₽{c.price}<span className="text-sm muted fw-600"> /занятие</span></div>
          <div className="text-sm" style={{ opacity: 0.8 }}>или абонемент ₽{c.sub} за {c.lessons} занятий</div>
        </div>
      </div>
      <h2>Группы и расписание</h2>
      <div className="col">
        {groups.map(g => {
          const free = g.capacity - g.count;
          return (
            <div key={g.id} className="card row-between" style={{ padding: 18 }}>
              <div className="row gap-3">
                <div style={{ width: 56, height: 56, borderRadius: 18, background: c.color, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
                  <div><div className="fw-700" style={{ fontSize: 16 }}>{g.day}</div><div className="text-xs mono" style={{ marginTop: 2 }}>{g.time}</div></div>
                </div>
                <div>
                  <div className="fw-700">Группа · {g.day} {g.time}</div>
                  <div className="muted text-sm">{g.room} · {g.dur} мин · преподаватель Сергей В.</div>
                </div>
              </div>
              <div className="row gap-3">
                <div style={{ minWidth: 120 }}>
                  <div className="text-xs muted mb-2">Свободно {free} из {g.capacity}</div>
                  <div className="bar"><span style={{ width: `${(g.count/g.capacity)*100}%`, background: free<=2?'var(--c-lego)':'var(--ink)' }}/></div>
                </div>
                <button className="btn btn-primary" onClick={() => go('enroll', { groupId: g.id })} disabled={free<=0}>
                  {free <=0 ? 'Лист ожидания' : <>Записать <I.arrow/></>}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ==========================================================
   DESKTOP — Enroll flow
   ========================================================== */
function PEnroll({ params, go }) {
  const [step, setStep] = useState(1);
  const [child, setChild] = useState('c1');
  const [pay, setPay] = useState('sub');
  const g = GROUPS.find(x => x.id === params?.groupId) || GROUPS[0];
  const c = courseById(g.courseId);
  return (
    <>
      <button className="link-btn mb-3" onClick={() => go('course', { id: c.id })}><I.back/> &nbsp;К курсу</button>
      <div className="row-between mb-4">
        <h1 style={{ margin: 0 }}>Запись на занятия</h1>
        <div className="row gap-2 mono text-sm">
          {[1,2,3].map(s => <span key={s} className="status" style={{ background: step>=s?'var(--ink)':'var(--hairline)', color: step>=s?'#fff':'var(--muted)' }}>{s}</span>)}
        </div>
      </div>
      <div className="card" style={{ background: c.color, padding: 20, marginBottom: 24, border: 0 }}>
        <div className="row gap-3">
          <div style={{ width:48, height:48, borderRadius:14, background:'#fff', display:'grid', placeItems:'center' }}>{c.icon}</div>
          <div>
            <div className="fw-700 text-sm">{c.cat}</div>
            <div className="fw-700" style={{ fontSize: 20, letterSpacing:'-0.02em' }}>{c.title}</div>
            <div className="text-sm">{g.day} {g.time} · {g.room} · {g.dur} мин</div>
          </div>
        </div>
      </div>

      {step === 1 && (
        <div>
          <h2 className="mt-0">Кого записываем?</h2>
          <div className="grid-2 gap-3">
            {CHILDREN.map(ch => (
              <label key={ch.id} className="card row-between" style={{ cursor: 'pointer', borderColor: child===ch.id?'var(--ink)':'var(--hairline)', borderWidth: 2 }}>
                <div className="row gap-3">
                  <div style={{ width:48, height:48, borderRadius:14, background: ch.color, display:'grid', placeItems:'center', fontWeight:700 }}>{ch.avatar}</div>
                  <div>
                    <div className="fw-700">{ch.name} {ch.surname}</div>
                    <div className="muted text-sm">{ch.age} лет</div>
                  </div>
                </div>
                <input type="radio" checked={child===ch.id} onChange={() => setChild(ch.id)} style={{ width: 18, height: 18 }}/>
              </label>
            ))}
          </div>
          <div className="row-between mt-4">
            <button className="link-btn">+ Добавить ребёнка</button>
            <button className="btn btn-primary" onClick={() => setStep(2)}>Дальше <I.arrow/></button>
          </div>
        </div>
      )}
      {step === 2 && (
        <div>
          <h2 className="mt-0">Способ оплаты</h2>
          <div className="grid-2 gap-3">
            <label className="card" style={{ cursor:'pointer', borderColor: pay==='sub'?'var(--ink)':'var(--hairline)', borderWidth: 2 }}>
              <div className="row-between mb-2">
                <span className="fw-700">Абонемент {c.lessons} занятий</span>
                <input type="radio" checked={pay==='sub'} onChange={() => setPay('sub')}/>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, letterSpacing:'-0.02em' }}>₽{c.sub.toLocaleString('ru')}</div>
              <div className="muted text-sm">Экономия ₽{(c.price*c.lessons - c.sub).toLocaleString('ru')}. Пропущенное занятие сгорает, но материалы остаются доступны.</div>
            </label>
            <label className="card" style={{ cursor:'pointer', borderColor: pay==='single'?'var(--ink)':'var(--hairline)', borderWidth: 2 }}>
              <div className="row-between mb-2">
                <span className="fw-700">Поштучно</span>
                <input type="radio" checked={pay==='single'} onChange={() => setPay('single')}/>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, letterSpacing:'-0.02em' }}>₽{c.price}<span className="text-sm muted fw-600"> /занятие</span></div>
              <div className="muted text-sm">Платим перед каждым занятием. Гибко, но дороже.</div>
            </label>
          </div>
          <div className="row-between mt-4">
            <button className="btn btn-ghost" onClick={() => setStep(1)}><I.back/> Назад</button>
            <button className="btn btn-primary" onClick={() => setStep(3)}>К оплате <I.arrow/></button>
          </div>
        </div>
      )}
      {step === 3 && (
        <div>
          <h2 className="mt-0">Подтверждение</h2>
          <div className="card mb-3" style={{ padding: 20 }}>
            <SumRow l="Курс" r={c.title}/>
            <SumRow l="Группа" r={`${g.day} ${g.time}, ${g.room}`}/>
            <SumRow l="Ребёнок" r={CHILDREN.find(x=>x.id===child).name}/>
            <SumRow l="Тариф" r={pay==='sub'?`Абонемент ${c.lessons} занятий`:'Поштучно'}/>
            <div className="divider"/>
            <SumRow l={<span className="fw-700">Итого</span>} r={<span className="fw-700" style={{ fontSize:22 }}>₽{(pay==='sub'?c.sub:c.price).toLocaleString('ru')}</span>}/>
          </div>
          <div className="card mb-3" style={{ padding: 16, background:'#e1f5f7', borderColor:'transparent' }}>
            <div className="row gap-2"><I.bot/><div className="text-sm"><strong>Чек придёт в Telegram-бот.</strong> Оплата через ЮKassa, чек НПД формируется автоматически.</div></div>
          </div>
          <div className="row-between">
            <button className="btn btn-ghost" onClick={() => setStep(2)}><I.back/> Назад</button>
            <button className="btn btn-lime" onClick={() => go('home')}>Перейти к ЮKassa <I.arrow/></button>
          </div>
        </div>
      )}
    </>
  );
}
const SumRow = ({l,r}) => <div className="row-between" style={{ padding: '8px 0' }}><span className="muted">{l}</span><span>{r}</span></div>;

/* ==========================================================
   DESKTOP — Schedule (calendar-ish)
   ========================================================== */
function PSchedule({ go }) {
  // 14-day strip + lessons grouped per day
  const days = [];
  for (let i=0;i<14;i++) { const d = new Date(2026,4,11); d.setDate(d.getDate()+i); days.push(d); }
  return (
    <>
      <div className="row-between mb-4">
        <div><div className="eyebrow">Май 2026</div><h1 style={{ margin: '6px 0 0' }}>Расписание</h1></div>
        <div className="toggle-row" style={{ width: 240 }}>
          <button className="active">2 недели</button>
          <button>Месяц</button>
        </div>
      </div>
      <div className="row gap-2 mb-4" style={{ overflowX:'auto', paddingBottom: 6 }}>
        {days.map((d,i) => {
          const has = LESSONS.some(l => l.date.getDate()===d.getDate());
          const today = i===3;
          return (
            <div key={i} className="card" style={{ padding: '10px 14px', minWidth: 64, textAlign:'center', flex: '0 0 auto', background: today?'var(--ink)':'#fff', color: today?'#fff':'var(--ink)', borderColor: today?'var(--ink)':'var(--hairline)' }}>
              <div className="text-xs mono" style={{ opacity: 0.7 }}>{dayShort(d)}</div>
              <div className="fw-700" style={{ fontSize: 20, marginTop: 4 }}>{d.getDate()}</div>
              <div style={{ height: 6, marginTop: 6, display:'flex', justifyContent:'center', gap: 3 }}>
                {has && <span style={{ width:6, height:6, borderRadius:99, background: today?'var(--lime)':'var(--ink)' }}/>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="col">
        {LESSONS.slice(0,6).map(l => {
          const c = courseById(l.courseId);
          const g = GROUPS.find(x => x.id === l.groupId);
          return (
            <div key={l.id} className="card row-between" style={{ padding: 16, cursor:'pointer' }} onClick={() => go('lesson', { id: l.id })}>
              <div className="row gap-3">
                <div className="date-block" style={{ width: 64 }}><div className="d">{l.date.getDate()}</div><div className="m">{dayShort(l.date)}</div></div>
                <div>
                  <div className="row gap-2 mb-2"><span className="tag" style={{ background: c.color, borderColor:'transparent' }}>{c.icon}{c.cat}</span><span className="muted text-sm">{l.topic}</span></div>
                  <div className="fw-700">{c.title}</div>
                  <div className="muted text-sm mt-2">{l.time} · {g.dur} мин · {g.room} · {CHILDREN.find(ch => ch.courses.includes(c.id))?.name || 'Артём'}</div>
                </div>
              </div>
              <div className="col" style={{ alignItems:'flex-end' }}>
                {l.status==='done' ? <span className="status ok">Был</span> :
                  <>
                    <span className="status info">Запланировано</span>
                    <div className="row gap-2 mt-2">
                      <button className="btn btn-lime btn-sm"><I.check/> Придёт</button>
                      <button className="btn btn-ghost btn-sm" style={{background:'#fff'}}>Не придёт</button>
                    </div>
                  </>
                }
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ==========================================================
   DESKTOP — Lesson detail
   ========================================================== */
function PLesson({ params, go }) {
  const l = LESSONS.find(x => x.id === params?.id) || LESSONS[5];
  const c = courseById(l.courseId);
  const g = GROUPS.find(x => x.id === l.groupId);
  return (
    <>
      <button className="link-btn mb-3" onClick={() => go('schedule')}><I.back/> &nbsp;К расписанию</button>
      <div className="card mb-4" style={{ background: c.color, border:0, padding: 28 }}>
        <div className="row gap-2 mb-3">
          <span className="tag" style={{ background:'#fff', borderColor:'transparent' }}>{c.icon}{c.cat}</span>
          <span className="tag" style={{ background:'#fff', borderColor:'transparent' }}>{l.topic}</span>
        </div>
        <h1 style={{ margin: 0, fontSize: 40 }}>{c.title}</h1>
        <div className="row gap-3 mt-3" style={{ fontSize: 15 }}>
          <span><strong>{fmtDate(l.date)}</strong> · {dayShort(l.date)}</span>
          <span>·</span>
          <span>{l.time} — {addMin(l.time, l.dur)}</span>
          <span>·</span>
          <span>{g.room}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 24 }}>
        <div>
          <div className="card mb-3">
            <h3 className="mb-3">Артём придёт?</h3>
            <div className="row gap-2 mb-3">
              <button className="btn btn-lime"><I.check/> Придёт</button>
              <button className="btn btn-ghost" style={{background:'#fff'}}>Не придёт</button>
            </div>
            <div className="text-sm muted">Если не придёт — занятие из абонемента сгорит, но материалы и видео останутся доступны.</div>
          </div>
          <h2 className="mt-0">Материалы занятия</h2>
          <div className="col">
            <MatRow icon={<I.paper/>} title="Конспект: датчики света и расстояния" sub="PDF · 12 страниц"/>
            <MatRow icon={<I.play/>} title="Видеозапись прошлого занятия" sub="42 мин · опубликовано 7 мая" tone="var(--c-3d)"/>
            <MatRow icon={<I.code/>} title="Шаблон кода для платформы" sub="ZIP · 1.4 MB"/>
          </div>
          <h2>Домашнее задание</h2>
          <div className="card">
            <div className="row-between mb-2"><span className="fw-700">Запрограммируй робота на ультразвуковой датчик</span><span className="status warn">Срок 18 мая</span></div>
            <div className="text-sm muted mb-3">Робот должен останавливаться за 15 см до препятствия и поворачивать. Загрузи видео или фото — этого достаточно.</div>
            <button className="btn btn-primary btn-sm">Сдать ДЗ</button>
          </div>
        </div>
        <aside>
          <div className="card mb-3">
            <h3 className="mb-3">Группа</h3>
            <div className="row gap-2" style={{ flexWrap:'wrap' }}>
              {['Артём','Иван','Дима','Соня','Маша','Кирилл'].map(n => <Avatar key={n} name={n} size={36}/>)}
            </div>
            <div className="text-sm muted mt-3">Преподаватель: Сергей Воронцов</div>
          </div>
          <div className="card" style={{ background: 'var(--c-robotics)', border: 0 }}>
            <div className="row gap-2 mb-2"><I.bot/><strong className="text-sm">Напоминание в Telegram</strong></div>
            <div className="text-sm">За день до занятия в 18:00 и утром в 08:00 — Telegram пришлёт напоминание с кнопками «Придёт / Не придёт».</div>
          </div>
        </aside>
      </div>
    </>
  );
}
const MatRow = ({ icon, title, sub, tone }) => (
  <div className="card row-between" style={{ padding: 14 }}>
    <div className="row gap-3">
      <div style={{ width: 44, height: 44, borderRadius: 12, background: tone || 'var(--bg)', display: 'grid', placeItems: 'center' }}>{icon}</div>
      <div><div className="fw-700">{title}</div><div className="muted text-sm">{sub}</div></div>
    </div>
    <button className="btn btn-ghost btn-sm" style={{background:'#fff'}}>Открыть <I.arrow/></button>
  </div>
);
const addMin = (t, m) => { const [h,mn] = t.split(':').map(Number); const d = new Date(0,0,0,h,mn+m); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; };

/* ==========================================================
   DESKTOP — Payments
   ========================================================== */
function PPayments() {
  const items = [
    { date: '7 мая', t: 'Абонемент · Робототехника', a: 9000, kind: 'sub', who: 'Артём', status: 'paid' },
    { date: '5 мая', t: 'Lego WeDo · 5 занятий', a: 4250, kind: 'sub', who: 'Мира', status: 'paid' },
    { date: '12 мая', t: 'Мастер-класс · Сборка дрона', a: 1500, kind: 'event', who: 'Артём', status: 'pending' },
    { date: '24 апр', t: 'Отдельное занятие · Python', a: 700, kind: 'single', who: 'Артём', status: 'paid' },
  ];
  return (
    <>
      <div className="row-between mb-4">
        <div><div className="eyebrow">История и абонементы</div><h1 style={{ margin: '6px 0 0' }}>Оплаты</h1></div>
        <button className="btn btn-ghost" style={{ background:'#fff' }}>Скачать чеки</button>
      </div>
      <div className="grid-3 gap-4 mb-4">
        <div className="card" style={{ background:'var(--c-robotics)', border:0 }}>
          <div className="text-xs mono mb-2" style={{ textTransform:'uppercase', letterSpacing:'0.08em' }}>Абонемент</div>
          <div className="fw-700" style={{ fontSize: 22 }}>Робототехника</div>
          <div className="text-sm">Артём · 6 / 9 занятий</div>
          <div className="bar mt-3"><span style={{ width: '67%', background:'var(--ink)' }}/></div>
          <div className="text-xs muted mt-2">До 12 июня 2026</div>
        </div>
        <div className="card" style={{ background:'var(--c-lego)', border:0 }}>
          <div className="text-xs mono mb-2" style={{ textTransform:'uppercase', letterSpacing:'0.08em' }}>Абонемент</div>
          <div className="fw-700" style={{ fontSize: 22 }}>Lego WeDo</div>
          <div className="text-sm">Мира · 5 / 8 занятий</div>
          <div className="bar mt-3"><span style={{ width: '62%', background:'var(--ink)' }}/></div>
          <div className="text-xs muted mt-2">До 28 июня 2026</div>
        </div>
        <div className="card" style={{ borderStyle:'dashed', display:'grid', placeItems:'center' }}>
          <div className="col" style={{ alignItems: 'center', textAlign:'center' }}>
            <div className="fw-700">Купить абонемент</div>
            <div className="muted text-sm">Со скидкой 15-20% от поштучной цены</div>
            <button className="btn btn-primary btn-sm mt-3">Выбрать курс</button>
          </div>
        </div>
      </div>
      <h2 className="mt-0">История платежей</h2>
      <div className="col">
        {items.map((it, i) => (
          <div key={i} className="card row-between" style={{ padding: 16 }}>
            <div className="row gap-3">
              <div style={{ width: 44, height: 44, borderRadius: 12, background: it.kind==='sub'?'var(--c-robotics)':it.kind==='event'?'var(--c-arduino)':'var(--c-3d)', display:'grid', placeItems:'center' }}>
                {it.kind==='event'?<I.lightning/>:it.kind==='single'?<I.bell/>:<I.book/>}
              </div>
              <div>
                <div className="fw-700">{it.t}</div>
                <div className="muted text-sm">{it.date} · {it.who} · ЮKassa · чек НПД</div>
              </div>
            </div>
            <div className="row gap-3">
              <div className="fw-700 mono">₽{it.a.toLocaleString('ru')}</div>
              <span className={`status ${it.status==='paid'?'ok':'warn'}`}>{it.status==='paid'?'Оплачено':'Ждёт оплаты'}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ==========================================================
   DESKTOP — Events
   ========================================================== */
function PEvents() {
  const events = [
    { id:'e1', title:'Открытый урок «Сборка робо-руки»', date:'18 мая', time:'12:00', dur:120, price:0, color:'var(--c-robotics)', icon:<I.robot/>, free:true, count:18, capacity:30 },
    { id:'e2', title:'Мастер-класс по 3D-печати', date:'25 мая', time:'15:00', dur:90, price:1200, color:'var(--c-3d)', icon:<I.cube/>, count:8, capacity:12 },
    { id:'e3', title:'Соревнование «Робо-гонки»', date:'1 июня', time:'11:00', dur:240, price:500, color:'var(--c-drones)', icon:<I.lightning/>, count:24, capacity:32 },
  ];
  return (
    <>
      <div className="row-between mb-4">
        <div><div className="eyebrow">Разовые события</div><h1 style={{ margin: '6px 0 0' }}>Мероприятия</h1></div>
      </div>
      <div className="col gap-4">
        {events.map(e => (
          <div key={e.id} className="card" style={{ padding: 0, overflow:'hidden', display:'grid', gridTemplateColumns: '280px 1fr auto' }}>
            <div style={{ background: e.color, padding: 24, position: 'relative' }}>
              <div className="circuit"/>
              <div style={{ position:'relative' }}>
                <div className="text-xs mono mb-2" style={{ textTransform:'uppercase', letterSpacing:'0.08em' }}>{e.date}</div>
                <div className="fw-700" style={{ fontSize: 28, letterSpacing:'-0.02em' }}>{e.time}</div>
                <div className="text-sm">{e.dur} мин</div>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(255,255,255,0.6)', display:'grid', placeItems:'center', marginTop: 24 }}>{e.icon}</div>
              </div>
            </div>
            <div style={{ padding: 24 }}>
              <div className="fw-700" style={{ fontSize: 20, letterSpacing:'-0.02em' }}>{e.title}</div>
              <div className="text-sm muted mt-2">Зал 1 · преподаватель Сергей В.</div>
              <div className="row gap-3 mt-3">
                <span className="tag"><I.users/> {e.count} / {e.capacity}</span>
                <span className="tag mono">{e.free ? 'Бесплатно' : `₽${e.price}`}</span>
              </div>
            </div>
            <div style={{ padding: 24, display:'grid', placeItems:'center' }}>
              <button className="btn btn-primary">Записаться <I.arrow/></button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

window.ParentScreens = { PHome, PChildren, PCourses, PCourse, PEnroll, PSchedule, PLesson, PPayments, PEvents };
