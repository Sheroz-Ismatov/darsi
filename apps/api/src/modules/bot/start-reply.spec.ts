import { buildStartReply } from './start-reply';

const TMA = 'https://darsi.example.com/';

describe('buildStartReply', () => {
  it('opens the Mini App and passes the payload as ?start=', () => {
    const reply = buildStartReply('demo', 'ru', TMA);

    expect(reply.text).toContain('Дарси');
    expect(reply.button).toEqual({ text: 'Открыть Дарси', url: `${TMA}?start=demo` });
  });

  it('answers in Tajik for Tajik-speaking users', () => {
    const reply = buildStartReply(undefined, 'tg', TMA);

    expect(reply.text).toContain('Ассалому алайкум');
    expect(reply.button).toEqual({ text: 'Кушодани Дарси', url: TMA });
  });

  it('falls back to Russian for other languages', () => {
    expect(buildStartReply(undefined, 'en', TMA).button?.text).toBe('Открыть Дарси');
  });

  it('drops payloads that are not a code or token', () => {
    expect(buildStartReply('<script>', 'ru', TMA).button?.url).toBe(TMA);
    // Underscores and capitals never appear in school codes; a bare prefix is not an invite.
    expect(buildStartReply('Demo_School', 'ru', TMA).button?.url).toBe(TMA);
    expect(buildStartReply('inv_', 'ru', TMA).button?.url).toBe(TMA);
  });

  it('greets invited people differently and passes the invite on', () => {
    const payload = `inv_${'a'.repeat(32)}`;
    const ru = buildStartReply(payload, 'ru', TMA);
    expect(ru.text).toContain('пригласили');
    expect(ru.button?.url).toBe(`${TMA}?start=${payload}`);

    expect(buildStartReply(payload, 'tg', TMA).text).toContain('даъват');
    expect(buildStartReply('demo', 'ru', TMA).text).not.toContain('пригласили');
  });

  it('explains that the app is unavailable when TMA_URL is missing', () => {
    expect(buildStartReply('demo', 'ru', undefined)).toEqual({
      text: 'Приложение временно недоступно. Попробуйте позже.',
    });
  });
});
