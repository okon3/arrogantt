# Plan

## Cosa resta sul tavolo

Goal D, E, F, G, H e K sono **chiusi, recensiti e potati**; le loro Accept lines
sono cadute dopo la review, come vuole la regola. Ultima release **`v1.6`**
(2026-09-23), che ha portato i bullet accumulati di H e K: figura per il
cliente senza colonne, task disattivati riconoscibili ovunque e fuori dalle
figure, controlli di vista sulla status bar. `## Unreleased` non esiste
adesso: il primo bullet di Goal I lo ricrea.
**Goal I** (descrizione per task) e' **avviato**: domande di prodotto tutte
chiuse, suddivisione rivista sulla ricognizione del 2026-09-21, I1 e I2
committati. Restano I3 (CSV e agent API) e I4 (docs e changelog).
`## Maintenance` porta T16 (audit mobile) e T17 (nome del task in hover);
Goal C aspetta quel report prima di ricevere task veri. **Goal J** (task
completato come misura della stima) ha le domande di prodotto chiuse ma e'
**sospeso dall'utente**: materiale pronto per un'analisi di dettaglio piu'
avanti, non lavoro in corso. **Goal K** (polish di UI/UX) e' **chiuso, recensito e potato**; quel che
non va riproposto sta sotto `## Decisioni chiuse`. Tre conseguenze per chi
entra adesso: **le due barre stanno su `--surface-sunken`** (chi tocca un
controllo che vive li' sopra ha un fondo diverso da quello per cui era stato
dipinto), **le barre del chart hanno `--radius-bar: 6px`**, non piu' una
pillola, e **la status bar e' una riga sola** (`white-space: nowrap`): chi le
aggiunge un controllo lo paga in ellissi sul costo e sulla nota agent, non in
altezza — e sotto ~980px la fila esce di larghezza.

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
- [x] I2 [impl] — La textarea nel `TaskDialog`, summary inclusi, col giro
      completo edit → modello → `applySolution`; oltre 2000 `save()` rifiuta
      con `error`, nessun `maxLength`.
      **Accept**: testo multi-riga salvato e riletto verbatim, sui summary
      come sulle foglie; svuotare il campo toglie la chiave dal task; 2000
      caratteri salvano e il file si scrive, 2001 lasciano il dialogo aperto
      col messaggio del parser e il progetto intatto; l'undo di una modifica
      alla sola descrizione dice `edited "<nome>"`. Nove celle guidate nel
      browser, tre check verdi. — commit 6a38277
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

## Maintenance — no goal
Task che non servono una milestone: difetti puntuali, salute del codice e
analisi, arrivati come richieste singole. **Non ricevono la goal review**, ed
e' il prezzo di stare qui — dichiarato adesso, non scoperto alla fine. Se uno
di questi cresce fino a meritarne una, si apre un goal e lo si sposta.

- [x] T17 [self] — Il nome del task per esteso in hover sulla griglia: un
      `title` nativo sullo span `.gantt-name`, incondizionato. Premessa
      misurata dall'hub prima di scrivere (al default di 230px un nome di 58
      caratteri perde 199px di 393); la corsia e' passata da `[impl]` a
      `[self]` — una riga di template non paga i 40k d'ingresso. — commit 44cfc48

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
      **Depends: soddisfatta.** L'ordine deciso dall'utente il 2026-09-21
      voleva T16 dopo Goal K, o auditerebbe un'UI in movimento: Goal K e'
      chiuso e potato, quindi l'UI desktop e' ferma e T16 puo' partire.
      Auditera' menu e resa **dopo** lo spostamento dei controlli di vista
      sulla status bar, non prima.

## Decisioni chiuse — non riproporre

**UI e UX (Goal K).** Chiuso, recensito (`fix-first`, una ACTION, chiusa da
K15) e potato. Le cinque risposte dell'utente restano vincolanti: il nome del
file sta nel gruppo del marchio con ellissi; la regola «sopra si agisce sul
piano, sotto sulla vista» e' imposta e la memoria muscolare si riazzera;
`--ink-faint` in chiaro e' `#7d8590` (3.73:1) e il **dark non si tocca**;
la riga selezionata porta `--accent-soft` in entrambi gli schemi; le facce
impilate di un summary portano **solo il colore** e `AVATAR_STACK_LIMIT`
resta 4. Il probe a 1.25 di scaling **non si fa**.
**Comprate A-F; G no** — raggiungibilita' da tastiera della status bar, 26
stop di Tab: `CLAUDE.md` dice che questo strumento non deve un audit di
accessibilita' a nessuno.
**Tre cose misurate e chiuse senza codice**: spostare la pillola del nome nel
gruppo del marchio **non toglie il wrap, lo sposta** (K6, e K8 ha poi risolto
l'obiettivo da solo); l'anello di criticita' del summary **non e' una capsula**
(K14, 0.75 contro 0.60, geometria in `docs/view.md`); `flex-wrap` sulla status
bar toglie l'overflow ma la porta a 67px, peggio dei 49 che evita (K15).
**Due token fanno due mestieri, accettato sotto la regola dell'80%**:
`--accent-soft` e' sia selezione sia risultato di ricerca — li separa il bordo
`2px` accento, che da K13 dipinge in griglia **e** in timeline, e la sua
comparsa dipende dall'abbinamento con `gantt-row--group-start`, non e' un
raffinamento; `--line` e' sia hairline sia riempimento hover/on sulle barre
incassate, quindi **un toggle acceso a riposo dipinge il colore dell'hover** e
lo distinguono inchiostro e pallino. Chi torna su quei token riapre questo,
non lo scopre.
**Dai riferimenti (K10)**: sono **due sistemi, non quattro** (ClickUp 4.0 in
tre immagini, Tailwind di default nella quarta), quindi un «4 su 4» li' vale
2 su 2; e «crisp» e' per cinque settimi roba che l'app aveva gia'. Niente
linguaggio visivo nuovo, nessun sistema di componenti. Gli screenshot in
`inspiration_ui/` sono ignorati **davvero** ora: un `git check-ignore` si
legge dal codice di uscita, non dall'output.

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
- `.claude/specs/K2-report.md` — censimento desktop. Goal K e' chiuso e le
  fette sono state comprate, ma **lo sweep degli orfani non lo tocca**: e' la
  linea di base contro cui T16 misurera' il mobile, e porta i quattro casi
  «misurati e a posto» (niente transizioni, `:active` distinto, cromatura dei
  dialoghi coerente, pixel interi a dpr 1) che nessuno deve ri-derivare.
  **Una sua cella e' morta**: il label di barra in dark a 2.30:1 non e' viva —
  la goal review ha misurato 3.76:1 sul summary e `--ink-muted` sulla foglia.
  Chi rilegge il report non ri-apra quel finding.
- `.claude/specs/K10-report.md` — i quattro riferimenti misurati contro il
  censimento. Goal K e' chiuso, **ma lo sweep degli orfani non lo tocca**:
  porta i valori campionati dalle immagini, la lista di
  cio' che uno screenshot non puo' contenere, e le tre proprieta' giudicate
  **non** crisp — cioe' le tre cose che qualcuno riproporra'.
- `.claude/specs/T26-report.md` — UX dei link, tutto misurato nell'app. O1, O2
  e il banner sono chiusi con Goal D, ma e' il materiale di **O4** (editor
  delle dipendenze), l'unica sua opzione ancora in giacenza: senza il report
  O4 si riaprirebbe da zero. La sua §9 non serve piu' come lista di lacune —
  la goal review di Goal D le ha misurate tutte e reggono.

## Log

Una riga per task o batch chiuso. Token in k dove misurati; `-` = non
misurato. Le lezioni durevoli stanno in `.claude/orchestrate.md`, non qui.

| chiuso | tier | hub | impl | critic | src +/- | round |
|---|---|---|---|---|---|---|
| G, H (6 task) | feature | - | 82-197 | 81-185 | - | 0 |
| I1 | feature | 2 Explore 56+57 | 110 (deep) | 105 | - | 0 |
| K1 | polish | - | 213 | - | 41 | 2 |
| K2 (audit) | analisi | - | 312 (architect) | - | 0 | - |
| K11, K12 | polish | - | 148-224 | 121-194 | 31, 22 | 0 |
| K13 | polish | browser | - | browser | 26 | 0 |
| K14 | polish | browser | - | - | 0 | - |
| K4-K9 batch (5 task, K6 saltato) | polish | 1 sessione, senza corsie | - | - | 164+/88- | 0 |
| goal review 1 | review | browser | - | 179 (fable) | 0 | - |
| K15 (ACTION 1 + 2 nit) | polish | browser | - | - | 15+/9- | 0 |
| T17 | polish | browser | - | - | 11+/4- | 0 |
| I2 | feature | 1 Explore 28 | 115 | 132 | 46+/2- | 0 |

Sopra ~300k per meno di ~50 righe di `src/` e' un difetto di processo e va
all'utente coi numeri, non nel Log come successo a zero round.
