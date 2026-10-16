import { CaseStudyPage, caseStudyMetadata } from "./case-study";

/** The Image Studio case study, English. The words and numbers live in lib/marketing/case-study-image-studio.ts. */
export const metadata = caseStudyMetadata("en");

export default function ImageStudioCaseStudyPage() {
  return <CaseStudyPage locale="en" />;
}
