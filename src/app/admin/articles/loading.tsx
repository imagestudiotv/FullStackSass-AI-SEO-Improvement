import { AdminListSkeleton } from "../_ui/states";

/** Shaped like the articles list: header, search and filters, table. */
export default function Loading() {
  return <AdminListSkeleton rows={8} columns={6} />;
}
