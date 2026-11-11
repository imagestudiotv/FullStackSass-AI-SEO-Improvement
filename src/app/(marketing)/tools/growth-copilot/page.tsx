import { GrowthCopilotTool, growthCopilotMetadata } from "./tool";

export const metadata = growthCopilotMetadata("en");

/** /tools/growth-copilot (tool.tsx); other languages: [locale]/tools/growth-copilot. */
export default function GrowthCopilotPage() {
  return <GrowthCopilotTool locale="en" />;
}
