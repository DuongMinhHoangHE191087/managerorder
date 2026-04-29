import { type Locator, type Page } from "@playwright/test";

export class CalendarPage {
  readonly page: Page;
  readonly calendarGrid: Locator;
  readonly todayButton: Locator;
  readonly prevMonthButton: Locator;
  readonly nextMonthButton: Locator;
  readonly monthLabel: Locator;
  readonly addTaskButton: Locator;
  readonly taskItems: Locator;
  readonly taskCheckboxes: Locator;

  constructor(page: Page) {
    this.page = page;
    this.calendarGrid = page.locator("[data-testid='calendar-grid'], .calendar-grid, .react-calendar, [role='grid']");
    this.todayButton = page.locator("[data-testid='today-button'], button:has-text('Hôm nay'), button:has-text('Today')");
    this.prevMonthButton = page.locator("[data-testid='prev-month']").or(page.getByRole("button", { name: /trước|previous/i })).first();
    this.nextMonthButton = page.locator("[data-testid='next-month']").or(page.getByRole("button", { name: /sau|next/i })).first();
    this.monthLabel = page.locator("[data-testid='month-label'], .month-label, h2, h3");
    this.addTaskButton = page.locator("[data-testid='add-task'], button:has-text('Thêm'), button:has-text('Tạo ghi chú'), button:has-text('Add')");
    this.taskItems = page.locator("[data-testid='task-item'], .task-item, .calendar-note");
    this.taskCheckboxes = page.locator("[data-testid='task-checkbox'], .task-checkbox, input[type='checkbox']");
  }

  async goto() {
    await this.page.request.get("/api/auth/session/me", { timeout: 10_000 }).catch(() => null);

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        await this.page.goto("/calendar", { waitUntil: "domcontentloaded", timeout: 45_000 });
        break;
      } catch (error) {
        if (attempt === 2) {
          throw error;
        }
        await this.page.waitForTimeout(1_000);
      }
    }

    await this.page.getByRole("heading", { name: /lịch|calendar/i }).first().waitFor({
      state: "visible",
      timeout: 20_000,
    });
  }

  async waitForCalendar() {
    await this.calendarGrid.first().waitFor({ state: "visible", timeout: 20_000 });
    await this.monthLabel.first().waitFor({ state: "visible", timeout: 20_000 });
  }

  async getVisibleTaskCount(): Promise<number> {
    return this.taskItems.count();
  }

  async navigateNextMonth() {
    await this.nextMonthButton.click();
    await this.page.waitForTimeout(300);
  }

  async navigatePrevMonth() {
    await this.prevMonthButton.click();
    await this.page.waitForTimeout(300);
  }

  async clickToday() {
    await this.todayButton.first().click();
    await this.page.waitForTimeout(300);
  }
}
