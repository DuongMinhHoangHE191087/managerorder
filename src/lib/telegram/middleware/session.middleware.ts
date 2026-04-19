/* eslint-disable @typescript-eslint/no-explicit-any */
import type { BotMiddleware } from '../bot-router';
import { getCache, setCache, deleteCache } from '@/lib/redis/client';
import { SESSION_TTL } from '@/lib/services/telegram-bot.helpers';
import type { WizardSession } from '@/lib/services/telegram-bot.helpers';

export const sessionMiddleware: BotMiddleware = async (ctx, next) => {
  const { chatId } = ctx;
  const sessionKey = `telegram:session:${chatId}`;

  // Allow users to explicitly cancel active sessions
  if (ctx.command === 'cancel' || ctx.callbackData === 'cmd:cancel') {
    await deleteCache(sessionKey);
    ctx.state.sessionCleared = true;
    return await next(); // let the router handle the cancel output
  }

  // Load session from cache
  const session = await getCache<WizardSession>(sessionKey);
  if (session) {
    ctx.state.session = session;
  }

  // Provide session helper functions in ctx.state
  ctx.state.setSession = async (command: string, step: number, data: Record<string, any>) => {
    const newSession: WizardSession = {
      command,
      step,
      data,
      createdAt: Date.now()
    };
    await setCache(sessionKey, newSession, Math.floor(SESSION_TTL / 1000));
    ctx.state.session = newSession;
  };

  ctx.state.clearSession = async () => {
    await deleteCache(sessionKey);
    ctx.state.session = undefined;
  };

  await next();
};
