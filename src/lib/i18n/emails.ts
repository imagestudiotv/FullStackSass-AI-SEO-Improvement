import type { Locale } from "@/lib/i18n/config";

/**
 * The words around the lifecycle emails (docs/emails.md): the Emails section
 * of Settings and the unsubscribe page. Five languages, formal address. The
 * emails' own words are in lib/email/lifecycle-copy.ts.
 */
export type EmailsCopy = {
  settingsTitle: string;
  settingsSubtitle: string;
  tipsLabel: string;
  tipsHelp: string;
  saved: string;
  error: string;
  unsubscribe: {
    pageTitle: string;
    invalidTitle: string;
    invalidBody: string;
    /** Shown while tips and reports are on: what pressing the button stops. */
    confirmTitle: string;
    confirmBody: string;
    confirmButton: string;
    doneTitle: string;
    doneBody: string;
    resubscribeButton: string;
    resubscribedTitle: string;
    resubscribedBody: string;
    settingsLink: string;
  };
};

export const EMAILS_COPY: Record<Locale, EmailsCopy> = {
  en: {
    settingsTitle: "Emails",
    settingsSubtitle: "What RepGet emails you about.",
    tipsLabel: "Tips and reports",
    tipsHelp:
      "The reminder to add your website, your website's first figures during the free period, when an article goes live, video milestones, the weekly summary and welcome-back offers. Emails about billing, the end of your free period and anything that goes wrong are always sent.",
    saved: "Saved",
    error: "That could not be saved. Please try again.",
    unsubscribe: {
      pageTitle: "Email preferences",
      invalidTitle: "This link does not work",
      invalidBody: "It may have been copied incompletely. You can change your emails in Settings after signing in.",
      confirmTitle: "Unsubscribe from tips and reports?",
      confirmBody:
        "You will no longer receive the setup reminder, the first figures during the free period, article and video updates, the weekly summary or welcome-back offers. Emails about billing, the end of your free period and anything that goes wrong are still sent.",
      confirmButton: "Unsubscribe",
      doneTitle: "You are unsubscribed",
      doneBody: "You will no longer receive tips and reports. Emails about billing and anything that goes wrong are still sent.",
      resubscribeButton: "Subscribe again",
      resubscribedTitle: "You are subscribed again",
      resubscribedBody: "You will receive tips and reports again.",
      settingsLink: "Manage emails in Settings",
    },
  },
  es: {
    settingsTitle: "Correos electrónicos",
    settingsSubtitle: "Sobre qué le escribe RepGet.",
    tipsLabel: "Consejos e informes",
    tipsHelp:
      "El recordatorio para añadir su sitio web, las primeras cifras de su sitio durante el periodo gratuito, cuando se publica un artículo, los hitos de sus vídeos, el resumen semanal y las ofertas de bienvenida. Los correos sobre facturación, el final de su periodo gratuito y cualquier problema se envían siempre.",
    saved: "Guardado",
    error: "No se ha podido guardar. Inténtelo de nuevo.",
    unsubscribe: {
      pageTitle: "Preferencias de correo",
      invalidTitle: "Este enlace no funciona",
      invalidBody: "Puede que se haya copiado incompleto. Puede cambiar sus correos en Ajustes después de iniciar sesión.",
      confirmTitle: "¿Dejar de recibir consejos e informes?",
      confirmBody:
        "Ya no recibirá el recordatorio de configuración, las primeras cifras durante el periodo gratuito, las novedades de artículos y vídeos, el resumen semanal ni las ofertas de bienvenida. Los correos sobre facturación, el final de su periodo gratuito y cualquier problema se siguen enviando.",
      confirmButton: "Darse de baja",
      doneTitle: "Se ha dado de baja",
      doneBody: "Ya no recibirá consejos e informes. Los correos sobre facturación y sobre cualquier problema se siguen enviando.",
      resubscribeButton: "Volver a suscribirse",
      resubscribedTitle: "Se ha vuelto a suscribir",
      resubscribedBody: "Volverá a recibir consejos e informes.",
      settingsLink: "Gestionar los correos en Ajustes",
    },
  },
  fr: {
    settingsTitle: "E-mails",
    settingsSubtitle: "Les sujets sur lesquels RepGet vous écrit.",
    tipsLabel: "Conseils et bilans",
    tipsHelp:
      "Le rappel pour ajouter votre site, les premiers chiffres de votre site pendant la période gratuite, la mise en ligne d’un article, les étapes franchies par vos vidéos, le bilan hebdomadaire et les offres de retour. Les e-mails sur la facturation, la fin de votre période gratuite et tout problème sont toujours envoyés.",
    saved: "Enregistré",
    error: "L’enregistrement a échoué. Veuillez réessayer.",
    unsubscribe: {
      pageTitle: "Préférences d’e-mail",
      invalidTitle: "Ce lien ne fonctionne pas",
      invalidBody: "Il a peut-être été copié de façon incomplète. Vous pouvez modifier vos e-mails dans Paramètres après vous être connecté.",
      confirmTitle: "Ne plus recevoir les conseils et les bilans ?",
      confirmBody:
        "Vous ne recevrez plus le rappel de configuration, les premiers chiffres pendant la période gratuite, les nouvelles de vos articles et vidéos, le bilan hebdomadaire ni les offres de retour. Les e-mails sur la facturation, la fin de votre période gratuite et tout problème sont toujours envoyés.",
      confirmButton: "Se désabonner",
      doneTitle: "Vous êtes désabonné",
      doneBody: "Vous ne recevrez plus de conseils ni de bilans. Les e-mails sur la facturation et sur tout problème sont toujours envoyés.",
      resubscribeButton: "Se réabonner",
      resubscribedTitle: "Vous êtes de nouveau abonné",
      resubscribedBody: "Vous recevrez à nouveau des conseils et des bilans.",
      settingsLink: "Gérer les e-mails dans Paramètres",
    },
  },
  it: {
    settingsTitle: "Email",
    settingsSubtitle: "Gli argomenti per cui RepGet Le scrive.",
    tipsLabel: "Consigli e resoconti",
    tipsHelp:
      "Il promemoria per aggiungere il Suo sito, i primi dati del Suo sito durante il periodo gratuito, la pubblicazione di un articolo, i traguardi dei Suoi video, il resoconto settimanale e le offerte di bentornato. Le email sulla fatturazione, sulla fine del periodo gratuito e su qualsiasi problema vengono sempre inviate.",
    saved: "Salvato",
    error: "Non è stato possibile salvare. Riprovi.",
    unsubscribe: {
      pageTitle: "Preferenze email",
      invalidTitle: "Questo link non funziona",
      invalidBody: "Potrebbe essere stato copiato in modo incompleto. Può modificare le Sue email nelle Impostazioni dopo aver effettuato l’accesso.",
      confirmTitle: "Non ricevere più consigli e resoconti?",
      confirmBody:
        "Non riceverà più il promemoria di configurazione, i primi dati durante il periodo gratuito, gli aggiornamenti su articoli e video, il resoconto settimanale né le offerte di bentornato. Le email sulla fatturazione, sulla fine del periodo gratuito e su qualsiasi problema vengono comunque inviate.",
      confirmButton: "Annulla l’iscrizione",
      doneTitle: "Iscrizione annullata",
      doneBody: "Non riceverà più consigli e resoconti. Le email sulla fatturazione e su qualsiasi problema vengono comunque inviate.",
      resubscribeButton: "Iscriviti di nuovo",
      resubscribedTitle: "È di nuovo iscritto",
      resubscribedBody: "Riceverà di nuovo consigli e resoconti.",
      settingsLink: "Gestisci le email nelle Impostazioni",
    },
  },
  de: {
    settingsTitle: "E-Mails",
    settingsSubtitle: "Worüber RepGet Ihnen schreibt.",
    tipsLabel: "Tipps und Berichte",
    tipsHelp:
      "Die Erinnerung, Ihre Website hinzuzufügen, die ersten Zahlen Ihrer Website im kostenlosen Zeitraum, die Veröffentlichung eines Artikels, Meilensteine Ihrer Videos, die Wochenübersicht und Angebote für Ihre Rückkehr. E-Mails zur Abrechnung, zum Ende Ihres kostenlosen Zeitraums und zu Problemen werden immer gesendet.",
    saved: "Gespeichert",
    error: "Das konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.",
    unsubscribe: {
      pageTitle: "E-Mail-Einstellungen",
      invalidTitle: "Dieser Link funktioniert nicht",
      invalidBody: "Er wurde möglicherweise unvollständig kopiert. Sie können Ihre E-Mails nach der Anmeldung in den Einstellungen ändern.",
      confirmTitle: "Tipps und Berichte abbestellen?",
      confirmBody:
        "Sie erhalten dann keine Einrichtungs-Erinnerung, keine ersten Zahlen im kostenlosen Zeitraum, keine Neuigkeiten zu Artikeln und Videos, keine Wochenübersicht und keine Angebote für Ihre Rückkehr mehr. E-Mails zur Abrechnung, zum Ende Ihres kostenlosen Zeitraums und zu Problemen werden weiterhin gesendet.",
      confirmButton: "Abbestellen",
      doneTitle: "Sie haben abbestellt",
      doneBody: "Sie erhalten keine Tipps und Berichte mehr. E-Mails zur Abrechnung und zu Problemen werden weiterhin gesendet.",
      resubscribeButton: "Wieder abonnieren",
      resubscribedTitle: "Sie haben wieder abonniert",
      resubscribedBody: "Sie erhalten wieder Tipps und Berichte.",
      settingsLink: "E-Mails in den Einstellungen verwalten",
    },
  },
};
