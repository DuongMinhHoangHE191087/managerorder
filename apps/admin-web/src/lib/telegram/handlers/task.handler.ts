/* eslint-disable @typescript-eslint/no-explicit-any */
// ============================================================
// TASK HANDLER — tasks, reminders, toggle done
// Migrated from legacy telegram-bot.service.ts
// ============================================================
import type { BotHandler } from '../bot-router';
import {
  supabaseAdmin,
  sendMsg, sendKb, editMsg, answerCallbackQuery, escapeHtml,
  type TelegramButton,
} from '../shared';
import { formatDateCustom } from "@/lib/utils";

// ─── /tasks — Task list with overdue/today/future ───────────

export const handleTasksCommand: BotHandler = async (ctx) => {
  const chatId = ctx.chatId;
  const accountId = ctx.accountId ?? '';
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7).toISOString();

  const [futureResult, overdueResult] = await Promise.all([
    supabaseAdmin.from('reminder_events')
      .select('id, title, due_at, type, is_done, notes')
      .eq('account_id', accountId)
      .gte('due_at', todayStart).lte('due_at', weekEnd)
      .order('due_at', { ascending: true }).limit(20),
    supabaseAdmin.from('reminder_events')
      .select('id, title, due_at, type, is_done, notes')
      .eq('account_id', accountId)
      .lt('due_at', todayStart).eq('is_done', false)
      .order('due_at', { ascending: false }).limit(10),
  ]);

  const events = futureResult.data ?? [];
  const overdueEvents = overdueResult.data ?? [];

  if (!events.length && !overdueEvents.length) {
    const msgText = '✅ Không có task nào!';
    const kb: TelegramButton[][] = [[{ text: '➕ Tạo task', callback_data: 'cmd:newtask' }, { text: '🏠 Menu', callback_data: 'cmd:start' }]];
    
    if (ctx.messageId && ctx.callbackQueryId) {
      await editMsg(chatId, ctx.messageId, msgText, kb);
    } else {
      await sendKb(chatId, msgText, kb);
    }
    return;
  }

  const countdown = (dueAt: string) => {
    const diff = new Date(dueAt).getTime() - now.getTime();
    if (diff < 0) { const hrs = Math.abs(Math.floor(diff / 3600000)); return `🔴 quá ${hrs}h`; }
    const hrs = Math.floor(diff / 3600000);
    if (hrs < 1) return `⚡ <${Math.ceil(diff / 60000)} phút`;
    if (hrs < 24) return `⏰ còn ${hrs}h`;
    return `📅 còn ${Math.ceil(hrs / 24)}d`;
  };

  const formatTask = (e: any, i: number) => {
    const icon = e.is_done ? '✅' : e.type === 'renewal' ? '🔄' : e.type === 'debt' ? '💳' : e.type === 'contact' ? '📞' : '📌';
    const done = e.is_done ? ' <s>DONE</s>' : '';
    const time = formatDateCustom(e.due_at, { timeZone: "Asia/Ho_Chi_Minh" }, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    return `<blockquote><b>${i + 1}.</b> ${icon} <b>${escapeHtml(e.title)}</b>${done}\n⏰ ${countdown(e.due_at)} | ${time}${e.notes ? `\n📝 ${escapeHtml(String(e.notes).slice(0, 40))}` : ''}</blockquote>`;
  };

  const todayTasks = events.filter((e: any) => e.due_at < todayEnd);
  const futureTasks = events.filter((e: any) => e.due_at >= todayEnd);

  const sections: string[] = [];
  if (overdueEvents.length) sections.push(`🔴 <b>QUÁ HẠN (${overdueEvents.length}):</b>\n${overdueEvents.map(formatTask).join('\n')}`);
  if (todayTasks.length) sections.push(`📌 <b>HÔM NAY (${todayTasks.length}):</b>\n${todayTasks.map(formatTask).join('\n')}`);
  if (futureTasks.length) sections.push(`📆 <b>SẮP TỚI (${futureTasks.length}):</b>\n${futureTasks.map(formatTask).join('\n')}`);

  const allTasks = [...overdueEvents, ...todayTasks, ...futureTasks];
  const toggleBtns: TelegramButton[][] = allTasks
    .filter(e => !e.is_done).slice(0, 5)
    .map(e => [{ text: `✅ ${e.title.slice(0, 20)}`, callback_data: `tdone:${e.id}` }]);

  const msgText = [
    `📋 <b>TASKS & LỊCH HẸN</b>`,
    ``,
    ...sections,
  ].join('\n\n');

  const btns = [
    ...toggleBtns,
    [{ text: '➕ Tạo task', callback_data: 'cmd:newtask' }, { text: '🏠 Menu', callback_data: 'cmd:start' }],
  ];

  if (ctx.messageId && ctx.callbackQueryId) {
    await editMsg(chatId, ctx.messageId, msgText, btns);
  } else {
    await sendKb(chatId, msgText, btns);
  }
};

// ─── Toggle task done ───────────────────────────────────────

export const handleTaskDoneAction: BotHandler = async (ctx) => {
  const chatId = ctx.chatId;
  const data = ctx.callbackData ?? '';
  const taskId = data.replace('tdone:', '');

  const { data: task } = await supabaseAdmin.from('reminder_events')
    .select('id, title, is_done').eq('id', taskId).single();
  if (!task) { await sendMsg(chatId, '❌ Task không tồn tại.'); return; }

  const newDone = !task.is_done;
  await supabaseAdmin.from('reminder_events').update({ is_done: newDone }).eq('id', taskId);
  
  if (ctx.callbackQueryId) {
    await answerCallbackQuery(ctx.callbackQueryId, `${newDone ? '✅ Hoàn thành' : '🔄 Mở lại'}: ${task.title}`);
  } else {
    await sendMsg(chatId, `${newDone ? '✅' : '🔄'} <b>${escapeHtml(task.title)}</b> → ${newDone ? 'Hoàn thành!' : 'Chưa xong'}`);
  }

  // Refresh task list
  await handleTasksCommand(ctx);
};
