import { AdminListSkeleton } from "../_ui/states";

/** Shaped like the payments list: header, toolbar, table. */
export default function PaymentsLoading() {
  return <AdminListSkeleton rows={8} columns={6} />;
}
