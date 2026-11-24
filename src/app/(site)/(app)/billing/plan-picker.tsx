"use client";

import {
  ArrowRight,
  BadgePercent,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Loader2,
  Minus,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { PaymentMethodPicker, type PaymentMethod } from "@/components/billing/payment-method-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Notice } from "@/components/workspace/notice";
import type { CurrentSubscription, PlanRow, WebsiteSubscription } from "@/lib/billing-shared";
import { SUPPORT_EMAIL } from "@/lib/config/site";
import type { BillingPlansCopy } from "@/lib/i18n/billing-plans";
import type { PaymentChoiceCopy } from "@/lib/i18n/buy-credits";
import type { Locale } from "@/lib/i18n/config";
import { format } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
import { isDirectPurchaseTier } from "@/lib/plans/features";
import { cn } from "@/lib/utils";

import {
  annualSaving,
  formatMoney,
  payPalForPlan,
  payPalIntervalBlocked,
  planFeatures,
  type PaymentOptions,
} from "./billing-view";
import type { PlanCardView } from "./plan-cards";
import { orderPlans, planCompareRows, type CompareCell, type CompareRow } from "./plan-compare";

/** A payment being started. */
export type PlanPayment = { planId: string; provider: "stripe" | "paypal" };

const providerOf = (method: PaymentMethod): PlanPayment["provider"] => (method === "paypal" ? "paypal" : "stripe");

/**
 * The ways this plan can be paid for this website: the same rules the page
 * always had (billing-view.ts), and every one is checked again on the server.
 */
export function planMethods(
  plan: PlanRow,
  options: PaymentOptions,
  subscription: CurrentSubscription | null,
): PaymentMethod[] {
  const paypal = payPalForPlan(plan, options) && !payPalIntervalBlocked(subscription, plan, options);
  return [...(options.card ? (["card"] as const) : []), ...(paypal ? (["paypal"] as const) : [])];
}

/**
 * The plans for one website (Daniel's design of 2026-11-24): three cards, the
 * comparison, and a dialog that says what is paid and how before going on to
 * the provider. Prices, terms, benefits and which buttons can work all come
 * from the server; this only lays them out.
 */
export function PlanPicker({
  plans,
  planCards,
  subscription,
  entitled,
  options,
  domain,
  websiteId,
  websiteSubscriptions,
  processorNote,
  offer,
  annualNote,
  selectedTier,
  initialInterval,
  status,
  pending,
  onPay,
  paypalIntervalNote,
  blockedPlanId,
  pendingPrompt,
  copy,
  choice,
  usageNote,
  t,
  tCommon,
  locale,
}: {
  plans: PlanRow[];
  planCards: Record<string, PlanCardView>;
  subscription: CurrentSubscription | null;
  entitled: boolean;
  options: PaymentOptions;
  domain: string | null;
  websiteId: string | null;
  websiteSubscriptions: WebsiteSubscription[];
  /** Why one processor's buttons are missing, already worded; null when nothing is. */
  processorNote: string | null;
  /** The discount that applies here, already worded; null when none does. */
  offer: { title: string; body: string } | null;
  /** Beside the period switch: what paying yearly saves. */
  annualNote: string | null;
  /** A plan named in the address, checked on the server. */
  selectedTier: string | null;
  initialInterval: "month" | "year";
  /** A line under the title about this website's subscription. */
  status: string | null;
  pending: PlanPayment | null;
  /** Starts the payment and goes on to the provider. */
  onPay: (planId: string, provider: PlanPayment["provider"]) => void;
  paypalIntervalNote?: string;
  /** The plan whose payment is blocked by an unfinished PayPal one, and the prompt that says so. */
  blockedPlanId: string | null;
  pendingPrompt: ReactNode;
  copy: BillingPlansCopy;
  choice: PaymentChoiceCopy;
  usageNote: string;
  t: Messages["app"]["billing"];
  tCommon: Messages["app"]["common"];
  locale: Locale;
}) {
  const [interval, setBillingInterval] = useState<"month" | "year">(initialInterval);
  const [chosen, setChosen] = useState<PlanRow | null>(null);
  const [open, setOpen] = useState(false);
  const [complete, setComplete] = useState(false);
  const comparison = useRef<HTMLElement>(null);

  // A link to one plan (an upgrade notice) lands on its card.
  useEffect(() => {
    if (!selectedTier) return;
    document.getElementById(`plan-card-${selectedTier}`)?.scrollIntoView({ block: "center" });
  }, [selectedTier]);

  const monthly = plans.filter((plan) => plan.interval === "month");
  const monthlyByTier = new Map(monthly.map((plan) => [plan.tier, plan]));
  const annualTiers = new Set(plans.filter((plan) => plan.interval === "year").map((plan) => plan.tier));
  const hasAnnual = annualTiers.size > 0;
  /*
    Plans sold only monthly (Grow + Visibility) stay on the annual tab at their
    monthly price, rather than vanishing the moment someone clicks "Annual".
  */
  const plansFor = (period: "month" | "year") =>
    orderPlans(
      plans.filter((plan) =>
        period === "year"
          ? plan.interval === "year" || (plan.interval === "month" && !annualTiers.has(plan.tier))
          : plan.interval === "month",
      ),
    );
  /** "Grow" on both tabs: the yearly rows are named "Grow (Annual)", and the switch already says which. */
  const nameOf = (plan: PlanRow) => monthlyByTier.get(plan.tier)?.name ?? plan.name;

  function choose(plan: PlanRow) {
    setChosen(plan);
    setOpen(true);
  }

  function showComparison() {
    setComplete(true);
    comparison.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function planCard(plan: PlanRow) {
    const view = planCards[plan.id] ?? null;
    const isCurrent = subscription?.planId === plan.id && entitled;
    const methods = planMethods(plan, options, subscription);
    const intervalBlocked = payPalIntervalBlocked(subscription, plan, options);
    const featured = isDirectPurchaseTier(plan.tier);
    const selected = selectedTier === plan.tier && !isCurrent;
    const saving = plan.interval === "year" ? annualSaving(monthlyByTier.get(plan.tier), plan) : 0;
    const name = nameOf(plan);
    const headingId = `plan-${plan.id}`;
    const busy = pending?.planId === plan.id;
    const lines = view?.highlights ?? planFeatures(plan, t, locale);

    return (
      <article
        key={plan.id}
        id={`plan-card-${plan.tier}`}
        data-plan={plan.tier}
        data-selected={selected || undefined}
        aria-labelledby={headingId}
        className={cn(
          "relative flex min-w-0 scroll-mt-24 flex-col rounded-2xl p-5 xl:p-6",
          featured
            ? "border-2 border-primary bg-linear-to-b from-primary/8 to-card to-30% shadow-lg max-lg:order-first lg:-my-2"
            : "border bg-card",
          selected && "ring-3 ring-primary/40",
        )}
      >
        {featured ? (
          <span className="absolute -top-3.5 right-4 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-[11px] font-bold tracking-wider text-primary-foreground uppercase">
            <Sparkles className="size-3" aria-hidden="true" />
            {copy.bestValue}
          </span>
        ) : null}

        <div className="lg:min-h-28">
          {view?.tag ? <p className="text-xs font-medium text-muted-foreground">{view.tag}</p> : null}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h3 id={headingId} className="text-xl leading-tight font-bold tracking-tight text-foreground">
              {name}
            </h3>
            {selected ? <Badge>{copy.yourChoice}</Badge> : null}
            {isCurrent ? <Badge variant="secondary">{t.currentPlan}</Badge> : null}
          </div>
          {view?.description ? <p className="mt-2 text-sm leading-5 text-muted-foreground">{view.description}</p> : null}
        </div>

        <div className="mt-3 border-b pb-5">
          {view ? (
            <PlanPrice view={view} saving={saving > 0 ? format(t.saveBadge, { n: saving }) : null} monthlyOnly={interval === "year" && plan.interval === "month" ? copy.monthlyOnly : null} />
          ) : (
            <p className="flex flex-wrap items-baseline gap-x-1.5">
              <span className="text-4xl font-bold tracking-tight text-foreground tabular-nums">
                {formatMoney(plan.priceCents, plan.currency, locale)}
              </span>
              <span className="text-sm text-muted-foreground">{plan.interval === "year" ? t.perYear : t.perMonth}</span>
            </p>
          )}
        </div>

        <div className="flex-1 pt-5">
          <p className="flex items-center gap-2 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
            {featured ? (
              <Sparkles className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
            )}
            {featured ? copy.highlightsBundle : copy.highlights}
          </p>
          <ul className="mt-3 space-y-2.5 text-sm leading-5 text-muted-foreground">
            {lines.map((line) => (
              <li key={line} className="flex items-start gap-2.5">
                <Check
                  className={cn("mt-0.5 size-4 shrink-0", featured ? "text-primary" : "text-emerald-600 dark:text-emerald-400")}
                  aria-hidden="true"
                />
                <span className="min-w-0">{marks(line)}</span>
              </li>
            ))}
          </ul>
        </div>

        {view?.perksTitle && view.perks.length > 0 ? (
          <div className={cn("mt-5 rounded-xl border p-3.5", featured ? "border-primary/25 bg-primary/8" : "bg-muted/30")}>
            <p className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Sparkles className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
              {view.perksTitle}
            </p>
            <ul className="mt-2 space-y-1.5 text-xs leading-5">
              {view.perks.map((perk) => (
                <li key={perk.strong}>
                  <span className="font-semibold text-foreground">{perk.strong}</span>
                  <span className="text-muted-foreground"> - {perk.small}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-5 space-y-2.5">
          {isCurrent ? (
            <Button className={CARD_BUTTON} variant="outline" disabled>
              <CheckCircle2 aria-hidden="true" />
              {t.currentPlan}
            </Button>
          ) : view?.launchNotCovered && methods.length > 0 ? (
            <p className="text-xs leading-5 text-muted-foreground">
              {copy.launchNotCovered}{" "}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="rounded-sm font-medium text-foreground underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {copy.contactUs}
              </a>
            </p>
          ) : methods.length > 0 ? (
            <Button className={CARD_BUTTON} variant={featured || selected ? "default" : "outline"} disabled={pending !== null} onClick={() => choose(plan)}>
              {busy ? (
                <>
                  <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  {t.redirecting}
                </>
              ) : (
                <>
                  {entitled ? t.switchPlan : format(featured ? copy.get : copy.choose, { plan: name })}
                  <ArrowRight aria-hidden="true" />
                </>
              )}
            </Button>
          ) : null}
          {!isCurrent && intervalBlocked && paypalIntervalNote ? (
            <p className="text-xs leading-5 text-muted-foreground">{paypalIntervalNote}</p>
          ) : !isCurrent && methods.length === 0 ? (
            <p className="text-xs leading-5 text-muted-foreground">{t.noPlanChange}</p>
          ) : null}
          <button
            type="button"
            onClick={showComparison}
            className="mx-auto block rounded-sm px-1 py-0.5 text-xs text-muted-foreground underline-offset-4 outline-none hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {featured ? copy.seeBenefits : copy.seeEverything}
            <span className="sr-only">{` - ${name}`}</span>
          </button>
        </div>
      </article>
    );
  }

  function planGrid(period: "month" | "year") {
    const list = plansFor(period);
    if (list.length === 0) return <p className="text-sm text-muted-foreground">{tCommon.noPlans}</p>;
    return (
      <div
        className={cn(
          "mx-auto grid max-w-xl items-stretch gap-6 pt-4 lg:max-w-none lg:gap-4 xl:gap-5",
          list.length >= 3 ? "lg:grid-cols-3" : list.length === 2 ? "lg:grid-cols-2" : "",
        )}
      >
        {list.map(planCard)}
      </div>
    );
  }

  const others = websiteSubscriptions.filter((row) => row.websiteId !== websiteId);
  const site = domain ? (
    others.length > 0 ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="max-w-full rounded-full">
            <span className="text-muted-foreground">{copy.website}</span>
            <span className="min-w-0 truncate">{domain}</span>
            <ChevronDown aria-hidden="true" />
            <span className="sr-only">{` - ${copy.switchWebsite}`}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-72 w-auto max-w-72 overflow-y-auto">
          {others.map((row) => (
            <DropdownMenuItem key={row.websiteId} asChild>
              <Link href={`/billing?site=${row.websiteId}#plans`}>{row.domain}</Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    ) : (
      <p className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm">
        <span className="text-muted-foreground">{copy.website}</span>
        <span className="min-w-0 truncate font-semibold text-foreground">{domain}</span>
      </p>
    )
  ) : null;

  const tablePlans = plansFor("month").length > 0 ? plansFor("month") : plansFor("year");

  const head = (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-bold tracking-[0.13em] text-primary uppercase">{copy.eyebrow}</p>
          <h2 id="plans-title" className="mt-2 text-2xl leading-tight font-bold tracking-tight text-foreground sm:text-3xl">
            {copy.title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{copy.body}</p>
          {status ? <p className="mt-1 text-sm text-muted-foreground">{status}</p> : null}
        </div>
        {site ? <div className="min-w-0 shrink-0">{site}</div> : null}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
          {copy.assist}
        </p>
        {hasAnnual ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {annualNote ? <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{annualNote}</span> : null}
            <TabsList aria-label={t.billingPeriod}>
              <TabsTrigger value="month">{t.monthly}</TabsTrigger>
              <TabsTrigger value="year">{t.annual}</TabsTrigger>
            </TabsList>
          </div>
        ) : null}
      </div>

      <div className="mt-5 space-y-3">
        {processorNote ? <Notice tone="info">{processorNote}</Notice> : null}
        {offer ? (
          <div
            role="status"
            className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary" aria-hidden="true">
                <BadgePercent className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{offer.title}</p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{offer.body}</p>
              </div>
            </div>
            <span className="self-start rounded-md border border-dashed border-primary/50 bg-card px-2.5 py-1.5 text-[11px] font-bold tracking-wide whitespace-nowrap text-primary uppercase sm:self-center">
              {copy.promoActive}
            </span>
          </div>
        ) : null}
        {blockedPlanId && !open ? pendingPrompt : null}
      </div>
    </>
  );

  return (
    <section id="plans" aria-labelledby="plans-title" className="min-w-0 scroll-mt-20 space-y-8">
      <div>
        {hasAnnual ? (
          <Tabs
            value={interval}
            onValueChange={(value) => setBillingInterval(value === "year" ? "year" : "month")}
            className="block"
          >
            {head}
            {(["month", "year"] as const).map((period) => (
              <TabsContent key={period} value={period} className="mt-4 rounded-2xl focus-visible:ring-3 focus-visible:ring-ring/50">
                {planGrid(period)}
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <>
            {head}
            <div className="mt-4">{planGrid("month")}</div>
          </>
        )}

        <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <Trust icon={ShieldCheck} text={copy.trustSecure} />
          <Trust icon={CheckCircle2} text={copy.trustClear} />
          <Trust icon={CalendarClock} text={hasAnnual ? copy.trustPeriods : copy.trustMonthly} />
          <Trust icon={CreditCard} text={options.paypal ? (options.card ? copy.trustBoth : "PayPal") : copy.trustCard} />
        </ul>
        {options.card && options.paypal ? (
          <p className="mt-3 text-center text-xs text-muted-foreground">{tCommon.promoCodesHelp}</p>
        ) : null}
      </div>

      {tablePlans.length > 0 ? (
        <section ref={comparison} id="compare-plans" aria-labelledby="compare-plans-title" className="min-w-0 scroll-mt-20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h2 id="compare-plans-title" className="text-xl font-bold tracking-tight text-foreground">
                {copy.compareTitle}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{copy.compareBody}</p>
            </div>
            <Button variant="outline" className="self-start sm:self-auto" aria-expanded={complete} aria-controls="compare-plans-table" onClick={() => setComplete(!complete)}>
              {complete ? copy.showFewer : copy.showAll}
              <ChevronDown className={cn("transition-transform motion-reduce:transition-none", complete && "rotate-180")} aria-hidden="true" />
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground md:hidden">{copy.swipe}</p>
          <CompareTable
            names={tablePlans.map((plan) => ({ id: plan.id, name: nameOf(plan), featured: isDirectPurchaseTier(plan.tier) }))}
            rows={planCompareRows(tablePlans, locale, copy, t.unlimited).filter((row) => complete || !row.extra)}
            copy={copy}
            note={usageNote}
          />
        </section>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-0 rounded-2xl p-6 sm:max-w-md" closeLabel={choice.close}>
          {chosen ? (
            <PlanCheckout
              key={chosen.id}
              plan={chosen}
              name={nameOf(chosen)}
              view={planCards[chosen.id] ?? null}
              methods={planMethods(chosen, options, subscription)}
              switching={entitled}
              domain={domain}
              pending={pending?.planId === chosen.id}
              prompt={blockedPlanId === chosen.id ? pendingPrompt : null}
              onPay={(method) => onPay(chosen.id, providerOf(method))}
              copy={copy}
              choice={choice}
              locale={locale}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}

/**
 * A full-width card button whose label may wrap: in a narrow column a long
 * translation ("Zu diesem Tarif wechseln") would otherwise run out of the card.
 */
const CARD_BUTTON = "h-auto min-h-11 w-full rounded-xl py-2 text-center font-semibold whitespace-normal";

function Trust({ icon: Icon, text }: { icon: typeof ShieldCheck; text: string }) {
  return (
    <li className="inline-flex items-center gap-1.5">
      <Icon className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
      {text}
    </li>
  );
}

/**
 * The price as /pricing shows it (plan-cards.ts): the charged figure, the
 * regular one struck through beside it when checkout really takes something
 * off, how it is billed, and when money is taken.
 */
function PlanPrice({ view, saving, monthlyOnly }: { view: PlanCardView; saving: string | null; monthlyOnly: string | null }) {
  return (
    <div className="space-y-1.5">
      <p className="flex min-h-6 flex-wrap items-center gap-2 text-sm">
        {view.badge ? (
          <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">{view.badge}</span>
        ) : null}
        {view.strike ? <del className="text-muted-foreground tabular-nums">{view.strike}</del> : null}
        {saving ? (
          <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            {saving}
          </span>
        ) : null}
        {view.directBadge ? (
          <Badge variant="outline" className="border-primary/40 text-primary">
            {view.directBadge}
          </Badge>
        ) : null}
        {monthlyOnly ? <Badge variant="secondary">{monthlyOnly}</Badge> : null}
      </p>
      <p className="flex flex-wrap items-baseline gap-x-1.5">
        <span className="text-4xl font-bold tracking-tight text-foreground tabular-nums">{view.price}</span>
        <span className="text-sm text-muted-foreground">{view.per}</span>
      </p>
      <p className="text-xs leading-5 text-muted-foreground">{view.caption}</p>
      {view.terms.map((line) => (
        <p key={line} className="text-xs leading-5 text-muted-foreground">
          {line}
        </p>
      ))}
    </div>
  );
}

function CompareTable({
  names,
  rows,
  copy,
  note,
}: {
  names: { id: string; name: string; featured: boolean }[];
  rows: CompareRow[];
  copy: BillingPlansCopy;
  note: string;
}) {
  const tint = (featured: boolean) => (featured ? "bg-primary/5" : undefined);
  return (
    <div id="compare-plans-table" className="mt-3 overflow-hidden rounded-xl border bg-card">
      {/* Scrolls inside itself on a phone, so the page never does; focusable, so a keyboard can scroll it. */}
      <div className="overflow-x-auto outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset" tabIndex={0} role="region" aria-labelledby="compare-plans-title">
        <table className="w-full min-w-160 text-center text-sm">
          <thead className="border-b bg-muted/30">
            <tr>
              <th scope="col" className="w-[34%] px-5 py-4 text-left text-xs font-bold tracking-wider text-muted-foreground uppercase">
                {copy.features}
              </th>
              {names.map((plan) => (
                <th key={plan.id} scope="col" className={cn("px-3 py-4 font-bold", plan.featured ? "bg-primary/10 text-primary" : "text-foreground")}>
                  {plan.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b last:border-b-0">
                <th scope="row" className="px-5 py-3.5 text-left font-medium text-foreground/80">
                  {row.label}
                  {row.help ? <span className="block text-xs font-normal text-muted-foreground">{row.help}</span> : null}
                </th>
                {row.cells.map((cell, index) => (
                  <td key={names[index].id} className={cn("px-3 py-3.5", tint(names[index].featured))}>
                    <Cell cell={cell} copy={copy} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t bg-muted/20 px-5 py-3 text-xs leading-5 text-muted-foreground">{note}</p>
    </div>
  );
}

function Cell({ cell, copy }: { cell: CompareCell; copy: BillingPlansCopy }) {
  if (cell.kind === "text") return <span className="font-medium tabular-nums">{cell.text}</span>;
  if (cell.kind === "no") {
    return (
      <span className="inline-flex text-muted-foreground/60">
        <Minus className="size-4" aria-hidden="true" />
        <span className="sr-only">{copy.notIncluded}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
      <Check className="size-4" aria-hidden="true" />
      {copy.included}
    </span>
  );
}

type PlanCheckoutProps = {
  plan: PlanRow;
  name: string;
  view: PlanCardView | null;
  methods: PaymentMethod[];
  /** The website has a plan: this changes it, and the provider shows what that costs. */
  switching: boolean;
  domain: string | null;
  pending: boolean;
  /** An unfinished PayPal payment stands in the way. */
  prompt: ReactNode;
  onPay: (method: PaymentMethod) => void;
  copy: BillingPlansCopy;
  choice: PaymentChoiceCopy;
  locale: Locale;
};

function PlanCheckout(props: PlanCheckoutProps) {
  const { switching, domain, copy } = props;
  const [method, setMethod] = useState<PaymentMethod>(props.methods[0] ?? "card");
  const title = format(switching ? copy.switchTitle : copy.dialogTitle, { plan: props.name });
  const body = !domain
    ? copy.dialogBodyNoSite
    : format(switching ? copy.switchBody : copy.dialogBody, { domain });
  return (
    <PlanCheckoutView
      {...props}
      title={<DialogTitle className="pr-8 text-xl font-bold tracking-tight">{title}</DialogTitle>}
      description={<DialogDescription className="mt-1.5 leading-5 wrap-anywhere">{body}</DialogDescription>}
      method={method}
      onMethod={setMethod}
    />
  );
}

/** Separate from the dialog's own parts, so it can be rendered without one. */
export function PlanCheckoutView({
  plan,
  name,
  view,
  methods,
  pending,
  prompt,
  onPay,
  copy,
  choice,
  locale,
  title,
  description,
  method,
  onMethod,
}: PlanCheckoutProps & {
  title: ReactNode;
  description: ReactNode;
  method: PaymentMethod;
  onMethod: (method: PaymentMethod) => void;
}) {
  // PayPal may not be able to give this plan's free trial: then the terms are PayPal's, and the note says so.
  const noTrial = method === "paypal" && view?.paypalNote;
  const terms = noTrial ? [view.paypalNote as string, ...view.paypalTerms] : (view?.terms ?? []);
  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-[11px] font-bold tracking-[0.13em] text-primary uppercase">{copy.dialogEyebrow}</p>
      {title}
      {description}
      <div className="mt-5 rounded-xl border border-primary/25 bg-primary/5 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{format(copy.planName, { plan: name })}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {plan.interval === "year" ? copy.annualSubscription : copy.monthlySubscription}
            </p>
          </div>
          <p className="shrink-0 text-right">
            {view?.strike && plan.interval === "month" ? (
              <del className="block text-xs text-muted-foreground tabular-nums">{view.strike}</del>
            ) : null}
            <span className="block text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {view?.payment ?? formatMoney(plan.priceCents, plan.currency, locale)}
            </span>
          </p>
        </div>
        {terms.map((line) => (
          <p key={line} className="mt-2 text-xs leading-5 text-muted-foreground">
            {line}
          </p>
        ))}
      </div>
      <div className="mt-5">
        <PaymentMethodPicker methods={methods} value={method} onChange={onMethod} copy={choice} disabled={pending} />
      </div>
      {prompt ? <div className="mt-4">{prompt}</div> : null}
      <Button
        className="mt-5 h-auto min-h-11 w-full rounded-xl py-2 font-semibold whitespace-normal"
        onClick={() => onPay(method)}
        disabled={pending || methods.length === 0}
      >
        {pending ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
        {method === "paypal" ? choice.continuePayPal : choice.continueCard}
        {pending ? null : <ArrowRight aria-hidden="true" />}
      </Button>
      <p className="mt-3 text-center text-xs text-muted-foreground">{choice.note}</p>
    </div>
  );
}

/** The copy's one mark, `**words**` in bold (lib/i18n/pricing-page.ts). Never HTML. */
function marks(text: string): ReactNode {
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  if (parts.length === 1) return text;
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <strong key={index} className="font-semibold text-foreground">
        {part}
      </strong>
    ) : (
      part
    ),
  );
}
