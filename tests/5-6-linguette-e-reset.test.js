// SPEC sezioni 5 (Cambio fase con le linguette) e 6 (Reset)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { preparaSuite, fermaA, MIN } = require('./aiuto');

const suite = preparaSuite();

// --- Sezione 5: linguette ---

test('5: timer in corso, clic su Pausa: chiede conferma; confermo e passo alla Pausa azzerata', async () => {
  const t = await suite.apri();
  await t.clicca('avvia');
  await t.avanza(5 * MIN);
  await t.clicca('modo-pausa');
  assert.equal(t.dialoghi.length, 1, 'deve comparire una domanda di conferma');
  const s = await t.leggi();
  assert.equal(s.fase, 'pausa');
  assert.equal(s.tempo, '05:00');
  assert.equal(s.stato, 'pronto');
});

test('5: timer in corso, clic su Pausa e annullo: non cambia niente e il tempo continua', async () => {
  const t = await suite.apri();
  await t.clicca('avvia');
  await t.avanza(5 * MIN);        // 20:00
  t.risposta = 'annulla';
  await t.clicca('modo-pausa');
  assert.equal(t.dialoghi.length, 1);
  let s = await t.leggi();
  assert.equal(s.fase, 'lavoro');
  assert.equal(s.stato, 'in corso');
  assert.equal(s.tempo, '20:00');
  await t.avanza(MIN);
  s = await t.leggi();
  assert.equal(s.tempo, '19:00', 'il timer continua a scendere normalmente');
});

test('5: timer Fermato a metà, clic su Pausa: chiede conferma; confermo e passo alla Pausa', async () => {
  const t = await suite.apri();
  await fermaA(t, '12:30');
  await t.clicca('modo-pausa');
  assert.equal(t.dialoghi.length, 1);
  const s = await t.leggi();
  assert.equal(s.fase, 'pausa');
  assert.equal(s.tempo, '05:00');
  assert.equal(s.stato, 'pronto');
});

test('5: timer Fermato a metà, clic su Pausa e annullo: resta 12:30 Fermato', async () => {
  const t = await suite.apri();
  await fermaA(t, '12:30');
  t.risposta = 'annulla';
  await t.clicca('modo-pausa');
  assert.equal(t.dialoghi.length, 1);
  const s = await t.leggi();
  assert.equal(s.fase, 'lavoro');
  assert.equal(s.tempo, '12:30');
  assert.equal(s.stato, 'fermato');
});

test('5: timer Pronto: il cambio fase avviene subito, senza conferma', async () => {
  const t = await suite.apri();
  await t.clicca('modo-pausa');
  let s = await t.leggi();
  assert.equal(s.fase, 'pausa');
  assert.equal(s.tempo, '05:00');
  await t.clicca('modo-lavoro');
  s = await t.leggi();
  assert.equal(s.fase, 'lavoro');
  assert.equal(s.tempo, '25:00');
  assert.equal(t.dialoghi.length, 0, 'non deve comparire nessuna domanda');
});

test('5: clic sulla linguetta già attiva (timer in corso): nessun effetto', async () => {
  const t = await suite.apri();
  await t.clicca('avvia');
  await t.avanza(5 * MIN);
  await t.clicca('modo-lavoro');
  assert.equal(t.dialoghi.length, 0, 'non deve comparire nessuna domanda');
  await t.avanza(MIN);
  const s = await t.leggi();
  assert.equal(s.fase, 'lavoro');
  assert.equal(s.stato, 'in corso');
  assert.equal(s.tempo, '19:00');
});

test('5: clic sulla linguetta già attiva (timer Fermato): nessun effetto', async () => {
  const t = await suite.apri();
  await fermaA(t, '12:30');
  await t.clicca('modo-lavoro');
  assert.equal(t.dialoghi.length, 0);
  const s = await t.leggi();
  assert.equal(s.tempo, '12:30');
  assert.equal(s.stato, 'fermato');
});

test('5: ogni fase non tiene un suo tempo: tornando alla Concentrazione ritrovo 25:00', async () => {
  const t = await suite.apri();
  await fermaA(t, '12:30');
  await t.clicca('modo-pausa');   // confermo
  await t.clicca('modo-lavoro');  // Pronto: nessuna domanda
  const s = await t.leggi();
  assert.equal(s.fase, 'lavoro');
  assert.equal(s.tempo, '25:00');
  assert.equal(s.stato, 'pronto');
  assert.equal(t.dialoghi.length, 1);
});

// --- Sezione 6: Reset ---

test('6: Reset con timer in corso: chiede conferma; confermo e torno a 25:00 Pronto', async () => {
  const t = await suite.apri();
  await t.clicca('avvia');
  await t.avanza(5 * MIN);
  await t.clicca('reset');
  assert.equal(t.dialoghi.length, 1, 'deve comparire una domanda di conferma');
  const s = await t.leggi();
  assert.equal(s.fase, 'lavoro');
  assert.equal(s.tempo, '25:00');
  assert.equal(s.stato, 'pronto');
});

test('6: Reset con timer in corso e annullo: il timer continua', async () => {
  const t = await suite.apri();
  await t.clicca('avvia');
  await t.avanza(5 * MIN);
  t.risposta = 'annulla';
  await t.clicca('reset');
  assert.equal(t.dialoghi.length, 1);
  await t.avanza(MIN);
  const s = await t.leggi();
  assert.equal(s.stato, 'in corso');
  assert.equal(s.tempo, '19:00');
});

test('6: Reset con timer Fermato: chiede conferma; confermo e torno all\'inizio', async () => {
  const t = await suite.apri();
  await fermaA(t, '12:30');
  await t.clicca('reset');
  assert.equal(t.dialoghi.length, 1);
  const s = await t.leggi();
  assert.equal(s.tempo, '25:00');
  assert.equal(s.stato, 'pronto');
});

test('6: Reset con timer Fermato e annullo: resta 12:30 Fermato', async () => {
  const t = await suite.apri();
  await fermaA(t, '12:30');
  t.risposta = 'annulla';
  await t.clicca('reset');
  assert.equal(t.dialoghi.length, 1);
  const s = await t.leggi();
  assert.equal(s.tempo, '12:30');
  assert.equal(s.stato, 'fermato');
});

test('6: Reset durante la Pausa torna all\'inizio della Pausa (05:00)', async () => {
  const t = await suite.apri();
  await t.clicca('modo-pausa');
  await t.clicca('avvia');
  await t.avanza(2 * MIN);
  await t.clicca('reset');
  const s = await t.leggi();
  assert.equal(s.fase, 'pausa');
  assert.equal(s.tempo, '05:00');
  assert.equal(s.stato, 'pronto');
});

test('6: Reset in stato Pronto: nessun effetto e nessuna domanda', async () => {
  const t = await suite.apri();
  await t.clicca('reset');
  assert.equal(t.dialoghi.length, 0);
  const s = await t.leggi();
  assert.equal(s.tempo, '25:00');
  assert.equal(s.stato, 'pronto');
});
