# Plan

## Cosa resta sul tavolo

**Goal E e' chiuso e potato** (review fix-first, unica azione scaricata da
T51): chart 2228 → 1205. Nessuna release — refactoring, e il changelog non
prende plumbing.

Aperti: **Goal F** (costi), la cui spec e' consegnata (T59) e che aspetta
quattro risposte dell'utente prima di scrivere i sottotask; **Goal G** (export
cliente), il cui primo passo e' ancora analisi (T60) e che **erediteva** da F
la decisione sul meccanismo delle colonne; **T16**, unico task di Goal C, che
lo porterebbe alla sua review. **O4** in giacenza. La manutenzione e' vuota. Su T60 leggere prima il fatto accertato in testa a Goal G: l'export
non fotografa il DOM.

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

## Goal F — quanto costa il piano, non solo quanto dura            [aperto]
Associare a ogni persona una tariffa giornaliera che varia nel tempo come la
sua disponibilita', e leggere sull'albero il costo di ogni riga e il totale di
progetto. Il piano oggi risponde a *quando*; questo goal gli fa rispondere
*quanto*.

Deciso con l'utente in apertura, e vincolante per la spec (non riaprire):
- **Base del costo: l'effort allocato, per segmento.** Ogni segmento della
  simulazione (rate x durata) si converte in giorni-uomo e si moltiplica per
  la tariffa vigente *in quel segmento*. Un task a cavallo di un aumento si
  spezza sui due prezzi. E' la sola lettura coerente con l'invariante
  dell'effort conservato, e la sola in cui una tariffa variabile nel tempo
  significhi qualcosa. Scartate: tariffa congelata allo start (la variabilita'
  diventa decorativa) e durata di calendario x tariffa (ignora il rate: una
  persona al 50% costerebbe il doppio, e la contesa fra task farebbe salire il
  prezzo).
- **Costo assente non e' zero.** Task senza risorsa o persona senza tariffa:
  cella vuota, non 0. Il roll-up di un summary somma i figli calcolabili e
  resta marcato parziale; il totale di progetto dichiara accanto quanto effort
  e' rimasto fuori dal calcolo. Scartata la tariffa di default di progetto:
  nasconde chi sta girando su una stima.
- **Nessuna vista nuova: lo stesso albero, con colonne in piu'** (tariffa della
  risorsa scelta e costo della riga), con roll-up sui summary e totale. La
  tabella costi a se' stante, con breakdown per persona e per periodo, resta
  **in giacenza**: si compra dopo aver lavorato con le colonne, non adesso.
- **Adiacente, da valutare nella spec, non ancora comprato**: rendere
  scegliibili dall'utente le colonne visibili nella griglia. L'utente l'ha
  proposto insieme al resto; e' un meccanismo generale che sopravvive al goal,
  quindi la spec deve dire cosa costa e se conviene farlo *ora* (le colonne
  costo sarebbero il suo primo cliente) oppure aggiungere due colonne fisse e
  rimandare. La decisione torna all'utente con quei numeri.
  **Non e' una questione solo di questo goal**: il dialogo di export di Goal G
  deve far scegliere le colonne da esportare, cioe' vuole lo stesso
  meccanismo. Chi dei due arriva primo decide per entrambi — due liste di
  colonne separate sono un disallineamento che aspetta.

- [x] T59 [architect] — Spec del goal costi — `.claude/specs/T59-costs.md`
      (fable-5-1 confermato in header; nessun codice toccato). Le tre decisioni
      vincolanti sono riportate e non rinegoziate. Deciso dalla spec: le
      tariffe vivono **lato vista** (`Person extends Resource` in un
      `src/gantt/cost.ts` nuovo, `dailyRate?` + `rateOverrides[]`), quindi
      **nessun sottotask tocca `src/scheduler/`** e il motore non impara il
      denaro; il costo e' una lettura del report di soluzione, attaccata come
      `SolvedProject.costs` da `solve()`; lo split del segmento sul cambio
      tariffa vive **solo sull'asse dei minuti lavorativi** (copia di
      `capacityIntervals`, mai una `Date`), quindi il confine di giornata non
      si riapre; **v2 resta v2** (campi additivi opzionali, precedente
      `disabled`), il gate tiene su entrambi i versi perche' le regole stanno
      in `validateResources` che `serializeForFile` riattraversa; marca del
      parziale = prefisso `≥` (le tariffe sono non negative, quindi e' un
      limite inferiore vero e non serve legenda); il dialogo People e'
      confermato come sede; nessuna op nuova nell'agent API.
      Verificato dall'hub: 14 `file:line` su 14 combaciano (segmenti con
      `rate`/`soloRate`, `capacityIntervals`, `dayStartInWorkingMinutes`, il
      return di `solve`, la regola dei figli disabilitati di `rollUp`,
      `ResourceDialog`, `agentApi`, `planFigure`).
      Trovato di passaggio e **non un difetto di questo goal**: `toResources`
      scrive sempre `availability` (`ResourceDialog.tsx:40`), quindi salvare il
      dialogo People intatto sporca un file che non aveva quella chiave. Da
      scopare a se' se l'utente lo vuole; F5 non deve copiare il vizio.

**Le quattro questioni sono chiuse dall'utente il 2026-09-15** (§7 e §9 della
spec), e **due delle quattro vanno contro la raccomandazione** — decise coi
numeri davanti, non riaprire:
1. **Colonne selezionabili dall'utente adesso: opzione C**, contro la
   raccomandazione B. Il registro delle colonne, il filtro con la sua
   persistenza, il picker e le colonne insegnate a `planFigure` si comprano in
   questo goal, non nel primo task di Goal G. Costo accettato: due sottotask in
   piu' prima che la prima cifra di costo sia a schermo, e una matrice di
   verifica per ogni colonna nascondibile (Tab, guardia del summary, griglia
   collassata).
2. **Etichetta `currency` nel file**, contro la raccomandazione dei numeri
   senza unita'. Campo di progetto opzionale e additivo — allarga il gate di
   parsing in entrata e in uscita, e vuole un posto dove dichiararla (deciso
   in ricognizione, non qui).
3. **La colonna Rate di un task a cavallo di un aumento mostra l'intervallo**
   `600-650`, non la media: sono cifre che qualcuno ha dichiarato, quindi
   verificabili contro il dialogo People.
5. **Rate e Cost nascoste per default**, spuntabili dal picker, e la spunta
   persiste fra i progetti: ogni piano esistente tiene la griglia di oggi e i
   suoi 706px, senza nessun meccanismo che debba indovinare se ci sono
   tariffe, e chi inserisce la prima tariffa e' la persona che sa del picker —
   il dialogo People glielo nomina (accept di F5). Risposta del 2026-09-15; la
   §8 della spec era gia' scritta su questa ipotesi.
4. **Il totale vive nella status bar**, accanto a `N tasks`, con l'effort non
   calcolato dichiarato di fianco. Nessuna riga footer in griglia: dhtmlx
   Community non ne offre una che la spec abbia verificato, e col selettore di
   colonne appena comprato la larghezza della griglia cambia a runtime.

**La §8 della spec e' scritta sull'ipotesi B, quindi la sua scomposizione e'
scaduta in due punti** (F1 non conosce `currency`, F4 condiziona le colonne su
`hasRates` invece di leggerle da un registro) e servono i due sottotask di C.
Il resto della spec — §2 a §6 — regge intatto. Il delta e' il prossimo passo.

- [x] T62 [architect] — Delta della spec sulle quattro risposte —
      `.claude/specs/T59-costs.md` §5.7, §5.8, §7 chiusa, §8 riscritta
      (fable-5-1 confermato in header; nessun codice toccato, un solo file).
      Le due decisioni tecniche che mancavano, prese sul codice: **registro
      `src/gantt/columns.ts` di soli metadati**, coi nomi dhtmlx di oggi
      perche' `DERIVED_ON_SUMMARY`, `refreshResourceOptions` e la guardia del
      summary li usano gia'; i renderer restano dove sono come `Record`
      esaustivi, cosi' il compilatore garantisce «una lista, due renderer»;
      **nascosto = non costruito**, mai `hide: true` (PRO nei typings, non
      sondato); selezione persistita in `localStorage['yagni.columns.v1']`
      attraverso il seam `DraftStorage`, letta in un initializer come il draft;
      view state, quindi **niente undo, niente dirty, nessuna op agent**. E
      **`currency` si dichiara nel dialogo People** — e' l'unita' dei numeri
      digitati li', e l'unico altro dialogo di progetto e' il calendario.
      Vincolo scoperto e non ovvio: `recordedChange` deduplica solo su testo
      identico, quindi tariffe e `currency` devono passare da **una** chiamata
      all'handle o costano due passi di undo.
      Verificato dall'hub: 11 `file:line` nuovi su 11 combaciano.

**Autonomia concessa dall'utente il 2026-09-16**: l'hub lavora **tutto Goal F
fino alla goal review** senza la pausa di fine task — brief, corsia, checks,
critic e commit per ognuno degli otto. Si fermano i lavori solo per una
decisione che e' sua (comportamento visibile o difficile da tornare
indietro), per un task che si blocca in fondo alla scala di escalation, e al
verdetto della goal review. **La rinomina dell'heading `Unreleased` resta da
confermare**: la deroga non e' stata comprata.

**La scomposizione: F7 → F1 → F2 → F3 → F4 → F5 → F6 → F8**, seriale (un
browser, una porta). Gli accept per esteso stanno nella §8 della spec, con la
**Fixture C** condivisa e la sua tabella dei valori attesi per cella; qui sta
lo stato. Solo F2 e' `deep` (effort conservato); **nessun sottotask tocca
`src/scheduler/`**, ed e' la decisione che tiene il motore fuori dal denaro.

- [x] F7 [impl] — Registro delle colonne, selezione, persistenza, picker —
      `b70d327`. `src/gantt/columns.ts` (metadati), `GRID_CELLS` esaustivo in
      `gridColumns.ts`, `ColumnPicker` popover, `setColumns` sull'handle,
      selezione in `localStorage['yagni.columns.v1']`. Non splittato, come
      previsto: la corsia ha speso **257k**, oltre la soglia di split, e va
      ricordato se un task di questa forma si ripresenta.
      **Il difetto vero era nel brief dell'hub, non nella corsia.** Il brief
      (e la §5.7) prescrivevano di chiamare `rebuildColumns()` da
      `loadProject` «perche' il `currency` del file puo' cambiare una label» —
      ma nessuna `label()` legge il progetto, quindi la chiamata non comprava
      niente e **distruggeva le larghezze delle colonne trascinate a ogni
      undo e a ogni apertura file** (misurato dal critic: `text` 230 → 300,
      un Ctrl+Z la riportava a 230 insieme all'undo dell'effort). Chiuso
      dall'hub, non dalla corsia, che era troppo carica per una correzione:
      il rebuild ora **riporta per nome la larghezza di ogni colonna
      trascinata**, e `loadProject` non ricostruisce piu' le colonne.
      **Quando F3 fara' leggere `currency` a una label, la chiamata da
      `loadProject` va rimessa** — e con essa il difetto sparisce solo perche'
      le larghezze sono ora preservate.
      Rimisurato nell'app dopo il fix: la larghezza sopravvive a edit+undo, a
      un untick/re-tick nel picker e a un `loadText(toText())`; zero errori in
      console. **Non guidato e dichiarato tale**: un drag vero del bordo
      colonna (lo strumento non ha primitive mouse a coordinate e la maniglia
      di resize non ha un nodo indirizzabile) — al suo posto e' stato guidato
      il percorso di resize della libreria con eventi sintetici.
      Altri due findings del critic, entrambi nei docs e chiusi: un claim su
      `refreshData` che nessuna misura sosteneva, e una citazione `:589-593`
      gia' scaduta — ora il doc cita `toggleGridCollapsed` per simbolo.
      Misurato dal critic e non dalla corsia (celle che la fixture non aveva
      composto): **tutte e cinque le colonne nascoste insieme** (`grid_width`
      338, griglia che rende, `text` ancora editabile, guardia del summary
      intatta), due nascoste insieme, Shift+Tab, milestone, riga disabled,
      ramo chiuso, highlight di ricerca, e un fresh tab con una chiave stantia
      che nomina colonne inesistenti. Nessuno stato si rompe.
- [ ] F1 [impl] — Tariffe e `currency` nel modello, nel file e nelle regole
- [ ] F2 [deep] — La lettura del costo (`costs` su `SolvedProject`)
- [ ] F3 [impl] — Superfici di report, scrittura di `currency`, help dell'agente
- [ ] F4 [impl] — Colonne Rate e Cost **nate sul registro**, marca del
      parziale, totale in status bar
- [ ] F5 [impl] — Tariffe e campo Currency nel dialogo People
- [ ] F6 [impl] — Il costo nel pannello dettagli
- [ ] F8 [impl] — Colonne e banda di testata in `planFigure`
      **Non ha effetto visibile nell'app dentro questo goal**, e non e' una
      dimenticanza: `App.tsx` non passa `columns`, il default legacy resta
      byte-identico (appuntato da un pin). L'utente l'ha comprato come API
      scegliendo C, e il suo cliente e' il dialogo di export di Goal G.
      Dichiarato qui perche' la goal review non lo legga come codice
      infilato di straforo.

**Non cancellare `.claude/specs/T59-costs.md` allo sweep degli orfani finche'
la goal review di F non e' girata**: gli accept dei sottotask stanno nella sua
§8 e sono meta' del bar della review.

## Goal C — valutazione mobile-friendly                              [aperto]
Agevolare la visualizzazione da smartphone/tablet nascondendo le azioni
superflue; non tutto deve funzionare da mobile.

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

- [ ] T63 [impl] — Il popover delle colonne non prende il fuoco
      Trovato fuori dal bar dal critic di F7 e **misurato**: aprendo il
      picker il fuoco resta sul bottone della toolbar, e dal bottone alla
      prima checkbox ci sono **14 fermate di Tab** (bottone help, quattro
      bottoni dello stato vuoto, la ricerca e tutta la status bar in mezzo).
      `RowMenu` invece mette il fuoco sulla prima voce quando si apre: il
      precedente esiste, il picker non lo segue.
      Accept: aprendo il picker da tastiera il fuoco e' sulla prima checkbox
      (misurato come `document.activeElement`), Escape lo chiude e **riporta
      il fuoco sul bottone** che l'ha aperto, e Tab dentro il popover cicla
      solo fra le sue checkbox. Nessuna modifica a `RowMenu`.

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
- Dimensionamento: impl oltre ~200k = task da splittare (T35 215k, T18
  182k+250k, F7 257k); una correzione via SendMessage riusa il contesto e
  costa meno di un fresh spawn (~40k) — **ma non oltre ~190k**: li' chiude
  l'hub, se ha le misure (T52; T55 188k/129k; T56 131k+166k; F7 critic 184k,
  tre findings chiusi dall'hub). Un architect di goal: 248k, il delta 203k. **Un critic guidato nel browser e'
  la voce piu' cara del task**: 75-95k a tavolino, 148-168k nel browser (T56),
  211k su T58 — e su T58 e' l'unico che ha ribaltato una premessa. Si paga.
- **Le misure piccole le fa l'hub**: due probe vitest usa-e-getta hanno chiuso
  la condizione dello stallo e il round-trip del salvataggio (T56) per pochi k,
  dove una corsia paga 40k di solo ingresso. T57 e' il caso limite: due
  Explore (71k + 56k, non residenti) e una misura di dieci secondi hanno
  ribaltato la premessa e chiuso il task in una riga, senza aprire corsia.
  **Prima di briefare, misurare la premessa**: se cade, il brief non serve.
- Un accept che e' una campagna di misura va scopato come task di sola misura
  (T31: misura + modifica, tre contesti saturati per 21 righe; T42, solo
  misura, 99k/135k e zero correzioni). Variante che regge (T55): **misura
  prima, correggi solo se la catena si chiude**, con «nessun diff» esito
  valido.
- Ricognizione a monte del brief: paga, **ma una citazione copiata non e'
  verificata** — ne' un `file:line` (T43) ne' un nome di tipo (T48: la spec
  citava `GanttConfig['columns']`, inesistente). Quel che il brief non ha
  letto, **ordinare alla corsia di verificarlo**; quel che ha letto, risolverlo
  nel brief (ha pagato su T44, T46, T48). Due corollari misurati:
  ri-localizzare invece di copiare **trova** (T54 cercava riferimenti scaduti e
  ha scoperto un difetto vivo), e un `file:line` si rilegge **dopo** l'ultima
  modifica, mai calcolato (T55: accorciare il commento da `+7` a `+6` ha
  riscaduto quattro riferimenti gia' riallineati).
- Il critic trova cio' che l'accept non chiedeva (T41, T42, T45). Su uno
  spostamento **l'hash, non la lettura** — e il diff complementare di cio' che
  resta (T47, T48: e' l'unica prova contro un ripristino sporco). E sempre **la
  domanda che fa paura**: misurata, e' cio' che rende il pass non una speranza.
- **Cio' che una corsia dichiara impossibile o preesistente va confrontato con
  l'evidenza.** T43 dava il drag reale per non guidabile, T41 l'aveva fatto;
  T46 dava per difetto dello scheduler la propria `setCalendar`. Fatto bene su
  T48: il Tab misurato su HEAD **e** sul tree, prima di dirlo preesistente.
- **Un accept deve essere osservabile, indipendente dalla scala, e provare cio'
  che dice di provare.** T45 chiedeva ctrl+wheel (non misurabile in sintetico),
  T46 «le bande spariscono a Months» (vero su un piano corto, falso su uno
  lungo), T48 «Tab muove fra le celle» (ne muove due). Cinque fette su cinque.
