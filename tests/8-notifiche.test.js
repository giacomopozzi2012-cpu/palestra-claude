// SPEC sezione 8: Notifiche
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { preparaSuite, SEC, MIN } = require('./aiuto');

const suite = preparaSuite();

const pulsanteNotifiche = (t) => t.page.getByRole('button', { name: /attiva notifiche/i });
const messaggio = (t) =>
  t.page.getByRole('alert').filter({ has: t.page.getByRole('button', { name: /chiudi/i }) });
const scritta = (t) => t.page.getByText(/notifiche (disattivate|non (sono )?supportate)/i);

// --- Come si attivano ---

test('8: il permesso non viene chiesto all\'apertura né premendo Avvia', async () => {
  const t = await suite.apri({ permesso: 'default' });
  await t.clicca('avvia');
  await t.avanza(10 * SEC);
  const s = await t.leggi();
  assert.equal(s.richieste, 0);
});

test('8: il pulsante "Attiva notifiche" chiede il permesso', async () => {
  const t = await suite.apri({ permesso: 'default', risposta: 'granted' });
  await pulsanteNotifiche(t).click();
  const s = await t.leggi();
  assert.equal(s.richieste, 1);
});

test('8: dopo aver concesso il permesso il pulsante "Attiva notifiche" sparisce', async () => {
  const t = await suite.apri({ permesso: 'default', risposta: 'granted' });
  await pulsanteNotifiche(t).click();
  assert.equal(await pulsanteNotifiche(t).isVisible(), false);
});

test('8: con le notifiche già attive il pulsante "Attiva notifiche" non si vede', async () => {
  const t = await suite.apri({ permesso: 'granted' });
  assert.equal(await pulsanteNotifiche(t).isVisible(), false);
});

// --- Notifiche attive ---

test('8: notifiche attive: a fine Concentrazione arriva "Pomodoro completato 🍅"', async () => {
  const t = await suite.apri({ permesso: 'granted' });
  await t.clicca('avvia');
  await t.avanza(25 * MIN);
  const s = await t.leggi();
  assert.deepEqual(s.notifiche, ['Pomodoro completato 🍅']);
});

test('8: notifiche attive: a fine Pausa arriva "Pausa finita ☕"', async () => {
  const t = await suite.apri({ permesso: 'granted' });
  await t.clicca('avvia');
  await t.avanza(25 * MIN + 5 * MIN);
  const s = await t.leggi();
  assert.deepEqual(s.notifiche, ['Pomodoro completato 🍅', 'Pausa finita ☕']);
});

test('8: cliccando sulla notifica si torna alla scheda del timer', async () => {
  const t = await suite.apri({ permesso: 'granted' });
  await t.clicca('avvia');
  await t.avanza(25 * MIN);
  await t.cliccaNotifica(0);
  const s = await t.leggi();
  assert.ok(s.focus > 0, 'la scheda del timer deve tornare in primo piano');
});

// --- Notifiche negate o non supportate ---

for (const permesso of ['denied', 'nonSupportate']) {
  test(`8 (${permesso}): fine Concentrazione: il titolo mostra "✅ Fatto!" e il tempo, finché non torno sulla scheda`, async () => {
    const t = await suite.apri({ permesso });
    await t.clicca('avvia');
    await t.impostaVisibile(false);    // sto guardando un'altra scheda
    await t.avanza(25 * MIN + 30 * SEC);
    let s = await t.leggi();
    assert.ok(s.titolo.includes('✅ Fatto!'), `titolo: "${s.titolo}"`);
    assert.ok(s.titolo.includes('04:30'), `il titolo deve mostrare anche il tempo della pausa: "${s.titolo}"`);
    await t.impostaVisibile(true);     // torno sulla scheda
    await t.avanza(SEC);
    s = await t.leggi();
    assert.ok(!s.titolo.includes('✅ Fatto!'), `tornato sulla scheda l'avviso deve sparire: "${s.titolo}"`);
    assert.ok(s.titolo.includes('04:29'), `resta solo il tempo: "${s.titolo}"`);
  });

  test(`8 (${permesso}): fine Pausa: il titolo mostra "⏰ Pausa finita" finché non torno sulla scheda`, async () => {
    const t = await suite.apri({ permesso });
    await t.clicca('avvia');
    await t.avanza(25 * MIN);
    await t.impostaVisibile(false);
    await t.avanza(5 * MIN + 30 * SEC);
    let s = await t.leggi();
    assert.ok(s.titolo.includes('⏰ Pausa finita'), `titolo: "${s.titolo}"`);
    await t.impostaVisibile(true);
    await t.avanza(SEC);
    s = await t.leggi();
    assert.ok(!s.titolo.includes('⏰ Pausa finita'), `tornato sulla scheda l'avviso deve sparire: "${s.titolo}"`);
  });

  test(`8 (${permesso}): a fine fase compare un messaggio nella pagina che resta finché non lo chiudo`, async () => {
    const t = await suite.apri({ permesso });
    await t.clicca('avvia');
    await t.avanza(25 * MIN);
    assert.equal(await messaggio(t).isVisible(), true, 'il messaggio deve comparire');
    await t.avanza(2 * MIN);
    assert.equal(await messaggio(t).isVisible(), true, 'il messaggio non deve sparire da solo');
    await messaggio(t).getByRole('button', { name: /chiudi/i }).click();
    assert.equal(await messaggio(t).isVisible(), false, 'dopo "Chiudi" il messaggio deve sparire');
    assert.deepEqual(t.errori, [], 'nessun errore nella pagina');
  });

  test(`8 (${permesso}): la scritta "notifiche disattivate" si vede sempre, anche prima di avviare`, async () => {
    const t = await suite.apri({ permesso });
    assert.equal(await scritta(t).first().isVisible(), true);
  });
}

test('8 (denied): la scritta spiega come riattivarle dalle impostazioni del browser', async () => {
  const t = await suite.apri({ permesso: 'denied' });
  const testo = await t.page.locator('body').innerText();
  assert.match(testo, /impostazioni/i);
});

test('8 (denied): la pagina non richiede più il permesso', async () => {
  const t = await suite.apri({ permesso: 'denied', risposta: 'granted' });
  await t.clicca('avvia');
  if (await pulsanteNotifiche(t).isVisible()) await pulsanteNotifiche(t).click();
  await t.avanza(25 * MIN);
  const s = await t.leggi();
  assert.equal(s.richieste, 0);
});
