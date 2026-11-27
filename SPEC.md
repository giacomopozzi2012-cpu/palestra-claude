# Specifica del Timer Pomodoro

Questo documento dice **come deve funzionare** il timer (`index.html`).
Non descrive per forza il codice di oggi: le differenze sono elencate in fondo,
nella sezione "Differenze rispetto al codice attuale".

---

## 1. Fasi e durate

| Fase            | Durata     | Colore |
|-----------------|------------|--------|
| Concentrazione  | 25 minuti  | rosso  |
| Pausa           | 5 minuti   | verde  |

- Le durate sono **fisse**: l'utente non può modificarle.
- **Non** esiste una pausa lunga: dopo ogni concentrazione c'è sempre una pausa da 5 minuti.
- All'apertura della pagina (la prima volta, o se non c'è niente di salvato) si parte da
  **Concentrazione, 25:00, Pronto**.

## 2. Stati del timer

Il timer è sempre in uno di questi tre stati:

| Stato       | Cosa significa                                   | Avvia/Riprendi | Ferma      | Reset |
|-------------|--------------------------------------------------|----------------|------------|-------|
| **Pronto**  | La fase è all'inizio (25:00 o 05:00), ferma      | attivo ("Avvia")    | disattivato | attivo |
| **In corso**| Il tempo sta scendendo                           | disattivato    | attivo     | attivo |
| **Fermato** | Fermato a metà con "Ferma"                       | attivo ("Riprendi") | disattivato | attivo |

Ci sono anche le due linguette **Concentrazione** e **Pausa** per scegliere la fase,
un pulsante **Attiva notifiche** e il pulsante del tema chiaro/scuro.

## 3. Passaggi tra le fasi

Quando il tempo arriva a 00:00:

- **Finisce la Concentrazione**
  1. suona il bip;
  2. arriva l'avviso di fine fase (vedi sezione 8);
  3. la **Pausa parte da sola**, subito, senza premere niente (stato: In corso).
- **Finisce la Pausa**
  1. suona il bip;
  2. arriva l'avviso di fine fase;
  3. si prepara la Concentrazione, **ferma** (stato: Pronto). Parte solo quando premo "Avvia".

Il **bip suona sempre**, anche se le notifiche sono negate o non supportate.

## 4. Chiusura o ricaricamento della scheda

La pagina si ricorda **fase** e **tempo rimasto** salvandoli nel browser
(con `localStorage`, una piccola memoria che il browser tiene per ogni sito).

- **Chiudo mentre il timer corre** (es. a 18:00): alla riapertura ritrovo la stessa fase,
  **ferma** su 18:00, stato Fermato, con il pulsante "Riprendi".
  Il tempo passato a scheda chiusa **non conta**.
- **Chiudo mentre il timer è fermato** (es. a 12:30): alla riapertura ritrovo 12:30, Fermato.
- **Chiudo in stato Pronto**: ritrovo la stessa fase, Pronto.
- Siccome a scheda chiusa il tempo non scorre, **una fase non può mai finire a scheda chiusa**.
- Se la memoria del browser non è disponibile (es. finestra in incognito con dati bloccati)
  o è vuota: si parte da Concentrazione, 25:00, Pronto, senza errori.

## 5. Cambio fase con le linguette

- **Timer in corso o Fermato a metà** → compare una domanda di conferma, ad esempio
  *"Vuoi interrompere la concentrazione? Perderai il tempo rimasto."*
  - **Confermo**: passo all'altra fase, azzerata, stato Pronto.
  - **Annullo**: non cambia niente. Se il timer stava correndo, continua a correre e
    il tempo trascorso mentre la domanda era aperta viene contato normalmente.
- **Timer in stato Pronto** → cambio fase subito, senza domanda (non c'è niente da perdere).
- **Clic sulla linguetta della fase già attiva** → nessun effetto.
- Ogni fase **non** tiene un suo tempo separato: cambiando fase il tempo della fase
  lasciata va perso (per questo serve la conferma).

## 6. Reset

- **Timer in corso o Fermato a metà** → domanda di conferma, ad esempio
  *"Vuoi ricominciare da capo?"*
  - **Confermo**: torno all'inizio della fase attuale (25:00 o 05:00), stato Pronto.
  - **Annullo**: non cambia niente (come per le linguette).
- **Timer in stato Pronto** → nessun effetto (è già all'inizio).

## 7. Pulsanti premuti in ordine strano

- I pulsanti che in quel momento non servono sono **disattivati** (grigi) e non fanno
  nulla: vedi la tabella della sezione 2.
- **Doppio clic veloce** su Avvia, Ferma o Reset: conta come un clic solo; i clic in più
  vengono ignorati.
- Nessuna sequenza di clic deve portare il timer in uno stato sbagliato (per esempio
  due conti alla rovescia insieme, o il tempo sotto 00:00).

## 8. Notifiche

### Come si attivano
- Il permesso del browser si chiede **solo** quando premo il pulsante **"Attiva notifiche"**.
  La pagina non lo chiede mai da sola (nemmeno premendo Avvia).
- Se le notifiche sono già attive, il pulsante non serve più e non viene mostrato.

### Notifiche attive
- A fine fase arriva una notifica del sistema
  ("Pomodoro completato 🍅" oppure "Pausa finita ☕").
- Cliccando sulla notifica si torna alla scheda del timer.

### Notifiche negate o non supportate
A fine fase, oltre al bip:
1. **Il titolo della scheda cambia** (es. "✅ Fatto!" o "⏰ Pausa finita"), così lo vedo
   anche se sto guardando un'altra scheda. Siccome la pausa parte da sola, il titolo mostra
   **l'avviso e il tempo insieme**, per esempio "✅ Fatto! ▶ 04:59 – Pausa".
   L'avviso resta nel titolo **finché non torno sulla scheda del timer**; poi resta solo il tempo.
2. **Compare un messaggio ben visibile nella pagina**, che resta finché non lo chiudo io.

Inoltre, sempre (non solo a fine fase):

3. **Una piccola scritta fissa** avvisa che le notifiche sono disattivate e spiega come
   riattivarle dalle impostazioni del browser.

Se ho negato le notifiche, la pagina **non le richiede più** (i browser comunque non lo
permettono dopo un rifiuto): si limita a spiegare come riattivarle a mano.

## 9. Casi non gestiti

- **Più schede aperte insieme**: ogni scheda va per conto suo; non devono restare in
  sincrono.

---

## Differenze rispetto al codice attuale

Cose che oggi `index.html` fa diversamente e che andranno cambiate:

1. **Memoria alla chiusura**: oggi chiudendo la scheda si perde tutto.
2. **Pausa automatica**: oggi a fine concentrazione la pausa aspetta "Avvia"; deve partire da sola.
3. **Conferma sulle linguette**: oggi cambiare fase azzera subito, senza chiedere.
4. **Conferma su Reset**: oggi Reset azzera subito, senza chiedere.
5. **Pulsante "Attiva notifiche"**: oggi il permesso viene chiesto al primo "Avvia".
6. **Notifiche negate**: oggi la pagina non mostra né il messaggio di fine fase né la
   scritta "notifiche disattivate" (il titolo della scheda invece cambia già).
