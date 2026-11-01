/* global React, DarsiUI */
const { useState } = React;
const { I, Avatar, COURSES, courseById, GROUPS, STUDENTS, LESSONS, fmtDate, dayShort, MobileHeader } = DarsiUI;

/* ==========================================================
   DESKTOP — Teacher Home (today + week)
   ========================================================== */
function THome({ go }) {
  const todays = LESSONS.filter(l => l.date.getDate()===14);
  return (
    <>
      <div className="row-between mb-4">
        <div>
          <div className="eyebrow">Четверг · 14 мая 2026</div>
          <h1 style={{ margin: '6px 0 0' }}>Сегодня —<br/>3 занятия</h1>
        </div>
        <div className="row gap-3">
          <button className="btn btn-ghost btn-icon" style={{background:'#fff'}}><I.search/></button>
          <button className="btn btn-primary"><I.add/> Создать занятие</button>
        </div>
      </div>

      <div className="grid-3 gap-4 mb-4">
        <KPI label="Занятий на неделе" v="14" sub="из 16 запланированных" tone="var(--c-robotics)"/>
        <KPI label="Посещаемость" v="91%" sub="↑ +3% к прошлой неделе" tone="var(--c-3d)"/>
        <KPI label="Доход за май" v="₽78 400" sub="ЮKassa · самозанятый" tone="var(--c-arduino)"/>
      </div>

      <h2 className="mt-0">Сегодняшние занятия</h2>
      <div className="col">
        {todays.slice(0,3).map((l,i) => {
          const c = courseById(l.courseId);
          const g = GROUPS.find(x => x.id === l.groupId);
          const isNow = i===0;
          return (
            <div key={l.id} className="card" style={{ padding: 0, overflow:'hidden', display: 'grid', gridTemplateColumns: '160px 1fr auto' }}>
              <div style={{ background: c.color, padding: 20, display:'grid', placeItems:'center', textAlign:'center' }}>
                <div>
                  <div className="fw-700" style={{ fontSize: 26, letterSpacing:'-0.02em' }}>{l.time}</div>
                  <div className="text-xs mono">{l.dur} мин · {g.room}</div>
                  {isNow && <div className="status info mt-3" style={{display:'inline-flex'}}>● Идёт сейчас</div>}
                </div>
              </div>
              <div style={{ padding: 18 }}>
                <div className="row gap-2 mb-2"><span className="tag" style={{ background:'#fff' }}>{c.icon}{c.cat}</span><span className="muted text-sm">{l.topic}</span></div>
                <div className="fw-700" style={{ fontSize: 18, letterSpacing:'-0.02em' }}>{c.title}</div>
                <div className="row gap-2 mt-3" style={{ alignItems:'center' }}>
                  <div className="avatar-stack">
                    {STUDENTS.slice(i, i+5).map(s => <Avatar key={s.id} name={s.name} size={28}/>)}
                  </div>
                  <span className="muted text-sm">{g.count} учеников · {STUDENTS.slice(i,i+2).filter(s=>s.paid).length} оплатили абонемент</span>
                </div>
              </div>
              <div style={{ padding: 18, display:'grid', placeItems:'center' }}>
                <button className="btn btn-primary" onClick={() => go('lesson', { id: l.id })}>Открыть журнал <I.arrow/></button>
              </div>
            </div>
          );
        })}
      </div>

      <h2>На этой неделе</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>
        <div className="card" style={{ padding: 18 }}>
          <div className="row-between mb-3">
            <div className="fw-700">Загрузка по дням</div>
            <span className="muted text-sm mono">11–17 мая</span>
          </div>
          <div className="bars" style={{ height: 120 }}>
            {[
              { d: 'Пн', stack: [['var(--c-robotics)',60],['var(--c-3d)',20]] },
              { d: 'Вт', stack: [['var(--c-robotics)',90]] },
              { d: 'Ср', stack: [['var(--c-code)',80]] },
              { d: 'Чт', stack: [['var(--c-arduino)',70],['var(--c-robotics)',30]] },
              { d: 'Пт', stack: [['var(--c-3d)',50]] },
              { d: 'Сб', stack: [['var(--c-lego)',60],['var(--c-robotics)',40],['var(--c-drones)',50]] },
              { d: 'Вс', stack: [] },
            ].map((b, idx) => (
              <div key={idx} className="col" style={{ alignItems:'center', gap: 4 }}>
                <div style={{ flex: 1, width: '70%', display:'flex', flexDirection:'column-reverse', gap: 2 }}>
                  {b.stack.map(([clr, h], si) => <div key={si} style={{ background: clr, height: `${h}%`, borderRadius: 6 }}/>)}
                </div>
                <div className="text-xs mono muted">{b.d}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card" style={{ background: 'var(--ink)', color: '#fff', padding: 18, position:'relative', overflow:'hidden' }}>
          <div className="circuit" style={{ opacity: 0.15 }}/>
          <div style={{ position:'relative' }}>
            <div className="row gap-2"><I.bot/><div className="fw-700">Telegram-рассылка</div></div>
            <div className="text-sm mt-2" style={{opacity:0.7}}>Завтра в 18:00 — напоминание для 8 родителей о субботнем занятии.</div>
            <div className="row gap-2 mt-3">
              <button className="btn btn-lime btn-sm">Готово</button>
              <button className="btn btn-ghost btn-sm" style={{background:'transparent', borderColor:'rgba(255,255,255,0.3)', color:'#fff'}}>Изменить</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
const KPI = ({ label, v, sub, tone }) => (
  <div className="card" style={{ padding: 18, background: tone, border:0 }}>
    <div className="text-xs mono" style={{ textTransform:'uppercase', letterSpacing:'0.08em', opacity: 0.7 }}>{label}</div>
    <div className="fw-700 mt-2" style={{ fontSize: 32, letterSpacing:'-0.03em' }}>{v}</div>
    <div className="text-sm" style={{ opacity: 0.85 }}>{sub}</div>
  </div>
);

/* ==========================================================
   DESKTOP — Teacher Courses (CRUD)
   ========================================================== */
function TCourses({ go }) {
  return (
    <>
      <div className="row-between mb-4">
        <div><div className="eyebrow">Управление</div><h1 style={{ margin: '6px 0 0' }}>Мои курсы</h1></div>
        <button className="btn btn-primary"><I.add/> Создать курс</button>
      </div>
      <div className="col">
        {COURSES.map(c => {
          const groups = GROUPS.filter(g => g.courseId === c.id);
          return (
            <div key={c.id} className="card" style={{ padding: 0, overflow:'hidden' }}>
              <div className="row-between" style={{ padding: 18, borderBottom: '1px solid var(--hairline)' }}>
                <div className="row gap-3">
                  <div style={{ width:48, height:48, borderRadius: 14, background: c.color, display:'grid', placeItems:'center' }}>{c.icon}</div>
                  <div>
                    <div className="fw-700" style={{ fontSize: 17 }}>{c.title}</div>
                    <div className="text-sm muted">{c.cat} · {c.age} лет · ₽{c.price}/занятие</div>
                  </div>
                </div>
                <div className="row gap-2">
                  <span className="tag"><I.users/> {c.students} учеников</span>
                  <button className="btn btn-ghost btn-sm" style={{background:'#fff'}} onClick={() => go('course', { id: c.id })}>Редактировать</button>
                  <button className="btn btn-icon btn-ghost" style={{background:'#fff'}}><I.more/></button>
                </div>
              </div>
              <div style={{ padding: 14, background: 'var(--bg)', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                {groups.map(g => (
                  <button key={g.id} className="card" style={{ padding: 12, cursor:'pointer', textAlign:'left', background:'#fff' }} onClick={() => go('group', { id: g.id })}>
                    <div className="row-between mb-2"><span className="fw-700 text-sm">{g.day} {g.time}</span><span className="text-xs muted mono">{g.count}/{g.capacity}</span></div>
                    <div className="text-xs muted">{g.room}</div>
                    <div className="bar mt-2"><span style={{ width:`${(g.count/g.capacity)*100}%`, background:'var(--ink)' }}/></div>
                  </button>
                ))}
                <button className="card" style={{ padding: 12, cursor:'pointer', borderStyle:'dashed', background:'transparent', display:'grid', placeItems:'center', minHeight: 64 }}>
                  <div className="row gap-2"><I.add/> Добавить группу</div>
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
   DESKTOP — Group detail
   ========================================================== */
function TGroup({ params, go }) {
  const g = GROUPS.find(x => x.id === params?.id) || GROUPS[0];
  const c = courseById(g.courseId);
  const studs = STUDENTS.filter(s => s.groups.includes(g.id));
  return (
    <>
      <button className="link-btn mb-3" onClick={() => go('courses')}><I.back/> &nbsp;К курсам</button>
      <div className="row-between mb-4">
        <div>
          <div className="eyebrow">{c.title}</div>
          <h1 style={{ margin: '6px 0 0' }}>Группа · {g.day} {g.time}</h1>
        </div>
        <div className="row gap-2">
          <button className="btn btn-ghost" style={{background:'#fff'}}><I.gear/> Настройки</button>
          <button className="btn btn-primary"><I.add/> Добавить ученика</button>
        </div>
      </div>
      <div className="grid-3 gap-4 mb-4">
        <KPI label="Учеников" v={`${g.count} / ${g.capacity}`} sub={`Свободно ${g.capacity-g.count} мест`} tone={c.color}/>
        <KPI label="Средняя посещаемость" v="92%" sub="за последние 8 занятий" tone="var(--c-3d)"/>
        <KPI label="Оплачено абонементов" v={`${studs.filter(s=>s.paid).length} / ${studs.length}`} sub="без задолженностей" tone="var(--c-code)"/>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 24 }}>
        <div>
          <h2 className="mt-0">Состав группы</h2>
          <div className="col">
            {studs.map(s => (
              <div key={s.id} className="card row-between" style={{ padding: 14 }}>
                <div className="row gap-3">
                  <Avatar name={s.name} size={40}/>
                  <div>
                    <div className="fw-700">{s.name}</div>
                    <div className="muted text-sm">{s.age} лет · родитель: {s.parent}</div>
                  </div>
                </div>
                <div className="row gap-3">
                  <div className="col" style={{ alignItems:'flex-end' }}>
                    <span className="text-xs muted">Посещаемость</span>
                    <span className="fw-700">{s.att}%</span>
                  </div>
                  <span className={`status ${s.paid?'ok':'warn'}`}>{s.paid?'Абонемент':'Долг'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <aside>
          <h2 className="mt-0">Ближайшие занятия</h2>
          <div className="col">
            {LESSONS.filter(l => l.groupId === g.id).slice(0,4).map(l => (
              <div key={l.id} className="card row-between" style={{ padding: 14 }}>
                <div>
                  <div className="fw-700 text-sm">{fmtDate(l.date)} · {dayShort(l.date)}</div>
                  <div className="muted text-xs">{l.time}</div>
                </div>
                <span className={`status ${l.status==='done'?'ok':'info'}`}>{l.status==='done'?'Проведено':'План'}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </>
  );
}

/* ==========================================================
   DESKTOP — Lesson Journal (attendance + materials/HW)
   ========================================================== */
function TLesson({ params, go }) {
  const l = LESSONS.find(x => x.id === params?.id) || LESSONS[3];
  const c = courseById(l.courseId);
  const g = GROUPS.find(x => x.id === l.groupId);
  const students = STUDENTS.filter(s => s.groups.includes(g.id));
  const [att, setAtt] = useState(() => Object.fromEntries(students.map(s => [s.id, 'present'])));
  const [tab, setTab] = useState('journal');
  const [pubMat, setPubMat] = useState(false);

  return (
    <>
      <button className="link-btn mb-3" onClick={() => go('home')}><I.back/> &nbsp;К сегодня</button>
      <div className="card" style={{ padding: 24, background: c.color, border: 0, marginBottom: 24 }}>
        <div className="row-between">
          <div>
            <div className="row gap-2 mb-2"><span className="tag" style={{background:'#fff', borderColor:'transparent'}}>{c.icon}{c.cat}</span><span className="tag" style={{background:'#fff', borderColor:'transparent'}}>{l.topic}</span></div>
            <h1 style={{ margin: '4px 0 8px', fontSize: 32 }}>{c.title}</h1>
            <div className="row gap-3 fw-600"><span>{fmtDate(l.date)}</span><span>·</span><span>{l.time}</span><span>·</span><span>{g.room}</span></div>
          </div>
          <div className="col" style={{ alignItems:'flex-end', gap: 8 }}>
            <span className="status info">● Идёт сейчас</span>
            <button className="btn btn-primary">Завершить занятие <I.check/></button>
          </div>
        </div>
      </div>

      <div className="toggle-row mb-4" style={{ width: 480 }}>
        <button className={tab==='journal'?'active':''} onClick={() => setTab('journal')}>Журнал</button>
        <button className={tab==='topic'?'active':''} onClick={() => setTab('topic')}>Тема и материалы</button>
        <button className={tab==='hw'?'active':''} onClick={() => setTab('hw')}>Домашнее задание</button>
      </div>

      {tab === 'journal' && (
        <div>
          <div className="row gap-3 mb-3">
            <span className="tag"><I.users/> {students.length} учеников</span>
            <span className="tag"><span className="att-dot present"/> {Object.values(att).filter(v=>v==='present').length} пришли</span>
            <span className="tag"><span className="att-dot absent"/> {Object.values(att).filter(v=>v==='absent').length} отсутствуют</span>
          </div>
          <div className="col">
            {students.map(s => (
              <div key={s.id} className="card row-between" style={{ padding: 14 }}>
                <div className="row gap-3">
                  <Avatar name={s.name} size={40}/>
                  <div>
                    <div className="fw-700">{s.name}</div>
                    <div className="muted text-sm">{s.parent} · абонемент 6/9</div>
                  </div>
                </div>
                <div className="toggle-row" style={{ width: 280 }}>
                  <button className={att[s.id]==='present'?'active':''} onClick={() => setAtt({...att, [s.id]:'present'})}><I.check/> Был</button>
                  <button className={att[s.id]==='late'?'active':''} onClick={() => setAtt({...att, [s.id]:'late'})}>Опоздал</button>
                  <button className={att[s.id]==='absent'?'active':''} onClick={() => setAtt({...att, [s.id]:'absent'})}><I.cross/> Нет</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'topic' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24 }}>
          <div>
            <div className="field"><label>Тема занятия</label><input className="input input-lg" defaultValue={l.topic}/></div>
            <div className="field"><label>Конспект для родителей</label>
              <textarea className="textarea" rows={6} defaultValue="Сегодня собрали робота с двумя моторами и ультразвуковым датчиком. Запрограммировали остановку перед препятствием. На дом — модифицировать программу так, чтобы робот объезжал препятствие."/>
            </div>
            <div className="field"><label>Видео занятия</label>
              <div className="card" style={{ padding: 14, background: 'var(--bg)', display: 'grid', placeItems:'center', minHeight: 100, borderStyle:'dashed' }}>
                <div className="col" style={{ alignItems:'center', textAlign:'center' }}>
                  <I.play/>
                  <div className="text-sm fw-700 mt-2">Перетащите файл или вставьте ссылку</div>
                  <div className="muted text-xs">YouTube, VK Видео или MP4 до 500 МБ</div>
                </div>
              </div>
            </div>
            <div className="field"><label>Файлы и схемы</label>
              <div className="row gap-2" style={{ flexWrap:'wrap' }}>
                <span className="tag"><I.paper/> схема_робота.pdf <I.cross/></span>
                <span className="tag"><I.code/> firmware.zip <I.cross/></span>
                <button className="chip">+ Добавить файл</button>
              </div>
            </div>
            <div className="row gap-3 mt-4">
              <button className="btn btn-ghost" style={{background:'#fff'}}>Сохранить как черновик</button>
              <button className="btn btn-primary" onClick={() => setPubMat(true)}>Опубликовать <I.arrow/></button>
            </div>
          </div>
          <aside>
            <div className="card" style={{ background: pubMat ? 'var(--c-robotics)' : 'var(--bg)', border: 0 }}>
              <div className="row gap-2 mb-2"><I.bot/><strong className="text-sm">При публикации</strong></div>
              <div className="text-sm">Все 6 родителей группы получат push в Telegram со ссылкой на материалы. Дети, пропустившие занятие, увидят видео и конспект автоматически.</div>
            </div>
          </aside>
        </div>
      )}

      {tab === 'hw' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24 }}>
          <div>
            <div className="field"><label>Название</label><input className="input input-lg" defaultValue="Программа на ультразвуковой датчик"/></div>
            <div className="field"><label>Описание</label>
              <textarea className="textarea" rows={5} defaultValue="Робот должен останавливаться за 15 см до препятствия и поворачивать. Загрузить видео работы (15-30 секунд) или фото с описанием."/>
            </div>
            <div className="grid-2">
              <div className="field"><label>Срок сдачи</label><input className="input" defaultValue="18 мая 2026, 23:59"/></div>
              <div className="field"><label>Сложность</label>
                <div className="toggle-row"><button className="active">Базовая</button><button>+ Звёздочка</button></div>
              </div>
            </div>
            <button className="btn btn-primary mt-3">Опубликовать ДЗ</button>
          </div>
          <aside>
            <div className="card mb-3">
              <div className="fw-700 mb-2">Сданные работы</div>
              <div className="muted text-sm mb-3">К прошлому ДЗ — 5 из 6</div>
              {students.slice(0,5).map(s => (
                <div key={s.id} className="row-between mb-2"><div className="row gap-2"><Avatar name={s.name} size={26}/><span className="text-sm fw-600">{s.name.split(' ')[0]}</span></div><span className="att-dot present"/></div>
              ))}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

/* ==========================================================
   Student detail panel (shared between desktop drawer + mobile sheet)
   ========================================================== */
function StudentDetail({ s, onClose, isMobile }) {
  if (!s) return null;
  const remaining = s.sub_total - s.sub_used;
  const pct = Math.round((s.sub_used / s.sub_total) * 100);
  const wrapStyle = isMobile ? {
    position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
  } : {
    width: 360, borderLeft: '1px solid var(--hairline)', background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'auto',
  };
  const sheetStyle = isMobile ? {
    background: '#fff', borderRadius: '20px 20px 0 0', padding: '0 22px 40px', maxHeight: '82vh', overflowY: 'auto',
  } : { padding: 24, flex: 1, overflowY: 'auto' };
  const backdrop = isMobile ? (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)' }}/>
  ) : null;

  return (
    <div style={wrapStyle}>
      {backdrop}
      <div style={sheetStyle}>
        {isMobile && <div style={{ width: 40, height: 4, borderRadius: 2, background: '#ddd', margin: '12px auto 20px' }}/>}
        {!isMobile && (
          <div className="row-between mb-4">
            <div className="fw-700">Карточка ученика</div>
            <button className="btn btn-icon btn-ghost" onClick={onClose}><I.cross/></button>
          </div>
        )}

        {/* Header */}
        <div className="col" style={{ alignItems: 'center', textAlign: 'center', marginBottom: 20 }}>
          <Avatar name={s.name} size={64}/>
          <div className="fw-700" style={{ fontSize: 18, marginTop: 10 }}>{s.name}</div>
          <div className="muted text-sm">{s.age} лет · родитель: {s.parent}</div>
          <div className="muted text-xs mono mt-1">{s.phone}</div>
        </div>

        {/* Subscription */}
        <div className="card" style={{ padding: 18, marginBottom: 14, background: s.paid ? 'var(--c-robotics)' : '#fef2f2', border: s.paid ? 0 : '1px solid #fca5a5' }}>
          <div className="row-between mb-1">
            <div className="fw-700 text-sm">Абонемент</div>
            <span className={`status ${s.paid ? 'ok' : 'warn'}`}>{s.paid ? 'Активен' : 'Долг'}</span>
          </div>
          <div className="row gap-1 mb-3" style={{ alignItems: 'baseline' }}>
            <span style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.03em' }}>{s.sub_used}</span>
            <span className="muted">/ {s.sub_total} занятий</span>
          </div>
          <div className="bar" style={{ height: 8, borderRadius: 6, background: 'rgba(0,0,0,0.1)' }}>
            <span style={{ width: `${pct}%`, background: 'var(--ink)', borderRadius: 6 }}/>
          </div>
          <div className="row-between mt-2" style={{ fontSize: 12 }}>
            <span>Использовано: {s.sub_used}</span>
            <span className="fw-700">Осталось: {remaining}</span>
          </div>
        </div>

        {/* Attendance */}
        <div className="card" style={{ padding: 18, marginBottom: 14 }}>
          <div className="fw-700 text-sm mb-2">Посещаемость</div>
          <div className="row gap-2" style={{ alignItems: 'center' }}>
            <span style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em' }}>{s.att}%</span>
            <div style={{ flex: 1 }}>
              <div className="bar" style={{ height: 10, borderRadius: 6 }}>
                <span style={{ width: `${s.att}%`, background: s.att >= 90 ? 'var(--ok)' : s.att >= 75 ? 'var(--warn)' : 'var(--danger)', borderRadius: 6 }}/>
              </div>
              <div className="text-xs muted mt-1">{s.att >= 90 ? 'Отличная посещаемость' : s.att >= 75 ? 'Хорошая посещаемость' : 'Низкая посещаемость'}</div>
            </div>
          </div>
        </div>

        {/* Groups */}
        <div className="card" style={{ padding: 18, marginBottom: 14 }}>
          <div className="fw-700 text-sm mb-3">Группы</div>
          {s.groups.map(gid => {
            const g = GROUPS.find(x => x.id === gid);
            const c = courseById(g.courseId);
            return (
              <div key={gid} className="row-between mb-2">
                <div className="row gap-2">
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: c.color, display: 'grid', placeItems: 'center' }}>{c.icon}</div>
                  <div>
                    <div className="fw-700 text-sm">{c.cat}</div>
                    <div className="text-xs muted">{g.day} {g.time} · {g.room}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="col gap-2">
          <button className="btn btn-ghost full" style={{ background: '#fff', justifyContent: 'center' }}><I.bot/> Написать родителю</button>
          {!s.paid && <button className="btn btn-primary full" style={{ justifyContent: 'center' }}>Выставить счёт</button>}
          {isMobile && <button className="btn btn-ghost full mt-1" style={{ background:'#fff', justifyContent: 'center' }} onClick={onClose}>Закрыть</button>}
        </div>
      </div>
    </div>
  );
}

/* ==========================================================
   DESKTOP — Students
   ========================================================== */
function TStudents() {
  const [selected, setSelected] = useState(null);
  return (
    <>
      <div className="row-between mb-4">
        <div><div className="eyebrow">Все ученики</div><h1 style={{ margin: '6px 0 0' }}>Ученики центра</h1></div>
        <div className="row gap-2">
          <div className="row gap-2" style={{ background:'#fff', padding:'8px 14px', borderRadius:999, border:'1px solid var(--hairline)', minWidth:240 }}>
            <I.search/> <input className="input" style={{border:0, padding:0, background:'transparent'}} placeholder="Поиск..."/>
          </div>
          <button className="btn btn-ghost" style={{background:'#fff'}}><I.filter/> Фильтр</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 0, alignItems: 'flex-start', marginRight: selected ? -24 : 0 }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1.6fr 1fr 1fr 1fr 60px', padding: '14px 20px', background: 'var(--bg)', borderBottom: '1px solid var(--hairline)' }}>
            {['Ученик','Группы','Возраст','Посещ.','Оплата',''].map((h,i) => <div key={i} className="text-xs mono muted" style={{ textTransform:'uppercase', letterSpacing:'0.08em' }}>{h}</div>)}
          </div>
          {STUDENTS.map(s => (
            <div key={s.id}
              onClick={() => setSelected(sel => sel?.id === s.id ? null : s)}
              style={{ display: 'grid', gridTemplateColumns: '2.2fr 1.6fr 1fr 1fr 1fr 60px', padding: '14px 20px', borderBottom: '1px solid var(--hairline)', alignItems: 'center', cursor: 'pointer', background: selected?.id === s.id ? 'var(--bg)' : '#fff', transition: 'background 0.15s' }}>
              <div className="row gap-3"><Avatar name={s.name} size={36}/><div><div className="fw-700 text-sm">{s.name}</div><div className="muted text-xs">{s.parent}</div></div></div>
              <div className="row gap-2" style={{ flexWrap:'wrap' }}>
                {s.groups.map(gid => {
                  const g = GROUPS.find(x => x.id === gid);
                  const c = courseById(g.courseId);
                  return <span key={gid} className="tag" style={{ background: c.color, borderColor:'transparent', fontSize: 11 }}>{c.cat}</span>;
                })}
              </div>
              <div className="text-sm">{s.age} лет</div>
              <div>
                <div className="text-sm fw-700">{s.att}%</div>
                <div className="bar" style={{ width: 80, height: 5 }}><span style={{ width:`${s.att}%`, background: s.att>=90?'var(--ok)':s.att>=80?'var(--warn)':'var(--danger)' }}/></div>
              </div>
              <span className={`status ${s.paid?'ok':'warn'}`}>{s.paid?'Оплачено':'Должник'}</span>
              <button className="btn btn-icon btn-ghost" onClick={e => { e.stopPropagation(); setSelected(sel => sel?.id === s.id ? null : s); }}><I.arrow/></button>
            </div>
          ))}
        </div>
        {selected && (
          <StudentDetail s={selected} onClose={() => setSelected(null)} isMobile={false}/>
        )}
      </div>
    </>
  );
}

/* ==========================================================
   DESKTOP — Stats
   ========================================================== */
function TStats() {
  return (
    <>
      <div className="row-between mb-4">
        <div><div className="eyebrow">Май 2026</div><h1 style={{ margin: '6px 0 0' }}>Статистика центра</h1></div>
        <div className="toggle-row" style={{ width: 280 }}>
          <button>Неделя</button>
          <button className="active">Месяц</button>
          <button>Год</button>
        </div>
      </div>
      <div className="grid-3 gap-4 mb-4">
        <KPI label="Доход" v="₽78 400" sub="↑ +12% к апрелю" tone="var(--c-robotics)"/>
        <KPI label="Учеников" v="124" sub="+8 новых за месяц" tone="var(--c-3d)"/>
        <KPI label="Посещаемость" v="91%" sub="среднее по всем группам" tone="var(--c-code)"/>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 24 }}>
        <div className="card" style={{ padding: 24 }}>
          <div className="row-between mb-3">
            <div><div className="fw-700">Доход по неделям</div><div className="muted text-sm">в рублях, без учёта возвратов</div></div>
            <div className="row gap-2"><span className="tag" style={{ background:'var(--c-robotics)', borderColor:'transparent' }}>Абонементы</span><span className="tag" style={{ background:'var(--c-arduino)', borderColor:'transparent' }}>Поштучно</span></div>
          </div>
          <div className="bars" style={{ height: 200 }}>
            {[
              ['16','18'],['22','12'],['19','15'],['25','11'],
            ].map((vals, i) => (
              <div key={i} className="col" style={{ alignItems:'center', gap: 4 }}>
                <div style={{ flex: 1, width: '60%', display:'flex', flexDirection:'column-reverse', gap: 2 }}>
                  <div style={{ background: 'var(--c-robotics)', height: `${vals[0]*3}%`, borderRadius: 6 }}/>
                  <div style={{ background: 'var(--c-arduino)', height: `${vals[1]*3}%`, borderRadius: 6 }}/>
                </div>
                <div className="text-xs mono muted">Нед {i+1}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div className="fw-700 mb-3">Загрузка курсов</div>
          {COURSES.slice(0,5).map(c => {
            const groupsOf = GROUPS.filter(g => g.courseId === c.id);
            const cap = groupsOf.reduce((a,g)=>a+g.capacity, 0) || 8;
            const cnt = groupsOf.reduce((a,g)=>a+g.count, 0) || 5;
            const pct = Math.round((cnt/cap)*100);
            return (
              <div key={c.id} className="mb-3">
                <div className="row-between mb-2"><div className="row gap-2"><div style={{ width: 24, height: 24, borderRadius: 6, background: c.color, display:'grid', placeItems:'center' }}>{c.icon}</div><span className="text-sm fw-600">{c.cat}</span></div><span className="text-sm mono">{pct}%</span></div>
                <div className="bar"><span style={{ width:`${pct}%`, background:'var(--ink)' }}/></div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid-2 gap-4 mt-4">
        <div className="card" style={{ padding: 20 }}>
          <div className="fw-700 mb-3">Должники</div>
          {STUDENTS.filter(s => !s.paid).map(s => (
            <div key={s.id} className="row-between mb-2" style={{ padding: '8px 0' }}>
              <div className="row gap-2"><Avatar name={s.name} size={28}/><div><div className="fw-700 text-sm">{s.name}</div><div className="text-xs muted">{s.parent}</div></div></div>
              <div className="row gap-2"><span className="status warn">₽9 000</span><button className="btn btn-ghost btn-sm" style={{background:'#fff'}}>Напомнить</button></div>
            </div>
          ))}
        </div>
        <div className="card" style={{ padding: 20, background: 'var(--ink)', color: '#fff', position:'relative', overflow:'hidden' }}>
          <div className="circuit" style={{ opacity: 0.15 }}/>
          <div style={{ position:'relative' }}>
            <div className="row gap-2 mb-2"><I.lightning/><strong>Прогноз на июнь</strong></div>
            <div className="text-sm" style={{ opacity: 0.75 }}>На основе записей и продлений абонементов.</div>
            <div className="grid-2 mt-3" style={{gap:14}}>
              <div><div className="text-xs mono" style={{opacity:0.6}}>Доход</div><div className="fw-700" style={{ fontSize: 24 }}>≈₽82 000</div></div>
              <div><div className="text-xs mono" style={{opacity:0.6}}>Загрузка</div><div className="fw-700" style={{ fontSize: 24 }}>87%</div></div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ==========================================================
   MOBILE — Teacher screens
   ========================================================== */
function MTHome({ go }) {
  const todays = LESSONS.filter(l => l.date.getDate()===14);
  return (
    <>
      <MobileHeader/>
      <div style={{ padding: '0 18px 100px' }}>
        <div className="eyebrow">Чт · 14 мая</div>
        <h1 style={{ fontSize: 30, lineHeight: 1.0, letterSpacing:'-0.03em', margin: '4px 0 16px', fontWeight: 700 }}>3 занятия<br/>сегодня</h1>
        <div className="grid-2 gap-3 mb-3">
          <div className="m-card" style={{ background:'var(--c-robotics)', border:0 }}><div className="text-xs mono" style={{textTransform:'uppercase', opacity:0.7}}>Посещ.</div><div className="fw-700" style={{fontSize:24, marginTop:4}}>91%</div></div>
          <div className="m-card" style={{ background:'var(--c-arduino)', border:0 }}><div className="text-xs mono" style={{textTransform:'uppercase', opacity:0.7}}>Доход</div><div className="fw-700" style={{fontSize:24, marginTop:4}}>₽78к</div></div>
        </div>
        <div className="m-section-title" style={{margin:'4px 0 10px'}}>Сегодня</div>
        {todays.slice(0,3).map((l,i) => {
          const c = courseById(l.courseId);
          const g = GROUPS.find(x => x.id === l.groupId);
          return (
            <div key={l.id} className="m-card" style={{ padding: 0, overflow:'hidden', cursor:'pointer' }} onClick={() => go('lesson', { id: l.id })}>
              <div style={{ background: c.color, padding: '10px 14px' }}>
                <div className="row-between">
                  <div className="fw-700">{l.time}</div>
                  {i===0 && <span className="status info text-xs" style={{padding:'2px 8px'}}>Сейчас</span>}
                </div>
              </div>
              <div style={{ padding: 14 }}>
                <div className="fw-700 text-sm">{c.title}</div>
                <div className="text-xs muted">{g.room} · {g.count} учеников</div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function MTCourses({ go }) {
  return (
    <>
      <MobileHeader title="Курсы" right={<button className="btn btn-icon btn-ghost" style={{background:'#fff'}}><I.add/></button>}/>
      <div style={{ padding: '0 18px 100px' }}>
        {COURSES.map(c => (
          <div key={c.id} className="m-card row-between" style={{ padding: 14, cursor:'pointer' }} onClick={() => go('course', { id: c.id })}>
            <div className="row gap-3">
              <div style={{ width: 40, height: 40, borderRadius: 12, background: c.color, display:'grid', placeItems:'center' }}>{c.icon}</div>
              <div>
                <div className="fw-700 text-sm">{c.title}</div>
                <div className="text-xs muted">{c.students} учеников · {GROUPS.filter(g=>g.courseId===c.id).length} групп</div>
              </div>
            </div>
            <I.arrow/>
          </div>
        ))}
      </div>
    </>
  );
}

function MTLesson({ params, go }) {
  const l = LESSONS.find(x => x.id === params?.id) || LESSONS[3];
  const c = courseById(l.courseId);
  const g = GROUPS.find(x => x.id === l.groupId);
  const studs = STUDENTS.filter(s => s.groups.includes(g.id));
  const [att, setAtt] = useState(() => Object.fromEntries(studs.map(s => [s.id, 'present'])));
  return (
    <>
      <MobileHeader left={<button className="btn btn-icon btn-ghost" style={{background:'#fff'}} onClick={() => go('home')}><I.back/></button>} title="Журнал"/>
      <div style={{ padding: '0 18px 100px' }}>
        <div className="m-card" style={{ background: c.color, border: 0, padding: 16 }}>
          <div className="text-xs fw-600" style={{opacity:0.7}}>{c.cat}</div>
          <div className="fw-700" style={{fontSize: 18}}>{c.title}</div>
          <div className="text-sm mt-2">{l.time} · {g.room}</div>
        </div>
        <div className="m-section-title" style={{margin:'14px 0 10px'}}>Посещаемость</div>
        {studs.map(s => (
          <div key={s.id} className="m-card row-between" style={{ padding: 12 }}>
            <div className="row gap-2"><Avatar name={s.name} size={32}/><div className="fw-700 text-sm">{s.name.split(' ')[0]}</div></div>
            <div className="row gap-1">
              {[['present',<I.check/>], ['late','—'], ['absent',<I.cross/>]].map(([k,ic]) => (
                <button key={k} className="btn btn-icon" style={{ width: 36, height: 36, background: att[s.id]===k ? (k==='present'?'var(--lime)':k==='absent'?'#fce5e5':'var(--bg)') : '#fff', border:'1px solid var(--hairline)', color: k==='absent'&&att[s.id]==='absent'?'var(--danger)':'var(--ink)' }} onClick={() => setAtt({...att, [s.id]:k})}>{ic}</button>
              ))}
            </div>
          </div>
        ))}
        <button className="btn btn-primary full mt-3" style={{justifyContent:'center'}}>Завершить занятие <I.check/></button>
      </div>
    </>
  );
}

function MTStudents() {
  const [selected, setSelected] = useState(null);
  return (
    <>
      <MobileHeader title="Ученики"/>
      <div style={{ padding: '0 18px 100px' }}>
        {STUDENTS.map(s => (
          <div key={s.id} className="m-card row-between" style={{ padding: 12, cursor: 'pointer' }} onClick={() => setSelected(s)}>
            <div className="row gap-3">
              <Avatar name={s.name} size={36}/>
              <div>
                <div className="fw-700 text-sm">{s.name}</div>
                <div className="text-xs muted">{s.att}% посещ. · абонемент {s.sub_used}/{s.sub_total}</div>
              </div>
            </div>
            <div className="row gap-2">
              <span className={`status ${s.paid?'ok':'warn'}`} style={{fontSize:10, padding:'3px 8px'}}>{s.paid?'OK':'Долг'}</span>
              <I.arrow/>
            </div>
          </div>
        ))}
      </div>
      {selected && (
        <StudentDetail s={selected} onClose={() => setSelected(null)} isMobile={true}/>
      )}
    </>
  );
}

function MTStats() {
  return (
    <>
      <MobileHeader title="Статистика"/>
      <div style={{ padding: '0 18px 100px' }}>
        <div className="grid-2 gap-3 mb-3">
          <div className="m-card" style={{ background:'var(--c-robotics)', border:0 }}><div className="text-xs mono" style={{textTransform:'uppercase', opacity:0.7}}>Доход</div><div className="fw-700" style={{fontSize: 22, marginTop:4}}>₽78 400</div><div className="text-xs">↑ 12%</div></div>
          <div className="m-card" style={{ background:'var(--c-3d)', border:0 }}><div className="text-xs mono" style={{textTransform:'uppercase', opacity:0.7}}>Учеников</div><div className="fw-700" style={{fontSize: 22, marginTop:4}}>124</div><div className="text-xs">+8 за месяц</div></div>
        </div>
        <div className="m-card">
          <div className="fw-700 mb-3 text-sm">Загрузка курсов</div>
          {COURSES.slice(0,4).map(c => (
            <div key={c.id} className="mb-3">
              <div className="row-between mb-2"><div className="row gap-2"><div style={{ width: 20, height: 20, borderRadius: 5, background: c.color }}/><span className="text-sm fw-600">{c.cat}</span></div><span className="text-xs mono">82%</span></div>
              <div className="bar"><span style={{ width:'82%', background:'var(--ink)' }}/></div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

window.TeacherScreens = { THome, TCourses, TGroup, TLesson, TStudents, TStats, MTHome, MTCourses, MTLesson, MTStudents, MTStats };
