import { Skeleton } from "@/components/ui/misc";

export default function Loading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-56" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  );
}
