// SPEC sezione 7: Pulsanti premuti in ordine strano
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { preparaSuite, secondi, SEC, MIN } = require('./aiuto');

const suite = preparaSuite();

test('7: clic su Avvia mentre il timer corre: ignorato', async () => {
  const t = await suite.apri();
  await t.clicca('avvia');
  await t.avanza(10 * SEC);
  await t.clicca('avvia');
  await t.avanza(10 * SEC);
  const s = await t.leggi();
  assert.equal(s.tempo, '24:40');
  assert.equal(s.stato, 'in corso');
});

test('7: clic su Ferma quando è già fermo: ignorato', async () => {
  const t = await suite.apri();
  await t.clicca('pausa');
  let s = await t.leggi();
  assert.equal(s.stato, 'pronto');
  await t.clicca('avvia');
  await t.avanza(10 * SEC);
  await t.clicca('pausa', 3);
  s = await t.leggi();
  assert.equal(s.stato, 'fermato');
  assert.equal(s.tempo, '24:50');
});

test('7: doppio clic veloce su Avvia: un solo conto alla rovescia', async () => {
  const t = await suite.apri();
  await t.clicca('avvia', 2);
  await t.avanza(10 * SEC);
  let s = await t.leggi();
  assert.equal(s.tempo, '24:50', 'il tempo non deve scendere a velocità doppia');
  await t.clicca('pausa');
  await t.avanza(MIN);
  s = await t.leggi();
  assert.equal(s.tempo, '24:50', 'dopo Ferma non deve restare nessun conto alla rovescia nascosto');
});

test('7: doppio clic veloce su Riprendi: un solo conto alla rovescia', async () => {
  const t = await suite.apri();
  await t.clicca('avvia');
  await t.avanza(10 * SEC);
  await t.clicca('pausa');
  await t.clicca('avvia', 2);
  await t.avanza(10 * SEC);
  const s = await t.leggi();
  assert.equal(s.tempo, '24:40');
});

test('7: doppio clic veloce su Reset: una sola domanda di conferma', async () => {
  const t = await suite.apri();
  await t.clicca('avvia');
  await t.avanza(MIN);
  await t.clicca('reset', 2);
  assert.equal(t.dialoghi.length, 1, 'il secondo clic trova il timer già Pronto');
  const s = await t.leggi();
  assert.equal(s.stato, 'pronto');
  assert.equal(s.tempo, '25:00');
});

test('7: il tempo non va mai sotto 00:00', async () => {
  const t = await suite.apri();
  await t.clicca('avvia');
  for (let i = 0; i < 40; i++) {
    await t.avanza(MIN);
    const s = await t.leggi();
    assert.match(s.tempo, /^\d\d:\d\d$/, `tempo non valido: "${s.tempo}"`);
  }
});

// Un generatore di numeri "casuali" ripetibile: ogni volta la stessa sequenza
function casuale(seme) {
  return () => {
    seme = (seme * 1103515245 + 12345) % 2147483648;
    return seme / 2147483648;
  };
}

test('7: 300 azioni a caso non portano mai il timer in uno stato sbagliato', async () => {
  const t = await suite.apri();
  const rnd = casuale(42);
  const azioni = ['avvia', 'pausa', 'reset', 'modo-lavoro', 'modo-pausa', 'attendi', 'controlla'];
  const storia = [];

  for (let i = 0; i < 300; i++) {
    const azione = azioni[Math.floor(rnd() * azioni.length)];
    t.risposta = rnd() < 0.5 ? 'accetta' : 'annulla';
    storia.push(`${azione}(${t.risposta})`);
    const dove = () => `dopo: ${storia.slice(-8).join(', ')}`;

    if (azione === 'attendi') {
      await t.avanza(Math.floor(rnd() * 90) * SEC);
    } else if (azione === 'controlla') {
      // Se il timer corre e manca abbastanza, in 10 secondi deve scendere di esattamente 10
      const prima = await t.leggi();
      if (prima.stato === 'in corso' && secondi(prima.tempo) > 15) {
        await t.avanza(10 * SEC);
        const dopo = await t.leggi();
        assert.equal(secondi(prima.tempo) - secondi(dopo.tempo), 10, `velocità sbagliata ${dove()}`);
      }
    } else {
      await t.clicca(azione);
    }

    const s = await t.leggi();
    const durata = s.fase === 'lavoro' ? 25 * 60 : 5 * 60;
    assert.match(s.tempo, /^\d\d:\d\d$/, `tempo non valido ${dove()}`);
    assert.ok(secondi(s.tempo) <= durata, `tempo oltre la durata della fase ${dove()}`);
    assert.notEqual(s.stato, 'sconosciuto', `pulsanti in uno stato impossibile ${dove()}`);
  }
  assert.deepEqual(t.errori, [], 'nessun errore nella pagina');
});
