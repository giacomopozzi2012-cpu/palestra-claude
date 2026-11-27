// SPEC sezioni 1 (Fasi e durate) e 2 (Stati del timer)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { preparaSuite, SEC, MIN } = require('./aiuto');

const suite = preparaSuite();

test('1: all\'apertura si parte da Concentrazione, 25:00, Pronto', async () => {
  const t = await suite.apri();
  const s = await t.leggi();
  assert.equal(s.fase, 'lavoro');
  assert.equal(s.tempo, '25:00');
  assert.equal(s.stato, 'pronto');
});

test('1: la Concentrazione dura esattamente 25 minuti', async () => {
  const t = await suite.apri();
  await t.clicca('avvia');
  await t.avanza(25 * MIN - SEC);
  let s = await t.leggi();
  assert.equal(s.fase, 'lavoro');
  assert.equal(s.tempo, '00:01');
  await t.avanza(SEC);
  s = await t.leggi();
  assert.equal(s.fase, 'pausa', 'dopo 25 minuti deve iniziare la pausa');
});

test('1: la Pausa dura esattamente 5 minuti', async () => {
  const t = await suite.apri();
  await t.clicca('modo-pausa');
  let s = await t.leggi();
  assert.equal(s.tempo, '05:00');
  await t.clicca('avvia');
  await t.avanza(5 * MIN - SEC);
  s = await t.leggi();
  assert.equal(s.fase, 'pausa');
  assert.equal(s.tempo, '00:01');
  await t.avanza(SEC);
  s = await t.leggi();
  assert.equal(s.fase, 'lavoro', 'dopo 5 minuti deve tornare la concentrazione');
});

test('1: non esiste una pausa lunga, anche dopo 4 concentrazioni la pausa dura 5 minuti', async () => {
  const t = await suite.apri();
  for (let giro = 1; giro <= 4; giro++) {
    await t.clicca('avvia');
    await t.avanza(25 * MIN);
    let s = await t.leggi();
    assert.equal(s.fase, 'pausa', `giro ${giro}: dopo la concentrazione deve esserci la pausa`);
    assert.equal(s.tempo, '05:00', `giro ${giro}: la pausa deve durare 5 minuti`);
    await t.avanza(5 * MIN);
    s = await t.leggi();
    assert.equal(s.fase, 'lavoro', `giro ${giro}: dopo 5 minuti la pausa deve essere finita`);
    assert.equal(s.tempo, '25:00');
  }
});

test('1: le durate sono fisse, non c\'è nessun campo per modificarle', async () => {
  const t = await suite.apri();
  const campi = await t.page.locator('input, select, textarea').count();
  assert.equal(campi, 0);
});

test('2: stato Pronto: Avvia attivo, Ferma disattivato, Reset attivo', async () => {
  const t = await suite.apri();
  const s = await t.leggi();
  assert.equal(s.avviaAttivo, true);
  assert.equal(s.avviaTesto, 'Avvia');
  assert.equal(s.fermaAttivo, false);
  assert.equal(s.resetAttivo, true);
});

test('2: stato In corso: Avvia disattivato, Ferma attivo, Reset attivo, il tempo scende', async () => {
  const t = await suite.apri();
  await t.clicca('avvia');
  await t.avanza(10 * SEC);
  const s = await t.leggi();
  assert.equal(s.avviaAttivo, false);
  assert.equal(s.fermaAttivo, true);
  assert.equal(s.resetAttivo, true);
  assert.equal(s.tempo, '24:50');
});

test('2: stato Fermato: "Riprendi" attivo, Ferma disattivato, Reset attivo, il tempo è fermo', async () => {
  const t = await suite.apri();
  await t.clicca('avvia');
  await t.avanza(10 * SEC);
  await t.clicca('pausa');
  await t.avanza(MIN);
  let s = await t.leggi();
  assert.equal(s.stato, 'fermato');
  assert.equal(s.avviaTesto, 'Riprendi');
  assert.equal(s.fermaAttivo, false);
  assert.equal(s.resetAttivo, true);
  assert.equal(s.tempo, '24:50', 'da fermo il tempo non deve scendere');
  await t.clicca('avvia');
  await t.avanza(10 * SEC);
  s = await t.leggi();
  assert.equal(s.tempo, '24:40', 'Riprendi riparte da dove si era fermato');
});
