import { AdminListSkeleton } from "../_ui/states";

/** Shaped like the feed: header, toolbar, table. A refresh keeps the page on screen instead. */
export default function CustomerActivityLoading() {
  return <AdminListSkeleton rows={10} columns={5} />;
}
