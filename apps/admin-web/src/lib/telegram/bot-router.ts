/* eslint-disable @typescript-eslint/no-explicit-any */
import type { TelegramUpdate } from '@/lib/services/telegram-bot.helpers';

export type BotContext = {
  update: TelegramUpdate;
  chatId: number;
  messageId?: number;
  callbackQueryId?: string;
  userId: number;
  text?: string;
  command?: string; // command without the slash, e.g. "start" for "/start"
  args?: string; // everything after the command
  callbackData?: string;
  state: Record<string, any>;
  accountId?: string;
};

export type BotMiddleware = (ctx: BotContext, next: () => Promise<void>) => Promise<void>;
export type BotHandler = (ctx: BotContext) => Promise<void>;

export class BotRouter {
  private middlewares: BotMiddleware[] = [];
  private commandHandlers: Map<string, BotHandler> = new Map();
  private callbackHandlers: Map<string, BotHandler> = new Map();
  private textHandlers: Map<string, BotHandler> = new Map();
  private callbackPrefixHandlers: { prefix: string; handler: BotHandler }[] = [];
  private fallbackHandler?: BotHandler;

  /**
   * Register a middleware to intercept updates before routing.
   * Call `await next()` to pass control to the next middleware or handler.
   */
  use(middleware: BotMiddleware) {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Register a handler for one or more commands (without the '/' prefix).
   */
  command(cmd: string | string[], handler: BotHandler) {
    const cmds = Array.isArray(cmd) ? cmd : [cmd];
    for (const c of cmds) {
      this.commandHandlers.set(c.toLowerCase(), handler);
    }
    return this;
  }

  /**
   * Register a handler for exact text matches (e.g. from ReplyKeyboardMarkup).
   */
  text(matchText: string | string[], handler: BotHandler) {
    const texts = Array.isArray(matchText) ? matchText : [matchText];
    for (const t of texts) {
      this.textHandlers.set(t, handler);
    }
    return this;
  }

  /**
   * Register a handler for callback queries.
   * Use trailing `:.*` or just `:*` prefix string (e.g. `orders:*`) to match by prefix.
   */
  action(trigger: string, handler: BotHandler) {
    if (trigger.endsWith(':*')) {
      this.callbackPrefixHandlers.push({
        prefix: trigger.slice(0, -2), // remove :*
        handler,
      });
    } else {
      this.callbackHandlers.set(trigger, handler);
    }
    return this;
  }

  /**
   * Register a fallback handler for text messages that don't match any command.
   */
  fallback(handler: BotHandler) {
    this.fallbackHandler = handler;
    return this;
  }

  getDebugSnapshot() {
    return {
      middlewareCount: this.middlewares.length,
      commands: [...this.commandHandlers.keys()].sort(),
      actions: [...this.callbackHandlers.keys()].sort(),
      actionPrefixes: this.callbackPrefixHandlers.map((entry) => entry.prefix).sort(),
      texts: [...this.textHandlers.keys()].sort(),
      hasFallback: Boolean(this.fallbackHandler),
    };
  }

  /**
   * Process an incoming Telegram update through the router.
   */
  async processUpdate(update: TelegramUpdate): Promise<void> {
    const isCallback = !!update.callback_query;
    const message = update.message;
    const from = isCallback ? update.callback_query?.from : message?.from;
    const chat = isCallback ? update.callback_query?.message?.chat : message?.chat;
    const msgObj = isCallback ? update.callback_query?.message : message;

    if (!from || !chat) return; // Ignore updates without user/chat context

    const ctx: BotContext = {
      update,
      chatId: chat.id,
      messageId: msgObj?.message_id,
      callbackQueryId: update.callback_query?.id,
      userId: from.id,
      state: {},
    };

    let handler: BotHandler | undefined;

    if (isCallback) {
      const data = update.callback_query?.data;
      if (data) {
        ctx.callbackData = data;
        handler = this.callbackHandlers.get(data);
        if (!handler) {
          const prefixHandler = this.callbackPrefixHandlers.find(p => data.startsWith(p.prefix));
          if (prefixHandler) {
            handler = prefixHandler.handler;
          }
        }
      }
      // If no registered callback handler matched, fall through to fallback
      if (!handler) {
        handler = this.fallbackHandler;
      }
    } else if (message?.text) {
      const text = message.text.trim();
      ctx.text = text;
      
      // Check exact text match first
      handler = this.textHandlers.get(text);

      if (!handler) {
        const parts = text.split(/\s+/);
        const firstWord = parts[0].toLowerCase();
        
        if (firstWord.startsWith('/')) {
          ctx.command = firstWord.substring(1); // remove '/'
          ctx.args = parts.slice(1).join(' ');
          handler = this.commandHandlers.get(ctx.command);
        }
      }
      
      // If no command handler matched, or it wasn't a command
      if (!handler) {
        handler = this.fallbackHandler;
      }
    } else {
      // Non-text message
      handler = this.fallbackHandler;
    }

    // Execute middleware chain and then handler
    let index = -1;
    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) throw new Error('next() called multiple times');
      index = i;
      if (i < this.middlewares.length) {
        await this.middlewares[i](ctx, () => dispatch(i + 1));
      } else if (handler) {
        await handler(ctx);
      }
    };

    try {
      await dispatch(0);
    } catch (err) {
      console.error('[BotRouter] Unhandled error during update processing:', err);
      throw err; // Propagate up if needed
    }
  }
}
