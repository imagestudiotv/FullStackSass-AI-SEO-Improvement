import { ListSkeleton } from "@/components/ui/page-skeleton";

/**
 * Sections only — the website layout already supplies the shell and header,
 * so wrapping again would nest two centred containers.
 */
export default function Loading() {
  return <ListSkeleton rows={4} />;
}
