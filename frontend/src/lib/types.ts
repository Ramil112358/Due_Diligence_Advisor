export type SupportedMime =
  | "application/pdf"
  | "image/png"
  | "image/jpeg"
  | "image/webp";

export const SUPPORTED_MIMES: SupportedMime[] = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
];

export const SUPPORTED_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg", ".webp"];

export interface DocumentPart {
  name: string;
  mimeType: SupportedMime;
  bytes: Buffer;
}

export interface Citation {
  fileName: string;
  pageStart?: number;
  pageEnd?: number;
  quote?: string;
  sourceUrl?: string;
}

export interface FileMeta {
  id: string;
  name: string;
  mimeType: string;
  pageCount: number | null;
  summary: string | null;
  tags: string[];
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
}

export type StreamEvent =
  | { type: "text"; delta: string }
  | { type: "tool_call_start"; name: string; args: Record<string, unknown> }
  | { type: "tool_call_result"; name: string; result: unknown }
  | { type: "citations"; citations: Citation[] }
  | { type: "done"; finalText: string; citations: Citation[] }
  | { type: "error"; message: string };
