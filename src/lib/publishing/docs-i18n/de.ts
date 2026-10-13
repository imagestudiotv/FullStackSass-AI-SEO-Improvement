import type { DocsTranslation } from "../docs";

/**
 * The setup guides in German. Same steps and claims as the English guides
 * in ../docs.ts: change one, change all five. Naming rules as in ./es.ts.
 */
export const de: DocsTranslation = {
  ui: {
    metaTitle: "Anleitungen für Integrationen",
    metaDescription: "So verbinden Sie WordPress, Ghost, Shopify oder Ihren eigenen Endpoint, damit Artikel automatisch veröffentlicht werden.",
    home: "Startseite",
    breadcrumb: "Anleitungen für Integrationen",
    title: "Verbinden Sie Ihre Website",
    intro:
      "Einmal verbinden, und jeder Artikel, den wir schreiben, erscheint von selbst auf Ihrer Website. Wählen Sie unten Ihre Plattform für die genauen Schritte, einschließlich der Stelle, an der Sie jeden Wert im Admin-Bereich dieser Plattform finden.",
    otherBefore: "Sie nutzen etwas anderes?",
    otherLink: "Die Webhook-Integration",
    otherAfter: "sendet fertige Artikel an jeden Endpoint, den Sie kontrollieren.",
    connectTitle: "{name} verbinden",
    notFound: "Anleitung nicht gefunden",
    before: "Bevor Sie beginnen",
    setup: "Einrichtung",
    wrong: "Wenn etwas nicht klappt",
    official: "Offizielle Dokumentation von {name}:",
    readHere: "hier lesen",
    ready: "Bereit zum Verbinden?",
    readyBody:
      "Öffnen Sie Ihre Website in der App, gehen Sie zu Einstellungen → Integrationen und wählen Sie {name}. Klicken Sie dann auf {button}: Wir erstellen einen echten Entwurf auf Ihrer Website, damit Sie prüfen können, dass der ganze Weg funktioniert, bevor etwas geplant wird.",
    publishTest: "Testartikel veröffentlichen",
    goToWebsites: "Zu meinen Websites",
    englishUi: "Menüs und Schaltflächen von {name} sind so benannt, wie sie in der englischen Oberfläche erscheinen.",
  },
  docs: {
    "wordpress-plugin": {
      name: "WordPress-Plugin",
      summary:
        "Veröffentlichen Sie mit unserem Plugin auf WordPress. Es funktioniert auch, wenn die REST-API blockiert ist, und wir speichern nie ein Passwort zu Ihrer Website.",
      requirements: [
        "Eine WordPress-Website, auf der Sie Plugins installieren können: selbst gehostet (wordpress.org) oder ein WordPress.com-Tarif, der Plugins erlaubt (Business oder höher)",
        "WordPress 5.6 oder neuer und PHP 7.4 oder neuer",
        "Ein Administratorkonto auf der WordPress-Website: Redakteure und Autoren können keine Plugins installieren und den RepGet-Bildschirm nicht sehen",
        "Ein aktiver Tarif für diese Website in RepGet",
        "Die Adresse Ihrer Website in RepGet (Einstellungen → Unternehmen) muss Ihrer WordPress-Adresse entsprechen, damit die Schaltflächen unten die richtige Website öffnen",
      ],
      steps: [
        {
          title: "Laden Sie das Plugin aus RepGet herunter",
          body: "Wählen Sie in RepGet oben im Umschalter Ihre Website, öffnen Sie dann Einstellungen → Integrationen und suchen Sie den Bereich WordPress-Plugin. Klicken Sie auf Plugin herunterladen. Gespeichert wird repget-connector.zip, etwa 35 KB. LASSEN SIE ES GEZIPPT: nicht entpacken und vorher nicht öffnen. Manche Browser (Safari auf dem Mac zum Beispiel) entpacken ZIP-Dateien automatisch, und das ist der häufigste Grund, warum die Installation danach scheitert.",
        },
        {
          title: "Installieren Sie es in WordPress",
          body: "Klicken Sie im selben Bereich auf Mein WordPress öffnen. Es öffnet Plugins → Neues Plugin hinzufügen → Plugin hochladen auf Ihrer eigenen Website (Sie können auch selbst dorthin gehen). Wählen Sie die Datei repget-connector.zip genau so, wie sie heruntergeladen wurde, klicken Sie auf Jetzt installieren und dann auf Plugin aktivieren.",
        },
        {
          title: "WordPress öffnet den RepGet-Bildschirm",
          body: "Nach dem Aktivieren landen Sie direkt auf dem Bildschirm des Plugins. Später finden Sie ihn als RepGet im linken Menü Ihres WordPress-Dashboards, zwischen Kommentare und Design, sowie über den Link Settings unter dem Plugin auf der Seite Plugins. Nur Administratoren sehen ihn, weil der Schlüssel steuert, was auf Ihrer Website veröffentlicht wird.",
        },
        {
          title: "Verbinden - Option A: in RepGet beginnen (empfohlen)",
          body: "Wechseln Sie zurück zum RepGet-Tab (Einstellungen → Integrationen → WordPress-Plugin). Die Karte zeigt, welchen RepGet-Arbeitsbereich Sie verbinden: Prüfen Sie, ob es der richtige ist. Klicken Sie auf WordPress verbinden: Der RepGet-Bildschirm öffnet sich in Ihrem WordPress und zeigt Finish connecting to RepGet. Klicken Sie darauf. Ihr Browser besucht kurz RepGet und kommt sofort zurück: RepGet übergibt den Schlüssel direkt an WordPress, er erscheint nie auf dem Bildschirm, es gibt nichts zu kopieren. Fragt WordPress zuerst nach der Anmeldung, melden Sie sich an und klicken Sie dann in RepGet auf WordPress erneut öffnen. Mit Plugin 1.6 wird stattdessen das Feld Integration Key ausgefüllt: Klicken Sie auf Save and connect. Hat Ihr Browser den neuen Tab blockiert, zeigt RepGet den Schlüssel mit Schlüssel kopieren: Fügen Sie ihn unter Advanced: use an Integration Key (Plugin 1.7) oder in das Feld Integration Key (1.6) ein und klicken Sie auf Save and connect.",
        },
        {
          title: "Verbinden - Option B: in WordPress beginnen",
          body: "Statt Option A, mit Plugin 1.7 oder neuer: Klicken Sie auf dem RepGet-Bildschirm in WordPress auf Connect to RepGet. Melden Sie sich bei RepGet an, falls gefragt, und zwar mit dem Konto, das auf dieser Website veröffentlichen soll. Die Seite Ihredomain mit RepGet verbinden? listet Ihre Websites mit dieser Domain und den Arbeitsbereich jeder Website; klicken Sie bei der richtigen auf Ihredomain verbinden. Sie kommen direkt zu WordPress zurück. Ist die Domain bei keiner Ihrer Websites eingetragen, sagt RepGet es Ihnen: Fügen Sie die Website zuerst hinzu, oder klicken Sie auf Anderes Konto verwenden.",
        },
        {
          title: "Wenn die Website mit einem anderen Konto verbunden war",
          body: "Beide Optionen fragen zuerst nach, wenn diese WordPress-Website mit einem anderen RepGet-Konto oder einer anderen Website verbunden ist: Die Schaltfläche lautet dann Ihredomain nach … verschieben, mit dem Arbeitsbereich, den Sie gewählt haben. Der Schlüssel des alten Kontos funktioniert erst dann nicht mehr, wenn die neue Verbindung funktioniert, und dieses Konto wird benachrichtigt. Ein erneutes Verbinden derselben Website fragt nicht nach.",
        },
        {
          title: "Prüfen Sie, ob Connected angezeigt wird, und mit dem richtigen Konto",
          body: "Der Bildschirm zeigt Connected to, gefolgt vom RepGet-Arbeitsbereich und Ihrer Domain. In RepGet müssen Sie nicht neu laden: Nach wenigen Sekunden wird die Karte grün und der Schritt zum Verbinden Ihrer Website ist abgehakt. Steht dort ein ANDERES Konto oder eine andere Website, klicken Sie in WordPress auf Connect to a different RepGet account (Plugin 1.7), oder im gewünschten Konto auf WordPress verbinden, und schließen Sie erneut ab: Die Verbindung, die WordPress speichert, entscheidet, welches Konto dort veröffentlicht.",
        },
        {
          title: "Wie die Artikel ankommen",
          body: "Ihr erster Artikel wird veröffentlicht, sobald er geschrieben ist. Danach sendet RepGet die Artikel gemäß Einstellungen → Artikeleinstellungen → Wenn ein Artikel fertig ist: zur Prüfung in RepGet behalten, am geplanten Tag als Entwurf gesendet oder am geplanten Tag live veröffentlicht. Ein Klick auf Veröffentlichen bei einem Artikel in RepGet veröffentlicht ihn sofort: RepGet bittet das Plugin, sofort nachzusehen (Plugin 1.4 oder neuer). Das Plugin sieht außerdem jede Stunde von selbst nach, und Check for articles now auf dem RepGet-Bildschirm in WordPress holt alles Fällige sofort ab.",
        },
        {
          title: "Ihre veröffentlichten Artikel finden",
          body: "Öffnen Sie in RepGet den Artikel: Ein veröffentlichter Artikel hat unter seinem Titel die Schaltfläche Auf Ihrer Website ansehen, und sein Verlauf zeigt den Link. Gehen Sie in WordPress zu Beiträge → Alle Beiträge: RepGet-Artikel sind normale Beiträge, die Sie bearbeiten, zurückziehen oder löschen können. Auf Ihrer Website erscheinen sie unter ihrer eigenen Adresse (zum Beispiel ihreseite.de/artikel-titel/, je nach Einstellungen → Permalinks) und in Ihrer Blogübersicht, also auf der Seite, die unter Einstellungen → Lesen → Beitragsseite gewählt ist.",
        },
      ],
      troubleshooting: [
        {
          problem: "„Das Paket konnte nicht installiert werden“",
          fix: "Die ZIP-Datei wurde unterwegs entpackt und neu gepackt, was manche Browser beim Herunterladen automatisch tun. Laden Sie sie erneut herunter und laden Sie die Datei genau so hoch, wie sie ankommt, ohne sie vorher zu öffnen.",
        },
        {
          problem: "Es gibt keine Schaltfläche Plugin hochladen",
          fix: "Ihr Konto ist kein Administratorkonto, oder die Website läuft mit einem WordPress.com-Tarif, der keine Plugins erlaubt.",
        },
        {
          problem: "„The key was rejected. Check it was copied in full.“",
          fix: "Eine einzige Meldung deckt bewusst alle Ursachen ab, damit jemand, der Schlüssel errät, aus der Antwort nichts lernt. Prüfen Sie drei Dinge der Reihe nach: Wurde der Schlüssel VOLLSTÄNDIG kopiert (eine unvollständige Kopie ist mit Abstand die häufigste Ursache)? Ist er noch AKTIV, oder wurde er in RepGet widerrufen? Ist es der Schlüssel für DIESE Website und nicht für eine andere Website in Ihrem Arbeitsbereich? Am schnellsten: Klicken Sie in RepGet auf WordPress verbinden und schließen Sie im WordPress-Tab ab, der sich öffnet.",
        },
        {
          problem: "Mein WordPress öffnen öffnet die falsche Website",
          fix: "Die in RepGet gespeicherte Website-Adresse ist nicht Ihre WordPress-Adresse. Korrigieren Sie sie unter Einstellungen → Unternehmen und klicken Sie dann erneut auf die Schaltfläche.",
        },
        {
          problem: "Ich sehe RepGet nicht im WordPress-Menü",
          fix: "Sie brauchen ein Administratorkonto. Redakteure und Autoren sehen es nicht, weil der Schlüssel steuert, was veröffentlicht wird.",
        },
        {
          problem: "Verbunden, aber es kommen keine Artikel an",
          fix: "Gesendet wird erst, wenn ein Artikel fällig ist. Prüfen Sie der Reihe nach: Ist die automatische Veröffentlichung in RepGet eingeschaltet? Ist das geplante Datum des Artikels erreicht? Ist der Artikel wirklich geschrieben (solange er noch geplant ist oder erstellt wird, noch nicht)? Um trotzdem sofort einen zu senden, öffnen Sie den Artikel in RepGet und klicken Sie auf Veröffentlichen, dann in WordPress auf Check for articles now.",
        },
        {
          problem: "Der Artikel ist abgeschnitten oder sieht aus wie eine Portfolio- oder Projektseite",
          fix: "Ihr Theme zeigt normale WordPress-Beiträge in einem anderen Layout als Ihren Blog (oft eine Portfolio- oder Projektseite mit einem kurzen Textbereich), sodass ein ganzer Artikel nicht hineinpasst. Stellen Sie auf dem RepGet-Bildschirm in WordPress Publish articles as auf den Inhaltstyp, den Ihre bisherigen Blogartikel verwenden (zum Beispiel Editorial), und klicken Sie auf Save (vor Plugin 1.7: Save and connect). Die Artikel, die RepGet bereits erstellt hat, werden ebenfalls dorthin verschoben, und RepGet erhält ihre neuen Adressen. Erfordert Plugin 1.5 oder neuer.",
        },
        {
          problem: "Artikel kommen als Entwurf statt als veröffentlichte Beiträge an",
          fix: "Einstellungen → Artikeleinstellungen → Wenn ein Artikel fertig ist steht auf Als Entwurf an meine Website senden, und genau das passiert. Wählen Sie Am geplanten Tag live veröffentlichen für künftige Artikel; bereits erstellte Entwürfe können Sie im Bildschirm Beiträge in WordPress veröffentlichen.",
        },
        {
          problem: "Ein Klick auf Veröffentlichen in RepGet meldet, der Artikel stehe in der Warteschlange",
          fix: "Ihre Website hat nicht geantwortet, als RepGet das Plugin um eine Prüfung bat, deshalb wartet der Artikel auf die stündliche Prüfung des Plugins. Meist ist das Plugin älter als 1.4.0: Laden Sie es erneut aus RepGet herunter und laden Sie es auf dieselbe Weise hoch (WordPress bietet an, die aktuelle Version durch die hochgeladene zu ersetzen; Ihr Schlüssel bleibt erhalten). Ab Plugin 1.7 bietet WordPress neue Versionen selbst unter Plugins an, wie bei jedem anderen Plugin. Andernfalls blockiert womöglich ein Sicherheits-Plugin oder eine Firewall Anfragen von außen an wp-admin/admin-ajax.php; erlauben Sie Anfragen mit action=repget_sync.",
        },
        {
          problem: "Artikel kommen mehr als eine Stunde nach Fälligkeit an",
          fix: "Das Plugin prüft stündlich von selbst, aber der Zeitplaner von WordPress läuft nur, wenn jemand Ihre Website besucht. Auf einer wenig besuchten Website findet die Prüfung daher verspätet statt. So funktioniert WordPress, das ist kein Fehler. Klicken Sie auf Check for articles now, um sofort abzuholen, oder bitten Sie Ihren Hoster, einen echten Cronjob einzurichten, wenn Ihnen der Zeitpunkt wichtig ist.",
        },
        {
          problem: "WordPress zeigt Connected, aber RepGet wartet noch",
          fix: "WordPress ist mit einem anderen Schlüssel verbunden, oft von einem anderen RepGet-Konto für dieselbe Website oder von einem früheren Test. Klicken Sie in dem RepGet-Konto, das Sie verwenden möchten, auf WordPress verbinden und schließen Sie im WordPress-Tab ab, der sich öffnet. Die Verbindung, die WordPress speichert, entscheidet, welches Konto auf der Website veröffentlicht. Sie müssen keinen alten Schlüssel suchen oder kopieren.",
        },
        {
          problem: "RepGet meldet, meine Website sei noch nicht in diesem Konto",
          fix: "Sie sind bei einem RepGet-Konto angemeldet, das keine Website mit dieser WordPress-Adresse hat. Klicken Sie auf Anderes Konto verwenden und melden Sie sich bei dem Konto an, das sie hat, oder fügen Sie die Website zuerst hinzu und klicken Sie in WordPress erneut auf Connect to RepGet. Die Website-Adresse in RepGet muss die WordPress-Adresse sein (mit oder ohne www., das ist egal). Läuft WordPress bewusst unter einer anderen Adresse (zum Beispiel blog.example.com für example.com), verbinden Sie es stattdessen mit einem Schlüssel: Öffnen Sie in RepGet Schlüssel (erweitert) und klicken Sie auf Neuer Schlüssel, fügen Sie ihn dann in WordPress unter Advanced: use an Integration Key ein und klicken Sie auf Save and connect.",
        },
        {
          problem: "„Diese Verbindung wurde woanders geöffnet“",
          fix: "Eine Verbindung lässt sich nur in dem Browser abschließen, der sie zuerst geöffnet hat. Ein Link, der in einen anderen Browser kopiert oder an eine andere Person geschickt wird, genehmigt also nichts. Gehen Sie zurück zu WordPress und klicken Sie erneut auf Connect to RepGet, in dem Browser, in dem Sie bei RepGet angemeldet sind.",
        },
        {
          problem: "Ich habe meinen Schlüssel verloren",
          fix: "Einen alten Schlüssel brauchen Sie nie wieder: Klicken Sie in RepGet auf WordPress verbinden und schließen Sie in WordPress ab. Ungenutzte Schlüssel werden automatisch entfernt, sobald WordPress verbunden ist. Damit eine Website nicht mehr veröffentlicht, klicken Sie in WordPress auf Disconnect (Plugin 1.7), oder öffnen Sie in RepGet Schlüssel (erweitert) und klicken Sie auf Widerrufen: Die Website erfährt es sofort.",
        },
      ],
    },
    wordpress: {
      name: "WordPress",
      summary:
        "Veröffentlichen Sie mit einem Anwendungspasswort direkt auf einer selbst gehosteten WordPress-Website. Kein Plugin nötig, aber lesen Sie die Plugin-Anleitung, wenn Ihr Hoster die REST-API blockiert.",
      requirements: [
        "Eine selbst gehostete WordPress-Website (wordpress.org, kein kostenloser wordpress.com-Tarif)",
        "Ein Konto darauf mit der Rolle Redakteur oder Administrator",
        "WordPress 5.6 oder neuer, die Version, mit der Anwendungspasswörter kamen",
      ],
      steps: [
        {
          title: "Öffnen Sie Ihr WordPress-Profil",
          body: "Melden Sie sich bei WordPress an und gehen Sie zu Benutzer → Profil. Wenn Sie mehrere Konten verwalten, nehmen Sie das, unter dem die Artikel erscheinen sollen: Dieses Konto wird bei jedem Beitrag als Autor angezeigt.",
        },
        {
          title: "Erstellen Sie ein Anwendungspasswort",
          body: "Scrollen Sie auf dieser Seite ganz nach unten zu Anwendungspasswörter. Geben Sie einen Namen ein, den Sie später wiedererkennen, etwa RepGet, und klicken Sie auf Neues Anwendungspasswort hinzufügen.",
        },
        {
          title: "Kopieren Sie das Passwort genau",
          body: "WordPress zeigt es nur einmal an, in Gruppen mit Leerzeichen dazwischen. Kopieren Sie es vollständig, einschließlich der Leerzeichen: Es ist nicht Ihr Anmeldepasswort, und Ihr Anmeldepasswort funktioniert hier nicht.",
        },
        {
          title: "Verbinden Sie es hier",
          body: "Öffnen Sie in RepGet Einstellungen → Integrationen und wählen Sie WordPress. Geben Sie Ihre Website-Adresse, Ihren WordPress-Benutzernamen und das eben kopierte Anwendungspasswort ein.",
        },
        {
          title: "Veröffentlichen Sie einen Testartikel",
          body: "Klicken Sie auf Testartikel veröffentlichen. Wir legen einen echten Entwurf auf Ihrer Website an und geben Ihnen einen Link dazu. Wenn das klappt, klappen auch geplante Artikel, und den Entwurf können Sie bedenkenlos löschen.",
        },
      ],
      troubleshooting: [
        {
          problem: "Anwendungspasswörter fehlt auf der Profilseite",
          fix: "Der Abschnitt ist ausgeblendet, wenn WordPress nicht über HTTPS ausgeliefert wird, und bei manchen Managed-Hostern, die ihn abschalten. Prüfen Sie zuerst, ob die Website über https:// lädt, und fragen Sie dann Ihren Hoster, ob die REST-API aktiviert ist.",
        },
        {
          problem: "WordPress meldet, dass Sie keine Beiträge erstellen dürfen",
          fix: "Das Konto meldet sich an, darf aber nicht veröffentlichen. Geben Sie ihm die Rolle Redakteur oder Administrator: Autor reicht nicht für alles, was wir tun.",
        },
        {
          problem: "Ein Sicherheits-Plugin blockiert die Verbindung",
          fix: "Wordfence, iThemes und ähnliche Plugins können Anfragen an die REST-API blockieren. Erlauben Sie /wp-json/wp/v2/ für authentifizierte Anfragen, oder erlauben Sie gezielt unsere.",
        },
      ],
    },
    ghost: {
      name: "Ghost",
      summary: "Veröffentlichen Sie mit einem Admin-API-Schlüssel auf einem Ghost-Blog.",
      requirements: ["Eine Ghost-Website, die Sie verwalten, selbst gehostet oder auf Ghost(Pro)", "Ghost 4.0 oder neuer"],
      steps: [
        { title: "Öffnen Sie die Integrations-Einstellungen", body: "Gehen Sie im Ghost-Admin zu Settings → Advanced → Integrations." },
        {
          title: "Fügen Sie eine eigene Integration hinzu",
          body: "Wählen Sie Add custom integration und nennen Sie sie RepGet. Ghost zeigt dann einen Content API key und einen Admin API key.",
        },
        {
          title: "Kopieren Sie den ADMIN-Schlüssel",
          body: "Nehmen Sie den Admin API key, nicht den Content API key. Er sieht aus wie zwei Werte, die durch einen Doppelpunkt verbunden sind: Kopieren Sie die ganze Zeichenfolge samt Doppelpunkt. Der Content-Schlüssel kann nur lesen und scheitert deshalb bei der ersten Veröffentlichung.",
        },
        {
          title: "Verbinden Sie ihn hier",
          body: "Öffnen Sie in RepGet Einstellungen → Integrationen, wählen Sie Ghost und geben Sie die Adresse Ihrer Ghost-Website zusammen mit dem Admin API key ein.",
        },
        { title: "Veröffentlichen Sie einen Testartikel", body: "Klicken Sie auf Testartikel veröffentlichen. Wir legen in Ghost einen Entwurf an und geben Ihnen einen Link dazu." },
      ],
      troubleshooting: [
        {
          problem: "„Invalid token“ oder 401 beim Verbinden",
          fix: "Fast immer ist es der Content API key statt des Admin-Schlüssels. Der Admin-Schlüssel enthält einen Doppelpunkt, der Content-Schlüssel nicht.",
        },
        {
          problem: "Die Website-Adresse wird abgelehnt",
          fix: "Verwenden Sie die Adresse Ihres Ghost-Admins ohne Pfad am Ende: https://example.com, nicht https://example.com/ghost.",
        },
      ],
    },
    shopify: {
      name: "Shopify",
      summary: "Veröffentlichen Sie Artikel in einem Blog Ihres Shopify-Shops.",
      requirements: [
        "Ein Shopify-Shop, der Ihnen gehört oder den Sie als Mitarbeiter verwalten",
        "Die Berechtigung, in diesem Shop eine eigene App zu erstellen",
        "Mindestens ein Blog unter Online Store → Blog posts",
      ],
      steps: [
        {
          title: "Erlauben Sie die Entwicklung eigener Apps",
          body: "Gehen Sie im Shopify-Admin zu Settings → Apps and sales channels → Develop apps. Beim ersten Mal klicken Sie auf Allow custom app development und bestätigen.",
        },
        { title: "Erstellen Sie die App", body: "Klicken Sie auf Create an app, nennen Sie sie RepGet und öffnen Sie dann Configuration → Admin API integration." },
        {
          title: "Erteilen Sie die Blog-Berechtigungen",
          body: "Aktivieren Sie write_content und read_content. Diese beiden reichen zum Erstellen und Aktualisieren von Blogartikeln; mehr ist nicht nötig, und mehr als nötig zu erteilen, sollte man vermeiden.",
        },
        {
          title: "Installieren Sie die App und kopieren Sie das Token",
          body: "Klicken Sie auf Install app und lassen Sie sich das Admin API access token anzeigen. Shopify zeigt es nur einmal. Es beginnt mit shpat_.",
        },
        {
          title: "Verbinden Sie es hier",
          body: "Öffnen Sie in RepGet Einstellungen → Integrationen, wählen Sie Shopify, geben Sie Ihre Shop-Adresse (example.myshopify.com) und das Zugriffstoken ein und wählen Sie den Blog, in dem veröffentlicht werden soll.",
        },
      ],
      troubleshooting: [
        {
          problem: "In der Liste erscheint kein Blog",
          fix: "Shopify-Shops starten ohne Blog. Legen Sie unter Online Store → Blog posts → Manage blogs einen an und verbinden Sie erneut.",
        },
        {
          problem: "„Access denied“ beim Veröffentlichen",
          fix: "Dem Token fehlt write_content. Öffnen Sie die App-Konfiguration erneut, fügen Sie es hinzu und installieren Sie die App neu: Eine Änderung der Berechtigungen erzeugt ein neues Token.",
        },
      ],
    },
    webflow: {
      name: "Webflow",
      summary: "Veröffentlichen Sie mit einem Site API token in eine CMS-Collection Ihrer Webflow-Website.",
      requirements: [
        "Eine Webflow-Website mit kostenpflichtigem Tarif: Die CMS-API gibt es im kostenlosen Tarif nicht",
        "Eine CMS-Collection für Ihren Blog mit einem Rich-Text-Feld für den Text",
        "Die Berechtigung, auf dieser Website API-Tokens zu erstellen",
      ],
      steps: [
        {
          title: "Erstellen Sie ein Site API token",
          body: "Öffnen Sie in Webflow Site settings → Apps & integrations → API access und dann Generate API token. Geben Sie ihm CMS-Lese- und -Schreibrechte: Ein Token, das nur lesen darf, verbindet sich problemlos und scheitert dann bei der ersten Veröffentlichung.",
        },
        { title: "Kopieren Sie das Token", body: "Webflow zeigt es nur einmal. Kopieren Sie den vollständigen Wert, bevor Sie das Fenster schließen." },
        {
          title: "Finden Sie die ID Ihrer Blog-Collection",
          body: "Öffnen Sie die Collection im Designer. Die ID ist der letzte Teil der URL, eine lange Folge aus Buchstaben und Zahlen.",
        },
        {
          title: "Verbinden Sie es hier",
          body: "Öffnen Sie in RepGet Einstellungen → Integrationen, wählen Sie Webflow und geben Sie das Token und die Collection-ID ein. Bevor wir sie annehmen, prüfen wir, ob die Collection einen Platz für den Text eines Artikels hat.",
        },
        {
          title: "Veröffentlichen Sie einen Testartikel",
          body: "Klicken Sie auf Testartikel veröffentlichen. Wir legen ein echtes Element in der Collection an, damit Sie prüfen können, ob es dort landet, wo Sie es erwarten.",
        },
      ],
      troubleshooting: [
        {
          problem: "„That collection has no rich text field“",
          fix: "Eine Webflow-Collection ist das, was der Designer der Website gebaut hat, und ein Artikel braucht einen Platz für seinen Text. Fügen Sie der Collection ein Rich-Text-Feld hinzu, oder nennen Sie uns Ihre Blog-Collection statt einer anderen.",
        },
        {
          problem: "Der Artikel erscheint nicht auf der Live-Website",
          fix: "Über die API erstellte Webflow-Elemente gehen erst live, wenn die Website veröffentlicht wird. Klicken Sie im Designer auf Publish, oder schalten Sie das automatische Veröffentlichen für die Collection ein.",
        },
        {
          problem: "„That token cannot write to the CMS“",
          fix: "Das Token wurde ohne cms:write erstellt. Tokens lassen sich nach dem Erstellen nicht ändern: Erzeugen Sie ein neues mit beiden CMS-Berechtigungen.",
        },
      ],
    },
    wix: {
      name: "Wix",
      summary: "Veröffentlichen Sie mit einem API-Schlüssel im Blog Ihrer Wix-Website.",
      requirements: ["Eine Wix-Website mit installierter Blog-App", "Inhaber- oder Admin-Zugang, damit Sie API-Schlüssel erstellen können"],
      steps: [
        { title: "Öffnen Sie die Seite für API-Schlüssel", body: "Gehen Sie im Wix-Dashboard zu Settings → API keys und dann zu Generate API key." },
        {
          title: "Geben Sie ihm Blog-Berechtigungen",
          body: "Weisen Sie eine Rolle zu, die Blog enthält: Ohne sie meldet sich der Schlüssel an, kann aber keine Beiträge erstellen.",
        },
        {
          title: "Kopieren Sie den Schlüssel und die Site ID",
          body: "Der Schlüssel wird nur einmal angezeigt. Die Site ID steht auf demselben Bildschirm neben der Website. Beides wird gebraucht: Einem Wix-Konto können mehrere Websites gehören, der Schlüssel allein sagt also nicht, welche.",
        },
        {
          title: "Verbinden Sie ihn hier",
          body: "Öffnen Sie in RepGet Einstellungen → Integrationen, wählen Sie Wix und geben Sie beide Werte ein. Wir listen Ihre vorhandenen Beiträge auf, um zu bestätigen, dass der Schlüssel den Blog erreicht.",
        },
      ],
      troubleshooting: [
        {
          problem: "„Wix could not find that site, or the site has no blog“",
          fix: "Entweder gehört die Site ID zu einer anderen Website, oder die Blog-App ist nicht installiert. Fügen Sie Blog aus dem Wix App Market hinzu und versuchen Sie es erneut.",
        },
        {
          problem: "Der Artikeltext erscheint im Editor als ein einziger Block",
          fix: "Das ist so vorgesehen. Wix speichert formatierte Inhalte in einem eigenen Format; wir senden den Artikel als einen einzigen HTML-Block, der auf der veröffentlichten Seite richtig dargestellt wird, beim Bearbeiten aber als ein eingebettetes Element erscheint.",
        },
      ],
    },
    webhook: {
      name: "Eigener Webhook",
      summary: "Senden Sie fertige Artikel an jeden Endpoint, den Sie kontrollieren, für Plattformen, die wir nicht direkt unterstützen.",
      requirements: [
        "Ein HTTPS-Endpoint, der einen POST mit JSON-Body annimmt",
        "Ein Ort, an dem Sie das Signatur-Secret aufbewahren, um Anfragen zu prüfen",
      ],
      steps: [
        {
          title: "Bauen Sie einen Endpoint",
          body: "Nehmen Sie einen POST mit einem JSON-Body an, der Titel, HTML-Text, Slug, Auszug und Status enthält. Antworten Sie mit 2xx, sobald Sie ihn gespeichert haben; jede andere Antwort gilt als Fehler und wird erneut versucht.",
        },
        {
          title: "Verbinden Sie ihn hier",
          body: "Öffnen Sie in RepGet Einstellungen → Integrationen, wählen Sie Custom (webhook) und geben Sie die Endpoint-URL und ein selbst erzeugtes Signatur-Secret ein.",
        },
        {
          title: "Prüfen Sie die Signatur",
          body: "Jede Anfrage enthält einen HMAC-SHA256 des unveränderten Bodys, berechnet mit Ihrem Signatur-Secret. Vergleichen Sie ihn, bevor Sie dem Inhalt vertrauen: Ein Endpoint, der das auslässt, nimmt alles an, was ihm irgendjemand schickt.",
        },
        {
          title: "Veröffentlichen Sie einen Testartikel",
          body: "Klicken Sie auf Testartikel veröffentlichen, um einen echten Inhalt zu senden und zu prüfen, ob Ihr Code ihn verarbeitet, bevor ein geplanter Artikel ankommt.",
        },
      ],
      troubleshooting: [
        {
          problem: "Anfragen werden wiederholt",
          fix: "Jede Antwort außer 2xx werten wir als Fehler. Antworten Sie mit 200, sobald der Inhalt gespeichert ist, und erledigen Sie langsamere Arbeit danach.",
        },
        {
          problem: "Die Signatur stimmt nie",
          fix: "Berechnen Sie den HMAC über den UNVERÄNDERTEN Body der Anfrage, vor dem Parsen des JSON. Wer das Objekt neu serialisiert, verändert die Bytes, und die Signatur stimmt nie überein.",
        },
      ],
    },
  },
};
