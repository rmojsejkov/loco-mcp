import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

import { LocoService } from '../locoService.js';
import {
  LocoApi,
  LocoAsset,
  LocoCredentials,
  LocoImportResponse,
  LocoTranslation,
} from '../types.js';
import { createPoContent } from './fixtures.js';

const credentials: LocoCredentials = {
  project: {
    id: 83632,
    name: 'student-native',
    url: 'https://localise.biz/123fahrschule/student-native',
  },
};

const createAsset = (id: string): LocoAsset => ({
  id,
  tags: [],
  notes: '',
  context: '',
  progress: {
    flagged: 1,
    translated: 1,
    untranslated: 0,
  },
});

class FakeLocoApi implements LocoApi {
  assets: LocoAsset[] = [];
  credentials = credentials;
  importedContent: string | undefined;

  async verifyCredentials(): Promise<LocoCredentials> {
    return this.credentials;
  }

  async listAssets(): Promise<LocoAsset[]> {
    return this.assets;
  }

  async getAsset(assetId: string): Promise<LocoAsset | null> {
    return this.assets.find((asset) => asset.id === assetId) || null;
  }

  async getTranslations(assetId: string): Promise<LocoTranslation[]> {
    return [
      {
        id: assetId,
        status: 'fuzzy',
        flagged: true,
        translated: true,
        translation: assetId,
        locale: { code: 'de', name: 'German' },
      },
    ];
  }

  async importPo(content: string): Promise<LocoImportResponse> {
    this.importedContent = content;
    this.assets = [createAsset('Retry')];

    return { message: '1 translation imported, 1 new asset' };
  }
}

const createService = (): {
  api: FakeLocoApi;
  poPath: string;
  service: LocoService;
} => {
  const repositoryRoot = mkdtempSync(
    resolve(tmpdir(), 'student-native-loco-mcp-')
  );
  const poPath = resolve(repositoryRoot, 'translations.po');
  const api = new FakeLocoApi();

  writeFileSync(poPath, createPoContent());

  return {
    api,
    poPath,
    service: new LocoService(repositoryRoot, api, 'student-native', 'de'),
  };
};

describe('LocoService import', () => {
  it('imports new assets and verifies their fuzzy German translations', async () => {
    const { api, poPath, service } = createService();

    const result = await service.importPo(poPath);

    assert.equal(api.importedContent, createPoContent());
    assert.deepEqual(result, {
      imported: 1,
      assetIds: ['Retry'],
      message: '1 translation imported, 1 new asset',
    });
  });

  it('rejects the complete import when an Asset ID already exists', async () => {
    const { api, poPath, service } = createService();

    api.assets = [createAsset('Retry')];

    await assert.rejects(
      () => service.importPo(poPath),
      /assets already exist: Retry/u
    );
    assert.equal(api.importedContent, undefined);
  });

  it('rejects credentials belonging to another Loco project', async () => {
    const { api, poPath, service } = createService();

    api.credentials = {
      project: {
        ...credentials.project,
        name: 'another-project',
      },
    };

    await assert.rejects(
      () => service.importPo(poPath),
      /must belong to student-native/u
    );
    assert.equal(api.importedContent, undefined);
  });
});
