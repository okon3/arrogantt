# Plan

## Cosa resta sul tavolo

Ultima release **`v1.7`** (2026-11-21): ritmo dei task (Goal L), date fisse,
colore per persona, descrizioni e micro-interazioni. Nessun goal e' in corso.
- **T16** (audit mobile, sotto `## Maintenance`) e' il prossimo passo
  pronto; il suo report apre **Goal C** per davvero.
- **Goal J** (confronto stima/consuntivo) e' **sospeso dall'utente**;
  le date fisse ne hanno gia' costruito la meta' «record».
- Le goal review di L e delle date fisse **non sono corse**; la potatura del
  2026-11-23 ne ha tolto le voci di task, recuperabili con
  `git show 32850b7:PLAN.md`.

I fatti di UI che vincolano chi tocca la vista stanno in `docs/view.md`
(barre su `--surface-sunken`, `--radius-bar`, status bar su una riga, Motion).

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

## Goal J — un task completato misura la stima         [sospeso dall'utente]
Confrontare la stima con il consuntivo di un task concluso. Aperto il
2026-09-21, **sospeso dall'utente** lo stesso giorno («la gestione della
chiusura di un'attivita' e' piu' complessa del previsto»): **niente parte da
qui senza che l'utente lo riapra**.

**Gia' costruito dalle date fisse (`fixedEnd`)**: la fine dichiarata, il
task come record rigiocato e non schedulato, l'invariante di conservazione
riscritto (su un task fisso l'effort e' cio' che e' entrato). Resta solo il
confronto.

**Risposte dell'utente, 2026-09-21 — chiuse.**
- **Il confronto e' elapsed previsto contro elapsed effettivo**, non effort
  contro effort: «il piano diceva 10 giorni lavorativi, ne sono serviti 7».
- **Il termine di paragone si ricalcola sempre**, nessun derivato
  conservato; conseguenza **accettata**: il confronto e' retroattivo.
- **Si legge nel modal del task e in nessun altro posto**. Colonna in
  griglia, CSV, figura e stampa: **offerti e rifiutati** — una goal review che
  li segnala come MISSING sta segnalando una scelta.

**Perche' l'inversione a effort e' scartata.** Dalla fine si ottiene
l'elapsed; per risalire all'effort si divide per il tasso, che e' proprio la
grandezza incerta: «previsti 10, effettivi 7» puo' voler dire stima sbagliata
**oppure** persona al 70% invece del 50%, e dalla sola data le due non si
separano (esatta solo sui task non condivisi, `elapsedWorkingMinutes`).

**Il nodo per la spec** (`architect`, tocca il motore): il 10 da mettere
accanto al 7 viene da una **seconda passata** che schedula il task come se
non fosse fisso — non e' `effort / tasso`, perche' il tasso dipende dalla
concorrenza. Tecniche, le decide la spec: task senza risorsa, milestone.

## Maintenance — no goal
Task che non servono una milestone. **Non ricevono la goal review**; se uno
cresce fino a meritarne una, si apre un goal e lo si sposta.

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
      **Depends: soddisfatta** — l'UI desktop e' ferma da Goal K.

## Decisioni chiuse — non riproporre

**La descrizione di un task (Goal I).** **Non ha e non avra' superficie sul grafico**: niente icona
di riga, niente tooltip — chiesto due volte e confermato due volte. Si legge
dal modal, dal CSV e dall'agent API. **`addTask` la rifiuta** invece di
perderla (l'unico percorso di creazione legge la riga dhtmlx, dove la
descrizione non arriva): la si scrive con `updateTask` sul nuovo id, due
chiamate e due undo, ed e' una verruca accettata. **Asimmetria nota e
accettata**: il solo whitespace il dialogo lo cancella, agent API e parser lo
conservano — la colpisce solo uno script.

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

**Il ritmo di un task (Goal L).** Risposte dell'utente, vincolanti: la quota
e' **esatta, non un tetto**; e' **della capacita' della persona in quel
momento**; oltre il 100% **si riduce in proporzione**, nessun rifiuto; **la
fine resta derivata**; i periodi **seguono il task**, nascono alla quota che
il task ha quel giorno, **non superano mai la sua fine**, **niente
sovrapposizioni**; maniglie, × e percentuali **solo in hover**, nascoste
mentre si trascina il task. Semantica in `docs/scheduling.md`.

**Date fisse.** Una barra con **inizio e fine dichiarati**, non un blocco del
passato: **occupa la persona come un task normale** (in background = ritmo
0%), **vale anche nel futuro**, nessun «oggi». Il confronto stima/consuntivo
**non** ne fa parte: e' Goal J.

**Micro-interazioni.** Comprate le fasce A e B; **C no**: transizioni
sull'hover, zoom animato, catena critica pulsante, skeleton, effetti
celebrativi, apertura dei gruppi animata. Anche undo/redo e agent animano;
**basta `prefers-reduced-motion`**, niente interruttore. Regola in
`docs/view.md` § Motion.

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

**Refactoring della vista (Goal E).** S6/S7 su `App.tsx` e i gesti:
raccomandati contro dalla spec. Il corpo dell'handle e gli handler del
modello restano nel chart. S5b e' sotto `## Da riproporre`.

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

- **Tre limiti del movimento, accettati sotto la regola dell'80%**: durante
  il glide frecce ed etichette laterali sono gia' all'arrivo; due rifiuti
  uguali di fila scuotono una volta sola (React non rimonta la barra); il
  pallino dirty compare animato ma sparisce di colpo (sfumarlo vuol dire
  riservargli lo spazio sempre).

- **Percentuali sulle barre come opzione di vista** (Goal L): proposta
  dall'utente in alternativa al solo hover, non costruita.
- CSV, figura PNG e stampa **non mostrano la quota ne' il buco della pausa**
  (Goal L, fuori perimetro); ne' lo spillo delle date fisse, mai guidato li'.

- **S5b, unificare la mappa riga** (corsia deep). Era in giacenza «finche' un
  goal non aggiunge campi di riga»: Goal I ne ha aggiunto uno, quindi la
  condizione e' soddisfatta e la proposta e' aperta.
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
| I3 | feature | lettura diretta | 139 | 138 | 50+/4- | 1 (hub) |
| I4 | docs | hub | - | - | 0 | - |
| goal review I | review | - | - | 87 (fable) | 0 | - |
| L1 | engine | browser | 160 (2 giri) | 180 | - | 1 |
| L2, L3 | feature | browser | 226, 102 | - | - | 0 |
| L4 (spike 243 + indagine 188) | feature | browser | 290 | - | - | 0 |
| L5 | engine | browser | 366 | 175 | L4+L5: 1330+/100- | 1 (hub) |
| M1-M3 | polish | browser, 1 sessione | - | - | 176+/3- | 1 (utente: scossone) |

Sopra ~300k per meno di ~50 righe di `src/` e' un difetto di processo e va
all'utente coi numeri, non nel Log come successo a zero round.
