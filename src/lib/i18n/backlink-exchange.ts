import type { Locale } from "@/lib/i18n/config";

/**
 * The Backlink Exchange switch on the Partner Network card (owner,
 * 2026-11-27): automatic partner links, opt-in and off by default
 * (lib/backlinks/exchange-switch.ts), with a short, honest note on the risk.
 * Five languages, in the register of the card's own words
 * (messages.ts app.partnerNetwork).
 */
export type BacklinkExchangeCopy = {
  title: string;
  help: string;
  /** Why it is off by default: Google's view of link exchanges. */
  risk: string;
  whenOn: string;
  whenOff: string;
  /** Said while the website does not take part in the network. */
  needsParticipation: string;
  turnedOn: string;
  turnedOff: string;
};

export const BACKLINK_EXCHANGE_COPY: Record<Locale, BacklinkExchangeCopy> = {
  en: {
    title: "Backlink Exchange",
    help: "Automatic partner links in your articles. Off unless you switch it on.",
    risk: "Google treats excessive link exchanges as spam and can rank sites lower for them. RepGet keeps these links few, relevant and never reciprocal, but the choice is yours.",
    whenOn: "On: partner links may be added to your articles automatically before they are published.",
    whenOff: "Off: no partner links are added to your articles automatically. The RepGet team can still arrange individual links through the Partner Network.",
    needsParticipation: "Turn on Network participation to use the Backlink Exchange.",
    turnedOn: "Backlink Exchange switched on",
    turnedOff: "Backlink Exchange switched off",
  },
  es: {
    title: "Intercambio de backlinks",
    help: "Enlaces automáticos de socios en tus artículos. Desactivado salvo que lo actives.",
    risk: "Google considera spam los intercambios de enlaces excesivos y puede bajar la posición de los sitios que los usan. RepGet mantiene estos enlaces pocos, relevantes y nunca recíprocos, pero tú decides.",
    whenOn: "Activado: se pueden añadir enlaces de socios a tus artículos automáticamente antes de publicarlos.",
    whenOff: "Desactivado: no se añaden enlaces de socios a tus artículos automáticamente. El equipo de RepGet puede seguir organizando enlaces concretos a través de la Red de socios.",
    needsParticipation: "Activa la participación en la red para usar el intercambio de backlinks.",
    turnedOn: "Intercambio de backlinks activado",
    turnedOff: "Intercambio de backlinks desactivado",
  },
  fr: {
    title: "Échange de backlinks",
    help: "Des liens de partenaires ajoutés automatiquement à vos articles. Désactivé tant que vous ne l’activez pas.",
    risk: "Google considère les échanges de liens excessifs comme du spam et peut moins bien classer les sites qui y ont recours. RepGet garde ces liens rares, pertinents et jamais réciproques, mais le choix vous appartient.",
    whenOn: "Activé : des liens de partenaires peuvent être ajoutés automatiquement à vos articles avant leur publication.",
    whenOff: "Désactivé : aucun lien de partenaire n’est ajouté automatiquement à vos articles. L’équipe RepGet peut toujours organiser des liens ponctuels via le Réseau partenaire.",
    needsParticipation: "Activez la participation au réseau pour utiliser l’échange de backlinks.",
    turnedOn: "Échange de backlinks activé",
    turnedOff: "Échange de backlinks désactivé",
  },
  it: {
    title: "Scambio di backlink",
    help: "Link automatici dei partner nei tuoi articoli. Disattivato finché non lo attivi.",
    risk: "Google considera spam gli scambi di link eccessivi e può posizionare peggio i siti che li usano. RepGet mantiene questi link pochi, pertinenti e mai reciproci, ma la scelta è tua.",
    whenOn: "Attivo: i link dei partner possono essere aggiunti automaticamente ai tuoi articoli prima della pubblicazione.",
    whenOff: "Disattivo: nessun link dei partner viene aggiunto automaticamente ai tuoi articoli. Il team RepGet può comunque organizzare singoli link tramite la Rete partner.",
    needsParticipation: "Attiva la partecipazione alla rete per usare lo scambio di backlink.",
    turnedOn: "Scambio di backlink attivato",
    turnedOff: "Scambio di backlink disattivato",
  },
  de: {
    title: "Backlink-Austausch",
    help: "Automatische Partnerlinks in Ihren Artikeln. Aus, bis Sie ihn einschalten.",
    risk: "Google wertet übermäßigen Linktausch als Spam und kann Websites dafür schlechter einstufen. RepGet hält diese Links wenige, relevant und nie gegenseitig, aber die Entscheidung liegt bei Ihnen.",
    whenOn: "An: Partnerlinks können automatisch in Ihre Artikel gesetzt werden, bevor diese veröffentlicht werden.",
    whenOff: "Aus: Es werden keine Partnerlinks automatisch in Ihre Artikel gesetzt. Das RepGet-Team kann weiterhin einzelne Links über das Partnernetzwerk arrangieren.",
    needsParticipation: "Schalten Sie die Netzwerkteilnahme ein, um den Backlink-Austausch zu nutzen.",
    turnedOn: "Backlink-Austausch eingeschaltet",
    turnedOff: "Backlink-Austausch ausgeschaltet",
  },
};
