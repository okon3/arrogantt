# Plan

## Cosa resta sul tavolo

Goal D, E, F, G e H sono **chiusi, recensiti e potati**; le loro Accept lines
sono cadute dopo la review, come vuole la regola. Ultima release **`v1.5`**;
i bullet di H (figura per il cliente: nessuna colonna, nessun task
disattivato) aspettano sotto `## Unreleased` — scelta dell'utente, il badge
resta a v1.5 e il rilascio si fa quando serve distribuire una build.
**Goal I** (descrizione per task) e' **avviato**: domande di prodotto tutte
chiuse, suddivisione rivista sulla ricognizione del 2026-09-21, I1 committato.
Restano I2 (textarea), I3 (CSV e agent API) e I4 (docs e changelog).
`## Maintenance` porta T16 (audit mobile) e T17 (nome del task in hover);
Goal C aspetta quel report prima di ricevere task veri. **Goal J** (task
completato come misura della stima) ha le domande di prodotto chiuse ma e'
**sospeso dall'utente**: materiale pronto per un'analisi di dettaglio piu'
avanti, non lavoro in corso. **Goal K** (polish di UI/UX) e' aperto e in corso: K1, K2,
K10, K3 e K11 chiusi, restano K12, K4-K9 e K13. **Le due barre ora stanno su
`--surface-sunken`**: chi tocca un controllo che vive li' sopra ha un fondo
diverso da quello per cui era stato dipinto.

**Trappola di misura, costata un falso negativo**: `ChangelogDialog` rende
`className="help"` (`ChangelogDialog.tsx:10`) — un dialogo "changelog" nel DOM
non si trova per nome, si misura sul contenuto.

## Goal C — valutazione mobile-friendly                    [aperto, senza task]
Agevolare la visualizzazione da smartphone/tablet nascondendo le azioni
superflue; non tutto deve funzionare da mobile.

**Guardia di T32, scritta qui prima di partire**: questo goal **non ha e non
deve avere** come unico task un'analisi. T16 consegna un report e vive sotto
`## Maintenance`; alla sua chiusura nessuna goal review deve scattare, perche'
scatterebbe su un diff inesistente — il buco in cui e' caduta la review di
Goal B. Il goal si apre davvero, con le fette che l'utente compra dal report,
e **solo allora** riceve task implementativi e una review.

Misurato di passaggio dal critic di F5a, e da non ri-supporre: il dialogo
People a 728px **non sfonda** sotto i 776px di viewport (dove
`width: min(var(--dialog-width), calc(100vw - 48px))` inizia a stringere) —
`table-layout: fixed` comprime solo la colonna Name, fino a 0px a ~452px di
spazio disponibile, con `scrollWidth === clientWidth` su tutto l'intervallo
provato. Degrada, non si rompe.

Preesistente e misurato, da guardare **tutto insieme** se qualcuno lo segnala
(critic di T65a): il bottone «Fit» della `.statusbar` fa traboccare il
documento gia' a 768px di viewport (bordo destro 955px su 768 di
`clientWidth`), in empty state. Non e' un difetto del rename e sotto la regola
dell'80% non vale un meccanismo da solo — ma e' il primo indizio che il goal
raccogliera'.

## Goal I — un task puo' dire piu' del suo titolo                   [aperto]
Ogni task porta una **descrizione** libera, per veicolare quello che il titolo
da solo non regge. Aperto dall'utente il 2026-09-21.

**Deciso dall'utente, non da riaprire.**
- Il campo vive nel **modal di dettaglio** del task (`TaskDialog.tsx`), e
  tanto basta: non e' richiesta nessun'altra superficie.
- Vale **anche per i raggruppamenti** (summary), non solo per le foglie.

**Risposte dell'utente, 2026-09-21 — chiuse.**
- **La descrizione non ha nessuna superficie nel grafico**, e va bene cosi'.
  Niente icona di riga, niente tooltip: si legge aprendo il modal, oppure
  da CSV e dall'agent API. Chiesto due volte e confermato due volte — **una
  goal review che lo segnala come MISSING sta segnalando una scelta**, non
  una dimenticanza.
  (Il tooltip che l'utente ha chiesto nella stessa conversazione riguarda il
  **nome** del task, non la descrizione: e' in `## Maintenance`, T17.)
- **Agent API: si'** — «potrebbe dare informazioni utili all'agente». Quindi
  `agentApi.help.md` va aggiornato **nello stesso commit**: e' anche
  `arrogantt.help()` e `/llms.txt`, e non se ne fa una seconda copia.
- **CSV: si'. Figura e stampa: no.** (`planCsv.ts` rientra quindi nello scope
  di questo goal, a differenza di Goal H.)
- **Limite 2000 caratteri**, in una **textarea**, testo senza formattazione.

**Misurato il 2026-09-21 (due Explore), non piu' da supporre.**
- **Il CSV gia' regge i newline**: `escape` (`planCsv.ts:59-62`) quota su
  `/[;"
]/` e raddoppia le virgolette — RFC4180, nessuna sostituzione del
  newline. La superficie CSV e' quindi una voce in `HEADERS`
  (`planCsv.ts:25-40`) e una in `row()` (`planCsv.ts:64-85`), non un task.
  **Trappola nei test, non nel codice**: l'helper `csvOf`
  (`planCsv.test.ts:14`) splitta le righe con `.split('
')` ignorando il
  quoting — una fixture con descrizione multi-riga lo rompe. `columns()`
  (righe 25-39) invece lo stato quoted lo tiene gia'.
- **Il limite di 2000 vive in due posti, con due comportamenti diversi.**
  Nel parsing **rifiuta** (dottrina del formato: rifiuta, non ripara), con il
  precedente esatto di `validateCurrency` (`cost.ts:64-79`, `length > 8`).
  Nella textarea **non tronca**: scelta dell'utente del 2026-09-21, niente
  `maxLength`, e' `save()` a rifiutare con un messaggio nello stato `error`
  che `TaskDialog` gia' possiede (`TaskDialog.tsx:47`, `save()` 49-82) —
  nessun testo incollato sparisce in silenzio.
- **Il pattern «vuoto = assente» esiste gia' e va copiato, non inventato**:
  `if (typeof record.x === 'string' && record.x.length > 0) task.x = record.x`
  (`serialization.ts:288`, `parentId`). E il file lo scrive da solo:
  `serializeProject` spande `...task` (`serialization.ts:91`), quindi il
  parser e' **l'unico** punto di difesa — esattamente come per `disabled`.
- **Il campo non si ferma al modello.** `getTask` spande `...rest` da
  `details(id)` (`agentApi.ts:240-243`): compare da solo nella risposta, ma
  solo se sta su `TaskDetails` (`ganttHandle.ts:114-147`). Il giro completo
  passa quindi per `TaskDetails`, `TaskPatch` (`ganttHandle.ts:148-160`) e
  `NewTask` (`ganttHandle.ts:10-25`) — la mappa riga del chart.
- **Nel repo non esiste nessuna `<textarea>`** (solo `HTMLTextAreaElement` in
  `shortcuts.ts:18`, che gia' spegne le scorciatoie sul focus). Il primo
  controllo del genere porta CSS strutturale: riavviare il dev server prima
  di credere a un verdetto negativo.

**Fatto verificato il 2026-09-21, che risparmia un round.** `ProjectTask`
(`project.ts:30-48`) tiene `disabled?: boolean` con una regola scritta nel
commento: **si conserva solo `true`**, perche' l'assenza e' lo stato di
default e un `false` scritto in un file o in uno snapshot sarebbe una seconda
grafia su cui il confronto di `dirty` litigherebbe. Una `description?: string`
ha **esattamente** la stessa trappola: `''` e assente devono essere una cosa
sola, o salvare-riaprire sporca il progetto senza che nessuno abbia toccato
niente. Vale per il parsing strict, per `serializeProject` e per il gate di
`serializeForFile`.

**Versione del formato: nessun bump, e la riga precedente era un equivoco.**
`FILE_VERSION = 2` (`serialization.ts:16`) e' un intero controllato **solo
come tetto** in lettura (righe 175-182): alzarlo a 3 non segnalerebbe un
campo in piu', farebbe **rifiutare il file alle build precedenti**. Il «bump
minore» di `CLAUDE.md` e' la versione **dell'app** nel changelog (v1.5 →
v1.6), non quella del formato. Il file resta v2.

**Suddivisione rivista sulla ricognizione del 2026-09-21.** La provvisoria
diceva cinque fette `[impl]`; la misura ne ha cambiate due. I3 e I4 si
fondono (due superfici additive non valgono due ingressi da 40k), e I1 passa
a **deep**: tocca il gate strict di `serializeForFile` e la derivazione di
`dirty`, ed e' la forma esatta dell'errore di F1 registrato nel binding — una
corsia che copia la forma di un predicato vicino invece del predicato piu'
stretto.
- [x] I1 [deep] — Il campo nel modello, nel formato e nella mappa riga.
      **Accept**: round-trip di una descrizione multi-riga identico;
      `"description": ""` in ingresso da' un task con `'description' in task`
      falso e un round-trip che non contiene la stringa `description`;
      assente resta assente; 2000 caratteri passano e 2001 lanciano
      `ProjectFileError`; un tipo sbagliato lancia; `serializeForFile`
      ri-apre un file con 2000 caratteri e newline dentro. `FILE_VERSION`
      resta 2. Tre check verdi. — commit 3eaa6bf
- [ ] I2 [impl] — La textarea nel `TaskDialog`, summary inclusi, col giro
      completo edit → modello → `applySolution`; oltre 2000 `save()` rifiuta
      con `error`, nessun `maxLength`. Verifica nel browser.
      **Quattro vincoli misurati dal critic di I1, da mettere nel brief.**
      (a) Senza il rifiuto in `save()` l'app costruisce un progetto che non
      sa salvare: misurato, 2001 caratteri nel modello passano
      `serializeProject` (undo e draft intatti) e fanno lanciare
      `serializeForFile` — Save rifiuta, non scrive niente e resta dirty,
      con l'unico rimedio di accorciare a mano un testo che la UI aveva
      accettato. E' il motivo per cui il rifiuto e' **al salvataggio** e non
      al parsing soltanto.
      (b) `DESCRIPTION_LIMIT` (`serialization.ts:163`) **non e' esportato**:
      I2 lo esporta e lo importa, non riscrive un secondo 2000.
      (c) Il limite conta unita' **UTF-16** (`.length`): 1001 emoji fanno
      2002 e vengono rifiutate. Il conteggio di I2 deve usare `.length` come
      il parser, o il limite diventa due numeri diversi.
      (d) `history.ts:99` — `OWN_FIELDS` non include `description`: senza
      quella riga una modifica alla sola descrizione e' annullabile
      (lo snapshot e' il testo intero) ma il bottone dice «Undo last change»
      invece di «Undo edited "X"».
- [ ] I3 [impl] — Il campo esce dall'app: colonna CSV (`planCsv.ts`) e agent
      API (`getTask`, `updateTask`, `TaskInput`), con `agentApi.help.md`
      nello stesso commit. **No** figura, **no** stampa.
      **Gia' fatto da I1, da non rifare**: `getTask()` restituisce gia' la
      descrizione — `TaskInfo` deriva da `TaskDetails` e lo spread `...rest`
      la porta fuori da solo (`agentApi.ts:241-242`). Manca **solo** la
      scrittura (`TaskInput` + `updateTask`) e la documentazione. `help.md`
      non era dovuto in I1: la riga 46 descrive `getTask(id)` come «one task
      in full» senza elencare i campi, quindi il diff non ha reso falsa
      nessuna frase.
      **Da fissare con un test in I3**: che `getTask()` **ometta la chiave**
      su un task senza descrizione, invece di renderla `undefined`. E' la
      correzione che I1 ha applicato dopo il critic e che nessun test morde
      oggi — `agentApi.test.ts` non passa per `GanttChart.getTaskDetails`.
      **Trappola nei test del CSV**: `csvOf` (`planCsv.test.ts:14`) splitta
      le righe con `.split('
')` ignorando il quoting — una fixture con
      descrizione multi-riga lo rompe. `escape` (`planCsv.ts:59-62`) invece
      il newline lo regge gia'.
- [ ] I4 [self] — `docs/view.md` e il bullet di changelog.
      `docs/file-format.md` **e' gia' fatto**: il campo e i due rifiuti del
      parsing strict sono entrati nel commit di I1, perche' e' quello che ha
      cambiato il formato.

**Conseguenza da proporre, non da fare dentro questo goal**: S5b (unificare
la mappa riga) e' in giacenza «finche' un goal non aggiunge campi di riga»
— Goal I ne aggiunge uno. Diventa proponibile alla chiusura del goal, non
prima, e resta corsia deep.

## Goal J — un task completato misura la stima         [sospeso dall'utente]
Un task si puo' marcare **completato**, e quello e' l'unico caso in cui la
**fine la dichiara l'utente** invece di derivarla. Il task resta un peso sul
passato (occupa capacita', i successori ne dipendono) e diventa il materiale
per confrontare la stima iniziale con il consuntivo. Aperto dall'utente il
2026-09-21.

**Il punto che riconcilia la proposta con l'invariante.** La fine dichiarata
non e' un input «data di fine»: e' **una misura dell'effort effettivo espressa
nell'unita' che l'utente conosce**, il giorno in cui ha finito. Per un task
completato si **inverte la freccia** — la fine e' l'input, l'effort e' il
derivato — e si usa la stessa legge di conservazione del motore
(`Σ rate × durata = effort`) letta al contrario. Un task completato **smette
di essere un problema di scheduling e diventa un record**: non si schedula, si
rigioca, occupando capacita' come blocco fisso mentre il simulatore schedula
il resto attorno. E' la stessa forma di «un summary non si schedula mai».

**Risposte dell'utente, 2026-09-21 — chiuse.**
- **Lo stato e' la data, non un flag.** Un task e' completato **se e solo se**
  porta una fine effettiva: il campo che porta l'informazione *e'* lo stato.
  Niente `completed` boolean, niente `progress === 1` portante — nessuna
  doppia grafia e nessuna combinazione impossibile da rifiutare nel parsing.
  Scompletare = cancellare la data.
- **Il confronto e' elapsed previsto contro elapsed effettivo**, non effort
  contro effort. «Il piano diceva 10 giorni lavorativi, ne sono serviti 7»:
  una sola unita', nessuna inversione. La domanda iniziale dell'utente
  (confrontare i 5gg stimati) e' **rientrata** per la ragione sotto.

**Perche' l'inversione a effort e' stata scartata, e va ricordato.** La fine
da' l'*elapsed*; per risalire all'effort si divide per il tasso, che e'
esattamente la grandezza incerta. «Previsti 10, effettivi 7» puo' voler dire
che il task era da 3,5 giorni-persona invece di 5, **oppure** che la persona
era al 70% invece che al 50%: stesso numero, lezione opposta, e dalla sola
data le due non si separano. L'inversione sarebbe esatta solo sui task non
condivisi — e lo scheduler gia' lo sa (`scheduler/types.ts:85`:
`elapsedWorkingMinutes` «exceeds `effort` whenever the task was shared»,
e `planCsv.ts:35` ha gia' la colonna `Contended`). Se un giorno si volesse
riaprire, e' li' che si guarda.

**Misurato il 2026-09-21, prima di scrivere qualunque cosa.**
- **Lo scheduler non legge mai `progress`**: zero occorrenze in
  `src/scheduler/` (le tre che un grep trova sono la parola dentro commenti).
  Nel modello `progress?: number` esiste (`project.ts:44`) e una fixture porta
  gia' `progress: 1`. **«Completato al 100%» e' quindi gia' scrivibile oggi ed
  e' gia' inerte**: un boolean `completed` accanto sarebbe una seconda grafia
  dello stesso stato, contro la regola che il repo applica a `disabled` e a
  `description`.
- Nel modello **non esiste nessun campo `end`**: la fine e' solo un'uscita
  dello scheduler.

**Due conseguenze che non sono gratis.**
- **Completare pinna anche l'inizio.** Lo start e' derivato salvo vincolo; un
  task completato il cui predecessore si sposta slitterebbe trascinandosi
  dietro una fine *registrata*. Il flag fa due cose, non una — implica un
  `constraintStart`.
- **`Σ(rate × duration) = effort` va riscritta.** Per un task completato il
  membro destro e' l'effort **effettivo**, non la stima. CLAUDE.md la dichiara
  assoluta: cambiarla e' un atto deliberato da scrivere in chiaro, non un
  effetto collaterale da scoprire.

**Domande ancora aperte — nessuna e' decisa, nessuna e' binding.**
- **Il termine di paragone si ricalcola sempre** (utente, 2026-09-21).
  Nessun derivato conservato, come vuole la dottrina del repo — il blocco
  `solved` nel file e' ignorato in lettura. Conseguenza **accettata
  sapendola**: il confronto e' retroattivo, e correggere il passato cambia da
  sola la varianza di un task gia' chiuso («con quello che so oggi ne
  sarebbero serviti 12; ne hai impiegati 7»).
- **Il confronto si legge nel modal del task, e in nessun altro posto**
  (utente, 2026-09-21). E' dove si inserisce la fine effettiva, quindi la
  varianza sta accanto al campo che la produce. **Colonna in griglia, CSV,
  figura e stampa: offerti e rifiutati**, la colonna anche contro la
  raccomandazione dell'hub (il registro di Goal F l'avrebbe resa economica).
  **Una goal review che li segnala come MISSING sta segnalando una scelta.**
  Se un giorno servisse vedere la varianza di tutti i task insieme — l'unico
  modo di accorgersi di una sottostima **sistematica** — la colonna e' il
  candidato, e si riapre con l'utente, non dentro questo goal.
- **Cosa succede a un task completato senza risorsa** (tasso pieno) e **a una
  milestone completata** (effort zero: la fine e' tutto cio' che c'e').
- **Il giorno dichiarato e' un giorno lavorativo?** Vale la regola del
  confine di giornata; una fine su un giorno chiuso va normalizzata o
  rifiutata, come gia' fa lo start dichiarato.

**Dove costa davvero, e non e' dove sembra.** Il modello guadagna **un solo
campo**: una fine effettiva opzionale. Tutto il resto e' motore, ed e' li' il
prezzo:
- il simulatore deve trattare un task completato come **occupazione fissa**
  sull'asse dei minuti lavorativi — non lo schedula, ci schedula attorno;
- «ricalcola sempre» vuol dire che la previsione da confrontare va prodotta
  da una **seconda passata**, che schedula il task *come se non fosse
  completato* per ottenere il 10 da mettere accanto al 7. Non e' un numero
  gratis e non e' `effort / tasso`: il tasso dipende dalla concorrenza, che
  dipende dalla schedulazione. E' il primo nodo che la spec deve sciogliere.

**Restano tecniche, non di prodotto** (le decide la spec): un task completato
**senza risorsa** (tasso pieno), una **milestone completata** (effort zero: la
fine e' tutto cio' che c'e'), e una fine dichiarata su un **giorno non
lavorativo** — vale la regola del confine di giornata, e la si normalizza o
la si rifiuta come gia' fa lo start dichiarato.

**Sospeso dall'utente il 2026-09-21**, subito dopo averne chiuso le domande:
«la gestione della chiusura di un'attivita' e' piu' complessa del previsto»,
l'analisi di dettaglio si fa in un secondo momento. Quanto sta scritto qui
sopra e' **materiale pronto**, non lavoro in corso: nessun task, nessuna
corsia, e **niente parte da qui senza che l'utente lo riapra**.

**Quando si riaprira': nessuna suddivisione, le scrive la spec.** Le domande
di prodotto sono **chiuse**; il goal e' pronto per una spec `architect`,
obbligatoria perche' tocca il motore e riscrive un invariante che CLAUDE.md
dichiara assoluto. La spec deve sciogliere, in quest'ordine: la seconda
passata che produce il termine di paragone, l'occupazione fissa nel
simulatore, la riscrittura dell'invariante di conservazione, e solo dopo
proporre le fette.

## Goal K — sembrare uno strumento, non un prototipo            [aperto]
Una passata di miglioramento e polish su UI e UX: far sembrare l'app
**professionale**, organizzare le voci dei menu invece di lasciarle sparse,
rendere la visualizzazione piu' **crisp**, e distinguere meglio i task
disattivati dagli altri. Aperto dall'utente il 2026-09-21.

**Le tre richieste sono dell'utente, alla lettera. Nessuna e' ancora un
difetto misurato**, ed e' la distinzione che decide come si apre questo goal:
un goal visivo che parte da aggettivi costruisce il gusto di chi implementa,
non la mancanza che l'utente vede.

**La regola che governa tutto il goal, e che qui vale piu' che altrove.**
`CLAUDE.md`, *How good is good enough*: su qualunque cosa visiva il bersaglio
e' **~80% della precisione ottenibile**; l'ultimo 20% ha bisogno di una
ragione propria, e «la soglia esiste» non lo e'. Il precedente e' T22: si
chiese WCAG AA su iniziali da 24px e il difetto vero era un velo al 55% che
le lavava via — alzarlo a 85% costo' un carattere e recupero' quasi tutta la
leggibilita'. **Quando un numero e il difetto visibile non concordano, si
corregge il difetto.**

**Misurato il 2026-09-21, a tavolino, prima di aprire qualunque fetta.**
- **Task disattivati — c'e' un'asimmetria concreta, non solo un'impressione.**
  La *barra* ha due trattamenti: `opacity: 0.45` **piu'** `filter:
  saturate(0.3)` (`gantt.css:346-349`, col commento che spiega perche' la sola
  opacita' non bastava). La *riga in griglia* ne ha **uno solo, e su una sola
  colonna**: `color: var(--ink-muted)` applicato a `.gantt-name`
  (`gantt.css:692-694`). Effort, date, persona e le altre celle di una riga
  disattivata si leggono **identiche a una riga attiva**. E' il candidato
  numero uno e non richiede di inventare niente: richiede di estendere una
  scelta gia' presa.
- **I menu non sono «buttati a caso» ovunque: la toolbar e' gia' raggruppata
  e etichettata.** `Toolbar.tsx` porta gruppi con `label="Export"` (riga 94) e
  `label="Highlight"` (161), e i bottoni hanno `title` descrittivi. I comandi
  pero' vivono su **quattro superfici distinte** — `Toolbar.tsx` (216 righe),
  `RowMenu.tsx` (151), `StatusBar.tsx` (241) e bottoni in `App.tsx`. La
  lamentela va **localizzata**: quale di queste quattro legge come casuale, o
  e' la ripartizione *fra* le quattro il problema? Da guardare nell'app, non
  da dedurre dai file.
- **«Crisp» non ha ancora nessun difetto attaccato.** E' l'unica delle tre
  richieste che non si puo' ancorare a tavolino: va prodotto un censimento di
  cio' che si vede, o il goal costruisce il gusto di chi implementa.

**Misurato il 2026-09-22 dall'hub, con lo scanner della skill `design-taste`**
(`scripts/preflight.mjs`, 26 file: i 21 `.tsx` piu' i 4 `.css`). **La resa
meccanica e' gia' pulita**: nessun `transition: all`, nessun `outline: none`
senza `:focus-visible`, nessun `z-index >= 999`, nessuna animazione da
`scale(0)`, non piu' di tre `font-family`. Unico rilievo, e legittimo:
`dialog.css:31` usa `min(85vh, calc(100vh - 48px))`. Le 251 violazioni
"hard" che riporta sono **tutte** em dash in commenti e copy — regola
anti-AI-tell per pagine di marketing, e qui la prosa del progetto li usa per
scelta: **non e' un difetto, non va "corretto"**.
**Conseguenza per K2**: il ramo "difetti meccanici di CSS" del censimento e'
gia' chiuso, e chi audita non deve riaprirlo. Cio' che fa sembrare l'app un
prototipo, se c'e', sta nella **composizione** (gerarchia, spaziatura,
raggruppamento dei comandi, stati e microinteractions), non nelle violazioni
catalogabili da uno scanner.

**Collisione con T16, sciolta dall'utente il 2026-09-21.** T16 e questo goal
sono lo stesso censimento a viewport diverse. Ordine deciso: **prima** il
difetto gia' misurato sui task disattivati, **poi** l'audit del desktop
attuale (menu, polish, crispness, microinteractions), **poi** la passata
mobile come task separato. Il desktop e' la superficie primaria; mobile e'
sola visualizzazione e viene dopo.
**Conseguenza da non perdere**: T16 auditera' un'UI che questo goal avra'
appena cambiato — la sua vecchia riga «l'audit gira sull'UI finale» e' da
considerarsi **decaduta**, ed e' stata corretta sul posto.

**Guardia, scritta prima di partire** (e' la stessa di Goal C, che l'ha
pagata): questo goal **non deve avere un'analisi come unico task**. Il goal
riceve fette **solo dopo** che l'utente ha comprato dal censimento.
**Corretta sul posto il 2026-09-22**: la riga diceva che il censimento vive
sotto `## Maintenance`, ed era copiata da Goal C, dove sta T16. Qui K2 sta
**sotto Goal K**, quindi la sua chiusura lascia il goal senza task aperti e la
condizione meccanica della goal review scatta — su un goal consegnato per un
terzo. **La review non deve girare ora**: K1 e' l'unico diff, e cio' che il
goal enuncia (professionale, menu organizzati, crisp) vive nelle fette che
l'utente deve ancora comprare. Si riapre con quelle, e si recensisce alla fine.

- [x] K1 `6758cdb` [impl] — **I task disattivati si distinguono davvero.** Oggi la
      barra ha due trattamenti (`opacity: 0.45` + `saturate(0.3)`,
      `gantt.css:346-349`) e la riga in griglia **uno solo su una sola
      colonna** (`color: var(--ink-muted)` su `.gantt-name`,
      `gantt.css:692-694`): effort, date e persona si leggono come su una
      riga attiva. Estendere una scelta gia' presa, non inventarne una.
      Verifica **nel browser**, con `getComputedStyle` su celle di righe
      attive e disattivate a confronto — non a occhio e non dal foglio di
      stile. Vale la regola dell'80%: si corregge la mancanza che si vede.
      Rischio dichiarato: K2 potrebbe rimettere mano a questa scelta dentro
      un sistema piu' ampio; l'utente ha scelto di farlo prima sapendolo.
      **Aggiunto dall'utente il 2026-09-22, dopo aver visto il primo giro**:
      il nome di un task disattivato porta anche uno **strikethrough**, e
      **tiene** l'inchiostro smorzato — variante scelta esplicitamente fra le
      tre offerte, il segnale piu' forte possibile. Solo su `.gantt-name`, mai
      sulle celle numeriche; e `text-decoration` si propaga agli inline, quindi
      il `.gantt-dot` dentro la cella del nome va escluso a mano.

**Le cinque domande di K2, risposte dall'utente il 2026-09-22. Chiuse, non
riproporre.** Il report resta la fonte delle misure; queste sono le scelte.
- **Q5 - scaling: 100%.** Il censimento e' gia' stato fatto alla condizione
  reale dell'utente, e §1.8 registra pixel interi su righe, barre, celle e
  hairline a dpr 1. **Il probe a 1.25 non si fa**, e «crisp» resta ancorato a
  F7 e a nient'altro. Se l'utente cambia postazione la domanda torna aperta,
  non prima.
- **Q1a - il nome del file va nel gruppo del marchio**, accanto alla
  versione: `ARROGANTT v1.5 · project.gantt ●`. Con **ellissi come
  assicurazione**, o il wrap si sposta li' su un nome lungo.
- **Q1b - la fetta E si compra intera.** La regola «sopra si agisce sul
  piano, sotto sulla vista» viene imposta: la memoria muscolare si riazzera,
  l'utente l'ha scelto sapendolo.
- **Q2 - `--ink-faint` in chiaro va a `#7d8590`** (~3.9:1), lo stesso
  scalino che il dark ha gia' preso (3.76:1). Dark **non si tocca**. Non e'
  AA e non deve esserlo.
- **Q3 - riga selezionata: `--accent-soft` in entrambi gli schemi.** La
  variabile esiste gia' e significa gia' «elemento scelto» (menu di riga,
  selettore di colonne): si estende una nozione, non se ne inventa una.
- **Q4 - le facce impilate di un summary portano solo il colore**, senza
  iniziali; un summary con una persona sola tiene le sue. Il `title` nomina
  gia' tutti. **Non** si tocca la geometria che `docs/view.md` descrive, e
  **non** si abbassa `AVATAR_STACK_LIMIT` (`gridColumns.ts:32`, oggi 4): il
  colpo d'occhio su quante persone resta.

**Comprate: A, B, C, D, E, F. Non comprata: G** (raggiungibilita' da tastiera
della status bar, 26 stop di Tab su un piano da 13 task) - resta nel report,
e `CLAUDE.md` dice che questo strumento non deve un audit di accessibilita' a
nessuno. Le fette sono sotto come K3-K9, ognuna col suo finding.
**Tutte serial**: condividono il browser e la porta 5173, che e' un mutex.

**K10 ha consegnato** `.claude/specs/K10-report.md` (2026-09-22). Cio' che
cambia le decisioni gia' prese, e che nessuno deve ri-derivare:
- **I quattro riferimenti sono due sistemi, non quattro.** gantt02, kanban01
  e project01 sono lo stesso prodotto (ClickUp 4.0: stesso rail, `Search
  ⌘K`, violetto `#6747f2`); gantt_01 e' costruito su default Tailwind.
  **Un «4 su 4 concordano» in quel report vale 2 su 2**: ripesare qualunque
  conclusione tratta dal conteggio.
- **«Crisp» e' per cinque settimi roba che l'app ha gia'**: inchiostro
  primario 15.5:1 contro i loro 14.7-20, scalino verso il secondario 3.2×
  contro ≥2.7×, hairline 1.16:1 contro 1.10-1.24, controlli quieti, righe
  36px con testo 13. **Mancano due proprieta'**, comprate come K11 e K12.
- **Non e' crisp**, per misura e nonostante l'apparenza: cambio di font,
  header in sentence case, barre piu' sottili (i due riferimenti gantt si
  contraddicono, 0.53 contro 0.65), barre sature, hairline piu' scure.
  **Nessun linguaggio visivo nuovo, nessun sistema di componenti.**
- **Q2 regge, e la collisione e' stata guardata.** gantt_01 mette i ruoli di
  F7 a 2.37-2.42:1 — piu' *chiari* del nostro difetto a 2.63. ClickUp ha come
  pavimento `#838383` = 3.79:1, dove cade `#7d8590`. Tre immagini concordano
  con Q2, una no; l'utente ha visto i numeri e Q2 resta.
- **Correzione a K2 §5, da usare al posto del suo numero**: `#7d8590` e'
  **3.73:1**, non ~3.9; `#8a919d` e' 3.17, non ~3.2. Lo scalino del dark
  (3.76) regge comunque, ed era l'argomento vero di Q2.


- [x] K2 [architect] — **Audit del desktop attuale: censimento + proposta.**
      Scope: guardare l'app a viewport desktop e censire cosa la fa sembrare
      un prototipo. Quattro aree, volute dall'utente: **organizzazione dei
      menu** (i comandi vivono su quattro superfici — `Toolbar.tsx` 216
      righe, `RowMenu.tsx` 151, `StatusBar.tsx` 241, piu' bottoni in
      `App.tsx`; la toolbar **e' gia' raggruppata ed etichettata**, quindi la
      lamentela va localizzata, non assunta), **polish e crispness**
      (l'unica delle richieste senza nessun difetto ancora attaccato: va
      prodotto il censimento, o il goal costruisce il gusto di chi
      implementa), **microinteractions**, e la coerenza generale.
      Output: report in `.claude/specs/K2-report.md` con opzioni e
      raccomandazione — **nessuna implementazione**; le fette si scopano
      dopo, col confronto utente.
      Il censimento si consegna come **matrice di celle guidate** piu' una
      lista esplicita di cio' che non e' stato guidato — mai in prosa (la
      regola sta in `CLAUDE.md`, ed e' costata tre round sullo stesso
      paragrafo).
      Materiale gia' misurato, da non ri-supporre: l'asimmetria dei
      disattivati sopra (che K1 avra' gia' chiuso) e i due fatti annotati
      sotto Goal C (dialogo People, bottone «Fit» che trabocca a 768px).

- [x] K10 `n/a` [architect] — **Cosa hanno i riferimenti che noi non abbiamo.**
      L'utente ha messo quattro screenshot in `inspiration_ui/` di
      applicazioni che per lui sono **crisp**. **Non erano ignorati**: l'hub
      ha letto male un `git check-ignore`, li ha scritti nel piano come tali
      e `729308b` li ha committati in un repo pubblico. Corretto togliendoli
      dall'indice e riscrivendo il commit (non era stato pushato) piu' una
      riga vera in `.gitignore`. **Un check-ignore si legge dal codice di
      uscita, non dall'output.** Sono **tutti e quattro in schema chiaro**, ed e' il
      dettaglio che conta: tre dei dodici finding di K2 (F3, F4, F7) sono
      difetti del tema chiaro, quindi i riferimenti cadono esattamente dove
      l'app era gia' stata misurata piu' debole.
      Output: `.claude/specs/K10-report.md` — matrice di celle misurate
      (valore di ogni riferimento accanto al nostro, preso dal censimento K2
      dove esiste) piu' lista di cio' che non e' stato guidato; e soprattutto
      **cosa significa «crisp» per questo utente**, come poche proprieta'
      concrete tracciabili a celle della matrice. Nessuna implementazione.
      **Ordine**: gira **prima di K5 e K8**. K5 fissa un colore e K8 sposta
      dei controlli; se i riferimenti dicono qualcosa su inchiostro o densita'
      e' meglio saperlo prima di spendere quelle due fette. K3, K4, K6, K7
      sono difetti misurati e non dipendono da questo — si possono fare in
      parallelo di calendario, mai di porta.
      **Guardia**: uno screenshot non contiene hover, focus, motion, tastiera,
      empty state, ne' il comportamento su una stringa lunga. E un riferimento
      non e' un requisito: una differenza e' una riga di matrice, diventa una
      raccomandazione solo se si sa dire cosa ci guadagna l'utente. Se un
      riferimento contraddice una scelta gia' fatta (il candidato e' Q2), la
      collisione torna all'utente **coi numeri**, non si ri-raccomanda in
      silenzio.

- [x] K11 `10169db` [impl] — **Superfici a due toni (K10, fetta H).** Header e status
      bar passano a `--surface-sunken`, il contenuto resta `--surface`
      (`App.css:19, 952`). E' **l'unica proprieta' che tutti e quattro i
      riferimenti condividono e che l'app non ha**: oggi header, toolbar,
      status bar, griglia, scala e timeline sono la stessa superficie.
      **Gusto adottato, non difetto riparato** — l'utente l'ha comprata
      sapendolo.
      **Vincolo di sequenza, misurato: gira dopo K3.** `--surface-hover` sta
      a **1.043:1 contro `--surface-sunken`**: spostata la barra sul fondo
      incassato, l'hover dei suoi controlli sparisce quasi. Rimisurare
      l'hover sulla barra incassata e, se non regge, usare `--line` come
      hover **li' soltanto** — non ritoccare `--surface-hover`, che serve
      anche altrove.
      **Non guidato da K10 e da guidare qui**: le conseguenze in **dark** di
      questo cambio (il report ha letto solo i token, non l'app).
      **Esito, 26 celle guidate nell'app a schemi freddi**: l'hover non regge
      su `--surface-hover` e prende `--line` (1.120), il pressed sale a
      `--line-strong` o pareggia con l'hover, le pastiglie senza bordo si
      invertono su `--surface`, il vuoto dell'anello dell'avatar segue la
      barra. Nessuna coppia esce piu' debole di come e' entrata e **il dark
      guadagna piu' del chiaro** (`--line` si allontana di piu' dal tono
      incassato li'). In chiaro la cucitura la porta la hairline, non il
      riempimento: i due toni stanno a 1.036 e da soli non basterebbero.

- [ ] K12 [impl] — **Le barre non sono pillole (K10, fetta I).** Raggio da
      pillola a **5-6px** (`gantt.css:243, 248`). Concordano i due
      riferimenti gantt, cioe' 2 su 2 di quelli pertinenti — non 4 su 4.
      **Gusto adottato, non difetto riparato.**
      Da controllare nello stesso passaggio, o il raggio litiga con cio' che
      gli sta sotto e sopra: la traccia della barra (`gantt.css:299-305`) e
      la sezione *Bar decorations* di `docs/view.md`, che va aggiornata nello
      stesso commit. **La milestone ha un raggio suo** (`gantt.css:3px`,
      col commento che spiega perche' va ridichiarato o il diamante diventa
      una macchia): non toccarla senza guardarla.

- [x] K3 `de85636` [impl] — **Gli stati si vedono: i quattro toggle e i colori di
      riga.** F2: `.toolbar button` / `.statusbar button` (0,1,1) battono le
      regole `--on` (0,1,0), quindi il background dello stato acceso **non
      dipinge mai** su collasso griglia, colonne, catena critica e carico
      risorse — sopravvive solo `color !important`. Qualificare i tre
      selettori `--on` con la classe del contenitore, **come fa gia'**
      `.toolbar .toolbar__icon` (`App.css:208`): il precedente e' in casa.
      (`App.css:215-218, 1093-1096, 1109-1112`.)
      F3: in chiaro `.toolbar button:hover` batte
      `.toolbar .toolbar__person { color: #fff }` e annerisce le iniziali
      dell'avatar (`App.css:184, 246`). Invisibile in dark solo perche' li'
      `--ink` e' quasi bianco — **e' lo stesso difetto in entrambi gli
      schemi**, non un difetto del tema chiaro.
      F4: in chiaro le righe dispari fanno hover nel `#e0e0e0` del vendor e
      le pari nel `#f5f6f9` della palette, perche' il re-pointing dei
      `--dhx-gantt-base-colors-*` vive **solo nel blocco dark**
      (`gantt.css:50-58`). Piu' la selezione, per Q3: `--accent-soft` in
      entrambi gli schemi — oggi in dark selezione e hover sono lo stesso
      colore e una riga selezionata e' indistinguibile.
      Verifica **nei due schemi**, matrice di celle guidate: e' la lezione di
      `CLAUDE.md` sul costo osservato in un solo schema.

- [ ] K4 [impl] — **I controlli sembrano dell'app, non del browser.**
      F6: l'editor inline e' un input di default — Arial 13.33px, bordo
      grigio 2px, raggio 0 — dentro una griglia Segoe UI 13px, sotto l'anello
      violetto dell'app; `gantt.css:143` veste solo `:focus`. Dare
      `font: inherit`, bordo `var(--line-strong)`, raggio e padding a
      `.gantt_grid_editor_placeholder input, select`.
      F8: il `+` di riga e' il glifo del font-icone di dhtmlx (13px, .6)
      accanto a due lucide da 15px a .4 — tre pesi in un cluster di tre
      icone. Template della colonna `add` con lucide `plus` 15px alla stessa
      opacita' a riposo. **`CLAUDE.md`: le icone sono lucide, ovunque** —
      `lucide-static` nei template HTML di dhtmlx, mai un SVG a mano.
      F10: nessun bottone ha una regola `:focus-visible`, quindi l'anello e'
      l'`outline: auto` bianco del browser. Una regola sola,
      `2px solid var(--accent)` con `outline-offset: 2px` — **l'anello che
      l'editor inline usa gia'**: si estende, non si inventa.
      **Trovato da K11, non e' un bottone e quindi non e' in F10**:
      `.statusbar__searchfield:focus` e' l'unico controllo dell'app che
      spegne l'`outline` e se lo rifa' a mano, e da `10169db` il segnale e'
      **solo** il bordo accento (il fondo si alzava perche' a riposo era
      incassato; ora coincide e la dichiarazione e' caduta). Quando questa
      fetta scrive la regola unica, quel sito e' l'eccezione da guardare.

- [ ] K5 [impl] — **L'inchiostro tenue in chiaro (F7).** `--ink-faint` da
      `#99a0ab` a **`#7d8590`** (Q2), **solo nel blocco chiaro** di
      `index.css:34`. Tocca intestazioni di griglia, etichette delle
      settimane, End/Duration, label sulle barre e la nota agenti — oggi
      2.0-2.6:1 su bianco, contro 3.76:1 dello stesso ruolo in dark.
      Misurare i **quattro ruoli di §1.5 del report prima e dopo**, e
      riportare entrambe le colonne: il valore e' stato scelto su un numero,
      quindi la prova che il difetto sparisce e' la misura, non l'accordo col
      numero. Se la misura e l'occhio non concordano, vince l'occhio e si
      torna dall'utente coi numeri.

- [ ] K6 [impl] — **L'header non sfonda a 1366px (F1).** Il nome del file va
      nel gruppo del marchio accanto alla versione (Q1a), con **ellissi**: la
      pillola e' oggi la prima vittima del wrap e la seconda riga dell'header
      contiene solo lei, portando l'altezza da 48 a 80px
      (`App.css:144, 273`). Verificare a **1440, 1366, 1280 e 1180** che
      l'header resti su una riga, e con un nome file lungo che tronchi invece
      di mandare a capo la riga del marchio — il difetto si sposta li' se
      l'ellissi manca.

- [ ] K7 [impl] — **Le facce dei summary smettono di stampare lettere
      sovrapposte (F5).** Le facce impilate portano **solo il colore**, senza
      iniziali (Q4); un summary con **una** persona sola tiene le sue, perche'
      li' non c'e' pila — `resourceStack` esce prima
      (`gridColumns.ts:137-138`). Oggi 8px di sovrapposizione su facce da
      22px con iniziali da 10px danno «ARME SC» (`gantt.css:602`).
      **Non** toccare la geometria descritta in `docs/view.md` e **non**
      abbassare `AVATAR_STACK_LIMIT` (`gridColumns.ts:32`): entrambe scartate
      dall'utente. Il `title` nomina gia' tutti, «+n» compreso, e il commento
      a `gridColumns.ts:128-134` spiega perche' resta un `title` nativo e non
      il tooltip ricco — non riaprirlo.

- [ ] K8 [impl] — **L'organizzazione: sopra il piano, sotto la vista (F12,
      fetta E).** Collasso griglia e colonne si spostano accanto a
      Collapse/Expand nella status bar; la nota `For agents:` esce dal
      percorso dei controlli (estremita' destra, oppure dentro il dialogo
      `?`). La toolbar resta: file · export · modifica · modello · highlight.
      **Aggiornare `docs/view.md` nello stesso commit** — e' una decisione di
      UI e quel file e' la sua casa. Verificare che le scorciatoie da tastiera
      e gli `aria`/`title` seguano i controlli spostati, non restino dove
      erano. La toolbar **era gia' raggruppata ed etichettata**
      (`Toolbar.tsx:94, 161`): questo e' un riassetto comprato dall'utente,
      non la riparazione di un difetto — non allargarlo.

- [ ] K9 [impl] — **Una famiglia sola sullo schermo (F9).** Le intestazioni
      di griglia e timeline sono Inter perche' la `font-family` del vendor non
      e' sovrascritta; il resto dell'app e' Segoe UI. `font-family: inherit`
      su `.gantt_grid_head_cell, .gantt_scale_cell`.
      **La trappola, ed e' il motivo per cui questo task e' ultimo**: le
      soglie di ellissi delle testate `Rate (WWW)` e `Cost` in `docs/view.md`
      sono state misurate **in Inter 600 11px**. Cambiando famiglia cambiano
      le larghezze: **rimisurare entrambe** e aggiornare i due numeri nello
      stesso commit. `CLAUDE.md` porta il precedente esatto — una soglia
      misurata su una colonna e scritta per due, sopravvissuta a tre task e
      due review: `Rate` e `Cost` hanno budget di larghezza **separati**.

- [ ] K13 [impl] — **La selezione e la ricerca si contendono lo stesso tono.**
      Q3 ha dato alla riga selezionata `--accent-soft`, ma quel token era
      **gia'** il colore della riga trovata dalla ricerca
      (`gantt.css`, `.gantt-host .gantt_row.gantt-found`). Dopo K3 le due
      cose si dipingono uguali. In **griglia** restano distinte per un caso:
      la riga trovata porta anche `box-shadow: inset 2px 0 0 var(--accent)`.
      In **timeline** quel bordo non c'e', e non resta niente a separarle.
      Il caso «trovata **e** selezionata» ha una regola sua (color-mix 16%) e
      continua a funzionare: il difetto e' fra una riga trovata e una riga
      selezionata **diverse**, con una ricerca attiva.
      **Non e' un errore di K3**: la corsia ha implementato Q3 alla lettera.
      E' Q3 che e' stata decisa senza sapere che il token era occupato — la
      motivazione («`--accent-soft` significa gia' elemento scelto: menu di
      riga, selettore di colonne») aveva censito gli usi in `App.css` e non
      quello in `gantt.css`. Una premessa non misurata sotto una decisione
      comprata in buona fede, che e' il modo esatto in cui `CLAUDE.md` dice
      che si perde mezzo goal.
      **Letto dal foglio di stile, NON ancora misurato nel browser.** Ho
      riletto tutte le regole `gantt-found` e nessuna distingue la timeline,
      ma e' una deduzione da CSS — la specie di prova che oggi mi ha gia'
      ingannato una volta su questo stesso file. **Primo passo del task:
      misurarlo con una ricerca attiva e una riga selezionata non fra i
      risultati, nei due schemi.** Se non si vede, il task muore li'.
      **La scelta e' dell'utente, non della corsia**: o la selezione prende
      un tono suo, o la ricerca lo cambia, o si accetta la collisione perche'
      ricerca e selezione raramente convivono. Non decidere da solo.

## Maintenance — no goal
Task che non servono una milestone: difetti puntuali, salute del codice e
analisi, arrivati come richieste singole. **Non ricevono la goal review**, ed
e' il prezzo di stare qui — dichiarato adesso, non scoperto alla fine. Se uno
di questi cresce fino a meritarne una, si apre un goal e lo si sposta.

- [ ] T17 [impl] — Il nome del task per esteso in hover sulla griglia.
      Chiesto dall'utente il 2026-09-21 insieme a Goal I, ma indipendente da
      esso: riguarda il **nome troncato**, non la descrizione, e sotto
      l'enunciato di Goal I sarebbe contrabbando.
      **Un `title` HTML nativo, nessun componente nuovo** — e' la convenzione
      gia' in vigore e c'e' una ragione scritta: `gridColumns.ts:130-132`
      registra che **il tooltip ricco dell'app sta solo sulle barre**
      (`barTooltip.ts` via `gantt.ext.tooltips`) e che la griglia usa `title`
      nativi, perche' riportarlo su una cella sarebbe «un secondo tooltip
      nella stessa colonna». Una corsia che vede `barTooltip.ts` sara'
      tentata di riusarlo: vietarlo nel brief.
      Da misurare prima: **se il nome tronchi davvero**, e a quale larghezza
      di colonna — un tooltip che ripete cio' che si legge gia' e' rumore.
      Se dopo la misura il difetto non si vede, va riportato all'utente coi
      numeri, non costruito lo stesso.

- [ ] T16 [architect] — Valutazione mobile: audit + proposta
      Scope: audit dell'app a viewport smartphone (375px) e tablet (768px),
      touch emulato; censimento azioni/controlli e proposta di cosa nascondere
      o adattare per una modalita' di sola visualizzazione (non editing
      completo). Output: report in `.claude/specs/T16-report.md` con opzioni e
      raccomandazione — **nessuna implementazione**; i task implementativi si
      scopano dopo, col confronto utente, e aprono Goal C per davvero.
      Materiale gia' misurato, da non ri-supporre: i due fatti annotati sotto
      Goal C (dialogo People e bottone «Fit»).
      Il censimento si consegna come **matrice di celle guidate** piu' una
      lista esplicita di cio' che non e' stato guidato — mai in prosa.
      **Depends: NON piu' soddisfatta.** La vecchia riga diceva «l'audit gira
      sull'UI finale» — resa falsa dall'apertura di Goal K, che cambiera'
      menu e resa desktop. Ordine deciso dall'utente il 2026-09-21: T16 va
      **dopo** K1 e K2 e dopo le fette che K2 fara' comprare, o auditerebbe
      un'UI in movimento.

## Decisioni chiuse — non riproporre

**Repo e pubblicazione.** Non ricreare mai `okon3/yagni`: i redirect di web,
API e git che tengono vivi i cloni esistenti muoiono nell'istante in cui
qualcuno rioccupa il vecchio nome. Le tre chiavi di `localStorage` sono
rinominate **senza migrazione**, scelta dell'utente coi costi davanti; le
vecchie restano orfane e nessun `removeItem` le ripulisce.

**Costi (Goal F).** Niente tabella costi a se' con breakdown per persona e
periodo (si compra dopo aver lavorato con le colonne); **nessuna tariffa di
default di progetto** (nasconderebbe chi gira su una stima); **nascosto = non
costruito**, mai `hide: true` (nei typings e' PRO, mai sondato); la selezione
delle colonne e' **view state** in `localStorage['yagni.columns.v1']` — niente
undo, niente dirty, nessuna op agent.
Il campo tariffa e' `type="text"` con `inputMode="decimal"` per scelta: la
regola vive in `validateResources` e **sola**, un input `number` ne metterebbe
una seconda e muta.

**Export (Goal G).** L'opzione «nascondi chiusure e assenze» e' **ritirata**
(conferma utente, 2026-09-18): le assenze non sono mai state nella figura, e
nascondere le chiusure mostrerebbe barre ferme su giorni disegnati come
lavorativi.

**Figura per il cliente (Goal H).** Il preset non e' piu' una selezione di
colonne: da' **nomi e barre**, niente registro e niente task disattivati. Il
flag `clientSafe` del registro e' stato **rimosso** — la domanda «quali
colonne puo' vedere un cliente» non esiste piu', la risposta e' «nessuna».
Un summary disattivato porta via **tutto il ramo**: `disabled` e' ereditato in
`disabledByTask`, quindi un filtro piatto basta. CSV resta fuori scopo.

**Refactoring della vista (Goal E).** S5b, S6 e S7 restano fuori. S5b unifica
la mappa riga — l'unica fetta che cambia forma, in giacenza finche' un goal non
aggiunge campi di riga, corsia **deep**, e la verifica e' parita' dei campi via
`gantt.getTask(id)` dopo apertura/edit/undo su un piano con summary, milestone,
condivisa, disabled e critico stale, **senza pixel**. S6/S7 su `App.tsx` e i
gesti: raccomandati contro dalla spec. Il corpo dell'handle e gli handler del
modello restano nel chart: sono le operazioni e il codice che muta il modello,
e il file di destinazione sarebbe grande quanto quello che lascia.

**Dipendenze (Goal D).** Fuori scope per decisione dell'utente: l'editor delle
dipendenze (O4, in giacenza), l'handle sinistro visibile (O2b), il modale
vendor (O3b), l'alzata della label (O5). L'overlay del banner copre per intero
la testata della griglia finche' resta a schermo, ed e' **accettato** sotto la
regola dell'80%.

**T61, scartato dall'utente**: la prima riga di dati e' sempre un inizio di
gruppo, quindi il suo `gantt-row--group-start` raddoppia il bordo inferiore
della testata e non separa da nulla. Il bordo extra in cima si accetta. La
misura che sarebbe servita — se l'ordine DOM delle righe regge a griglia
scrollata, o se `:first-child` seguirebbe il DOM invece dei dati — resta **non
fatta**, e va rifatta se qualcuno riapre la questione.

## Da riproporre — nessuno le ha comprate

- **`applied()` (`resources.ts:48`) scrive `availability ?? 1` a ogni
  `updateResource` dell'agent API** — l'ultimo gemello della regola che F12 ha
  appuntato sul dialogo People. Offerto due volte, rimandato due volte;
  `docs/file-format.md` lo dichiara onestamente nominando i due percorsi
  separati. **Il candidato piu' maturo della lista.**
- Il periodo tariffa seminato a `0` su una persona senza tariffa di default
  (`RatePeriodList.tsx`): l'**unico** posto dove la UI fabbrica uno zero.
- Due conseguenze dichiarate del `type="text"` sulla tariffa: `6e2` passa come
  600 e `0x10` come 16 senza segnalazione; una tariffa con molti decimali si
  rivede intera nel campo (`100.567`) e arrotondata in griglia (`100.57`).
- La testata `Rate`/`Cost` **della figura** ellissa oltre tre e oltre cinque
  caratteri di currency (`docs/view.md` porta i due numeri): `figureWidth` e'
  un budget a se', lasciato intatto di proposito. La testata **in griglia**
  invece entra (67.14 in 84).
- Il popover del picker si posiziona una volta dall'ancora catturata
  all'apertura e **non segue un resize** (da 760 a 500px resta a left 475 /
  right 645, fuori dal viewport). Stessa forma di `RowMenu`, che si comporta
  cosi' da sempre senza che nessuno l'abbia segnalato: se si aggiusta, si
  aggiusta **una volta per entrambi**.
- La build `single` emette anche `favicon-*.svg` e `llms.txt` **non inlinati**:
  distribuire il solo `index.html` perde la favicon.
- Caricare `keyboard_navigation` in una sonda usa-e-getta per misurare cosa
  rivendica davvero. La clausola «a mode that would claim arrows and Del, which
  App owns» (`docs/dhtmlx.md`, `GanttChart.tsx:815`) e' una premessa `would`
  mai verificata — salva per scope, ma l'ultima non misurata della zona.
- Un test che fissi la soglia dei 10px delle bande e la regola «nessuna banda
  su un summary o su un ramo chiuso» (`timelineOverlays.ts`, importabile):
  oggi sono appuntate solo dalla misura nel browser, al prezzo di un mock di
  `gantt`.
- Gli screenshot di `docs/assets/` portano il badge `v1.3` e **non mostrano il
  dialogo di export** — cioe' la novita' che il README descrive tre paragrafi
  piu' sotto. Sono la prima cosa che si vede in una **vetrina pubblica**, non
  interna: l'argomento del costo (T65b e' costato una generazione dell'hub) e
  quello del pubblico tirano in direzioni opposte, e l'utente ha scelto di
  rimandare il 2026-09-21 sapendolo.
- **Un estraneo non ha una strada per segnalare un bug**: nessun
  `CONTRIBUTING.md`, nessuna riga sulle issue, nessun accenno al fatto che sia
  uno strumento interno rilasciato MIT senza promesse di supporto. E' il buco
  piu' evidente del repo pubblico e il piu' economico da chiudere. Offerto e
  rimandato il 2026-09-21.

## Analisi in giacenza — non e' un task, e' materiale per decidere

Lo sweep degli orfani **non tocca questi due file**: i loro task sono `[x]`,
ma il contenuto e' materiale di decisione, non la spec di un task chiuso.

- `.claude/specs/T33-report.md` — costo della verifica nel browser. La leva 3
  e' fatta (T34: porta fissa, `dev:fresh`). Restano le leve 2b (primitive
  dev-only), 2a e 1 (test in browser mode), in quest'ordine: 2b e' il
  *prerequisito* di 1, non un'alternativa. L'utente ha fermato l'investimento
  dopo la leva 3 — il tooling si ripaga sul goal dopo, non su questo. Da
  riproporre solo con un goal nuovo. **Prima di scopare la leva 1**: provare
  che la browser mode di vitest parta su questa macchina Windows, mai fatto.
- `.claude/specs/K2-report.md` — censimento desktop. Il task e' `[x]`, ma e'
  il materiale da cui l'utente compra le fette di Goal K: **lo sweep degli
  orfani non lo tocca** finche' questa riga esiste. Porta anche i quattro casi
  «misurati e a posto» (niente transizioni, `:active` distinto, cromatura dei
  dialoghi coerente, pixel interi a dpr 1) che nessuno deve ri-derivare.
- `.claude/specs/K10-report.md` — i quattro riferimenti misurati contro il
  censimento. Task `[x]`, **ma lo sweep degli orfani non lo tocca** finche'
  questa riga esiste: porta i valori campionati dalle immagini, la lista di
  cio' che uno screenshot non puo' contenere, e le tre proprieta' giudicate
  **non** crisp — cioe' le tre cose che qualcuno riproporra'.
- `.claude/specs/T26-report.md` — UX dei link, tutto misurato nell'app. O1, O2
  e il banner sono chiusi con Goal D, ma e' il materiale di **O4** (editor
  delle dipendenze), l'unica sua opzione ancora in giacenza: senza il report
  O4 si riaprirebbe da zero. La sua §9 non serve piu' come lista di lacune —
  la goal review di Goal D le ha misurate tutte e reggono.

## Log

- **Dimensionamento**: impl oltre ~200k = task da splittare (F7 257k, F1 e
  F4b ~225k, K1 213k su due round di correzione); splittato rende 80-170k a
  meta'. Si taglia la **campagna di verifica**, non il codice — ri-splittare sul codice li fa risalire, e
  toglierla del tutto non rende economico il task (F8 146k).
- **Un brief che porta gia' la fixture e i casi dell'accept si paga**: zero
  correzioni di corsia su tutti e sei i task di G e H (impl 82-197k, critic
  81-185k), e su I1 (deep 110k, critic 105k, 0 round; due Explore di
  ricognizione 56k+57k prima del brief).
- Un `[self]` guidato nel browser costa **una generazione dell'hub** (T65b,
  zero deleghe, oltre 176k da solo).
- **Il critic e' la voce piu' cara e la piu' redditizia**: 75-95k a tavolino,
  102-242k nel browser, 128-191k la goal review; un audit Fable nel browser
  312k (K2, dieci matrici a due schemi). Trova cio' che l'accept non
  chiedeva: e' la regola, non l'eccezione.
- **Un elenco enumerato da una sezione di spec e' completo o non e' un
  elenco.** F2b ha taciuto un filtro, F3b una tabella da cui dipendeva la
  fixture, F8 ha ristretto «the widest string of each» alla fixture.
- **Le misure piccole le fa l'hub**: probe vitest usa-e-getta, Explore non
  residenti, un censimento nel browser — dove una corsia paga 40k di ingresso.
  **Prima di briefare, misurare la premessa**: se cade, il brief non serve.
  Un task di sola analisi paga la delega se l'hub tiene solo le conclusioni e
  rimisura da se' quelle portanti (T60: due Explore, 56k + 72k).
- **La prosa e' cio' che resta indietro.** Goal H: zero difetti di codice
  sopra il bar e **sette** frasi rese false dal diff (`docs/`, il README che
  vendeva il preset vecchio, due commenti che contraddicevano la riga sotto).
  Le trova il critic o la goal review, mai i test; e un grep non basta —
  `clientSafe` e `client-safety` sono la stessa nozione, ne matcha uno solo.
  **E una ragione falsa non e' ornamento: guida la scelta sbagliata.** K1
  scrisse una regola inerte su un meccanismo inesistente; K3 ha dichiarato
  impossibile scavalcare il vendor — falso, la tecnica era gia' nel file tre
  volte — e su quella premessa si e' ritirata su una variabile, rompendo meta'
  delle righe. Entrambe le volte il codice sembrava giusto e la ragione no.
- **K3: impl 173k + 224k (1 round), critic sonnet 156k. K11: impl 148k,
  critic sonnet 140k, 0 round.** Il critic nel browser ripaga: su K3 il
  difetto stava nella cella che la corsia aveva dichiarato **non** guidata;
  su K11 ha trovato da solo la dichiarazione inerte. Chiedere quell'elenco
  rende. **Un brief che porta la tabella delle celle gia' decise azzera i
  round**: le 13 celle di K11 sono tornate tutte come prescritte.
