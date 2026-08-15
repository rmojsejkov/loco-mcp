import { lstatSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { extname, isAbsolute, relative, resolve } from 'node:path';

import { po } from 'gettext-parser';

import { ValidatedPoEntry, ValidatedPoFile } from './types.js';

const MAX_PO_FILE_BYTES = 1_000_000;
const MAX_PO_ENTRIES = 200;
const TRAILING_PUNCTUATION_PATTERN = /[.!?…]$/u;
const INTERPOLATION_PATTERN = /\{\{\s*[A-Za-z_][\w.]*\s*\}\}/gu;

const assertRepositoryFile = (
  repositoryRoot: string,
  requestedPath: string
): string => {
  const repositoryRealPath = realpathSync(repositoryRoot);
  const candidatePath = isAbsolute(requestedPath)
    ? requestedPath
    : resolve(repositoryRealPath, requestedPath);
  const candidateRealPath = realpathSync(candidatePath);
  const relativePath = relative(repositoryRealPath, candidateRealPath);

  if (
    relativePath.startsWith('..') ||
    isAbsolute(relativePath) ||
    lstatSync(candidatePath).isSymbolicLink()
  ) {
    throw new Error('The PO file must be a regular file inside the repository');
  }

  if (!statSync(candidateRealPath).isFile()) {
    throw new Error('The PO path must point to a regular file');
  }

  if (extname(candidateRealPath).toLowerCase() !== '.po') {
    throw new Error('Only .po files can be validated or imported');
  }

  if (statSync(candidateRealPath).size > MAX_PO_FILE_BYTES) {
    throw new Error(`PO files must be smaller than ${MAX_PO_FILE_BYTES} bytes`);
  }

  return candidateRealPath;
};

const assertValidPlaceholders = (
  translation: string,
  assetId: string
): void => {
  const interpolationStarts = translation.match(/\{\{/gu)?.length || 0;
  const interpolationEnds = translation.match(/\}\}/gu)?.length || 0;
  const placeholders = translation.match(INTERPOLATION_PATTERN)?.length || 0;

  if (
    interpolationStarts !== interpolationEnds ||
    interpolationStarts !== placeholders
  ) {
    throw new Error(`Asset "${assetId}" has malformed interpolation markup`);
  }
};

export const validatePoFile = (
  repositoryRoot: string,
  requestedPath: string
): ValidatedPoFile => {
  const path = assertRepositoryFile(repositoryRoot, requestedPath);
  const content = readFileSync(path, 'utf8');

  let parsedFile;

  try {
    parsedFile = po.parse(content, { validation: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    throw new Error(`Invalid PO file: ${message}`);
  }

  if (!parsedFile.headers.Language?.toLowerCase().startsWith('de')) {
    throw new Error('The PO Language header must target German');
  }

  const entries: ValidatedPoEntry[] = [];
  const seenAssetIds = new Set<string>();

  for (const translations of Object.values(parsedFile.translations)) {
    for (const translation of Object.values(translations)) {
      if (!translation.msgid) {
        continue;
      }

      const assetId = translation.msgid;
      const translatedText = translation.msgstr[0]?.trim();
      const flags = translation.comments?.flag
        ?.split(',')
        .map((flag) => flag.trim().toLowerCase());

      if (!translation.msgctxt?.trim()) {
        throw new Error(`Asset "${assetId}" is missing msgctxt`);
      }

      if (!translation.comments?.extracted?.trim()) {
        throw new Error(`Asset "${assetId}" is missing an extracted comment`);
      }

      if (!translation.comments.reference?.trim()) {
        throw new Error(`Asset "${assetId}" is missing a source reference`);
      }

      if (!flags?.includes('fuzzy')) {
        throw new Error(`Asset "${assetId}" must be marked fuzzy`);
      }

      if (!translatedText) {
        throw new Error(`Asset "${assetId}" has an empty translation`);
      }

      if (translation.msgid_plural) {
        throw new Error(
          `Asset "${assetId}" uses Gettext plurals; use separate _one and _other IDs`
        );
      }

      if (TRAILING_PUNCTUATION_PATTERN.test(assetId)) {
        throw new Error(`Asset "${assetId}" has trailing punctuation`);
      }

      if (assetId.includes('{{')) {
        throw new Error(`Asset "${assetId}" contains interpolation markup`);
      }

      if (Buffer.byteLength(assetId, 'utf8') > 999) {
        throw new Error(`Asset "${assetId}" exceeds Loco's 999-byte ID limit`);
      }

      if (seenAssetIds.has(assetId)) {
        throw new Error(`Asset "${assetId}" is duplicated in the PO file`);
      }

      assertValidPlaceholders(translatedText, assetId);
      seenAssetIds.add(assetId);
      entries.push({
        id: assetId,
        context: translation.msgctxt,
        translation: translatedText,
      });
    }
  }

  if (!entries.length) {
    throw new Error('The PO file contains no translatable entries');
  }

  if (entries.length > MAX_PO_ENTRIES) {
    throw new Error(
      `A single PO import is limited to ${MAX_PO_ENTRIES} assets`
    );
  }

  return { path, content, entries };
};
