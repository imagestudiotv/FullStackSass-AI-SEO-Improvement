import {
  BarChart3,
  CreditCard,
  Globe,
  Send,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Everything you configure once, gathered under Settings.
 *
 * The sidebar now lists only the pages a customer opens to check on the work
 * — articles, links, rankings. Publishing, billing and the website profile
 * are set up and then left alone, so they moved here rather than competing
 * for the same attention every day.
 *
 * These LINK to the existing routes rather than moving them. The pages work,
 * they are bookmarked, and the onboarding flow sends people to some of them;
 * relocating the files would break all of that to save one redirect.
 */

type SettingsLink = {
  title: string;
  description: string;
  icon: LucideIcon;
  /** A fixed path, or built from the selected website. */
  href: string;
};

type Group = { heading: string; links: SettingsLink[] };

function groups(websiteId: string | null): Group[] {
  return [
    {
      heading: "Account",
      links: [
        {
          title: "Billing",
          description:
            "Your plan, what it includes, and the invoices for it.",
          icon: CreditCard,
          href: "/billing",
        },
      ],
    },
    /**
     * Only shown once a website exists, since every link here needs its id.
     * A customer with no site has nothing to configure yet.
     */
    ...(websiteId
      ? [
          {
            heading: "Business & brand",
            links: [
              {
                title: "Website profile",
                description:
                  "What we understand about this business. Everything here shapes what we write.",
                icon: Globe,
                href: `/websites/${websiteId}/profile`,
              },
            ],
          },
          {
            heading: "Integrations",
            links: [
              {
                title: "Publishing",
                description:
                  "Where finished articles are published, and the connection that carries them.",
                icon: Send,
                href: `/websites/${websiteId}/publishing`,
              },
              {
                title: "Google Analytics & Search Console",
                description:
                  "Connect Google so rankings and traffic appear on your dashboard.",
                icon: BarChart3,
                href: `/websites/${websiteId}/google`,
              },
            ],
          },
        ]
      : []),
  ];
}

export function SettingsLinks({ websiteId }: { websiteId: string | null }) {
  return (
    <>
      {groups(websiteId).map((group) => (
        <Card key={group.heading}>
          <CardHeader>
            <CardTitle className="text-base">{group.heading}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="divide-y">
              {group.links.map((link) => {
                const Icon = link.icon;
                return (
                  <li key={link.title}>
                    <Link
                      href={link.href}
                      className="flex items-start gap-3 rounded-md px-1 py-3 transition-colors hover:bg-accent/60"
                    >
                      <Icon
                        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">
                          {link.title}
                        </span>
                        <span className="block text-sm text-muted-foreground">
                          {link.description}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ))}
    </>
  );
}
