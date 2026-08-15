import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

const ENV_FILE_NAME = '.env.loco';
const API_KEY_NAME = 'LOCO_API_KEY';

const unquoteEnvironmentValue = (value: string): string => {
  const firstCharacter = value.at(0);
  const lastCharacter = value.at(-1);

  if (
    value.length >= 2 &&
    (firstCharacter === '"' || firstCharacter === "'") &&
    firstCharacter === lastCharacter
  ) {
    return value.slice(1, -1);
  }

  return value;
};

export interface LocoEnvironment {
  apiKey: string;
  importLocale: string;
  projectName: string;
  workspaceRoot: string;
}

export const findWorkspaceRoot = (): string =>
  resolve(
    process.env.LOCO_WORKSPACE_ROOT ||
      process.env.CLAUDE_PROJECT_DIR ||
      process.cwd()
  );

export const getLocoApiKey = (repositoryRoot: string): string => {
  const environmentApiKey = process.env[API_KEY_NAME]?.trim();

  if (environmentApiKey) {
    return environmentApiKey;
  }

  const configuredEnvironmentPath = process.env.LOCO_ENV_FILE;
  const environmentPath = configuredEnvironmentPath
    ? isAbsolute(configuredEnvironmentPath)
      ? configuredEnvironmentPath
      : resolve(repositoryRoot, configuredEnvironmentPath)
    : resolve(repositoryRoot, ENV_FILE_NAME);

  if (!existsSync(environmentPath)) {
    throw new Error(
      `Missing ${API_KEY_NAME}. Add it to the ignored ${ENV_FILE_NAME} file`
    );
  }

  const line = readFileSync(environmentPath, 'utf8')
    .split(/\r?\n/u)
    .map((value) => value.trim())
    .find((value) =>
      value.replace(/^export\s+/u, '').startsWith(`${API_KEY_NAME}=`)
    );

  if (!line) {
    throw new Error(`Missing ${API_KEY_NAME} in ${ENV_FILE_NAME}`);
  }

  const normalizedLine = line.replace(/^export\s+/u, '');
  const apiKey = unquoteEnvironmentValue(
    normalizedLine.slice(API_KEY_NAME.length + 1).trim()
  );

  if (!apiKey) {
    throw new Error(`${API_KEY_NAME} in ${ENV_FILE_NAME} is empty`);
  }

  return apiKey;
};

export const getLocoEnvironment = (): LocoEnvironment => {
  const workspaceRoot = findWorkspaceRoot();
  const projectName = process.env.LOCO_PROJECT_NAME?.trim();
  const importLocale = process.env.LOCO_IMPORT_LOCALE?.trim() || 'de';

  if (!projectName) {
    throw new Error('Missing required LOCO_PROJECT_NAME');
  }

  if (!/^[A-Za-z]{2}(?:[-_][A-Za-z]{2})?$/u.test(importLocale)) {
    throw new Error(
      'LOCO_IMPORT_LOCALE must be a locale code such as de or de_DE'
    );
  }

  return {
    projectName,
    importLocale,
    workspaceRoot,
    apiKey: getLocoApiKey(workspaceRoot),
  };
};
