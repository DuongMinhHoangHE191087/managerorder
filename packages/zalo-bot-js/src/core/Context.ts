import type { Bot } from "./Bot";
import type { Application } from "./Application";
import type { ParsedCommand } from "../models/Update";

export class CallbackContext {
  readonly bot: Bot;
  readonly args: string[];
  readonly command?: ParsedCommand;

  constructor(
    public readonly application: Application,
    args: string[] = [],
    command?: ParsedCommand,
  ) {
    this.bot = application.bot;
    this.args = args;
    this.command = command;
  }
}
