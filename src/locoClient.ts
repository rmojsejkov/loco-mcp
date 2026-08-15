import {
  LocoAsset,
  LocoCredentials,
  LocoImportResponse,
  LocoTranslation,
} from './types.js';

const LOCO_API_URL = 'https://localise.biz/api';

type Fetch = typeof fetch;

export class LocoClient {
  constructor(
    private readonly apiKey: string,
    private readonly importLocale: string,
    private readonly request: Fetch = fetch
  ) {}

  private async requestJson<T>(
    endpoint: string,
    init: RequestInit = {}
  ): Promise<T> {
    const headers = new Headers(init.headers);

    headers.set('Accept', 'application/json');
    headers.set('Authorization', `Loco ${this.apiKey}`);

    const response = await this.request(`${LOCO_API_URL}${endpoint}`, {
      ...init,
      headers,
    });

    if (!response.ok) {
      throw new Error(
        `Loco API request failed with HTTP ${response.status} at ${endpoint}`
      );
    }

    const result = (await response.json()) as T;

    if (
      result &&
      typeof result === 'object' &&
      'error' in result &&
      typeof result.error === 'string' &&
      result.error
    ) {
      throw new Error(`Loco API rejected the request: ${result.error}`);
    }

    return result;
  }

  async verifyCredentials(): Promise<LocoCredentials> {
    return this.requestJson<LocoCredentials>('/auth/verify');
  }

  async listAssets(tag?: string): Promise<LocoAsset[]> {
    const query = tag ? `?filter=${encodeURIComponent(tag)}` : '';

    return this.requestJson<LocoAsset[]>(`/assets${query}`);
  }

  async getAsset(assetId: string): Promise<LocoAsset | null> {
    const endpoint = `/assets/${encodeURIComponent(assetId)}.json`;
    const response = await this.request(`${LOCO_API_URL}${endpoint}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Loco ${this.apiKey}`,
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(
        `Loco API request failed with HTTP ${response.status} at ${endpoint}`
      );
    }

    return (await response.json()) as LocoAsset;
  }

  async getTranslations(assetId: string): Promise<LocoTranslation[]> {
    return this.requestJson<LocoTranslation[]>(
      `/translations/${encodeURIComponent(assetId)}.json`
    );
  }

  async importPo(content: string): Promise<LocoImportResponse> {
    const query = new URLSearchParams({
      index: 'id',
      locale: this.importLocale,
      'flag-new': 'fuzzy',
      'ignore-blank': '1',
      'ignore-existing': '1',
    });

    return this.requestJson<LocoImportResponse>(`/import/po?${query}`, {
      body: content,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-gettext; charset=utf-8',
      },
    });
  }
}
