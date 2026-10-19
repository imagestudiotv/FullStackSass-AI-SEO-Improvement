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

export type PartnerCopy = {
  page: {
    metaTitle: string;
    metaDescription: string;
    eyebrow: string;
    title: string;
    intro: string;
    ctaApply: string;
    ctaPortal: string;
    /** Shown instead of the apply button while applications are closed. */
    closed: string;
    highlights: { recurring: string; months: string; payout: string };
    stepsTitle: string;
    steps: { title: string; body: string }[];
    tiersTitle: string;
    tiersIntro: string;
    tierFrom: string;
    tierStart: string;
    termsTitle: string;
    terms: string[];
    creditTitle: string;
    creditBody: string;
    creditLink: string;
  };
  portal: {
    title: string;
    nav: { overview: string; referrals: string; commissions: string; payouts: string; resources: string; settings: string; apply: string; backToApp: string };
    testMode: string;
    verify: { title: string; body: string; send: string; sent: string; code: string; confirm: string; errors: Record<"INVALID" | "EXPIRED" | "TOO_MANY" | "FAILED", string> };
    apply: {
      title: string;
      intro: string;
      website: string;
      websiteHint: string;
      audience: string;
      audienceHint: string;
      promotion: string;
      promotionHint: string;
      country: string;
      countryHint: string;
      terms: string;
      submit: string;
      submitting: string;
      closed: string;
      pendingTitle: string;
      pendingBody: string;
      rejectedTitle: string;
      rejectedBody: string;
      errors: Record<"invalid" | "website" | "audience" | "promotion" | "country" | "rate_limited" | "disabled" | "already_processed" | "generic", string>;
    };
    suspended: { title: string; body: string };
    hold: { title: string; body: string };
    overview: {
      title: string;
      linkTitle: string;
      linkHint: string;
      copy: string;
      copied: string;
      tierTitle: string;
      progress: string;
      remaining: string;
      topTier: string;
      cards: { earned: string; pending: string; available: string; transferred: string; bankPaid: string };
      definitions: { earned: string; pending: string; available: string; transferred: string; bankPaid: string };
      noEarnings: string;
      noThreshold: string;
      threshold: string;
      metrics: { clicks: string; signups: string; customers: string; conversion: string; range: string };
      couponsTitle: string;
      noCoupons: string;
      couponDiscount: string;
    };
    referrals: { title: string; intro: string; customer: string; source: string; since: string; status: string; empty: string; statuses: Record<"active" | "review" | "disqualified", string>; sources: Record<"link" | "coupon", string> };
    commissions: {
      title: string;
      intro: string;
      date: string;
      customer: string;
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
    resources: { title: string; intro: string; logos: string; download: string; copyTitle: string; copyIntro: string; templates: { title: string; body: string }[]; rules: string; rulesList: string[] };
    settings: { title: string; profile: string; name: string; email: string; country: string; code: string; status: string; statuses: Record<"active" | "suspended", string> };
    pagination: { previous: string; next: string; page: string };
  };
};

const en: PartnerCopy = {
  page: {
    metaTitle: "Partner program: recurring commission",
    metaDescription:
      "Join the RepGet partner program: share your link, earn a recurring cash commission on what your referrals pay, paid monthly through Stripe.",
    eyebrow: "Partner program",
    title: "Earn a recurring commission for every customer you refer",
    intro:
      "Recommend RepGet to the businesses and agencies you work with. When someone you refer opens a new account and pays for a subscription, you earn part of every payment they make.",
    ctaApply: "Apply with your RepGet account",
    ctaPortal: "Open the partner portal",
    closed: "Applications are not open yet. Please check back soon.",
    highlights: {
      recurring: "{rate} of every payment, to start",
      months: "{months} months of commission per customer",
      payout: "Paid monthly once you reach {amount}",
    },
    stepsTitle: "How it works",
    steps: [
      { title: "Apply with the account you already have", body: "No new login and no paid plan needed. We review every application by hand." },
      { title: "Share your link", body: "You get a personal link and, sometimes, a coupon for your audience." },
      { title: "Earn on real payments", body: "Commission is calculated on what your referrals actually pay - after discounts, without tax - and paid out to your bank through Stripe." },
    ],
    tiersTitle: "Your rate grows with you",
    tiersIntro: "Tiers count the paying customer accounts you referred. A higher rate applies to payments made after you reach a tier.",
    tierFrom: "From {count} paying customers",
    tierStart: "Starting rate",
    termsTitle: "The rules, before you share anything",
    terms: [
      "Commission is paid only on subscription payments collected through Stripe. Taxes, refunds, chargebacks and credits are excluded.",
      "Each referred customer earns you commission for {months} months from their first payment.",
      "Only new RepGet accounts count. Existing accounts, team members invited to someone else's account and your own accounts never do.",
      "A link counts for {days} days after it is opened. The first partner link a visitor opens is the one that counts.",
      "Commissions wait {maturity} days before they can be paid. Payouts run on the first day of each month once your balance reaches the threshold.",
      "Payouts go through Stripe Connect. You set up your payout account with Stripe; RepGet never sees your bank details.",
      "Refunds and chargebacks reverse the commission earned on them, including after it was paid.",
    ],
    creditTitle: "Already a customer?",
    creditBody: "Customers can also refer other businesses and earn RepGet credit instead of cash. That program is separate and unchanged.",
    creditLink: "Refer a business for credit",
  },
  portal: {
    title: "Partner portal",
    nav: { overview: "Overview", referrals: "Referrals", commissions: "Commissions", payouts: "Payouts", resources: "Resources", settings: "Settings", apply: "Apply", backToApp: "Back to RepGet" },
    testMode: "Test mode: no real money moves.",
    verify: {
      title: "Confirm your email address first",
      body: "The partner program pays real money, so we need to know this address is yours. We will send a six-digit code.",
      send: "Send the code",
      sent: "We sent a code to {email}.",
      code: "Six-digit code",
      confirm: "Confirm",
      errors: { INVALID: "That code is not right.", EXPIRED: "That code has expired. Send a new one.", TOO_MANY: "Too many attempts. Send a new code.", FAILED: "We could not confirm the code. Try again." },
    },
    apply: {
      title: "Apply to the partner program",
      intro: "Tell us where you will recommend RepGet. We read every application and reply by email.",
      website: "Website or channel",
      websiteHint: "Where you will share RepGet - a site, newsletter or channel URL.",
      audience: "Your audience",
      audienceHint: "Who reads or follows you, roughly how many, and where.",
      promotion: "How you will promote RepGet",
      promotionHint: "For example reviews, tutorials, a newsletter or client recommendations.",
      country: "Payout country",
      countryHint: "The country your payouts will be made in. Stripe supports the countries listed.",
      terms: "I agree to the partner program rules shown on the partner page.",
      submit: "Send application",
      submitting: "Sending…",
      closed: "Applications are closed at the moment.",
      pendingTitle: "Your application is being reviewed",
      pendingBody: "We will email you at {email} when it has been reviewed.",
      rejectedTitle: "Your last application was not approved",
      rejectedBody: "You can apply again with more detail about your audience.",
      errors: {
        invalid: "Please check the form.",
        website: "Enter the full address of your website or channel, starting with https://.",
        audience: "Describe your audience in a sentence or two.",
        promotion: "Describe how you will promote RepGet in a sentence or two.",
        country: "Choose a payout country from the list.",
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
      copy: "Copy link",
      copied: "Copied",
      tierTitle: "Your tier",
      progress: "{count} / {target} paying customers",
      remaining: "{count} more customers to reach {tier} - {rate}",
      topTier: "You are on the top tier.",
      cards: { earned: "Total earned", pending: "Pending", available: "Available", transferred: "Transferred", bankPaid: "Paid to your bank" },
      definitions: {
        earned: "Commission earned, minus refunds and chargebacks.",
        pending: "Not payable yet: waiting the {maturity} days, held or under review.",
        available: "Payable at the next monthly payout.",
        transferred: "Sent to your Stripe balance.",
        bankPaid: "Confirmed by Stripe as paid to your bank.",
      },
      noEarnings: "No commission yet. Share your link to get started.",
      noThreshold: "Automatic payouts are not available for {currency} yet. Your balance is kept and shown here.",
      threshold: "Payouts start once your available balance reaches {amount}.",
      metrics: { clicks: "Link clicks", signups: "New accounts", customers: "Paying customers", conversion: "Clicks to paying", range: "Last {days} days" },
      couponsTitle: "Your coupons",
      noCoupons: "No coupon has been assigned to you.",
      couponDiscount: "{discount} for new customers",
    },
    referrals: {
      title: "Referrals",
      intro: "Accounts attributed to you. Customers are shown by their website, never by name or email.",
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
      base: "Commissionable",
      rate: "Rate",
      amount: "Commission",
      status: "Status",
      matures: "Payable from",
      empty: "No commissions yet.",
      statuses: { pending: "Pending", available: "Available", reserved: "In payout", paid: "Paid", reversed: "Reversed", held: "On hold", review: "Under review" },
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
  },
};

const es: PartnerCopy = {
  page: {
    metaTitle: "Programa de socios: comisión recurrente",
    metaDescription:
      "Únase al programa de socios de RepGet: comparta su enlace y gane una comisión recurrente sobre lo que pagan sus referidos, abonada cada mes con Stripe.",
    eyebrow: "Programa de socios",
    title: "Gane una comisión recurrente por cada cliente que recomiende",
    intro:
      "Recomiende RepGet a las empresas y agencias con las que trabaja. Cuando alguien que usted recomienda abre una cuenta nueva y paga una suscripción, usted recibe una parte de cada pago.",
    ctaApply: "Solicitar con su cuenta de RepGet",
    ctaPortal: "Abrir el portal de socios",
    closed: "Las solicitudes aún no están abiertas. Vuelva pronto.",
    highlights: {
      recurring: "{rate} de cada pago, para empezar",
      months: "{months} meses de comisión por cliente",
      payout: "Pago mensual a partir de {amount}",
    },
    stepsTitle: "Cómo funciona",
    steps: [
      { title: "Solicite con la cuenta que ya tiene", body: "Sin nuevo inicio de sesión ni plan de pago. Revisamos cada solicitud personalmente." },
      { title: "Comparta su enlace", body: "Recibe un enlace personal y, a veces, un cupón para su audiencia." },
      { title: "Gane con pagos reales", body: "La comisión se calcula sobre lo que sus referidos pagan realmente - tras descuentos y sin impuestos - y se le transfiere a su banco mediante Stripe." },
    ],
    tiersTitle: "Su porcentaje crece con usted",
    tiersIntro: "Los niveles cuentan las cuentas de clientes de pago que usted ha recomendado. El porcentaje superior se aplica a los pagos posteriores a alcanzar el nivel.",
    tierFrom: "Desde {count} clientes de pago",
    tierStart: "Porcentaje inicial",
    termsTitle: "Las reglas, antes de compartir nada",
    terms: [
      "La comisión solo se paga sobre pagos de suscripción cobrados mediante Stripe. Se excluyen impuestos, reembolsos, contracargos y créditos.",
      "Cada cliente recomendado le genera comisión durante {months} meses desde su primer pago.",
      "Solo cuentan las cuentas nuevas de RepGet. Nunca cuentan las cuentas existentes, los miembros invitados a la cuenta de otra persona ni sus propias cuentas.",
      "Un enlace cuenta durante {days} días desde que se abre. Cuenta el primer enlace de socio que abre el visitante.",
      "Las comisiones esperan {maturity} días antes de poder pagarse. Los pagos se realizan el primer día de cada mes cuando su saldo alcanza el mínimo.",
      "Los pagos se realizan con Stripe Connect. Usted configura su cuenta de cobro con Stripe; RepGet nunca ve sus datos bancarios.",
      "Los reembolsos y contracargos anulan la comisión obtenida sobre ellos, también después de haberla pagado.",
    ],
    creditTitle: "¿Ya es cliente?",
    creditBody: "Los clientes también pueden recomendar otras empresas y recibir crédito de RepGet en lugar de dinero. Ese programa es distinto y no cambia.",
    creditLink: "Recomendar una empresa a cambio de crédito",
  },
  portal: {
    title: "Portal de socios",
    nav: { overview: "Resumen", referrals: "Referidos", commissions: "Comisiones", payouts: "Pagos", resources: "Recursos", settings: "Ajustes", apply: "Solicitar", backToApp: "Volver a RepGet" },
    testMode: "Modo de prueba: no se mueve dinero real.",
    verify: {
      title: "Confirme primero su dirección de correo",
      body: "El programa de socios paga dinero real, por lo que necesitamos saber que esta dirección es suya. Le enviaremos un código de seis dígitos.",
      send: "Enviar el código",
      sent: "Hemos enviado un código a {email}.",
      code: "Código de seis dígitos",
      confirm: "Confirmar",
      errors: { INVALID: "Ese código no es correcto.", EXPIRED: "El código ha caducado. Solicite uno nuevo.", TOO_MANY: "Demasiados intentos. Solicite un código nuevo.", FAILED: "No pudimos confirmar el código. Inténtelo de nuevo." },
    },
    apply: {
      title: "Solicitar el programa de socios",
      intro: "Díganos dónde recomendará RepGet. Leemos cada solicitud y respondemos por correo.",
      website: "Sitio web o canal",
      websiteHint: "Dónde compartirá RepGet: la URL de un sitio, boletín o canal.",
      audience: "Su audiencia",
      audienceHint: "Quién le lee o sigue, aproximadamente cuántos y dónde.",
      promotion: "Cómo promocionará RepGet",
      promotionHint: "Por ejemplo, reseñas, tutoriales, un boletín o recomendaciones a clientes.",
      country: "País de cobro",
      countryHint: "El país en el que recibirá los pagos. Stripe admite los países de la lista.",
      terms: "Acepto las reglas del programa de socios que figuran en la página de socios.",
      submit: "Enviar solicitud",
      submitting: "Enviando…",
      closed: "Las solicitudes están cerradas en este momento.",
      pendingTitle: "Estamos revisando su solicitud",
      pendingBody: "Le escribiremos a {email} cuando la hayamos revisado.",
      rejectedTitle: "Su última solicitud no fue aprobada",
      rejectedBody: "Puede volver a solicitarlo con más detalles sobre su audiencia.",
      errors: {
        invalid: "Revise el formulario.",
        website: "Indique la dirección completa de su sitio o canal, empezando por https://.",
        audience: "Describa su audiencia en una o dos frases.",
        promotion: "Describa cómo promocionará RepGet en una o dos frases.",
        country: "Elija un país de cobro de la lista.",
        rate_limited: "Demasiadas solicitudes. Inténtelo mañana.",
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
      copy: "Copiar enlace",
      copied: "Copiado",
      tierTitle: "Su nivel",
      progress: "{count} / {target} clientes de pago",
      remaining: "{count} clientes más para llegar a {tier} - {rate}",
      topTier: "Está en el nivel más alto.",
      cards: { earned: "Total ganado", pending: "Pendiente", available: "Disponible", transferred: "Transferido", bankPaid: "Pagado a su banco" },
      definitions: {
        earned: "Comisión ganada, menos reembolsos y contracargos.",
        pending: "Aún no pagable: esperando los {maturity} días, retenida o en revisión.",
        available: "Se pagará en el próximo pago mensual.",
        transferred: "Enviado a su saldo de Stripe.",
        bankPaid: "Stripe confirma que se pagó a su banco.",
      },
      noEarnings: "Aún no hay comisiones. Comparta su enlace para empezar.",
      noThreshold: "Los pagos automáticos aún no están disponibles en {currency}. Su saldo se conserva y se muestra aquí.",
      threshold: "Los pagos empiezan cuando su saldo disponible alcanza {amount}.",
      metrics: { clicks: "Clics en el enlace", signups: "Cuentas nuevas", customers: "Clientes de pago", conversion: "De clic a pago", range: "Últimos {days} días" },
      couponsTitle: "Sus cupones",
      noCoupons: "No tiene ningún cupón asignado.",
      couponDiscount: "{discount} para clientes nuevos",
    },
    referrals: {
      title: "Referidos",
      intro: "Cuentas que se le atribuyen. Los clientes se muestran por su sitio web, nunca por nombre ni correo.",
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
      base: "Base",
      rate: "Porcentaje",
      amount: "Comisión",
      status: "Estado",
      matures: "Pagable desde",
      empty: "Aún no hay comisiones.",
      statuses: { pending: "Pendiente", available: "Disponible", reserved: "En pago", paid: "Pagada", reversed: "Anulada", held: "Retenida", review: "En revisión" },
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
  },
};

const fr: PartnerCopy = {
  page: {
    metaTitle: "Programme partenaires : commission récurrente",
    metaDescription:
      "Rejoignez le programme partenaires RepGet : partagez votre lien et touchez une commission récurrente sur les paiements de vos filleuls, versée via Stripe.",
    eyebrow: "Programme partenaires",
    title: "Touchez une commission récurrente pour chaque client recommandé",
    intro:
      "Recommandez RepGet aux entreprises et agences avec lesquelles vous travaillez. Lorsqu'une personne que vous recommandez ouvre un nouveau compte et paie un abonnement, vous touchez une part de chacun de ses paiements.",
    ctaApply: "Postuler avec votre compte RepGet",
    ctaPortal: "Ouvrir l'espace partenaire",
    closed: "Les candidatures ne sont pas encore ouvertes. Revenez bientôt.",
    highlights: {
      recurring: "{rate} de chaque paiement, pour commencer",
      months: "{months} mois de commission par client",
      payout: "Versement mensuel à partir de {amount}",
    },
    stepsTitle: "Comment ça marche",
    steps: [
      { title: "Postulez avec le compte que vous avez déjà", body: "Aucun nouvel identifiant ni abonnement payant. Nous examinons chaque candidature nous-mêmes." },
      { title: "Partagez votre lien", body: "Vous recevez un lien personnel et parfois un code promo pour votre audience." },
      { title: "Gagnez sur de vrais paiements", body: "La commission est calculée sur ce que vos filleuls paient réellement - après remises, hors taxes - et versée sur votre compte bancaire via Stripe." },
    ],
    tiersTitle: "Votre taux évolue avec vous",
    tiersIntro: "Les paliers comptent les comptes clients payants que vous avez recommandés. Le taux supérieur s'applique aux paiements effectués après l'atteinte du palier.",
    tierFrom: "À partir de {count} clients payants",
    tierStart: "Taux de départ",
    termsTitle: "Les règles, avant de partager quoi que ce soit",
    terms: [
      "La commission ne porte que sur les paiements d'abonnement encaissés via Stripe. Taxes, remboursements, rétrofacturations et crédits sont exclus.",
      "Chaque client recommandé vous rapporte une commission pendant {months} mois à partir de son premier paiement.",
      "Seuls les nouveaux comptes RepGet comptent. Les comptes existants, les membres invités sur le compte de quelqu'un d'autre et vos propres comptes ne comptent jamais.",
      "Un lien compte pendant {days} jours après son ouverture. C'est le premier lien partenaire ouvert par le visiteur qui compte.",
      "Les commissions attendent {maturity} jours avant de pouvoir être versées. Les versements ont lieu le premier jour de chaque mois dès que votre solde atteint le seuil.",
      "Les versements passent par Stripe Connect. Vous configurez votre compte de versement avec Stripe ; RepGet ne voit jamais vos coordonnées bancaires.",
      "Les remboursements et rétrofacturations annulent la commission correspondante, y compris après son versement.",
    ],
    creditTitle: "Déjà client ?",
    creditBody: "Les clients peuvent aussi recommander d'autres entreprises et recevoir des crédits RepGet au lieu d'argent. Ce programme est distinct et inchangé.",
    creditLink: "Recommander une entreprise contre des crédits",
  },
  portal: {
    title: "Espace partenaire",
    nav: { overview: "Aperçu", referrals: "Filleuls", commissions: "Commissions", payouts: "Versements", resources: "Ressources", settings: "Paramètres", apply: "Postuler", backToApp: "Retour à RepGet" },
    testMode: "Mode test : aucun argent réel ne circule.",
    verify: {
      title: "Confirmez d'abord votre adresse e-mail",
      body: "Le programme partenaires verse de l'argent réel : nous devons savoir que cette adresse est bien la vôtre. Nous allons vous envoyer un code à six chiffres.",
      send: "Envoyer le code",
      sent: "Nous avons envoyé un code à {email}.",
      code: "Code à six chiffres",
      confirm: "Confirmer",
      errors: { INVALID: "Ce code n'est pas correct.", EXPIRED: "Ce code a expiré. Demandez-en un nouveau.", TOO_MANY: "Trop de tentatives. Demandez un nouveau code.", FAILED: "Nous n'avons pas pu confirmer le code. Réessayez." },
    },
    apply: {
      title: "Postuler au programme partenaires",
      intro: "Dites-nous où vous recommanderez RepGet. Nous lisons chaque candidature et répondons par e-mail.",
      website: "Site ou chaîne",
      websiteHint: "Là où vous partagerez RepGet : l'URL d'un site, d'une newsletter ou d'une chaîne.",
      audience: "Votre audience",
      audienceHint: "Qui vous lit ou vous suit, combien de personnes environ, et où.",
      promotion: "Comment vous promouvrez RepGet",
      promotionHint: "Par exemple des avis, des tutoriels, une newsletter ou des recommandations à vos clients.",
      country: "Pays de versement",
      countryHint: "Le pays dans lequel vos versements seront effectués. Stripe prend en charge les pays listés.",
      terms: "J'accepte les règles du programme partenaires présentées sur la page partenaires.",
      submit: "Envoyer la candidature",
      submitting: "Envoi…",
      closed: "Les candidatures sont fermées pour le moment.",
      pendingTitle: "Votre candidature est en cours d'examen",
      pendingBody: "Nous vous écrirons à {email} une fois qu'elle aura été examinée.",
      rejectedTitle: "Votre dernière candidature n'a pas été acceptée",
      rejectedBody: "Vous pouvez postuler à nouveau en donnant plus de détails sur votre audience.",
      errors: {
        invalid: "Vérifiez le formulaire.",
        website: "Indiquez l'adresse complète de votre site ou chaîne, en commençant par https://.",
        audience: "Décrivez votre audience en une ou deux phrases.",
        promotion: "Décrivez comment vous promouvrez RepGet en une ou deux phrases.",
        country: "Choisissez un pays de versement dans la liste.",
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
      copy: "Copier le lien",
      copied: "Copié",
      tierTitle: "Votre palier",
      progress: "{count} / {target} clients payants",
      remaining: "Encore {count} clients pour atteindre {tier} - {rate}",
      topTier: "Vous êtes au palier le plus élevé.",
      cards: { earned: "Total gagné", pending: "En attente", available: "Disponible", transferred: "Transféré", bankPaid: "Versé sur votre banque" },
      definitions: {
        earned: "Commission gagnée, moins remboursements et rétrofacturations.",
        pending: "Pas encore versable : délai de {maturity} jours, retenue ou en examen.",
        available: "Versée lors du prochain versement mensuel.",
        transferred: "Envoyé sur votre solde Stripe.",
        bankPaid: "Confirmé par Stripe comme versé sur votre banque.",
      },
      noEarnings: "Aucune commission pour l'instant. Partagez votre lien pour commencer.",
      noThreshold: "Les versements automatiques ne sont pas encore disponibles en {currency}. Votre solde est conservé et affiché ici.",
      threshold: "Les versements commencent quand votre solde disponible atteint {amount}.",
      metrics: { clicks: "Clics sur le lien", signups: "Nouveaux comptes", customers: "Clients payants", conversion: "Du clic au paiement", range: "{days} derniers jours" },
      couponsTitle: "Vos codes promo",
      noCoupons: "Aucun code promo ne vous a été attribué.",
      couponDiscount: "{discount} pour les nouveaux clients",
    },
    referrals: {
      title: "Filleuls",
      intro: "Comptes qui vous sont attribués. Les clients apparaissent par leur site, jamais par leur nom ou leur e-mail.",
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
      base: "Base",
      rate: "Taux",
      amount: "Commission",
      status: "Statut",
      matures: "Versable à partir du",
      empty: "Aucune commission pour l'instant.",
      statuses: { pending: "En attente", available: "Disponible", reserved: "En versement", paid: "Versée", reversed: "Annulée", held: "Retenue", review: "En examen" },
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
  },
};

const it: PartnerCopy = {
  page: {
    metaTitle: "Programma partner: commissione ricorrente",
    metaDescription:
      "Entri nel programma partner di RepGet: condivida il suo link e guadagni una commissione ricorrente su quanto pagano i suoi referral, versata con Stripe.",
    eyebrow: "Programma partner",
    title: "Guadagni una commissione ricorrente per ogni cliente che segnala",
    intro:
      "Consigli RepGet alle aziende e alle agenzie con cui lavora. Quando una persona che lei segnala apre un nuovo account e paga un abbonamento, lei riceve una parte di ogni pagamento.",
    ctaApply: "Candidarsi con il suo account RepGet",
    ctaPortal: "Apri l'area partner",
    closed: "Le candidature non sono ancora aperte. Torni presto.",
    highlights: {
      recurring: "{rate} di ogni pagamento, per iniziare",
      months: "{months} mesi di commissione per cliente",
      payout: "Pagamento mensile da {amount}",
    },
    stepsTitle: "Come funziona",
    steps: [
      { title: "Si candidi con l'account che ha già", body: "Nessun nuovo accesso e nessun piano a pagamento. Esaminiamo ogni candidatura personalmente." },
      { title: "Condivida il suo link", body: "Riceve un link personale e, a volte, un coupon per il suo pubblico." },
      { title: "Guadagni su pagamenti reali", body: "La commissione si calcola su quanto i suoi referral pagano davvero - dopo gli sconti, senza imposte - e le viene versata in banca tramite Stripe." },
    ],
    tiersTitle: "La sua percentuale cresce con lei",
    tiersIntro: "I livelli contano gli account cliente paganti che ha segnalato. La percentuale più alta si applica ai pagamenti successivi al raggiungimento del livello.",
    tierFrom: "Da {count} clienti paganti",
    tierStart: "Percentuale iniziale",
    termsTitle: "Le regole, prima di condividere qualsiasi cosa",
    terms: [
      "La commissione si paga solo sui pagamenti di abbonamento incassati tramite Stripe. Sono esclusi imposte, rimborsi, chargeback e crediti.",
      "Ogni cliente segnalato le fa guadagnare commissioni per {months} mesi dal suo primo pagamento.",
      "Contano solo i nuovi account RepGet. Non contano mai gli account esistenti, i membri invitati sull'account di altri né i suoi account.",
      "Un link vale per {days} giorni da quando viene aperto. Conta il primo link partner aperto dal visitatore.",
      "Le commissioni attendono {maturity} giorni prima di poter essere pagate. I pagamenti avvengono il primo giorno di ogni mese quando il saldo raggiunge la soglia.",
      "I pagamenti passano da Stripe Connect. Lei configura il suo account di pagamento con Stripe; RepGet non vede mai i suoi dati bancari.",
      "Rimborsi e chargeback annullano la commissione maturata su di essi, anche dopo che è stata pagata.",
    ],
    creditTitle: "È già cliente?",
    creditBody: "I clienti possono anche segnalare altre aziende e ricevere crediti RepGet invece di denaro. Quel programma è separato e resta invariato.",
    creditLink: "Segnali un'azienda in cambio di crediti",
  },
  portal: {
    title: "Area partner",
    nav: { overview: "Panoramica", referrals: "Referral", commissions: "Commissioni", payouts: "Pagamenti", resources: "Risorse", settings: "Impostazioni", apply: "Candidatura", backToApp: "Torna a RepGet" },
    testMode: "Modalità test: non si muove denaro reale.",
    verify: {
      title: "Confermi prima il suo indirizzo email",
      body: "Il programma partner paga denaro reale, quindi dobbiamo sapere che questo indirizzo è suo. Le invieremo un codice di sei cifre.",
      send: "Invia il codice",
      sent: "Abbiamo inviato un codice a {email}.",
      code: "Codice di sei cifre",
      confirm: "Conferma",
      errors: { INVALID: "Il codice non è corretto.", EXPIRED: "Il codice è scaduto. Ne richieda uno nuovo.", TOO_MANY: "Troppi tentativi. Richieda un nuovo codice.", FAILED: "Non siamo riusciti a confermare il codice. Riprovi." },
    },
    apply: {
      title: "Candidarsi al programma partner",
      intro: "Ci dica dove consiglierà RepGet. Leggiamo ogni candidatura e rispondiamo via email.",
      website: "Sito o canale",
      websiteHint: "Dove condividerà RepGet: l'URL di un sito, una newsletter o un canale.",
      audience: "Il suo pubblico",
      audienceHint: "Chi la legge o la segue, quante persone circa e dove.",
      promotion: "Come promuoverà RepGet",
      promotionHint: "Ad esempio recensioni, tutorial, una newsletter o consigli ai clienti.",
      country: "Paese di pagamento",
      countryHint: "Il paese in cui riceverà i pagamenti. Stripe supporta i paesi elencati.",
      terms: "Accetto le regole del programma partner indicate nella pagina partner.",
      submit: "Invia candidatura",
      submitting: "Invio…",
      closed: "Le candidature sono chiuse al momento.",
      pendingTitle: "Stiamo esaminando la sua candidatura",
      pendingBody: "Le scriveremo a {email} quando l'avremo esaminata.",
      rejectedTitle: "La sua ultima candidatura non è stata approvata",
      rejectedBody: "Può candidarsi di nuovo con più dettagli sul suo pubblico.",
      errors: {
        invalid: "Controlli il modulo.",
        website: "Inserisca l'indirizzo completo del suo sito o canale, che inizi con https://.",
        audience: "Descriva il suo pubblico in una o due frasi.",
        promotion: "Descriva come promuoverà RepGet in una o due frasi.",
        country: "Scelga un paese di pagamento dall'elenco.",
        rate_limited: "Troppe candidature. Riprovi domani.",
        disabled: "Le candidature sono chiuse al momento.",
        already_processed: "Ha già inviato una candidatura.",
        generic: "Qualcosa è andato storto. Riprovi.",
      },
    },
    suspended: { title: "Il suo account partner è sospeso", body: "Lo storico resta disponibile. Nuove commissioni e pagamenti sono in pausa. Ci contatti se pensa che sia un errore." },
    hold: { title: "I pagamenti sono sospesi", body: "I suoi guadagni sono al sicuro; i pagamenti automatici sono in pausa mentre esaminiamo il suo account." },
    overview: {
      title: "Panoramica",
      linkTitle: "Il suo link partner",
      linkHint: "I visitatori che lo aprono e creano un nuovo account RepGet entro {days} giorni vengono attribuiti a lei.",
      copy: "Copia link",
      copied: "Copiato",
      tierTitle: "Il suo livello",
      progress: "{count} / {target} clienti paganti",
      remaining: "Ancora {count} clienti per raggiungere {tier} - {rate}",
      topTier: "È al livello più alto.",
      cards: { earned: "Totale guadagnato", pending: "In attesa", available: "Disponibile", transferred: "Trasferito", bankPaid: "Pagato in banca" },
      definitions: {
        earned: "Commissioni guadagnate, meno rimborsi e chargeback.",
        pending: "Non ancora pagabile: in attesa dei {maturity} giorni, trattenuta o in revisione.",
        available: "Pagabile con il prossimo pagamento mensile.",
        transferred: "Inviato al suo saldo Stripe.",
        bankPaid: "Confermato da Stripe come pagato sul suo conto bancario.",
      },
      noEarnings: "Nessuna commissione per ora. Condivida il suo link per iniziare.",
      noThreshold: "I pagamenti automatici non sono ancora disponibili in {currency}. Il saldo è conservato e mostrato qui.",
      threshold: "I pagamenti iniziano quando il saldo disponibile raggiunge {amount}.",
      metrics: { clicks: "Clic sul link", signups: "Nuovi account", customers: "Clienti paganti", conversion: "Da clic a pagamento", range: "Ultimi {days} giorni" },
      couponsTitle: "I suoi coupon",
      noCoupons: "Non le è stato assegnato alcun coupon.",
      couponDiscount: "{discount} per i nuovi clienti",
    },
    referrals: {
      title: "Referral",
      intro: "Account attribuiti a lei. I clienti sono indicati con il loro sito, mai con nome o email.",
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
      base: "Base",
      rate: "Percentuale",
      amount: "Commissione",
      status: "Stato",
      matures: "Pagabile dal",
      empty: "Nessuna commissione per ora.",
      statuses: { pending: "In attesa", available: "Disponibile", reserved: "In pagamento", paid: "Pagata", reversed: "Annullata", held: "Trattenuta", review: "In revisione" },
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
  },
};

const de: PartnerCopy = {
  page: {
    metaTitle: "Partnerprogramm: wiederkehrende Provision",
    metaDescription:
      "Werden Sie RepGet-Partner: Teilen Sie Ihren Link und erhalten Sie eine wiederkehrende Provision auf die Zahlungen Ihrer Empfehlungen, monatlich über Stripe.",
    eyebrow: "Partnerprogramm",
    title: "Erhalten Sie für jeden empfohlenen Kunden eine wiederkehrende Provision",
    intro:
      "Empfehlen Sie RepGet den Unternehmen und Agenturen, mit denen Sie arbeiten. Wenn eine von Ihnen empfohlene Person ein neues Konto eröffnet und ein Abonnement bezahlt, erhalten Sie einen Anteil an jeder Zahlung.",
    ctaApply: "Mit Ihrem RepGet-Konto bewerben",
    ctaPortal: "Partnerbereich öffnen",
    closed: "Bewerbungen sind noch nicht geöffnet. Schauen Sie bald wieder vorbei.",
    highlights: {
      recurring: "{rate} jeder Zahlung zum Start",
      months: "{months} Monate Provision pro Kunde",
      payout: "Monatliche Auszahlung ab {amount}",
    },
    stepsTitle: "So funktioniert es",
    steps: [
      { title: "Bewerben Sie sich mit Ihrem bestehenden Konto", body: "Kein neues Login und kein kostenpflichtiger Tarif nötig. Wir prüfen jede Bewerbung persönlich." },
      { title: "Teilen Sie Ihren Link", body: "Sie erhalten einen persönlichen Link und manchmal einen Gutschein für Ihr Publikum." },
      { title: "Verdienen Sie an echten Zahlungen", body: "Die Provision wird auf das berechnet, was Ihre Empfehlungen tatsächlich zahlen - nach Rabatten, ohne Steuern - und über Stripe auf Ihr Bankkonto ausgezahlt." },
    ],
    tiersTitle: "Ihr Satz wächst mit Ihnen",
    tiersIntro: "Die Stufen zählen die zahlenden Kundenkonten, die Sie empfohlen haben. Der höhere Satz gilt für Zahlungen nach Erreichen der Stufe.",
    tierFrom: "Ab {count} zahlenden Kunden",
    tierStart: "Startsatz",
    termsTitle: "Die Regeln, bevor Sie etwas teilen",
    terms: [
      "Provision gibt es nur auf Abonnementzahlungen, die über Stripe eingezogen wurden. Steuern, Erstattungen, Rückbuchungen und Guthaben sind ausgenommen.",
      "Jeder empfohlene Kunde bringt Ihnen {months} Monate ab seiner ersten Zahlung Provision.",
      "Es zählen nur neue RepGet-Konten. Bestehende Konten, zum Konto eines anderen eingeladene Teammitglieder und Ihre eigenen Konten zählen nie.",
      "Ein Link zählt {days} Tage nach dem Öffnen. Es zählt der erste Partnerlink, den ein Besucher öffnet.",
      "Provisionen warten {maturity} Tage, bevor sie ausgezahlt werden können. Auszahlungen erfolgen am ersten Tag jedes Monats, sobald Ihr Guthaben den Mindestbetrag erreicht.",
      "Auszahlungen laufen über Stripe Connect. Sie richten Ihr Auszahlungskonto bei Stripe ein; RepGet sieht Ihre Bankdaten nie.",
      "Erstattungen und Rückbuchungen heben die darauf verdiente Provision auf, auch nach der Auszahlung.",
    ],
    creditTitle: "Schon Kunde?",
    creditBody: "Kunden können auch andere Unternehmen empfehlen und erhalten dafür RepGet-Guthaben statt Geld. Dieses Programm ist getrennt und bleibt unverändert.",
    creditLink: "Unternehmen gegen Guthaben empfehlen",
  },
  portal: {
    title: "Partnerbereich",
    nav: { overview: "Übersicht", referrals: "Empfehlungen", commissions: "Provisionen", payouts: "Auszahlungen", resources: "Material", settings: "Einstellungen", apply: "Bewerben", backToApp: "Zurück zu RepGet" },
    testMode: "Testmodus: Es fließt kein echtes Geld.",
    verify: {
      title: "Bestätigen Sie zuerst Ihre E-Mail-Adresse",
      body: "Das Partnerprogramm zahlt echtes Geld, daher müssen wir wissen, dass diese Adresse Ihnen gehört. Wir senden Ihnen einen sechsstelligen Code.",
      send: "Code senden",
      sent: "Wir haben einen Code an {email} gesendet.",
      code: "Sechsstelliger Code",
      confirm: "Bestätigen",
      errors: { INVALID: "Dieser Code ist nicht richtig.", EXPIRED: "Der Code ist abgelaufen. Fordern Sie einen neuen an.", TOO_MANY: "Zu viele Versuche. Fordern Sie einen neuen Code an.", FAILED: "Wir konnten den Code nicht bestätigen. Versuchen Sie es erneut." },
    },
    apply: {
      title: "Für das Partnerprogramm bewerben",
      intro: "Sagen Sie uns, wo Sie RepGet empfehlen werden. Wir lesen jede Bewerbung und antworten per E-Mail.",
      website: "Website oder Kanal",
      websiteHint: "Wo Sie RepGet teilen werden: die URL einer Website, eines Newsletters oder Kanals.",
      audience: "Ihr Publikum",
      audienceHint: "Wer Sie liest oder Ihnen folgt, ungefähr wie viele und wo.",
      promotion: "Wie Sie RepGet bewerben werden",
      promotionHint: "Zum Beispiel Testberichte, Anleitungen, ein Newsletter oder Empfehlungen an Kunden.",
      country: "Auszahlungsland",
      countryHint: "Das Land, in dem Ihre Auszahlungen erfolgen. Stripe unterstützt die aufgeführten Länder.",
      terms: "Ich akzeptiere die Regeln des Partnerprogramms auf der Partnerseite.",
      submit: "Bewerbung senden",
      submitting: "Wird gesendet…",
      closed: "Bewerbungen sind derzeit geschlossen.",
      pendingTitle: "Ihre Bewerbung wird geprüft",
      pendingBody: "Wir schreiben Ihnen an {email}, sobald sie geprüft wurde.",
      rejectedTitle: "Ihre letzte Bewerbung wurde nicht angenommen",
      rejectedBody: "Sie können sich mit mehr Details zu Ihrem Publikum erneut bewerben.",
      errors: {
        invalid: "Bitte prüfen Sie das Formular.",
        website: "Geben Sie die vollständige Adresse Ihrer Website oder Ihres Kanals an, beginnend mit https://.",
        audience: "Beschreiben Sie Ihr Publikum in ein oder zwei Sätzen.",
        promotion: "Beschreiben Sie in ein oder zwei Sätzen, wie Sie RepGet bewerben werden.",
        country: "Wählen Sie ein Auszahlungsland aus der Liste.",
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
      copy: "Link kopieren",
      copied: "Kopiert",
      tierTitle: "Ihre Stufe",
      progress: "{count} / {target} zahlende Kunden",
      remaining: "Noch {count} Kunden bis {tier} - {rate}",
      topTier: "Sie sind auf der höchsten Stufe.",
      cards: { earned: "Insgesamt verdient", pending: "Ausstehend", available: "Verfügbar", transferred: "Überwiesen", bankPaid: "An Ihre Bank gezahlt" },
      definitions: {
        earned: "Verdiente Provision abzüglich Erstattungen und Rückbuchungen.",
        pending: "Noch nicht auszahlbar: Wartezeit von {maturity} Tagen, angehalten oder in Prüfung.",
        available: "Wird mit der nächsten monatlichen Auszahlung gezahlt.",
        transferred: "An Ihr Stripe-Guthaben gesendet.",
        bankPaid: "Von Stripe als an Ihre Bank gezahlt bestätigt.",
      },
      noEarnings: "Noch keine Provision. Teilen Sie Ihren Link, um zu beginnen.",
      noThreshold: "Automatische Auszahlungen sind für {currency} noch nicht verfügbar. Ihr Guthaben bleibt erhalten und wird hier angezeigt.",
      threshold: "Auszahlungen beginnen, sobald Ihr verfügbares Guthaben {amount} erreicht.",
      metrics: { clicks: "Link-Klicks", signups: "Neue Konten", customers: "Zahlende Kunden", conversion: "Vom Klick zur Zahlung", range: "Letzte {days} Tage" },
      couponsTitle: "Ihre Gutscheine",
      noCoupons: "Ihnen wurde kein Gutschein zugewiesen.",
      couponDiscount: "{discount} für Neukunden",
    },
    referrals: {
      title: "Empfehlungen",
      intro: "Ihnen zugeordnete Konten. Kunden werden über ihre Website angezeigt, nie mit Name oder E-Mail.",
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
      base: "Basis",
      rate: "Satz",
      amount: "Provision",
      status: "Status",
      matures: "Auszahlbar ab",
      empty: "Noch keine Provisionen.",
      statuses: { pending: "Ausstehend", available: "Verfügbar", reserved: "In Auszahlung", paid: "Gezahlt", reversed: "Storniert", held: "Angehalten", review: "In Prüfung" },
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
