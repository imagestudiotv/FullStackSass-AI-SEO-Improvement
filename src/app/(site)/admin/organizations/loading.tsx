import { AdminListSkeleton } from "../_ui/states";

/** Shaped like the Organizations list: header, toolbar, table. */
export default function Loading() {
  return <AdminListSkeleton rows={10} columns={6} />;
}
