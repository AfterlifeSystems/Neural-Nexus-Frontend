import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  STALE_MODULE_RELOAD_STORAGE_KEY,
  loadDeployedModule,
} from './loadDeployedModule.js';

function memoryStorage(initial = {}) {
  const values = { ...initial };
  return {
    getItem(key) {
      return Object.hasOwn(values, key) ? values[key] : null;
    },
    setItem(key, value) {
      values[key] = String(value);
    },
  };
}

test('a successful importer is returned and the page is not reloaded', async () => {
  const moduleExports = { default: function Globe() {} };
  let reloadCount = 0;
  const loaded = await loadDeployedModule(async () => moduleExports, {
    storage: memoryStorage(),
    reload: () => {
      reloadCount += 1;
    },
  });
  assert.equal(loaded, moduleExports);
  assert.equal(reloadCount, 0);
});

test('the first failed import reloads once and does not throw', async () => {
  const storage = memoryStorage();
  let reloadCount = 0;
  const pending = loadDeployedModule(
    async () => {
      throw new TypeError('error loading dynamically imported module');
    },
    {
      storage,
      reload: () => {
        reloadCount += 1;
      },
    }
  );
  await Promise.race([
    pending.then(() => {
      throw new Error('the waiter should not settle before a second failure');
    }),
    new Promise((resolve) => setTimeout(resolve, 20)),
  ]);
  assert.equal(reloadCount, 1);
  assert.equal(storage.getItem(STALE_MODULE_RELOAD_STORAGE_KEY), '1');
});

test('a second failed import throws instead of reloading again', async () => {
  const storage = memoryStorage({
    [STALE_MODULE_RELOAD_STORAGE_KEY]: '1',
  });
  let reloadCount = 0;
  await assert.rejects(
    () =>
      loadDeployedModule(
        async () => {
          throw new TypeError('error loading dynamically imported module');
        },
        {
          storage,
          reload: () => {
            reloadCount += 1;
          },
        }
      ),
    /error loading dynamically imported module/
  );
  assert.equal(reloadCount, 0);
});
