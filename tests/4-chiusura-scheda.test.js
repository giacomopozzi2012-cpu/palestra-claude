// SPEC sezione 4: Chiusura o ricaricamento della scheda
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { preparaSuite, fermaA, SEC, MIN } = require('./aiuto');

const suite = preparaSuite();

test('4: chiudo mentre corre a 18:00 e riapro dopo 3 minuti: ritrovo 18:00 fermo con "Riprendi"', async () => {
  let t = await suite.apri();
  await t.clicca('avvia');
  await t.avanza(7 * MIN);        // ora mostra 18:00
  t = await t.chiudiERiapriDopo(3 * MIN);
  let s = await t.leggi();
  assert.equal(s.fase, 'lavoro');
  assert.equal(s.tempo, '18:00', 'il tempo a scheda chiusa non deve contare');
  assert.equal(s.stato, 'fermato');
  assert.equal(s.avviaTesto, 'Riprendi');
  await t.clicca('avvia');
  await t.avanza(MIN);
  s = await t.leggi();
  assert.equal(s.tempo, '17:00', 'Riprendi continua da 18:00');
});

test('4: chiudo durante una Pausa che corre: ritrovo la Pausa, ferma, con lo stesso tempo', async () => {
  let t = await suite.apri();
  await t.clicca('avvia');
  await t.avanza(25 * MIN + 2 * MIN);   // pausa partita da sola, ora a 03:00
  t = await t.chiudiERiapriDopo(10 * MIN);
  const s = await t.leggi();
  assert.equal(s.fase, 'pausa');
  assert.equal(s.tempo, '03:00');
  assert.equal(s.stato, 'fermato');
});

test('4: chiudo mentre è Fermato a 12:30: alla riapertura ritrovo 12:30 Fermato', async () => {
  let t = await suite.apri();
  await fermaA(t, '12:30');
  t = await t.chiudiERiapriDopo(MIN);
  const s = await t.leggi();
  assert.equal(s.fase, 'lavoro');
  assert.equal(s.tempo, '12:30');
  assert.equal(s.stato, 'fermato');
});

test('4: chiudo in stato Pronto sulla Pausa: ritrovo la Pausa, 05:00, Pronto', async () => {
  let t = await suite.apri();
  await t.clicca('modo-pausa');
  t = await t.chiudiERiapriDopo(MIN);
  const s = await t.leggi();
  assert.equal(s.fase, 'pausa');
  assert.equal(s.tempo, '05:00');
  assert.equal(s.stato, 'pronto');
});

test('4: ricaricare la pagina mentre corre equivale a chiudere e riaprire', async () => {
  const t = await suite.apri();
  await t.clicca('avvia');
  await t.avanza(5 * MIN);        // 20:00
  await t.page.reload();
  const s = await t.leggi();
  assert.equal(s.tempo, '20:00');
  assert.equal(s.stato, 'fermato');
});

test('4: una fase non finisce mai a scheda chiusa', async () => {
  let t = await suite.apri();
  await t.clicca('avvia');
  await t.avanza(25 * MIN - 10 * SEC);   // 00:10
  t = await t.chiudiERiapriDopo(10 * MIN);
  await t.avanza(SEC);
  const s = await t.leggi();
  assert.equal(s.fase, 'lavoro');
  assert.equal(s.tempo, '00:10');
  assert.equal(s.stato, 'fermato');
  assert.equal(s.suoni, 0, 'alla riapertura non deve suonare nessun bip');
  assert.deepEqual(s.notifiche, [], 'alla riapertura non deve partire nessuna notifica');
});

test('4: memoria vuota: si parte da Concentrazione, 25:00, Pronto', async () => {
  const t = await suite.apri();
  await t.page.evaluate(() => localStorage.clear());
  await t.page.reload();
  const s = await t.leggi();
  assert.equal(s.fase, 'lavoro');
  assert.equal(s.tempo, '25:00');
  assert.equal(s.stato, 'pronto');
});

test('4: memoria del browser non disponibile: la pagina funziona senza errori', async () => {
  const t = await suite.apri({ memoriaRotta: true });
  let s = await t.leggi();
  assert.equal(s.fase, 'lavoro');
  assert.equal(s.tempo, '25:00');
  assert.equal(s.stato, 'pronto');
  await t.clicca('avvia');
  await t.avanza(MIN);
  await t.clicca('pausa');
  s = await t.leggi();
  assert.equal(s.tempo, '24:00');
  assert.deepEqual(t.errori, [], 'nessun errore nella pagina');
});
