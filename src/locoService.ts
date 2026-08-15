import { validatePoFile } from './po.js';
import {
  LocoApi,
  LocoAsset,
  LocoImportResponse,
  LocoTranslation,
  ValidatedPoFile,
} from './types.js';

export interface AssetListOptions {
  limit: number;
  offset: number;
  search?: string;
  tag?: string;
}

export class LocoService {
  constructor(
    private readonly repositoryRoot: string,
    private readonly api: LocoApi,
    private readonly expectedProjectName: string,
    private readonly importLocale: string
  ) {}

  async verifyProject(): Promise<{ name: string; url: string }> {
    const credentials = await this.api.verifyCredentials();
    const project = credentials.project;

    if (!project || project.name !== this.expectedProjectName) {
      throw new Error(
        `Loco credentials must belong to ${
          this.expectedProjectName
        }, received ${project?.name || 'an unknown project'}`
      );
    }

    return { name: project.name, url: project.url };
  }

  async listAssets(options: AssetListOptions): Promise<{
    assets: LocoAsset[];
    offset: number;
    returned: number;
    total: number;
  }> {
    await this.verifyProject();

    const assets = await this.api.listAssets(options.tag);
    const normalizedSearch = options.search?.trim().toLowerCase();
    const matchingAssets = normalizedSearch
      ? assets.filter((asset) =>
          asset.id.toLowerCase().includes(normalizedSearch)
        )
      : assets;
    const selectedAssets = matchingAssets.slice(
      options.offset,
      options.offset + options.limit
    );

    return {
      assets: selectedAssets,
      offset: options.offset,
      returned: selectedAssets.length,
      total: matchingAssets.length,
    };
  }

  async findMissingAssets(assetIds: string[]): Promise<{
    existing: string[];
    missing: string[];
  }> {
    await this.verifyProject();

    const uniqueAssetIds = [...new Set(assetIds)];
    const currentAssetIds = new Set(
      (await this.api.listAssets()).map((asset) => asset.id)
    );

    return {
      existing: uniqueAssetIds.filter((assetId) =>
        currentAssetIds.has(assetId)
      ),
      missing: uniqueAssetIds.filter(
        (assetId) => !currentAssetIds.has(assetId)
      ),
    };
  }

  async getAsset(assetId: string): Promise<LocoAsset | null> {
    await this.verifyProject();

    return this.api.getAsset(assetId);
  }

  async getTranslation(
    assetId: string,
    locale: string
  ): Promise<LocoTranslation | null> {
    await this.verifyProject();

    const translations = await this.api.getTranslations(assetId);

    return (
      translations.find((translation) => translation.locale.code === locale) ||
      null
    );
  }

  validatePo(path: string): ValidatedPoFile {
    return validatePoFile(this.repositoryRoot, path);
  }

  async importPo(path: string): Promise<{
    assetIds: string[];
    imported: number;
    message: string;
  }> {
    const poFile = this.validatePo(path);
    const assetIds = poFile.entries.map((entry) => entry.id);

    await this.verifyProject();

    const existingAssetIds = new Set(
      (await this.api.listAssets()).map((asset) => asset.id)
    );
    const conflicts = assetIds.filter((assetId) =>
      existingAssetIds.has(assetId)
    );

    if (conflicts.length) {
      throw new Error(
        `Import stopped because these assets already exist: ${conflicts.join(
          ', '
        )}`
      );
    }

    const response = await this.api.importPo(poFile.content);
    const importedAssetIds = new Set(
      (await this.api.listAssets()).map((asset) => asset.id)
    );
    const missingAssets = assetIds.filter(
      (assetId) => !importedAssetIds.has(assetId)
    );

    if (missingAssets.length) {
      throw new Error(
        `Loco import completed but assets were not found: ${missingAssets.join(
          ', '
        )}`
      );
    }

    const invalidTranslations: string[] = [];

    for (const assetId of assetIds) {
      const translations = await this.api.getTranslations(assetId);
      const germanTranslation = translations.find(
        (translation) => translation.locale.code === this.importLocale
      );

      if (
        !germanTranslation?.translated ||
        !germanTranslation.flagged ||
        germanTranslation.status.toLowerCase() !== 'fuzzy'
      ) {
        invalidTranslations.push(assetId);
      }
    }

    if (invalidTranslations.length) {
      throw new Error(
        `Imported translations were not verified as fuzzy: ${invalidTranslations.join(
          ', '
        )}`
      );
    }

    return {
      assetIds,
      imported: assetIds.length,
      message: this.getImportMessage(response),
    };
  }

  private getImportMessage(response: LocoImportResponse): string {
    if (response.message) {
      return response.message;
    }

    if (response.status !== undefined) {
      return `Loco import status: ${response.status}`;
    }

    return 'Loco import completed';
  }
}
