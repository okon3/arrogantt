# Plan

## Cosa resta sul tavolo

**Goal E e' chiuso e potato** (review fix-first, unica azione scaricata da
T51): chart 2228 → 1205. Nessuna release — refactoring, e il changelog non
prende plumbing.

Aperti: **Goal F** (costi), la cui spec e' consegnata (T59) e che aspetta
quattro risposte dell'utente prima di scrivere i sottotask; **Goal G** (export
cliente), il cui primo passo e' ancora analisi (T60) e che **erediteva** da F
la decisione sul meccanismo delle colonne; **T16**, unico task di Goal C, che
lo porterebbe alla sua review. **O4** in giacenza. Su T60 leggere prima il
fatto accertato in testa a Goal G: l'export non fotografa il DOM.

In manutenzione: **T63** (il picker non prende il fuoco) e il rename a
**ARROGANTT**, in due pezzi e in quest'ordine — **T64** fuori dal repo
(GitHub + Pages, lo fa l'utente, non una corsia) e **T65** dentro. Nessuno dei
due aspetta piu' una risposta: nome, tagline e sorte delle chiavi di storage
sono decisi dentro T65.

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

**La scomposizione: F7 → F1 → F2a → F2b → F3a → F3b → F4a → F4b → F5a →
F5c → F5b → F6a → F6b → F8**, seriale (un browser, una porta). Quattro dei nove pezzi
originali si sono splittati strada facendo — F3, F4, F5 e F6 — e ogni split ha
pagato: la nota di ciascuno sta sopra la sua coppia. Gli accept per esteso stanno nella §8 della spec, con la
**Fixture C** condivisa e la sua tabella dei valori attesi per cella; qui sta
lo stato. Solo F2a e' `deep` (effort conservato); **nessun sottotask tocca
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
- [x] F1 [impl] — Tariffe e `currency` nel modello, nel file e nelle regole —
      `1fc20d8`. `src/gantt/cost.ts` nuovo (`Person`, `RateOverride`,
      `rateOnDay`, `validateCurrency`), `Project.resources: Person[]` +
      `Project.currency?`, regole dei tassi in `validateResources`,
      `ResourcePatch` + `applied()` che li portano, parser e serializer,
      `describeChange` → `changed currency`. Nessun file sotto
      `src/scheduler/`: verificato sul diff, non sul report. 473 test.
      **Un solo finding del critic, e il buco era nel mio brief**: la regola
      del tasso di un periodo la dettavo «non un numero, o `NaN`» mentre la
      gemella tre righe sopra usa `Number.isFinite` — un `Infinity` passava il
      gate e nel testo diventa `null`, che il parser di questa stessa app
      rifiuta (Save, undo e draft giu' insieme). Chiuso dall'hub in una riga
      piu' il pin; la lezione e' nel binding.
      **Tre decisioni prese al brief, non nella spec**: `import type` per
      `Person` in `project.ts` (F2 fara' il ciclo inverso: l'edge di soli tipi
      lo tiene fuori dal runtime); `validateCurrency` rifiuta un'etichetta non
      gia' trimmata (era l'unica lettura che conciliava «trimmed non-empty»
      della §5.8 col suo «un `" EUR "` paddato e' rifiutato»); e il
      **pass-through** delle tariffe in `toResources` — il dialogo People
      ricostruisce ogni persona da zero, quindi senza quelle tre righe un
      salvataggio del dialogo fra F1 e F5 cancellava ogni tariffa del progetto.
      Il GAP dichiarato dalla corsia su `currency: ""` (lo intercetta
      `requireString` col suo messaggio prima di `validateCurrency`) e' stato
      giudicato non difetto: i rifiuti di `requireString` sono un
      sottoinsieme, il gate non si indebolisce.
- [x] F2a [deep] — Il calcolo del costo: `rateIntervals` e `taskCosts` in
      `cost.ts` — `5402bb5`. `TaskCost`, `RateInterval`, `SolvedInputs`,
      `rateIntervals`, `taskCosts` piu' i privati `rateAt`/`piecesOf`/
      `leafCost`; sezione nuova in `docs/scheduling.md`. 489 test (+16).
      Nessun file sotto `src/scheduler/`: verificato sul diff, non sul report.
      **Lo split ha pagato**: corsia 141k, critic 130k, contro i 257k di F7 e
      i 222k di F1. Da qui in poi tagliare cosi'.
      **La corsia ha rifiutato un docblock che le dettavo, e aveva ragione**:
      dicevo che `RateInterval.dailyRate` e' `undefined` quando i bound di un
      periodo sono malformati, e quel caso non esiste — `expandRanges` e
      `rateOnDay` condividono la guardia `isDayString`, quindi un bound
      malformato non produce **nessun** intervallo per quel giorno. Misurato da
      lei, riconfermato dal critic. Il tipo `number | undefined` resta (specchia
      `rateOnDay` ed evita un'asserzione non-null), documentato per il vero.
      **Unico finding del critic, e ancora nel brief dell'hub**: la formula nei
      docs perdeva `minutesToDays`, cioe' dichiarava man-minuti dove il codice
      calcola giorni-uomo — 480× sul calendario di default, e F3/F5 l'avrebbero
      letta per costruire le loro cifre. Chiuso dall'hub.
      **Due pin aggiunti dall'hub sui fuori-bar del critic**: (1) un tasso
      **decrescente** — ogni cambio di tariffa della suite era un aumento,
      quindi `[...applied]` senza `.sort` passava 14 test su 14 mentre la §5.4
      rende la coppia `600–650`; (2) il ramo senza persona e' **raggiungibile**,
      non difensivo: la corsia lo dava per irraggiungibile e sbagliava — una
      foglia disabled con `resourceId` pendente non stalla il motore, perche'
      `project.ts:400` le azzera l'id. Il comportamento era gia' giusto.
      **Fixture C: nove righe su nove ri-derivate in autonomia dal critic** e
      combacianti con la §8 (T3 spinto al quinto giorno lavorativo, override
      dal 2026-09-15, T6 disabled interamente sotto la soglia 2880 dell'asse).
      F4 puo' fidarsi di quella tabella.
      **Fuori bar e deliberatamente non scopato**: `expandRanges` espande
      giorno per giorno, quindi un `to` al 2099 costa ~27k indici per persona
      per `solve()` — identica esposizione della gemella dell'availability, il
      fix vivrebbe in `src/scheduler/dayRange.ts`, fuori da Goal F, e non e'
      un difetto che un utente vede. **Non guidato e dichiarato tale**: nessun
      calendario non-default in nessuna fixture (un periodo di tariffa che
      incontra una chiusura aziendale o una settimana non lun-ven).
- [x] F2b [self] — `costs` e `currency` su `SolvedProject`, i campi costo di
      `buildPlan`, `formatMoney` — `fcfb61a`. 501 test (+12). `SolvedInputs`
      era gia' un sottoinsieme strutturale, quindi `solve()` passa i quattro
      pezzi che ha e `cost.ts` non e' stato toccato; `agentApi.help.md` e'
      mosso nello stesso commit, perche' e' questo commit a muovere la
      superficie agente. Nessun file sotto `src/scheduler/`.
      **Il difetto del totale, e la sua causa e' doppia.** `Plan.totalCost`
      sommava **tutte** le righe di primo livello, disabilitate incluse: il
      critic l'ha misurato a `3500` contro i `2000` della spec sulla fixture
      di roll-up di `cost.test.ts`, e a `2500` invece di `null` su un piano
      interamente di segnaposto — cioe' **F4 avrebbe stampato in status bar il
      costo di un piano in cui nulla e' impegnato**, e `getPlan().totalCost`
      lo dava gia' sbagliato. Prima causa: la riga di consegna di gen 3 e il
      suo prompt di handoff **enunciavano due regole su tre** — il null di
      `PlanTask.cost`, il null di `Plan.totalCost`, e non il filtro su
      `disabledIds` che la §5.3 richiede («sum over top-level rows not in
      `disabledIds`»), derivato da gen 3 e mai scritto. Seconda causa: l'hub
      ha giustificato il roll-up sui root con un ragionamento proprio
      («`taskCosts` ha gia' applicato la regola del disabled» — vero solo
      *sotto* un summary) senza rileggere la §5.3 sul posto, avendo letto
      §5.4 e §5.6. **La lezione e' una e sta nel Log**: un elenco di decisioni
      consegnate e' completo o non e' una decisione. Vale per chi consegna e
      per chi implementa, e vale al brief di F4.
      Secondo finding del critic, chiuso: il docblock di `formatMoney`
      diceva «una tariffa si inserisce intera», mentre `validateResources`
      (`resources.ts:118-137`) ammette qualunque tariffa finita ≥ 0,
      frazionaria inclusa — verificato sul codice, non ereditato.
      Verificato dal critic e senza finding: l'asserzione `costs.get(id)!` di
      `buildPlan` regge (stessa ricorsione sulla stessa `hierarchy`, e
      **nessun `SolvedProject` e' costruito fuori da `solve()`** in `src/` o
      nei test); la regola del null di `PlanTask.cost` guidata su nove forme
      di riga (tariffa `0` dichiarata → costa `0`, milestone → `0`, foglia
      disabled → il proprio importo, summary tutto non prezzato → `null`);
      `formatMoney` non puo' ricevere un negativo, `-0`, `NaN` o `Infinity`
      perche' ogni percorso di scrittura passa da `validateResources`.
      Le nove righe della Fixture C restano quelle: `S1 7800 + M1 0`.
      **La seconda passata del critic non e' girata** (terminato da
      un'interruzione del turno): le due correzioni reggono sui due pin nuovi
      — che senza il filtro danno `5400` e `2400` invece di `2400` e `null` —
      e sulla §5.3 e `resources.ts:118-137` letti dall'hub, non sul suo ok.
      **Non ancora fatto e di F3**: la riga `toText()` dell'help dice «same
      fields as `getPlan()`» mentre il report del file ne porta 5 su 16 — era
      gia' un sottoinsieme prima, ora e' piu' largo.
**F3 e' splittato in F3a + F3b** (ricognizione del 2026-09-16, sulla lezione
del Log): erano tre grappoli in un task — le superfici che **hanno gia'** il
dato e si pinnano a tavolino, la parita' di `getTask()`, e il percorso di
scrittura di `currency` che vuole il browser. Tagliato in due: F3a tutto cio'
che si prova con `npm test`, F3b tutto cio' che si prova nell'app.
Due `file:line` della §8 sono **scaduti** e il brief porta quelli riletti:
`setResources` e' a `GanttChart.tsx:473-481` (non `:434-442`), `rebuildColumns`
a `:300-324` col suo unico call site a `:638`, `loadProject` a `:326-367`.

- [x] F3a [impl] — Report del file, colonne CSV, `docs/file-format.md` —
      `39b59ed`. `reportFor` porta `cost`/`uncostedDays`/`dailyRates`, il
      blocco `solved` di progetto `totalCost`/`uncostedDays`; due colonne CSV
      appese dopo `Disabled`, l'etichetta solo nell'header; il doc e la riga
      `toText()` dell'help. 508 test (+7). Nessun file sotto `src/scheduler/`
      e nessun `.tsx`: verificato sul diff, non sul report.
      **Lo split ha pagato ancora**: corsia 122k, critic 122k — le misure di
      F2a, contro i 257k di F7.
      Le tre decisioni della riga reggono, **riverificate sul codice prima
      del brief e non ereditate**: la chiave `currency` di root e' gia' un
      input (F1); `formatMoney` raggruppa via `Intl.NumberFormat('en-GB')` e
      in un dialetto `;` + virgola decimale un raggruppamento corrompe la
      cella; `PlanTask.cost` distingue gia' null da `0`.
      **I due finding del critic erano entrambi nei docs e dicevano entrambi
      piu' di quanto il codice sostenga.** (1) «nessuna marca `≥`, che e'
      della griglia» dichiarava un comportamento che a questo commit non
      esiste (`gridColumns.ts` non ha colonna `cost`: e' di F4) e piantava in
      `file-format.md` un fatto che la §5.6 assegna a `view.md` — la forma di
      T58, un fatto una casa. Clausola tolta, nel doc e nel commento del test.
      (2) «mai `0`, che e' la cifra di un milestone»: falso, una tariffa
      dichiarata `0` e' **prezzata** e scrive `0` (`leafCost` somma `0` e
      conta quei giorni come costati). Riscritto: vuoto non e' `0`, e `0` e'
      una riga che e' stata prezzata.
      **Due aggiunte dell'hub sui fuori-bar del critic**: un test della
      tariffa `0`, cosi' la frase nuova del doc e' **misurata** e non dedotta
      (il critic la conosceva per derivazione); e un pin `1200` sul
      round-trip prezzato, che senza restava verde su `null === null`. Piu'
      la cautela «sommare senza il flag raddoppia» generalizzata da
      `Effort (d)` a tutte le colonne numeriche, invece di una seconda frase
      per le due nuove.
      **Non guidato e dichiarato tale** (derivato dal critic sul codice, non
      misurato): foglia disabled con tariffa → scrive il proprio importo
      mentre padre e `totalCost` la escludono; summary coi figli tutti non
      prezzati → cella vuota e i giorni rollati; foglia a cavallo di un
      aumento → un solo totale nudo, le due tariffe affiorano solo nei
      `dailyRates` del report.
      **Debito di F2b chiuso**: la riga `toText()` dell'help non dice piu'
      «same fields as `getPlan()`», elenca i campi del report.
      **Nessun bullet in `CHANGELOG.md`, deciso al brief**: la §5.6 assegna a
      F4 il bullet dei costi, dove le cifre diventano visibili nell'app; qui
      lo raddoppierebbe.
- [x] F3b [impl] — Parita' di `getTask()`, scrittura di `currency`, help —
      `9c9e0ac`. `TaskDetails` prende i tre campi di `PlanTask` piu'
      `currency` (letti da `solvedRef.current`, nessun cablaggio nuovo);
      `GanttHandle.setCurrency` e `AgentApi.setCurrency` sul modello di
      `setCalendar`, senza `gantt.render()`; la regola del null estratta in
      `reportedCost` (`cost.ts`), chiamata dai due builder e da nessun altro —
      `plan.ts:133`, predicato diverso, intatto. 516 test (+8). Nessun file
      sotto `src/scheduler/`, nessun `rebuildColumns()`, nessun terzo argomento
      a `setResources`: verificato sul diff.
      **Lo script della Fixture C sta nella §8 della spec**, in una sola copia,
      con le tre correzioni dell'hub che la sovrascrivono (graffe, accept (5)
      sbagliato, chi lo scrive). F4/F5/F6/F8 leggono di li'.
      **Critic: pass, zero finding** — corsia 133k, critic 168k (browser). Ha
      guidato nove righe di parita', il conteggio dei passi di undo col tasto
      vero e il verso del redo, il gate stretto su emoji/controlli/8 caratteri,
      e ha misurato che `yagni.help()` e `/llms.txt` restano byte-identici.
      **Quattro chiusure dell'hub sui suoi fuori-bar**, la prima delle quali e'
      un buco dei brief e non del critic: la §5.6 assegna a **F3** anche la
      tabella *Writing — people* (`dailyRate`, `rateOverrides`,
      replace-not-multiply, last-wins, assente ≠ `0`) e nessuno dei due brief
      l'ha chiesta — mentre la Fixture C dipende da entrambi i campi. Scritta
      ora, coi limiti che `resources.ts:118-137` sostiene davvero (qualunque
      cifra finita da `0` in su, frazioni incluse). Piu': la clausola del label
      paddato nella riga di `setCurrency`; una guardia di tipo in
      `validateCurrency` col suo pin, perche' `setCurrency(5)` da uno script
      tirava un `TypeError` invece della regola (la gemella
      `calendarRules.ts:60-62` si guarda gia' da sola); e la trappola
      **misurata** dal critic in `docs/verification.md` — `isDirty()` e i
      title dei tasti undo/redo leggono l'ultimo stato **renderizzato**
      (`App.tsx:737-741`), quindi in un solo eval rispondono il valore
      pre-scrittura, mentre `getPlan()`/`getTask()`/`toText()` sono vivi.
      Quattro task riusano quella fixture: la trappola valeva il doc.
      **Non guidato e dichiarato tale** (dal critic): Save e il file su disco,
      il draft dopo un reload con `currency`, Ctrl+Z come tasto, la profondita'
      dello stack oltre la cima, `setCurrency` prima del mount e dopo
      `newProject()`.
**F4 e' splittato in F4a + F4b** (2026-09-16, sul seam che la sua stessa riga
indicava): il totale in status bar legge solo `Plan`, non tocca la griglia, non
tocca il registro e non ha nessuna delle trappole di larghezza. **F4a va per
primo perche' e' il piu' piccolo e perche' rende misurabile un accept di F4b**:
la §8 chiede che il totale non aspetti le colonne, e quella frase si guida solo
se il totale c'e' gia' quando le colonne arrivano. Gli accept della §8 si
dividono per clausola, non per numero: le clausole status bar di (1), (4) e (6)
sono di F4a, tutto il resto di F4b.

- [x] F4a [impl] — Il totale di progetto nella status bar — `6965482`.
      `StatusBarProps.cost` (`{totalCost, uncostedDays, currency} | null`, un
      solo `null` da interrogare), stato seminato `null` e calcolato in
      `syncFromChart` da `buildPlan(handle.getSolved())`, `docs/view.md`
      *Status bar*. 516 test invariati — non c'e' nessun `.test.tsx` in `src/`
      e il brief vietava di introdurne uno. Corsia 157k, critic 151k.
      **Nessun bullet `CHANGELOG.md`**, come da brief: lo porta F4b.
      **Il critic ha guidato tutti e sette gli accept piu' due celle sue**: la
      riga top-level prezzata e disabilitata (`totalCost` → `null`, elemento
      rimosso — il difetto di F2b non si ripresenta) e la forma parziale senza
      etichetta. Il picker guidato davvero (`grid_width` 706→644→706), testo
      identico code-point per code-point; Ctrl+Z col tasto vero.
      **Unico finding, ed era nel commento, non nel codice: la forma di T58.**
      Il commento di `.statusbar__cost` dichiarava una misura che la regola non
      consegna — «1150-1300px, `9 tasks` va a capo a meta' parola, e non scatta
      mai a larghezza normale». Misurato dal critic: in quella banda la regola
      cambia **0px** di altezza e taglia solo 2-40px della cifra; il suo effetto
      vero e' a **≤1040px** (59 e 75 → 49, cioe' l'altezza che la barra aveva
      gia' li' senza costo). Il rischio concreto era che un lettore successivo
      misurasse la banda documentata, trovasse 49px coi due versi e cancellasse
      la classe. Riscritto dall'hub con le cifre vere.
      **Regressione comprata, non nascosta**: fra ~1100 e 1290px la barra passa
      da 35 a 49px per via della cifra stessa. Il critic ha misurato **le due
      alternative scartate** — `flex-shrink` sulla sola cifra recupera solo
      1290, e uno schema di shrink-priority su tutta la barra tiene 35px fino a
      1120 ma svuota la cifra e spinge *Fit* fuori schermo sotto 1100. Regola
      dell'80%, con la prova di cio' che non si e' spedito.
      **Fuori bar, per F4b**: sotto 1290px la cifra e' ellissata e nel caso
      tutto-prezzato non c'e' `title` che la recuperi (§5.4 lo vieta li') — e'
      una domanda alla spec, non un difetto. E quando F4b porta la cella costo,
      `"<n> d of effort not costed"` esistera' in due file: decidere li' se ha
      una casa sola.
      **Non guidato e dichiarato tale** (dal critic): reload + ripresa del
      draft al primo render (il seme `null` verificato sul codice a
      `App.tsx:104` e sul progetto vuoto, non sul percorso di ripresa), schema
      scuro, print/PNG/CSV, larghezze sotto 1024 e sopra 1920.
- [x] F4b [impl] — Colonne Rate e Cost **nate sul registro**, marca del
      parziale — `56d0ba7`. Due entry `PLAN_COLUMNS` (`rate` 62/70, `cost`
      84/84, `defaultShown: false`, `clientSafe: false`, label dal `currency`),
      i due `GRID_CELLS` senza `editor`, i quattro campi di riga in
      `toGanttData`, nel loop di `applySolution` e nel literal di `addTask`,
      `view.md` *Grid*, l'addendum a `dhtmlx.md` e **il bullet costi di
      `CHANGELOG.md`** — la feature e' intera qui. 517 test (+1).
      **Il debito di F7 e' chiuso e rimisurato, non ereditato**: `rebuildColumns`
      torna su `loadProject` (dopo `gantt.parse`) e arriva su `setCurrency`, tre
      call site in tutto, **mai** `applySolution`. Il critic ha guidato un drag
      **reale** del bordo colonna via CDP (`text` 230 → 279) — cosa che la
      corsia di F7 non era riuscita a fare, e che li' era dichiarata non
      guidabile — e la larghezza ha tenuto su tutti e tre i percorsi
      (`setCurrency`, `loadText(toText())`, Ctrl+Z).
      **Critic `sonnet`: pass, zero finding.** Ha ri-guidato tutti e nove gli
      accept sulla Fixture C ricostruita da zero, piu' una cella sua: un task
      aggiunto dal **bottone** della toolbar rende `—`/*No resource*, cioe' i
      placeholder del literal di `addTask` sono sovrascritti da `applySolution`
      e non arrivano mai a schermo.
      **Chiuso dall'hub sul fuori-bar del critic**: il docblock di
      `PlanColumn.label` diceva «a later goal makes the currency label ride
      here» — reso falso da questo stesso commit, che quelle due label le
      scrive. Un fatto che sopravvive alla sua verita' e' la forma T58: corretto
      nel commit.
      **Due case per una stringa, deciso e non subito**: `"<n> d of effort not
      costed"` vive ora in `StatusBar.tsx` (F4a) e nel template della cella.
      Unificarla richiederebbe toccare un file che il brief metteva fuori
      scopo; il critic conferma che la scelta e' forzata dal bar, non una
      dimenticanza. Se `StatusBar.tsx` si riapre per altro, si unifica li'.
      **Non guidato e dichiarato tale** (dal critic): Shift+Tab e l'armamentario
      tasti non-CDP sulle due colonne, un reload a freddo della selezione
      persistita (accept di F7, non di F4b), un drag reale **delle due colonne
      nuove** (guidato solo su `text`; le loro larghezze osservate costanti come
      effetto collaterale).
**F5 e' splittato in F5a + F5c + F5b** (2026-09-16; F5a+F5b il 2026-09-16,
F5c staccato da F5a poco dopo). **Le lettere non sono l'ordine: si esegue
F5a → F5c → F5b.** Il primo taglio era sul seam che la riga di F5 indicava
(superfici tariffa vs campo `Currency`). Il secondo e' sulla misura, non sul
codice: F5a restava di classe F4b (228k/213k su un task gia' splittato una
volta) perche' la sua campagna browser cumulava sette scenari su un dialogo da
riaprire ogni volta — il dirty su Save intatto, il giro tariffa → costo, il
blanking, `0`/`-1`/`abc`, i periodi sovrapposti, `scrollWidth` a 728 e
l'allineamento delle tracce fra due liste. Il seam del secondo taglio: **la
colonna Daily rate non ha bisogno del componente generalizzato**, e il
pass-through di `rateOverrides` (`ResourceDialog.tsx:50-51`) regge intatto
fino a F5c, che lo sostituisce con un campo del draft. Accept §8 di F5
ripartiti per clausola: (1)(2) e la meta' `scrollWidth` di (4) a F5a; (3) e la
meta' allineamento di (4) a F5c; (5)(6) a F5b.
**`file:line` della §5.5 riletti dall'hub, quattro su quattro scaduti** (il
codice e' cambiato con F1): il vizio di `availability` sempre scritto e' a
`ResourceDialog.tsx:47` (non `:40`), il commento del testo di `availability` a
`:17-18` (non `:16-17`), il bottone di riepilogo a `:193-203` (non `:189-199`),
il pannello espanso a `:217-231` (non `:214-226`). E **i due rimandi a
`docs/view.md` della §5.5 puntano altrove**: `:497-511` cade in *In-app help*
e `:513-517` in *Resource load lanes* — la grammatica delle righe-periodo e il
metodo `scrollWidth <= clientWidth` stanno entrambi nei bullet di *Dialogs*
(`docs/view.md:578-604`). I brief citano per simbolo, non per riga.

- [x] F5a [impl] — La colonna Daily rate nel dialogo People — `3787f43`.
      `DraftResource.dailyRate: string`, `toDraft`/`toResources` con la regola
      del testo trimmato non vuoto, colonna 88px fra Availability e Periods,
      dialogo 640 → 728, i due `colSpan` 5 → 6, `.people__rate`, i quattro
      `Resource[]` → `Person[]` di `App.tsx` (import di `Resource` caduto,
      inutilizzato) e il bullet *People table* di `view.md`. 517 test
      invariati. Nessun file sotto `src/scheduler/`, nessun `rebuildColumns()`,
      nessun terzo argomento a `setResources`: verificato sul diff.
      **Il secondo split ha pagato**: corsia 186k, critic 215k, contro i
      228k/213k di F4b che era splittato una volta sola.
      **Critic `sonnet`: pass, zero finding.** Ha ri-guidato le nove righe
      della Fixture C prima di ogni edit, tutti e sette gli accept, il Ctrl+Z
      reale via CDP, e quattro celle sue: **le quattro combinazioni di campi
      opzionali** (solo tariffa / solo override / entrambi / nessuno) con
      `availability` esplicita per isolarle dal vizio noto — Save intatto su
      tutte e quattro, zero passi di undo, **nessun secondo campo che si
      scrive sempre**; il campo vero con `6e2` → 600, `0x10` → 16, `100.567`,
      `Infinity` rifiutato da `Number.isFinite` (la trappola di F1 non si
      ripresenta) e **round-trip `loadText()` pulito su tutti**; Tab, Save da
      tastiera, schema scuro; e i numeri del doc ri-misurati su canvas
      (header 56.22px vs valore a 5 cifre 35.05px).
      **Tre decisioni prese al brief, non nella spec**: il campo e'
      `type="text"` con `inputMode="decimal"` e non `type="number"` — la regola
      del tasso vive in `validateResources` e sola, e un input `number`
      scarterebbe `abc` prima che il draft lo veda, mettendo una seconda regola
      muta nel campo (l'accept `-1`/`abc` e' cio' che lo prova); l'**ordine di
      inserimento delle chiavi** in `toResources` deve restare quello di
      `applied()` (`resources.ts:44-52`) perche' `JSON.stringify` scrive in
      ordine di inserimento e `recordedChange` deduplica l'undo su testo
      identico — spostare `dailyRate` costerebbe un passo di undo spurio a ogni
      Save intatto; e **nessun bullet `CHANGELOG.md` qui**, lo porta F5b dove
      la storia tariffe del dialogo e' intera.
      **Chiuso dall'hub, misurato dalla corsia e confermato sul codice**:
      `toText()` e' `serializeForFile` e data il report con `solvedAt` a
      precisione di minuto, quindi **non e' mai byte-stabile** — un accept
      scritto come identita' byte non e' guidabile a cavallo di un minuto.
      Costato due misure (corsia e critic, stesso minuto attraversato); la
      trappola e' ora in `docs/verification.md`, che il brief metteva fuori
      scopo e che la corsia ha segnalato invece di toccare.
      **Fuori bar, misurato dal critic e non un difetto**: sotto i 776px di
      viewport il `<colgroup>` fisso **non** sfonda — `table-layout: fixed`
      stringe solo Name, fino a 0px a ~452px di spazio disponibile, con
      `scrollWidth === clientWidth` su tutto l'intervallo provato (728 → 452).
      E' materiale di Goal C, e ora e' misurato invece che supposto. Piu' due
      conseguenze dichiarate della scelta `type="text"`: una tariffa con molti
      decimali si rivede intera nel campo (`100.567`) e arrotondata in griglia
      (`100.57`, `maximumFractionDigits: 2`), e `6e2`/`0x10` passano come 600 e
      16 senza segnalazione — coerenti col «una sola regola, in
      `validateResources`», non difetti.
- [x] F5c [impl] — La lista dei periodi di tariffa, generalizzata —
      `00d7a19`. `PeriodRowList` nuovo (generico su `T extends DayRange`, render
      prop `valueCell`), `AvailabilityList` ridotta a wrapper a firma invariata,
      `RatePeriodList` nuovo, `DraftResource.ratePeriods` **al posto** del
      pass-through di F5a, due `.dialog__subhead` nel pannello espanso, il
      riepilogo che appende i periodi tariffa, `.ranges__rate` e i tre bullet
      *Dialogs* di `view.md`. 517 test invariati. Nessun file sotto
      `src/scheduler/`, `DayRangeList` e `CalendarDialog` intatti,
      `.dialog__hint` intatto per F5b: verificato sul diff.
      **Ri-splittare non ha fatto scendere la misura**: corsia 218k, critic
      242k — sopra soglia entrambi, dove F5a (stesso dialogo, taglio sulla
      campagna) aveva reso 186k/215k. Il diff era ~100 righe di estrazione; la
      campagna no. Se F5b/F6/F8 hanno questa forma, tagliare la campagna, non
      il codice.
      **Critic `sonnet`: pass, zero finding.** Ha ri-derivato la Fixture C da
      §8 (nove righe, raise il `2026-09-24`) e ri-guidato tutti gli accept
      assegnati, piu' cinque celle sue: il Save intatto (Gino e Luca senza
      **nessuna** chiave `rateOverrides`, non un array vuoto, e zero passi di
      undo), un periodo su Luca che **non ha default** (prezza T4 a `1,500`,
      rimosso torna a `cost null, uncostedDays 3`), l'A/B dell'overlap
      (dichiarato secondo: `[600,650,800]` e `4100`; ordine opposto via
      `updateResource`: `[600,650]` e `3800`), le sette tracce **identiche al
      pixel** con `gridTemplateColumns` byte-identico, e il gate su un `-5`
      digitato (messaggio di `validateResources`, modello intatto).
      **La trappola vera stava nel ramo che nessun test vede**: prima di questa
      modifica il suffisso ` away` del conteggio si applicava **solo** al ramo
      non-zero, quindi un periodo allo 0% su soli giorni non lavorativi poteva
      diventare `no working days away`. Non e' successo — misurato sabato-
      domenica nell'app, legge `no working days` — ma non esiste un test React
      in `src/` che lo sorvegli: e' una riscrittura-in-wrapper e il ramo va
      riletto a ogni ritocco di `PeriodRowList`.
      **Tre decisioni prese al brief, non nella spec**: la cella periodo e'
      `type="number"` e **non** il `type="text"` di F5a — la' il draft *era*
      testo, qui `RateOverride.dailyRate` e' un numero, quindi il filtro del
      browser e' imposto dal tipo e non una seconda regola muta; nessun clamp
      in `onChange` (la regola resta sola in `validateResources`); e una riga
      nuova e' **seminata con la tariffa di default della persona**, perche'
      `0` qui e' un giorno *prezzato* e una riga non compilata prezzerebbe a
      zero in silenzio. **Con default assente il seme e' `0` e la trappola
      resta**: dichiarata, non mascherata.
      **Unico finding, ed era mio, nel doc che la corsia ha scritto su mia
      richiesta**: la frase nuova di *Period-row lists* registrava
      l'allineamento come «entro 0.5px» — una tolleranza che il layout non
      deve a nessuno (le due righe hanno la stessa classe, quindi lo stesso
      template per costruzione) e una misura guidata su **una riga per lista**
      data per generale. La forma del censimento-in-prosa del binding, scritta
      dall'hub. Riscritta: la ragione copre le celle non guidate, la misura e'
      dichiarata per quello che e'.
      **Non guidato e dichiarato tale** (dal critic): l'allineamento con piu'
      di una riga per lista o con le liste invertite, Tab fra le righe nuove,
      uno screenshot in schema chiaro (solo albero di accessibilita'), e un
      `0` dichiarato come tariffa di periodo attraverso il dialogo.
- [x] F5b [impl] — Il campo `Currency` nel dialogo People — `bd24e98`.
      `.people__currency` (un `<label>`, come ogni controllo etichettato di
      questi dialoghi) sopra la tabella, controllo 88px, `placeholder e.g. EUR`;
      prop `currency: string | null` e terzo argomento di `onSave`; il trim nel
      dialogo e `validateCurrency` sull'etichetta trimmata non nulla; il terzo
      argomento `currency?` a `setResources` scritto **prima** di
      `applySolution()` e il **quarto** call site di `rebuildColumns()` dopo;
      `openResources` che fotografa `getProject().currency`; la frase del
      `.dialog__hint` che nomina il bottone per il suo nome accessibile
      (`Choose grid columns`: e' icon-only, non c'e' testo visibile da citare);
      i due bullet di `view.md` (quattro call site, campo Currency), la misura
      del carry sul quarto call site in `dhtmlx.md` e **il bullet
      `CHANGELOG.md` delle superfici tariffa del dialogo**, differito qui da
      F5a. 517 test invariati, nessun test nuovo: **non esiste harness React in
      `src/`** (nessun `.test.tsx`, nessun jsdom), quindi ogni claim e' una
      misura nel browser. Nessun file sotto `src/scheduler/`, nessuno dei file
      che implementano un invariante: verificato sul diff.
      **Chiuso dall'hub prima del critic**: la corsia aveva reso il campo un
      `<div>`+`<span>` senza `placeholder` — la §5.8 lo dichiara e il repo
      etichetta con `<label>` (`.taskinfo__field`, `.calendar__day`). Due
      righe, piu' la correzione del bullet di `view.md` che l'hub aveva appena
      scritto **sbagliato** sul wrapper: un doc che registra male la ragione di
      una decisione e' peggio di nessun doc, ed e' la terza volta in questo goal.
      **Critic `sonnet`: pass, zero finding.** Corsia 209k, critic 176k — la
      campagna tagliata come da regola di F5c ha tenuto entrambi sotto soglia,
      su un diff di ~110 righe. Ha ri-guidato i sei accept, la Fixture C (nove
      righe, raise il `2026-09-24`), il drag reale via CDP (`text` 230→279
      identico alla cifra di `dhtmlx.md`), il click-to-focus attraverso il
      `<label>` nuovo, e **le quattro celle che l'hub gli ha chiesto per nome**:
      il braccio `undefined` del tri-stato (`updateResource`/`addResource`/
      `removeResource` su un progetto con `USD`: etichetta intatta — nessun
      accept del brief lo guidava), un Save di sola valuta (un passo di undo,
      `changed currency`, tariffe intatte), Cancel dopo aver digitato (niente
      scritto), e una modifica di valuta a **griglia chiusa** (`grid_width` a 0
      lungo il Save, restore a 901: il quarto call site passa dal ramo
      `savedGridWidthRef` come gli altri tre).
      **La trappola vera non era nell'app**: il `fill` del tool su un campo
      controllato **gia' pieno** fallisce in silenzio (il `value` del DOM
      risponde, lo stato React no, e il componente salva il vecchio). Corsia e
      critic ci sono cascati **indipendentemente sullo stesso campo** e l'hanno
      letta come difetto dell'app. Graduata in `docs/verification.md` nello
      stesso commit, accanto al throw che quella sezione descriveva gia'.
      **Non guidato e dichiarato tale** (dal critic): Shift+Tab e frecce sul
      campo nuovo, il campo in viewport stretto, due Save rapidi nella stessa
      sessione di dialogo, e le vie di export (print/PNG/CSV) con una valuta
      dichiarata — quest'ultima fuori da Goal F per la §6 della spec.
      §5.8: il campo dichiarato nel dialogo People (e' l'unita' dei numeri
      digitati li'), il terzo argomento `currency?` a `GanttHandle.setResources`
      (`ganttHandle.ts:64`) portato per la catena `ResourceDialog.save` →
      `App.tsx:563` → handle. **Tri-stato**: assente = non toccare (cio' che fa
      gia' `commitResources`, `agentApi.ts:231`), `null` = cancella, stringa =
      imposta.
      **Una sola chiamata all'handle, o sono due passi di undo**: `recordedChange`
      deduplica solo su testo identico, quindi tariffe e `currency` devono
      passare insieme. E' l'accept che vale la pena guidare per primo.
      **E' il secondo scrittore di `currency` della §5.7**: quindi e' questo il
      task che aggiunge il **quarto** call site di `rebuildColumns()` — F4b ne
      ha messi tre (`setColumns`, `loadProject`, `setCurrency`) e le testate
      `Rate (EUR)` / `Cost (EUR)` devono seguire anche da qui. `docs/view.md`
      dice «three call sites»: va aggiornato nello stesso commit, o mente.
      **Il dialogo deve nominare il picker** (accept §8): chi inserisce la prima
      tariffa e' la persona che deve sapere che le colonne esistono e nascono
      nascoste — e' la frase che riscrive il `.dialog__hint`, che F5a e F5c
      lasciano intatto per questo.
      **E porta lui il bullet `CHANGELOG.md` delle superfici tariffa del
      dialogo**, deciso al brief di F5a e non dimenticato: qui la storia del
      dialogo e' intera (tariffa di default, periodi, valuta), e un bullet
      emendato tre volte e' peggio di uno alla fine. Sotto `## Unreleased`,
      che **non** si rinomina (la deroga non e' comprata).
**F6 spezzato in due il 2026-09-16, sulla regola e non sulla campagna.** La
sua accept (1) chiede che il dialogo dica **lo stesso testo** della cella di
griglia su quattro righe: re-implementare i quattro rami nel dialogo lo
renderebbe vero solo su quelle quattro (la trappola del censimento), e sarebbe
il **terzo** domicilio della regola del `≥` e il secondo di `No rate for X on
these days`. Il debito a due case di F4b diceva «se si riapre, si unifica»: F6
e' quella riapertura. Quindi F6a estrae la regola e ci riporta la griglia
(nessun cambiamento visibile, e i **primi test** che quella regola abbia mai
avuto), F6b rende le due voci e il layout a tre tracce. Il taglio cade sulla
campagna: F6b se la prende quasi tutta, F6a paga una sola ri-guida delle nove
righe.

- [x] F6a [impl] — La regola della cella costo/tariffa, in un posto solo —
      `2795c7d`. `src/gantt/costCells.ts` nuovo: `rateCellText` e `costCellText`, puri,
      che restituiscono un descrittore neutro rispetto al medium
      (`{ text, title, derived }`) — la griglia lo avvolge in HTML, il dialogo
      in JSX, e la classe del registro *derived* la scegle ognuno per se'
      (`gantt-derived` vs `taskinfo__derived`). `gridColumns.ts` ricablato sui
      due, **niente altro cambia**: `escapeHtml` resta al confine HTML (il
      `title` porta il nome di una persona, cioe' input dell'utente), la
      regola del null resta in `reportedCost` (`cost.ts`, intatto).
      `costCells.test.ts` nuovo: **12 test, i primi che quella regola abbia mai
      avuto** (era verificata solo nel browser). 517 → 529. `renderCellText`
      locale a `gridColumns.ts` ricostruisce le tre forme HTML in un punto
      solo: deviazione dichiarata, accettata.
      **Critic `sonnet`: pass, zero finding.** Corsia 129k, critic 132k — il
      taglio ha fatto il suo lavoro (F5c, stesso dialogo senza taglio della
      campagna, era 218k/242k). Mappatura ramo-per-ramo provata nei due sensi
      contro `git show HEAD:gridColumns.ts`, em dash U+2014 verificato sul
      `codePointAt` di una cella viva (e il separatore del range e' U+2013,
      come dice `view.md`), le nove righe ri-derivate dal DOM, il ciclo
      nascondi/ri-mostra byte-identico, e **tre celle sue**: un nome ostile
      (`"><img src=x onerror=alert(1)>`) escapato correttamente nel `title`
      (`imgCount 0`, nessun alert) e `A & B` senza doppio escape; una tariffa
      a tre valori **non monotona nel tempo** (100 → 200 → 162.555) che rende
      `100–200`, cioe' min–max vero e non primo–ultimo (`cost.ts` ordina per
      valore, quindi l'indice non e' un off-by-one); e il summary a effort
      zero, dove solo la prima guardia decide.
      **Un rilievo fuori bar, misurato e giudicato non difetto dall'hub**: un
      summary i cui figli sono **tutti** non costati rende `—` con `title`
      *No resource* invece di un `≥`, perche' `reportedCost` da' `null` e la
      guardia del null precede quella di `uncostedDays`. E' la §5.4 alla
      lettera (`costedDays === 0 && uncostedDays > 0` → `—` col motivo).
      **La ragione che gen 10 ha scritto qui era falsa** e F6b l'ha corretta
      leggendo il codice: su un summary il `resource_id` **non** rolla dalle
      foglie (`ganttRows.ts` scrive `task.resourceId ?? ''`), quindi in griglia
      il motivo nomina la persona che la riga aveva quando era foglia. Il
      comportamento resta non difetto; la ragione vera e la divergenza col
      dialogo stanno in `docs/view.md` § *Details dialog*, misurate. Il quarto
      doc di questo goal che registrava male una ragione.
- [x] F6b [impl] — Il costo nel pannello dettagli — `1362652`.
      Le due voci *Computed* sui descrittori di F6a (`title` sul `<dd>`,
      `taskinfo__derived` e mai `--cell`, React che escapa da se'), la griglia
      a `repeat(3, 1fr)` con `row-gap: var(--space-2)`, e `currencyLabel` in
      `costCells.ts` — **unica casa della forma `Cost (EUR)`**, letta dalla
      testata di griglia (`columns.ts`) e dall'etichetta della voce. 529 → 532.
      Nessun file sotto `src/scheduler/`, nessuno fra `cost.ts`/`resources.ts`/
      `plan.ts`: verificato sul diff.
      **Il predicato milestone del dialogo non e' quello che il prompt di
      consegna diceva**: e' `!task.isSummary && effort.trim() !== '' &&
      Number(effort) === 0`, cioe' legge il **campo in edit**, e serve a far
      commutare il titolo mentre si digita uno zero. Le due voci nuove leggono
      invece `task.nominalDays === 0 && !task.isSummary` — il predicato di
      `project.ts` da cui nasce il `type` della riga di griglia — quindi le
      due superfici partizionano le righe per costruzione, non per fortuna.
      Ri-localizzato al brief: un `file:line` copiato non e' verificato, e
      nemmeno un predicato.
      **Critic `sonnet`: pass, zero finding.** Corsia 181k, critic 181k — la
      campagna era quella di F5c e il brief l'ha tenuta a 181k invece di 242k
      dettando tutto il codice: la corsia ha speso il suo contesto nel browser,
      non a decidere. Ha ri-guidato i cinque accept (nove righe di Fixture C,
      raise il `2026-09-24`), **piu' otto celle sue**: lo zero digitato in
      Effort su una foglia costata (titolo che commuta, Computed che tiene la
      soluzione — e il simmetrico su una milestone), un nome ostile nel
      `title` del `—` (nessun doppio escape, nessun nodo iniettato, zero
      `escapeHtml` nel file), `title` **assente** e non `title=""` dove non
      c'e' motivo, `is_summary` di griglia e `isSummary` del dialogo che
      leggono la stessa `solved.summaryIds` (anche su un summary col solo
      figlio disabled), la testata dopo un `setCurrency` a colonne nascoste e
      dal quarto call site (People), il viewport a 480px (tracce a 128px,
      niente wrap) e lo schema chiaro caricato da subito.
      **La riga che nessuno dei due dava per provata**: un `Range` su un `dd`
      rende **due** rect quando l'elemento ha due nodi di testo
      (`{formatDays(x)} d`), che e' anche cio' che sembra un wrap. Il critic
      l'ha chiusa misurando `top` e `height` dei due rect. Graduata in
      `docs/verification.md` nello stesso commit, accanto alla regola dello
      `scrollWidth`: su un blocco `scrollWidth === clientWidth` vale wrappato
      o no, quindi non prova niente.
      **Chiuso dall'hub prima del critic**, due righe: il docblock di
      `currencyLabel` citava `§5.4` di una spec che la goal review cancella (una
      citazione appesa), e la frase nuova di `view.md` registrava lo stato
      precedente del blocco. Entrambi difetti del mio brief, che dettava il
      docblock alla lettera.
      **Non guidato e dichiarato tale** (dal critic): Tab/Shift+Tab nel `dl`
      (misurato invece: zero discendenti focusabili, quindi non c'e' dove
      andare), un toggle *live* di `prefers-color-scheme` (non emette `change`,
      solo da caricamento), viewport sotto i 480px, e le vie di export col
      blocco Computed (fuori scope).
- [x] F8 [impl] — Colonne e banda di testata in `planFigure` — `fa4fd44`.
      `FigureOptions.columns`, `FIGURE_CELLS` (`Record<PlanColumnName,…>`
      esaustivo), `geometryOf` che riceve la larghezza delle colonne invece di
      `PERSON_WIDTH`, banda di testata di `HEADER_BAND` 18px. Chiuso al primo
      giro, zero findings.
      **Non ha effetto visibile nell'app e non e' una dimenticanza**: `App.tsx`
      non passa `columns`, il default legacy resta byte-identico. L'utente l'ha
      comprato come API scegliendo C; il suo cliente e' il dialogo di export di
      Goal G. Dichiarato qui perche' la goal review non lo legga come codice
      infilato di straforo.
      Primo sottotask del goal **senza campagna nel browser**, e non e' venuto
      economico: 157k/146k. Il pin byte-identico e' stato catturato prima
      dell'edit — e **il critic l'ha ricostruito da `git show HEAD:` invece di
      credere alla dichiarazione**, trovandolo identico: e' cio' che distingue
      il pin da una tautologia. Ha anche sondato che l'esaustivita' del
      `Record` e' una garanzia vera (un nome finto in `PlanColumnName` →
      TS2741 su `planFigure.ts` e `gridColumns.ts`), e guidato 23 celle contro
      le 6 dell'accept.
      **Due misure fuori accept, da leggere in Goal G, non difetti qui.**
      (a) La testata `Rate`/`Cost` della figura **si tronca appena `currency`
      supera i 3 caratteri** (`Rate (EURO)` → `Rate (EUR…`): `figureWidth` 70
      e 84 danno 10 e 12 caratteri a `truncate`, e `validateCurrency` accetta
      fino a 8 — `Cost (XXXXXXXX)` sono 15 caratteri, 102px. **Qui l'accept
      l'ha restretto il brief dell'hub**: la §8 dice «measures the widest
      string of each», il brief ha circoscritto la misura alle stringhe della
      Fixture C, e la stringa piu' larga legale e' la testata, non una cella.
      Non allargata di proposito: il budget di larghezza della figura esiste
      solo quando Goal G la cabla a un dialogo di export, e allargarla adesso
      sarebbe indovinare contro una valuta che nessuno ha digitato. **Chi
      cabla `columns` in Goal G ridecide i due `figureWidth` con un layout
      davanti.**
      (b) A `width` molto piccole `geometryOf` produce un `pxPerDay` negativo —
      **preesistente**, identico sul percorso legacy alla stessa `width`
      (confrontato direttamente dal critic), quindi non una regressione.


**Goal review girata il 2026-09-16: `fix-first`** (fable-5-1 confermato in
header; read-only, niente commit). Nessun MISSING negli accept e nessuno
SMUGGLED: `src/scheduler/` intatto verificato sulla diff, le quattro decisioni
dell'utente onorate, e `FigureOptions.columns` senza chiamante giudicato
scoping onesto (l'opzione C l'ha comprato, 220 righe di test lo appuntano).
Ha confermato di passaggio, contro i sospetti in giacenza, che il filtro
`roots` di F2b e' corretto (`plan.ts` — i summary tutti-disabled stanno in
`disabledIds`, i nidificati cadono sul filtro `live` del padre), che il
suffisso di `PeriodRowList` e' giusto, e che l'assenza di un harness React non
e' un debito che questo goal ha aggravato: le regole stanno in moduli puri, ed
e' il seam giusto. L'unico posto dove la UI fabbrica uno zero resta il periodo
tariffa seminato a `0` (`RatePeriodList.tsx`), dichiarato.
**Quattro azioni, e la review resta il bar finche' non sono chiuse** — quindi
la spec `T59-costs.md` non si pota ancora, e la release non si propone.
L'utente ha scelto il 2026-09-16 di farle **tutte e quattro**, F12 compresa.
**Ordine: F9 → F13 → F14 → F10 → F11 → F12**, seriale: F9 e F10 toccano
entrambe `costCells.ts` e F9 ne cambia la firma, quindi F10 la segue e non la
precede. F13 e F14 sono due richieste dell'utente arrivate a goal aperto, e
rientrano nella review che girera' sul delta. **F15 e' nato dalla misura di
F14 e la sua posizione e' dell'utente**: tocca `columns.ts` come F14 ma e' una
decisione sua, non un'azione della review.

- [x] F9 [impl] — La ragione del costo su un summary non deve nominare una
      persona che sulla riga non c'e' — `12e1006`. `costCellText` prende un
      `isSummary` **obbligatorio** e sul ramo senza cifra ignora `resourceName`;
      i tre chiamanti (`gridColumns.ts`, `planFigure.ts`, `TaskDialog.tsx`) lo
      passano, ed e' l'obbligatorieta' — non il flag — il meccanismo contro la
      deriva: un renderer nuovo non compila senza rispondere. 540 test (+1).
      Accept coperto: unit che passa `resourceName: 'Marta'` **con**
      `isSummary: true` e pretende `No resource` (un caso con `null` non
      proverebbe niente), e nell'app griglia e dialogo misurati concordi sulla
      riga (`—` / `No resource`), con la premessa di gen 11 rovesciata:
      «§5.4 alla lettera» era la lettera letta su un campo sbagliato.
      **La ragione nel doc e' stata scritta male due volte nello stesso task**,
      ed e' la sesta del goal: la corsia ha chiuso il bullet di `docs/view.md`
      affermando che *tre* superfici ora concordano, mentre la sua stessa misura
      diceva che `FIGURE_CELLS.cost` rende solo `.text` e butta `.title` (e che
      `App.tsx:771` non passa `columns`, quindi in stampa non c'e' nessuna cella
      di costo — gia' registrato in `docs/file-format.md`). L'hub ha riscritto
      **avendo in mano quella misura** e l'overclaim e' sopravvissuto in forma
      piu' sottile; l'ha chiuso il critic. Ora il bullet dice quali due
      superfici rendono il `title`, e che la terza non rende ragioni.
      Misurato dal critic e non dalla corsia (celle che la fixture non componeva
      e nessuna rotta): foglia davvero senza tariffa → `No rate for Paolo on
      these days` (il ramo non-summary non e' stato collassato), summary
      parziale → `≥ 1,200` / `3 d of effort not costed`, summary interamente
      costato → cifra nuda, milestone e summary a effort zero → cella vuota,
      riga disabled e ramo chiuso invariati, console pulita.
- [x] F14 [self] — Nessuna testata di colonna sia tagliata — `7db1229`
      Aperto dall'utente il 2026-09-16 su richiesta esplicita, **in testa alla
      coda**: prima di F10.
      Misurato dall'hub su F13 e da non ripagare: con `currency` `EUR` la
      testata `Rate (EUR)` **non entra** nei suoi 62px e viene resa
      `Rate (EUR`, tagliata, senza ellissi e senza `title` che la riveli
      all'hover. Col `$` dell'utente entra. `gridWidth` oggi: `resource_id` 76,
      `nominal_days` 62, `start_date` 84, `end_shown` 84, `elapsed_days` 62,
      `rate` 62, `cost` 84 (`columns.ts`).
      **Non e' «allargare Rate»: e' un censimento.** Ho misurato *una* cella e
      una sola valuta — la lezione di F8, F2b e F3b e' che un elenco e'
      completo o non e' un elenco. Il task deve produrre una **matrice**: ogni
      testata del registro × la valuta piu' larga che `validateCurrency`
      ammette (8 caratteri → `Rate (XXXXXXXX)`, 15 caratteri) e una da 3, con
      la larghezza resa misurata contro il `gridWidth`, piu' un elenco
      esplicito di cio' che la misura **non** ha guidato. `Duration` a 62px e
      `Resource` a 76 sono sospette e non misurate.
      **Vincoli che non si riaprono**: la valuta sta nella testata e mai nella
      cella (decisione #2 dell'utente), e Rate/Cost restano nascoste per
      default (#5). Le larghezze **non sono persistite** — `yagni.columns.v1`
      porta solo i nomi, e il rebuild del picker riporta per nome solo le
      larghezze trascinate *nella sessione* (F7) — quindi cambiare un
      `gridWidth` di default non ha migrazione, ma **sposta la griglia di ogni
      progetto esistente**: il budget dei 706px e' dell'utente, e una somma
      nuova va riportata a lui prima del commit.
      Accept: la matrice nel report, nessuna testata tagliata con una valuta da
      3 caratteri, e per il caso da 8 una decisione dichiarata (allargare, o
      `title` sulla testata, o taglio accettato) con la misura accanto.
      **Censito e chiuso con un solo numero: `rate.gridWidth` 62 → 84.**
      Guidate: le 7 testate del registro piu' `text`, e su Rate/Cost dieci
      valute — assente, `$`, `₽`, `EUR`, `€€€`, `CHF`, `人民元`, `WWW`,
      `EUROCENT`, `WWWWWWWW` — in due font. **Non guidate**: le celle delle
      altre cinque colonne, i `figureWidth` (di Goal G), una larghezza
      trascinata a mano (ogni colonna e' `resize: true` e la trascinata non
      persiste), il tema chiaro, le valute da 4 a 7 caratteri, e un'altra
      macchina. I tre esiti che contano. (a) La testata e' clippata **a
      qualunque valuta da 3
      caratteri**, non solo `EUR`: la piu' larga misurata e' `Rate (WWW)`
      79.22px, la CJK `Rate (人民元)` 78.06, e 84 le tiene tutte con 4.78px di
      margine (80 ne lascerebbe 0.78, cioe' un secondo `Duration`). `Cost` a
      84 teneva gia' ogni valuta da 3 (`Cost (WWW)` 81.98, +2.02) e non si e'
      toccata. (b) `Duration` ha **esattamente 0.00px di margine** (ink 62.00
      su 62; il `Range` dice 62.66 perche' il letter-spacing si somma anche
      dopo l'ultimo glifo) — lasciata cosi': il difetto visibile non era
      `DURATION` ma `DURATIONRATE (EUR`, due testate attaccate perche' `rate`
      sforava, e allargarla sposterebbe i 706px per nulla che si veda.
      (c) **`text-overflow: ellipsis` misurata e scartata**, non dedotta:
      iniettata e fotografata a 4×, il browser riserva la larghezza dei
      puntini e `DURATION` perde *due* caratteri (`DURATI…`) per 0.66px di
      sforamento. Il clip e' il renderer migliore qui.
      Totali misurati: default **706 invariato** (`rate` e `cost` restano
      `defaultShown: false`, quindi il budget dell'utente non si muove), +Rate
      790 (era 768), +Rate+Cost 874 (era 852).
      **Trovato dal censimento e graduato in `docs/dhtmlx.md`**: il font della
      testata non e' dell'app — `Inter` non compare da nessuna parte in `src/`,
      lo mette il CSS di dhtmlx sulla head cell (piu' specifico del nostro
      `font-family: inherit`) con un `@font-face` che lo scarica da
      `fonts.gstatic.com` in `font-display: swap`. Quindi ogni numero di testata
      e' di un webfont, e offline resta il fallback: misurati entrambi, 84 tiene
      in Inter **e** in Helvetica (che sulle etichette piu' larghe e' piu'
      stretto). Le celle invece ereditano e rendono `system-ui` a 13px.
      **La ragione nel doc era falsa, ed e' la settima del goal**: la prima
      stesura diceva che sono «le sole due colonne la cui testata e' la loro
      stringa piu' larga» — l'ha trovata il critic misurando una cella da
      109px. Riscritta su cio' che resiste alla misura (la testata ha un
      massimo legale, `validateCurrency` 8 caratteri; la cella nessuno,
      `resources.ts:120` vuole solo finito e `>= 0`), con la premessa in **una**
      casa sola (`columns.ts`) e `docs/view.md` che la indica.

- [ ] F15 [self] — La cella di costo di un summary parziale e' tagliata
      Trovato dal censimento di F14 (misurato, non dedotto) e **lasciato
      all'utente perche' muove il suo budget**: la cella ha un box contenuto di
      72px dentro gli 84 della colonna (`padding: 0 6px`, `system-ui` 13px), e
      `≥ 12,250,000` misura 74.17px — **tagliata di 2.17px**, senza ellissi e
      senza `title`. Non e' il caso patologico: una cifra nuda ci sta fino a
      `122,250,000` (68.72px, +3.28), ma il prefisso `≥ ` di un summary
      parzialmente costato costa ~5.5px, quindi **un totale a 8 cifre con del
      costo mancante basta** — un programma da 12M in una valuta qualunque.
      Preesistente (F14 non ha toccato `cost.gridWidth`) e **una decisione
      diversa dalla sua**: allargare `cost` sposta la griglia di chi mostra la
      colonna (874 → 880+ con Rate), e il tetto non esiste comunque, quindi la
      scelta e' fra «un caso plausibile in piu' ci sta» e «la cella si taglia
      in silenzio, dichiarato». Il range tariffa e' sullo stesso filo:
      `2,400–2,600` misura 68.20px, +3.80.
      Accept: la larghezza scelta dall'utente con la somma nuova accanto, o il
      taglio dichiarato in `docs/view.md` con la misura.
- [x] F10 [self] — `currencyLabel` e il testo dell'effort non costato tornino a
      una casa sola — `4d27480`. Tre mosse e **nessuna stringa che un utente
      legge cambiata**: `planCsv.ts` chiama `currencyLabel` invece di
      ri-scrivere `Cost (${currency})`; `uncostedNote(days)` nasce in
      `costCells.ts` e la cella di costo parziale e la status bar la chiamano
      entrambe; il commento di testata di `columns.ts` nomina `FIGURE_CELLS`
      (`planFigure.ts`), che F8 aveva atterrato lasciando la riga «a figure-side
      record later» stantia dal suo stesso commit.
      **La ragione nel doc e' stata riparata rendendola una regola, non un
      elenco** — e' la lezione del secondo giro di critic su F14: la frase di
      `docs/view.md` diceva «letta dalla testata di griglia e da questo `dt`»,
      cioe' un censimento di due voci che il CSV gia' smentiva; ora dice che
      *ogni* superficie che etichetta una cifra chiama quella funzione e nessuna
      ri-scrive le parentesi. Stessa mossa nel doc comment di `currencyLabel`,
      che l'enumerazione l'ha persa.
      Verificato dal critic (sonnet, 102k, pass al primo giro) **sul percorso,
      non sulla riga**: cinque siti di etichetta e tutti passano per
      `currencyLabel` — il registro di `columns.ts` serve testata di griglia,
      CSV, testata della figura (`entry.label`) e **il picker delle colonne**,
      superficie che ne' l'accept ne' la vecchia frase nominavano, piu' i due
      `dt` di `TaskDialog.tsx`; l'unico `Cost (` letterale rimasto in `src/`
      fuori da un'attesa di test e' dentro `currencyLabel` stessa.
      `planCsv.test.ts` **ricostruito da `git show HEAD:` e trovato identico**,
      non creduto. Nel browser, fixture parzialmente costata (`uncostedDays: 5`,
      `EUR`): status bar e cella di costo rendono lo stesso
      `title="5 d of effort not costed"`, letto dal DOM vivo — l'unico percorso
      visibile che questo refactoring tocca e che nessun unit test copre.
- [x] F11 [self] — README e `agentApi.help.md` dicano che il piano costa —
      `5d1d953`. Unico MISSING della review. Due paragrafi nuovi nelle Features
      (cosa costa il piano, e il picker delle colonne), la riga *Reading* che
      ora descrive la forma che `getResources()` rende davvero, e la voce
      Rate/Cost del changelog estesa al totale in status bar e alle due colonne
      CSV — **estensione dichiarata, non contrabbandata**: erano feature
      visibili di questo goal che nessun bullet nominava, e il changelog e'
      l'altra superficie che l'utente legge.
      **La frase sbagliata l'ho intercettata prima del critic, ed era la solita
      forma**: la prima stesura diceva che una riga non prezzata «resta vuota»,
      mentre `costCellText` rende `—` con la ragione, e *vuota* e' la riga a
      effort zero. Due esiti diversi collassati in uno; riscritta prima di
      consegnare, e il critic ha poi letto l'`innerHTML` di entrambe le celle
      per confermare che restano distinte.
      Campagna del critic (sonnet, 162k, pass al primo giro), **ogni clausola
      falsificata nell'app, non letta dal sorgente**: due periodi tariffa
      annidati → vince il dichiarato per ultimo (300, non 200 ne' una media);
      task a cavallo → `dailyRates: [100, 200]`; summary → `cost 1500`,
      `uncostedDays 3`, cella `≥ 1,500`; status bar `Cost ≥ 1,500 EUR · 3 d not
      costed`; foglia senza tariffa → `—` + `No rate for Bob on these days`
      contro milestone → cella davvero vuota; **persistenza del picker provata
      su un progetto diverso** (toolbar *New*, non un reload); default a griglia
      705px con Rate/Cost spente. `getResources()` chiamata viva: persona con
      tariffa → `{id, name, availability, availabilityOverrides, dailyRate,
      rateOverrides}`, persona nuda → `{id, name, availability}` — niente
      promesso che non ci sia. CSV scaricato davvero (Blob intercettato):
      `...;Disabled;Cost;Uncosted (d)`, e il badge resta `v1.2` senza popup.
- [ ] F12 [impl] — Estrarre `toDraft`/`toResources` e appuntare
      «absent stays absent»
      Azione dichiarata **opzionale** dalla review. Le due funzioni sono pure e
      dentro `ResourceDialog.tsx`, quindi oggi la regola che salvare il dialogo
      People intatto non sporchi il file e' guidata solo a mano (il critic di
      F5a). Estratte in un modulo, le quattro combinazioni assente/presente si
      pinnano senza jsdom. Nessun harness React da introdurre — e' proprio il
      punto.

- [x] F13 [self] — I numeri si leggano in colonna — `dbf747e`. Richiesta
      dell'utente il 2026-09-16 sulla sola Cost; alla domanda di perimetro ha
      scelto **tutte le numeriche**, quindi `align: 'right'` su `nominal_days`,
      `elapsed_days`, `rate` e `cost` in `gridColumns.ts`, e `center` solo su
      date e avatar. Esce dal perimetro di Goal F (Effort e Duration sono di
      Goal E, chiuso) per scelta sua, coi numeri davanti.
      **Misurato nell'app, ed e' il motivo per cui la mia accept scritta a
      tavolino era sbagliata**: le celle seguono `align` (tutte e quattro
      `right`), **le testate no** — ogni `.gantt_grid_head_cell` resta
      `center`, e i typings dicono l'opposto (`GridColumn.align` e'
      documentato come allineamento *del titolo*, e non esiste un secondo
      campo). Quindi «testata coerente con la colonna» costa una regola CSS
      nostra piu' un gutter da far combaciare (celle 6px, testate 0), per una
      leggibilita' che lo screenshot non mostra: testate lasciate centrate,
      decisione dell'80% dichiarata, non silenziosa. Trap in `docs/dhtmlx.md`.
      Guidato oltre l'accept: editor inline di Effort (l'unica delle quattro
      che ne ha uno) apre con `55`, `text-align: start` proprio — non eredita
      la cella, quindi nessun editor e' toccato; cella `≥ 3,000` allineata col
      prefisso a sinistra e le cifre in colonna; `—`/`No resource` su summary
      con risorsa stantia (F9 riconfermato su una riga nuova); collapse ed
      expand della griglia e il redraw non perdono l'allineamento; console
      pulita.
      **Difetto preesistente trovato di passaggio e non toccato**: la testata
      `Rate (EUR)` **non entra** nei suoi 62px di `gridWidth` e viene tagliata
      a `Rate (EUR` (misurato con `currency` `EUR`; con `$` dell'utente entra).
      E' la stessa forma del finding di F8 sulla figura — la stringa piu' larga
      di una colonna e' una testata, non una cella — ma sulla griglia. Allargare
      le due colonne cambia il layout di ogni progetto esistente e i 706px:
      **decisione dell'utente**, da aprire come task a se'.

**Non cancellare `.claude/specs/T59-costs.md` allo sweep degli orfani finche'
la goal review di F non e' girata**: gli accept dei sottotask stanno nella sua
§8 e sono meta' del bar della review.

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

- [ ] T66 [utente] — Gli screenshot del README rappresentano un'altra app
      `docs/assets/hero.png` e' del 2026-09-04 e **la sua UI e' in italiano**,
      mentre l'app e' inglese end-to-end (`gantt.i18n.setLocale('en')` cablato,
      `GanttChart.tsx:699`, e nessun dizionario italiano in `src/`): e' lo
      scarto piu' netto, e non l'ha introdotto Goal F. Gli altri tre, misurati
      dal critic di F11 contro lo stato di default di oggi: Effort e Duration
      centrati nell'immagine e allineati a destra nell'app (F13), i due bottoni
      nuovi in toolbar (comprimi griglia e scelta colonne, F7) assenti, e il
      badge di versione assente. `resource-load.png` non e' stato confrontato.
      **Decisione dell'utente, e il momento naturale e' T65**, che riscrive il
      README col nome nuovo: rifare le due immagini li' costa una fixture sola.
      `CLAUDE.md` chiede la ripresa «quando la UI deriva abbastanza da
      travisarle»; quattro scarti su uno screenshot solo sono la misura, la
      soglia e' sua.

- [ ] T64 [utente + hub] — Rinominare il repo in `arrogantt` e ripubblicare Pages
      Va **prima** di T65, cosi' i link che T65 scrive nel README nascono
      vivi. Non lo esegue una corsia: sta fuori dal repo e cambia un URL
      pubblico.
      Misurato prima di scriverlo: `origin` e'
      `https://github.com/okon3/yagni.git`; `vite.config.ts:39` ha
      `base: './'`, quindi gli asset sono relativi e **il deploy non va
      toccato** — e' la cosa che di solito si rompe qui (un `base: '/yagni/'`
      avrebbe voluto un commit suo); `deploy.yml` passa `enablement: true` a
      `configure-pages`, quindi Pages si riconfigura al push successivo.
      GitHub tiene redirect permanenti di web, API e git dopo un rename: i
      clone esistenti continuano a spingere. Muoiono solo se qualcuno ricrea
      `okon3/yagni` — non ricrearlo.
      **Quel che non redirige e' Pages**: `okon3.github.io/yagni/` sparisce,
      il sito rinasce su `okon3.github.io/arrogantt/`. Chi ha il vecchio link
      va avvisato.
      Accept: il workflow del primo push dopo il rename e' verde **e** il
      nuovo URL apre l'app — aperta davvero, non dedotta dal workflow verde;
      `git remote -v` dice `arrogantt`.

- [ ] T65 [impl] — ARROGANTT dentro il repo: nome, agent API, docs, README
      Rename del nome visibile e della superficie agenti. **Nessun alias
      `window.yagni`**: taglio netto, non esistono script fuori da qui.
      **Nome deciso dall'utente, si scrive cosi' e non si reinterpreta**:
      `ARROGANTT — Automatic Resource Resolution & Optimization`, in
      `index.html:7`, in testa ad `agentApi.help.md` (quindi in `/llms.txt`) e
      come H1 + sottotitolo del README, che gia' ha i due slot.
      **La tagline italic del README resta quella di oggi** («the Gantt chart
      that knows people can't do two things at once»): dice cosa fa il
      prodotto, dove «the end date is not up for negotiation» spiega solo il
      nome — non si spende la riga migliore del README per una battuta.
      Il globale e' `window.arrogantt`, per intero: nessuna abbreviazione, o
      la help e `/llms.txt` insegnerebbero un nome che il README non usa.
      Censimento misurato (`grep -ri`, esclusi `dist/` e i log):
      - `index.html:7` — `<title>`
      - `src/App.tsx:761` `window.yagni =`, `:770` messaggio in console,
        `:293` commento
      - `src/gantt/agentApi.ts:72` — la dichiarazione su `Window`
      - `src/gantt/agentApi.help.md` — 7; **e'** anche `/llms.txt` e
        `help()`, quindi stesso commit e mai una seconda copia
      - `vite.config.ts:12,20` — il plugin si chiama `yagni-llms-txt`
      - `README.md` — 17: titolo, badge del deploy, tre link a Pages, URL di
        clone, alt della hero
      - `docs/view.md` 3, `docs/verification.md` 2, `CLAUDE.md` 3,
        `CHANGELOG.md` 1
      - `package.json:2` — `"name"`; `private: true`, nessun registry dietro
      - `columns.test.ts` 6, `draft.test.ts` 1 — leggono le chiavi di storage
      **Fuori dal find-replace**: `src/assets/favicon.svg` porta il testo
      `YAGNI` (due occorrenze) — e' il logo, non una stringa, e nove lettere
      non stanno dove ne stavano cinque. Monogramma o ridisegno; se cresce,
      task a se'.
      **`.claude/` non si tocca** (briefs, specs, `launch.json`): e' archivio,
      dice come si chiamava allora.
      **Deciso dall'utente il 2026-09-16, coi costi davanti e contro la
      raccomandazione — le chiavi di localStorage si rinominano**:
      `yagni.draft.v1` (`draft.ts:16`), `yagni.seenVersion`
      (`seenVersion.ts:8`) e `yagni.columns.v1` (`columns.ts:78`) diventano
      `arrogantt.*`. **Nessuna migrazione**: tre replace, non tre
      leggi-vecchia-scrivi-nuova. Conseguenze accettate adesso, non da
      scoprire alla prima apertura — un draft non salvato sparisce, il
      changelog si riapre una volta per tutti, le colonne spuntate tornano al
      default, e le tre chiavi vecchie restano orfane nel browser. Ripulirle
      sarebbe un `removeItem`, ma e' codice che esiste solo per il passato:
      non si scrive.
      Accept: `grep -ri yagni` fuori da `.claude/` e `dist/` non trova
      **niente** — le chiavi comprese; nel browser `arrogantt.help()` ritorna il
      testo nuovo e `/llms.txt` servito e' identico ad `agentApi.help.md`;
      con un `yagni.draft.v1` in storage l'app parte pulita e non fa la
      domanda del draft, e al primo edit compare `arrogantt.draft.v1` (la
      vecchia resta orfana e non viene letta); `npm test`, `npm run build`,
      `npm run lint` puliti.

**Notato dal critic di F7 e deliberatamente non aperto come task**: il
popover del picker si posiziona una volta dall'ancora catturata all'apertura
e **non segue un resize della finestra** (misurato: da 760 a 500px di
larghezza resta a left 475 / right 645, cioe' fuori dal viewport). E' la
stessa forma di `RowMenu`, che ha lo stesso comportamento da sempre e che
nessuno ha segnalato: sotto la regola dell'80% non vale un meccanismo nuovo.
Se qualcuno lo segnala, si aggiusta **una volta per entrambi**, non due.

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
- **Dimensionamento**: impl oltre ~200k = task da splittare (T35, F7 257k, F1
  222k, F4b 228k); splittato rende 120-170k a meta'. **Si taglia la campagna di
  verifica, non il codice**: F5a e F5c, ri-splittate sul codice, sono risalite a
  215k e 242k; se la campagna non si taglia si detta il codice (F6b 181k), e
  **toglierla del tutto non rende economico il task** (F8, 157k/146k). Una
  correzione via SendMessage costa meno di un fresh spawn (~40k), ma non oltre
  ~190k. **Il critic e' la voce piu' cara e la piu' redditizia**: 75-95k a
  tavolino, 102-242k nel browser, 191k la goal review; su T58 ha ribaltato una
  premessa, su F8 il pin da `git show`, su F9 e F14 un overclaim dell'hub.
- **Un elenco enumerato da una sezione di spec e' completo o non e' un elenco.**
  F2b: la consegna dava due regole del null su tre e taceva il filtro
  `disabledIds` della §5.3, e l'hub ha poi giustificato la scelta da se' senza
  rileggerla. F3b: il brief ha enumerato le superfici della §5.6 saltando la
  tabella *Writing — people*, da cui dipende la fixture del goal. F8: il brief
  ha ristretto «the widest string of each» alle stringhe della fixture, e la
  piu' larga legale era una testata — l'ha trovata il critic. Vale per chi
  consegna, per chi implementa e per l'hub che briefa: si rilegge la sezione.
- **Le misure piccole le fa l'hub**: due probe vitest usa-e-getta (T56), due
  Explore non residenti (T57) e il censimento di F14 nel browser hanno chiuso
  un task a testa dove una corsia paga 40k di solo ingresso. **Prima di
  briefare, misurare la premessa**: se cade, il brief non serve.
- **Una citazione copiata non e' verificata**: ne' un `file:line` (T43), ne' un
  nome di tipo (T48), **ne' un predicato** (F6b: il `isMilestone` del dialogo
  legge il campo in edit, non `effortDays` come diceva la consegna). Si
  ri-localizza dopo l'ultima modifica, e si cita per simbolo.
- Il critic trova cio' che l'accept non chiedeva: e' la regola, non l'eccezione
  — si briefa chiedendogli **la domanda che fa paura**, e su uno spostamento
  **l'hash, non la lettura**. Misurata, e' cio' che rende il pass non speranza.
- **Cio' che una corsia dichiara impossibile o preesistente va confrontato con
  l'evidenza**: T43 dava il drag reale per non guidabile, T41 e F4b l'hanno
  fatto. Su T48 fatto bene: misurato su HEAD **e** sul tree.
- **Una ragione registrata male in un doc e' peggio di nessun doc**: sette
  volte in questo goal (F7, F5c, F5b, F6a, il `currencyLabel` di F6b, F9,
  F14), quasi sempre per mano dell'hub, e tre volte l'ha chiusa il critic. Si
  verifica sul percorso che la usa, non sulla riga che la enuncia, **e
  riscriverla non la ripara** (F9). Chi enumera superfici dica quale rende il
  campo; **chi dice «la stringa piu' larga» dica contro cosa e' limitata** —
  la testata di F14 ha un massimo legale, la sua cella nessuno. **E un elenco di
  superfici e' un censimento che scade: F10 l'ha riscritto come regola.**
