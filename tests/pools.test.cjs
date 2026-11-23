'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const store = require('../lib/redis-store.js');
const pools = require('../lib/pools.js');

test('catalogue stores and removes pools and rejects invalid shares and numbers', async () => {
  const original = store.command, rows = new Map();
  store.command = async (command, key, id, value) => {
    if (command === 'HSET') return rows.set(id, value);
    if (command === 'HGET') return rows.get(id) || null;
    if (command === 'HVALS') return [...rows.values()];
    if (command === 'HDEL') return rows.delete(id);
    throw new Error('Unexpected Redis command');
  };
  try {
    const input = {game:'mega', date:'2027-01-01', numbers:'04, 02, 01', total:10, available:3, price:3990};
    const saved = await pools.save(input);
    assert.deepEqual(saved.numbers, [1,2,4]);
    assert.equal((await pools.list())[0].price, 3990);
    const updated = await pools.save({...input, price:4990}, saved.id);
    assert.equal(updated.id, saved.id);
    assert.equal(updated.createdAt, saved.createdAt);
    assert.equal((await pools.list())[0].price, 4990);
    await assert.rejects(pools.save({...input, available:11}), {status:422});
    await assert.rejects(pools.save({...input, numbers:'1,1'}), {status:422});
    await pools.remove(saved.id);
    assert.deepEqual(await pools.list(), []);
  } finally { store.command = original; }
});
