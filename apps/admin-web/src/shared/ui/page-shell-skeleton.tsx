import React from "react";

export function PageShellSkeleton() {
  return (
    <div className="w-full min-h-screen bg-[var(--bg-app)] p-6 space-y-6">
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="h-7 w-48 shimmer rounded-lg" />
          <div className="h-4 w-32 shimmer rounded mt-2" />
        </div>
        <div className="h-10 w-32 shimmer rounded-xl" />
      </div>

      {/* KPI Cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white border border-gray-200/80 rounded-2xl p-4 space-y-3 shadow-sm">
            <div className="h-4 w-24 shimmer rounded" />
            <div className="h-6 w-32 shimmer rounded-lg" />
            <div className="h-3 w-16 shimmer rounded" />
          </div>
        ))}
      </div>

      {/* Filter Bar skeleton */}
      <div className="bg-white border border-gray-200/80 rounded-2xl p-4 flex flex-col md:flex-row gap-3 shadow-sm">
        <div className="h-10 flex-1 shimmer rounded-xl" />
        <div className="h-10 w-full md:w-40 shimmer rounded-xl" />
        <div className="h-10 w-full md:w-40 shimmer rounded-xl" />
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white border border-gray-200/80 rounded-2xl p-4 min-h-[180px] flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="size-9 shimmer rounded-xl" />
                  <div className="space-y-1.5">
                    <div className="h-4 w-28 shimmer rounded" />
                    <div className="h-3 w-20 shimmer rounded" />
                  </div>
                </div>
                <div className="h-5 w-16 shimmer rounded-full" />
              </div>
              <div className="h-4 w-44 shimmer rounded mt-4" />
              <div className="h-10 w-full shimmer rounded-xl mt-4" />
            </div>
            <div className="border-t border-gray-100 bg-gray-50/50 -mx-4 -mb-4 p-4 mt-4 flex items-center justify-between rounded-b-2xl">
              <div className="space-y-1.5">
                <div className="h-4 w-20 shimmer rounded" />
                <div className="h-3 w-16 shimmer rounded" />
              </div>
              <div className="h-7 w-20 shimmer rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
