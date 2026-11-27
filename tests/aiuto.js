// Strumenti condivisi da tutti i test.
//
// Come funzionano i test, in breve:
// - un piccolo server web locale serve index.html;
// - Playwright apre un vero browser Chromium e clicca i pulsanti;
// - un "finto orologio" (page.clock) fa passare i minuti in un istante;
// - notifiche, audio e memoria del browser sono sostituiti da versioni finte
//   ("mock") che registrano cosa succede, così possiamo controllarlo.
//
// Cosa i test si aspettano dalla pagina (il "contratto"):
// - elementi con id: tempo, avvia, pausa (il pulsante "Ferma"), reset,
//   modo-lavoro, modo-pausa (le linguette, con aria-pressed="true" su quella attiva);
// - le domande di conferma usano la finestra del browser (window.confirm);
// - il pulsante per i permessi si chiama "Attiva notifiche";
// - il messaggio di fine fase nella pagina ha role="alert" e un pulsante "Chiudi";
// - la scritta fissa contiene "notifiche disattivate" (o "non supportate").

const { before, after } = require('node:test');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const SEC = 1000;
const MIN = 60 * SEC;
const PAGINA = path.join(__dirname, '..', 'index.html');

// Trasforma "12:30" in 750 secondi
function secondi(testo) {
  const [m, s] = testo.split(':').map(Number);
  return m * 60 + s;
}

// Questa funzione gira DENTRO la pagina, prima del suo codice.
// Sostituisce le parti del browser che vogliamo controllare.
function installaFinti(cfg) {
  const T = (window.__test = { suoni: 0, notifiche: [], richieste: 0, focus: 0 });

  // Visibilità della scheda: possiamo fingere di essere su un'altra scheda
  let visibile = true;
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (visibile ? 'visible' : 'hidden') });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => !visibile });
  document.hasFocus = () => visibile;
  T.impostaVisibile = (v) => {
    visibile = v;
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event(v ? 'focus' : 'blur'));
  };
  window.focus = () => { T.focus++; };

  // Audio finto: conta quante volte parte un suono
  const nodo = () => ({
    connect(x) { return x; }, disconnect() {},
    frequency: { value: 0, setValueAtTime() {} },
    gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} },
    type: 'sine',
    start() { T.suoni++; }, stop() {}
  });
  class AudioFinto {
    constructor() { this.currentTime = 0; this.state = 'running'; this.destination = nodo(); }
    createOscillator() { return nodo(); }
    createGain() { return nodo(); }
    resume() { return Promise.resolve(); }
    close() { return Promise.resolve(); }
  }
  window.AudioContext = AudioFinto;
  window.webkitAudioContext = AudioFinto;
  HTMLMediaElement.prototype.play = function () { T.suoni++; return Promise.resolve(); };

  // Memoria del browser rotta (come in certe finestre in incognito)
  if (cfg.memoriaRotta) {
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new Error('memoria bloccata'); } });
  }

  // Notifiche finte
  if (cfg.permesso === 'nonSupportate') {
    delete window.Notification;
  } else {
    let permesso = cfg.permesso;
    class NotificaFinta {
      constructor(titolo, opzioni = {}) {
        this.title = titolo;
        this.body = opzioni.body;
        this.onclick = null;
        this.ascoltatori = [];
        T.notifiche.push(this);
      }
      addEventListener(tipo, f) { if (tipo === 'click') this.ascoltatori.push(f); }
      close() {}
    }
    Object.defineProperty(NotificaFinta, 'permission', { get: () => permesso });
    NotificaFinta.requestPermission = (cb) => {
      T.richieste++;
      permesso = cfg.risposta || permesso;
      if (cb) cb(permesso);
      return Promise.resolve(permesso);
    };
    window.Notification = NotificaFinta;
    T.cliccaNotifica = (i) => {
      const n = T.notifiche[i];
      const ev = new Event('click');
      if (n.onclick) n.onclick(ev);
      n.ascoltatori.forEach((f) => f(ev));
    };
  }
}

// Un piccolo server che risponde sempre con index.html
function avviaServer() {
  return new Promise((ok) => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(PAGINA));
    });
    server.listen(0, '127.0.0.1', () => ok(server));
  });
}

// Una pagina del timer aperta nel browser, con comandi comodi per i test
class Timer {
  constructor(page, contesto, cfg, url) {
    this.page = page;
    this.contesto = contesto;
    this.cfg = cfg;
    this.url = url;
    this.dialoghi = [];        // testi delle domande di conferma comparse
    this.risposta = 'accetta'; // come rispondere: 'accetta' o 'annulla'
    this.errori = [];          // errori JavaScript della pagina
    page.on('dialog', async (d) => {
      this.dialoghi.push(d.message());
      if (this.risposta === 'accetta') await d.accept(); else await d.dismiss();
    });
    page.on('pageerror', (e) => this.errori.push(e));
  }

  static async apri(contesto, url, cfg, orario) {
    const page = await contesto.newPage();
    // Se un pulsante o un messaggio non esiste, il test fallisce dopo 5 secondi
    // invece di aspettare all'infinito
    page.setDefaultTimeout(5000);
    const t = new Timer(page, contesto, cfg, url);
    await page.clock.install({ time: orario });
    await page.addInitScript(installaFinti, cfg);
    await page.goto(url);
    return t;
  }

  // Clicca un pulsante. Se è disattivato il clic non fa nulla (come per una persona).
  async clicca(id, volte = 1) {
    await this.page.evaluate(([id, volte]) => {
      for (let i = 0; i < volte; i++) document.getElementById(id).click();
    }, [id, volte]);
  }

  // Fa passare il tempo (finto) di ms millisecondi.
  // Avanza a salti di 1 secondo: è molto più veloce di runFor e la precisione
  // basta, perché il timer mostra i secondi.
  async avanza(ms) {
    while (ms > 0) {
      const passo = Math.min(SEC, ms);
      await this.page.clock.fastForward(passo);
      ms -= passo;
    }
  }

  // Fotografa lo stato del timer
  async leggi() {
    const s = await this.page.evaluate(() => {
      const $ = (id) => document.getElementById(id);
      return {
        tempo: $('tempo').textContent.trim(),
        fase: $('modo-pausa').getAttribute('aria-pressed') === 'true' ? 'pausa' : 'lavoro',
        avviaAttivo: !$('avvia').disabled,
        avviaTesto: $('avvia').textContent.trim(),
        fermaAttivo: !$('pausa').disabled,
        resetAttivo: !$('reset').disabled,
        titolo: document.title,
        suoni: window.__test.suoni,
        notifiche: window.__test.notifiche.map((n) => n.title),
        richieste: window.__test.richieste,
        focus: window.__test.focus
      };
    });
    if (s.fermaAttivo && !s.avviaAttivo) s.stato = 'in corso';
    else if (s.avviaAttivo && !s.fermaAttivo && s.avviaTesto === 'Riprendi') s.stato = 'fermato';
    else if (s.avviaAttivo && !s.fermaAttivo && s.avviaTesto === 'Avvia') s.stato = 'pronto';
    else s.stato = 'sconosciuto';
    return s;
  }

  async adesso() { return this.page.evaluate(() => Date.now()); }

  async impostaVisibile(v) { await this.page.evaluate((v) => window.__test.impostaVisibile(v), v); }

  async cliccaNotifica(i) { await this.page.evaluate((i) => window.__test.cliccaNotifica(i), i); }

  // Chiude la scheda come farebbe una persona
  async chiudi() {
    const chiusa = new Promise((ok) => this.page.once('close', ok));
    await this.page.close({ runBeforeUnload: true });
    await chiusa;
  }

  // Chiude la scheda e ne riapre un'altra dopo "ms" millisecondi (stesso browser, stessa memoria)
  async chiudiERiapriDopo(ms) {
    const orario = (await this.adesso()) + ms;
    await this.chiudi();
    return Timer.apri(this.contesto, this.url, this.cfg, orario);
  }
}

// Da chiamare in cima a ogni file di test: prepara browser e server
function preparaSuite() {
  const amb = {};
  before(async () => {
    amb.browser = await chromium.launch();
    amb.server = await avviaServer();
    amb.url = `http://127.0.0.1:${amb.server.address().port}/`;
  });
  after(async () => {
    if (amb.browser) await amb.browser.close();
    if (amb.server) amb.server.close();
  });
  return {
    // Apre il timer in un browser "pulito" (memoria vuota).
    // cfg.permesso: 'default' (mai chiesto), 'granted', 'denied' o 'nonSupportate'
    // cfg.risposta: cosa risponde l'utente quando il browser chiede il permesso
    // cfg.memoriaRotta: true per simulare la memoria del browser non disponibile
    async apri(cfg = {}) {
      const contesto = await amb.browser.newContext();
      return Timer.apri(contesto, amb.url, { permesso: 'default', ...cfg }, new Date('2026-01-05T09:00:00').getTime());
    }
  };
}

// Porta il timer in Concentrazione fermato a un certo tempo rimasto (es. '12:30')
async function fermaA(t, tempo) {
  await t.clicca('avvia');
  await t.avanza((25 * 60 - secondi(tempo)) * SEC);
  await t.clicca('pausa');
}

module.exports = { preparaSuite, secondi, fermaA, SEC, MIN };
