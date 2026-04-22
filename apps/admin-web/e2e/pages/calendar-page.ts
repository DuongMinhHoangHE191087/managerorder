/**
 * Page Object — Calendar Page
 *
 * Encapsulates selectors and actions for the calendar/tasks page.
 */
import { type Page, type Locator } from "@playwright/test";

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
    this.calendarGrid = page.locator(
      "[data-testid='calendar-grid'], .calendar-grid, .react-calendar, [role='grid']"
    );
    this.todayButton = page.locator(
      "button:has-text('Hôm nay'), button:has-text('Today'), [data-testid='today-button']"
    );
    this.prevMonthButton = page.locator(
      "button[aria-label='Previous month'], button:has-text('←'), [data-testid='prev-month']"
    );
    this.nextMonthButton = page.locator(
      "button[aria-label='Next month'], button:has-text('→'), [data-testid='next-month']"
    );
    this.monthLabel = page.locator(
      "[data-testid='month-label'], .month-label, h2, h3"
    );
    this.addTaskButton = page.locator(
      "button:has-text('Thêm'), button:has-text('Tạo ghi chú'), button:has-text('Add'), [data-testid='add-task']"
    );
    this.taskItems = page.locator(
      "[data-testid='task-item'], .task-item, .calendar-note"
    );
    this.taskCheckboxes = page.locator(
      "[data-testid='task-checkbox'], .task-checkbox, input[type='checkbox']"
    );
  }

  async goto() {
    await this.page.goto("/calendar");
    await this.page.waitForLoadState("networkidle");
  }

  async waitForCalendar() {
    // Wait for any calendar content to load
    await this.page.waitForLoadState("networkidle");
    await this.page.waitForTimeout(1_000);
  }

  async getVisibleTaskCount(): Promise<number> {
    return this.taskItems.count();
  }

  async navigateNextMonth() {
    await this.nextMonthButton.first().click();
    await this.page.waitForLoadState("networkidle");
  }

  async navigatePrevMonth() {
    await this.prevMonthButton.first().click();
    await this.page.waitForLoadState("networkidle");
  }

  async clickToday() {
    await this.todayButton.first().click();
    await this.page.waitForLoadState("networkidle");
  }
}
