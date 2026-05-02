import "server-only";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

export type PdfExtractResult = {
  text: string;
  pages: number;
};

export async function extractPdfText(buffer: ArrayBuffer): Promise<PdfExtractResult> {
  const data = await pdfParse(Buffer.from(buffer), { max: 0 });
  const raw = data.text ?? "";
  const text = raw.replace(/\u0000/g, " ").trim();
  return {
    text,
    pages: data.numpages ?? 0,
  };
}
