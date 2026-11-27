# palestra-claude

Un timer Pomodoro in un'unica pagina: `index.html`.
Le regole di come deve funzionare sono in [SPEC.md](SPEC.md).

## Test automatici

I test sono nella cartella `tests/`, un file per ogni sezione dello SPEC.
Aprono la pagina in un vero browser (Chromium, tramite Playwright), cliccano i pulsanti
e usano un orologio finto per far passare i minuti in un istante.

Per lanciarli serve [Node.js](https://nodejs.org/) (versione 22 o più recente):

```bash
npm install
```

```bash
npx playwright install chromium
```

```bash
npm test
```

Il comando `npm install` scarica Playwright, `npx playwright install chromium` scarica
il browser che usano i test (bastano una volta sola), `npm test` lancia i test.
