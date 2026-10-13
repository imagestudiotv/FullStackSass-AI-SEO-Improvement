import { RobotsTool, robotsMetadata } from "./tool";

export const metadata = robotsMetadata("en");

// Fetches a live website per request, so it can never be prerendered (and the nonce CSP needs a per-request render).
export const dynamic = "force-dynamic";

/** /tools/robots-checker (tool.tsx); other languages: [locale]/tools/robots-checker. */
export default async function RobotsCheckerPage({ searchParams }: PageProps<"/tools/robots-checker">) {
  return <RobotsTool locale="en" searchParams={await searchParams} />;
}
