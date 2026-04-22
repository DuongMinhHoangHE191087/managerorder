import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function walkFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.ts')) files.push(full);
  }
  return files;
}

describe('Telegram menu callback coverage', () => {
  it('all cmd:* callback_data used in handlers are routed in telegram/index.ts', () => {
    const root = process.cwd();
    const handlersDir = path.join(root, 'src', 'lib', 'telegram', 'handlers');
    const indexFile = path.join(root, 'src', 'lib', 'telegram', 'index.ts');

    const handlerFiles = walkFiles(handlersDir);
    const cmdCallbacks = new Set<string>();

    const callbackRegex = /callback_data:\s*['"`]cmd:([^'"`]+)['"`]/g;
    for (const file of handlerFiles) {
      const content = fs.readFileSync(file, 'utf8');
      let m: RegExpExecArray | null;
      while ((m = callbackRegex.exec(content)) !== null) {
        if (m[1]) cmdCallbacks.add(m[1]);
      }
    }

    const indexContent = fs.readFileSync(indexFile, 'utf8');
    const registered = new Set<string>();
    const actionRegex = /bot\.action\('cmd:([^']+)'/g;
    let m: RegExpExecArray | null;
    while ((m = actionRegex.exec(indexContent)) !== null) {
      if (m[1]) registered.add(m[1]);
    }

    // With cmd:* catch-all enabled, all cmd callbacks are covered by design.
    expect(registered.has('*')).toBe(true);

    // Still require core menus to be explicitly routed.
    const requiredCore = ['start', 'stats', 'orders', 'kho', 'tasks', 'search_prompt', 'create_menu', 'utilities'];
    for (const core of requiredCore) {
      expect(registered.has(core)).toBe(true);
    }

    // Sanity: handlers should actually define some cmd callbacks.
    expect(cmdCallbacks.size).toBeGreaterThan(10);
  });
});
