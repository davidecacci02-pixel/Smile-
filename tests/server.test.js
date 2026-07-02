const test = require('node:test');
const assert = require('node:assert/strict');
const { buildEmailHtml } = require('../server');

test('buildEmailHtml includes a personalized note when present', () => {
  const participant = {
    name: 'Mario',
    surname: 'Rossi',
    id: 'evt-mario-rossi-1234',
    note: 'Porta il documento di identità all’ingresso.'
  };

  const html = buildEmailHtml(participant, 'https://example.com/qrcode.png');

  assert.match(html, /Porta il documento di identità all’ingressoreve/);
  assert.match(html, /Nota personalizzata/);
});
