import { CallbackContext } from "../core/Context";
import type { Application } from "../core/Application";
import type { Update } from "../models/Update";
import type { Handler, HandlerCallback } from "./BaseHandler";

export class CommandHandler implements Handler {
  constructor(
    private readonly command: string,
    private readonly callback: HandlerCallback,
  ) {}

  checkUpdate(update: Update): boolean {
    return update.command?.name.toLowerCase() === this.command.toLowerCase();
  }

  async handleUpdate(update: Update, application: Application): Promise<void> {
    const command = update.command;
    await this.callback(update, new CallbackContext(application, command?.args ?? [], command));
  }
}
