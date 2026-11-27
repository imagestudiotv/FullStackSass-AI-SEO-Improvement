import type { Locale } from "@/lib/i18n/config";

/** The page a free tool shows while it is switched off in Admin -> Free tools. */
export type ToolUnavailableCopy = { title: string; body: string; link: string };

export const TOOL_UNAVAILABLE: Record<Locale, ToolUnavailableCopy> = {
  en: {
    title: "This free tool is temporarily unavailable",
    body: "We have paused it for a little while. Please come back later, or try one of our other free tools in the meantime.",
    link: "Explore free tools",
  },
  es: {
    title: "Esta herramienta gratuita no está disponible temporalmente",
    body: "La hemos pausado durante un tiempo. Vuelva más tarde o, mientras tanto, pruebe otra de nuestras herramientas gratuitas.",
    link: "Explorar herramientas gratis",
  },
  fr: {
    title: "Cet outil gratuit est temporairement indisponible",
    body: "Nous l'avons mis en pause pour un moment. Revenez plus tard ou, en attendant, essayez un autre de nos outils gratuits.",
    link: "Découvrir les outils gratuits",
  },
  it: {
    title: "Questo strumento gratuito non è temporaneamente disponibile",
    body: "L'abbiamo messo in pausa per un po'. Torni più tardi o, nel frattempo, provi un altro dei nostri strumenti gratuiti.",
    link: "Scopri gli strumenti gratuiti",
  },
  de: {
    title: "Dieses kostenlose Tool ist vorübergehend nicht verfügbar",
    body: "Wir haben es für eine Weile pausiert. Schauen Sie später wieder vorbei oder probieren Sie in der Zwischenzeit eines unserer anderen kostenlosen Tools.",
    link: "Kostenlose Tools entdecken",
  },
};
