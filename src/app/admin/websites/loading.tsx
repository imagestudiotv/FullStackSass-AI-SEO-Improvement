import { AdminListSkeleton } from "../_ui/states";

/** Shaped like the Websites list (without it, the overview's skeleton would show). */
export default function Loading() {
  return <AdminListSkeleton rows={10} columns={6} />;
}
