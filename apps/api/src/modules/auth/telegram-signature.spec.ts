import {
  nowSeconds,
  signInitData,
  signLoginWidget,
  TEST_BOT_TOKEN,
} from '../../../test/helpers/telegram-signing';
import { TelegramSignatureError, verifyInitData, verifyLoginWidget } from './telegram-signature';

const user = { id: 42, first_name: 'Фарзона', username: 'farzona', language_code: 'tg' };

function failure(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    if (error instanceof TelegramSignatureError) return error.reason;
    throw error;
  }
  return undefined;
}

describe('verifyInitData', () => {
  it('accepts correctly signed data and returns the user and start param', () => {
    const initData = signInitData({
      user,
      auth_date: nowSeconds(),
      query_id: 'AAH',
      start_param: 'demo',
    });

    const result = verifyInitData(initData, TEST_BOT_TOKEN);

    expect(result.user).toMatchObject({ id: 42, first_name: 'Фарзона', language_code: 'tg' });
    expect(result.startParam).toBe('demo');
  });

  it('rejects a tampered field', () => {
    const initData = signInitData({ user, auth_date: nowSeconds() }).replace('42', '43');
    expect(failure(() => verifyInitData(initData, TEST_BOT_TOKEN))).toBe('INVALID');
  });

  it('rejects data signed with another bot token', () => {
    const initData = signInitData({ user, auth_date: nowSeconds() }, '1:another-token');
    expect(failure(() => verifyInitData(initData, TEST_BOT_TOKEN))).toBe('INVALID');
  });

  it('rejects data without hash', () => {
    expect(failure(() => verifyInitData('auth_date=1&user=%7B%7D', TEST_BOT_TOKEN))).toBe(
      'INVALID',
    );
  });

  it('rejects data older than 24 hours', () => {
    const initData = signInitData({ user, auth_date: nowSeconds() - 24 * 3600 - 60 });
    expect(failure(() => verifyInitData(initData, TEST_BOT_TOKEN))).toBe('EXPIRED');
  });

  it('rejects signed data without a valid user', () => {
    const initData = signInitData({ user: { first_name: 'x' }, auth_date: nowSeconds() });
    expect(failure(() => verifyInitData(initData, TEST_BOT_TOKEN))).toBe('INVALID');
  });
});

describe('verifyLoginWidget', () => {
  const fields = { id: 42, first_name: 'Мадина', username: 'madina', auth_date: nowSeconds() };

  it('accepts correctly signed widget data', () => {
    const result = verifyLoginWidget(signLoginWidget(fields), TEST_BOT_TOKEN);
    expect(result.user).toMatchObject({ id: 42, first_name: 'Мадина', username: 'madina' });
  });

  it('rejects a changed field', () => {
    const signed = signLoginWidget(fields);
    expect(failure(() => verifyLoginWidget({ ...signed, id: 43 }, TEST_BOT_TOKEN))).toBe(
      'INVALID',
    );
  });

  it('rejects expired widget data', () => {
    const signed = signLoginWidget({ ...fields, auth_date: nowSeconds() - 2 * 24 * 3600 });
    expect(failure(() => verifyLoginWidget(signed, TEST_BOT_TOKEN))).toBe('EXPIRED');
  });

  it('does not accept a Mini App signature as a widget signature', () => {
    const params = new URLSearchParams(signInitData({ user, auth_date: nowSeconds() }));
    const data = Object.fromEntries(params.entries());
    expect(failure(() => verifyLoginWidget(data, TEST_BOT_TOKEN))).toBe('INVALID');
  });
});
