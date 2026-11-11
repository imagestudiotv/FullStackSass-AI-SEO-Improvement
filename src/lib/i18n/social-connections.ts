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
    sub: "Connect your channels to discover opportunities and manage your activity.",
    counter: "{count} of {total} connected",
    connected: "Connected",
    notConnected: "Not connected",
    linked: "Account linked",
    ready: "Ready to connect",
    confirmTitle: "Disconnect {platform}?",
    confirmBody: "RepGet will stop using this account for new opportunities. You can reconnect it at any time.",
    cancel: "Cancel",
    confirmAction: "Disconnect account",
    hint: "Disconnecting stops future activity on that channel.",
    toastConnected: "{platform} connected",
    toastDisconnected: "{platform} disconnected",
    usernameTitle: "Connect {platform}",
    settings: "Account settings",
    settingsIntro: "Automatic posting, warm-up and the Pinterest board of your connected accounts.",
  },
  es: {
    eyebrow: "Oportunidades",
    title: "Conexiones sociales",
    sub: "Conecte sus canales para descubrir oportunidades y gestionar su actividad.",
    counter: "{count} de {total} conectados",
    connected: "Conectado",
    notConnected: "No conectado",
    linked: "Cuenta vinculada",
    ready: "Listo para conectar",
    confirmTitle: "¿Desconectar {platform}?",
    confirmBody: "RepGet dejará de usar esta cuenta para nuevas oportunidades. Puede volver a conectarla en cualquier momento.",
    cancel: "Cancelar",
    confirmAction: "Desconectar cuenta",
    hint: "Al desconectar, se detiene la actividad futura en ese canal.",
    toastConnected: "{platform} conectado",
    toastDisconnected: "{platform} desconectado",
    usernameTitle: "Conectar {platform}",
    settings: "Ajustes de las cuentas",
    settingsIntro: "Publicación automática, calentamiento y tablero de Pinterest de sus cuentas conectadas.",
  },
  fr: {
    eyebrow: "Opportunités",
    title: "Connexions sociales",
    sub: "Connectez vos canaux pour découvrir des opportunités et gérer votre activité.",
    counter: "{count} sur {total} connectés",
    connected: "Connecté",
    notConnected: "Non connecté",
    linked: "Compte associé",
    ready: "Prêt à être connecté",
    confirmTitle: "Déconnecter {platform} ?",
    confirmBody: "RepGet cessera d’utiliser ce compte pour de nouvelles opportunités. Vous pouvez le reconnecter à tout moment.",
    cancel: "Annuler",
    confirmAction: "Déconnecter le compte",
    hint: "La déconnexion arrête toute activité future sur ce canal.",
    toastConnected: "{platform} connecté",
    toastDisconnected: "{platform} déconnecté",
    usernameTitle: "Connecter {platform}",
    settings: "Paramètres des comptes",
    settingsIntro: "Publication automatique, mise en route et tableau Pinterest de vos comptes connectés.",
  },
  it: {
    eyebrow: "Opportunità",
    title: "Connessioni social",
    sub: "Colleghi i suoi canali per scoprire opportunità e gestire la sua attività.",
    counter: "{count} di {total} collegati",
    connected: "Collegato",
    notConnected: "Non collegato",
    linked: "Account collegato",
    ready: "Pronto da collegare",
    confirmTitle: "Scollegare {platform}?",
    confirmBody: "RepGet smetterà di usare questo account per nuove opportunità. Può ricollegarlo in qualsiasi momento.",
    cancel: "Annulla",
    confirmAction: "Scollega account",
    hint: "Scollegando un canale, l’attività futura su di esso si interrompe.",
    toastConnected: "{platform} collegato",
    toastDisconnected: "{platform} scollegato",
    usernameTitle: "Collega {platform}",
    settings: "Impostazioni account",
    settingsIntro: "Pubblicazione automatica, riscaldamento e bacheca Pinterest dei suoi account collegati.",
  },
  de: {
    eyebrow: "Chancen",
    title: "Social-Media-Verbindungen",
    sub: "Verbinden Sie Ihre Kanäle, um Chancen zu entdecken und Ihre Aktivitäten zu verwalten.",
    counter: "{count} von {total} verbunden",
    connected: "Verbunden",
    notConnected: "Nicht verbunden",
    linked: "Konto verknüpft",
    ready: "Bereit zum Verbinden",
    confirmTitle: "{platform} trennen?",
    confirmBody: "RepGet verwendet dieses Konto nicht mehr für neue Chancen. Sie können es jederzeit wieder verbinden.",
    cancel: "Abbrechen",
    confirmAction: "Konto trennen",
    hint: "Durch das Trennen wird jede weitere Aktivität auf diesem Kanal beendet.",
    toastConnected: "{platform} verbunden",
    toastDisconnected: "{platform} getrennt",
    usernameTitle: "{platform} verbinden",
    settings: "Kontoeinstellungen",
    settingsIntro: "Automatisches Veröffentlichen, Aufwärmphase und Pinterest-Pinnwand Ihrer verbundenen Konten.",
  },
};
