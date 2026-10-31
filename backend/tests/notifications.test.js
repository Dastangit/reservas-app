// Avisos al admin: que lleguen a Telegram y que alli nunca vaya el texto con
// datos personales cuando el aviso trae `telegramBody`.
// Sin VAPID (antes de cargar config/env): solo se prueba el canal de Telegram.
process.env.VAPID_PUBLIC_KEY = '';
process.env.VAPID_PRIVATE_KEY = '';

jest.mock('../utils/telegram', () => ({
  sendTelegram: jest.fn(async () => ({ ok: true })),
  isTelegramConfigured: () => true,
}));

const { sendTelegram } = require('../utils/telegram');
const env = require('../config/env');
const { notifyAdmins } = require('../utils/pushNotifications');

beforeEach(() => {
  sendTelegram.mockClear();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('notifyAdmins por Telegram', () => {
  test('manda titulo, texto y enlace al panel', async () => {
    const summary = await notifyAdmins(null, { title: 'Propiedad nueva', body: '"Casa Azul" fue enviada.', url: '/admin/properties' });
    expect(sendTelegram).toHaveBeenCalledWith(`Propiedad nueva\n"Casa Azul" fue enviada.\n${env.frontendUrl}/admin/properties`);
    expect(summary.telegram).toBe('sent');
  });

  test('con telegramBody no manda el texto con datos personales', async () => {
    await notifyAdmins(null, {
      title: 'Solicitud de restablecimiento de contraseña',
      body: 'Ana (ana@correo.com) solicitó recuperar su contraseña.',
      telegramBody: 'Un usuario solicitó recuperar su contraseña.',
      url: '/admin/password-resets',
    });
    const text = sendTelegram.mock.calls[0][0];
    expect(text).toContain('Un usuario solicitó recuperar su contraseña.');
    expect(text).not.toMatch(/Ana|ana@correo\.com/);
  });

  test('un fallo de Telegram no rompe el aviso', async () => {
    sendTelegram.mockRejectedValueOnce(new Error('red caida'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(notifyAdmins(null, { title: 't', body: 'b' })).resolves.toBeDefined();
  });
});

describe('avisos con datos personales traen telegramBody', () => {
  // Cada notifyAdmins cuyo body interpola correos, nombres de personas o
  // referencias de pago debe tener su version sin datos para Telegram.
  const fs = require('fs');
  const path = require('path');
  const files = ['controllers', 'jobs', 'utils'].flatMap((dir) => fs.readdirSync(path.join(__dirname, '..', dir))
    .filter((f) => f.endsWith('.js')).map((f) => path.join(__dirname, '..', dir, f)));

  test.each(files.map((f) => [path.relative(path.join(__dirname, '..'), f), f]))('%s', (_name, file) => {
    const src = fs.readFileSync(file, 'utf8');
    const calls = src.split('notifyAdmins(').slice(1).map((c) => c.slice(0, c.indexOf('});')));
    for (const call of calls) {
      if (/\.email\b|user\.name\b|reference|payerEmail/.test(call)) expect(call).toContain('telegramBody');
    }
  });
});
