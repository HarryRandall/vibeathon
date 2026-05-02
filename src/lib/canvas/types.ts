// Shape of Canvas REST responses we use.

export type CanvasCourse = {
  id: number;
  name: string;
  course_code: string;
  enrollment_term_id?: number;
  start_at?: string | null;
  end_at?: string | null;
  workflow_state: "available" | "completed" | "deleted" | "unpublished" | string;
};

export type CanvasUserProfile = {
  id: number;
  name: string;
  short_name: string;
  primary_email?: string;
  login_id?: string;
};

// Modules -------------------------------------------------------------------

export type CanvasModuleItemType =
  | "File"
  | "Page"
  | "Discussion"
  | "Assignment"
  | "Quiz"
  | "SubHeader"
  | "ExternalUrl"
  | "ExternalTool"
  | string;

export type CanvasModuleItem = {
  id: number;
  module_id: number;
  position: number;
  title: string;
  indent: number;
  type: CanvasModuleItemType;
  html_url?: string | null;
  url?: string | null;
  page_url?: string | null;
  external_url?: string | null;
  content_id?: number;
  content_details?: {
    points_possible?: number;
    due_at?: string | null;
    locked_for_user?: boolean;
  };
  published?: boolean;
};

export type CanvasModule = {
  id: number;
  name: string;
  position: number;
  workflow_state: "active" | "deleted" | "unpublished" | string;
  items_count?: number;
  items?: CanvasModuleItem[];
  items_url?: string;
};

// Pages ---------------------------------------------------------------------

export type CanvasPage = {
  page_id?: number;
  url: string;
  title: string;
  body?: string | null;
  published?: boolean;
  updated_at?: string;
  html_url?: string;
};

// Files ---------------------------------------------------------------------

export type CanvasFile = {
  id: number;
  display_name: string;
  filename: string;
  url: string; // presigned download URL — typically valid for ~1h
  "content-type": string;
  size: number;
  folder_id?: number;
  updated_at?: string;
  locked_for_user?: boolean;
};

// Assignments ---------------------------------------------------------------

export type CanvasAssignment = {
  id: number;
  course_id: number;
  name: string;
  description?: string | null;
  due_at: string | null;
  points_possible: number | null;
  html_url: string;
  published: boolean;
};
