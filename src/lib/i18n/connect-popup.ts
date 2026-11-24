import type { Locale } from "@/lib/i18n/config";

/**
 * The popup on an article when its website is not connected (client,
 * 2026-11-24: "a popup once access the article that for auto posting - they
 * need to integrate the website connection"). Formal address; {domain} is the
 * website.
 */
export type ConnectPopupCopy = { title: string; body: string; how: string; connect: string; later: string };

export const CONNECT_POPUP_COPY: Record<Locale, ConnectPopupCopy> = {
  en: {
    title: "Connect your website to post automatically",
    body: "{domain} is not connected to RepGet yet, so this article cannot be posted to it automatically.",
    how: "Connect WordPress, Shopify, Webflow or another system in a few minutes. Until then you can read, edit and copy the article here.",
    connect: "Connect my website",
    later: "Not now",
  },
  es: {
    title: "Conecte su sitio web para publicar automáticamente",
    body: "{domain} todavía no está conectado a RepGet, así que este artículo no puede publicarse en él automáticamente.",
    how: "Conecte WordPress, Shopify, Webflow u otro sistema en pocos minutos. Mientras tanto, puede leer, editar y copiar el artículo aquí.",
    connect: "Conectar mi sitio web",
    later: "Ahora no",
  },
  fr: {
    title: "Connectez votre site pour publier automatiquement",
    body: "{domain} n’est pas encore connecté à RepGet : cet article ne peut donc pas y être publié automatiquement.",
    how: "Connectez WordPress, Shopify, Webflow ou un autre système en quelques minutes. En attendant, vous pouvez lire, modifier et copier l’article ici.",
    connect: "Connecter mon site",
    later: "Pas maintenant",
  },
  it: {
    title: "Colleghi il Suo sito per pubblicare automaticamente",
    body: "{domain} non è ancora collegato a RepGet, quindi questo articolo non può essere pubblicato automaticamente sul sito.",
    how: "Colleghi WordPress, Shopify, Webflow o un altro sistema in pochi minuti. Nel frattempo può leggere, modificare e copiare l’articolo qui.",
    connect: "Collega il mio sito",
    later: "Non ora",
  },
  de: {
    title: "Verbinden Sie Ihre Website, um automatisch zu veröffentlichen",
    body: "{domain} ist noch nicht mit RepGet verbunden. Dieser Artikel kann dort daher nicht automatisch veröffentlicht werden.",
    how: "Verbinden Sie WordPress, Shopify, Webflow oder ein anderes System in wenigen Minuten. Bis dahin können Sie den Artikel hier lesen, bearbeiten und kopieren.",
    connect: "Meine Website verbinden",
    later: "Nicht jetzt",
  },
};
