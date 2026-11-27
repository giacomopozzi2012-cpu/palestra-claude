// SPEC sezione 3: Passaggi tra le fasi
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { preparaSuite, SEC, MIN } = require('./aiuto');

const suite = preparaSuite();

test('3: a fine Concentrazione suona il bip e la Pausa parte da sola', async () => {
  const t = await suite.apri();
  await t.clicca('avvia');
  await t.avanza(25 * MIN - SEC);
  const prima = await t.leggi();
  await t.avanza(SEC);
  let s = await t.leggi();
  assert.ok(s.suoni > prima.suoni, 'deve suonare il bip');
  assert.equal(s.fase, 'pausa');
  assert.equal(s.stato, 'in corso', 'la pausa deve partire senza premere Avvia');
  await t.avanza(10 * SEC);
  s = await t.leggi();
  assert.equal(s.tempo, '04:50', 'il tempo della pausa deve scendere');
});

test('3: a fine Pausa suona il bip e la Concentrazione si prepara ferma', async () => {
  const t = await suite.apri();
  await t.clicca('avvia');
  await t.avanza(25 * MIN);       // finisce la concentrazione, parte la pausa
  await t.avanza(5 * MIN - SEC);
  const prima = await t.leggi();
  await t.avanza(SEC);            // finisce la pausa
  let s = await t.leggi();
  assert.ok(s.suoni > prima.suoni, 'deve suonare il bip');
  assert.equal(s.fase, 'lavoro');
  assert.equal(s.tempo, '25:00');
  assert.equal(s.stato, 'pronto', 'la concentrazione aspetta Avvia');
  await t.avanza(MIN);
  s = await t.leggi();
  assert.equal(s.tempo, '25:00', 'senza Avvia la concentrazione non deve partire');
});

for (const permesso of ['granted', 'denied', 'nonSupportate']) {
  test(`3: il bip suona sempre (notifiche: ${permesso})`, async () => {
    const t = await suite.apri({ permesso });
    await t.clicca('avvia');
    await t.avanza(25 * MIN - SEC);
    const prima = await t.leggi();
    await t.avanza(SEC);
    const s = await t.leggi();
    assert.ok(s.suoni > prima.suoni, 'deve suonare il bip');
    assert.deepEqual(t.errori, [], 'nessun errore nella pagina');
  });
}
