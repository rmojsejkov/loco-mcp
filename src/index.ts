#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';

import { findWorkspaceRoot, getLocoEnvironment } from './environment.js';
import { LocoClient } from './locoClient.js';
import { LocoService } from './locoService.js';
import { validatePoFile } from './po.js';

const SERVER_NAME = 'loco-mcp';
const SERVER_VERSION = '0.1.0';
const workspaceRoot = findWorkspaceRoot();

let locoService: LocoService | undefined;

const getLocoService = (): LocoService => {
  if (!locoService) {
    const environment = getLocoEnvironment();

    locoService = new LocoService(
      environment.workspaceRoot,
      new LocoClient(environment.apiKey, environment.importLocale),
      environment.projectName,
      environment.importLocale
    );
  }

  return locoService;
};

const successResult = (value: unknown) => ({
  content: [
    {
      type: 'text' as const,
      text: JSON.stringify(value, null, 2),
    },
  ],
  structuredContent: value,
});

const errorResult = (error: unknown) => ({
  isError: true,
  content: [
    {
      type: 'text' as const,
      text: error instanceof Error ? error.message : 'Unknown Loco MCP error',
    },
  ],
});

const runTool = async (callback: () => Promise<unknown> | unknown) => {
  try {
    return successResult(await callback());
  } catch (error) {
    return errorResult(error);
  }
};

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

const createServer = (): McpServer => {
  const projectName = process.env.LOCO_PROJECT_NAME?.trim() || 'configured';
  const importLocale = process.env.LOCO_IMPORT_LOCALE?.trim() || 'de';
  const server = new McpServer(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      instructions: `Loco tools restricted to the ${projectName} project. Read tools inspect assets and translations. Validate PO files before import. loco_import_po is the only write tool: it creates new ${importLocale} fuzzy assets, rejects existing IDs, and cannot delete, retag, or overwrite data.`,
    }
  );

  server.registerTool(
    'loco_verify_project',
    {
      title: 'Verify Loco project',
      description:
        'Verify that the configured credentials belong exactly to the configured Loco project without exposing the API key.',
      inputSchema: z.object({}),
      annotations: readOnlyAnnotations,
    },
    async () => runTool(() => getLocoService().verifyProject())
  );

  server.registerTool(
    'loco_list_assets',
    {
      title: 'List Loco assets',
      description:
        'List a bounded page of Loco assets, optionally filtered by exact tag and partial Asset ID.',
      inputSchema: z.object({
        tag: z.string().trim().min(1).optional(),
        search: z.string().trim().min(1).optional(),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
      }),
      annotations: readOnlyAnnotations,
    },
    async (options) => runTool(() => getLocoService().listAssets(options))
  );

  server.registerTool(
    'loco_find_missing_assets',
    {
      title: 'Find missing Loco assets',
      description:
        'Compare exact Asset IDs with Loco and split them into existing and missing lists.',
      inputSchema: z.object({
        assetIds: z.array(z.string().min(1).max(999)).min(1).max(500),
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ assetIds }) =>
      runTool(() => getLocoService().findMissingAssets(assetIds))
  );

  server.registerTool(
    'loco_get_asset',
    {
      title: 'Get Loco asset',
      description:
        'Get one Loco asset by its exact Asset ID. Returns null when it does not exist.',
      inputSchema: z.object({
        assetId: z.string().min(1).max(999),
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ assetId }) => runTool(() => getLocoService().getAsset(assetId))
  );

  server.registerTool(
    'loco_get_translation',
    {
      title: 'Get Loco translation',
      description:
        'Get one locale translation and its translated, flagged, and fuzzy status for an exact Asset ID.',
      inputSchema: z.object({
        assetId: z.string().min(1).max(999),
        locale: z
          .string()
          .regex(/^[A-Za-z]{2}(?:[-_][A-Za-z]{2})?$/u)
          .default('de'),
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ assetId, locale }) =>
      runTool(() => getLocoService().getTranslation(assetId, locale))
  );

  server.registerTool(
    'loco_validate_po',
    {
      title: 'Validate Loco PO file',
      description:
        'Validate a workspace-local PO file against the safe import rules without contacting or changing Loco.',
      inputSchema: z.object({
        poPath: z.string().min(1),
      }),
      annotations: {
        ...readOnlyAnnotations,
        openWorldHint: false,
      },
    },
    async ({ poPath }) =>
      runTool(() => {
        const poFile = validatePoFile(workspaceRoot, poPath);

        return {
          path: poFile.path,
          entryCount: poFile.entries.length,
          entries: poFile.entries,
        };
      })
  );

  server.registerTool(
    'loco_import_po',
    {
      title: 'Import new assets into Loco',
      description:
        'Validate and import a workspace-local PO file as new fuzzy assets in the configured locale. Rejects the whole import if any Asset ID already exists. Uses fixed safe flags and cannot overwrite, delete, or retag Loco data.',
      inputSchema: z.object({
        poPath: z.string().min(1),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ poPath }) => runTool(() => getLocoService().importPo(poPath))
  );

  return server;
};

serveStdio(createServer, {
  onerror: (error) => {
    console.error(`Loco MCP transport error: ${error.message}`);
  },
});

console.error(`${SERVER_NAME} MCP server running on stdio`);
