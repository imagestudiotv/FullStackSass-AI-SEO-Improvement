import type { Locale } from "@/lib/i18n/config";

/**
 * The partner program's words, in every language the site speaks.
 *
 * A dictionary of its own (like the free tools' copy) rather than more
 * sections in lib/i18n/messages.ts. Pure data: server components pass the
 * slices client components need as props.
 *
 * NO FIGURE IS WRITTEN INTO A SENTENCE. Rates, months, days and thresholds
 * are placeholders ({rate}, {months}, {days}, {amount}) filled from the
 * program policy (partner_program_versions), so the page can never advertise
 * a number the code does not pay.
 */

/** The earnings explorer on /partners (components/partners/earnings-calculator.tsx). */
export type CalculatorCopy = {
  head: string;
  headSub: string;
  headBadge: string;
  network: string;
  live: string;
  direct: string;
  hint: string;
  hintMany: string;
  svgLabel: string;
  nodeLabel: string;
  you: string;
  selected: string;
  referral: string;
  kind: string;
  perMonth: string;
  add: string;
  explore: string;
  restart: string;
  fineprint: string;
  scenario: string;
  plan: string;
  monthlyPrices: string;
  planPrice: string;
  customers: string;
  people: string;
  rates: string;
  from: string;
  level: string;
  potential: string;
  perMonthShort: string;
  projection: string;
  footStrong: string;
  footBody: string;
  footLink: string;
};

export type PartnerCopy = {
  /**
   * The public /partners page (Daniel's design, 2026-11-07). Sentences may use
   * {rate} (the starting rate), {top} (the highest), {range}, {months}, {days},
   * {maturity}, {amount} and, in the FAQ, {tiers}. "**...**" is bold; "\n" in a
   * heading is a line break.
   */
  page: {
    metaTitle: string;
    metaDescription: string;
    eyebrow: string;
    eyebrowOpen: string;
    eyebrowClosed: string;
    /** The heading in three parts: "Recommend RepGet." / "Get paid" (in colour) / "as they grow." */
    titleLead: string;
    titleEm: string;
    titleRest: string;
    intro: string;
    ctaApply: string;
    ctaExplore: string;
    fineLine: string;
    portalQuestion: string;
    portalLink: string;
    /** Shown instead of the apply buttons while applications are closed. */
    closed: string;
    /** The earnings explorer: a simulated network beside the estimate (components/partners/earnings-calculator.tsx). */
    calculator: CalculatorCopy;
    disclaimer: string;
    trust: { start: string; top: string; monthsValue: string; months: string; daysValue: string; days: string };
    ctaStart: string;
    stepsKicker: string;
    stepsTitle: string;
    stepsIntro: string;
    stepLabel: string;
    steps: { title: string; body: string }[];
    tiersKicker: string;
    tiersTitle: string;
    tiersIntro: string;
    tierLevel: string;
    tierTop: string;
    tierStartTitle: string;
    tierStartBody: string;
    tierFromTitle: string;
    tierNextBody: string;
    tierTopBody: string;
    audienceKicker: string;
    audienceTitle: string;
    audienceIntro: string;
    audience: { title: string; body: string }[];
    quoteKicker: string;
    quoteLead: string;
    quoteEm: string;
    quoteFoot: string;
    quoteFoot2: string;
    faqKicker: string;
    faqTitle: string;
    faqIntro: string;
    /** `payout` marks the answer about being paid: Daniel's wording, shown while cash payouts run (`credits` replaces it otherwise). */
    faq: { question: string; answer: string; payout?: boolean }[];
    /**
     * Partners paid in RepGet credits (owner's decision, 2026-11-07: credits now,
     * cash later; presentation/payout-terms.ts). `faq` replaces the payout
     * answer and uses {maturity} and {rate}; {rate} is `rate` ({credits},
     * {price}) or `rateUnknown` when no credit pack is on sale.
     */
    credits: { faq: string; rate: string; rateUnknown: string; disclaimer: string };
    /** One higher level in the earnings answer's {tiers}. */
    tierPhrase: string;
    ctaKicker: string;
    ctaTitle: string;
    ctaButton: string;
    ctaSmall: string;
    creditBody: string;
    creditLink: string;
  };
  portal: {
    title: string;
    nav: { overview: string; referrals: string; commissions: string; payouts: string; resources: string; settings: string; apply: string; backToApp: string };
    testMode: string;
    verify: { title: string; body: string; send: string; sent: string; code: string; confirm: string; errors: Record<"INVALID" | "EXPIRED" | "TOO_MANY" | "FAILED", string> };
    /**
     * /partner/apply (Daniel's centred form, 2026-11-07). {min} and {max} are
     * the answers' lengths (domain/entities/application.ts APPLICATION_LIMITS);
     * terms has {link}, the program page's terms.
     */
    apply: {
      /** The browser title. */
      title: string;
      eyebrow: string;
      heading: string;
      intro: string;
      cardTitle: string;
      cardIntro: string;
      chip: string;
      website: string;
      websiteHint: string;
      websitePlaceholder: string;
      audience: string;
      audienceHint: string;
      audiencePlaceholder: string;
      promotion: string;
      promotionHint: string;
      promotionPlaceholder: string;
      counter: string;
      country: string;
      /** Under the country list: Daniel's wording about bank and PayPal payouts. */
      countryHint: string;
      /** In place of countryHint while partners are paid in credits. */
      countryHintCredits: string;
      countryPlaceholder: string;
      terms: string;
      termsLink: string;
      required: string;
      submit: string;
      submitting: string;
      privacy: string;
      questions: string;
      questionsLink: string;
      closed: string;
      pendingTitle: string;
      pendingBody: string;
      rejectedTitle: string;
      rejectedBody: string;
      errors: Record<"invalid" | "website" | "audience" | "promotion" | "country" | "terms" | "rate_limited" | "disabled" | "already_processed" | "generic", string>;
    };
    suspended: { title: string; body: string };
    hold: { title: string; body: string };
    overview: {
      title: string;
      linkTitle: string;
      linkHint: string;
      linkAnyPage: string;
      copy: string;
      copied: string;
      tierTitle: string;
      progress: string;
      remaining: string;
      topTier: string;
      /** "30% recurring commission" under the level's name. */
      recurring: string;
      nextLevel: string;
      levelRate: string;
      cards: { earned: string; pending: string; paid: string; referrals: string; payingCustomers: string };
      definitions: { earned: string; pending: string; paid: string; referrals: string; payingCustomers: string };
      /** Under "Pending" and "Paid": what the figure is made of. */
      breakdown: { approved: string; waiting: string; sending: string; inBank: string };
      latestTitle: string;
      latestAll: string;
      noEarnings: string;
      noThreshold: string;
      threshold: string;
      metrics: { clicks: string; signups: string; referred: string; customers: string; conversion: string; range: string; period: string; since: string; definition: string };
      balancesTitle: string;
      currencyNote: string;
      offset: string;
      nextPayout: string;
      couponsTitle: string;
      copyCode: string;
      noCoupons: string;
      couponDiscount: string;
    };
    referrals: { title: string; intro: string; customer: string; source: string; since: string; status: string; empty: string; statuses: Record<"active" | "review" | "disqualified", string>; sources: Record<"link" | "coupon", string> };
    commissions: {
      title: string;
      intro: string;
      date: string;
      customer: string;
      plan: string;
      perMonth: string;
      perYear: string;
      base: string;
      rate: string;
      amount: string;
      status: string;
      matures: string;
      empty: string;
      statuses: Record<"pending" | "available" | "reserved" | "paid" | "reversed" | "held" | "review", string>;
      reversed: string;
    };
    payouts: {
      title: string;
      intro: string;
      date: string;
      amount: string;
      transfer: string;
      bank: string;
      empty: string;
      transferStates: Record<"pending" | "processing" | "confirmed" | "reversed", string>;
      bankStates: Record<"not_started" | "pending" | "in_transit" | "paid" | "failed", string>;
      schedule: string;
      offset: string;
      arrival: string;
    };
    setup: {
      title: string;
      intro: string;
      states: Record<"not_started" | "setup_required" | "verification_pending" | "restricted" | "ready" | "unavailable", { title: string; body: string }>;
      start: string;
      continue: string;
      dashboard: string;
      refresh: string;
      country: string;
      countryUnsupported: string;
      errors: Record<"generic" | "provider_outcome_unknown" | "onboarding_incomplete" | "suspended" | "disabled", string>;
    };
    resources: { title: string; intro: string; logos: string; logosIntro: string; banners: string; bannersIntro: string; files: { logo: string; logoLight: string; mark: string; banner: string }; copyText: string; download: string; copyTitle: string; copyIntro: string; templates: { title: string; body: string }[]; rules: string; rulesList: string[] };
    settings: { title: string; profile: string; name: string; email: string; country: string; code: string; status: string; statuses: Record<"active" | "suspended", string> };
    pagination: { previous: string; next: string; page: string };
    failure: { title: string; body: string; reference: string; retry: string };
  };
};

const en: PartnerCopy = {
  page: {
    metaTitle: "Affiliate Program: recurring commission",
    metaDescription:
      "Join the RepGet Affiliate Program: share your link, earn a recurring cash commission on what your referrals pay, paid monthly through Stripe.",
    eyebrow: "The RepGet Partner Program",
    eyebrowOpen: "Open for applications",
    eyebrowClosed: "Applications opening soon",
    titleLead: "Recommend RepGet.",
    titleEm: "Get paid",
    titleRest: "as they grow.",
    intro: "Help businesses get found on Google, AI search and social. Earn **{range} commission** on subscription payments from customers you refer, for up to {months} months.",
    ctaApply: "Become a partner",
    ctaExplore: "Explore earnings",
    fineLine: "Free to apply. No paid RepGet plan required.",
    portalQuestion: "Already a partner?",
    portalLink: "Partner login",
    closed: "Applications are not open yet. Please check back soon.",
    calculator: {
      head: "RepGet Partners",
      headSub: "Earnings explorer",
      headBadge: "Interactive estimate",
      network: "Your referral network",
      live: "Live simulation",
      direct: "Direct referrals",
      hint: "Hover or tap a dot",
      hintMany: "{shown} shown · tap a dot",
      svgLabel: "Interactive illustration of the customers you refer directly. Select a point to see its illustrative commission.",
      nodeLabel: "Inspect simulated referral {n}",
      you: "YOU",
      selected: "Selected connection",
      referral: "Referral #{n}",
      kind: "Direct paying customer · simulated",
      perMonth: "per month",
      add: "Add a referral",
      explore: "Explore {count} referrals",
      restart: "Restart network",
      fineprint: "Interactive illustration · Every connection is a **direct** referral, not a downline.",
      scenario: "Build your income scenario",
      plan: "Choose a RepGet plan",
      monthlyPrices: "Monthly prices",
      planPrice: "{price} / mo",
      customers: "Paying customers you refer",
      people: "people",
      rates: "Commission rates",
      from: "From {count}",
      level: "At {count} paying customers you are a {tier}: {rate} of every payment.",
      potential: "Potential commission",
      perMonthShort: " / month",
      projection: "{months}-month projection",
      footStrong: "Real recurring commission.",
      footBody: "Transparent terms. No paid partner subscription.",
      footLink: "Understand how payouts work",
    },
    disclaimer:
      "Illustrative earnings, not a guarantee. Assumes all referred customers pay the selected plan's list price each month for {months} months. Actual commissions apply to eligible payments received, after discounts and excluding taxes, refunds and other adjustments. Higher tier rates apply to payments made after the tier is reached.",
    trust: {
      start: "Starting commission rate",
      top: "Highest available tier",
      monthsValue: "{months} months",
      months: "Commission per referred customer",
      daysValue: "{days} days",
      days: "Referral tracking window",
    },
    ctaStart: "Start referring",
    stepsKicker: "Simpler than you think",
    stepsTitle: "Three steps. A growing reward.",
    stepsIntro: "Whether you have a large audience or a handful of business contacts, referring RepGet is straightforward.",
    stepLabel: "Step {n}",
    steps: [
      { title: "Join as a partner", body: "Apply with your existing or free RepGet account. Every application is reviewed personally." },
      { title: "Share your unique link", body: "Recommend a connected growth platform for SEO, AI visibility, content and social. Your link tracks new signups." },
      { title: "Earn when they subscribe", body: "Receive commission on eligible subscription payments for up to {months} months per new referred customer." },
    ],
    tiersKicker: "Your income can grow",
    tiersTitle: "More customers.\nBetter commission.",
    tiersIntro: "Your commission rate increases as your number of referred paying accounts reaches the next tier.",
    tierLevel: "{n} / {name}",
    tierTop: "Highest tier",
    tierStartTitle: "Start earning immediately",
    tierStartBody: "Your starting commission on eligible subscription payments from referred customers.",
    tierFromTitle: "From {count} paying referrals",
    tierNextBody: "Reach {count} referred paying customers and unlock a higher commission on subsequent eligible payments.",
    tierTopBody: "Unlock the top rate on subsequent eligible subscription payments. No published total earnings cap.",
    audienceKicker: "Built for people who recommend good tools",
    audienceTitle: "Your influence already has value.",
    audienceIntro: "RepGet helps businesses grow across search and social. When your audience needs that, you have something genuinely useful to share.",
    audience: [
      { title: "SEO & marketing agencies", body: "Recommend a growth platform to the clients you already advise." },
      { title: "Creators & educators", body: "Show RepGet in videos, guides, newsletters and tutorials." },
      { title: "Bloggers & publishers", body: "Turn helpful recommendations into a partner revenue stream." },
      { title: "Consultants & founders", body: "Introduce tools that help other businesses find more customers." },
    ],
    quoteKicker: "Why partner with RepGet?",
    quoteLead: "You're not selling another software tool.",
    quoteEm: "You're introducing a way to grow.",
    quoteFoot: "Content. SEO. Backlinks. AI visibility. Social distribution.",
    quoteFoot2: "One connected platform for business growth.",
    faqKicker: "The details matter",
    faqTitle: "Good questions.\nClear answers.",
    faqIntro: "Transparent terms help you decide whether the RepGet Partner Program is right for you.",
    faq: [
      {
        question: "How much can I actually earn?",
        answer:
          "You start at {rate} commission on eligible subscription payments made by new customers you refer. The rate rises with the number of paying customers you refer: {tiers}. Each referred customer can generate commission for {months} months from their first payment. There is no published cap on total earnings, but results depend on actual payments and referrals.",
      },
      {
        question: "When and how do I get paid?",
        payout: true,
        answer:
          "Payouts run on the first of each month once commissions are at least {maturity} days old and your available balance reaches {amount}. Smaller balances carry over to the next payout cycle. Payouts are sent to your bank account through Stripe Connect, or via PayPal where that option is available.",
      },
      { question: "Do I need to pay for RepGet to join?", answer: "No. You can apply using a free RepGet account or the account you already have. Applications are reviewed manually." },
      {
        question: "What counts as a referral?",
        answer:
          "Only new RepGet accounts can qualify. Tracking lasts for {days} days after your partner link is opened, and the first partner link a visitor opens is attributed. Existing accounts, your own accounts and team members invited to another account do not qualify.",
      },
      {
        question: "Do I earn on referrals made by other partners?",
        answer: "No. RepGet's published partner program currently pays on customers you refer directly. The commission levels are performance tiers, not a multi-level referral network.",
      },
      {
        question: "Are commissions based on the advertised plan price?",
        answer:
          "No. Commission is calculated on eligible subscription payments actually collected, after discounts and excluding taxes, refunds, chargebacks and credits. Payments by card and by PayPal both count; partner coupon codes can only be used when paying by card. New tier rates apply to eligible payments made after you reach the applicable tier.",
      },
      {
        question: "Can I offer my audience a discount?",
        answer:
          "Partner coupons are not automatic, but RepGet may provide a personal discount code to eligible creators and agencies. When a new customer uses your assigned code, the referral can be attributed to you.",
      },
      {
        question: "Where can I track my referrals and earnings?",
        answer:
          "Your partner portal brings together referral-link clicks, new registrations, paying customers, earned commissions and payout history. You can also access promotional materials to share with your audience.",
      },
      {
        question: "What happens if a customer cancels or receives a refund?",
        answer:
          "You earn commission only on eligible payments actually collected. If a customer cancels, there are no commissions on future unpaid periods. Refunds and chargebacks reverse the related commission, including after payout; adjustments are deducted from future payouts.",
      },
    ],
    credits: {
      faq: "For now, partners are paid in RepGet credits, not cash. Each commission becomes credits {maturity} days after the customer's payment, with no minimum: {rate}. The credits go to a workspace you own, chosen in your partner portal. If a customer is refunded after that, the amount is deducted from your next credits.",
      rate: "{credits} credits for every {price} of commission, the price of the smallest credit pack",
      rateUnknown: "at the price of the smallest credit pack",
      disclaimer: "Commissions are currently paid as RepGet credits.",
    },
    tierPhrase: "{rate} from {count} paying customers",
    ctaKicker: "Your next introduction could pay off",
    ctaTitle: "Help the right businesses grow. Get rewarded for it.",
    ctaButton: "Apply to become a partner",
    ctaSmall: "Free to apply · Reviewed by a real person",
    creditBody: "Already a RepGet customer? You can also refer businesses for RepGet credit instead of cash.",
    creditLink: "Refer a business for credit",
  },
  portal: {
    title: "Partner portal",
    nav: { overview: "Overview", referrals: "Referrals", commissions: "Commissions", payouts: "Payouts", resources: "Resources", settings: "Settings", apply: "Apply", backToApp: "Back to RepGet" },
    testMode: "Test mode: no real money moves.",
    verify: {
      title: "Confirm your email address first",
      body: "The Affiliate Program pays real money, so we need to know this address is yours. We will send a six-digit code.",
      send: "Send the code",
      sent: "We sent a code to {email}.",
      code: "Six-digit code",
      confirm: "Confirm",
      errors: { INVALID: "That code is not right.", EXPIRED: "That code has expired. Send a new one.", TOO_MANY: "Too many attempts. Send a new code.", FAILED: "We could not confirm the code. Try again." },
    },
    apply: {
      title: "Apply to become a RepGet partner",
      eyebrow: "RepGet Partner Program",
      heading: "Let's grow together.",
      intro: "Join our affiliate program. Tell us about your audience and how you plan to introduce RepGet.",
      cardTitle: "Become a partner",
      cardIntro: "A few details to help us review your application.",
      chip: "Reviewed individually",
      website: "Website or social channel",
      websiteHint: "Your website, newsletter, YouTube or social media profile.",
      websitePlaceholder: "https://yourwebsite.com",
      audience: "Your audience",
      audienceHint: "Tell us a little about the people you reach.",
      audiencePlaceholder: "Who follows you, where they're based and approximately how many people you reach...",
      promotion: "How will you promote RepGet?",
      promotionHint: "A short outline is perfect.",
      promotionPlaceholder: "For example: product reviews, tutorial videos, newsletters, blog content or client recommendations...",
      counter: "{count} / {max}",
      country: "Payout country",
      countryHint: "Payout availability varies by country. Bank payouts and PayPal are available to eligible partners.",
      countryHintCredits: "Partners are currently paid in RepGet credits, added to a workspace you choose. Choose the country you are based in.",
      countryPlaceholder: "Select your country",
      terms: "I agree to the {link} and understand that my application is subject to review.",
      termsLink: "Partner Program terms",
      required: "required",
      submit: "Submit application",
      submitting: "Submitting…",
      privacy: "Your information is used to review your application.",
      questions: "Questions about partnering?",
      questionsLink: "Explore the Partner Program",
      closed: "Applications are closed at the moment.",
      pendingTitle: "Your application is being reviewed",
      pendingBody: "We will email you at {email} when it has been reviewed.",
      rejectedTitle: "Your last application was not approved",
      rejectedBody: "You can apply again with more detail about your audience.",
      errors: {
        invalid: "Please check the form.",
        website: "Enter a valid URL starting with https:// or http://.",
        audience: "Please add a little more detail (at least {min} characters).",
        promotion: "Please describe how you plan to promote RepGet (at least {min} characters).",
        country: "Please select your country.",
        terms: "Please accept the Partner Program terms.",
        rate_limited: "Too many applications. Try again tomorrow.",
        disabled: "Applications are closed at the moment.",
        already_processed: "You have already applied.",
        generic: "Something went wrong. Please try again.",
      },
    },
    suspended: { title: "Your partner account is suspended", body: "Your history is still here. New commissions and payouts are paused. Contact us if you think this is a mistake." },
    hold: { title: "Payouts are on hold", body: "Your earnings are safe; automatic payouts are paused while we review your account." },
    overview: {
      title: "Overview",
      linkTitle: "Your partner link",
      linkHint: "Visitors who open it and create a new RepGet account within {days} days are attributed to you.",
      linkAnyPage: "It also works on any RepGet page: add ?ref={code} to the address, for example {example}.",
      copy: "Copy link",
      copied: "Copied",
      tierTitle: "Your partner level",
      progress: "{count} / {target} paying customers",
      remaining: "{count} more customers to reach {tier}.",
      topTier: "You are on the top level.",
      recurring: "{rate} recurring commission",
      nextLevel: "Next level",
      levelRate: "{rate} commission",
      cards: { earned: "Total earned", pending: "Pending", paid: "Paid", referrals: "Referrals", payingCustomers: "Paying customers" },
      definitions: {
        earned: "Commission earned, minus refunds and chargebacks.",
        pending: "Earned, not paid to you yet.",
        paid: "Sent to you through Stripe.",
        referrals: "Customers you referred, by link or coupon (disqualified ones not counted).",
        payingCustomers: "Referred customers paying now. This number sets your tier.",
      },
      breakdown: { approved: "Approved, paid at the next payout: {amount}", waiting: "Waiting the {maturity} days, held or under review: {amount}", sending: "Being sent now: {amount}", inBank: "Already in your bank: {amount}" },
      latestTitle: "Latest commissions",
      latestAll: "All commissions",
      noEarnings: "No commission yet. Share your link to get started.",
      noThreshold: "Automatic payouts are not available for {currency} yet. Your balance is kept and shown here.",
      threshold: "Payouts start once your approved balance reaches {amount}.",
      metrics: {
        clicks: "Link clicks",
        signups: "New accounts",
        referred: "Referred customers",
        customers: "Customers who paid",
        conversion: "Clicks to paying",
        range: "Last {days} days",
        period: "Period",
        since: "{start} to {end} (UTC)",
        definition: "Counted in the period: link opens recorded, new accounts created through your link, customers attributed to you (link or coupon), and those of them who made a commissionable payment.",
      },
      balancesTitle: "Earnings",
      currencyNote: "Each currency is shown on its own. Amounts are never converted.",
      offset: "{amount} will be deducted from upcoming payouts (a refund or correction after a payout).",
      nextPayout: "Next payout run: {date}",
      couponsTitle: "Your coupons",
      copyCode: "Copy code",
      noCoupons: "No coupon has been assigned to you.",
      couponDiscount: "{discount} for new customers",
    },
    referrals: {
      title: "Referrals",
      intro: "Accounts attributed to you. Customers are shown by a shortened website address or a reference, never by name or email.",
      customer: "Customer",
      source: "Source",
      since: "Since",
      status: "Status",
      empty: "No referrals yet.",
      statuses: { active: "Active", review: "Under review", disqualified: "Not eligible" },
      sources: { link: "Link", coupon: "Coupon" },
    },
    commissions: {
      title: "Commissions",
      intro: "One line per payment a referred customer made. Amounts are in the currency they paid.",
      date: "Payment date",
      customer: "Customer",
      plan: "Plan",
      perMonth: "{price}/month",
      perYear: "{price}/year",
      base: "Paid (excl. tax)",
      rate: "Rate",
      amount: "Commission",
      status: "Status",
      matures: "Payable from",
      empty: "No commissions yet.",
      statuses: { pending: "Pending", available: "Approved", reserved: "In payout", paid: "Paid", reversed: "Reversed", held: "On hold", review: "Under review" },
      reversed: "{amount} reversed",
    },
    payouts: {
      title: "Payouts",
      intro: "Each payout is sent to your Stripe balance first, then from Stripe to your bank. Both steps are shown.",
      date: "Date",
      amount: "Amount",
      transfer: "To your Stripe balance",
      bank: "To your bank",
      empty: "No payouts yet.",
      transferStates: { pending: "Preparing", processing: "Sending", confirmed: "Sent", reversed: "Reversed" },
      bankStates: { not_started: "Not started", pending: "Pending", in_transit: "On the way", paid: "Paid", failed: "Failed - we will retry" },
      schedule: "Payouts run on the first day of each month.",
      offset: "{amount} deducted for corrections",
      arrival: "Expected by {date}",
    },
    setup: {
      title: "Payout setup",
      intro: "Payouts go through Stripe. Stripe asks for your identity and bank details; RepGet never sees them.",
      states: {
        not_started: { title: "Set up payouts", body: "You can earn before setting this up. You will need it to be paid." },
        setup_required: { title: "Finish your Stripe setup", body: "Stripe still needs some details before it can pay you." },
        verification_pending: { title: "Stripe is checking your details", body: "This usually takes a few minutes, sometimes a few days. Nothing to do for now." },
        restricted: { title: "Stripe needs more information", body: "Payouts are paused until the missing details are provided." },
        ready: { title: "Payouts are ready", body: "Your payouts will be sent automatically." },
        unavailable: { title: "Payouts are not available yet", body: "Payout setup is not open on this site yet. Your earnings are recorded." },
      },
      start: "Set up payouts with Stripe",
      continue: "Continue with Stripe",
      dashboard: "Open your Stripe dashboard",
      refresh: "Check status again",
      country: "Payout country: {country}",
      countryUnsupported: "Payouts are not available in {country} yet. Contact us to change your payout country.",
      errors: {
        generic: "Stripe could not be reached. Try again in a moment.",
        provider_outcome_unknown: "We did not hear back from Stripe. Try again - nothing will be set up twice.",
        onboarding_incomplete: "Finish your Stripe setup first.",
        suspended: "Your partner account is suspended.",
        disabled: "Payout setup is not available yet.",
      },
    },
    resources: {
      title: "Resources",
      intro: "Logos and ready-made text you are welcome to use. Please describe RepGet accurately.",
      logos: "Logos",
      logosIntro: "Use the logo as provided: do not change its colours or proportions.",
      banners: "Banners",
      bannersIntro: "Ready-made images for websites and newsletters. Link them to your partner link.",
      files: { logo: "Logo for light backgrounds", logoLight: "Logo for dark backgrounds", mark: "Icon", banner: "Banner {size}" },
      copyText: "Copy text",
      download: "Download",
      copyTitle: "Text you can use",
      copyIntro: "Edit freely. Please do not promise results or earnings.",
      templates: [
        { title: "Short", body: "I use RepGet to plan, write and publish SEO articles for my sites. Try it: {link}" },
        { title: "Newsletter", body: "If you publish content to bring in search traffic, RepGet researches keywords, writes articles in your voice and publishes them to your site. Have a look: {link}" },
        { title: "For clients", body: "For your blog we can use RepGet, which turns keyword research into a publishing plan and writes the articles for review. Here is the link: {link}" },
      ],
      rules: "When you promote RepGet",
      rulesList: [
        "Say that you are a partner and may earn a commission.",
        "Do not bid on the RepGet name in search ads, or use our name in domains or social accounts.",
        "Do not promise rankings, traffic or income.",
        "Do not send unsolicited messages.",
      ],
    },
    settings: { title: "Settings", profile: "Partner profile", name: "Name", email: "Email", country: "Payout country", code: "Referral code", status: "Status", statuses: { active: "Active", suspended: "Suspended" } },
    pagination: { previous: "Previous", next: "Next", page: "Page {page} of {pages}" },
    failure: { title: "This page could not be loaded", body: "Trying again usually works. Your earnings and payouts are not affected.", reference: "If it keeps happening, quote reference {reference} to support.", retry: "Try again" },
  },
};

const es: PartnerCopy = {
  page: {
    metaTitle: "Programa de afiliados: comisión recurrente",
    metaDescription:
      "Únase al programa de afiliados de RepGet: comparta su enlace y gane una comisión recurrente sobre lo que pagan sus referidos, abonada cada mes con Stripe.",
    eyebrow: "Programa de socios de RepGet",
    eyebrowOpen: "Solicitudes abiertas",
    eyebrowClosed: "Solicitudes próximamente",
    titleLead: "Recomiende RepGet.",
    titleEm: "Gane dinero",
    titleRest: "mientras ellos crecen.",
    intro: "Ayude a las empresas a aparecer en Google, en las búsquedas con IA y en redes sociales. Gane **una comisión del {range}** sobre los pagos de suscripción de los clientes que recomiende, durante un máximo de {months} meses.",
    ctaApply: "Hacerse socio",
    ctaExplore: "Ver ganancias",
    fineLine: "Solicitud gratuita. No necesita un plan de pago de RepGet.",
    portalQuestion: "¿Ya es socio?",
    portalLink: "Acceso para socios",
    closed: "Las solicitudes aún no están abiertas. Vuelva pronto.",
    calculator: {
      head: "Socios de RepGet",
      headSub: "Explorador de ganancias",
      headBadge: "Estimación interactiva",
      network: "Su red de referidos",
      live: "Simulación en directo",
      direct: "Referidos directos",
      hint: "Pase el cursor o toque un punto",
      hintMany: "{shown} visibles · toque un punto",
      svgLabel: "Ilustración interactiva de los clientes que usted recomienda directamente. Seleccione un punto para ver su comisión ilustrativa.",
      nodeLabel: "Ver el referido simulado {n}",
      you: "USTED",
      selected: "Conexión seleccionada",
      referral: "Referido n.º {n}",
      kind: "Cliente de pago directo · simulado",
      perMonth: "al mes",
      add: "Añadir un referido",
      explore: "Ver {count} referidos",
      restart: "Reiniciar la red",
      fineprint: "Ilustración interactiva · Cada conexión es un referido **directo**, no una red multinivel.",
      scenario: "Cree su escenario de ingresos",
      plan: "Elija un plan de RepGet",
      monthlyPrices: "Precios mensuales",
      planPrice: "{price} / mes",
      customers: "Clientes de pago que recomienda",
      people: "personas",
      rates: "Tasas de comisión",
      from: "Desde {count}",
      level: "Con {count} clientes de pago es {tier}: {rate} de cada pago.",
      potential: "Comisión posible",
      perMonthShort: " / mes",
      projection: "Proyección a {months} meses",
      footStrong: "Comisión recurrente real.",
      footBody: "Condiciones transparentes. Sin cuota de socio.",
      footLink: "Cómo funcionan los pagos",
    },
    disclaimer:
      "Ganancias ilustrativas, no garantizadas. Supone que todos los clientes recomendados pagan el precio de lista del plan elegido cada mes durante {months} meses. Las comisiones reales se aplican a los pagos válidos recibidos, después de descuentos y sin impuestos, reembolsos ni otros ajustes. Las tasas de un nivel superior se aplican a los pagos realizados después de alcanzarlo.",
    trust: {
      start: "Comisión inicial",
      top: "Nivel más alto disponible",
      monthsValue: "{months} meses",
      months: "De comisión por cliente recomendado",
      daysValue: "{days} días",
      days: "De seguimiento del referido",
    },
    ctaStart: "Empezar a recomendar",
    stepsKicker: "Más sencillo de lo que cree",
    stepsTitle: "Tres pasos. Una recompensa que crece.",
    stepsIntro: "Tanto si tiene una gran audiencia como unos pocos contactos profesionales, recomendar RepGet es sencillo.",
    stepLabel: "Paso {n}",
    steps: [
      { title: "Únase como socio", body: "Solicítelo con su cuenta de RepGet actual o con una gratuita. Revisamos cada solicitud personalmente." },
      { title: "Comparta su enlace único", body: "Recomiende una plataforma de crecimiento conectada para SEO, visibilidad en IA, contenido y redes sociales. Su enlace registra las nuevas altas." },
      { title: "Gane cuando se suscriban", body: "Reciba comisión sobre los pagos de suscripción válidos durante un máximo de {months} meses por cada nuevo cliente recomendado." },
    ],
    tiersKicker: "Sus ingresos pueden crecer",
    tiersTitle: "Más clientes.\nMejor comisión.",
    tiersIntro: "Su tasa de comisión sube cuando el número de cuentas de pago que ha recomendado alcanza el siguiente nivel.",
    tierLevel: "{n} / {name}",
    tierTop: "Nivel más alto",
    tierStartTitle: "Empiece a ganar desde el primer día",
    tierStartBody: "Su comisión inicial sobre los pagos de suscripción válidos de los clientes recomendados.",
    tierFromTitle: "Desde {count} referidos de pago",
    tierNextBody: "Alcance {count} clientes de pago recomendados y obtenga una comisión más alta en los pagos válidos siguientes.",
    tierTopBody: "Obtenga la tasa más alta en los pagos de suscripción válidos siguientes. Sin límite publicado de ganancias totales.",
    audienceKicker: "Para quienes recomiendan buenas herramientas",
    audienceTitle: "Su influencia ya tiene valor.",
    audienceIntro: "RepGet ayuda a las empresas a crecer en buscadores y redes sociales. Cuando su audiencia lo necesita, tiene algo realmente útil que compartir.",
    audience: [
      { title: "Agencias de SEO y marketing", body: "Recomiende una plataforma de crecimiento a los clientes que ya asesora." },
      { title: "Creadores y formadores", body: "Muestre RepGet en vídeos, guías, boletines y tutoriales." },
      { title: "Blogueros y editores", body: "Convierta sus recomendaciones útiles en una fuente de ingresos como socio." },
      { title: "Consultores y fundadores", body: "Presente herramientas que ayudan a otras empresas a conseguir más clientes." },
    ],
    quoteKicker: "¿Por qué ser socio de RepGet?",
    quoteLead: "No vende otra herramienta de software más.",
    quoteEm: "Presenta una forma de crecer.",
    quoteFoot: "Contenido. SEO. Backlinks. Visibilidad en IA. Difusión en redes.",
    quoteFoot2: "Una plataforma conectada para el crecimiento de las empresas.",
    faqKicker: "Los detalles importan",
    faqTitle: "Buenas preguntas.\nRespuestas claras.",
    faqIntro: "Unas condiciones transparentes le ayudan a decidir si el programa de socios de RepGet es para usted.",
    faq: [
      {
        question: "¿Cuánto puedo ganar realmente?",
        answer:
          "Empieza con una comisión del {rate} sobre los pagos de suscripción válidos de los nuevos clientes que recomiende. La tasa sube con el número de clientes de pago que recomiende: {tiers}. Cada cliente recomendado puede generar comisión durante {months} meses desde su primer pago. No hay un límite publicado de ganancias totales, pero los resultados dependen de los pagos y referidos reales.",
      },
      {
        question: "¿Cuándo y cómo cobro?",
        payout: true,
        answer:
          "Los pagos se hacen el día 1 de cada mes, cuando las comisiones tienen al menos {maturity} días y su saldo disponible llega a {amount}. Los saldos menores pasan al siguiente ciclo de pago. Los pagos se envían a su cuenta bancaria a través de Stripe Connect, o mediante PayPal donde esa opción esté disponible.",
      },
      { question: "¿Tengo que pagar RepGet para unirme?", answer: "No. Puede solicitarlo con una cuenta gratuita de RepGet o con la que ya tiene. Las solicitudes se revisan a mano." },
      {
        question: "¿Qué cuenta como referido?",
        answer:
          "Solo pueden contar las cuentas nuevas de RepGet. El seguimiento dura {days} días desde que se abre su enlace de socio, y cuenta el primer enlace de socio que abre un visitante. Las cuentas existentes, sus propias cuentas y los miembros de equipo invitados a otra cuenta no cuentan.",
      },
      {
        question: "¿Gano por los referidos de otros socios?",
        answer: "No. El programa de socios publicado de RepGet paga por los clientes que usted recomienda directamente. Los niveles de comisión son niveles de rendimiento, no una red de referidos multinivel.",
      },
      {
        question: "¿La comisión se basa en el precio anunciado del plan?",
        answer:
          "No. La comisión se calcula sobre los pagos de suscripción válidos cobrados realmente, después de descuentos y sin impuestos, reembolsos, contracargos ni créditos. Cuentan tanto los pagos con tarjeta como con PayPal; los códigos de cupón de socio solo se pueden usar al pagar con tarjeta. Las tasas de un nuevo nivel se aplican a los pagos válidos realizados después de alcanzarlo.",
      },
      {
        question: "¿Puedo ofrecer un descuento a mi audiencia?",
        answer:
          "Los cupones de socio no son automáticos, pero RepGet puede asignar un código de descuento personal a creadores y agencias que cumplan los requisitos. Cuando un nuevo cliente usa su código, el referido se le puede atribuir.",
      },
      {
        question: "¿Dónde sigo mis referidos y ganancias?",
        answer:
          "Su portal de socio reúne los clics en su enlace, los nuevos registros, los clientes de pago, las comisiones obtenidas y el historial de pagos. También tiene materiales promocionales para compartir con su audiencia.",
      },
      {
        question: "¿Qué pasa si un cliente cancela o recibe un reembolso?",
        answer:
          "Solo gana comisión sobre los pagos válidos cobrados realmente. Si un cliente cancela, no hay comisiones sobre periodos futuros no pagados. Los reembolsos y contracargos anulan la comisión correspondiente, incluso después del pago; los ajustes se descuentan de los pagos futuros.",
      },
    ],
    credits: {
      faq: "Por ahora, los socios cobran en créditos de RepGet, no en dinero. Cada comisión se convierte en créditos {maturity} días después del pago del cliente, sin mínimo: {rate}. Los créditos van a un espacio de trabajo suyo, que usted elige en su portal de socio. Si después se reembolsa a un cliente, el importe se descuenta de sus próximos créditos.",
      rate: "{credits} créditos por cada {price} de comisión, el precio del paquete de créditos más pequeño",
      rateUnknown: "al precio del paquete de créditos más pequeño",
      disclaimer: "Por ahora, las comisiones se pagan en créditos de RepGet.",
    },
    tierPhrase: "{rate} desde {count} clientes de pago",
    ctaKicker: "Su próxima recomendación puede dar frutos",
    ctaTitle: "Ayude a crecer a las empresas adecuadas. Y reciba una recompensa.",
    ctaButton: "Solicitar ser socio",
    ctaSmall: "Solicitud gratuita · Revisada por una persona",
    creditBody: "¿Ya es cliente de RepGet? También puede recomendar empresas a cambio de crédito de RepGet en lugar de dinero.",
    creditLink: "Recomendar una empresa a cambio de crédito",
  },
  portal: {
    title: "Portal de socios",
    nav: { overview: "Resumen", referrals: "Referidos", commissions: "Comisiones", payouts: "Pagos", resources: "Recursos", settings: "Ajustes", apply: "Solicitar", backToApp: "Volver a RepGet" },
    testMode: "Modo de prueba: no se mueve dinero real.",
    verify: {
      title: "Confirme primero su dirección de correo",
      body: "El programa de afiliados paga dinero real, por lo que necesitamos saber que esta dirección es suya. Le enviaremos un código de seis dígitos.",
      send: "Enviar el código",
      sent: "Hemos enviado un código a {email}.",
      code: "Código de seis dígitos",
      confirm: "Confirmar",
      errors: { INVALID: "Ese código no es correcto.", EXPIRED: "El código ha caducado. Solicite uno nuevo.", TOO_MANY: "Demasiados intentos. Solicite un código nuevo.", FAILED: "No pudimos confirmar el código. Inténtelo de nuevo." },
    },
    apply: {
      title: "Solicite ser socio de RepGet",
      eyebrow: "Programa de socios de RepGet",
      heading: "Crezcamos juntos.",
      intro: "Únase a nuestro programa de afiliados. Cuéntenos sobre su audiencia y cómo piensa presentar RepGet.",
      cardTitle: "Hacerse socio",
      cardIntro: "Unos datos para ayudarnos a revisar su solicitud.",
      chip: "Revisión individual",
      website: "Sitio web o canal social",
      websiteHint: "Su sitio web, boletín, canal de YouTube o perfil en redes sociales.",
      websitePlaceholder: "https://susitioweb.com",
      audience: "Su audiencia",
      audienceHint: "Cuéntenos un poco sobre las personas a las que llega.",
      audiencePlaceholder: "Quién le sigue, dónde está y a cuántas personas llega aproximadamente...",
      promotion: "¿Cómo promocionará RepGet?",
      promotionHint: "Basta con un breve resumen.",
      promotionPlaceholder: "Por ejemplo: reseñas de productos, vídeos tutoriales, boletines, artículos de blog o recomendaciones a clientes...",
      counter: "{count} / {max}",
      country: "País de cobro",
      countryHint: "La disponibilidad de los pagos varía según el país. Los pagos bancarios y PayPal están disponibles para los socios que cumplan los requisitos.",
      countryHintCredits: "Por ahora, los socios cobran en créditos de RepGet, que se añaden al espacio de trabajo que usted elija. Elija el país donde reside.",
      countryPlaceholder: "Seleccione su país",
      terms: "Acepto las {link} y entiendo que mi solicitud está sujeta a revisión.",
      termsLink: "condiciones del programa de socios",
      required: "obligatorio",
      submit: "Enviar solicitud",
      submitting: "Enviando…",
      privacy: "Sus datos se usan para revisar su solicitud.",
      questions: "¿Preguntas sobre el programa?",
      questionsLink: "Conozca el programa de socios",
      closed: "Las solicitudes están cerradas en este momento.",
      pendingTitle: "Estamos revisando su solicitud",
      pendingBody: "Le escribiremos a {email} cuando la hayamos revisado.",
      rejectedTitle: "Su última solicitud no fue aprobada",
      rejectedBody: "Puede volver a solicitarlo con más detalles sobre su audiencia.",
      errors: {
        invalid: "Revise el formulario.",
        website: "Introduzca una URL válida que empiece por https:// o http://.",
        audience: "Añada un poco más de detalle (al menos {min} caracteres).",
        promotion: "Describa cómo piensa promocionar RepGet (al menos {min} caracteres).",
        country: "Seleccione su país.",
        terms: "Acepte las condiciones del programa de socios.",
        rate_limited: "Demasiadas solicitudes. Inténtelo de nuevo mañana.",
        disabled: "Las solicitudes están cerradas en este momento.",
        already_processed: "Ya ha enviado una solicitud.",
        generic: "Algo ha fallado. Inténtelo de nuevo.",
      },
    },
    suspended: { title: "Su cuenta de socio está suspendida", body: "Su historial sigue aquí. Las nuevas comisiones y los pagos están en pausa. Contáctenos si cree que es un error." },
    hold: { title: "Los pagos están retenidos", body: "Sus ganancias están a salvo; los pagos automáticos están en pausa mientras revisamos su cuenta." },
    overview: {
      title: "Resumen",
      linkTitle: "Su enlace de socio",
      linkHint: "Los visitantes que lo abran y creen una cuenta nueva de RepGet en {days} días se le atribuyen a usted.",
      linkAnyPage: "También funciona en cualquier página de RepGet: añada ?ref={code} a la dirección, por ejemplo {example}.",
      copy: "Copiar enlace",
      copied: "Copiado",
      tierTitle: "Su nivel de socio",
      progress: "{count} / {target} clientes de pago",
      remaining: "{count} clientes más para llegar a {tier}.",
      topTier: "Está en el nivel más alto.",
      recurring: "{rate} de comisión recurrente",
      nextLevel: "Siguiente nivel",
      levelRate: "{rate} de comisión",
      cards: { earned: "Total ganado", pending: "Pendiente", paid: "Pagado", referrals: "Referidos", payingCustomers: "Clientes de pago" },
      definitions: {
        earned: "Comisión ganada, menos reembolsos y contracargos.",
        pending: "Ganado, aún no se le ha pagado.",
        paid: "Enviado a usted a través de Stripe.",
        referrals: "Clientes que usted recomendó, por enlace o cupón (sin contar los descalificados).",
        payingCustomers: "Clientes recomendados que pagan ahora. Este número determina su nivel.",
      },
      breakdown: { approved: "Aprobado, se paga en el próximo pago: {amount}", waiting: "Esperando los {maturity} días, retenido o en revisión: {amount}", sending: "Enviándose ahora: {amount}", inBank: "Ya en su banco: {amount}" },
      latestTitle: "Últimas comisiones",
      latestAll: "Todas las comisiones",
      noEarnings: "Aún no hay comisiones. Comparta su enlace para empezar.",
      noThreshold: "Los pagos automáticos aún no están disponibles en {currency}. Su saldo se conserva y se muestra aquí.",
      threshold: "Los pagos empiezan cuando su saldo aprobado alcanza {amount}.",
      metrics: {
        clicks: "Clics en el enlace",
        signups: "Cuentas nuevas",
        referred: "Clientes referidos",
        customers: "Clientes que pagaron",
        conversion: "De clic a pago",
        range: "Últimos {days} días",
        period: "Periodo",
        since: "Del {start} al {end} (UTC)",
        definition: "Contados en el periodo: aperturas registradas de su enlace, cuentas nuevas creadas con su enlace, clientes que se le atribuyen (enlace o cupón) y, de ellos, los que hicieron un pago con comisión.",
      },
      balancesTitle: "Ganancias",
      currencyNote: "Cada moneda se muestra por separado. Los importes nunca se convierten.",
      offset: "Se descontarán {amount} de los próximos pagos (un reembolso o una corrección posterior a un pago).",
      nextPayout: "Próximo pago: {date}",
      couponsTitle: "Sus cupones",
      copyCode: "Copiar código",
      noCoupons: "No tiene ningún cupón asignado.",
      couponDiscount: "{discount} para clientes nuevos",
    },
    referrals: {
      title: "Referidos",
      intro: "Cuentas que se le atribuyen. Los clientes se muestran con una dirección web abreviada o una referencia, nunca por nombre ni correo.",
      customer: "Cliente",
      source: "Origen",
      since: "Desde",
      status: "Estado",
      empty: "Aún no hay referidos.",
      statuses: { active: "Activo", review: "En revisión", disqualified: "No válido" },
      sources: { link: "Enlace", coupon: "Cupón" },
    },
    commissions: {
      title: "Comisiones",
      intro: "Una línea por cada pago de un cliente recomendado. Los importes están en la moneda en que pagó.",
      date: "Fecha de pago",
      customer: "Cliente",
      plan: "Plan",
      perMonth: "{price}/mes",
      perYear: "{price}/año",
      base: "Pagado (sin impuestos)",
      rate: "Porcentaje",
      amount: "Comisión",
      status: "Estado",
      matures: "Pagable desde",
      empty: "Aún no hay comisiones.",
      statuses: { pending: "Pendiente", available: "Aprobada", reserved: "En pago", paid: "Pagada", reversed: "Anulada", held: "Retenida", review: "En revisión" },
      reversed: "{amount} anulado",
    },
    payouts: {
      title: "Pagos",
      intro: "Cada pago se envía primero a su saldo de Stripe y después de Stripe a su banco. Se muestran ambos pasos.",
      date: "Fecha",
      amount: "Importe",
      transfer: "A su saldo de Stripe",
      bank: "A su banco",
      empty: "Aún no hay pagos.",
      transferStates: { pending: "Preparando", processing: "Enviando", confirmed: "Enviado", reversed: "Anulado" },
      bankStates: { not_started: "Sin iniciar", pending: "Pendiente", in_transit: "En camino", paid: "Pagado", failed: "Fallido - lo reintentaremos" },
      schedule: "Los pagos se realizan el primer día de cada mes.",
      offset: "{amount} descontados por correcciones",
      arrival: "Llegada prevista: {date}",
    },
    setup: {
      title: "Configuración de pagos",
      intro: "Los pagos se realizan con Stripe. Stripe le pide su identidad y datos bancarios; RepGet nunca los ve.",
      states: {
        not_started: { title: "Configure los pagos", body: "Puede ganar comisiones antes de configurarlo. Lo necesitará para cobrar." },
        setup_required: { title: "Complete su configuración en Stripe", body: "Stripe todavía necesita algunos datos para poder pagarle." },
        verification_pending: { title: "Stripe está comprobando sus datos", body: "Suele tardar unos minutos, a veces unos días. No tiene que hacer nada por ahora." },
        restricted: { title: "Stripe necesita más información", body: "Los pagos están en pausa hasta que se aporten los datos que faltan." },
        ready: { title: "Los pagos están listos", body: "Sus pagos se enviarán automáticamente." },
        unavailable: { title: "Los pagos aún no están disponibles", body: "La configuración de pagos aún no está abierta en este sitio. Sus ganancias quedan registradas." },
      },
      start: "Configurar pagos con Stripe",
      continue: "Continuar con Stripe",
      dashboard: "Abrir su panel de Stripe",
      refresh: "Comprobar de nuevo",
      country: "País de cobro: {country}",
      countryUnsupported: "Los pagos aún no están disponibles en {country}. Contáctenos para cambiar su país de cobro.",
      errors: {
        generic: "No se pudo contactar con Stripe. Inténtelo en un momento.",
        provider_outcome_unknown: "Stripe no respondió. Inténtelo de nuevo: nada se configurará dos veces.",
        onboarding_incomplete: "Complete primero su configuración en Stripe.",
        suspended: "Su cuenta de socio está suspendida.",
        disabled: "La configuración de pagos aún no está disponible.",
      },
    },
    resources: {
      title: "Recursos",
      intro: "Logotipos y textos que puede usar. Describa RepGet con precisión.",
      logos: "Logotipos",
      logosIntro: "Use el logotipo tal cual: no cambie sus colores ni sus proporciones.",
      banners: "Banners",
      bannersIntro: "Imágenes listas para webs y boletines. Enlácelas a su enlace de partner.",
      files: { logo: "Logotipo para fondos claros", logoLight: "Logotipo para fondos oscuros", mark: "Icono", banner: "Banner {size}" },
      copyText: "Copiar texto",
      download: "Descargar",
      copyTitle: "Textos que puede usar",
      copyIntro: "Modifíquelos libremente. No prometa resultados ni ganancias.",
      templates: [
        { title: "Breve", body: "Uso RepGet para planificar, escribir y publicar artículos SEO en mis sitios. Pruébelo: {link}" },
        { title: "Boletín", body: "Si publica contenido para atraer tráfico de búsqueda, RepGet investiga palabras clave, escribe artículos con su estilo y los publica en su sitio. Écheles un vistazo: {link}" },
        { title: "Para clientes", body: "Para su blog podemos usar RepGet, que convierte la investigación de palabras clave en un plan de publicación y redacta los artículos para su revisión. Aquí tiene el enlace: {link}" },
      ],
      rules: "Al promocionar RepGet",
      rulesList: [
        "Indique que es socio y que puede recibir una comisión.",
        "No puje por el nombre RepGet en anuncios de búsqueda ni use nuestro nombre en dominios o cuentas sociales.",
        "No prometa posiciones, tráfico ni ingresos.",
        "No envíe mensajes no solicitados.",
      ],
    },
    settings: { title: "Ajustes", profile: "Perfil de socio", name: "Nombre", email: "Correo", country: "País de cobro", code: "Código de referido", status: "Estado", statuses: { active: "Activo", suspended: "Suspendido" } },
    pagination: { previous: "Anterior", next: "Siguiente", page: "Página {page} de {pages}" },
    failure: { title: "No se pudo cargar esta página", body: "Volver a intentarlo suele funcionar. Sus ganancias y pagos no se ven afectados.", reference: "Si sigue ocurriendo, indique la referencia {reference} a soporte.", retry: "Reintentar" },
  },
};

const fr: PartnerCopy = {
  page: {
    metaTitle: "Programme d'affiliation : commission récurrente",
    metaDescription:
      "Rejoignez le programme d'affiliation RepGet : partagez votre lien et touchez une commission récurrente sur les paiements de vos filleuls, versée via Stripe.",
    eyebrow: "Le programme partenaires RepGet",
    eyebrowOpen: "Candidatures ouvertes",
    eyebrowClosed: "Candidatures bientôt ouvertes",
    titleLead: "Recommandez RepGet.",
    titleEm: "Soyez rémunéré",
    titleRest: "à mesure qu'ils grandissent.",
    intro: "Aidez les entreprises à être trouvées sur Google, dans la recherche IA et sur les réseaux sociaux. Touchez **{range} de commission** sur les paiements d'abonnement des clients que vous recommandez, pendant {months} mois maximum.",
    ctaApply: "Devenir partenaire",
    ctaExplore: "Voir les gains",
    fineLine: "Candidature gratuite. Aucun forfait RepGet payant requis.",
    portalQuestion: "Déjà partenaire ?",
    portalLink: "Connexion partenaire",
    closed: "Les candidatures ne sont pas encore ouvertes. Revenez bientôt.",
    calculator: {
      head: "Partenaires RepGet",
      headSub: "Explorateur de gains",
      headBadge: "Estimation interactive",
      network: "Votre réseau de filleuls",
      live: "Simulation en direct",
      direct: "Filleuls directs",
      hint: "Survolez ou touchez un point",
      hintMany: "{shown} affichés · touchez un point",
      svgLabel: "Illustration interactive des clients que vous recommandez directement. Sélectionnez un point pour voir sa commission indicative.",
      nodeLabel: "Voir le filleul simulé {n}",
      you: "VOUS",
      selected: "Connexion sélectionnée",
      referral: "Filleul n° {n}",
      kind: "Client payant direct · simulé",
      perMonth: "par mois",
      add: "Ajouter un filleul",
      explore: "Voir {count} filleuls",
      restart: "Recommencer",
      fineprint: "Illustration interactive · Chaque connexion est un filleul **direct**, pas un réseau multiniveau.",
      scenario: "Construisez votre scénario de revenus",
      plan: "Choisissez un forfait RepGet",
      monthlyPrices: "Prix mensuels",
      planPrice: "{price} / mois",
      customers: "Clients payants recommandés",
      people: "personnes",
      rates: "Taux de commission",
      from: "Dès {count}",
      level: "Avec {count} clients payants, vous êtes {tier} : {rate} de chaque paiement.",
      potential: "Commission possible",
      perMonthShort: " / mois",
      projection: "Projection sur {months} mois",
      footStrong: "Une vraie commission récurrente.",
      footBody: "Des conditions transparentes. Aucun abonnement partenaire payant.",
      footLink: "Comprendre les versements",
    },
    disclaimer:
      "Gains indicatifs, non garantis. Suppose que tous les clients recommandés paient le prix catalogue du forfait choisi chaque mois pendant {months} mois. Les commissions réelles s'appliquent aux paiements éligibles reçus, après remises et hors taxes, remboursements et autres ajustements. Les taux d'un niveau supérieur s'appliquent aux paiements effectués après l'avoir atteint.",
    trust: {
      start: "Taux de commission de départ",
      top: "Niveau le plus élevé",
      monthsValue: "{months} mois",
      months: "De commission par client recommandé",
      daysValue: "{days} jours",
      days: "De suivi des recommandations",
    },
    ctaStart: "Commencer à recommander",
    stepsKicker: "Plus simple qu'il n'y paraît",
    stepsTitle: "Trois étapes. Une récompense qui grandit.",
    stepsIntro: "Que vous ayez une grande audience ou quelques contacts professionnels, recommander RepGet est simple.",
    stepLabel: "Étape {n}",
    steps: [
      { title: "Devenez partenaire", body: "Postulez avec votre compte RepGet actuel ou un compte gratuit. Chaque candidature est examinée personnellement." },
      { title: "Partagez votre lien unique", body: "Recommandez une plateforme de croissance connectée pour le SEO, la visibilité IA, le contenu et les réseaux sociaux. Votre lien suit les nouvelles inscriptions." },
      { title: "Gagnez quand ils s'abonnent", body: "Recevez une commission sur les paiements d'abonnement éligibles pendant {months} mois maximum pour chaque nouveau client recommandé." },
    ],
    tiersKicker: "Vos revenus peuvent grandir",
    tiersTitle: "Plus de clients.\nUne meilleure commission.",
    tiersIntro: "Votre taux de commission augmente lorsque le nombre de comptes payants que vous avez recommandés atteint le niveau suivant.",
    tierLevel: "{n} / {name}",
    tierTop: "Niveau le plus élevé",
    tierStartTitle: "Commencez à gagner tout de suite",
    tierStartBody: "Votre commission de départ sur les paiements d'abonnement éligibles des clients recommandés.",
    tierFromTitle: "Dès {count} filleuls payants",
    tierNextBody: "Atteignez {count} clients payants recommandés et débloquez une commission plus élevée sur les paiements éligibles suivants.",
    tierTopBody: "Débloquez le taux le plus élevé sur les paiements d'abonnement éligibles suivants. Aucun plafond de gains publié.",
    audienceKicker: "Pour celles et ceux qui recommandent de bons outils",
    audienceTitle: "Votre influence a déjà de la valeur.",
    audienceIntro: "RepGet aide les entreprises à grandir dans la recherche et sur les réseaux sociaux. Quand votre audience en a besoin, vous avez quelque chose de vraiment utile à partager.",
    audience: [
      { title: "Agences SEO et marketing", body: "Recommandez une plateforme de croissance aux clients que vous conseillez déjà." },
      { title: "Créateurs et formateurs", body: "Montrez RepGet dans vos vidéos, guides, newsletters et tutoriels." },
      { title: "Blogueurs et éditeurs", body: "Transformez vos recommandations utiles en source de revenus partenaire." },
      { title: "Consultants et fondateurs", body: "Présentez des outils qui aident d'autres entreprises à trouver plus de clients." },
    ],
    quoteKicker: "Pourquoi devenir partenaire de RepGet ?",
    quoteLead: "Vous ne vendez pas un logiciel de plus.",
    quoteEm: "Vous présentez une façon de grandir.",
    quoteFoot: "Contenu. SEO. Backlinks. Visibilité IA. Diffusion sociale.",
    quoteFoot2: "Une plateforme connectée pour la croissance des entreprises.",
    faqKicker: "Les détails comptent",
    faqTitle: "Bonnes questions.\nRéponses claires.",
    faqIntro: "Des conditions transparentes vous aident à décider si le programme partenaires RepGet vous convient.",
    faq: [
      {
        question: "Combien puis-je vraiment gagner ?",
        answer:
          "Vous commencez à {rate} de commission sur les paiements d'abonnement éligibles des nouveaux clients que vous recommandez. Le taux augmente avec le nombre de clients payants recommandés : {tiers}. Chaque client recommandé peut générer une commission pendant {months} mois à partir de son premier paiement. Aucun plafond de gains n'est publié, mais les résultats dépendent des paiements et recommandations réels.",
      },
      {
        question: "Quand et comment suis-je payé ?",
        payout: true,
        answer:
          "Les versements ont lieu le 1er de chaque mois, dès que les commissions ont au moins {maturity} jours et que votre solde disponible atteint {amount}. Les soldes inférieurs sont reportés au cycle suivant. Les versements sont envoyés sur votre compte bancaire via Stripe Connect, ou via PayPal lorsque cette option est disponible.",
      },
      { question: "Dois-je payer RepGet pour participer ?", answer: "Non. Vous pouvez postuler avec un compte RepGet gratuit ou le compte que vous avez déjà. Les candidatures sont examinées manuellement." },
      {
        question: "Qu'est-ce qui compte comme recommandation ?",
        answer:
          "Seuls les nouveaux comptes RepGet peuvent compter. Le suivi dure {days} jours après l'ouverture de votre lien partenaire, et le premier lien partenaire ouvert par un visiteur est retenu. Les comptes existants, vos propres comptes et les membres d'équipe invités sur un autre compte ne comptent pas.",
      },
      {
        question: "Suis-je payé pour les filleuls d'autres partenaires ?",
        answer: "Non. Le programme partenaires publié de RepGet rémunère les clients que vous recommandez directement. Les niveaux de commission sont des paliers de performance, pas un réseau multiniveau.",
      },
      {
        question: "La commission est-elle calculée sur le prix affiché du forfait ?",
        answer:
          "Non. La commission est calculée sur les paiements d'abonnement éligibles réellement encaissés, après remises et hors taxes, remboursements, rétrofacturations et crédits. Les paiements par carte et par PayPal comptent tous les deux ; les codes de réduction partenaires ne s'utilisent qu'avec un paiement par carte. Les taux d'un nouveau niveau s'appliquent aux paiements éligibles effectués après l'avoir atteint.",
      },
      {
        question: "Puis-je offrir une remise à mon audience ?",
        answer:
          "Les codes partenaires ne sont pas automatiques, mais RepGet peut attribuer un code de réduction personnel aux créateurs et agences éligibles. Lorsqu'un nouveau client utilise votre code, la recommandation peut vous être attribuée.",
      },
      {
        question: "Où suivre mes filleuls et mes gains ?",
        answer:
          "Votre espace partenaire réunit les clics sur votre lien, les nouvelles inscriptions, les clients payants, les commissions gagnées et l'historique des versements. Vous y trouvez aussi des supports promotionnels à partager.",
      },
      {
        question: "Que se passe-t-il si un client résilie ou est remboursé ?",
        answer:
          "Vous touchez une commission uniquement sur les paiements éligibles réellement encaissés. Si un client résilie, il n'y a pas de commission sur les périodes futures non payées. Les remboursements et rétrofacturations annulent la commission correspondante, même après versement ; les ajustements sont déduits des versements suivants.",
      },
    ],
    credits: {
      faq: "Pour l'instant, les partenaires sont rémunérés en crédits RepGet, et non en argent. Chaque commission devient des crédits {maturity} jours après le paiement du client, sans minimum : {rate}. Les crédits sont versés sur un espace de travail qui vous appartient, choisi dans votre espace partenaire. Si un client est remboursé ensuite, le montant est déduit de vos prochains crédits.",
      rate: "{credits} crédits pour chaque {price} de commission, le prix du plus petit pack de crédits",
      rateUnknown: "au prix du plus petit pack de crédits",
      disclaimer: "Les commissions sont actuellement versées en crédits RepGet.",
    },
    tierPhrase: "{rate} dès {count} clients payants",
    ctaKicker: "Votre prochaine recommandation peut rapporter",
    ctaTitle: "Aidez les bonnes entreprises à grandir. Soyez-en récompensé.",
    ctaButton: "Postuler comme partenaire",
    ctaSmall: "Candidature gratuite · Examinée par une vraie personne",
    creditBody: "Déjà client RepGet ? Vous pouvez aussi recommander des entreprises contre des crédits RepGet plutôt que de l'argent.",
    creditLink: "Recommander une entreprise contre des crédits",
  },
  portal: {
    title: "Espace partenaire",
    nav: { overview: "Aperçu", referrals: "Filleuls", commissions: "Commissions", payouts: "Versements", resources: "Ressources", settings: "Paramètres", apply: "Postuler", backToApp: "Retour à RepGet" },
    testMode: "Mode test : aucun argent réel ne circule.",
    verify: {
      title: "Confirmez d'abord votre adresse e-mail",
      body: "Le programme d'affiliation verse de l'argent réel : nous devons savoir que cette adresse est bien la vôtre. Nous allons vous envoyer un code à six chiffres.",
      send: "Envoyer le code",
      sent: "Nous avons envoyé un code à {email}.",
      code: "Code à six chiffres",
      confirm: "Confirmer",
      errors: { INVALID: "Ce code n'est pas correct.", EXPIRED: "Ce code a expiré. Demandez-en un nouveau.", TOO_MANY: "Trop de tentatives. Demandez un nouveau code.", FAILED: "Nous n'avons pas pu confirmer le code. Réessayez." },
    },
    apply: {
      title: "Devenir partenaire RepGet",
      eyebrow: "Programme partenaires RepGet",
      heading: "Grandissons ensemble.",
      intro: "Rejoignez notre programme d'affiliation. Parlez-nous de votre audience et de la façon dont vous comptez présenter RepGet.",
      cardTitle: "Devenir partenaire",
      cardIntro: "Quelques informations pour nous aider à examiner votre candidature.",
      chip: "Examen individuel",
      website: "Site web ou réseau social",
      websiteHint: "Votre site web, newsletter, chaîne YouTube ou profil sur les réseaux sociaux.",
      websitePlaceholder: "https://votresite.com",
      audience: "Votre audience",
      audienceHint: "Parlez-nous un peu des personnes que vous touchez.",
      audiencePlaceholder: "Qui vous suit, où se trouvent ces personnes et combien vous en touchez environ...",
      promotion: "Comment allez-vous promouvoir RepGet ?",
      promotionHint: "Un bref aperçu suffit.",
      promotionPlaceholder: "Par exemple : avis produits, tutoriels vidéo, newsletters, articles de blog ou recommandations à vos clients...",
      counter: "{count} / {max}",
      country: "Pays de versement",
      countryHint: "La disponibilité des versements varie selon le pays. Les virements bancaires et PayPal sont proposés aux partenaires éligibles.",
      countryHintCredits: "Les partenaires sont actuellement rémunérés en crédits RepGet, versés sur l'espace de travail de votre choix. Choisissez le pays où vous résidez.",
      countryPlaceholder: "Choisissez votre pays",
      terms: "J'accepte les {link} et je comprends que ma candidature sera examinée.",
      termsLink: "conditions du programme partenaires",
      required: "obligatoire",
      submit: "Envoyer la candidature",
      submitting: "Envoi…",
      privacy: "Vos informations servent uniquement à examiner votre candidature.",
      questions: "Des questions sur le partenariat ?",
      questionsLink: "Découvrir le programme partenaires",
      closed: "Les candidatures sont fermées pour le moment.",
      pendingTitle: "Votre candidature est en cours d'examen",
      pendingBody: "Nous vous écrirons à {email} une fois l'examen terminé.",
      rejectedTitle: "Votre dernière candidature n'a pas été acceptée",
      rejectedBody: "Vous pouvez postuler à nouveau en détaillant davantage votre audience.",
      errors: {
        invalid: "Vérifiez le formulaire.",
        website: "Saisissez une URL valide commençant par https:// ou http://.",
        audience: "Ajoutez un peu plus de détails (au moins {min} caractères).",
        promotion: "Décrivez comment vous comptez promouvoir RepGet (au moins {min} caractères).",
        country: "Choisissez votre pays.",
        terms: "Acceptez les conditions du programme partenaires.",
        rate_limited: "Trop de candidatures. Réessayez demain.",
        disabled: "Les candidatures sont fermées pour le moment.",
        already_processed: "Vous avez déjà postulé.",
        generic: "Une erreur s'est produite. Réessayez.",
      },
    },
    suspended: { title: "Votre compte partenaire est suspendu", body: "Votre historique reste disponible. Les nouvelles commissions et les versements sont suspendus. Contactez-nous si vous pensez qu'il s'agit d'une erreur." },
    hold: { title: "Les versements sont suspendus", body: "Vos gains sont en sécurité ; les versements automatiques sont suspendus pendant que nous examinons votre compte." },
    overview: {
      title: "Aperçu",
      linkTitle: "Votre lien partenaire",
      linkHint: "Les visiteurs qui l'ouvrent et créent un nouveau compte RepGet dans les {days} jours vous sont attribués.",
      linkAnyPage: "Il fonctionne aussi sur toute page de RepGet : ajoutez ?ref={code} à l'adresse, par exemple {example}.",
      copy: "Copier le lien",
      copied: "Copié",
      tierTitle: "Votre niveau partenaire",
      progress: "{count} / {target} clients payants",
      remaining: "Encore {count} clients pour atteindre {tier}.",
      topTier: "Vous êtes au niveau le plus élevé.",
      recurring: "{rate} de commission récurrente",
      nextLevel: "Niveau suivant",
      levelRate: "{rate} de commission",
      cards: { earned: "Total gagné", pending: "En attente", paid: "Versé", referrals: "Filleuls", payingCustomers: "Clients payants" },
      definitions: {
        earned: "Commission gagnée, moins remboursements et rétrofacturations.",
        pending: "Gagné, pas encore versé.",
        paid: "Versé via Stripe.",
        referrals: "Clients que vous avez recommandés, par lien ou code promo (hors clients disqualifiés).",
        payingCustomers: "Clients recommandés qui paient actuellement. Ce nombre fixe votre palier.",
      },
      breakdown: { approved: "Approuvé, versé au prochain versement : {amount}", waiting: "Délai de {maturity} jours, retenue ou examen en cours : {amount}", sending: "En cours d'envoi : {amount}", inBank: "Déjà sur votre compte bancaire : {amount}" },
      latestTitle: "Dernières commissions",
      latestAll: "Toutes les commissions",
      noEarnings: "Aucune commission pour l'instant. Partagez votre lien pour commencer.",
      noThreshold: "Les versements automatiques ne sont pas encore disponibles en {currency}. Votre solde est conservé et affiché ici.",
      threshold: "Les versements commencent quand votre solde approuvé atteint {amount}.",
      metrics: {
        clicks: "Clics sur le lien",
        signups: "Nouveaux comptes",
        referred: "Clients recommandés",
        customers: "Clients ayant payé",
        conversion: "Du clic au paiement",
        range: "{days} derniers jours",
        period: "Période",
        since: "Du {start} au {end} (UTC)",
        definition: "Comptés sur la période : ouvertures enregistrées de votre lien, nouveaux comptes créés via votre lien, clients qui vous sont attribués (lien ou code promo) et, parmi eux, ceux qui ont effectué un paiement commissionné.",
      },
      balancesTitle: "Gains",
      currencyNote: "Chaque devise est affichée séparément. Les montants ne sont jamais convertis.",
      offset: "{amount} sera déduit des prochains versements (un remboursement ou une correction après un versement).",
      nextPayout: "Prochain versement : {date}",
      couponsTitle: "Vos codes promo",
      copyCode: "Copier le code",
      noCoupons: "Aucun code promo ne vous a été attribué.",
      couponDiscount: "{discount} pour les nouveaux clients",
    },
    referrals: {
      title: "Filleuls",
      intro: "Comptes qui vous sont attribués. Les clients apparaissent sous une adresse de site abrégée ou une référence, jamais par leur nom ou leur e-mail.",
      customer: "Client",
      source: "Origine",
      since: "Depuis",
      status: "Statut",
      empty: "Aucun filleul pour l'instant.",
      statuses: { active: "Actif", review: "En examen", disqualified: "Non éligible" },
      sources: { link: "Lien", coupon: "Code promo" },
    },
    commissions: {
      title: "Commissions",
      intro: "Une ligne par paiement d'un client recommandé. Les montants sont dans la devise payée.",
      date: "Date du paiement",
      customer: "Client",
      plan: "Formule",
      perMonth: "{price}/mois",
      perYear: "{price}/an",
      base: "Payé (hors taxes)",
      rate: "Taux",
      amount: "Commission",
      status: "Statut",
      matures: "Versable à partir du",
      empty: "Aucune commission pour l'instant.",
      statuses: { pending: "En attente", available: "Approuvée", reserved: "En versement", paid: "Versée", reversed: "Annulée", held: "Retenue", review: "En examen" },
      reversed: "{amount} annulé",
    },
    payouts: {
      title: "Versements",
      intro: "Chaque versement est d'abord envoyé sur votre solde Stripe, puis de Stripe vers votre banque. Les deux étapes sont affichées.",
      date: "Date",
      amount: "Montant",
      transfer: "Vers votre solde Stripe",
      bank: "Vers votre banque",
      empty: "Aucun versement pour l'instant.",
      transferStates: { pending: "En préparation", processing: "Envoi en cours", confirmed: "Envoyé", reversed: "Annulé" },
      bankStates: { not_started: "Pas commencé", pending: "En attente", in_transit: "En route", paid: "Versé", failed: "Échec - nous réessaierons" },
      schedule: "Les versements ont lieu le premier jour de chaque mois.",
      offset: "{amount} déduit pour corrections",
      arrival: "Arrivée prévue : {date}",
    },
    setup: {
      title: "Configuration des versements",
      intro: "Les versements passent par Stripe. Stripe vous demande votre identité et vos coordonnées bancaires ; RepGet ne les voit jamais.",
      states: {
        not_started: { title: "Configurez vos versements", body: "Vous pouvez gagner des commissions avant de le faire. Ce sera nécessaire pour être payé." },
        setup_required: { title: "Terminez votre configuration Stripe", body: "Stripe a encore besoin de quelques informations pour pouvoir vous payer." },
        verification_pending: { title: "Stripe vérifie vos informations", body: "Cela prend en général quelques minutes, parfois quelques jours. Rien à faire pour l'instant." },
        restricted: { title: "Stripe a besoin de plus d'informations", body: "Les versements sont suspendus jusqu'à ce que les informations manquantes soient fournies." },
        ready: { title: "Vos versements sont prêts", body: "Vos versements seront envoyés automatiquement." },
        unavailable: { title: "Les versements ne sont pas encore disponibles", body: "La configuration des versements n'est pas encore ouverte sur ce site. Vos gains sont enregistrés." },
      },
      start: "Configurer les versements avec Stripe",
      continue: "Continuer avec Stripe",
      dashboard: "Ouvrir votre tableau de bord Stripe",
      refresh: "Vérifier à nouveau",
      country: "Pays de versement : {country}",
      countryUnsupported: "Les versements ne sont pas encore disponibles en {country}. Contactez-nous pour changer votre pays de versement.",
      errors: {
        generic: "Stripe est injoignable. Réessayez dans un instant.",
        provider_outcome_unknown: "Stripe n'a pas répondu. Réessayez : rien ne sera configuré deux fois.",
        onboarding_incomplete: "Terminez d'abord votre configuration Stripe.",
        suspended: "Votre compte partenaire est suspendu.",
        disabled: "La configuration des versements n'est pas encore disponible.",
      },
    },
    resources: {
      title: "Ressources",
      intro: "Logos et textes prêts à l'emploi que vous pouvez utiliser. Merci de décrire RepGet fidèlement.",
      logos: "Logos",
      logosIntro: "Utilisez le logo tel quel : n'en modifiez ni les couleurs ni les proportions.",
      banners: "Bannières",
      bannersIntro: "Des images prêtes pour les sites et les newsletters. Faites-les pointer vers votre lien partenaire.",
      files: { logo: "Logo pour fonds clairs", logoLight: "Logo pour fonds sombres", mark: "Icône", banner: "Bannière {size}" },
      copyText: "Copier le texte",
      download: "Télécharger",
      copyTitle: "Textes à utiliser",
      copyIntro: "Modifiez-les librement. Ne promettez ni résultats ni revenus.",
      templates: [
        { title: "Court", body: "J'utilise RepGet pour planifier, rédiger et publier des articles SEO sur mes sites. Essayez : {link}" },
        { title: "Newsletter", body: "Si vous publiez du contenu pour attirer du trafic de recherche, RepGet analyse les mots-clés, rédige des articles dans votre style et les publie sur votre site. Jetez un œil : {link}" },
        { title: "Pour vos clients", body: "Pour votre blog, nous pouvons utiliser RepGet, qui transforme la recherche de mots-clés en plan de publication et rédige les articles pour relecture. Voici le lien : {link}" },
      ],
      rules: "Quand vous faites la promotion de RepGet",
      rulesList: [
        "Indiquez que vous êtes partenaire et que vous pouvez toucher une commission.",
        "N'enchérissez pas sur le nom RepGet dans les annonces de recherche et n'utilisez pas notre nom dans des domaines ou comptes sociaux.",
        "Ne promettez ni positions, ni trafic, ni revenus.",
        "N'envoyez pas de messages non sollicités.",
      ],
    },
    settings: { title: "Paramètres", profile: "Profil partenaire", name: "Nom", email: "E-mail", country: "Pays de versement", code: "Code de parrainage", status: "Statut", statuses: { active: "Actif", suspended: "Suspendu" } },
    pagination: { previous: "Précédent", next: "Suivant", page: "Page {page} sur {pages}" },
    failure: { title: "Cette page n'a pas pu être chargée", body: "Réessayer suffit généralement. Vos gains et vos versements ne sont pas concernés.", reference: "Si cela se reproduit, communiquez la référence {reference} au support.", retry: "Réessayer" },
  },
};

const it: PartnerCopy = {
  page: {
    metaTitle: "Programma di affiliazione: commissione ricorrente",
    metaDescription:
      "Entri nel programma di affiliazione di RepGet: condivida il suo link e guadagni una commissione ricorrente su quanto pagano i suoi referral, via Stripe.",
    eyebrow: "Il programma partner di RepGet",
    eyebrowOpen: "Candidature aperte",
    eyebrowClosed: "Candidature in arrivo",
    titleLead: "Consigli RepGet.",
    titleEm: "Guadagni",
    titleRest: "mentre loro crescono.",
    intro: "Aiuti le aziende a farsi trovare su Google, nella ricerca con l'IA e sui social. Guadagni **una commissione del {range}** sui pagamenti degli abbonamenti dei clienti che segnala, fino a {months} mesi.",
    ctaApply: "Diventi partner",
    ctaExplore: "Scopra i guadagni",
    fineLine: "Candidatura gratuita. Nessun piano RepGet a pagamento richiesto.",
    portalQuestion: "È già partner?",
    portalLink: "Accesso partner",
    closed: "Le candidature non sono ancora aperte. Torni presto.",
    calculator: {
      head: "Partner RepGet",
      headSub: "Simulatore di guadagni",
      headBadge: "Stima interattiva",
      network: "La sua rete di referral",
      live: "Simulazione dal vivo",
      direct: "Referral diretti",
      hint: "Passi sopra o tocchi un punto",
      hintMany: "{shown} visibili · tocchi un punto",
      svgLabel: "Illustrazione interattiva dei clienti che lei segnala direttamente. Selezioni un punto per vedere la sua commissione indicativa.",
      nodeLabel: "Vedi il referral simulato {n}",
      you: "LEI",
      selected: "Collegamento selezionato",
      referral: "Referral n. {n}",
      kind: "Cliente pagante diretto · simulato",
      perMonth: "al mese",
      add: "Aggiungi un referral",
      explore: "Vedi {count} referral",
      restart: "Ricomincia",
      fineprint: "Illustrazione interattiva · Ogni collegamento è un referral **diretto**, non una rete multilivello.",
      scenario: "Costruisca il suo scenario di guadagno",
      plan: "Scelga un piano RepGet",
      monthlyPrices: "Prezzi mensili",
      planPrice: "{price} / mese",
      customers: "Clienti paganti che segnala",
      people: "persone",
      rates: "Percentuali di commissione",
      from: "Da {count}",
      level: "Con {count} clienti paganti lei è {tier}: {rate} di ogni pagamento.",
      potential: "Commissione possibile",
      perMonthShort: " / mese",
      projection: "Proiezione su {months} mesi",
      footStrong: "Una vera commissione ricorrente.",
      footBody: "Condizioni trasparenti. Nessun abbonamento partner a pagamento.",
      footLink: "Come funzionano i pagamenti",
    },
    disclaimer:
      "Guadagni indicativi, non garantiti. Presuppone che tutti i clienti segnalati paghino il prezzo di listino del piano scelto ogni mese per {months} mesi. Le commissioni reali si applicano ai pagamenti idonei ricevuti, al netto di sconti ed esclusi tasse, rimborsi e altre rettifiche. Le percentuali di un livello superiore si applicano ai pagamenti effettuati dopo averlo raggiunto.",
    trust: {
      start: "Commissione iniziale",
      top: "Livello più alto disponibile",
      monthsValue: "{months} mesi",
      months: "Di commissione per cliente segnalato",
      daysValue: "{days} giorni",
      days: "Di tracciamento del referral",
    },
    ctaStart: "Inizi a segnalare",
    stepsKicker: "Più semplice di quanto pensi",
    stepsTitle: "Tre passaggi. Una ricompensa che cresce.",
    stepsIntro: "Che lei abbia un grande pubblico o pochi contatti di lavoro, consigliare RepGet è semplice.",
    stepLabel: "Passo {n}",
    steps: [
      { title: "Diventi partner", body: "Si candidi con il suo account RepGet o con uno gratuito. Ogni candidatura viene esaminata personalmente." },
      { title: "Condivida il suo link", body: "Consigli una piattaforma di crescita collegata per SEO, visibilità nell'IA, contenuti e social. Il suo link registra le nuove iscrizioni." },
      { title: "Guadagni quando si abbonano", body: "Riceva una commissione sui pagamenti idonei degli abbonamenti fino a {months} mesi per ogni nuovo cliente segnalato." },
    ],
    tiersKicker: "I suoi guadagni possono crescere",
    tiersTitle: "Più clienti.\nCommissione migliore.",
    tiersIntro: "La sua percentuale di commissione aumenta quando il numero di account paganti che ha segnalato raggiunge il livello successivo.",
    tierLevel: "{n} / {name}",
    tierTop: "Livello più alto",
    tierStartTitle: "Inizi a guadagnare subito",
    tierStartBody: "La sua commissione iniziale sui pagamenti idonei degli abbonamenti dei clienti segnalati.",
    tierFromTitle: "Da {count} referral paganti",
    tierNextBody: "Raggiunga {count} clienti paganti segnalati e ottenga una commissione più alta sui pagamenti idonei successivi.",
    tierTopBody: "Ottenga la percentuale più alta sui pagamenti idonei successivi. Nessun tetto pubblicato ai guadagni totali.",
    audienceKicker: "Per chi consiglia buoni strumenti",
    audienceTitle: "La sua influenza ha già valore.",
    audienceIntro: "RepGet aiuta le aziende a crescere nella ricerca e sui social. Quando il suo pubblico ne ha bisogno, lei ha qualcosa di davvero utile da condividere.",
    audience: [
      { title: "Agenzie SEO e marketing", body: "Consigli una piattaforma di crescita ai clienti che già segue." },
      { title: "Creator e formatori", body: "Mostri RepGet in video, guide, newsletter e tutorial." },
      { title: "Blogger ed editori", body: "Trasformi i suoi consigli utili in una fonte di guadagno come partner." },
      { title: "Consulenti e fondatori", body: "Presenti strumenti che aiutano altre aziende a trovare più clienti." },
    ],
    quoteKicker: "Perché diventare partner di RepGet?",
    quoteLead: "Non vende l'ennesimo software.",
    quoteEm: "Presenta un modo per crescere.",
    quoteFoot: "Contenuti. SEO. Backlink. Visibilità nell'IA. Distribuzione sui social.",
    quoteFoot2: "Un'unica piattaforma collegata per la crescita delle aziende.",
    faqKicker: "I dettagli contano",
    faqTitle: "Buone domande.\nRisposte chiare.",
    faqIntro: "Condizioni trasparenti la aiutano a capire se il programma partner di RepGet fa per lei.",
    faq: [
      {
        question: "Quanto posso guadagnare davvero?",
        answer:
          "Si parte da una commissione del {rate} sui pagamenti idonei degli abbonamenti dei nuovi clienti che segnala. La percentuale cresce con il numero di clienti paganti segnalati: {tiers}. Ogni cliente segnalato può generare commissioni per {months} mesi dal suo primo pagamento. Non c'è un tetto pubblicato ai guadagni totali, ma i risultati dipendono dai pagamenti e dalle segnalazioni reali.",
      },
      {
        question: "Quando e come vengo pagato?",
        payout: true,
        answer:
          "I pagamenti avvengono il primo di ogni mese, quando le commissioni hanno almeno {maturity} giorni e il suo saldo disponibile raggiunge {amount}. I saldi inferiori passano al ciclo successivo. I pagamenti vengono inviati sul suo conto bancario tramite Stripe Connect, oppure tramite PayPal dove questa opzione è disponibile.",
      },
      { question: "Devo pagare RepGet per partecipare?", answer: "No. Può candidarsi con un account RepGet gratuito o con quello che ha già. Le candidature vengono esaminate a mano." },
      {
        question: "Cosa conta come referral?",
        answer:
          "Possono contare solo i nuovi account RepGet. Il tracciamento dura {days} giorni dall'apertura del suo link partner, e conta il primo link partner aperto da un visitatore. Gli account esistenti, i suoi account e i membri del team invitati in un altro account non contano.",
      },
      {
        question: "Guadagno sui referral di altri partner?",
        answer: "No. Il programma partner pubblicato di RepGet paga sui clienti che lei segnala direttamente. I livelli di commissione sono livelli di rendimento, non una rete di referral multilivello.",
      },
      {
        question: "Le commissioni si basano sul prezzo pubblicato del piano?",
        answer:
          "No. La commissione si calcola sui pagamenti idonei degli abbonamenti effettivamente incassati, al netto di sconti ed esclusi tasse, rimborsi, chargeback e crediti. Contano sia i pagamenti con carta sia quelli con PayPal; i codici coupon partner si possono usare solo pagando con carta. Le percentuali di un nuovo livello si applicano ai pagamenti idonei effettuati dopo averlo raggiunto.",
      },
      {
        question: "Posso offrire uno sconto al mio pubblico?",
        answer:
          "I coupon partner non sono automatici, ma RepGet può assegnare un codice sconto personale a creator e agenzie idonei. Quando un nuovo cliente usa il suo codice, il referral può esserle attribuito.",
      },
      {
        question: "Dove seguo referral e guadagni?",
        answer:
          "La sua area partner riunisce i clic sul link, le nuove registrazioni, i clienti paganti, le commissioni maturate e lo storico dei pagamenti. Trova anche materiali promozionali da condividere con il suo pubblico.",
      },
      {
        question: "Cosa succede se un cliente disdice o riceve un rimborso?",
        answer:
          "Guadagna commissioni solo sui pagamenti idonei effettivamente incassati. Se un cliente disdice, non ci sono commissioni sui periodi futuri non pagati. Rimborsi e chargeback annullano la commissione relativa, anche dopo il pagamento; le rettifiche vengono detratte dai pagamenti successivi.",
      },
    ],
    credits: {
      faq: "Per ora i partner vengono pagati in crediti RepGet, non in denaro. Ogni commissione diventa crediti {maturity} giorni dopo il pagamento del cliente, senza minimo: {rate}. I crediti vanno su un'area di lavoro di sua proprietà, che sceglie nella sua area partner. Se in seguito un cliente viene rimborsato, l'importo viene detratto dai suoi prossimi crediti.",
      rate: "{credits} crediti per ogni {price} di commissione, il prezzo del pacchetto di crediti più piccolo",
      rateUnknown: "al prezzo del pacchetto di crediti più piccolo",
      disclaimer: "Al momento le commissioni vengono pagate in crediti RepGet.",
    },
    tierPhrase: "{rate} da {count} clienti paganti",
    ctaKicker: "La sua prossima segnalazione può ripagare",
    ctaTitle: "Aiuti le aziende giuste a crescere. E ne venga ricompensato.",
    ctaButton: "Si candidi come partner",
    ctaSmall: "Candidatura gratuita · Esaminata da una persona",
    creditBody: "È già cliente RepGet? Può anche segnalare aziende in cambio di crediti RepGet invece di denaro.",
    creditLink: "Segnali un'azienda in cambio di crediti",
  },
  portal: {
    title: "Area partner",
    nav: { overview: "Panoramica", referrals: "Referral", commissions: "Commissioni", payouts: "Pagamenti", resources: "Risorse", settings: "Impostazioni", apply: "Candidatura", backToApp: "Torna a RepGet" },
    testMode: "Modalità test: non si muove denaro reale.",
    verify: {
      title: "Confermi prima il suo indirizzo email",
      body: "Il programma di affiliazione paga denaro reale, quindi dobbiamo sapere che questo indirizzo è suo. Le invieremo un codice di sei cifre.",
      send: "Invia il codice",
      sent: "Abbiamo inviato un codice a {email}.",
      code: "Codice di sei cifre",
      confirm: "Conferma",
      errors: { INVALID: "Il codice non è corretto.", EXPIRED: "Il codice è scaduto. Ne richieda uno nuovo.", TOO_MANY: "Troppi tentativi. Richieda un nuovo codice.", FAILED: "Non siamo riusciti a confermare il codice. Riprovi." },
    },
    apply: {
      title: "Diventi partner di RepGet",
      eyebrow: "Programma partner di RepGet",
      heading: "Cresciamo insieme.",
      intro: "Entri nel nostro programma di affiliazione. Ci parli del suo pubblico e di come pensa di presentare RepGet.",
      cardTitle: "Diventi partner",
      cardIntro: "Qualche informazione per aiutarci a valutare la sua candidatura.",
      chip: "Valutazione individuale",
      website: "Sito web o canale social",
      websiteHint: "Il suo sito, la newsletter, il canale YouTube o il profilo social.",
      websitePlaceholder: "https://ilsuosito.it",
      audience: "Il suo pubblico",
      audienceHint: "Ci racconti qualcosa delle persone che raggiunge.",
      audiencePlaceholder: "Chi la segue, dove si trova e quante persone raggiunge all'incirca...",
      promotion: "Come promuoverà RepGet?",
      promotionHint: "Basta una breve descrizione.",
      promotionPlaceholder: "Per esempio: recensioni, video tutorial, newsletter, articoli sul blog o consigli ai clienti...",
      counter: "{count} / {max}",
      country: "Paese di pagamento",
      countryHint: "La disponibilità dei pagamenti varia da paese a paese. Bonifici bancari e PayPal sono disponibili per i partner idonei.",
      countryHintCredits: "Al momento i partner vengono pagati in crediti RepGet, accreditati sull'area di lavoro che sceglie. Selezioni il paese in cui risiede.",
      countryPlaceholder: "Selezioni il suo paese",
      terms: "Accetto i {link} e comprendo che la mia candidatura sarà valutata.",
      termsLink: "termini del programma partner",
      required: "obbligatorio",
      submit: "Invia la candidatura",
      submitting: "Invio in corso…",
      privacy: "I suoi dati servono solo a valutare la candidatura.",
      questions: "Domande sul programma?",
      questionsLink: "Scopra il programma partner",
      closed: "Le candidature sono chiuse al momento.",
      pendingTitle: "Stiamo valutando la sua candidatura",
      pendingBody: "Le scriveremo a {email} quando l'avremo valutata.",
      rejectedTitle: "La sua ultima candidatura non è stata approvata",
      rejectedBody: "Può candidarsi di nuovo con più dettagli sul suo pubblico.",
      errors: {
        invalid: "Controlli il modulo.",
        website: "Inserisca un URL valido che inizi con https:// o http://.",
        audience: "Aggiunga qualche dettaglio in più (almeno {min} caratteri).",
        promotion: "Descriva come pensa di promuovere RepGet (almeno {min} caratteri).",
        country: "Selezioni il suo paese.",
        terms: "Accetti i termini del programma partner.",
        rate_limited: "Troppe candidature. Riprovi domani.",
        disabled: "Le candidature sono chiuse al momento.",
        already_processed: "Ha già inviato una candidatura.",
        generic: "Qualcosa non ha funzionato. Riprovi.",
      },
    },
    suspended: { title: "Il suo account partner è sospeso", body: "Lo storico resta disponibile. Nuove commissioni e pagamenti sono in pausa. Ci contatti se pensa che sia un errore." },
    hold: { title: "I pagamenti sono sospesi", body: "I suoi guadagni sono al sicuro; i pagamenti automatici sono in pausa mentre esaminiamo il suo account." },
    overview: {
      title: "Panoramica",
      linkTitle: "Il suo link partner",
      linkHint: "I visitatori che lo aprono e creano un nuovo account RepGet entro {days} giorni vengono attribuiti a lei.",
      linkAnyPage: "Funziona anche su qualsiasi pagina di RepGet: aggiunga ?ref={code} all'indirizzo, ad esempio {example}.",
      copy: "Copia link",
      copied: "Copiato",
      tierTitle: "Il suo livello partner",
      progress: "{count} / {target} clienti paganti",
      remaining: "Ancora {count} clienti per raggiungere {tier}.",
      topTier: "È al livello più alto.",
      recurring: "{rate} di commissione ricorrente",
      nextLevel: "Livello successivo",
      levelRate: "{rate} di commissione",
      cards: { earned: "Totale guadagnato", pending: "In attesa", paid: "Pagato", referrals: "Referral", payingCustomers: "Clienti paganti" },
      definitions: {
        earned: "Commissioni guadagnate, meno rimborsi e chargeback.",
        pending: "Guadagnato, non ancora pagato a lei.",
        paid: "Inviato a lei tramite Stripe.",
        referrals: "Clienti che lei ha segnalato, tramite link o coupon (esclusi quelli squalificati).",
        payingCustomers: "Clienti segnalati che pagano ora. Questo numero determina il suo livello.",
      },
      breakdown: { approved: "Approvato, pagato con il prossimo pagamento: {amount}", waiting: "In attesa dei {maturity} giorni, trattenuto o in revisione: {amount}", sending: "In invio ora: {amount}", inBank: "Già sul suo conto bancario: {amount}" },
      latestTitle: "Ultime commissioni",
      latestAll: "Tutte le commissioni",
      noEarnings: "Nessuna commissione per ora. Condivida il suo link per iniziare.",
      noThreshold: "I pagamenti automatici non sono ancora disponibili in {currency}. Il saldo è conservato e mostrato qui.",
      threshold: "I pagamenti iniziano quando il saldo approvato raggiunge {amount}.",
      metrics: {
        clicks: "Clic sul link",
        signups: "Nuovi account",
        referred: "Clienti segnalati",
        customers: "Clienti che hanno pagato",
        conversion: "Da clic a pagamento",
        range: "Ultimi {days} giorni",
        period: "Periodo",
        since: "Dal {start} al {end} (UTC)",
        definition: "Conteggiati nel periodo: aperture registrate del suo link, nuovi account creati tramite il suo link, clienti attribuiti a lei (link o coupon) e, tra questi, quelli che hanno effettuato un pagamento con commissione.",
      },
      balancesTitle: "Guadagni",
      currencyNote: "Ogni valuta è mostrata a parte. Gli importi non vengono mai convertiti.",
      offset: "{amount} sarà detratto dai prossimi pagamenti (un rimborso o una correzione dopo un pagamento).",
      nextPayout: "Prossimo pagamento: {date}",
      couponsTitle: "I suoi coupon",
      copyCode: "Copia codice",
      noCoupons: "Non le è stato assegnato alcun coupon.",
      couponDiscount: "{discount} per i nuovi clienti",
    },
    referrals: {
      title: "Referral",
      intro: "Account attribuiti a lei. I clienti sono indicati con un indirizzo del sito abbreviato o un riferimento, mai con nome o email.",
      customer: "Cliente",
      source: "Origine",
      since: "Dal",
      status: "Stato",
      empty: "Nessun referral per ora.",
      statuses: { active: "Attivo", review: "In revisione", disqualified: "Non valido" },
      sources: { link: "Link", coupon: "Coupon" },
    },
    commissions: {
      title: "Commissioni",
      intro: "Una riga per ogni pagamento di un cliente segnalato. Gli importi sono nella valuta in cui ha pagato.",
      date: "Data del pagamento",
      customer: "Cliente",
      plan: "Piano",
      perMonth: "{price}/mese",
      perYear: "{price}/anno",
      base: "Pagato (tasse escluse)",
      rate: "Percentuale",
      amount: "Commissione",
      status: "Stato",
      matures: "Pagabile dal",
      empty: "Nessuna commissione per ora.",
      statuses: { pending: "In attesa", available: "Approvata", reserved: "In pagamento", paid: "Pagata", reversed: "Annullata", held: "Trattenuta", review: "In revisione" },
      reversed: "{amount} annullato",
    },
    payouts: {
      title: "Pagamenti",
      intro: "Ogni pagamento va prima al suo saldo Stripe e poi da Stripe alla sua banca. Sono mostrati entrambi i passaggi.",
      date: "Data",
      amount: "Importo",
      transfer: "Al suo saldo Stripe",
      bank: "Alla sua banca",
      empty: "Nessun pagamento per ora.",
      transferStates: { pending: "In preparazione", processing: "Invio in corso", confirmed: "Inviato", reversed: "Annullato" },
      bankStates: { not_started: "Non iniziato", pending: "In attesa", in_transit: "In arrivo", paid: "Pagato", failed: "Non riuscito - riproveremo" },
      schedule: "I pagamenti avvengono il primo giorno di ogni mese.",
      offset: "{amount} detratti per correzioni",
      arrival: "Arrivo previsto: {date}",
    },
    setup: {
      title: "Configurazione dei pagamenti",
      intro: "I pagamenti passano da Stripe. Stripe le chiede identità e dati bancari; RepGet non li vede mai.",
      states: {
        not_started: { title: "Configuri i pagamenti", body: "Può guadagnare anche prima di farlo. Le servirà per essere pagato." },
        setup_required: { title: "Completi la configurazione su Stripe", body: "Stripe ha ancora bisogno di alcuni dati per poterla pagare." },
        verification_pending: { title: "Stripe sta verificando i suoi dati", body: "Di solito servono pochi minuti, a volte qualche giorno. Per ora non deve fare nulla." },
        restricted: { title: "Stripe ha bisogno di altre informazioni", body: "I pagamenti sono in pausa finché non vengono forniti i dati mancanti." },
        ready: { title: "I pagamenti sono pronti", body: "I suoi pagamenti verranno inviati automaticamente." },
        unavailable: { title: "I pagamenti non sono ancora disponibili", body: "La configurazione dei pagamenti non è ancora aperta su questo sito. I suoi guadagni vengono registrati." },
      },
      start: "Configura i pagamenti con Stripe",
      continue: "Continua con Stripe",
      dashboard: "Apri la dashboard Stripe",
      refresh: "Controlla di nuovo",
      country: "Paese di pagamento: {country}",
      countryUnsupported: "I pagamenti non sono ancora disponibili in {country}. Ci contatti per cambiare il paese di pagamento.",
      errors: {
        generic: "Impossibile contattare Stripe. Riprovi tra poco.",
        provider_outcome_unknown: "Stripe non ha risposto. Riprovi: nulla verrà configurato due volte.",
        onboarding_incomplete: "Completi prima la configurazione su Stripe.",
        suspended: "Il suo account partner è sospeso.",
        disabled: "La configurazione dei pagamenti non è ancora disponibile.",
      },
    },
    resources: {
      title: "Risorse",
      intro: "Loghi e testi pronti che può usare. La preghiamo di descrivere RepGet in modo accurato.",
      logos: "Loghi",
      logosIntro: "Usi il logo così com'è: non ne modifichi colori o proporzioni.",
      banners: "Banner",
      bannersIntro: "Immagini pronte per siti e newsletter. Le colleghi al suo link partner.",
      files: { logo: "Logo per sfondi chiari", logoLight: "Logo per sfondi scuri", mark: "Icona", banner: "Banner {size}" },
      copyText: "Copia testo",
      download: "Scarica",
      copyTitle: "Testi da usare",
      copyIntro: "Li modifichi liberamente. Non prometta risultati né guadagni.",
      templates: [
        { title: "Breve", body: "Uso RepGet per pianificare, scrivere e pubblicare articoli SEO sui miei siti. Provalo: {link}" },
        { title: "Newsletter", body: "Se pubblichi contenuti per attirare traffico dalla ricerca, RepGet analizza le parole chiave, scrive articoli con il tuo stile e li pubblica sul tuo sito. Dai un'occhiata: {link}" },
        { title: "Per i clienti", body: "Per il vostro blog possiamo usare RepGet, che trasforma la ricerca di parole chiave in un piano editoriale e scrive gli articoli da revisionare. Ecco il link: {link}" },
      ],
      rules: "Quando promuove RepGet",
      rulesList: [
        "Dichiari di essere partner e di poter ricevere una commissione.",
        "Non faccia offerte sul nome RepGet negli annunci di ricerca e non usi il nostro nome in domini o account social.",
        "Non prometta posizionamenti, traffico o guadagni.",
        "Non invii messaggi non richiesti.",
      ],
    },
    settings: { title: "Impostazioni", profile: "Profilo partner", name: "Nome", email: "Email", country: "Paese di pagamento", code: "Codice referral", status: "Stato", statuses: { active: "Attivo", suspended: "Sospeso" } },
    pagination: { previous: "Precedente", next: "Successiva", page: "Pagina {page} di {pages}" },
    failure: { title: "Non è stato possibile caricare questa pagina", body: "Di solito basta riprovare. I suoi guadagni e i pagamenti non ne risentono.", reference: "Se succede ancora, indichi il riferimento {reference} all'assistenza.", retry: "Riprova" },
  },
};

const de: PartnerCopy = {
  page: {
    metaTitle: "Affiliate-Programm: wiederkehrende Provision",
    metaDescription:
      "Werden Sie RepGet-Partner: Teilen Sie Ihren Link und erhalten Sie eine wiederkehrende Provision auf die Zahlungen Ihrer Empfehlungen, monatlich über Stripe.",
    eyebrow: "Das RepGet-Partnerprogramm",
    eyebrowOpen: "Bewerbungen offen",
    eyebrowClosed: "Bewerbungen bald möglich",
    titleLead: "Empfehlen Sie RepGet.",
    titleEm: "Verdienen Sie mit,",
    titleRest: "während Ihre Kunden wachsen.",
    intro: "Helfen Sie Unternehmen, bei Google, in der KI-Suche und in sozialen Netzwerken gefunden zu werden. Erhalten Sie **{range} Provision** auf die Abo-Zahlungen der Kunden, die Sie empfehlen – bis zu {months} Monate lang.",
    ctaApply: "Partner werden",
    ctaExplore: "Einnahmen ansehen",
    fineLine: "Kostenlose Bewerbung. Kein kostenpflichtiger RepGet-Tarif nötig.",
    portalQuestion: "Schon Partner?",
    portalLink: "Partner-Login",
    closed: "Bewerbungen sind noch nicht geöffnet. Schauen Sie bald wieder vorbei.",
    calculator: {
      head: "RepGet-Partner",
      headSub: "Einnahmen-Rechner",
      headBadge: "Interaktive Schätzung",
      network: "Ihr Empfehlungsnetzwerk",
      live: "Live-Simulation",
      direct: "Direkte Empfehlungen",
      hint: "Punkt berühren oder darüberfahren",
      hintMany: "{shown} angezeigt · Punkt berühren",
      svgLabel: "Interaktive Darstellung der Kunden, die Sie direkt empfehlen. Wählen Sie einen Punkt, um seine beispielhafte Provision zu sehen.",
      nodeLabel: "Simulierte Empfehlung {n} ansehen",
      you: "SIE",
      selected: "Ausgewählte Verbindung",
      referral: "Empfehlung Nr. {n}",
      kind: "Direkter zahlender Kunde · simuliert",
      perMonth: "pro Monat",
      add: "Empfehlung hinzufügen",
      explore: "{count} Empfehlungen ansehen",
      restart: "Netzwerk neu starten",
      fineprint: "Interaktive Darstellung · Jede Verbindung ist eine **direkte** Empfehlung, kein Strukturvertrieb.",
      scenario: "Ihr Einnahmen-Szenario",
      plan: "RepGet-Tarif wählen",
      monthlyPrices: "Monatspreise",
      planPrice: "{price} / Monat",
      customers: "Zahlende Kunden, die Sie empfehlen",
      people: "Personen",
      rates: "Provisionssätze",
      from: "Ab {count}",
      level: "Mit {count} zahlenden Kunden sind Sie {tier}: {rate} jeder Zahlung.",
      potential: "Mögliche Provision",
      perMonthShort: " / Monat",
      projection: "Prognose über {months} Monate",
      footStrong: "Echte wiederkehrende Provision.",
      footBody: "Transparente Bedingungen. Kein kostenpflichtiges Partner-Abo.",
      footLink: "So funktionieren Auszahlungen",
    },
    disclaimer:
      "Beispielhafte Einnahmen, keine Garantie. Angenommen wird, dass alle empfohlenen Kunden {months} Monate lang jeden Monat den Listenpreis des gewählten Tarifs zahlen. Tatsächliche Provisionen gelten für eingegangene berechtigte Zahlungen, nach Rabatten und ohne Steuern, Erstattungen und sonstige Korrekturen. Höhere Stufensätze gelten für Zahlungen, die nach Erreichen der Stufe eingehen.",
    trust: {
      start: "Provision zum Start",
      top: "Höchste verfügbare Stufe",
      monthsValue: "{months} Monate",
      months: "Provision pro empfohlenem Kunden",
      daysValue: "{days} Tage",
      days: "Zuordnungszeitraum für Empfehlungen",
    },
    ctaStart: "Jetzt empfehlen",
    stepsKicker: "Einfacher als gedacht",
    stepsTitle: "Drei Schritte. Eine wachsende Belohnung.",
    stepsIntro: "Ob große Reichweite oder eine Handvoll Geschäftskontakte: RepGet zu empfehlen ist ganz einfach.",
    stepLabel: "Schritt {n}",
    steps: [
      { title: "Partner werden", body: "Bewerben Sie sich mit Ihrem bestehenden oder einem kostenlosen RepGet-Konto. Jede Bewerbung wird persönlich geprüft." },
      { title: "Ihren Link teilen", body: "Empfehlen Sie eine vernetzte Wachstumsplattform für SEO, KI-Sichtbarkeit, Inhalte und Social Media. Ihr Link erfasst neue Anmeldungen." },
      { title: "Verdienen, wenn sie abonnieren", body: "Erhalten Sie Provision auf berechtigte Abo-Zahlungen, bis zu {months} Monate lang für jeden neu empfohlenen Kunden." },
    ],
    tiersKicker: "Ihre Einnahmen können wachsen",
    tiersTitle: "Mehr Kunden.\nBessere Provision.",
    tiersIntro: "Ihr Provisionssatz steigt, sobald die Zahl der von Ihnen empfohlenen zahlenden Konten die nächste Stufe erreicht.",
    tierLevel: "{n} / {name}",
    tierTop: "Höchste Stufe",
    tierStartTitle: "Sofort verdienen",
    tierStartBody: "Ihre Start-Provision auf berechtigte Abo-Zahlungen empfohlener Kunden.",
    tierFromTitle: "Ab {count} zahlenden Empfehlungen",
    tierNextBody: "Erreichen Sie {count} empfohlene zahlende Kunden und erhalten Sie eine höhere Provision auf die folgenden berechtigten Zahlungen.",
    tierTopBody: "Erhalten Sie den höchsten Satz auf die folgenden berechtigten Abo-Zahlungen. Keine veröffentlichte Obergrenze für Ihre Einnahmen.",
    audienceKicker: "Für alle, die gute Werkzeuge empfehlen",
    audienceTitle: "Ihr Einfluss hat bereits Wert.",
    audienceIntro: "RepGet hilft Unternehmen, in Suchmaschinen und sozialen Netzwerken zu wachsen. Wenn Ihr Publikum das braucht, haben Sie etwas wirklich Nützliches zu teilen.",
    audience: [
      { title: "SEO- und Marketingagenturen", body: "Empfehlen Sie Ihren Kunden, die Sie bereits beraten, eine Wachstumsplattform." },
      { title: "Creator und Lehrende", body: "Zeigen Sie RepGet in Videos, Leitfäden, Newslettern und Tutorials." },
      { title: "Blogger und Publisher", body: "Machen Sie aus hilfreichen Empfehlungen eine Einnahmequelle als Partner." },
      { title: "Berater und Gründer", body: "Stellen Sie Werkzeuge vor, mit denen andere Unternehmen mehr Kunden finden." },
    ],
    quoteKicker: "Warum RepGet-Partner werden?",
    quoteLead: "Sie verkaufen nicht noch ein Software-Tool.",
    quoteEm: "Sie zeigen einen Weg zu wachsen.",
    quoteFoot: "Inhalte. SEO. Backlinks. KI-Sichtbarkeit. Social-Media-Verbreitung.",
    quoteFoot2: "Eine vernetzte Plattform für das Wachstum von Unternehmen.",
    faqKicker: "Auf die Details kommt es an",
    faqTitle: "Gute Fragen.\nKlare Antworten.",
    faqIntro: "Transparente Bedingungen helfen Ihnen zu entscheiden, ob das RepGet-Partnerprogramm zu Ihnen passt.",
    faq: [
      {
        question: "Wie viel kann ich tatsächlich verdienen?",
        answer:
          "Sie starten mit {rate} Provision auf berechtigte Abo-Zahlungen der neuen Kunden, die Sie empfehlen. Der Satz steigt mit der Zahl der zahlenden Kunden, die Sie empfehlen: {tiers}. Jeder empfohlene Kunde kann {months} Monate ab seiner ersten Zahlung Provision bringen. Es gibt keine veröffentlichte Obergrenze für Ihre Einnahmen, aber die Ergebnisse hängen von tatsächlichen Zahlungen und Empfehlungen ab.",
      },
      {
        question: "Wann und wie werde ich bezahlt?",
        payout: true,
        answer:
          "Auszahlungen erfolgen am Ersten jedes Monats, sobald Provisionen mindestens {maturity} Tage alt sind und Ihr verfügbares Guthaben {amount} erreicht. Kleinere Guthaben werden in den nächsten Auszahlungszyklus übertragen. Auszahlungen gehen über Stripe Connect auf Ihr Bankkonto oder über PayPal, wo diese Option verfügbar ist.",
      },
      { question: "Muss ich für RepGet bezahlen, um mitzumachen?", answer: "Nein. Sie können sich mit einem kostenlosen RepGet-Konto oder Ihrem bestehenden Konto bewerben. Bewerbungen werden von Hand geprüft." },
      {
        question: "Was zählt als Empfehlung?",
        answer:
          "Nur neue RepGet-Konten können zählen. Die Zuordnung gilt {days} Tage, nachdem Ihr Partnerlink geöffnet wurde, und es zählt der erste Partnerlink, den ein Besucher öffnet. Bestehende Konten, Ihre eigenen Konten und Teammitglieder, die in ein anderes Konto eingeladen wurden, zählen nicht.",
      },
      {
        question: "Verdiene ich an Empfehlungen anderer Partner?",
        answer: "Nein. Das veröffentlichte RepGet-Partnerprogramm zahlt für Kunden, die Sie direkt empfehlen. Die Provisionsstufen sind Leistungsstufen, kein mehrstufiges Empfehlungsnetzwerk.",
      },
      {
        question: "Richtet sich die Provision nach dem ausgeschriebenen Tarifpreis?",
        answer:
          "Nein. Die Provision wird auf berechtigte Abo-Zahlungen berechnet, die tatsächlich eingegangen sind, nach Rabatten und ohne Steuern, Erstattungen, Rückbuchungen und Gutschriften. Zahlungen per Karte und per PayPal zählen beide; Partner-Gutscheincodes lassen sich nur bei Kartenzahlung verwenden. Neue Stufensätze gelten für berechtigte Zahlungen nach Erreichen der jeweiligen Stufe.",
      },
      {
        question: "Kann ich meinem Publikum einen Rabatt anbieten?",
        answer:
          "Partner-Gutscheine gibt es nicht automatisch, aber RepGet kann berechtigten Creatorn und Agenturen einen persönlichen Rabattcode zuweisen. Wenn ein neuer Kunde Ihren Code nutzt, kann die Empfehlung Ihnen zugeordnet werden.",
      },
      {
        question: "Wo sehe ich meine Empfehlungen und Einnahmen?",
        answer:
          "Ihr Partnerbereich zeigt Klicks auf Ihren Link, neue Registrierungen, zahlende Kunden, verdiente Provisionen und den Auszahlungsverlauf. Dort finden Sie auch Werbematerial zum Teilen mit Ihrem Publikum.",
      },
      {
        question: "Was passiert, wenn ein Kunde kündigt oder eine Erstattung erhält?",
        answer:
          "Sie erhalten Provision nur auf tatsächlich eingegangene berechtigte Zahlungen. Kündigt ein Kunde, gibt es für künftige unbezahlte Zeiträume keine Provision. Erstattungen und Rückbuchungen heben die zugehörige Provision auf, auch nach der Auszahlung; Korrekturen werden von künftigen Auszahlungen abgezogen.",
      },
    ],
    credits: {
      faq: "Derzeit werden Partner in RepGet-Credits bezahlt, nicht in Geld. Jede Provision wird {maturity} Tage nach der Zahlung des Kunden zu Credits, ohne Mindestbetrag: {rate}. Die Credits gehen in einen Arbeitsbereich, der Ihnen gehört und den Sie in Ihrem Partnerbereich wählen. Wird ein Kunde danach erstattet, wird der Betrag von Ihren nächsten Credits abgezogen.",
      rate: "{credits} Credits für je {price} Provision, der Preis des kleinsten Credit-Pakets",
      rateUnknown: "zum Preis des kleinsten Credit-Pakets",
      disclaimer: "Provisionen werden derzeit als RepGet-Credits ausgezahlt.",
    },
    tierPhrase: "{rate} ab {count} zahlenden Kunden",
    ctaKicker: "Ihre nächste Empfehlung kann sich lohnen",
    ctaTitle: "Helfen Sie den richtigen Unternehmen zu wachsen. Und werden Sie dafür belohnt.",
    ctaButton: "Als Partner bewerben",
    ctaSmall: "Kostenlose Bewerbung · Persönlich geprüft",
    creditBody: "Schon RepGet-Kunde? Sie können Unternehmen auch gegen RepGet-Guthaben statt Geld empfehlen.",
    creditLink: "Unternehmen gegen Guthaben empfehlen",
  },
  portal: {
    title: "Partnerbereich",
    nav: { overview: "Übersicht", referrals: "Empfehlungen", commissions: "Provisionen", payouts: "Auszahlungen", resources: "Material", settings: "Einstellungen", apply: "Bewerben", backToApp: "Zurück zu RepGet" },
    testMode: "Testmodus: Es fließt kein echtes Geld.",
    verify: {
      title: "Bestätigen Sie zuerst Ihre E-Mail-Adresse",
      body: "Das Affiliate-Programm zahlt echtes Geld, daher müssen wir wissen, dass diese Adresse Ihnen gehört. Wir senden Ihnen einen sechsstelligen Code.",
      send: "Code senden",
      sent: "Wir haben einen Code an {email} gesendet.",
      code: "Sechsstelliger Code",
      confirm: "Bestätigen",
      errors: { INVALID: "Dieser Code ist nicht richtig.", EXPIRED: "Der Code ist abgelaufen. Fordern Sie einen neuen an.", TOO_MANY: "Zu viele Versuche. Fordern Sie einen neuen Code an.", FAILED: "Wir konnten den Code nicht bestätigen. Versuchen Sie es erneut." },
    },
    apply: {
      title: "RepGet-Partner werden",
      eyebrow: "RepGet-Partnerprogramm",
      heading: "Lassen Sie uns gemeinsam wachsen.",
      intro: "Werden Sie Teil unseres Affiliate-Programms. Erzählen Sie uns von Ihrem Publikum und wie Sie RepGet vorstellen möchten.",
      cardTitle: "Partner werden",
      cardIntro: "Ein paar Angaben, damit wir Ihre Bewerbung prüfen können.",
      chip: "Persönlich geprüft",
      website: "Website oder Social-Media-Kanal",
      websiteHint: "Ihre Website, Ihr Newsletter, YouTube-Kanal oder Social-Media-Profil.",
      websitePlaceholder: "https://ihrewebsite.de",
      audience: "Ihr Publikum",
      audienceHint: "Erzählen Sie uns ein wenig über die Menschen, die Sie erreichen.",
      audiencePlaceholder: "Wer Ihnen folgt, wo diese Menschen sind und wie viele Sie ungefähr erreichen...",
      promotion: "Wie werden Sie RepGet bewerben?",
      promotionHint: "Eine kurze Beschreibung genügt.",
      promotionPlaceholder: "Zum Beispiel: Produkttests, Video-Tutorials, Newsletter, Blogbeiträge oder Empfehlungen an Kunden...",
      counter: "{count} / {max}",
      country: "Auszahlungsland",
      countryHint: "Die Verfügbarkeit von Auszahlungen hängt vom Land ab. Banküberweisungen und PayPal stehen berechtigten Partnern zur Verfügung.",
      countryHintCredits: "Partner werden derzeit in RepGet-Credits bezahlt, gutgeschrieben in einem Arbeitsbereich Ihrer Wahl. Wählen Sie das Land, in dem Sie ansässig sind.",
      countryPlaceholder: "Land auswählen",
      terms: "Ich stimme den {link} zu und verstehe, dass meine Bewerbung geprüft wird.",
      termsLink: "Bedingungen des Partnerprogramms",
      required: "Pflichtfeld",
      submit: "Bewerbung absenden",
      submitting: "Wird gesendet…",
      privacy: "Ihre Angaben werden nur zur Prüfung Ihrer Bewerbung verwendet.",
      questions: "Fragen zur Partnerschaft?",
      questionsLink: "Das Partnerprogramm ansehen",
      closed: "Bewerbungen sind derzeit geschlossen.",
      pendingTitle: "Ihre Bewerbung wird geprüft",
      pendingBody: "Wir schreiben Ihnen an {email}, sobald sie geprüft ist.",
      rejectedTitle: "Ihre letzte Bewerbung wurde nicht angenommen",
      rejectedBody: "Sie können sich mit mehr Details zu Ihrem Publikum erneut bewerben.",
      errors: {
        invalid: "Bitte prüfen Sie das Formular.",
        website: "Geben Sie eine gültige URL ein, die mit https:// oder http:// beginnt.",
        audience: "Bitte etwas ausführlicher (mindestens {min} Zeichen).",
        promotion: "Beschreiben Sie, wie Sie RepGet bewerben möchten (mindestens {min} Zeichen).",
        country: "Bitte wählen Sie Ihr Land.",
        terms: "Bitte akzeptieren Sie die Bedingungen des Partnerprogramms.",
        rate_limited: "Zu viele Bewerbungen. Versuchen Sie es morgen erneut.",
        disabled: "Bewerbungen sind derzeit geschlossen.",
        already_processed: "Sie haben sich bereits beworben.",
        generic: "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
      },
    },
    suspended: { title: "Ihr Partnerkonto ist gesperrt", body: "Ihr Verlauf bleibt erhalten. Neue Provisionen und Auszahlungen sind pausiert. Kontaktieren Sie uns, wenn Sie das für einen Fehler halten." },
    hold: { title: "Auszahlungen sind angehalten", body: "Ihre Einnahmen sind sicher; automatische Auszahlungen sind pausiert, während wir Ihr Konto prüfen." },
    overview: {
      title: "Übersicht",
      linkTitle: "Ihr Partnerlink",
      linkHint: "Besucher, die ihn öffnen und innerhalb von {days} Tagen ein neues RepGet-Konto erstellen, werden Ihnen zugeordnet.",
      linkAnyPage: "Er funktioniert auch auf jeder RepGet-Seite: Hängen Sie ?ref={code} an die Adresse an, zum Beispiel {example}.",
      copy: "Link kopieren",
      copied: "Kopiert",
      tierTitle: "Ihre Partnerstufe",
      progress: "{count} / {target} zahlende Kunden",
      remaining: "Noch {count} Kunden bis {tier}.",
      topTier: "Sie sind auf der höchsten Stufe.",
      recurring: "{rate} wiederkehrende Provision",
      nextLevel: "Nächste Stufe",
      levelRate: "{rate} Provision",
      cards: { earned: "Insgesamt verdient", pending: "Ausstehend", paid: "Ausgezahlt", referrals: "Empfehlungen", payingCustomers: "Zahlende Kunden" },
      definitions: {
        earned: "Verdiente Provision abzüglich Erstattungen und Rückbuchungen.",
        pending: "Verdient, noch nicht an Sie ausgezahlt.",
        paid: "Über Stripe an Sie gesendet.",
        referrals: "Kunden, die Sie geworben haben, per Link oder Gutschein (ohne disqualifizierte).",
        payingCustomers: "Geworbene Kunden, die derzeit zahlen. Diese Zahl bestimmt Ihre Stufe.",
      },
      breakdown: { approved: "Freigegeben, wird mit der nächsten Auszahlung gezahlt: {amount}", waiting: "Wartezeit von {maturity} Tagen, angehalten oder in Prüfung: {amount}", sending: "Wird gerade gesendet: {amount}", inBank: "Bereits auf Ihrem Bankkonto: {amount}" },
      latestTitle: "Neueste Provisionen",
      latestAll: "Alle Provisionen",
      noEarnings: "Noch keine Provision. Teilen Sie Ihren Link, um zu beginnen.",
      noThreshold: "Automatische Auszahlungen sind für {currency} noch nicht verfügbar. Ihr Guthaben bleibt erhalten und wird hier angezeigt.",
      threshold: "Auszahlungen beginnen, sobald Ihr freigegebenes Guthaben {amount} erreicht.",
      metrics: {
        clicks: "Link-Klicks",
        signups: "Neue Konten",
        referred: "Geworbene Kunden",
        customers: "Kunden mit Zahlung",
        conversion: "Vom Klick zur Zahlung",
        range: "Letzte {days} Tage",
        period: "Zeitraum",
        since: "{start} bis {end} (UTC)",
        definition: "Im Zeitraum gezählt: erfasste Aufrufe Ihres Links, über Ihren Link erstellte neue Konten, Ihnen zugeordnete Kunden (Link oder Gutschein) und davon diejenigen mit einer provisionsfähigen Zahlung.",
      },
      balancesTitle: "Einnahmen",
      currencyNote: "Jede Währung wird getrennt angezeigt. Beträge werden nie umgerechnet.",
      offset: "{amount} wird von den nächsten Auszahlungen abgezogen (eine Erstattung oder Korrektur nach einer Auszahlung).",
      nextPayout: "Nächster Auszahlungslauf: {date}",
      couponsTitle: "Ihre Gutscheine",
      copyCode: "Code kopieren",
      noCoupons: "Ihnen wurde kein Gutschein zugewiesen.",
      couponDiscount: "{discount} für Neukunden",
    },
    referrals: {
      title: "Empfehlungen",
      intro: "Ihnen zugeordnete Konten. Kunden werden mit einer verkürzten Website-Adresse oder einer Referenz angezeigt, nie mit Name oder E-Mail.",
      customer: "Kunde",
      source: "Herkunft",
      since: "Seit",
      status: "Status",
      empty: "Noch keine Empfehlungen.",
      statuses: { active: "Aktiv", review: "In Prüfung", disqualified: "Nicht berechtigt" },
      sources: { link: "Link", coupon: "Gutschein" },
    },
    commissions: {
      title: "Provisionen",
      intro: "Eine Zeile pro Zahlung eines empfohlenen Kunden. Beträge in der Währung, in der gezahlt wurde.",
      date: "Zahlungsdatum",
      customer: "Kunde",
      plan: "Tarif",
      perMonth: "{price}/Monat",
      perYear: "{price}/Jahr",
      base: "Bezahlt (ohne Steuern)",
      rate: "Satz",
      amount: "Provision",
      status: "Status",
      matures: "Auszahlbar ab",
      empty: "Noch keine Provisionen.",
      statuses: { pending: "Ausstehend", available: "Freigegeben", reserved: "In Auszahlung", paid: "Gezahlt", reversed: "Storniert", held: "Angehalten", review: "In Prüfung" },
      reversed: "{amount} storniert",
    },
    payouts: {
      title: "Auszahlungen",
      intro: "Jede Auszahlung geht zuerst an Ihr Stripe-Guthaben und dann von Stripe an Ihre Bank. Beide Schritte werden angezeigt.",
      date: "Datum",
      amount: "Betrag",
      transfer: "An Ihr Stripe-Guthaben",
      bank: "An Ihre Bank",
      empty: "Noch keine Auszahlungen.",
      transferStates: { pending: "In Vorbereitung", processing: "Wird gesendet", confirmed: "Gesendet", reversed: "Storniert" },
      bankStates: { not_started: "Nicht begonnen", pending: "Ausstehend", in_transit: "Unterwegs", paid: "Gezahlt", failed: "Fehlgeschlagen - wir versuchen es erneut" },
      schedule: "Auszahlungen erfolgen am ersten Tag jedes Monats.",
      offset: "{amount} für Korrekturen abgezogen",
      arrival: "Voraussichtlich am {date}",
    },
    setup: {
      title: "Auszahlungen einrichten",
      intro: "Auszahlungen laufen über Stripe. Stripe fragt nach Ihrer Identität und Ihren Bankdaten; RepGet sieht sie nie.",
      states: {
        not_started: { title: "Auszahlungen einrichten", body: "Sie können schon vorher Provision verdienen. Für die Auszahlung brauchen Sie es." },
        setup_required: { title: "Schließen Sie die Einrichtung bei Stripe ab", body: "Stripe benötigt noch einige Angaben, bevor es Sie bezahlen kann." },
        verification_pending: { title: "Stripe prüft Ihre Angaben", body: "Das dauert meist ein paar Minuten, manchmal einige Tage. Im Moment ist nichts zu tun." },
        restricted: { title: "Stripe benötigt weitere Angaben", body: "Auszahlungen sind pausiert, bis die fehlenden Angaben vorliegen." },
        ready: { title: "Auszahlungen sind bereit", body: "Ihre Auszahlungen werden automatisch gesendet." },
        unavailable: { title: "Auszahlungen sind noch nicht verfügbar", body: "Die Einrichtung von Auszahlungen ist auf dieser Website noch nicht freigeschaltet. Ihre Einnahmen werden erfasst." },
      },
      start: "Auszahlungen mit Stripe einrichten",
      continue: "Weiter mit Stripe",
      dashboard: "Ihr Stripe-Dashboard öffnen",
      refresh: "Erneut prüfen",
      country: "Auszahlungsland: {country}",
      countryUnsupported: "Auszahlungen sind in {country} noch nicht verfügbar. Kontaktieren Sie uns, um Ihr Auszahlungsland zu ändern.",
      errors: {
        generic: "Stripe ist nicht erreichbar. Versuchen Sie es gleich noch einmal.",
        provider_outcome_unknown: "Stripe hat nicht geantwortet. Versuchen Sie es erneut - nichts wird doppelt eingerichtet.",
        onboarding_incomplete: "Schließen Sie zuerst die Einrichtung bei Stripe ab.",
        suspended: "Ihr Partnerkonto ist gesperrt.",
        disabled: "Die Einrichtung von Auszahlungen ist noch nicht verfügbar.",
      },
    },
    resources: {
      title: "Material",
      intro: "Logos und fertige Texte, die Sie gerne verwenden können. Bitte beschreiben Sie RepGet zutreffend.",
      logos: "Logos",
      logosIntro: "Verwenden Sie das Logo unverändert: Ändern Sie weder Farben noch Proportionen.",
      banners: "Banner",
      bannersIntro: "Fertige Bilder für Websites und Newsletter. Verlinken Sie sie mit Ihrem Partnerlink.",
      files: { logo: "Logo für helle Hintergründe", logoLight: "Logo für dunkle Hintergründe", mark: "Symbol", banner: "Banner {size}" },
      copyText: "Text kopieren",
      download: "Herunterladen",
      copyTitle: "Texte zur Verwendung",
      copyIntro: "Passen Sie sie frei an. Versprechen Sie bitte keine Ergebnisse oder Einnahmen.",
      templates: [
        { title: "Kurz", body: "Ich nutze RepGet, um SEO-Artikel für meine Websites zu planen, zu schreiben und zu veröffentlichen. Probieren Sie es aus: {link}" },
        { title: "Newsletter", body: "Wer Inhalte für Suchtraffic veröffentlicht: RepGet recherchiert Keywords, schreibt Artikel in Ihrem Stil und veröffentlicht sie auf Ihrer Website. Schauen Sie es sich an: {link}" },
        { title: "Für Kunden", body: "Für Ihren Blog können wir RepGet einsetzen: Es macht aus der Keyword-Recherche einen Redaktionsplan und schreibt die Artikel zur Freigabe. Hier ist der Link: {link}" },
      ],
      rules: "Wenn Sie RepGet bewerben",
      rulesList: [
        "Geben Sie an, dass Sie Partner sind und eine Provision erhalten können.",
        "Bieten Sie in Suchanzeigen nicht auf den Namen RepGet und verwenden Sie unseren Namen nicht in Domains oder Social-Media-Konten.",
        "Versprechen Sie keine Rankings, keinen Traffic und keine Einnahmen.",
        "Senden Sie keine unerwünschten Nachrichten.",
      ],
    },
    settings: { title: "Einstellungen", profile: "Partnerprofil", name: "Name", email: "E-Mail", country: "Auszahlungsland", code: "Empfehlungscode", status: "Status", statuses: { active: "Aktiv", suspended: "Gesperrt" } },
    pagination: { previous: "Zurück", next: "Weiter", page: "Seite {page} von {pages}" },
    failure: { title: "Diese Seite konnte nicht geladen werden", body: "Ein neuer Versuch hilft meist. Ihre Einnahmen und Auszahlungen sind nicht betroffen.", reference: "Wenn es wieder passiert, nennen Sie dem Support die Referenz {reference}.", retry: "Erneut versuchen" },
  },
};

const COPY: Record<Locale, PartnerCopy> = { en, es, fr, it, de };

export function partnerCopy(locale: Locale): PartnerCopy {
  return COPY[locale] ?? en;
}

/** "{a} and {b}" -> filled. Unknown placeholders are left visible rather than silently dropped. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}
