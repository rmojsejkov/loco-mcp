export interface LocoProject {
  id: number;
  name: string;
  url: string;
}

export interface LocoCredentials {
  project: LocoProject;
}

export interface LocoAssetProgress {
  flagged: number;
  translated: number;
  untranslated: number;
}

export interface LocoAsset {
  id: string;
  tags: string[];
  context: string;
  notes: string;
  progress: LocoAssetProgress;
}

export interface LocoTranslationLocale {
  code: string;
  name: string;
}

export interface LocoTranslation {
  id: string;
  status: string;
  flagged: boolean;
  translated: boolean;
  translation: string;
  locale: LocoTranslationLocale;
}

export interface LocoImportResponse {
  error?: string;
  message?: string;
  status?: number | string;
}

export interface ValidatedPoEntry {
  context: string;
  id: string;
  translation: string;
}

export interface ValidatedPoFile {
  path: string;
  content: string;
  entries: ValidatedPoEntry[];
}

export interface LocoApi {
  verifyCredentials(): Promise<LocoCredentials>;
  listAssets(tag?: string): Promise<LocoAsset[]>;
  getAsset(assetId: string): Promise<LocoAsset | null>;
  getTranslations(assetId: string): Promise<LocoTranslation[]>;
  importPo(content: string): Promise<LocoImportResponse>;
}
