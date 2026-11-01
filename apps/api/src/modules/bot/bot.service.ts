import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { I18N_RESOURCES } from '@darsi/shared';
import { Bot, InlineKeyboard } from 'grammy';
import { ENV } from '../../common/config/config.module';
import type { Env } from '../../common/config/env';
import { buildStartReply } from './start-reply';

/** Telegram bot: entry point to the Mini App. Notifications are added in T-38. */
@Injectable()
export class BotService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(BotService.name);
  readonly bot: Bot;

  constructor(@Inject(ENV) private readonly env: Env) {
    // Creating the client does no network calls; they start in onApplicationBootstrap.
    this.bot = new Bot(env.BOT_TOKEN);
    this.bot.command('start', async (ctx) => {
      const reply = buildStartReply(ctx.match || undefined, ctx.from?.language_code, env.TMA_URL);
      await ctx.reply(reply.text, {
        reply_markup: reply.button
          ? new InlineKeyboard().webApp(reply.button.text, reply.button.url)
          : undefined,
      });
    });
    this.bot.catch((error) =>
      this.logger.error(error.error, `Update ${error.ctx.update.update_id}`),
    );
  }

  async onApplicationBootstrap(): Promise<void> {
    if (this.env.BOT_MODE !== 'polling') return;

    if (this.env.TMA_URL) {
      await this.bot.api.setChatMenuButton({
        menu_button: {
          type: 'web_app',
          text: I18N_RESOURCES.ru.translation.bot.menuButton,
          web_app: { url: this.env.TMA_URL },
        },
      });
    } else {
      this.logger.warn('TMA_URL is not set: the bot cannot open the Mini App');
    }

    // Long polling for development; production switches to a webhook (T-40).
    void this.bot
      .start({
        drop_pending_updates: true,
        onStart: (me) => this.logger.log(`Bot @${me.username} is polling for updates`),
      })
      .catch((error: unknown) => this.logger.error(error, 'Bot polling stopped'));
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.bot.isRunning()) {
      await this.bot.stop();
    }
  }
}
