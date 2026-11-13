import { AdminListSkeleton } from "../_ui/states";

/**
 * Partner Network: a plain list skeleton (header and a table) - neutral enough
 * to stand in for Network Operations too, which has no skeleton of its own.
 * The review workspace has its own ([articleId]/loading.tsx).
 */
export default function Loading() {
  return <AdminListSkeleton rows={8} columns={6} withToolbar={false} />;
}
