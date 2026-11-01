// Development-only page: visual check of the design system against design/sample (T-04).
// Texts here are fixtures for designers, so they are not in the i18n dictionaries.
import { COURSE_COLORS, type AttendanceStatus } from '@darsi/shared';
import {
  AttDot,
  Avatar,
  AvatarStack,
  Button,
  Card,
  Chip,
  DarkCard,
  DateBlock,
  EmptyState,
  Eyebrow,
  Field,
  Input,
  KpiTile,
  PastelCard,
  ProgressBar,
  Segmented,
  Select,
  StatusBadge,
  Tag,
  Textarea,
} from '@darsi/ui';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Check, Moon, Plus, Sun, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { PageHeader } from '../../app/layout/PageHeader';
import { apiFetch } from '../../lib/api';

const TAJIK_LETTERS = 'Ғ ғ Ӣ ӣ Қ қ Ӯ ӯ Ҳ ҳ Ҷ ҷ';
const TAJIK_SAMPLE = 'Имрӯз 3 дарс. Ҳозир, ғоиб, узрнок. Қарз: 450 сомонӣ. Ҷадвали ҳафта.';
const CHECKED_FONTS = ['Onest', 'IBM Plex Mono'];

/** A glyph is missing if the text renders exactly as both fallbacks do. */
async function missingGlyphs(family: string, text: string): Promise<string[]> {
  await document.fonts.load(`48px "${family}"`, text);
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return [];
  const width = (font: string, ch: string) => {
    ctx.font = font;
    return ctx.measureText(ch).width;
  };
  return [...text.replace(/\s/g, '')].filter((ch) =>
    ['serif', 'monospace'].every(
      (fallback) => width(`48px "${family}", ${fallback}`, ch) === width(`48px ${fallback}`, ch),
    ),
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mt-0 mb-3.5 text-[22px] font-bold tracking-[-0.02em]">{title}</h2>
      {children}
    </section>
  );
}

function GlyphCheck() {
  const [result, setResult] = useState<Record<string, string[]> | null>(null);
  useEffect(() => {
    void Promise.all(CHECKED_FONTS.map((f) => missingGlyphs(f, TAJIK_LETTERS))).then((all) =>
      setResult(Object.fromEntries(CHECKED_FONTS.map((f, i) => [f, all[i] ?? []]))),
    );
  }, []);

  return (
    <Card>
      <div className="text-[32px] font-bold tracking-[-0.03em]">{TAJIK_LETTERS}</div>
      <div className="mt-1 text-[22px] font-bold tracking-[-0.02em]">{TAJIK_SAMPLE}</div>
      <div className="mt-1 text-[15px]">{TAJIK_SAMPLE}</div>
      <div className="mt-1 font-mono text-lg">{TAJIK_LETTERS}</div>
      <div className="mt-3 flex flex-wrap gap-2" data-testid="glyph-check">
        {result === null ? (
          <StatusBadge tone="info">Проверка…</StatusBadge>
        ) : (
          Object.entries(result).map(([family, missing]) => (
            <StatusBadge key={family} tone={missing.length ? 'danger' : 'ok'} dot>
              {family}: {missing.length ? `нет глифов ${missing.join(' ')}` : 'все глифы на месте'}
            </StatusBadge>
          ))
        )}
      </div>
    </Card>
  );
}

function ApiStatus() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => apiFetch<{ status: string }>('/health'),
    retry: false,
  });
  if (health.isPending) return <StatusBadge tone="info">API: проверка…</StatusBadge>;
  if (health.isError)
    return (
      <StatusBadge tone="danger" dot>
        API недоступно: {health.error.message}
      </StatusBadge>
    );
  return (
    <StatusBadge tone="ok" dot>
      API: {health.data.status}
    </StatusBadge>
  );
}

export function UiShowcasePage() {
  const [dark, setDark] = useState(false);
  const [attendance, setAttendance] = useState<AttendanceStatus>('present');
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [chip, setChip] = useState('all');

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [dark]);

  return (
    <>
      <PageHeader
        eyebrow="Дизайн-система · dev"
        title="Витрина компонентов"
        actions={
          <>
            <ApiStatus />
            <Button variant="ghost" onClick={() => setDark((v) => !v)}>
              {dark ? <Sun size={18} /> : <Moon size={18} />}
              {dark ? 'Светлая' : 'Тёмная'}
            </Button>
          </>
        }
      />

      <Section title="Таджикские буквы">
        <GlyphCheck />
      </Section>

      <Section title="Типографика">
        <Eyebrow>Четверг · 14 мая</Eyebrow>
        <div className="text-[56px] leading-[1.02] font-bold tracking-[-0.035em]">
          Сегодня — 3 занятия
        </div>
        <p className="text-ink-2">
          Основной текст 15 px. Вторичный — <span className="text-muted">приглушённый</span>.
        </p>
        <span className="font-mono text-xs text-muted">17:30 · 90 мин · 1 250 смн</span>
      </Section>

      <Section title="Кнопки">
        <div className="flex flex-wrap items-center gap-3">
          <Button>
            <Plus size={18} /> Создать курс
          </Button>
          <Button variant="lime">
            Сохранить отметку <Check size={18} />
          </Button>
          <Button variant="ghost">Отмена</Button>
          <Button size="sm">Маленькая</Button>
          <Button variant="ghost" size="icon" aria-label="Далее">
            <ArrowRight size={18} />
          </Button>
          <Button disabled>Недоступна</Button>
        </div>
      </Section>

      <Section title="KPI и пастели курсов">
        <div className="mb-4 grid grid-cols-3 gap-4">
          <KpiTile color="lime" label="Занятий на неделе" value="14" hint="из 16 запланированных" />
          <KpiTile
            color="lavender"
            label="Посещаемость"
            value="91%"
            hint="↑ +3% к прошлой неделе"
          />
          <KpiTile color="peach" label="Оплаты за месяц" value="7 840 смн" hint="23 оплаты" />
        </div>
        <div className="grid grid-cols-6 gap-3">
          {COURSE_COLORS.map((color) => (
            <PastelCard key={color} color={color} className="min-h-24 p-4">
              <div className="text-[15px] font-bold">{color}</div>
            </PastelCard>
          ))}
        </div>
      </Section>

      <Section title="Статусы, теги, фильтры">
        <div className="mb-3 flex flex-wrap gap-2">
          <StatusBadge tone="ok">Абонемент активен</StatusBadge>
          <StatusBadge tone="warn">Осталось 2 занятия</StatusBadge>
          <StatusBadge tone="danger">Долг 450 смн</StatusBadge>
          <StatusBadge tone="info" dot>
            Идёт сейчас
          </StatusBadge>
          <Tag>8–11 лет</Tag>
          <Tag className="font-mono font-medium">6 / 8</Tag>
        </div>
        <div className="flex gap-2">
          {['all', 'Английский', 'Математика', 'Шахматы'].map((name) => (
            <Chip key={name} active={chip === name} onClick={() => setChip(name)}>
              {name === 'all' ? 'Все' : name}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="Отметка посещения">
        <div className="grid grid-cols-2 gap-4">
          <Card className="flex items-center justify-between p-3.5">
            <div className="flex items-center gap-3">
              <Avatar name="Фарзона Каримова" size={40} />
              <div>
                <div className="font-bold">Фарзона Каримова</div>
                <div className="text-[13px] text-muted">абонемент 6 / 8</div>
              </div>
            </div>
            <Segmented
              label="Посещение"
              size="lg"
              className="w-[300px]"
              value={attendance}
              onChange={setAttendance}
              options={[
                {
                  value: 'present',
                  label: (
                    <>
                      <Check size={16} /> Был
                    </>
                  ),
                },
                {
                  value: 'absent',
                  label: (
                    <>
                      <X size={16} /> Пропуск
                    </>
                  ),
                },
                { value: 'excused', label: 'Уваж.' },
              ]}
            />
          </Card>
          <Segmented
            label="Период"
            className="w-[300px] self-center"
            value={period}
            onChange={setPeriod}
            options={[
              { value: 'week', label: 'Неделя' },
              { value: 'month', label: 'Месяц' },
              { value: 'year', label: 'Год' },
            ]}
          />
        </div>
      </Section>

      <Section title="Формы">
        <div className="grid max-w-2xl grid-cols-2 gap-x-4">
          <Field label="Название курса" htmlFor="f-name">
            <Input id="f-name" placeholder="Английский для детей" />
          </Field>
          <Field label="Цвет" htmlFor="f-color">
            <Select id="f-color" defaultValue="lime">
              {COURSE_COLORS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Телефон" htmlFor="f-phone" error="Неверный формат номера">
            <Input id="f-phone" aria-invalid defaultValue="+992 90" />
          </Field>
          <Field label="Описание" htmlFor="f-desc" hint="Видно родителям в каталоге">
            <Textarea id="f-desc" rows={2} />
          </Field>
        </div>
      </Section>

      <Section title="Абонемент, ученики, занятия">
        <div className="grid grid-cols-3 gap-4">
          <PastelCard color="lime">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-bold">Абонемент</span>
              <StatusBadge tone="ok">Активен</StatusBadge>
            </div>
            <div className="mb-3 flex items-baseline gap-1">
              <span className="text-4xl font-bold tracking-[-0.03em]">6</span>
              <span className="text-ink/60">/ 8 занятий</span>
            </div>
            <ProgressBar
              value={6}
              max={8}
              label="Использовано 6 из 8 занятий"
              className="bg-ink/10"
            />
            <div className="mt-2 flex justify-between text-xs">
              <span>До 30 ноября</span>
              <span className="font-bold">Осталось: 2</span>
            </div>
          </PastelCard>

          <Card className="flex flex-col gap-3">
            <AvatarStack>
              {['Амир', 'Сабрина', 'Далер', 'Мехрона', 'Шахзод'].map((n) => (
                <Avatar key={n} name={n} size={30} />
              ))}
            </AvatarStack>
            <div className="flex items-center gap-2 text-sm">
              <AttDot state="present" label="Был" />
              <AttDot state="present" label="Был" />
              <AttDot state="absent" label="Пропуск" />
              <AttDot state="unknown" label="Не отмечено" />
              <span className="text-muted">история посещений</span>
            </div>
          </Card>

          <Card className="flex items-center gap-3.5 p-3.5">
            <DateBlock day={14} caption="чт" />
            <div className="min-w-0 flex-1">
              <div className="font-mono text-xs text-muted">17:30</div>
              <div className="text-sm font-bold">Английский. Группа A1</div>
              <div className="text-xs text-muted">Каб. 2 · Мадина Р.</div>
            </div>
            <StatusBadge tone="info">Скоро</StatusBadge>
          </Card>
        </div>
      </Section>

      <Section title="Тёмная карточка и пустое состояние">
        <div className="grid grid-cols-2 gap-4">
          <DarkCard>
            <Eyebrow className="text-on-ink/60">Ближайшее занятие</Eyebrow>
            <div className="text-lg font-bold">Математика · 17:30</div>
            <div className="text-sm opacity-70">Амир · Каб. 3</div>
            <div className="mt-3 flex gap-2">
              <Button variant="lime" size="sm">
                Подробнее
              </Button>
            </div>
          </DarkCard>
          <EmptyState
            title="Заявок пока нет"
            text="Когда родители запишутся через Telegram, заявки появятся здесь."
            action={<Button size="sm">Скопировать ссылку школы</Button>}
          />
        </div>
      </Section>
    </>
  );
}
