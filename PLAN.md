# Plan

## Cosa resta sul tavolo

Goal D, E, F, G e H sono **chiusi, recensiti e potati**; le loro Accept lines
sono cadute dopo la review, come vuole la regola. Ultima release **`v1.5`**;
i bullet di H (figura per il cliente: nessuna colonna, nessun task
disattivato) aspettano sotto `## Unreleased` — scelta dell'utente, il badge
resta a v1.5 e il rilascio si fa quando serve distribuire una build.
**Goal I** e' aperto (descrizione per task) ma non ancora avviato: ha domande
di prodotto da chiudere con l'utente e una suddivisione dichiarata
provvisoria. `## Maintenance` porta T16 (audit mobile) e T17 (nome del task
in hover); Goal C aspetta quel report prima di ricevere task veri.

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

**Da misurare prima di briefare, non da supporre.**
- Una descrizione di 2000 caratteri con a capo dentro, dentro una cella CSV:
  `planCsv.ts` gia' quota e fa l'escape dei newline? Da leggere, non da dare
  per scontato — e' l'unica superficie di questo goal che porta il testo
  fuori dall'app.
- Se il limite di 2000 si imponga nella textarea (`maxLength`), nel parsing,
  o in entrambi. Il gate di `serializeForFile` rifiuta e non ripara: un file
  scritto a mano con 5000 caratteri va **rifiutato**, non troncato in
  silenzio.

**Fatto verificato il 2026-09-21, che risparmia un round.** `ProjectTask`
(`project.ts:30-48`) tiene `disabled?: boolean` con una regola scritta nel
commento: **si conserva solo `true`**, perche' l'assenza e' lo stato di
default e un `false` scritto in un file o in uno snapshot sarebbe una seconda
grafia su cui il confronto di `dirty` litigherebbe. Una `description?: string`
ha **esattamente** la stessa trappola: `''` e assente devono essere una cosa
sola, o salvare-riaprire sporca il progetto senza che nessuno abbia toccato
niente. Vale per il parsing strict, per `serializeProject` e per il gate di
`serializeForFile`.

**Versione del formato**: un campo opzionale non rompe i file esistenti —
bump **minore**, non maggiore (`CLAUDE.md`: il maggiore e' solo per una
rottura del formato `.gantt`).

**Suddivisione provvisoria — nessuno ha ancora letto il codice.** Le fette
qui sotto sono un'ipotesi di dimensionamento, non un impegno: valgono finche'
una ricognizione non le smentisce, ed e' la forma di errore che Goal G ha
pagato con mezzo goal riscritto. Da rivedere all'apertura dei lavori.
- [ ] I1 [impl] — Il campo nel modello e nel formato: `description?: string`
      su `ProjectTask`, parsing strict, serializzazione, la regola
      «vuoto = assente» sopra, e la tenuta di undo/draft/`dirty`.
- [ ] I2 [impl] — La textarea nel `TaskDialog`, summary inclusi, col giro
      completo edit → modello → `applySolution`, e il limite di 2000.
- [ ] I3 [impl] — La descrizione in CSV (`planCsv.ts`). **No** figura,
      **no** stampa.
- [ ] I4 [impl] — L'agent API: `getTask` la rende, `updateTask` la scrive,
      e `agentApi.help.md` nello stesso commit.
- [ ] I5 [self] — `docs/file-format.md`, `docs/view.md`, e il bullet di
      changelog.

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
      Depends: soddisfatta (T13-T15 e T18 chiusi: l'audit gira sull'UI finale,
      collapse della griglia incluso).

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
- `.claude/specs/T26-report.md` — UX dei link, tutto misurato nell'app. O1, O2
  e il banner sono chiusi con Goal D, ma e' il materiale di **O4** (editor
  delle dipendenze), l'unica sua opzione ancora in giacenza: senza il report
  O4 si riaprirebbe da zero. La sua §9 non serve piu' come lista di lacune —
  la goal review di Goal D le ha misurate tutte e reggono.

## Log

- **Dimensionamento**: impl oltre ~200k = task da splittare (F7 257k, F1 e
  F4b ~225k); splittato rende 80-170k a meta'. Si taglia la **campagna di
  verifica**, non il codice — ri-splittare sul codice li fa risalire, e
  toglierla del tutto non rende economico il task (F8 146k).
- **Un brief che porta gia' la fixture e i casi dell'accept si paga**: zero
  correzioni di corsia su tutti e sei i task di G e H (impl 82-197k, critic
  81-185k).
- Una correzione via SendMessage costa meno di un fresh spawn (~40k). Un
  `[self]` guidato nel browser costa **una generazione dell'hub** (T65b, zero
  deleghe, oltre 176k da solo).
- **Il critic e' la voce piu' cara e la piu' redditizia**: 75-95k a tavolino,
  102-242k nel browser, 128-191k la goal review. Trova cio' che l'accept non
  chiedeva: e' la regola, non l'eccezione.
- Si briefa il critic dandogli **le domande in ordine di paura**, e
  **vietandogli di dare entrambe le mani**: su G2 ha scelto, ribaltando
  l'esitazione dell'hub con un argomento di *tipo*, non di gusto.
- **Una review a cui si dice che un terzo `fix-first` non e' gratis rende
  COHERENCE invece di ACTIONS e spedisce** (terza di F, 128k): due difetti
  veri, sotto il bar, dichiarati tali.
- **Un elenco enumerato da una sezione di spec e' completo o non e' un
  elenco.** F2b ha taciuto un filtro, F3b una tabella da cui dipendeva la
  fixture, F8 ha ristretto «the widest string of each» alla fixture.
- **Le misure piccole le fa l'hub**: probe vitest usa-e-getta, Explore non
  residenti, un censimento nel browser — dove una corsia paga 40k di solo
  ingresso. **Prima di briefare, misurare la premessa**: se cade, il brief non
  serve. Un task di sola analisi paga bene la delega se l'hub tiene solo le
  conclusioni e rimisura da se' quelle portanti (T60: due Explore, 56k + 72k).
- **Un `pass` del critic non esime dal leggere il diff**: quello di H1 era
  pieno e mancava due difetti sotto il bar visibili **nel suo stesso report**.
- **La prosa e' cio' che resta indietro.** Su tutto Goal H, zero difetti di
  codice sopra il bar e **sette** frasi rese false dal diff: in `docs/`, nel
  README che vendeva il preset vecchio, e in due commenti che dicevano il
  contrario della riga sotto. Le trova il critic o la goal review, mai i test.
  Un grep non basta: `clientSafe` e `client-safety` sono la stessa nozione e
  solo uno dei due matcha.
- **Una citazione copiata non e' verificata**: ne' un `file:line`, ne' un tipo,
  ne' un predicato, **ne' il nome di un'op** — `resourceUpdate` e' passato per
  tre mani e l'op e' `updateResource`. Si ri-localizza, e si cita per simbolo.
