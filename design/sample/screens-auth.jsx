/* global React, DarsiUI */
const { useState } = React;
const { I, Avatar, Sidebar, MobileTabbar, MobileHeader, COURSES, courseById, GROUPS, CHILDREN, LESSONS, TODAY, fmtDate, dayShort } = DarsiUI;

/* ==========================================================
   AUTH SCREENS
   ========================================================== */
function AuthLanding({ onContinue }) {
  // desktop hero — left content + right preview card
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 36px', borderBottom: '1px solid var(--hairline)' }}>
        <div className="row gap-3">
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--ink)', color: 'var(--lime)', display: 'grid', placeItems: 'center', fontFamily: 'var(--f-mono)', fontWeight: 700 }}>D</div>
          <div className="fw-700" style={{ letterSpacing: '-0.02em' }}>Дарси́<span className="muted fw-600"> · Робоцентр</span></div>
        </div>
        <div className="row gap-3">
          <a className="link-btn">Курсы</a>
          <a className="link-btn">Расписание</a>
          <a className="link-btn">О центре</a>
          <button className="btn btn-ghost btn-sm" onClick={onContinue}>Войти</button>
        </div>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 32, padding: '40px 36px', alignItems: 'center', flex: 1 }}>
        <div>
          <div className="eyebrow">Личный кабинет · Робоцентр</div>
          <h1 style={{ fontSize: 64, lineHeight: 1.08, margin: '8px 0 16px' }}>Учим детей<br/>проектировать<br/><span style={{ background: 'var(--lime)', padding: '2px 14px', borderRadius: 14, display: 'inline-block', lineHeight: 1.0 }}>будущее</span>.</h1>
          <p style={{ fontSize: 17, color: 'var(--ink-2)', maxWidth: 520, margin: '0 0 28px' }}>
            Записывайте детей на робототехнику, электронику и программирование. Расписание, оплата и материалы занятий — в одном месте.
          </p>
          <div className="row gap-3">
            <button className="btn btn-lime" onClick={onContinue}><I.tg/> Войти через Telegram</button>
            <button className="btn btn-ghost" onClick={onContinue}><I.phone/> По номеру телефона</button>
          </div>
          <div className="row gap-3 mt-4" style={{ fontSize: 13, color: 'var(--muted)' }}>
            <span>● 6 курсов</span>
            <span>● 120 учеников</span>
            <span>● 4.9 средний балл</span>
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <div className="circuit" style={{ borderRadius: 24 }}/>
          <div className="grid-2" style={{ gap: 12 }}>
            {COURSES.slice(0,4).map(c => (
              <div key={c.id} className="course-card" style={{ background: c.color, minHeight: 156 }}>
                <div className="course-card-head">
                  <div className="course-card-icon">{c.icon}</div>
                  <span className="rating-pill"><I.star/> {c.rating}</span>
                </div>
                <h3 style={{ fontSize: 17 }}>{c.title}</h3>
                <div className="course-card-meta mono">{c.students} учеников</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AuthLogin({ onTg, onPhone }) {
  const [method, setMethod] = useState('tg');
  return (
    <div style={{ flex: 1, display: 'flex' }}>
      <div style={{ flex: 1, padding: '60px 60px', display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 560 }}>
        <button className="link-btn" style={{ alignSelf: 'flex-start', marginBottom: 20 }}><I.back/> &nbsp;На главную</button>
        <div className="eyebrow">Вход в кабинет</div>
        <h1 style={{ fontSize: 44, margin: '8px 0 8px' }}>С возвращением</h1>
        <p style={{ color: 'var(--muted)', margin: '0 0 28px' }}>Войдите тем способом, который привязан к профилю.</p>
        <div className="toggle-row mb-4">
          <button className={method==='tg'?'active':''} onClick={() => setMethod('tg')}><I.tg/> Telegram</button>
          <button className={method==='sms'?'active':''} onClick={() => setMethod('sms')}><I.phone/> Телефон</button>
        </div>
        {method === 'tg' ? (
          <div className="card" style={{ padding: 24 }}>
            <div className="row gap-3 mb-3">
              <div style={{ width: 56, height: 56, borderRadius: 18, background: '#e1f5f7', color: '#1f7a82', display: 'grid', placeItems: 'center' }}><I.bot/></div>
              <div>
                <div className="fw-700">Открыть @darsi_bot</div>
                <div className="muted text-sm">Привяжем аккаунт по защищённой ссылке</div>
              </div>
            </div>
            <button className="btn btn-lime full" style={{ justifyContent: 'center' }} onClick={onTg}><I.tg/> Открыть Telegram</button>
            <div className="text-xs muted mt-3">Если бот не открылся — <a className="link-btn">скопируйте ссылку</a></div>
          </div>
        ) : (
          <div className="card" style={{ padding: 24 }}>
            <div className="field">
              <label>Номер телефона</label>
              <input className="input input-lg" defaultValue="+7 999 123-45-67"/>
            </div>
            <button className="btn btn-primary full" style={{ justifyContent: 'center' }} onClick={onPhone}>Получить код в SMS</button>
            <div className="text-xs muted mt-3">Код придёт за ~30 секунд. Можем повторить через 60 секунд.</div>
          </div>
        )}
        <div className="text-xs muted mt-4">
          Продолжая, вы соглашаетесь с <a className="link-btn">Пользовательским соглашением</a> и <a className="link-btn">Политикой обработки ПД</a>.
        </div>
      </div>
      <div style={{ flex: 1, background: 'var(--c-robotics)', position: 'relative', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
        <div className="circuit"/>
        <div style={{ position: 'relative', width: '78%', maxWidth: 360 }}>
          <div className="card" style={{ background: '#fff', padding: 18, marginBottom: 14, transform: 'rotate(-2deg)' }}>
            <div className="row gap-3"><div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--c-arduino)', display:'grid', placeItems:'center' }}><I.chip/></div>
            <div><div className="fw-700 text-sm">Электроника на Arduino</div><div className="muted text-xs">Завтра, 18:00 · Зал 2</div></div></div>
          </div>
          <div className="card" style={{ background: '#fff', padding: 18, marginLeft: 30, transform: 'rotate(1.5deg)' }}>
            <div className="row gap-3"><div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--c-robotics)', display:'grid', placeItems:'center' }}><I.robot/></div>
            <div><div className="fw-700 text-sm">Робототехника. База</div><div className="muted text-xs">Артём · абонемент 6 / 9</div></div></div>
          </div>
          <div className="card" style={{ background: 'var(--ink)', color: '#fff', padding: 18, marginTop: 14, transform: 'rotate(-1deg)' }}>
            <div className="row gap-3"><div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--lime)', color:'var(--ink)', display:'grid', placeItems:'center' }}><I.bell/></div>
            <div><div className="fw-700 text-sm">Завтра занятие в 17:30</div><div style={{opacity:0.7}} className="text-xs">Артём придёт?</div></div></div>
            <div className="row gap-2 mt-3">
              <button className="btn btn-lime btn-sm" style={{ flex: 1, justifyContent: 'center' }}><I.check/> Придёт</button>
              <button className="btn btn-ghost btn-sm" style={{ background:'#fff', flex: 1, justifyContent: 'center' }}>Не придёт</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AuthVerify({ onDone }) {
  const [code, setCode] = useState(['', '', '', '']);
  const [consent, setConsent] = useState(true);
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div style={{ width: 460 }}>
        <button className="link-btn" style={{ marginBottom: 20 }}><I.back/> &nbsp;Назад</button>
        <div className="eyebrow">Подтверждение</div>
        <h1 style={{ fontSize: 36, margin: '8px 0 8px' }}>Введите код из SMS</h1>
        <p className="muted">Отправлен на <strong style={{ color: 'var(--ink)' }}>+7 999 123-45-67</strong>. <a className="link-btn">Изменить</a></p>
        <div className="row gap-3 mt-4 mb-4" style={{ justifyContent: 'center' }}>
          {code.map((v, i) => (
            <input key={i} className="input"
              style={{ width: 64, height: 76, textAlign: 'center', fontSize: 32, fontWeight: 700, fontFamily: 'var(--f-mono)' }}
              maxLength={1} value={v}
              onChange={(e) => {
                const nv = [...code]; nv[i] = e.target.value.slice(-1); setCode(nv);
              }}/>
          ))}
        </div>
        <div className="text-sm muted" style={{ textAlign: 'center', marginBottom: 24 }}>
          Не пришёл код? <a className="link-btn">Отправить ещё раз через 0:42</a>
        </div>
        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 14, background: '#fff', border: '1px solid var(--hairline)', borderRadius: 12, marginBottom: 16, cursor: 'pointer' }}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 2, width: 18, height: 18 }}/>
          <span className="text-sm" style={{ color: 'var(--ink-2)' }}>
            Я согласен на обработку персональных данных в соответствии с <a className="link-btn">152-ФЗ</a>. Данные хранятся на серверах в РФ.
          </span>
        </label>
        <button className="btn btn-primary full" style={{ justifyContent: 'center', opacity: consent ? 1 : 0.4, pointerEvents: consent ? 'auto' : 'none' }} onClick={onDone}>Войти в кабинет <I.arrow/></button>
      </div>
    </div>
  );
}

/* ============== MOBILE auth screens ============== */
function MAuthLanding({ onContinue }) {
  return (
    <div className="phone-content" style={{ paddingTop: 56 }}>
      <div style={{ padding: '20px 22px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="row gap-2">
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--ink)', color: 'var(--lime)', display: 'grid', placeItems: 'center', fontFamily: 'var(--f-mono)', fontWeight: 700 }}>D</div>
          <div className="fw-700">Дарси́</div>
        </div>
        <button className="btn btn-ghost btn-sm" style={{ background:'#fff' }}>Войти</button>
      </div>
      <div style={{ padding: '24px 22px 0' }}>
        <div className="eyebrow">Робоцентр</div>
        <h1 style={{ fontSize: 34, lineHeight: 1.08, letterSpacing: '-0.03em', fontWeight: 700, margin: '4px 0 12px' }}>
          Учим детей<br/>проектировать<br/><span style={{ background: 'var(--lime)', padding: '2px 12px', borderRadius: 12, display: 'inline-block', lineHeight: 1.0 }}>будущее</span>.
        </h1>
        <p className="muted text-sm" style={{ margin: '0 0 18px' }}>Записывайте детей на робототехнику, электронику и программирование — в одном месте.</p>
      </div>
      <div style={{ padding: '0 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {COURSES.slice(0,4).map(c => (
          <div key={c.id} className="course-card" style={{ background: c.color, minHeight: 130, padding: 14 }}>
            <div className="course-card-head">
              <div className="course-card-icon" style={{ width: 30, height: 30 }}>{c.icon}</div>
              <span className="rating-pill" style={{ padding: '3px 8px', fontSize: 11 }}><I.star/> {c.rating}</span>
            </div>
            <div className="fw-700 text-sm" style={{ marginTop: 8, letterSpacing: '-0.01em' }}>{c.title}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: '20px 22px 90px' }}>
        <button className="btn btn-lime full" style={{ justifyContent: 'center' }} onClick={onContinue}><I.tg/> Войти через Telegram</button>
        <button className="btn btn-ghost full mt-3" style={{ justifyContent: 'center', background: '#fff' }} onClick={onContinue}><I.phone/> По номеру телефона</button>
      </div>
    </div>
  );
}

function MAuthVerify({ onDone }) {
  const [code, setCode] = useState(['', '', '', '']);
  return (
    <div className="phone-content" style={{ paddingTop: 56 }}>
      <MobileHeader left={<button className="btn btn-ghost btn-icon" style={{background:'#fff'}}><I.back/></button>} right={<span/>} title="Код"/>
      <div style={{ padding: '8px 22px' }}>
        <h1 style={{ fontSize: 26, margin: '8px 0', letterSpacing: '-0.02em', fontWeight: 700 }}>Введите<br/>код из SMS</h1>
        <p className="muted text-sm">Отправлен на <strong style={{ color: 'var(--ink)' }}>+7 999 123-45-67</strong></p>
        <div className="row gap-2 mt-4 mb-4" style={{ justifyContent: 'space-between' }}>
          {code.map((v, i) => (
            <input key={i} className="input"
              style={{ width: 64, height: 72, textAlign: 'center', fontSize: 28, fontWeight: 700, fontFamily: 'var(--f-mono)' }}
              maxLength={1} value={v}
              onChange={(e) => { const nv = [...code]; nv[i] = e.target.value.slice(-1); setCode(nv); }}/>
          ))}
        </div>
        <div className="text-sm muted text-center" style={{ textAlign: 'center', marginBottom: 16 }}>
          Отправить ещё раз через <span className="mono">0:42</span>
        </div>
        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 14, background: '#fff', border: '1px solid var(--hairline)', borderRadius: 12, marginBottom: 14 }}>
          <input type="checkbox" defaultChecked style={{ marginTop: 2 }}/>
          <span className="text-xs" style={{ color: 'var(--ink-2)' }}>Согласен на обработку ПД (152-ФЗ).</span>
        </label>
        <button className="btn btn-primary full" style={{ justifyContent: 'center' }} onClick={onDone}>Войти <I.arrow/></button>
      </div>
    </div>
  );
}

window.AuthScreens = { AuthLanding, AuthLogin, AuthVerify, MAuthLanding, MAuthVerify };
