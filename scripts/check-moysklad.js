const assert = require('assert/strict');
const { createMoySkladClient, availableStock } = require('../lib/moysklad');

async function main() {
  const requests = [];
  const rows = [
    { meta: { href: 'https://api.moysklad.ru/api/remap/1.2/entity/product/ms-1' }, article: 'WHEY-900', stock: 7, reserve: 2, quantity: 9 },
    { assortment: { meta: { href: 'https://api.moysklad.ru/api/remap/1.2/entity/product/ms-2' } }, article: 'CREATINE-300', quantity: 5, reserve: 2 }
  ];
  const fetchImpl = async (url, options) => {
    requests.push({ url: String(url), authorization: options.headers.Authorization });
    if (String(url).includes('/context/employee')) return new Response(JSON.stringify({ id: 'employee-1', accountId: 'account-1', name: 'ByVit' }));
    return new Response(JSON.stringify({ meta: { size: rows.length }, rows }));
  };
  const client = createMoySkladClient({ token: 'secret-test-token', fetchImpl });
  const connection = await client.testConnection();
  assert.equal(connection.accountId, 'account-1');
  const store = {
    products: [
      { id: 1, name: 'Whey', stock: 15, moyskladId: 'ms-1' },
      { id: 2, name: 'Creatine', stock: 28, moyskladArticle: 'CREATINE-300' },
      { id: 3, name: 'Missing', stock: 4, moyskladId: 'missing' },
      { id: 4, name: 'Local only', stock: 3 }
    ],
    meta: {}
  };
  const result = await client.syncStock(store);
  assert.equal(store.products[0].stock, 7);
  assert.equal(store.products[1].stock, 3);
  assert.equal(store.products[2].stock, 4);
  assert.equal(store.products[3].stock, 3);
  assert.equal(result.matched, 2);
  assert.equal(result.unmatched, 1);
  assert.equal(result.changed, 2);
  assert.equal(availableStock({ quantity: 10, reserve: 4 }), 6);
  assert.ok(requests.every(request => request.authorization === 'Bearer secret-test-token'));
  assert.equal(JSON.stringify(result).includes('secret-test-token'), false);
  console.log('MoySklad integration check passed.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
