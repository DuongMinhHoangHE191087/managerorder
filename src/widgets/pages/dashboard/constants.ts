export type TimeRange = "7" | "30" | "90" | "365";

export const TIME_TABS: { value: TimeRange; label: string; short: string }[] = [
  { value: "7", label: "Tuần", short: "7 ngày" },
  { value: "30", label: "Tháng", short: "30 ngày" },
  { value: "90", label: "Quý", short: "3 tháng" },
  { value: "365", label: "Năm", short: "12 tháng" },
];
