import { ClientBuilder, ClientExtraFilesBuilder, ClientFooterBuilder, ClientGeneratorsBuilder, ClientHeaderBuilder, GeneratorDependency, GeneratorVerbOptions, HonoHandlerStrategy } from "@orval/core";

//#region src/index.d.ts
declare const getHonoDependencies: () => GeneratorDependency[];
declare const getHonoHeader: ClientHeaderBuilder;
declare const getHonoFooter: ClientFooterBuilder;
declare const generateHono: ClientBuilder;
/**
 * Generates or updates a handler file according to `strategy`:
 *
 * - a non-existent file is always freshly generated;
 * - `skip` leaves an existing file byte-for-byte unchanged;
 * - `full` rebuilds the preamble + validator chain and splices back user bodies
 *   (drops custom imports/middleware/helpers — the thin-handler model);
 * - `smart` non-destructively reconciles orval-owned imports + validators and
 *   appends handlers for new operations, preserving all user-authored code.
 */
declare const generateHandlerFile: ({
  verbs,
  path,
  header,
  validatorModule,
  zodModule,
  contextModule,
  strategy
}: {
  verbs: GeneratorVerbOptions[];
  path: string;
  header: string;
  validatorModule?: string;
  zodModule: string;
  contextModule: string;
  strategy: HonoHandlerStrategy;
}) => Promise<string>;
declare const generateExtraFiles: ClientExtraFilesBuilder;
declare const builder: () => () => ClientGeneratorsBuilder;
//#endregion
export { builder, builder as default, generateExtraFiles, generateHandlerFile, generateHono, getHonoDependencies, getHonoFooter, getHonoHeader };
//# sourceMappingURL=index.d.mts.map