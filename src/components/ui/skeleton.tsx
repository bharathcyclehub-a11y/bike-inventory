import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("animate-pulse rounded-md bg-slate-200", className)} {...props} />
  );
}

// Pre-built skeleton patterns for common list layouts
function SkeletonCard() {
  return (
    <div className="p-3 border border-slate-100 rounded-lg space-y-2">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
    </div>
  );
}

function SkeletonTransaction() {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0">
      <Skeleton className="h-9 w-9 rounded-full shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <div className="text-right space-y-1.5">
        <Skeleton className="h-4 w-10 ml-auto" />
        <Skeleton className="h-3 w-12 ml-auto" />
      </div>
    </div>
  );
}

function SkeletonList({ count = 5, type = "card" }: { count?: number; type?: "card" | "transaction" }) {
  return (
    <div className={type === "card" ? "space-y-2" : ""}>
      {Array.from({ length: count }).map((_, i) => (
        type === "card" ? <SkeletonCard key={i} /> : <SkeletonTransaction key={i} />
      ))}
    </div>
  );
}

function SkeletonDashboard() {
  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-3 border border-slate-100 rounded-lg space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-20" />
          </div>
        ))}
      </div>
      {/* Recent items */}
      <Skeleton className="h-4 w-32" />
      <SkeletonList count={3} type="transaction" />
    </div>
  );
}

export { Skeleton, SkeletonCard, SkeletonTransaction, SkeletonList, SkeletonDashboard };
