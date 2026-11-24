import type { Locale } from "@/lib/i18n/config";

/**
 * The Opportunities page's "Social connections" panel (client's design,
 * repget_social_connections_preview.html, 2026-11-11). Five languages,
 * formal address, like the rest of the app. The words the panel shares with
 * the rest of the page (Connect, Disconnect, the username field, the trial
 * lock) stay in messages.ts (app.social); {placeholders} are filled with
 * format().
 */
export type SocialConnectionsCopy = {
  eyebrow: string;
  title: string;
  sub: string;
  /** {count} connected of {total} platforms. */
  counter: string;
  connected: string;
  notConnected: string;
  linked: string;
  ready: string;
  /** The disconnect confirmation: {platform}. */
  confirmTitle: string;
  confirmBody: string;
  cancel: string;
  confirmAction: string;
  hint: string;
  /** Toasts after a real connect or disconnect: {platform}. */
  toastConnected: string;
  toastDisconnected: string;
  /** The username dialog (Quora; every platform while bundle.social is not set up): {platform}. */
  usernameTitle: string;
  /** The footer button to the connected accounts' own settings (automatic posting, Pinterest board). */
  settings: string;
  settingsIntro: string;
};

export const SOCIAL_CONNECTIONS_COPY: Record<Locale, SocialConnectionsCopy> = {
  en: {
    eyebrow: "Opportunities",
    title: "Social connections",
    sub: "Suggestions work without an account. Connect a channel and RepGet can publish your own posts there.",
    counter: "{count} of {total} connected",
    connected: "Connected",
    notConnected: "Not connected",
    linked: "Account linked",
    ready: "Ready to connect",
    confirmTitle: "Disconnect {platform}?",
    confirmBody: "RepGet will stop publishing to this account. Suggestions you post yourself go on, and you can reconnect it at any time.",
    cancel: "Cancel",
    confirmAction: "Disconnect account",
    hint: "Disconnecting stops automatic publishing on that channel.",
    toastConnected: "{platform} connected",
    toastDisconnected: "{platform} disconnected",
    usernameTitle: "Connect {platform}",
    settings: "Account settings",
    settingsIntro: "Automatic posting, warm-up and the Pinterest board of your connected accounts.",
  },
  es: {
    eyebrow: "Oportunidades",
    title: "Conexiones sociales",
    sub: "Las sugerencias funcionan sin cuenta. Si conecta un canal, RepGet puede publicar allí sus propias publicaciones.",
    counter: "{count} de {total} conectados",
    connected: "Conectado",
    notConnected: "No conectado",
    linked: "Cuenta vinculada",
    ready: "Listo para conectar",
    confirmTitle: "¿Desconectar {platform}?",
    confirmBody: "RepGet dejará de publicar en esta cuenta. Seguirá recibiendo sugerencias para publicar usted, y puede volver a conectarla en cualquier momento.",
    cancel: "Cancelar",
    confirmAction: "Desconectar cuenta",
    hint: "Al desconectar, se detiene la publicación automática en ese canal.",
    toastConnected: "{platform} conectado",
    toastDisconnected: "{platform} desconectado",
    usernameTitle: "Conectar {platform}",
    settings: "Ajustes de las cuentas",
    settingsIntro: "Publicación automática, calentamiento y tablero de Pinterest de sus cuentas conectadas.",
  },
  fr: {
    eyebrow: "Opportunités",
    title: "Connexions sociales",
    sub: "Les suggestions fonctionnent sans compte. Connectez un canal et RepGet peut y publier vos propres publications.",
    counter: "{count} sur {total} connectés",
    connected: "Connecté",
    notConnected: "Non connecté",
    linked: "Compte associé",
    ready: "Prêt à être connecté",
    confirmTitle: "Déconnecter {platform} ?",
    confirmBody: "RepGet ne publiera plus sur ce compte. Les suggestions à publier vous-même continuent, et vous pouvez le reconnecter à tout moment.",
    cancel: "Annuler",
    confirmAction: "Déconnecter le compte",
    hint: "La déconnexion arrête la publication automatique sur ce canal.",
    toastConnected: "{platform} connecté",
    toastDisconnected: "{platform} déconnecté",
    usernameTitle: "Connecter {platform}",
    settings: "Paramètres des comptes",
    settingsIntro: "Publication automatique, mise en route et tableau Pinterest de vos comptes connectés.",
  },
  it: {
    eyebrow: "Opportunità",
    title: "Connessioni social",
    sub: "I suggerimenti funzionano senza account. Colleghi un canale e RepGet può pubblicarvi i suoi post.",
    counter: "{count} di {total} collegati",
    connected: "Collegato",
    notConnected: "Non collegato",
    linked: "Account collegato",
    ready: "Pronto da collegare",
    confirmTitle: "Scollegare {platform}?",
    confirmBody: "RepGet non pubblicherà più su questo account. I suggerimenti da pubblicare a mano continuano e può ricollegarlo in qualsiasi momento.",
    cancel: "Annulla",
    confirmAction: "Scollega account",
    hint: "Scollegando un canale si interrompe la pubblicazione automatica su di esso.",
    toastConnected: "{platform} collegato",
    toastDisconnected: "{platform} scollegato",
    usernameTitle: "Collega {platform}",
    settings: "Impostazioni account",
    settingsIntro: "Pubblicazione automatica, riscaldamento e bacheca Pinterest dei suoi account collegati.",
  },
  de: {
    eyebrow: "Chancen",
    title: "Social-Media-Verbindungen",
    sub: "Vorschläge gibt es auch ohne Konto. Verbinden Sie einen Kanal, kann RepGet dort Ihre eigenen Beiträge veröffentlichen.",
    counter: "{count} von {total} verbunden",
    connected: "Verbunden",
    notConnected: "Nicht verbunden",
    linked: "Konto verknüpft",
    ready: "Bereit zum Verbinden",
    confirmTitle: "{platform} trennen?",
    confirmBody: "RepGet veröffentlicht nicht mehr über dieses Konto. Vorschläge zum Selbstveröffentlichen kommen weiterhin, und Sie können es jederzeit wieder verbinden.",
    cancel: "Abbrechen",
    confirmAction: "Konto trennen",
    hint: "Durch das Trennen endet die automatische Veröffentlichung auf diesem Kanal.",
    toastConnected: "{platform} verbunden",
    toastDisconnected: "{platform} getrennt",
    usernameTitle: "{platform} verbinden",
    settings: "Kontoeinstellungen",
    settingsIntro: "Automatisches Veröffentlichen, Aufwärmphase und Pinterest-Pinnwand Ihrer verbundenen Konten.",
  },
};
