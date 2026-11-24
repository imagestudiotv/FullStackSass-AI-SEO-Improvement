import type { Locale } from "@/lib/i18n/config";

/**
 * The Partner Network card while the website is not connected to RepGet
 * (Daniel, 2026-11-24). The rest of the card's words are in messages.ts
 * (app.partnerNetwork). Five languages, formal address.
 *
 * Step 2 says what is true: RepGet has no separate ownership check. Setting
 * the connection up needs access to the website, and that is the proof.
 */
export type PartnerNetworkConnectCopy = {
  notConnected: string;
  howItWorks: string;
  stepLabel: string;
  title: string;
  body: string;
  connect: string;
  /** The three steps, as a list. */
  stepsLabel: string;
  stepConnect: string;
  stepVerify: string;
  stepVerifyNote: string;
  stepJoin: string;
  /** Beside the toggle, in place of Enabled / Disabled. */
  notAvailable: string;
  unlockParticipation: string;
  unlockMinimum: string;
  unlockTargets: string;
  /** For a viewer, who cannot connect it. */
  askEditor: string;
};

export const PARTNER_NETWORK_CONNECT: Record<Locale, PartnerNetworkConnectCopy> = {
  en: {
    notConnected: "Not connected",
    howItWorks: "How it works",
    stepLabel: "Step 1 · Get started",
    title: "Connect your website to join the Partner Network",
    body: "Connect it in Integrations. Taking part, receiving backlinks and earning credits for hosted links start after that.",
    connect: "Connect website",
    stepsLabel: "Joining the Partner Network",
    stepConnect: "Connect website",
    stepVerify: "Verify ownership",
    stepVerifyNote: "automatic with the connection",
    stepJoin: "Join network",
    notAvailable: "Not available yet",
    unlockParticipation: "Connect your website to unlock participation.",
    unlockMinimum: "Connect your website to set a minimum.",
    unlockTargets: "Connect your website to add target pages.",
    askEditor: "Ask the website's owner to connect it.",
  },
  es: {
    notConnected: "Sin conectar",
    howItWorks: "Cómo funciona",
    stepLabel: "Paso 1 · Para empezar",
    title: "Conecte su sitio web para unirse a la red de socios",
    body: "Conéctelo en Integraciones. Participar, recibir backlinks y ganar créditos por los enlaces alojados empieza después.",
    connect: "Conectar sitio web",
    stepsLabel: "Unirse a la red de socios",
    stepConnect: "Conectar sitio web",
    stepVerify: "Verificar la propiedad",
    stepVerifyNote: "automático con la conexión",
    stepJoin: "Unirse a la red",
    notAvailable: "Aún no disponible",
    unlockParticipation: "Conecte su sitio web para activar la participación.",
    unlockMinimum: "Conecte su sitio web para fijar un mínimo.",
    unlockTargets: "Conecte su sitio web para añadir páginas de destino.",
    askEditor: "Pida al propietario del sitio web que lo conecte.",
  },
  fr: {
    notConnected: "Non connecté",
    howItWorks: "Comment ça marche",
    stepLabel: "Étape 1 · Pour commencer",
    title: "Connectez votre site pour rejoindre le réseau de partenaires",
    body: "Connectez-le dans Intégrations. Participer, recevoir des backlinks et gagner des crédits pour les liens hébergés commence ensuite.",
    connect: "Connecter le site",
    stepsLabel: "Rejoindre le réseau de partenaires",
    stepConnect: "Connecter le site",
    stepVerify: "Vérifier la propriété",
    stepVerifyNote: "automatique avec la connexion",
    stepJoin: "Rejoindre le réseau",
    notAvailable: "Pas encore disponible",
    unlockParticipation: "Connectez votre site pour activer la participation.",
    unlockMinimum: "Connectez votre site pour fixer un minimum.",
    unlockTargets: "Connectez votre site pour ajouter des pages cibles.",
    askEditor: "Demandez au propriétaire du site de le connecter.",
  },
  it: {
    notConnected: "Non collegato",
    howItWorks: "Come funziona",
    stepLabel: "Passo 1 · Per iniziare",
    title: "Colleghi il Suo sito web per entrare nella rete di partner",
    body: "Lo colleghi in Integrazioni. Partecipare, ricevere backlink e guadagnare crediti per i link ospitati inizia dopo.",
    connect: "Collega il sito web",
    stepsLabel: "Entrare nella rete di partner",
    stepConnect: "Collega il sito web",
    stepVerify: "Verifica della proprietà",
    stepVerifyNote: "automatica con il collegamento",
    stepJoin: "Entra nella rete",
    notAvailable: "Non ancora disponibile",
    unlockParticipation: "Colleghi il Suo sito web per attivare la partecipazione.",
    unlockMinimum: "Colleghi il Suo sito web per impostare un minimo.",
    unlockTargets: "Colleghi il Suo sito web per aggiungere pagine di destinazione.",
    askEditor: "Chieda al proprietario del sito web di collegarlo.",
  },
  de: {
    notConnected: "Nicht verbunden",
    howItWorks: "So funktioniert es",
    stepLabel: "Schritt 1 · Erste Schritte",
    title: "Verbinden Sie Ihre Website, um dem Partnernetzwerk beizutreten",
    body: "Verbinden Sie sie unter Integrationen. Teilnehmen, Backlinks erhalten und Credits für gehostete Links verdienen beginnt danach.",
    connect: "Website verbinden",
    stepsLabel: "Dem Partnernetzwerk beitreten",
    stepConnect: "Website verbinden",
    stepVerify: "Inhaberschaft bestätigen",
    stepVerifyNote: "automatisch mit der Verbindung",
    stepJoin: "Netzwerk beitreten",
    notAvailable: "Noch nicht verfügbar",
    unlockParticipation: "Verbinden Sie Ihre Website, um die Teilnahme freizuschalten.",
    unlockMinimum: "Verbinden Sie Ihre Website, um ein Minimum festzulegen.",
    unlockTargets: "Verbinden Sie Ihre Website, um Zielseiten hinzuzufügen.",
    askEditor: "Bitten Sie den Inhaber der Website, sie zu verbinden.",
  },
};
