const fs = require('fs');
const path = require('path');
const https = require('https');

const API_URL = 'https://evropochta.by/rest/Json?What=Postal.OfficesOut';
const SERVICE_NUMBER = 'E811AE79-DFDE-4F85-8715-DD3A8308707E';
const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

const FALLBACK_OFFICES = [
  { id: '70130010', number: '1', city: 'Минск', address: 'г. Минск, ул. Монтажников, 2 (м-н «Евроопт»)', schedule: '09:00–21:00, обед 14:00–15:00, без выходных', latitude: 53.873516, longitude: 27.416178 },
  { id: '10130030', number: '65', city: 'Брест', address: 'г. Брест, Варшавское шоссе, 11 (м-н «Евроопт»)', schedule: '', latitude: 52.0754, longitude: 23.7179 },
  { id: '20130010', number: '11', city: 'Витебск', address: 'г. Витебск, пр-т Строителей, 15-2 (м-н «Евроопт»)', schedule: '', latitude: 55.169961, longitude: 30.223099 },
  { id: '30130100', number: '190', city: 'Гомель', address: 'г. Гомель, пр-т Речицкий, 5В', schedule: '', latitude: 52.4168, longitude: 30.9609 },
  { id: '40130020', number: '37', city: 'Гродно', address: 'г. Гродно, ул. Соломовой, 104/1 (м-н «Евроопт»)', schedule: '', latitude: 53.6586, longitude: 23.7846 },
  { id: '60130040', number: '62', city: 'Могилев', address: 'г. Могилев, ул. Гагарина, 79 (м-н «Евроопт»)', schedule: '', latitude: 53.88012, longitude: 30.31743 }
];

function cleanText(value, maxLength = 300) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function normalizeOffice(raw) {
  const id = cleanText(raw?.WarehouseId || raw?.id, 64);
  const fullName = cleanText(raw?.WarehouseName || raw?.address, 300);
  const number = cleanText(raw?.number || fullName.match(/№\s*([^\s,]+)/u)?.[1], 24);
  const city = cleanText(raw?.Address5Name || raw?.city, 100);
  const address = cleanText(raw?.address || fullName.replace(/^Отделение\s*№\s*[^\s,]+\s*/iu, ''), 300);
  if (!id || !address) return null;
  return {
    id,
    number,
    city,
    address,
    schedule: cleanText(raw?.Info1 || raw?.schedule, 300).replace(/^Режим работы:\s*/iu, '').replace(/\.$/, ''),
    latitude: Number(raw?.Latitude ?? raw?.latitude) || null,
    longitude: Number(raw?.Longitude ?? raw?.longitude) || null
  };
}

function normalizeOffices(rows) {
  const seen = new Set();
  return (Array.isArray(rows) ? rows : []).map(normalizeOffice).filter(office => {
    if (!office || seen.has(office.id)) return false;
    seen.add(office.id);
    return true;
  });
}

function requestOfficialOffices(timeoutMs) {
  const payload = JSON.stringify({
    CRC: '',
    Packet: { MethodName: 'Postal.OfficesOut', JWT: null, ServiceNumber: SERVICE_NUMBER, Data: {} }
  });
  return new Promise((resolve, reject) => {
    const request = https.request(API_URL, {
      method: 'POST',
      timeout: timeoutMs,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'User-Agent': 'ByVit/1.0 (+https://byvit.by)'
      }
    }, response => {
      const chunks = [];
      let size = 0;
      response.on('data', chunk => {
        size += chunk.length;
        if (size > MAX_RESPONSE_BYTES) {
          request.destroy(new Error('Ответ Европочты слишком большой.'));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`API Европочты вернул ${response.statusCode}.`));
          return;
        }
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
          const offices = normalizeOffices(data.Table);
          if (!offices.length) throw new Error('Список отделений Европочты пуст.');
          resolve(offices);
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on('timeout', () => request.destroy(new Error('API Европочты не ответил вовремя.')));
    request.on('error', reject);
    request.write(payload);
    request.end();
  });
}

function createEuropostClient(options = {}) {
  const cacheFile = path.join(options.dataDir || process.cwd(), 'europost-offices.json');
  const ttlMs = Math.max(60_000, Number(options.ttlMs || DEFAULT_TTL_MS));
  const timeoutMs = Math.max(2_000, Number(options.timeoutMs || 12_000));
  const testMode = options.testMode === true;
  let cache = null;
  let pending = null;

  function readDiskCache() {
    if (cache) return cache;
    try {
      const saved = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      const offices = normalizeOffices(saved.offices);
      if (offices.length) cache = { offices, updatedAt: saved.updatedAt || '', source: 'cache' };
    } catch (error) { }
    return cache;
  }

  function writeDiskCache(value) {
    try {
      fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
      const temporary = `${cacheFile}.${process.pid}.tmp`;
      fs.writeFileSync(temporary, JSON.stringify(value));
      fs.renameSync(temporary, cacheFile);
    } catch (error) {
      console.warn('Не удалось сохранить кэш Европочты:', error.message);
    }
  }

  async function refresh() {
    if (pending) return pending;
    pending = requestOfficialOffices(timeoutMs).then(offices => {
      cache = { offices, updatedAt: new Date().toISOString(), source: 'official' };
      writeDiskCache({ offices, updatedAt: cache.updatedAt });
      return cache;
    }).finally(() => { pending = null; });
    return pending;
  }

  async function list() {
    const saved = readDiskCache();
    const updatedAt = Date.parse(saved?.updatedAt || '');
    if (saved && Number.isFinite(updatedAt) && Date.now() - updatedAt < ttlMs) return saved;
    if (testMode) return saved || { offices: FALLBACK_OFFICES, updatedAt: '', source: 'fallback' };
    try {
      return await refresh();
    } catch (error) {
      if (saved) return { ...saved, source: 'stale-cache', warning: error.message };
      return { offices: FALLBACK_OFFICES, updatedAt: '', source: 'fallback', warning: error.message };
    }
  }

  return { list };
}

module.exports = { createEuropostClient, normalizeOffices };
