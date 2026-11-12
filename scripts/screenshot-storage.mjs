import { expect } from '@playwright/test';

export async function readDemoRecord(page, store, id) {
  return page.evaluate(
    ({ store, id }) =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('tick');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const database = open.result;
          const request = database
            .transaction(store, 'readonly')
            .objectStore(store)
            .get(id);
          request.onerror = () => {
            database.close();
            reject(request.error);
          };
          request.onsuccess = () => {
            database.close();
            resolve(request.result ?? null);
          };
        };
      }),
    { store, id },
  );
}

export async function completeDemoItem(page, index, store = 'checklistItems') {
  const attribute =
    store === 'goalSteps' ? 'data-goal-step-input' : 'data-checklist-input';
  const id = await page
    .locator(`[${attribute}="true"]`)
    .nth(index)
    .getAttribute('data-item-id');
  await page.getByRole('checkbox').nth(index).check();
  await expect
    .poll(async () => {
      const record = await readDemoRecord(page, store, id);
      if (record && !record.scopeId.startsWith('guest:'))
        throw new Error('Demo data must remain in a guest scope.');
      return Boolean(record?.checked || record?.completed);
    })
    .toBe(true);
}
