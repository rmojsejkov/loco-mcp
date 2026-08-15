import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LocoClient } from '../locoClient.js';

describe('LocoClient', () => {
  it('uses only the fixed safe parameters when importing PO content', async () => {
    let requestedUrl = '';
    let requestInit: RequestInit | undefined;
    const request = (async (
      input: string | URL | Request,
      init?: RequestInit
    ): Promise<Response> => {
      requestedUrl = input.toString();
      requestInit = init;

      return new Response(JSON.stringify({ message: '1 new asset' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;
    const client = new LocoClient('secret-value', 'de', request);

    await client.importPo('PO content');

    const url = new URL(requestedUrl);
    const headers = new Headers(requestInit?.headers);

    assert.equal(url.pathname, '/api/import/po');
    assert.deepEqual([...url.searchParams.entries()].sort(), [
      ['flag-new', 'fuzzy'],
      ['ignore-blank', '1'],
      ['ignore-existing', '1'],
      ['index', 'id'],
      ['locale', 'de'],
    ]);
    assert.equal(requestInit?.method, 'POST');
    assert.equal(requestInit?.body, 'PO content');
    assert.equal(headers.get('Authorization'), 'Loco secret-value');
    assert.equal(url.searchParams.has('delete-absent'), false);
    assert.equal(url.searchParams.has('tag-all'), false);
  });
});
