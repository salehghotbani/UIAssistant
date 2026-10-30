import test from 'node:test';
import assert from 'node:assert/strict';
import { createPreviewJobs } from '../lib/preview-jobs.js';

test('preview lookup exposes metadata only and images require the correct tab and job', () => {
  let serial = 0;
  const jobs = createPreviewJobs({ random: () => String(++serial) });
  const job = jobs.create({ tabId: 7, mode: 'container' });
  job.status = 'ready';
  job.image = 'private pixels';
  assert.equal(jobs.describe(7).image, undefined);
  assert.throws(() => jobs.image(8, job.id));
  assert.throws(() => jobs.image(7, 'forged'));
  assert.equal(jobs.image(7, job.id).image, 'private pixels');
  jobs.remove(7);
  assert.equal(job.image, null);
  assert.throws(() => jobs.image(7, job.id));
});
test('bounded RAM previews expire and remove the internal connection', () => {
  let now = 1,
    disconnected = 0;
  const jobs = createPreviewJobs({ now: () => now, ttl: 50 });
  const job = jobs.create({ tabId: 1 });
  job.port = { disconnect: () => disconnected++ };
  job.image = 'pixels';
  job.status = 'ready';
  now = 51;
  assert.equal(jobs.get(1), null);
  assert.equal(job.image, null);
  assert.equal(disconnected, 1);
});
test('replacing a preview cancels the old job without touching the new one', () => {
  let serial = 0;
  const jobs = createPreviewJobs({ random: () => String(++serial) });
  const old = jobs.create({ tabId: 7 });
  old.port = { disconnect: () => assert.equal(jobs.get(7), null) };
  const next = jobs.create({ tabId: 7 });
  assert.ok(old.cancelled);
  assert.equal(jobs.get(7), next);
  jobs.remove(7);
});
test('memory bounds never evict a running capture to make another running capture', () => {
  const jobs = createPreviewJobs({ max: 1 });
  const first = jobs.create({ tabId: 1 });
  assert.throws(() => jobs.create({ tabId: 2 }));
  first.status = 'ready';
  first.image = 'old';
  const next = jobs.create({ tabId: 2 });
  assert.equal(first.image, null);
  assert.equal(jobs.get(2), next);
  jobs.remove(2);
});
