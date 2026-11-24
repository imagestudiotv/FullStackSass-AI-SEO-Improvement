import type { Locale } from "@/lib/i18n/config";

/**
 * Keeping the Social Content page tidy (Daniel, 2026-11-24): deleting videos,
 * a YouTube Short's tags, and the neutral words where a failure used to be.
 * Five languages, formal address, like lib/i18n/videos-flow.ts, whose
 * FlowCopy carries these as `library`. {placeholders} are filled with
 * format(); "one|many" strings with plural().
 */
export type LibraryCopy = {
  remove: {
    /** The card's button; its label for screen readers is "Delete {title}". */
    button: string;
    buttonFor: string;
    /** The list's toolbar. */
    select: string;
    selectAll: string;
    done: string;
    /** "{count} selected" */
    selected: string;
    selectFor: string;
    /** "Delete this video?|Delete {count} videos?" */
    title: string;
    body: string;
    /** Shown for what the selection holds. */
    making: string;
    made: string;
    scheduled: string;
    posted: string;
    posting: string;
    confirm: string;
    working: string;
    cancel: string;
    /** "Video deleted.|{count} videos deleted." */
    deleted: string;
    /** "One is being published right now and stayed.|{count} are being published..." */
    stayed: string;
  };
  returned: {
    title: string;
    /** "... {tab}" is the Today's ideas tab. */
    body: string;
    open: string;
  };
  auto: { unavailable: string };
  actions: {
    label: string;
    slides: string;
  };
  tags: {
    label: string;
    placeholder: string;
    hint: string;
    copy: string;
    suggested: string;
    saved: string;
    tooLong: string;
  };
};

const en: LibraryCopy = {
  remove: {
    button: "Delete",
    buttonFor: "Delete {title}",
    select: "Select",
    selectAll: "Select all",
    done: "Done",
    selected: "{count} selected",
    selectFor: "Select {title}",
    title: "Delete this video?|Delete {count} videos?",
    body: "The video and its files are removed from RepGet. This cannot be undone.",
    making: "A video still waiting to be made gives its credit back. Once making has started, it stops and the credit is not returned.",
    made: "Credits used to make a video are not returned.",
    scheduled: "Its scheduled publishing is cancelled.",
    posted: "What is already posted stays on the platforms. Deleting removes it from RepGet only.",
    posting: "A video being published right now cannot be deleted until that has finished.",
    confirm: "Delete",
    working: "Deleting…",
    cancel: "Keep",
    deleted: "Video deleted.|{count} videos deleted.",
    stayed: "One is being published right now and stayed.|{count} are being published right now and stayed.",
  },
  returned: {
    title: "This idea is back in {tab}.",
    body: "Your credit was returned. You can approve it again or choose another idea.",
    open: "Go to {tab}",
  },
  auto: { unavailable: "Automatic publishing is not available for this video right now." },
  actions: { label: "Publish this video", slides: "Download slides" },
  tags: {
    label: "Tags",
    placeholder: "small business, marketing tips, seo",
    hint: "Separate the tags with commas. Paste them into YouTube's Tags field when you upload the Short.",
    copy: "Copy tags",
    suggested: "Suggested from the post's hashtags.",
    saved: "Tags saved.",
    tooLong: "YouTube takes 500 characters. The tags that do not fit are left out.",
  },
};

const es: LibraryCopy = {
  remove: {
    button: "Eliminar",
    buttonFor: "Eliminar {title}",
    select: "Seleccionar",
    selectAll: "Seleccionar todo",
    done: "Listo",
    selected: "{count} seleccionados",
    selectFor: "Seleccionar {title}",
    title: "¿Eliminar este vídeo?|¿Eliminar {count} vídeos?",
    body: "El vídeo y sus archivos se eliminan de RepGet. No se puede deshacer.",
    making: "Un vídeo que aún espera a crearse devuelve su crédito. Si ya se está creando, se detiene y el crédito no se devuelve.",
    made: "Los créditos usados para crear un vídeo no se devuelven.",
    scheduled: "Su publicación programada se cancela.",
    posted: "Lo que ya está publicado sigue en las plataformas. Solo se elimina de RepGet.",
    posting: "Un vídeo que se está publicando ahora no se puede eliminar hasta que termine.",
    confirm: "Eliminar",
    working: "Eliminando…",
    cancel: "Conservar",
    deleted: "Vídeo eliminado.|{count} vídeos eliminados.",
    stayed: "Uno se está publicando ahora y se ha conservado.|{count} se están publicando ahora y se han conservado.",
  },
  returned: {
    title: "Esta idea vuelve a estar en {tab}.",
    body: "Se le ha devuelto el crédito. Puede aprobarla de nuevo o elegir otra idea.",
    open: "Ir a {tab}",
  },
  auto: { unavailable: "La publicación automática no está disponible para este vídeo en este momento." },
  actions: { label: "Publicar este vídeo", slides: "Descargar diapositivas" },
  tags: {
    label: "Etiquetas",
    placeholder: "pequeña empresa, consejos de marketing, seo",
    hint: "Separe las etiquetas con comas. Péguelas en el campo Etiquetas de YouTube al subir el Short.",
    copy: "Copiar etiquetas",
    suggested: "Sugeridas a partir de los hashtags del texto.",
    saved: "Etiquetas guardadas.",
    tooLong: "YouTube admite 500 caracteres. Las etiquetas que no caben se omiten.",
  },
};

const fr: LibraryCopy = {
  remove: {
    button: "Supprimer",
    buttonFor: "Supprimer {title}",
    select: "Sélectionner",
    selectAll: "Tout sélectionner",
    done: "Terminé",
    selected: "{count} sélectionnés",
    selectFor: "Sélectionner {title}",
    title: "Supprimer cette vidéo ?|Supprimer {count} vidéos ?",
    body: "La vidéo et ses fichiers sont supprimés de RepGet. Cette action est définitive.",
    making: "Une vidéo qui attend encore d’être créée rend son crédit. Si sa création a commencé, elle s’arrête et le crédit n’est pas rendu.",
    made: "Les crédits utilisés pour créer une vidéo ne sont pas rendus.",
    scheduled: "Sa publication programmée est annulée.",
    posted: "Ce qui est déjà publié reste sur les plateformes. La suppression ne concerne que RepGet.",
    posting: "Une vidéo en cours de publication ne peut pas être supprimée avant la fin.",
    confirm: "Supprimer",
    working: "Suppression…",
    cancel: "Conserver",
    deleted: "Vidéo supprimée.|{count} vidéos supprimées.",
    stayed: "Une vidéo en cours de publication a été conservée.|{count} vidéos en cours de publication ont été conservées.",
  },
  returned: {
    title: "Cette idée est de nouveau dans {tab}.",
    body: "Votre crédit vous a été rendu. Vous pouvez l’approuver à nouveau ou choisir une autre idée.",
    open: "Aller à {tab}",
  },
  auto: { unavailable: "La publication automatique n’est pas disponible pour cette vidéo en ce moment." },
  actions: { label: "Publier cette vidéo", slides: "Télécharger les diapositives" },
  tags: {
    label: "Tags",
    placeholder: "petite entreprise, conseils marketing, seo",
    hint: "Séparez les tags par des virgules. Collez-les dans le champ Tags de YouTube lorsque vous publiez le Short.",
    copy: "Copier les tags",
    suggested: "Suggérés à partir des hashtags du texte.",
    saved: "Tags enregistrés.",
    tooLong: "YouTube accepte 500 caractères. Les tags en trop sont laissés de côté.",
  },
};

const it: LibraryCopy = {
  remove: {
    button: "Elimina",
    buttonFor: "Elimina {title}",
    select: "Seleziona",
    selectAll: "Seleziona tutto",
    done: "Fine",
    selected: "{count} selezionati",
    selectFor: "Seleziona {title}",
    title: "Eliminare questo video?|Eliminare {count} video?",
    body: "Il video e i suoi file vengono rimossi da RepGet. L’operazione non si può annullare.",
    making: "Un video ancora in attesa restituisce il credito. Se la creazione è iniziata, si ferma e il credito non viene restituito.",
    made: "I crediti usati per creare un video non vengono restituiti.",
    scheduled: "La pubblicazione programmata viene annullata.",
    posted: "Ciò che è già pubblicato resta sulle piattaforme. Viene rimosso solo da RepGet.",
    posting: "Un video in corso di pubblicazione non si può eliminare finché non ha finito.",
    confirm: "Elimina",
    working: "Eliminazione…",
    cancel: "Conserva",
    deleted: "Video eliminato.|{count} video eliminati.",
    stayed: "Uno è in corso di pubblicazione ed è rimasto.|{count} sono in corso di pubblicazione e sono rimasti.",
  },
  returned: {
    title: "Questa idea è di nuovo in {tab}.",
    body: "Il credito le è stato restituito. Può approvarla di nuovo o scegliere un’altra idea.",
    open: "Vai a {tab}",
  },
  auto: { unavailable: "La pubblicazione automatica non è disponibile per questo video in questo momento." },
  actions: { label: "Pubblica questo video", slides: "Scarica le slide" },
  tags: {
    label: "Tag",
    placeholder: "piccola impresa, consigli di marketing, seo",
    hint: "Separi i tag con le virgole. Li incolli nel campo Tag di YouTube quando carica lo Short.",
    copy: "Copia i tag",
    suggested: "Suggeriti dagli hashtag del testo.",
    saved: "Tag salvati.",
    tooLong: "YouTube accetta 500 caratteri. I tag che non entrano vengono esclusi.",
  },
};

const de: LibraryCopy = {
  remove: {
    button: "Löschen",
    buttonFor: "{title} löschen",
    select: "Auswählen",
    selectAll: "Alle auswählen",
    done: "Fertig",
    selected: "{count} ausgewählt",
    selectFor: "{title} auswählen",
    title: "Dieses Video löschen?|{count} Videos löschen?",
    body: "Das Video und seine Dateien werden aus RepGet entfernt. Das lässt sich nicht rückgängig machen.",
    making: "Ein Video, das noch auf die Erstellung wartet, gibt seinen Credit zurück. Läuft die Erstellung schon, wird sie beendet und der Credit nicht erstattet.",
    made: "Für die Erstellung eines Videos verwendete Credits werden nicht erstattet.",
    scheduled: "Die geplante Veröffentlichung wird abgebrochen.",
    posted: "Was bereits veröffentlicht ist, bleibt auf den Plattformen. Es wird nur aus RepGet entfernt.",
    posting: "Ein Video, das gerade veröffentlicht wird, kann erst danach gelöscht werden.",
    confirm: "Löschen",
    working: "Wird gelöscht…",
    cancel: "Behalten",
    deleted: "Video gelöscht.|{count} Videos gelöscht.",
    stayed: "Eines wird gerade veröffentlicht und blieb erhalten.|{count} werden gerade veröffentlicht und blieben erhalten.",
  },
  returned: {
    title: "Diese Idee ist wieder unter {tab}.",
    body: "Ihr Credit wurde zurückerstattet. Sie können sie erneut freigeben oder eine andere Idee wählen.",
    open: "Zu {tab}",
  },
  auto: { unavailable: "Die automatische Veröffentlichung ist für dieses Video derzeit nicht verfügbar." },
  actions: { label: "Dieses Video veröffentlichen", slides: "Folien herunterladen" },
  tags: {
    label: "Tags",
    placeholder: "kleinunternehmen, marketing-tipps, seo",
    hint: "Trennen Sie die Tags mit Kommas. Fügen Sie sie beim Hochladen des Shorts in das Tags-Feld von YouTube ein.",
    copy: "Tags kopieren",
    suggested: "Vorschlag aus den Hashtags des Textes.",
    saved: "Tags gespeichert.",
    tooLong: "YouTube nimmt 500 Zeichen an. Tags, die nicht passen, werden weggelassen.",
  },
};

/** One full translation per locale; keep the five objects in step when a key changes. */
export const VIDEO_LIBRARY_COPY: Record<Locale, LibraryCopy> = { en, es, fr, it, de };
