"use client";

import { useInfiniteActivityLogs } from "@/widgets/pages/activity-logs/hooks/use-activity-logs";
import { ActivityTimelineView } from "@/widgets/pages/activity-logs/components/activity-timeline-view";
import type { UseActivityLogsOptions } from "@/shared/types/activity-logs";

type ActivityTimelineProps = Pick<
  UseActivityLogsOptions,
  "customerId" | "orderId" | "sourceAccountId" | "limit"
>;

export function ActivityTimeline({
  customerId,
  orderId,
  sourceAccountId,
  limit = 10,
}: ActivityTimelineProps) {
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isError,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteActivityLogs({
    customerId,
    orderId,
    sourceAccountId,
    limit,
  });

  const logs = data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <ActivityTimelineView
      logs={logs}
      customerId={customerId}
      orderId={orderId}
      sourceAccountId={sourceAccountId}
      isLoading={isLoading}
      isError={isError}
      error={error}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      onLoadMore={() => {
        void fetchNextPage();
      }}
    />
  );
}
