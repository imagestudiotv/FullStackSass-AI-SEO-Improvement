import { SocialPostGeneratorTool, socialPostGeneratorMetadata } from "./tool";

export const metadata = socialPostGeneratorMetadata("en");

/** /tools/social-media-post-generator (tool.tsx); other languages: [locale]/tools/social-media-post-generator. */
export default function SocialMediaPostGeneratorPage() {
  return <SocialPostGeneratorTool locale="en" />;
}
