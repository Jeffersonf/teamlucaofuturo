/**
 * Gerador de Payload Pix Padrão BACEN (BR Code / EMV)
 * Implementação pura sem dependências externas com cálculo de CRC16-CCITT
 */

function crc16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function formatField(id, value) {
  const str = String(value);
  const len = String(str.length).padStart(2, '0');
  return `${id}${len}${str}`;
}

function normalizePixText(text = '', maxLength = 25) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .slice(0, maxLength)
    .toUpperCase();
}

function generatePixPayload({
  key = 'arena@futevolei.com.br',
  name = 'TEAM LUCAO ARENA',
  city = 'SOROCABA',
  amount = 0,
  txid = 'MENSALIDADE'
}) {
  const cleanKey = String(key).trim();
  const cleanName = normalizePixText(name, 25) || 'ARENA FUTVOLEI';
  const cleanCity = normalizePixText(city, 15) || 'SAO PAULO';
  const cleanTxid = normalizePixText(txid, 25) || 'TLF001';

  const merchantAccount = formatField('00', 'br.gov.bcb.pix') + formatField('01', cleanKey);

  let payload =
    formatField('00', '01') +
    formatField('26', merchantAccount) +
    formatField('52', '0000') +
    formatField('53', '986');

  if (amount && Number(amount) > 0) {
    payload += formatField('54', Number(amount).toFixed(2));
  }

  payload +=
    formatField('58', 'BR') +
    formatField('59', cleanName) +
    formatField('60', cleanCity) +
    formatField('62', formatField('05', cleanTxid)) +
    '6304';

  const checksum = crc16(payload);
  return payload + checksum;
}

module.exports = {
  crc16,
  generatePixPayload
};
