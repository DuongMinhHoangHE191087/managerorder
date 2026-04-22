import { vi } from "@/shared/messages/vi";

export type TimeRange = "7" | "30" | "90" | "365";

export const TIME_TABS = vi.dashboard.timeTabs as readonly { value: TimeRange; label: string; short: string }[];
