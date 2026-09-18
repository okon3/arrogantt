# Plan

## Cosa resta sul tavolo

**Goal E e' chiuso e potato** (review fix-first, unica azione scaricata da
T51): chart 2228 → 1205. Nessuna release — refactoring, e il changelog non
prende plumbing.

**Goal F e' chiuso, potato e rilasciato `v1.3`** (terza review `ship`):
tariffe per persona che variano nel tempo, colonne Rate e Cost, registro delle
colonne col picker, `currency` e totale in status bar. Niente resta da fare su
di lui. **Da riproporre appena c'e' spazio**: `applied()` che scrive
`availability` a ogni patch dell'agent API, l'ultimo gemello della regola che
F12 ha appuntato.

Aperti: **Goal G** (export cliente), il cui primo passo e' ancora analisi (T60)
e che **eredita** da F il meccanismo delle colonne, gia' costruito; **T16**,
unico task di Goal C, che lo porterebbe alla sua review. **O4** in giacenza. Su
T60 leggere prima il fatto accertato in testa a Goal G: l'export non fotografa
il DOM.

In manutenzione resta **T65b**: rifare i due screenshot di `docs/assets/`, che
ora mostrano un'app che non esiste piu' (nome vecchio, e `hero.png` ha la UI in
italiano). Composizione e fixture le decide l'utente prima dello scatto: e' la
vetrina, non una prova. T63, T64 e T65a sono chiusi — il README punta a link
vivi e `grep -i yagni` trova solo `PLAN.md` e il favicon.

**Se si scegliesse T16, la guardia di T32 va scritta anche su Goal C prima di
partire**: T16 e' il suo unico task e consegna un report, quindi alla sua
chiusura la goal review scatterebbe su un diff che non esiste — il buco in cui
e' caduta la review di B.

## Goal G — un gantt da mostrare al cliente                        [aperto]
Esportare il piano come immagine per un committente esterno: solo il livello di
dettaglio che gli si vuole dare, e senza gli interni dell'organizzazione. Oggi
l'export PNG/print fotografa il piano come lo vede chi lo costruisce; questo
goal gli aggiunge un pubblico diverso.

Deciso con l'utente in apertura, e vincolante (non riaprire):
- **WYSIWYG: l'export fotografa l'albero nello stato in cui e'.** Un ramo
  chiuso esporta il suo summary (date ed effort rollati dalle foglie —
  l'invariante gioca a favore) e non i figli. Nessun campo nuovo nel `.gantt`,
  nessun gate di parsing da estendere, nessun undo da coprire. «Solo il primo
  livello» e' quindi un bottone «chiudi tutto», non un filtro.
  Scartate: un flag per task persistito nel file (costo: campo nuovo, gate in
  entrata e in uscita, semantica del summary coi figli tutti esclusi, undo) e
  una selezione a checkbox usa-e-getta nel dialogo di export (stanca chi
  esporta ogni settimana).
- **Le chiusure aziendali e le assenze si possono nascondere**, come
  **opzione** dell'export, non come default imposto: il cliente non deve
  leggere chi e' in ferie. Riguarda le bande disegnate da
  `timelineOverlays.ts` (non-lavorativi, chiusure, assenze per risorsa).
- **Un dialogo di configurazione dell'export**, dove si scelgono: l'ambito
  (tutto il piano, oppure solo quello che si sta vedendo), le colonne da
  esportare, e le opzioni di riservatezza qui sopra. Non un export con
  parametri impliciti.
- **Niente nomi di persone, se lo si chiede.** Non basta togliere la colonna
  risorsa: il nome trasuda anche dagli avatar/iniziali di riga e dal profilo
  di allocazione disegnato sulle barre condivise (`task_text` ->
  `renderSegments`). L'opzione deve coprire tutte le strade, non la sola
  colonna.

**Vincolo incrociato con Goal F: F e' arrivato primo e ha deciso, questo goal
erede.** La scelta delle colonne da esportare e la scelta delle colonne
visibili in griglia sono **lo stesso meccanismo con due clienti**, e l'utente
ha comprato il meccanismo generale dentro Goal F (opzione C della spec T59):
il registro delle colonne, il filtro con la sua persistenza, il picker e le
colonne insegnate a `planFigure` **esistono gia' quando questo goal parte**.
Quindi il dialogo di export **non costruisce una seconda lista di colonne**: ne
consuma il registro. Da F si eredita anche: la scelta delle colonne e' un
argomento di `planFigure`, non stato della griglia (i due clienti scelgono
diverso nello stesso momento); e `rate`/`cost` sono marcate non sicure per un
cliente, quindi **fuori da un export cliente per default**. Anche l'etichetta
`currency` arriva da F, nel file.

Da decidere nell'analisi, non adesso — e la risposta e' semantica, non estetica:
- **Un link che parte da un figlio nascosto.** Se un sottotask collassato ha
  una dipendenza verso l'esterno del suo ramo, l'export la ridisegna sul
  summary, la omette, o rifiuta? Un gantt cliente con frecce che nascono dal
  nulla e' peggio di uno senza frecce. Ricordare che le dipendenze sono
  spinte sulle foglie su entrambi i capi (invariante), quindi a livello di
  summary il link *non esiste* nel modello: va sintetizzato o taciuto.
**Fatto accertato dal critic di T58, e riguarda la decisione WYSIWYG:** print
e PNG **non fotografano il DOM del chart**. Passano dall'SVG costruito a mano
da `planFigure` (`printPlan.ts`, `files.ts:53`), quindi il separatore di gruppo
di T58 e' solo-schermo, e piu' in generale «esporta quello che vedi» non e'
gratis come sembrava: non c'e' una fotografia da ritagliare, c'e' un secondo
disegnatore a cui va insegnato lo stato dell'albero. La decisione resta (niente
campi nel file, il collapse e' il controllo), ma **T60 deve misurare cosa
`planFigure` sa gia' della gerarchia** prima che si scopino le fette — e la
trappola delle barre fuori schermo vale per il DOM, non per lui.

- **Cosa significa «solo quello che sto vedendo».** Due letture diverse: lo
  stato dell'albero (rami chiusi = figli fuori dall'export) oppure il viewport
  (l'intervallo di date a schermo, con fuori ciò che sta a destra). La risposta
  dipende da come l'export rasterizza oggi, e c'e' una trappola nota:
  «le barre fuori schermo non hanno nodo DOM» (CLAUDE.md). Possono anche
  essere due opzioni distinte, se costano poco.

- [ ] T60 [self] — Ricognizione dell'export attuale e scomposizione del goal
      Scope: capire come l'export immagine/print funziona oggi prima di
      scoporre qualunque fetta — chi rasterizza, se fotografa il DOM visibile
      o ridisegna, cosa fa dell'area fuori viewport (CLAUDE.md: «le barre fuori
      schermo non hanno nodo DOM», che su un export a piano intero e' il fatto
      centrale), e dove sta il dialogo/percorso di export. Poi decidere le due
      questioni aperte qui sopra e scrivere i task implementativi con la loro
      lane e il loro accept, dialogo di configurazione incluso.
      Accept: le questioni aperte sono chiuse con una risposta motivata (o
      portate all'utente con i numeri, se la scelta e' sua), il vincolo
      incrociato sulle colonne e' deciso e scritto anche in Goal F, e il goal
      ha i suoi task scopati. Nessuna implementazione.

## Goal F — quanto costa il piano, non solo quanto dura              [chiuso]
Una tariffa giornaliera per persona che varia nel tempo come la disponibilita',
e il costo di ogni riga leggibile sull'albero. Consegnato: le tariffe vivono
lato vista (`src/gantt/cost.ts`), il costo e' una lettura del report di
soluzione attaccata come `SolvedProject.costs`, e **`src/scheduler/` e' intatto
su tutto il goal** — `git diff b70d327~1..db8b50c -- src/scheduler` vuoto, il
motore non ha imparato il denaro. Il prezzo si applica per segmento
(rate x durata), quindi un task a cavallo di un aumento si spezza sui due
prezzi; costo assente e' cella vuota, non `0`, e un summary parziale porta `≥`
con l'effort non costato dichiarato accanto. Comprato per strada su scelta
dell'utente **contro la raccomandazione della spec**: il registro delle colonne
con picker e persistenza (opzione C — Goal G lo eredita, vedi il suo vincolo
incrociato), l'etichetta `currency` nel file e nel dialogo People, e
l'intervallo `600-650` sulla colonna Rate di un task a cavallo. Il totale sta
nella status bar, non in una riga footer: dhtmlx Community non ne offre una
verificata, e col picker la larghezza della griglia cambia a runtime.

Tre goal review, **fable-5-1 confermato in header** su tutte e tre, **nessun
MISSING e nessuno SMUGGLED in nessuna**. *2026-09-16, `fix-first`*: quattro
azioni (F9-F12), e ha confermato di passaggio che il filtro `roots` di F2b e'
corretto e che l'assenza di un harness React non e' un debito che questo goal
ha aggravato — le regole stanno in moduli puri, ed e' il seam giusto.
*2026-09-18, `fix-first`* sul delta: tre azioni tutte su commenti e
documentazione, «il codice spedisce com'e'». *2026-09-18, `ship`* sul delta di
quelle tre: ha misurato la matrice di F17 contro `columns.ts` e `cost.test.ts`
e la coerenza delle superfici del denaro (unita' nell'etichetta dove c'e' una
testata, nel suffisso dove non ce n'e', `—` piu' ragione nel `title`, vuoto nel
CSV, `null` in API e file). Le due COHERENCE che ha dichiarato **sotto** il bar
erano vere lette sul codice, e sono chiuse in F20.

- [x] T59 [architect] — Spec del goal costi — spec cancellata alla chiusura
- [x] T62 [architect] — Delta della spec sulle quattro risposte — stessa spec
- [x] F7 [impl] — Registro delle colonne, selezione, persistenza, picker — `b70d327`
- [x] F1 [impl] — Tariffe e `currency` nel modello, nel file e nelle regole — `1fc20d8`
- [x] F2a [deep] — Il calcolo del costo: `rateIntervals` e `taskCosts` — `5402bb5`
- [x] F2b [self] — `costs` e `currency` su `SolvedProject` — `fcfb61a`
- [x] F3a [impl] — Report del file, colonne CSV, `docs/file-format.md` — `39b59ed`
- [x] F3b [impl] — Parita' di `getTask()`, scrittura di `currency`, help — `9c9e0ac`
- [x] F4a [impl] — Il totale di progetto nella status bar — `6965482`
- [x] F4b [impl] — Colonne Rate e Cost nate sul registro, marca del parziale — `56d0ba7`
- [x] F5a [impl] — La colonna Daily rate nel dialogo People — `3787f43`
- [x] F5c [impl] — La lista dei periodi di tariffa, generalizzata — `00d7a19`
- [x] F5b [impl] — Il campo `Currency` nel dialogo People — `bd24e98`
- [x] F6a [impl] — La regola della cella costo/tariffa, in un posto solo — `2795c7d`
- [x] F6b [impl] — Il costo nel pannello dettagli — `1362652`
- [x] F8 [impl] — Colonne e banda di testata in `planFigure` — `fa4fd44`
- [x] F9 [impl] — La ragione del costo di un summary non nomina un assente — `12e1006`
- [x] F14 [self] — Nessuna testata di colonna sia tagliata — `7db1229`
- [x] F15 [self] — La cella di costo di un summary parziale e' tagliata — `a737711`
- [x] F10 [self] — `currencyLabel` e l'effort non costato in un posto solo — `4d27480`
- [x] F11 [self] — README e `agentApi.help.md` dicano che il piano costa — `5d1d953`
- [x] F12 [impl] — `toDraft`/`toResources` estratte in `resourceDrafts.ts` — `73bf870`
- [x] F16 [self] — `€` come currency preimpostata di un progetto nuovo — `b4e2b41`
- [x] F13 [self] — I numeri si leggano in colonna — `dbf747e`
- [x] F17 [impl] — La matrice misurata di dove la testata taglia — `9e78b44`
- [x] F18 [self] — Due affermazioni troppo larghe, ristrette al vero — `a37a7b6`
- [x] F19 [self] — I due adiacenti della review — `442a005`
- [x] F20 [self] — Le due COHERENCE della terza review — `db8b50c`

Cio' che il goal ha deciso e che non va riproposto: la **tabella costi a se'**
con breakdown per persona e per periodo resta in giacenza (si compra dopo aver
lavorato con le colonne); **nessuna tariffa di default di progetto** (nasconde
chi gira su una stima); **nascosto = non costruito**, mai `hide: true`, che nei
typings e' PRO e non e' stato sondato; la selezione delle colonne e' **view
state** in `localStorage['yagni.columns.v1']` — niente undo, niente dirty,
nessuna op agent; e `rate`/`cost` sono marcate `clientSafe: false`, quindi
fuori da un export cliente per default. Il campo tariffa e' `type="text"` con
`inputMode="decimal"` per scelta: la regola vive in `validateResources` e
**sola**, e un input `number` ci metterebbe una seconda regola muta.

Resta aperto, e ognuno e' una decisione dell'utente, non un difetto:
- **`applied()` (`resources.ts:48`) scrive `availability ?? 1` a ogni
  `updateResource` dell'agent API** — il gemello della regola che F12 ha
  appuntato sul dialogo People, scopato fuori da F12 per decisione. Offerto
  due volte, rimandato due volte; `docs/file-format.md` lo dichiara onestamente
  nominando i due percorsi separati. **Da riproporre come task.**
- Il periodo tariffa seminato a `0` su una persona senza tariffa di default
  (`RatePeriodList.tsx`): l'**unico** posto dove la UI fabbrica uno zero.
- Due conseguenze dichiarate del `type="text"`: `6e2` passa come 600 e `0x10`
  come 16 senza segnalazione, e una tariffa con molti decimali si rivede
  intera nel campo (`100.567`) e arrotondata in griglia (`100.57`).
- La testata `Rate`/`Cost` **della figura** ellissa oltre tre e oltre cinque
  caratteri di currency (`docs/view.md` porta i due numeri): `figureWidth` e'
  un budget a se', lasciato intatto di proposito da F14, F15 e F17, e lo
  ridecide il dialogo di export di Goal G. La testata **in griglia** invece
  entra: la trovata di F13 a 62px l'ha chiusa F14 allargando a 84/98, e la
  matrice di F17 la misura a 67.14 in 84.
- Le celle che F3b ha dichiarato non guidate restano non guidate.

**Rilasciato `v1.3` il 2026-09-18**, confermato dall'utente: la rinomina
dell'heading e nient'altro. Misurato passando le due regex di `parseChangelog`
sul file vero invece di dedurlo: la testata in cima e' `v1.3 — 2026-09-18` coi
suoi quattro bullet, quindi il badge si muove e il changelog si riapre una
volta per tutti.

## Goal C — valutazione mobile-friendly                              [aperto]
Agevolare la visualizzazione da smartphone/tablet nascondendo le azioni
superflue; non tutto deve funzionare da mobile.

Misurato di passaggio dal critic di F5a, e da non ri-supporre: il dialogo
People a 728px **non sfonda** sotto i 776px di viewport (dove
`width: min(var(--dialog-width), calc(100vw - 48px))` inizia a stringere) —
`table-layout: fixed` comprime solo la colonna Name, fino a 0px a ~452px di
spazio disponibile, con `scrollWidth === clientWidth` su tutto l'intervallo
provato. Degrada, non si rompe.

- [ ] T16 [opus] — Valutazione mobile: audit + proposta
      Scope: audit dell'app a viewport smartphone (375px) e tablet (768px),
      touch emulato; censimento azioni/controlli e proposta di cosa nascondere
      o adattare per una modalità di visualizzazione mobile (non editing
      completo). Output: report con opzioni e raccomandazione — NESSUNA
      implementazione; i task implementativi si scopano dopo, col confronto
      utente.
      Depends: soddisfatta (T13-T15 e T18 chiusi: l'audit gira
      sull'UI finale, collapse della griglia incluso).

## Goal E — la vista si legge senza leggerla tutta                   [chiuso]
`GanttChart.tsx` sotto le 1300 righe in cinque commit di puro spostamento, per
togliere il costo di contesto: ogni task di Goal D aveva speso 100-350k token a
ricostruire il contesto di un file da 2228 righe. Consegnato: **2228 → 1205**,
sei moduli piatti in `src/gantt/`. Goal review dell'11-09: **fix-first**
(fable-5-1 in header), MISSING e SMUGGLED vuoti, unica COHERENCE chiusa da T51.
Misurato dalla review sul diff accumulato: le sole righe `+` nel chart sono
import, il letterale `RowContext` e 12 call site; nessuna logica nuova oltre le
firme; la sequenza di init e' ancora **una lista lineare in un posto solo**, coi
tre vincoli d'ordine annotati accanto alle chiamate; e la cucitura che T33 §5b
chiedeva e' esposta come export normali (`widestLabelWidth`, `appliedScrollX`,
`nonWorkingSpans`). Il blocco di import del chart e' ora l'indice del modulo.

- [x] T44 [impl] — S1: `ganttHandle.ts` — `90855c0`
- [x] T45 [impl] — S2: `zoomLevels.ts` + `timelineGeometry.ts` — `25f6a54`
- [x] T46 [impl] — S3: `timelineOverlays.ts` — `ed64f5c`
- [x] T47 [impl] — S5a: `ganttRows.ts` — `e740d94`
- [x] T48 [deep] — S4: `gridColumns.ts` — `bd020a1`, docs `170f706`
- [x] T51 [self] — La convenzione dei nomi che la review ha smentito — `bd092bf`

Cio' che il goal ha deciso e che non va riproposto: **S5b, S6 e S7 restano
fuori** (S5b unifica la mappa riga — l'unica fetta che cambia forma, in
giacenza finche' un goal non aggiunge campi di riga — lane deep, e la verifica
e' parita' dei campi via `gantt.getTask(id)` dopo apertura/edit/undo su un piano
con summary, milestone, condivisa, disabled e critico stale, **senza pixel**;
S6/S7 su `App.tsx` e i gesti, raccomandati contro dalla spec). Il corpo del handle (268 righe) e gli
handler del modello restano nel chart per scelta: sono le operazioni e il
codice che muta il modello, e il file di destinazione sarebbe grande quanto
quello che lascia. Nessuna release: cinque fette di refactoring, e il
changelog non prende plumbing.
Due trappole graduate nei docs invece di restare qui: lo slot di config che non
deve un detach, e la lettura di `gantt.config.*` a livello di modulo che
precede il corpo del componente (`docs/dhtmlx.md`).

## Goal D — creare una dipendenza senza mirare a 10x10 px            [chiuso]
Rendere afferrabile l'handle del link e togliere l'ambiguita' semantica del
gesto. Goal review del 2026-09-10: **ship** (fable-5-1 confermato in header),
MISSING e SMUGGLED vuoti. Misurato dalla review nell'app: 24/24 px dell'handle
destro appartengono al pallino su ogni foglia, sul summary e sul task gia'
linkato, 17/17 sulla milestone, a Days/Weeks/Months e in entrambi gli schemi —
cioe' tutti i casi che la §9 di T26 non aveva misurato. I gesti SS/FF/SF
rifiutano senza toccare nessuno start; l'undo di un link creato col mouse
funziona. Nessuna release: i tre task sono fix, e il changelog non prende fix.

- [x] T41 [impl] — L'handle del link sotto la label, e il gesto che mente — `d970ca0`
- [x] T42 [impl] — Il banner di rifiuto che non se ne va — `9630ea5`
- [x] T43 [impl] — Il banner che sposta la riga sotto il mouse — `fbd4507`,
      docs `210a1bf`, commento z-index `1bf79cc`

Cio' che il goal ha deciso e che non va riproposto: l'overlay del banner copre
per intero la testata della griglia finche' resta a schermo, ed e' persistente
sul solo errore di apertura file — misurato e **accettato dall'utente** sotto
la regola dell'80%. Restano fuori scope per decisione sua: l'editor delle
dipendenze (O4, in giacenza), l'handle sinistro visibile (O2b), il modale
vendor (O3b), l'alzata della label (O5). Adiacente, sotto il bar, da registrare
solo se un utente lo segnala: un drag che parte dal *testo* della label (3 px
oltre il pallino) muove ancora la barra — default vendor.

## Maintenance — no goal
Task che non servono una milestone: difetti puntuali e salute del codice,
arrivati come richieste singole. **Non ricevono la goal review**, ed e' il
prezzo di stare qui — dichiarato adesso, non scoperto alla fine. Se uno di
questi cresce fino a meritarne una, si apre un goal e lo si sposta.

- [x] T64 [utente + hub] — Rinominare il repo in `arrogantt` e ripubblicare
      Pages — **nessun commit suo**: il lavoro sta fuori dal repo. Chiuso il
      2026-09-18. L'utente ha rinominato, l'hub ha ripuntato `origin` e spinto.
      Misurato e non dedotto: badge del workflow `deploy.yml` **passing** sul
      **nuovo** URL del repo (l'API Actions era rate-limited non autenticata e
      `gh` non c'e', quindi il badge SVG e' lo strumento che restava);
      `https://okon3.github.io/arrogantt/` **aperto davvero** nel browser, DOM
      sondato — 13 bottoni di toolbar, host dhtmlx montato, testata
      TASK/RESOURCE/EFFORT/START/END/DURATION, `window.yagni` con 33 op,
      console pulita a parte la riga informativa dell'app, e **il badge di
      versione legge `v1.3`**: la release si verifica nella build servita, non
      solo nel file locale. `ganttRows: 0` e' corretto, progetto vuoto.
      **`https://okon3.github.io/yagni/` risponde 404**, come previsto: Pages
      e' la sola cosa che non redirige. Chi ha il vecchio link va avvisato.
      Premesse rimisurate prima di partire e tutte confermate:
      `base: './'`, `enablement: true`, deploy sul push a `master`.
      **Trovato di passaggio**: `origin/master` era gia' a `642d84f` con
      reflog `update by push` — una sessione sorella ha spinto da questa
      working tree senza avere il lock. Contenuto identico alla storia
      dell'hub (`git diff HEAD~1..origin/master` vuoto), quindi innocuo, ma e'
      la seconda volta che succede.
      **Resta in piedi, e vale per sempre: non ricreare `okon3/yagni`.** I
      redirect di web, API e git che tengono vivi i cloni esistenti muoiono
      nell'istante in cui qualcuno rioccupa il vecchio nome.

- [x] T65a [impl] — ARROGANTT dentro il repo: nome, agent API, chiavi, docs,
      README — `51de948`. 21 file. `window.arrogantt` per intero, nessun alias, le
      tre chiavi di `localStorage` rinominate **senza migrazione** (decisione
      dell'utente presa coi costi davanti: draft non salvato perso, changelog
      riaperto una volta, colonne al default, tre chiavi vecchie orfane e
      nessun `removeItem` a ripulirle). La voce **v1.0** del changelog
      rinominata — decisione dell'utente del 2026-09-18 **contro** la
      raccomandazione dell'hub, che proponeva di lasciarla come cronaca; e un
      bullet sotto `## Unreleased`, che resta il primo heading.
      **Il censimento precedente era sbagliato e l'ha scoperto l'hub
      rimisurando prima di briefare**: 22 file tracciati, non 12. Quattro
      occorrenze non c'erano — `EmptyState.tsx` (`<h2>`), `StatusBar.tsx`
      (testo visibile), **il brand in testata** e un commento in
      `planFigure.test.ts` — `docs/verification.md` ne aveva 5 e non 2, e la
      chiave delle colonne stava 49 righe piu' giu' di quanto scritto. **I
      numeri di riga vanno a deriva: si ri-localizza per simbolo.** Senza la
      rimisura il task avrebbe spedito un'app che si chiama ARROGANTT nel
      titolo della pagina e YAGNI in testata.
      **E una premessa dell'hub era sbagliata nella forma, ribaltata dalla
      corsia misurando**: il brief trattava brand ed espansione come due slot
      in flusso nella barra e chiedeva di misurare l'overflow di una stringa
      44 caratteri contro 31. `.app__expansion` e' `position: absolute;
      opacity: 0`, mostrata solo su hover/`focus-visible`: **fuori dal flusso
      per costruzione**, quindi una stringa piu' lunga gonfia solo il box del
      tooltip. La ragione sta in `App.css:40-41` — dov'era gia', e vale
      identica per il nome nuovo: **non e' stata duplicata nei docs.**
      Misurato (hub, `grep`/`diff` sul tree): accept meccanico
      `git ls-files | grep -il yagni` → **solo** `PLAN.md` e `favicon.svg`;
      `npm test` 559/559 su 25 file, build e oxlint exit 0; la regex vera del
      parser (`changelog.ts:7`) combacia **prima** su `v1.3`, quindi il badge
      non si muove e i bullet di Unreleased restano fuori dal dialogo;
      `dist/llms.txt` byte-identico ad `agentApi.help.md`; nessun
      `removeItem`; identificatori ed export delle tre costanti intatti;
      `package-lock.json` rigenerato con npm, solo il campo `name`; nessuna
      traccia dell'acronimo vecchio.
      Misurato (hub, browser, sessione propria) — **le celle che il critic ha
      dichiarato non raggiunte, cadendo su un rate-limit a 92k**: con
      `yagni.draft.v1` in storage l'app parte **pulita**, zero `dialog[open]`
      letti dal DOM e zero task adottati; al primo edit compare
      `arrogantt.draft.v1` (`project.gantt`) e la vecchia e' **byte-identica**,
      orfana e non letta; `arrogantt.seenVersion` porta `v1.3`; spuntando Rate
      nel picker compare `arrogantt.columns.v1` con `rate` in coda e la
      colonna compare davvero in griglia, mentre `yagni.columns.v1` non nasce
      mai; `<h2>` ARROGANTT e `document.title` letti dal DOM vivo; **con un
      progetto aperto** a 1264px la barra non trabocca (`scrollWidth` =
      `clientWidth`, overflow del documento 0).
      Misurato dal critic: `/llms.txt` identico **dopo un riavvio a freddo**
      del server (il plugin vive in `vite.config.ts`, che era toccato), 33 op
      sull'oggetto vivo, `window.yagni === undefined`, e il tooltip **mostrato**
      con hover reale a 1264 e 768px — bordo destro 312.7, dentro entrambi.
      **Non guidato**: nessun viewport sotto 768px; la testata a viewport
      stretto **con un progetto aperto** (il CLI di questa sessione non ha un
      `resize`); il trigger `:focus-visible` del tooltip separatamente da
      `:hover`; i sei link del README in rete (verificati vivi dall'hub in T64,
      qui conta il testo).

**Misurato dal critic di T65a e deliberatamente non aperto come task**: il
bottone «Fit» della `.statusbar` fa traboccare il documento gia' a 768px di
viewport (bordo destro 955px su 768 di clientWidth), in empty state.
**Preesistente e scollegato dal rename** — nessun file della `.statusbar` e'
stato toccato per la larghezza. Stessa logica del popover che non segue il
resize: sotto la regola dell'80% non vale un meccanismo, e se qualcuno segnala
il layout sotto gli 800px si guarda **tutta** la status bar in una volta, non
un bottone.

- [ ] T65b [self + utente] — Rifare i due screenshot di `docs/assets/`
      **Va dopo T65a**: devono mostrare il nome nuovo. Deciso dall'utente il
      2026-09-18, che ha anche confermato che la UI nel frattempo e' cambiata.
      Non e' solo il nome: `hero.png` e' del 2026-09-04 e **la sua UI e' in
      italiano**, mentre l'app e' inglese end-to-end (`setLocale('en')` cablato
      in `GanttChart.tsx:699`, nessun dizionario italiano in `src/`) — lo
      scarto piu' netto dei quattro che il critic di F11 ha misurato contro lo
      stato di default di oggi; gli altri tre sono Effort e Duration centrati
      invece che allineati a destra (F13), i due bottoni nuovi in toolbar
      (comprimi griglia, scelta colonne) assenti, e il badge di versione
      assente. `resource-load.png` non e' stato confrontato: va guardata prima
      di rifarla o di tenerla.
      **La composizione e la fixture sono dell'utente** — e' la vetrina, non
      una prova: si chiedono prima di scattare, non dopo.

**Notato dal critic di F7 e deliberatamente non aperto come task**: il
popover del picker si posiziona una volta dall'ancora catturata all'apertura
e **non segue un resize della finestra** (misurato: da 760 a 500px di
larghezza resta a left 475 / right 645, cioe' fuori dal viewport). E' la
stessa forma di `RowMenu`, che ha lo stesso comportamento da sempre e che
nessuno ha segnalato: sotto la regola dell'80% non vale un meccanismo nuovo.
Se qualcuno lo segnala, si aggiusta **una volta per entrambi**, non due.
- [x] T63 [impl] — Il popover delle colonne non prende il fuoco — `8c93dd9`.
      Difetto misurato dal critic di F7: dal bottone alla prima checkbox
      c'erano **14 fermate di Tab**. Ora il fuoco va sulla prima checkbox
      all'apertura (`.focus()` esplicito nell'effect di posizionamento, il
      precedente di `RowMenu.tsx:73` — `setAutofocus` non serve, quell'attributo
      lo onora `showModal()` e questo `<dialog open>` non ci passa mai), Escape
      chiude e **restituisce il fuoco al bottone**, Tab/Shift+Tab ciclano solo
      le checkbox avvolgendosi ai due estremi.
      **La trappola vera era un'altra, e l'ha trovata la corsia misurando**:
      catturare il bottone in un `useEffect([])` non funziona. StrictMode monta
      gli effect due volte e l'effect che sposta il fuoco gira **in mezzo**,
      quindi la ref finiva per tenere la checkbox e Escape lasciava il fuoco su
      `<body>`. La lettura in fase di render e' l'unica corretta: niente sposta
      il fuoco fra le due chiamate di render. La ragione sta nel commento del
      file, **una volta sola** — non e' stata duplicata nei docs.
      Guidato nel browser (hub: checks verdi sul tree; corsia e critic in due
      sessioni browser separate, `activeElement` misurato cella per cella):
      apertura da tastiera con Enter **e** con Space, apertura col mouse,
      Escape, click fuori (fuoco su `BODY`, **non** sul bottone), Tab su tutte
      e 7 le voci del registro coi due wrap, riapertura dopo Escape (opener
      ricatturato, nuovo mount), toggle della terza **e** della settima
      checkbox col fuoco che resta, la colonna che compare/scompare in griglia,
      console pulita. **Accertato prima di misurare l'accept**: l'harness muove
      il fuoco nativamente su Tab (New → Open a picker chiuso), quindi la
      trappola e' provata su un Tab vero e non solo sul proprio handler.
      **Non guidato**: il resize della finestra (fuori scopo) e la build di
      produzione. `RowMenu`, `columns.ts` e il chiamante in `App.tsx` intatti.

- [x] T57 [impl, chiuso dall'hub] — Il changelog leggeva un CRLF e buttava i
      bullet — `4a804ba`. La premessa del task era sbagliata e la misura l'ha
      ribaltata subito: **la build single-file non c'entrava**. Una stringa
      importata con `?raw` e' cotta nel chunk JS molto prima che
      `vite-plugin-singlefile` giri, e il testo dei bullet e'
      verificabilmente dentro `dist/index.html` (misurato). Quella build era
      solo l'unico posto dove quel dialogo veniva aperto.
      Il difetto vero: `CHANGELOG.md` arriva al parser dalla **copia di
      lavoro**, quindi coi terminatori del checkout e non del repo — blob LF,
      copia locale CRLF, e `git status` pulito perche' `core.autocrlf=input`
      normalizza in commit. Con un `\r` in coda a ogni riga `HEADING`
      sopravvive (il gruppo della data non e' ancorato alla fine) e `BULLET`
      no: `.` non attraversa un terminatore di riga, quindi `$` non ha piu'
      nulla da combaciare. Misurato sul file vero: 0 note su tre entry, 6/3/2
      dopo normalizzazione.
      Verificato nella build single-file servita via http: badge `v1.2`, tre
      sezioni con 6, 3 e 2 bullet, zero errori in console. Il test nuovo
      fallisce senza il fix (provato con stash), che e' cio' che lo rende un
      pin e non una speranza.
      Scartato: un `.gitattributes` che forzi LF — mascherava il sintomo e
      lasciava la fragilita' nel codice.
      **Trovato di passaggio e non toccato** (fuori dal bar di T57): la build
      «single« emette anche `favicon-*.svg` e `llms.txt` **non inlinati**, quindi
      distribuire il solo `index.html` perde la favicon. Da scopare come task
      se l'utente lo vuole.

- [x] T58 [impl] — Dove finiscono i sottotask e dove comincia il task dopo —
      `ef49d16`.
      `gantt-row--group-start` su ogni task di **primo livello** (figli o no),
      griglia e timeline: marcare l'inizio di un blocco costa un confronto su
      un campo che la riga porta gia', marcarne la fine vorrebbe camminare i
      fratelli a ogni render. Segnale: `box-shadow: inset 0 2px 0`
      in `--line-strong`. Zero correzioni alla corsia; cinque findings del
      critic, tutti testuali, tutti chiusi dall'hub.
      **Due premesse dell'hub cadute nello stesso task.** La prima l'ha
      ribaltata la corsia: «ombra e background sono ortogonali per
      costruzione» e' falso — `gantt-found` disegna a sua volta un
      `box-shadow` sulla riga, e due `box-shadow` alla stessa specificita' non
      si fondono, uno vince in silenzio e il bordo accento della ricerca
      spariva. Chiusa con due regole composte, non indebolendo le esistenti.
      La seconda l'ha ribaltata il critic: «un `border-top` fa crescere la box
      della riga» e' falso — le righe sono `border-box` con `height` inline.
      Il border sfasa davvero i due pannelli, ma di un offset costante che
      compare **solo a griglia scrollata** (2px, uguale su ogni riga, nessun
      accumulo; l'ombra inset misura 0 a ogni posizione di scroll). Il brief
      la diceva condizionata, il codice e il doc hanno scritto il consequente
      come fatto, in due copie. Graduato in `CLAUDE.md`: una premessa
      condizionata perde la condizione per strada, e un fatto scritto due
      volte si corregge una volta sola.
      Misurato dal critic e non dalla corsia (celle che la fixture non aveva
      composto): milestone di primo livello e di sottolivello, riga
      `gantt-row--disabled`, catena critica, highlight di risorsa, load panel
      aperto, rami chiusi, `gantt-found + gantt_selected`, due schemi, Days e
      Months. Nessuno stato perde un'ombra. `task.parent === root_id`
      confermato su `toGanttData`, `addTask` e `setParent(id, null)` guidati
      dal vivo; **non guidati e dichiarati tali**: il drag-and-drop della
      griglia e la colonna `+` (letti: copiano il parent da una riga che tiene
      gia' 0).
      **Chiuso dall'utente, non riproporre**: il critic aveva notato che la
      prima riga di dati e' sempre un inizio di gruppo, quindi il suo segno
      raddoppia il bordo inferiore della testata e non separa da nulla. Aperto
      come T61 e poi **scartato su sua decisione** — il bordo extra in cima si
      accetta. La misura che sarebbe servita (se l'ordine DOM delle righe regge
      a griglia scrollata, o se `:first-child` seguirebbe il DOM invece dei
      dati) resta **non fatta**, e va rifatta se qualcuno riapre la questione.

- [x] T56 [deep] — Un id che il progetto non conosce, tenuto fuori dal modello
      e fuori dal file — `8fd9a1c`. Due guardie comprate dall'utente dopo tre
      misure: `pullFromView` e `onAfterTaskAdd` non copiano nel modello un
      `resource_id` che il progetto non riconosce; `serializeForFile` rifa il
      giro dal parser su cio' che Save e `toText()` stanno per consegnare, cosi'
      l'app non scrive piu' un file che il proprio gate rifiuta di riaprire.
      L'error boundary, terza opzione sul tavolo, **e' stato scartato su
      misura**: il throw non raggiungeva un render se non su una sessione
      vergine, e li' l'ha chiuso una riga — `solve` al mount reso pigro, che era
      l'unico solve sul percorso di render.
      Il difetto vero non era quello con cui il task era stato aperto: non la
      pagina bianca (che il draft sopravviveva comunque, misurato: zero edit
      persi), ma il salvataggio che **riusciva** scrivendo un file irrecuperabile
      mentre l'utente non vedeva nulla e gli edit avevano smesso di entrare.
      Due giri di critic, quattro findings in tutto, tutti chiusi; gli ultimi due
      erano lo stesso commento sbagliato in due file — la premessa dello
      smontaggio, sopravvissuta alla propria correzione a un file di distanza.
      Graduato fuori dal piano: la semantica dello stallo in
      `docs/scheduling.md`, la trappola d'identita' fra prop e modello vivo in
      `docs/view.md`, il gate in uscita in `docs/file-format.md` e `CLAUDE.md`,
      `toText()` che solleva in `agentApi.help.md`, e la lezione di metodo
      («una premessa si verifica sul percorso che la usa») in `CLAUDE.md`.
      Non guidati e dichiarati tali: un file che atterra davvero su disco (lo
      strumento annulla il download di un blob, misurato a `createObjectURL`),
      e il conteggio delle invocazioni di `solve` per render.

- [x] T55 [deep] — Una risorsa rimossa tornava dal morto attraverso la riga —
      `1881fd4`. `applySolution` scrive `resource_id` (una riga): la riga
      rispecchia anche gli **input** del modello, non solo la risposta del
      solver — `nominal_days` stava li' da sempre, `resource_id` no. Sito scelto
      contro `setResources` perche' chiude la classe per ogni strada che finisce
      nel funnel dell'undo, non solo per quella di oggi. Il critic ha trovato
      quattro difetti testuali, tutti chiusi dall'hub: una regola nei docs
      allargata al punto da autorizzare `open`/`parent` dentro `applySolution`,
      il commento e il bullet che raccontavano il difetto al passato, e un
      riferimento scaduto in `docs/verification.md`.
      **Cio' che T55 ha misurato qui regge, ma solo su meta' dei percorsi**, e
      T56 ha impiegato tre misure a capire quale meta': `#root` va davvero da 1
      a 0 su una sessione **vergine**, dove il modello vivo e' ancora la
      costante di modulo che il render risolve; dopo un `loadText` o un
      `newProject()` non si smonta niente e il throw resta nell'handler.
      Dettagli in T56.
      Sulla condizione esatta corsia e critic **non concordavano**: chiusa dalla
      misura 1 di T56 — sbagliavano entrambi, un `resourceId` sconosciuto su un
      task con effort solleva **sempre**.

- [x] T54 [self] — Graduare lo schema della riga, poi seppellire T32-report —
      `c6bac0c`. Il ragionamento di §2.3 (stringa vs `Date`, identita' e stato
      di vista scritti dal solo parse e perche', la regola dei soli campi
      derivati, la premessa non verificata su `gantt.parse`) sta in
      `docs/view.md` § Grid con riferimenti riaperti sul codice post-refactoring;
      `.claude/specs/T32-report.md` cancellato. La ricognizione ha trovato cio'
      che il report non diceva: un'asimmetria viva fra i due percorsi — T55.

- [x] T53 [deep] — Il calendario entra senza gate, su tutte e due le strade —
      `532a4e4`. `validateCalendar` (`calendarRules.ts`) su agent API, file e
      dialogo; regole e gate in `docs/file-format.md`, unita' e rifiuti in
      `agentApi.help.md`. Due fatti sul motore, misurati, che valgono oltre il
      task: il tab piantato **non e' il NaN** ma `workingDays` fuori da `0..6`
      — il walk `while (!isWorkingDay(day)) day++` del costruttore non ha
      bound, a differenza di `startOfWorkingDay` che porta un `limit`; e
      `expandRanges` **salta** un endpoint malformato invece di fallire,
      quindi una chiusura con data sbagliata copriva niente in silenzio.

- [x] T52 [impl] — Il censimento dei tasti — `3d46c71`. Assorbiva T50. I fatti
      stanno nel censimento di `docs/verification.md`; la regola «un censimento
      si scrive come matrice di celle guidate, non in prosa» in `CLAUDE.md`.

- [x] T49 [impl] — Un Tab salta una cella nell'editor della griglia — `bdcb120`.
      `editorKeys` si tira indietro su `event.defaultPrevented`. Il critic ha
      trovato quattro premesse stantie nel censimento, tutte chiuse; matrice e
      conteggi (bordi riga e `keyCode: 0` inclusi) in `docs/verification.md`.

- [x] T40 [self] — L'ultimo descendant override di una primitiva di dialog — `1d2cb2e`
- [x] T36 [self] — Tracciare il piano e il binding in git — `35483e0`

- [x] T31 [impl] — Il pixel di scroll: premessa falsa, nota nei docs corretta — `d9d2356`

**Due proposte offerte all'utente e non comprate** (non sono task: nessuno le
ha scopate, e vanno riproposte solo se qualcuno le vuole):
- Caricare `keyboard_navigation` in una sonda usa-e-getta per misurare cosa
  rivendica davvero. La clausola «a mode that would claim arrows and Del,
  which App owns» vive in `docs/dhtmlx.md` e in `GanttChart.tsx:815` ed e' una
  premessa `would` mai verificata: il critic di T52 l'ha giudicata salva **per
  scope** (il soggetto e' un'extension non caricata, non l'handler
  dell'editor), quindi non e' un difetto — solo l'ultima premessa non misurata
  rimasta in quella zona. Solo caricarla la chiude.
- La soglia dei 10px delle bande e la regola «nessuna banda su un summary o su
  un ramo chiuso» vivono ora in `timelineOverlays.ts`, importabile, ma sono
  appuntate solo dalla misura nel browser. Un test le fisserebbe, al prezzo di
  un mock di `gantt`.

- [x] T26 [architect] — UX dei link: analisi consegnata, tre premesse del
      piano cadute — `.claude/specs/T26-report.md`, trappole nei docs `a026435`
- [x] T32 [architect] — Riorganizzazione della vista: censimento, tagli, piano
      — `.claude/specs/T32-report.md`, note nei docs `9b735a6`. La guardia ha
      tenuto: l'analisi resta manutenzione, i task implementativi **no**. Il
      goal si apre dall'enunciato proposto in §5 del report, con le fette che
      l'utente compra — non prima.

## Analisi in giacenza — non e' un task, e' materiale per decidere

- `.claude/specs/T33-report.md` — costo della verifica nel browser. La leva 3
  e' fatta (T34: porta fissa, `dev:fresh`). Restano le leve 2b (primitive
  dev-only), 2a e 1 (test in browser mode), in quest'ordine: 2b e' il
  *prerequisito* di 1, non un'alternativa. L'utente ha fermato
  l'investimento dopo la leva 3 — tooling per abbassare il costo dei task
  rimasti si ripaga sul goal dopo, non su questo. Da riproporre solo con un
  goal nuovo. **Prima di scopare la leva 1**: provare che la browser mode di
  vitest parta su questa macchina Windows, mai fatto.
- `.claude/specs/T26-report.md` — UX dei link, tutto misurato nell'app. O1, O2
  e il banner sono chiusi con Goal D, ma **non cancellarlo**: e' il materiale
  di O4 (editor delle dipendenze), l'unica delle sue opzioni ancora in
  giacenza, e senza il report O4 si riaprirebbe da zero. Lo sweep degli orfani
  lo prenderebbe, T26 e' `[x]`. La sua §9 non serve piu' come lista di lacune:
  la goal review di Goal D le ha misurate tutte (schema chiaro, altri zoom,
  summary, milestone, undo della creazione) e reggono.

## Log
- **Dimensionamento**: impl oltre ~200k = task da splittare (T35, F7 257k, F1
  222k, F4b 228k); splittato rende 80-170k a meta'. **Si taglia la campagna di
  verifica, non il codice** (F5a 215k e F5c 242k ri-splittate sul codice
  risalgono; toglierla del tutto non rende economico il task, F8 146k). Una
  correzione via SendMessage costa meno di un fresh spawn (~40k). **Il critic
  e' la voce piu' cara e la piu' redditizia**: 75-95k a tavolino, 102-242k nel
  browser, 128-191k la goal review; su T58 ha ribaltato una premessa, su F8 il
  pin da `git show`, su F9 e F14 un overclaim dell'hub. **Una review a cui si
  dice che un terzo `fix-first` non e' gratis rende COHERENCE invece di ACTIONS
  e spedisce** (terza di F, 128k): due difetti veri, sotto il bar, dichiarati
  tali.
- **Un elenco enumerato da una sezione di spec e' completo o non e' un elenco.**
  F2b ha taciuto un filtro, F3b una tabella da cui dipendeva la fixture, F8 ha
  ristretto «the widest string of each» alla fixture e la piu' larga legale era
  una testata. Vale per chi consegna, per chi implementa, per l'hub che briefa.
- **Le misure piccole le fa l'hub**: probe vitest usa-e-getta (T56), Explore
  non residenti (T57), il censimento di F14 nel browser — un task a testa dove
  una corsia paga 40k di solo ingresso. **Prima di briefare, misurare la
  premessa**: se cade, il brief non serve.
- **Una citazione copiata non e' verificata**: ne' un `file:line` (T43), ne' un
  tipo (T48), ne' un predicato (F6b), **ne' il nome di un'op** — F12, F18 e il
  brief della terza review si sono passati `resourceUpdate` per tre mani, e
  l'op e' `updateResource` (F20). Si ri-localizza, e si cita per simbolo.
- Il critic trova cio' che l'accept non chiedeva: e' la regola, non l'eccezione
  — si briefa chiedendogli **la domanda che fa paura**, e su uno spostamento
  **l'hash, non la lettura**.
- **Cio' che una corsia dichiara impossibile o preesistente va confrontato con
  l'evidenza**: T43 dava il drag reale per non guidabile, T41 e F4b l'hanno
  fatto. Su T48 fatto bene: misurato su HEAD **e** sul tree.
- **Una ragione registrata male in un doc e' peggio di nessun doc**: tredici
  volte in Goal F (F7, F5c, F5b, F6a, F6b, F9, F14, F15, le tre azioni della
  seconda review e le due della terza), quasi sempre dall'hub. Si verifica sul
  percorso che la usa, non sulla riga che la enuncia, **e riscriverla non la
  ripara** (F9). Chi enumera superfici dica quale rende il campo (F10); **un
  numero ereditato non e' misurato** (F15: ~5.5px da F14, 12.47 i veri) e
  **una misura non si eredita nemmeno da se stessi** (F15 ha allargato Cost
  senza rimisurare la frase di view.md). **Una soglia misurata su una colonna
  si generalizza alla vicina**: F8 aveva i due numeri di `figureWidth` e ha
  scritto solo quello di `rate`, e la frase e' sopravvissuta a F14, F15, F17 e
  a due review (F20).
