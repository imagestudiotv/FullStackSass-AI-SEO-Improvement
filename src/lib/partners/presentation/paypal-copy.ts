import type { Locale } from "@/lib/i18n/config";

/**
 * Partner portal wording for being paid through PayPal (payment session).
 * Kept beside copy.ts rather than inside it, so the public partner pages'
 * copy (another session's) is untouched. Formal register, as copy.ts.
 * Native read pending.
 */
export type PartnerPayPalCopy = {
  title: string;
  intro: string;
  /** Shown in manual mode: the team sends each payment in PayPal. */
  manualNote: string;
  email: string;
  sendCode: string;
  /** {email} */
  codeSent: string;
  code: string;
  confirm: string;
  /** {email} */
  verified: string;
  changeAddress: string;
  usePayPal: string;
  useStripe: string;
  /** {email} */
  currentPayPal: string;
  currentStripe: string;
  unclaimedHint: string;
  errors: {
    email: string;
    code: string;
    expired: string;
    tooMany: string;
    country: string;
    notVerified: string;
    generic: string;
  };
};

export const PARTNER_PAYPAL_COPY: Record<Locale, PartnerPayPalCopy> = {
  en: {
    title: "Get paid with PayPal",
    intro: "Receive your payouts in your PayPal account instead of a bank account through Stripe. The schedule and the minimum are the same.",
    manualNote: "Our team sends each payout to your PayPal account and records it here.",
    email: "PayPal email address",
    sendCode: "Send confirmation code",
    codeSent: "We sent a 6-digit code to {email}. Enter it within 30 minutes.",
    code: "Confirmation code",
    confirm: "Confirm address",
    verified: "Confirmed: payouts can go to {email}.",
    changeAddress: "Use another address",
    usePayPal: "Pay me with PayPal",
    useStripe: "Pay me through Stripe",
    currentPayPal: "Your payouts go to PayPal ({email}).",
    currentStripe: "Your payouts go to your bank account through Stripe.",
    unclaimedHint: "If this address has no PayPal account yet, PayPal keeps the payment for 30 days for you to claim it.",
    errors: {
      email: "Enter a valid email address.",
      code: "That code is not right. Check the email and try again.",
      expired: "That code has expired. Send a new one.",
      tooMany: "Too many attempts. Wait an hour, then send a new code.",
      country: "PayPal payouts are not available in your country yet.",
      notVerified: "Confirm your PayPal address first.",
      generic: "That did not work. Please try again.",
    },
  },
  es: {
    title: "Cobrar con PayPal",
    intro: "Reciba sus pagos en su cuenta de PayPal en lugar de en una cuenta bancaria a través de Stripe. El calendario y el mínimo son los mismos.",
    manualNote: "Nuestro equipo envía cada pago a su cuenta de PayPal y lo registra aquí.",
    email: "Correo electrónico de PayPal",
    sendCode: "Enviar código de confirmación",
    codeSent: "Hemos enviado un código de 6 dígitos a {email}. Introdúzcalo en un plazo de 30 minutos.",
    code: "Código de confirmación",
    confirm: "Confirmar dirección",
    verified: "Confirmado: los pagos pueden ir a {email}.",
    changeAddress: "Usar otra dirección",
    usePayPal: "Pagarme con PayPal",
    useStripe: "Pagarme a través de Stripe",
    currentPayPal: "Sus pagos van a PayPal ({email}).",
    currentStripe: "Sus pagos van a su cuenta bancaria a través de Stripe.",
    unclaimedHint: "Si esta dirección aún no tiene cuenta de PayPal, PayPal guarda el pago 30 días para que lo reclame.",
    errors: {
      email: "Introduzca un correo electrónico válido.",
      code: "Ese código no es correcto. Revise el correo e inténtelo de nuevo.",
      expired: "Ese código ha caducado. Envíe uno nuevo.",
      tooMany: "Demasiados intentos. Espere una hora y envíe un código nuevo.",
      country: "Los pagos con PayPal aún no están disponibles en su país.",
      notVerified: "Primero confirme su dirección de PayPal.",
      generic: "No ha funcionado. Inténtelo de nuevo.",
    },
  },
  fr: {
    title: "Être payé avec PayPal",
    intro: "Recevez vos versements sur votre compte PayPal plutôt que sur un compte bancaire via Stripe. Le calendrier et le minimum sont les mêmes.",
    manualNote: "Notre équipe envoie chaque versement sur votre compte PayPal et l’enregistre ici.",
    email: "Adresse e-mail PayPal",
    sendCode: "Envoyer le code de confirmation",
    codeSent: "Nous avons envoyé un code à 6 chiffres à {email}. Saisissez-le dans les 30 minutes.",
    code: "Code de confirmation",
    confirm: "Confirmer l’adresse",
    verified: "Confirmé : les versements peuvent aller à {email}.",
    changeAddress: "Utiliser une autre adresse",
    usePayPal: "Me payer avec PayPal",
    useStripe: "Me payer via Stripe",
    currentPayPal: "Vos versements vont sur PayPal ({email}).",
    currentStripe: "Vos versements vont sur votre compte bancaire via Stripe.",
    unclaimedHint: "Si cette adresse n’a pas encore de compte PayPal, PayPal conserve le paiement 30 jours pour que vous le réclamiez.",
    errors: {
      email: "Saisissez une adresse e-mail valide.",
      code: "Ce code n’est pas correct. Vérifiez l’e-mail et réessayez.",
      expired: "Ce code a expiré. Envoyez-en un nouveau.",
      tooMany: "Trop de tentatives. Attendez une heure, puis envoyez un nouveau code.",
      country: "Les versements PayPal ne sont pas encore disponibles dans votre pays.",
      notVerified: "Confirmez d’abord votre adresse PayPal.",
      generic: "Cela n’a pas fonctionné. Veuillez réessayer.",
    },
  },
  it: {
    title: "Ricevere i pagamenti con PayPal",
    intro: "Riceva i suoi pagamenti sul suo conto PayPal invece che su un conto bancario tramite Stripe. Il calendario e il minimo sono gli stessi.",
    manualNote: "Il nostro team invia ogni pagamento al suo conto PayPal e lo registra qui.",
    email: "Indirizzo email PayPal",
    sendCode: "Invia il codice di conferma",
    codeSent: "Abbiamo inviato un codice di 6 cifre a {email}. Lo inserisca entro 30 minuti.",
    code: "Codice di conferma",
    confirm: "Conferma l’indirizzo",
    verified: "Confermato: i pagamenti possono andare a {email}.",
    changeAddress: "Usa un altro indirizzo",
    usePayPal: "Pagatemi con PayPal",
    useStripe: "Pagatemi tramite Stripe",
    currentPayPal: "I suoi pagamenti vanno su PayPal ({email}).",
    currentStripe: "I suoi pagamenti vanno sul suo conto bancario tramite Stripe.",
    unclaimedHint: "Se questo indirizzo non ha ancora un conto PayPal, PayPal conserva il pagamento per 30 giorni perché lei lo riscuota.",
    errors: {
      email: "Inserisca un indirizzo email valido.",
      code: "Il codice non è corretto. Controlli l’email e riprovi.",
      expired: "Il codice è scaduto. Ne invii uno nuovo.",
      tooMany: "Troppi tentativi. Attenda un’ora, poi invii un nuovo codice.",
      country: "I pagamenti PayPal non sono ancora disponibili nel suo paese.",
      notVerified: "Confermi prima il suo indirizzo PayPal.",
      generic: "Non ha funzionato. Riprovi.",
    },
  },
  de: {
    title: "Auszahlung über PayPal",
    intro: "Erhalten Sie Ihre Auszahlungen auf Ihr PayPal-Konto statt über Stripe auf ein Bankkonto. Zeitplan und Mindestbetrag bleiben gleich.",
    manualNote: "Unser Team sendet jede Auszahlung an Ihr PayPal-Konto und erfasst sie hier.",
    email: "PayPal-E-Mail-Adresse",
    sendCode: "Bestätigungscode senden",
    codeSent: "Wir haben einen 6-stelligen Code an {email} gesendet. Geben Sie ihn innerhalb von 30 Minuten ein.",
    code: "Bestätigungscode",
    confirm: "Adresse bestätigen",
    verified: "Bestätigt: Auszahlungen können an {email} gehen.",
    changeAddress: "Andere Adresse verwenden",
    usePayPal: "Über PayPal auszahlen",
    useStripe: "Über Stripe auszahlen",
    currentPayPal: "Ihre Auszahlungen gehen an PayPal ({email}).",
    currentStripe: "Ihre Auszahlungen gehen über Stripe auf Ihr Bankkonto.",
    unclaimedHint: "Hat diese Adresse noch kein PayPal-Konto, hält PayPal die Zahlung 30 Tage für Sie bereit.",
    errors: {
      email: "Geben Sie eine gültige E-Mail-Adresse ein.",
      code: "Dieser Code ist nicht richtig. Prüfen Sie die E-Mail und versuchen Sie es erneut.",
      expired: "Dieser Code ist abgelaufen. Senden Sie einen neuen.",
      tooMany: "Zu viele Versuche. Warten Sie eine Stunde und senden Sie dann einen neuen Code.",
      country: "PayPal-Auszahlungen sind in Ihrem Land noch nicht verfügbar.",
      notVerified: "Bestätigen Sie zuerst Ihre PayPal-Adresse.",
      generic: "Das hat nicht geklappt. Bitte versuchen Sie es erneut.",
    },
  },
};
