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
    const reply = buildStartReply('<script>', 'ru', TMA);
    expect(reply.button?.url).toBe(TMA);
  });

  it('explains that the app is unavailable when TMA_URL is missing', () => {
    expect(buildStartReply('demo', 'ru', undefined)).toEqual({
      text: 'Приложение временно недоступно. Попробуйте позже.',
    });
  });
});
