import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

import { validatePoFile } from '../po.js';
import { createPoContent } from './fixtures.js';

const createRepository = (): string =>
  mkdtempSync(resolve(tmpdir(), 'student-native-loco-mcp-'));

describe('validatePoFile', () => {
  it('returns validated entries for a translator-ready PO file', () => {
    const repositoryRoot = createRepository();
    const poPath = resolve(repositoryRoot, 'translations.po');

    writeFileSync(poPath, createPoContent());

    const result = validatePoFile(repositoryRoot, poPath);

    assert.equal(result.entries.length, 1);
    assert.deepEqual(result.entries[0], {
      id: 'Retry',
      translation: 'Retry',
      context:
        'Button on a Learning Gaps exercise card that starts the exercise again',
    });
  });

  it('rejects interpolation markup in an Asset ID', () => {
    const repositoryRoot = createRepository();
    const poPath = resolve(repositoryRoot, 'translations.po');

    writeFileSync(
      poPath,
      createPoContent('{{count}} mistakes', '{{count}} mistakes')
    );

    assert.throws(
      () => validatePoFile(repositoryRoot, poPath),
      /contains interpolation markup/u
    );
  });

  it('rejects PO files outside the repository', () => {
    const repositoryRoot = createRepository();
    const externalRoot = createRepository();
    const poPath = resolve(externalRoot, 'translations.po');

    writeFileSync(poPath, createPoContent());

    assert.throws(
      () => validatePoFile(repositoryRoot, poPath),
      /inside the repository/u
    );
  });
});
