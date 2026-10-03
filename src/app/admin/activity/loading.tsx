import { AdminListSkeleton } from "../_ui/states";

/** Shaped like the activity log: header, filters, table. */
export default function Loading() {
  return <AdminListSkeleton rows={10} columns={4} />;
}
