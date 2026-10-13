import type { DocsTranslation } from "../docs";

/**
 * The setup guides in Italian. Same steps and claims as the English guides
 * in ../docs.ts: change one, change all five. Naming rules as in ./es.ts.
 */
export const it: DocsTranslation = {
  ui: {
    metaTitle: "Guide alle integrazioni",
    metaDescription: "Come collegare WordPress, Ghost, Shopify o un suo endpoint perché gli articoli vengano pubblicati automaticamente.",
    home: "Home",
    breadcrumb: "Guide alle integrazioni",
    title: "Colleghi il suo sito",
    intro:
      "Lo colleghi una volta e ogni articolo che scriviamo viene pubblicato da solo sul suo sito. Scelga la sua piattaforma qui sotto per i passaggi esatti, compreso dove si trova ogni dato nel pannello di quella piattaforma.",
    otherBefore: "Usa un’altra piattaforma?",
    otherLink: "L’integrazione webhook",
    otherAfter: "invia gli articoli finiti a qualsiasi endpoint che lei controlla.",
    connectTitle: "Collegare {name}",
    notFound: "Guida non trovata",
    before: "Prima di iniziare",
    setup: "Configurazione",
    wrong: "Se qualcosa non funziona",
    official: "Documentazione ufficiale di {name}:",
    readHere: "la legga qui",
    ready: "Pronto a collegare il sito?",
    readyBody:
      "Apra il suo sito nell’app, vada in Impostazioni → Integrazioni e scelga {name}. Poi prema {button}: creiamo una vera bozza sul suo sito, così può verificare che tutto il percorso funzioni prima di programmare qualsiasi cosa.",
    publishTest: "Pubblica articolo di prova",
    goToWebsites: "Vai ai miei siti",
    englishUi: "I menu e i pulsanti di {name} sono indicati come appaiono nella sua interfaccia in inglese.",
  },
  docs: {
    "wordpress-plugin": {
      name: "Plugin WordPress",
      summary:
        "Pubblichi su WordPress con il nostro plugin. Funziona anche quando l’API REST è bloccata, e non conserviamo mai una password del suo sito.",
      requirements: [
        "Un sito WordPress su cui può installare plugin: self-hosted (wordpress.org) o un piano WordPress.com che consente i plugin (Business o superiore)",
        "WordPress 5.6 o successivo e PHP 7.4 o successivo",
        "Un account amministratore sul sito WordPress: editori e autori non possono installare plugin né vedere la schermata di RepGet",
        "Un piano attivo per questo sito in RepGet",
        "L’indirizzo del suo sito in RepGet (Impostazioni → Attività) uguale al suo indirizzo WordPress, perché i pulsanti qui sotto aprano il sito giusto",
      ],
      steps: [
        {
          title: "Scarichi il plugin da RepGet",
          body: "In RepGet scelga il suo sito nel selettore in alto, poi apra Impostazioni → Integrazioni e trovi il pannello Plugin WordPress. Prema Scarica il plugin. Viene salvato repget-connector.zip, di circa 35 KB. LO LASCI COMPRESSO: non lo decomprima e non lo apra prima. Alcuni browser (Safari su Mac, per esempio) decomprimono automaticamente i file zip, ed è la causa più comune di un’installazione non riuscita.",
        },
        {
          title: "Lo installi in WordPress",
          body: "Prema Apri il mio WordPress nello stesso pannello. Si apre Plugin → Aggiungi nuovo plugin → Carica plugin sul suo sito (può anche andarci da sé). Scelga il file repget-connector.zip esattamente come è stato scaricato, prema Installa ora e poi Attiva plugin.",
        },
        {
          title: "WordPress apre la schermata di RepGet",
          body: "Attivando il plugin arriva direttamente alla sua schermata. In seguito la troverà come RepGet nel menu a sinistra della bacheca di WordPress, tra Commenti e Aspetto, e tramite il link Settings sotto il plugin nella pagina Plugin. La vedono solo gli amministratori, perché la chiave controlla ciò che viene pubblicato sul suo sito.",
        },
        {
          title: "Collegamento - Opzione A: iniziare da RepGet (consigliato)",
          body: "Torni nella scheda di RepGet (Impostazioni → Integrazioni → Plugin WordPress). La scheda indica quale area di lavoro RepGet sta collegando: verifichi che sia quella giusta. Prema Collega WordPress: si apre la schermata di RepGet nel suo WordPress, con il pulsante Finish connecting to RepGet. Lo prema. Il browser passa un istante da RepGet e torna subito indietro: RepGet consegna la chiave direttamente a WordPress e non compare mai sullo schermo, non c’è nulla da copiare. Se WordPress le chiede prima di accedere, acceda e poi prema Riapri WordPress in RepGet. Con il plugin 1.6 viene invece compilato il campo Integration Key: prema Save and connect. Se il browser ha bloccato la nuova scheda, RepGet mostra la chiave con Copia la chiave: la incolli sotto Advanced: use an Integration Key (plugin 1.7) o nel campo Integration Key (1.6), poi prema Save and connect.",
        },
        {
          title: "Collegamento - Opzione B: iniziare da WordPress",
          body: "In alternativa all’opzione A, con il plugin 1.7 o successivo: nella schermata di RepGet in WordPress prema Connect to RepGet. Se richiesto, acceda a RepGet con l’account che deve pubblicare su questo sito. La pagina Collegare suodominio a RepGet? elenca i suoi siti con questo dominio e l’area di lavoro di ciascuno; prema Collega suodominio su quello giusto. Torna direttamente in WordPress. Se il dominio non è in nessuno dei suoi siti, RepGet glielo dice: aggiunga prima il sito oppure prema Usa un altro account.",
        },
        {
          title: "Se il sito era collegato a un altro account",
          body: "Entrambe le opzioni chiedono prima conferma quando questo sito WordPress è collegato a un altro account o a un altro sito RepGet: il pulsante diventa allora Sposta suodominio in, seguito dall’area di lavoro scelta. La chiave del vecchio account smette di funzionare solo quando il nuovo collegamento funziona, e quell’account viene avvisato. Ricollegare lo stesso sito non chiede nulla.",
        },
        {
          title: "Verifichi che indichi Connected, con l’account giusto",
          body: "La schermata indica Connected to, seguito dall’area di lavoro RepGet e dal suo dominio. In RepGet non serve ricaricare: in pochi secondi la scheda diventa verde e il passaggio di collegamento del sito risulta spuntato. Se indica UN ALTRO account o un altro sito, prema Connect to a different RepGet account in WordPress (plugin 1.7), oppure Collega WordPress nell’account che vuole usare, e concluda di nuovo: è il collegamento salvato in WordPress a decidere quale account pubblica lì.",
        },
        {
          title: "Come arrivano gli articoli",
          body: "Il primo articolo viene pubblicato appena è scritto. Poi RepGet invia gli articoli secondo Impostazioni → Impostazioni articoli → Quando un articolo è pronto: tenuti in RepGet perché lei li riveda, inviati come bozza nel giorno previsto o pubblicati nel giorno previsto. Premere Pubblica su un articolo in RepGet lo pubblica subito: RepGet chiede al plugin di controllare immediatamente (plugin 1.4 o successivo). Il plugin controlla anche da sé ogni ora, e Check for articles now, nella schermata di RepGet in WordPress, recupera subito tutto ciò che è in scadenza.",
        },
        {
          title: "Trovi gli articoli pubblicati",
          body: "In RepGet apra l’articolo: uno pubblicato ha un pulsante Vedi sul suo sito sotto il titolo, e la sua cronologia riporta il link. In WordPress vada in Articoli → Tutti gli articoli: gli articoli di RepGet sono normali articoli che può modificare, togliere dalla pubblicazione o eliminare. Sul suo sito compaiono al loro indirizzo (per esempio suosito.com/titolo-articolo/, secondo Impostazioni → Permalink) e nell’elenco del blog, cioè la pagina scelta in Impostazioni → Lettura → Pagina articoli.",
        },
      ],
      troubleshooting: [
        {
          problem: "«Non è stato possibile installare il pacchetto»",
          fix: "Lo zip è stato decompresso e ricompresso lungo il percorso, cosa che alcuni browser fanno automaticamente durante il download. Lo scarichi di nuovo e carichi il file così come arriva, senza aprirlo prima.",
        },
        {
          problem: "Non c’è il pulsante Carica plugin",
          fix: "Il suo account non è amministratore, oppure il sito è su un piano WordPress.com che non consente i plugin.",
        },
        {
          problem: "«The key was rejected. Check it was copied in full.»",
          fix: "Un unico messaggio copre di proposito tutte le cause, così chi prova chiavi a caso non impara nulla dalla risposta. Controlli tre cose, in ordine: la chiave è stata copiata PER INTERO (una copia parziale è di gran lunga la causa più comune); è ancora ATTIVA, o è stata revocata in RepGet; è la chiave di QUESTO sito e non di un altro sito della sua area di lavoro. La soluzione più rapida: prema Collega WordPress in RepGet e concluda nella scheda di WordPress che si apre.",
        },
        {
          problem: "Apri il mio WordPress apre il sito sbagliato",
          fix: "L’indirizzo salvato in RepGet non è il suo indirizzo WordPress. Lo corregga in Impostazioni → Attività, poi prema di nuovo il pulsante.",
        },
        {
          problem: "Non vedo RepGet nel menu di WordPress",
          fix: "Serve un account amministratore. Editori e autori non lo vedono, perché la chiave controlla ciò che viene pubblicato.",
        },
        {
          problem: "Collegato, ma non arriva nessun articolo",
          fix: "Non viene inviato nulla finché un articolo non è in scadenza. Controlli, in ordine: la pubblicazione automatica è attiva in RepGet; la data prevista dell’articolo è arrivata; l’articolo è davvero scritto (se è ancora pianificato o in scrittura, non ancora). Per inviarne uno subito comunque, apra l’articolo in RepGet e prema Pubblica, poi prema Check for articles now in WordPress.",
        },
        {
          problem: "L’articolo è tagliato, o sembra una pagina di portfolio o di progetto",
          fix: "Il suo tema mostra i normali articoli di WordPress con un layout diverso da quello del blog (spesso una pagina di portfolio o di progetto con un breve riquadro di testo), quindi un articolo completo non ci sta. Nella schermata di RepGet in WordPress imposti Publish articles as sul tipo di contenuto usato dagli articoli del suo blog (per esempio Editorial), poi prema Save (Save and connect prima del plugin 1.7). Anche gli articoli già creati da RepGet vengono spostati lì, e RepGet riceve i loro nuovi indirizzi. Serve il plugin 1.5 o successivo.",
        },
        {
          problem: "Gli articoli arrivano come bozze invece che pubblicati",
          fix: "Impostazioni → Impostazioni articoli → Quando un articolo è pronto è impostato su Inviarlo al mio sito come bozza, che fa esattamente questo. Scelga Pubblicarlo nel giorno previsto per i prossimi articoli; le bozze già create si possono pubblicare dalla schermata Articoli di WordPress.",
        },
        {
          problem: "Premendo Pubblica in RepGet, l’articolo risulta in coda",
          fix: "Il suo sito non ha risposto quando RepGet ha chiesto al plugin di controllare, quindi l’articolo aspetta il controllo orario del plugin. Nella maggior parte dei casi il plugin è precedente alla 1.4.0: lo scarichi di nuovo da RepGet e lo carichi allo stesso modo (WordPress propone di sostituire la versione attuale con quella caricata; la chiave viene conservata). Dal plugin 1.7, WordPress propone da sé le nuove versioni in Plugin, come per qualsiasi altro plugin. Altrimenti un plugin di sicurezza o un firewall potrebbe bloccare le richieste esterne a wp-admin/admin-ajax.php; consenta le richieste con action=repget_sync.",
        },
        {
          problem: "Gli articoli arrivano più di un’ora dopo la scadenza",
          fix: "Il plugin controlla da sé ogni ora, ma lo scheduler di WordPress parte solo quando qualcuno visita il sito: su un sito poco visitato il controllo avviene quindi in ritardo. È il funzionamento di WordPress, non un guasto. Prema Check for articles now per recuperarli subito, oppure chieda al suo hosting di configurare un vero cron se l’orario è importante.",
        },
        {
          problem: "WordPress indica Connected, ma RepGet è ancora in attesa",
          fix: "WordPress è collegato con un’altra chiave: spesso di un altro account RepGet per lo stesso sito, o di una prova precedente. Nell’account RepGet che vuole usare, prema Collega WordPress e concluda nella scheda di WordPress che si apre. È il collegamento salvato in WordPress a decidere quale account pubblica sul sito. Non serve cercare né copiare nessuna vecchia chiave.",
        },
        {
          problem: "RepGet dice che il mio sito non è ancora in questo account",
          fix: "Ha effettuato l’accesso a un account RepGet che non ha nessun sito con questo indirizzo WordPress. Prema Usa un altro account e acceda a quello che lo contiene, oppure aggiunga prima il sito e prema di nuovo Connect to RepGet in WordPress. L’indirizzo del sito in RepGet deve essere l’indirizzo WordPress (con o senza www., non importa). Se WordPress funziona di proposito a un altro indirizzo (per esempio blog.example.com per example.com), lo colleghi con una chiave: in RepGet apra Chiavi (avanzate) e prema Nuova chiave, poi in WordPress la incolli sotto Advanced: use an Integration Key e prema Save and connect.",
        },
        {
          problem: "«Questo collegamento è stato aperto altrove»",
          fix: "Un collegamento si può completare solo nel browser che lo ha aperto per primo, quindi un link copiato in un altro browser o inviato a un’altra persona non approva nulla. Torni in WordPress e prema di nuovo Connect to RepGet, nel browser in cui ha effettuato l’accesso a RepGet.",
        },
        {
          problem: "Ho perso la chiave",
          fix: "Non le servirà mai una vecchia chiave: prema Collega WordPress in RepGet e concluda in WordPress. Le chiavi inutilizzate vengono eliminate automaticamente quando WordPress si collega. Per far smettere di pubblicare un sito, prema Disconnect in WordPress (plugin 1.7), oppure apra Chiavi (avanzate) in RepGet e prema Revoca: il sito viene avvisato subito.",
        },
      ],
    },
    wordpress: {
      name: "WordPress",
      summary:
        "Pubblichi direttamente su un sito WordPress self-hosted con una password applicazione. Nessun plugin da installare, ma veda la guida del plugin se il suo hosting blocca l’API REST.",
      requirements: [
        "Un sito WordPress self-hosted (wordpress.org, non un piano gratuito di wordpress.com)",
        "Un account sul sito con il ruolo Editore o Amministratore",
        "WordPress 5.6 o successivo, la versione in cui sono arrivate le password applicazione",
      ],
      steps: [
        {
          title: "Apra il suo profilo WordPress",
          body: "Acceda a WordPress e vada in Utenti → Profilo. Se gestisce più account, usi quello con cui vuole pubblicare gli articoli: l’autore indicato su ogni articolo è questo account.",
        },
        {
          title: "Crei una password applicazione",
          body: "Scorra fino in fondo a quella pagina, a Password applicazione. Scriva un nome che riconoscerà in seguito, come RepGet, e prema Aggiungi nuova password applicazione.",
        },
        {
          title: "Copi la password esattamente",
          body: "WordPress la mostra una sola volta, in gruppi separati da spazi. La copi per intero, spazi compresi: non è la sua password di accesso, e la password di accesso qui non funziona.",
        },
        {
          title: "La colleghi qui",
          body: "In RepGet apra Impostazioni → Integrazioni e scelga WordPress. Inserisca l’indirizzo del sito, il suo nome utente WordPress e la password applicazione appena copiata.",
        },
        {
          title: "Pubblichi un articolo di prova",
          body: "Prema Pubblica articolo di prova. Creiamo una vera bozza sul suo sito e le restituiamo il link. Se funziona, funzioneranno anche gli articoli programmati, e la bozza si può eliminare senza problemi.",
        },
      ],
      troubleshooting: [
        {
          problem: "Password applicazione non compare nella pagina del profilo",
          fix: "La sezione è nascosta quando WordPress non è servito in HTTPS, e su alcuni hosting gestiti che la disattivano. Verifichi prima che il sito si apra con https://, poi chieda al suo hosting se l’API REST è attiva.",
        },
        {
          problem: "«Non hai i permessi per creare articoli»",
          fix: "L’account si autentica ma non può pubblicare. Gli assegni il ruolo Editore o Amministratore: Autore non basta per tutto ciò che facciamo.",
        },
        {
          problem: "Un plugin di sicurezza blocca il collegamento",
          fix: "Wordfence, iThemes e plugin simili possono bloccare le richieste all’API REST. Consenta /wp-json/wp/v2/ per le richieste autenticate, oppure consenta in modo specifico le nostre.",
        },
      ],
    },
    ghost: {
      name: "Ghost",
      summary: "Pubblichi su un blog Ghost con una chiave dell’Admin API.",
      requirements: ["Un sito Ghost che amministra, self-hosted o su Ghost(Pro)", "Ghost 4.0 o successivo"],
      steps: [
        { title: "Apra le impostazioni delle integrazioni", body: "Nel pannello di Ghost vada in Settings → Advanced → Integrations." },
        {
          title: "Aggiunga un’integrazione personalizzata",
          body: "Scelga Add custom integration e la chiami RepGet. Ghost mostra allora una Content API key e una Admin API key.",
        },
        {
          title: "Copi la chiave ADMIN",
          body: "Prenda la Admin API key, non la Content API key. Sembra due valori uniti da due punti: copi l’intera stringa, due punti compresi. La chiave Content può solo leggere, quindi fallisce alla prima pubblicazione.",
        },
        {
          title: "La colleghi qui",
          body: "In RepGet apra Impostazioni → Integrazioni, scelga Ghost e inserisca l’indirizzo del suo sito Ghost insieme alla Admin API key.",
        },
        { title: "Pubblichi un articolo di prova", body: "Prema Pubblica articolo di prova. Creiamo una bozza in Ghost e le restituiamo il link." },
      ],
      troubleshooting: [
        {
          problem: "«Invalid token» o 401 durante il collegamento",
          fix: "Quasi sempre è la Content API key invece della Admin. La chiave Admin contiene i due punti; la Content no.",
        },
        {
          problem: "L’indirizzo del sito viene rifiutato",
          fix: "Usi l’indirizzo del pannello di Ghost, senza un percorso finale: https://example.com, non https://example.com/ghost.",
        },
      ],
    },
    shopify: {
      name: "Shopify",
      summary: "Pubblichi articoli su un blog del suo negozio Shopify.",
      requirements: [
        "Un negozio Shopify di cui è proprietario o amministratore come membro dello staff",
        "Il permesso di creare un’app personalizzata in quel negozio",
        "Almeno un blog creato in Online Store → Blog posts",
      ],
      steps: [
        {
          title: "Consenta lo sviluppo di app personalizzate",
          body: "Nel pannello di Shopify vada in Settings → Apps and sales channels → Develop apps. Se è la prima volta, prema Allow custom app development e confermi.",
        },
        { title: "Crei l’app", body: "Prema Create an app, la chiami RepGet, poi apra Configuration → Admin API integration." },
        {
          title: "Conceda i permessi del blog",
          body: "Attivi write_content e read_content. Questi due coprono la creazione e l’aggiornamento degli articoli del blog; non serve altro, ed è meglio non concedere più del necessario.",
        },
        {
          title: "Installi l’app e copi il token",
          body: "Prema Install app, poi mostri l’Admin API access token. Shopify lo mostra una sola volta. Inizia con shpat_.",
        },
        {
          title: "Lo colleghi qui",
          body: "In RepGet apra Impostazioni → Integrazioni, scelga Shopify, inserisca l’indirizzo del negozio (example.myshopify.com) e il token di accesso, e scelga su quale blog pubblicare.",
        },
      ],
      troubleshooting: [
        {
          problem: "Nell’elenco non compare nessun blog",
          fix: "I negozi Shopify partono senza blog. Ne crei uno in Online Store → Blog posts → Manage blogs, poi ricolleghi.",
        },
        {
          problem: "«Access denied» durante la pubblicazione",
          fix: "Al token manca write_content. Riapra la configurazione dell’app, lo aggiunga e reinstalli l’app: cambiare i permessi genera un nuovo token.",
        },
      ],
    },
    webflow: {
      name: "Webflow",
      summary: "Pubblichi in una collezione del CMS del suo sito Webflow con un Site API token.",
      requirements: [
        "Un sito Webflow con un piano a pagamento: l’API del CMS non è disponibile nel piano gratuito",
        "Una collezione CMS per il blog, con un campo di testo formattato per il corpo",
        "Il permesso di creare token API su quel sito",
      ],
      steps: [
        {
          title: "Crei un Site API token",
          body: "In Webflow apra Site settings → Apps & integrations → API access, poi Generate API token. Gli dia lettura e scrittura del CMS: un token di sola lettura si collega senza problemi e poi fallisce alla prima pubblicazione.",
        },
        { title: "Copi il token", body: "Webflow lo mostra una sola volta. Copi il valore completo prima di chiudere la finestra." },
        {
          title: "Trovi l’ID della collezione del blog",
          body: "Apra la collezione nel Designer. L’ID è l’ultima parte dell’URL, una lunga stringa di lettere e numeri.",
        },
        {
          title: "Lo colleghi qui",
          body: "In RepGet apra Impostazioni → Integrazioni, scelga Webflow e inserisca il token e l’ID della collezione. Prima di accettarla verifichiamo che la collezione abbia un posto dove mettere il corpo di un articolo.",
        },
        {
          title: "Pubblichi un articolo di prova",
          body: "Prema Pubblica articolo di prova. Creiamo un vero elemento nella collezione, così può verificare che arrivi dove si aspetta.",
        },
      ],
      troubleshooting: [
        {
          problem: "«That collection has no rich text field»",
          fix: "Una collezione Webflow è ciò che ha costruito chi ha progettato il sito, e un articolo ha bisogno di un posto per il corpo. Aggiunga un campo Rich Text alla collezione, oppure ci indichi la collezione del blog invece di un’altra.",
        },
        {
          problem: "L’articolo non compare sul sito online",
          fix: "Gli elementi creati tramite l’API di Webflow vanno online solo quando il sito viene pubblicato. Prema Publish nel Designer, oppure attivi la pubblicazione automatica della collezione.",
        },
        {
          problem: "«That token cannot write to the CMS»",
          fix: "Il token è stato creato senza cms:write. I token non si possono modificare dopo la creazione: ne generi uno nuovo con entrambi i permessi del CMS.",
        },
      ],
    },
    wix: {
      name: "Wix",
      summary: "Pubblichi sul blog del suo sito Wix con una chiave API.",
      requirements: ["Un sito Wix con l’app Blog installata", "Accesso da proprietario o amministratore, per poter creare chiavi API"],
      steps: [
        { title: "Apra la pagina delle chiavi API", body: "Nella dashboard di Wix vada in Settings → API keys, poi Generate API key." },
        {
          title: "Le dia i permessi del blog",
          body: "Assegni un ruolo che includa Blog: senza, la chiave si autentica ma non può creare articoli.",
        },
        {
          title: "Copi la chiave e il Site ID",
          body: "La chiave viene mostrata una sola volta. Il Site ID è indicato accanto al sito nella stessa schermata. Servono entrambi: un account Wix può avere più siti, quindi la chiave da sola non dice quale.",
        },
        {
          title: "La colleghi qui",
          body: "In RepGet apra Impostazioni → Integrazioni, scelga Wix e inserisca entrambi i valori. Elenchiamo i suoi articoli esistenti per confermare che la chiave raggiunge il blog.",
        },
      ],
      troubleshooting: [
        {
          problem: "«Wix could not find that site, or the site has no blog»",
          fix: "O il Site ID appartiene a un altro sito, o l’app Blog non è installata. Aggiunga Blog dal Wix App Market e riprovi.",
        },
        {
          problem: "Il corpo dell’articolo appare come un unico blocco nell’editor",
          fix: "È normale. Wix salva i contenuti formattati in un suo formato; inviamo l’articolo come un unico blocco HTML, che si vede correttamente nella pagina pubblicata ma compare come un unico elemento incorporato durante la modifica.",
        },
      ],
    },
    webhook: {
      name: "Webhook personalizzato",
      summary: "Invii gli articoli finiti a qualsiasi endpoint che controlla, per le piattaforme che non supportiamo direttamente.",
      requirements: [
        "Un endpoint HTTPS che accetti una richiesta POST con un corpo JSON",
        "Un posto dove conservare il segreto di firma per verificare le richieste",
      ],
      steps: [
        {
          title: "Crei un endpoint",
          body: "Accetti una POST con un corpo JSON che contiene titolo, corpo HTML, slug, estratto e stato. Risponda 2xx dopo averlo salvato; qualsiasi altra risposta è trattata come un errore e la richiesta viene ripetuta.",
        },
        {
          title: "Lo colleghi qui",
          body: "In RepGet apra Impostazioni → Integrazioni, scelga Custom (webhook) e inserisca l’URL dell’endpoint e un segreto di firma generato da lei.",
        },
        {
          title: "Verifichi la firma",
          body: "Ogni richiesta porta un HMAC-SHA256 del corpo grezzo, calcolato con il suo segreto di firma. Lo confronti prima di fidarsi del contenuto: un endpoint che salta questo passaggio accetta qualsiasi cosa chiunque gli invii.",
        },
        {
          title: "Pubblichi un articolo di prova",
          body: "Prema Pubblica articolo di prova per inviare un contenuto reale e verificare che il suo codice lo elabori prima che arrivi qualsiasi articolo programmato.",
        },
      ],
      troubleshooting: [
        {
          problem: "Le richieste vengono ripetute",
          fix: "Trattiamo qualsiasi risposta diversa da 2xx come un errore. Risponda 200 appena il contenuto è salvato, e faccia dopo il lavoro più lento.",
        },
        {
          problem: "La firma non corrisponde mai",
          fix: "Calcoli l’HMAC sul corpo GREZZO della richiesta, prima di qualsiasi analisi del JSON. Riserializzare l’oggetto cambia i byte, e la firma non corrisponderà mai.",
        },
      ],
    },
  },
};
