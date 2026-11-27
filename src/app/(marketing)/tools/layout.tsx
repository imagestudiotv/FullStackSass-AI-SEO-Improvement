import { ToolGate } from "@/components/tool-gate";
import { disabledTools } from "@/lib/tools/tool-tracking";

/**
 * Every English free tool page: a tool switched off in Admin -> Free tools
 * shows "temporarily unavailable" (components/tool-gate.tsx). Cached pages
 * are rebuilt when an administrator flips a switch (lib/admin/free-tools.ts).
 */
export default async function ToolsLayout({ children }: LayoutProps<"/tools">) {
  return (
    <ToolGate disabled={await disabledTools()} locale="en">
      {children}
    </ToolGate>
  );
}
