declare module "pdf-parse/lib/pdf-parse.js" {
  import type { Buffer } from "node:buffer";
  type PdfParseOptions = { max?: number; pagerender?: (page: unknown) => string };
  type PdfParseResult = {
    text: string;
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: unknown;
    version: string;
  };
  function pdfParse(data: Buffer | ArrayBuffer | Uint8Array, opts?: PdfParseOptions): Promise<PdfParseResult>;
  export = pdfParse;
}
