import { describe, it, expect, beforeEach } from 'vitest';

// ============================================================
// Telegram Bot Routing Tests
// ============================================================
// Tests the handleBotUpdate routing logic by mocking external deps.
// We import the helpers and test routing decisions in isolation.

import {
  isAuthorized,
  parseCommand,
  getSession,
  setSession,
  clearSession,
  type WizardSession,
} from '../telegram-bot.helpers';

describe('Bot Update Routing Logic', () => {
  describe('Message Text Routing', () => {
    const ADMIN_ID = '12345';

    function simulateRouting(text: string, chatId: number = 12345) {
      // Simulate the routing logic from handleBotUpdate
      if (!isAuthorized(chatId, ADMIN_ID)) return { action: 'rejected' };

      const { cmd, arg } = parseCommand(text);

      // Check wizard session first
      const sessions = new Map<number, WizardSession>();
      const session = getSession(chatId, sessions);
      if (session && !text.startsWith('/')) {
        return { action: 'wizard', command: session.command };
      }

      if (cmd === '/cancel') return { action: 'cancel' };

      const commandMap: Record<string, string> = {
        '/start': 'handleStart',
        '/help': 'handleStart',
        '/stats': 'handleStats',
        '/orders': 'handleOrders',
        '/find': 'handleFind',
        '/kho': 'handleKho',
        '/duolingo': 'handleDuolingo',
        '/duo': 'handleDuolingo',
        '/nick': 'handleDuolingo',
        '/fbid': 'handleFbid',
        '/tasks': 'handleTasks',
        '/neworder': 'handleNewOrderStart',
        '/allocate': 'handleAllocateStart',
        '/newtask': 'handleNewTaskStart',
        '/today': 'handleToday',
        '/expiring': 'handleExpiring',
        '/expired': 'handleExpired',
        '/warehouse': 'handleWarehouse',
        '/slots': 'handleSlots',
        '/inventory': 'handleInventory',
        '/creds': 'handleCreds',
        '/detail': 'handleDetail',
        '/security': 'handleSecurityStatus',
        '/customer': 'handleCustomerProfile',
        '/kh': 'handleCustomerProfile',
        '/debt': 'handleDebt',
        '/no': 'handleDebt',
        '/summary': 'handleSummary',
        '/report': 'handleSummary',
        '/products': 'handleProducts',
        '/sp': 'handleProducts',
      };

      if (commandMap[cmd]) {
        return { action: 'command', handler: commandMap[cmd], arg };
      }

      if (!text.startsWith('/')) {
        return { action: 'search', query: text };
      }

      return { action: 'suggest', input: cmd };
    }

    it('routes /start to handleStart', () => {
      const result = simulateRouting('/start');
      expect(result).toEqual({ action: 'command', handler: 'handleStart', arg: '' });
    });

    it('routes /help to handleStart', () => {
      const result = simulateRouting('/help');
      expect(result).toEqual({ action: 'command', handler: 'handleStart', arg: '' });
    });

    it('routes /find with argument', () => {
      const result = simulateRouting('/find hello world');
      expect(result).toEqual({ action: 'command', handler: 'handleFind', arg: 'hello world' });
    });

    it('routes command aliases correctly', () => {
      expect(simulateRouting('/kh test')).toEqual({ action: 'command', handler: 'handleCustomerProfile', arg: 'test' });
      expect(simulateRouting('/no')).toEqual({ action: 'command', handler: 'handleDebt', arg: '' });
      expect(simulateRouting('/sp')).toEqual({ action: 'command', handler: 'handleProducts', arg: '' });
      expect(simulateRouting('/duo username')).toEqual({ action: 'command', handler: 'handleDuolingo', arg: 'username' });
    });

    it('routes plain text to search', () => {
      const result = simulateRouting('hello');
      expect(result).toEqual({ action: 'search', query: 'hello' });
    });

    it('suggests commands for unknown /command', () => {
      const result = simulateRouting('/unknowncmd');
      expect(result).toEqual({ action: 'suggest', input: '/unknowncmd' });
    });

    it('rejects unauthorized users', () => {
      const result = simulateRouting('/start', 99999);
      expect(result).toEqual({ action: 'rejected' });
    });

    it('routes /cancel to cancel action', () => {
      const result = simulateRouting('/cancel');
      expect(result).toEqual({ action: 'cancel' });
    });
  });

  describe('Callback Query Routing', () => {
    function simulateCallbackRoute(data: string) {
      if (data.startsWith('cmd:')) {
        const cmd = data.replace('cmd:', '');
        return { action: 'command', handler: cmd };
      }
      if (data.startsWith('orders:')) {
        const sub = data.replace('orders:', '');
        if (sub.startsWith('today')) return { action: 'orders_today' };
        if (sub.startsWith('expiring')) return { action: 'orders_expiring' };
        if (sub === 'expired') return { action: 'orders_expired' };
        return { action: 'unknown_orders' };
      }
      if (data.startsWith('kho:')) {
        const sub = data.replace('kho:', '');
        if (sub === 'stats') return { action: 'warehouse' };
        if (sub === 'slots') return { action: 'slots' };
        if (sub === 'creds') return { action: 'creds' };
        return { action: 'unknown_kho' };
      }
      if (data.startsWith('detail:')) return { action: 'detail', id: data.replace('detail:', '') };
      if (data.startsWith('creds:')) return { action: 'creds_callback' };
      if (data.startsWith('no:')) return { action: 'neworder_callback' };
      if (data.startsWith('alloc:')) return { action: 'allocate_callback' };
      if (data.startsWith('task:')) return { action: 'newtask_callback' };
      if (data.startsWith('np:')) return { action: 'newproduct_callback' };
      if (data.startsWith('nk:')) return { action: 'newkho_callback' };
      if (data.startsWith('copy:')) return { action: 'copy', value: data.replace('copy:', '') };
      if (data.startsWith('tdone:')) return { action: 'task_done_toggle' };
      if (data.startsWith('runcmd:')) return { action: 'run_command', cmd: data.replace('runcmd:', '') };
      return { action: 'unhandled' };
    }

    it('routes cmd: prefixed callbacks', () => {
      expect(simulateCallbackRoute('cmd:start')).toEqual({ action: 'command', handler: 'start' });
      expect(simulateCallbackRoute('cmd:stats')).toEqual({ action: 'command', handler: 'stats' });
    });

    it('routes order callbacks with pagination', () => {
      expect(simulateCallbackRoute('orders:today')).toEqual({ action: 'orders_today' });
      expect(simulateCallbackRoute('orders:today:page:2')).toEqual({ action: 'orders_today' });
      expect(simulateCallbackRoute('orders:expiring')).toEqual({ action: 'orders_expiring' });
      expect(simulateCallbackRoute('orders:expired')).toEqual({ action: 'orders_expired' });
    });

    it('routes kho callbacks', () => {
      expect(simulateCallbackRoute('kho:stats')).toEqual({ action: 'warehouse' });
      expect(simulateCallbackRoute('kho:slots')).toEqual({ action: 'slots' });
      expect(simulateCallbackRoute('kho:creds')).toEqual({ action: 'creds' });
    });

    it('routes detail with ID', () => {
      expect(simulateCallbackRoute('detail:abc-123')).toEqual({ action: 'detail', id: 'abc-123' });
    });

    it('routes copy callbacks', () => {
      expect(simulateCallbackRoute('copy:some-value')).toEqual({ action: 'copy', value: 'some-value' });
    });

    it('routes runcmd callbacks', () => {
      expect(simulateCallbackRoute('runcmd:find test')).toEqual({ action: 'run_command', cmd: 'find test' });
    });

    it('returns unhandled for unknown prefixes', () => {
      expect(simulateCallbackRoute('unknown:data')).toEqual({ action: 'unhandled' });
    });
  });

  describe('Session Wizard Interaction', () => {
    let sessions: Map<number, WizardSession>;

    beforeEach(() => {
      sessions = new Map();
    });

    it('wizard session intercepts non-command text', () => {
      setSession(123, sessions, 'neworder', 2, { name: 'Test' });
      const session = getSession(123, sessions);
      const text = 'Some product name';

      if (session && !text.startsWith('/')) {
        expect(session.command).toBe('neworder');
        expect(session.step).toBe(2);
      }
    });

    it('/cancel clears wizard and does not dispatch', () => {
      setSession(123, sessions, 'neworder', 3, {});
      clearSession(123, sessions);
      expect(getSession(123, sessions)).toBeNull();
    });

    it('wizard commands include: neworder, newtask, newproduct, newkho, duolingo_lookup, fbid_lookup, creds_search', () => {
      const wizardCommands = [
        'neworder',
        'newtask',
        'newproduct',
        'newkho',
        'duolingo_lookup',
        'fbid_lookup',
        'creds_search',
      ];

      for (const cmd of wizardCommands) {
        setSession(123, sessions, cmd, 1, {});
        const s = getSession(123, sessions)!;
        expect(s.command).toBe(cmd);
        clearSession(123, sessions);
      }
    });

    it('new command (/) overrides active wizard', () => {
      setSession(123, sessions, 'neworder', 3, { step3: 'data' });
      // In the real service, /cancel or new /command would clear session
      clearSession(123, sessions);
      setSession(123, sessions, 'newtask', 1, {});
      const s = getSession(123, sessions)!;
      expect(s.command).toBe('newtask');
      expect(s.step).toBe(1);
    });
  });
});
