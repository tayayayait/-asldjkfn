export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type TableDefinition<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: TableDefinition<
        {
          id: string;
          email: string;
          name: string | null;
          role: "admin" | "manager" | "editor" | "reviewer" | "viewer";
          avatar_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        },
        {
          id: string;
          email: string;
          name?: string | null;
          role?: "admin" | "manager" | "editor" | "reviewer" | "viewer";
          avatar_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        },
        {
          email?: string;
          name?: string | null;
          role?: "admin" | "manager" | "editor" | "reviewer" | "viewer";
          avatar_url?: string | null;
          is_active?: boolean;
          updated_at?: string;
        }
      >;
      products: TableDefinition<
        {
          id: string;
          sku: string;
          name_ko: string;
          name_en: string | null;
          name_ja: string | null;
          name_zh: string | null;
          category: string;
          materials: string[];
          cultural_keywords: string[];
          own_mall_url: string | null;
          description: string | null;
          status:
            | "draft"
            | "collecting"
            | "review_required"
            | "knowledge_ready"
            | "content_ready"
            | "image_ready"
            | "completed"
            | "archived";
          owner_id: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          sku: string;
          name_ko: string;
          name_en?: string | null;
          name_ja?: string | null;
          name_zh?: string | null;
          category: string;
          materials?: string[];
          cultural_keywords?: string[];
          own_mall_url?: string | null;
          description?: string | null;
          status?:
            | "draft"
            | "collecting"
            | "review_required"
            | "knowledge_ready"
            | "content_ready"
            | "image_ready"
            | "completed"
            | "archived";
          owner_id?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          sku?: string;
          name_ko?: string;
          name_en?: string | null;
          name_ja?: string | null;
          name_zh?: string | null;
          category?: string;
          materials?: string[];
          cultural_keywords?: string[];
          own_mall_url?: string | null;
          description?: string | null;
          status?:
            | "draft"
            | "collecting"
            | "review_required"
            | "knowledge_ready"
            | "content_ready"
            | "image_ready"
            | "completed"
            | "archived";
          owner_id?: string | null;
          updated_at?: string;
        }
      >;
      product_assets: TableDefinition<
        {
          id: string;
          product_id: string;
          asset_type: "original" | "thumbnail" | "reference" | "attachment";
          file_path: string;
          file_name: string;
          file_size: number | null;
          mime_type: string | null;
          width: number | null;
          height: number | null;
          is_primary: boolean | null;
          created_at: string;
        },
        {
          id?: string;
          product_id: string;
          asset_type: "original" | "thumbnail" | "reference" | "attachment";
          file_path: string;
          file_name: string;
          file_size?: number | null;
          mime_type?: string | null;
          width?: number | null;
          height?: number | null;
          is_primary?: boolean | null;
          created_at?: string;
        },
        {
          asset_type?: "original" | "thumbnail" | "reference" | "attachment";
          file_path?: string;
          file_name?: string;
          file_size?: number | null;
          mime_type?: string | null;
          width?: number | null;
          height?: number | null;
          is_primary?: boolean | null;
        }
      >;
      source_documents: TableDefinition<
        {
          id: string;
          product_id: string;
          source_type:
            | "own_mall"
            | "naver_web"
            | "naver_blog"
            | "naver_news"
            | "manual";
          source_url: string | null;
          title: string | null;
          raw_text: string;
          markdown: string | null;
          extracted_metadata: Json;
          reliability_score: number | null;
          status:
            | "queued"
            | "fetching"
            | "fetched"
            | "parse_failed"
            | "review_pending"
            | "approved"
            | "approved_with_edit"
            | "rejected"
            | "duplicate";
          reviewer_id: string | null;
          review_note: string | null;
          collected_at: string | null;
          approved_at: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          product_id: string;
          source_type:
            | "own_mall"
            | "naver_web"
            | "naver_blog"
            | "naver_news"
            | "manual";
          source_url?: string | null;
          title?: string | null;
          raw_text: string;
          markdown?: string | null;
          extracted_metadata?: Json;
          reliability_score?: number | null;
          status?:
            | "queued"
            | "fetching"
            | "fetched"
            | "parse_failed"
            | "review_pending"
            | "approved"
            | "approved_with_edit"
            | "rejected"
            | "duplicate";
          reviewer_id?: string | null;
          review_note?: string | null;
          collected_at?: string | null;
          approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        Record<string, unknown>
      >;
      story_chunks: TableDefinition<
        {
          id: string;
          product_id: string;
          source_document_id: string;
          chunk_index: number;
          content: string;
          char_length: number;
          token_count: number | null;
          metadata: Json;
          created_at: string;
        },
        {
          id?: string;
          product_id: string;
          source_document_id: string;
          chunk_index: number;
          content: string;
          char_length: number;
          token_count?: number | null;
          metadata?: Json;
          created_at?: string;
        },
        Record<string, unknown>
      >;
      story_embeddings: TableDefinition<
        {
          id: string;
          chunk_id: string;
          product_id: string;
          embedding: string | null;
          model: string;
          status:
            | "not_required"
            | "pending"
            | "queued"
            | "embedding"
            | "embedded"
            | "stale"
            | "failed";
          created_at: string;
        },
        {
          id?: string;
          chunk_id: string;
          product_id: string;
          embedding?: string | null;
          model: string;
          status?:
            | "not_required"
            | "pending"
            | "queued"
            | "embedding"
            | "embedded"
            | "stale"
            | "failed";
          created_at?: string;
        },
        Record<string, unknown>
      >;
      prompt_templates: TableDefinition<
        {
          id: string;
          purpose: string;
          language: string;
          channel: string;
          tone: string;
          template_body: string;
          variables: string[];
          version: number;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          purpose: string;
          language: string;
          channel: string;
          tone?: string;
          template_body: string;
          variables?: string[];
          version?: number;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        Record<string, unknown>
      >;
      content_generations: TableDefinition<
        {
          id: string;
          product_id: string;
          prompt_template_id: string | null;
          purpose: string;
          language: string;
          tone: string;
          channel: string | null;
          length_rule: string | null;
          factuality_mode: "strict" | "normal" | "creative";
          forbidden_terms: string[];
          generated_text: string | null;
          edited_text: string | null;
          rag_context: Json;
          prompt_used: string | null;
          model: string | null;
          token_usage: Json;
          status:
            | "draft"
            | "generating"
            | "generated"
            | "editing"
            | "review_pending"
            | "approved"
            | "rejected"
            | "exported";
          created_by: string | null;
          reviewer_id: string | null;
          review_note: string | null;
          approved_at: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          product_id: string;
          prompt_template_id?: string | null;
          purpose: string;
          language: string;
          tone: string;
          channel?: string | null;
          length_rule?: string | null;
          factuality_mode?: "strict" | "normal" | "creative";
          forbidden_terms?: string[];
          generated_text?: string | null;
          edited_text?: string | null;
          rag_context?: Json;
          prompt_used?: string | null;
          model?: string | null;
          token_usage?: Json;
          status?:
            | "draft"
            | "generating"
            | "generated"
            | "editing"
            | "review_pending"
            | "approved"
            | "rejected"
            | "exported";
          created_by?: string | null;
          reviewer_id?: string | null;
          review_note?: string | null;
          approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        Record<string, unknown>
      >;
      image_generations: TableDefinition<
        {
          id: string;
          product_id: string;
          original_asset_id: string | null;
          concept: string;
          background_tone: string | null;
          aspect_ratio: string;
          preserve_rules: string[];
          exclude_elements: string[];
          prompt_used: string | null;
          model: string | null;
          generated_file_path: string | null;
          thumbnail_path: string | null;
          status:
            | "uploaded"
            | "preprocessing"
            | "ready"
            | "generating"
            | "generated"
            | "review_pending"
            | "approved"
            | "rejected"
            | "exported"
            | "failed";
          quality_score: number | null;
          created_by: string | null;
          reviewer_id: string | null;
          review_note: string | null;
          approved_at: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          product_id: string;
          original_asset_id?: string | null;
          concept: string;
          background_tone?: string | null;
          aspect_ratio?: string;
          preserve_rules?: string[];
          exclude_elements?: string[];
          prompt_used?: string | null;
          model?: string | null;
          generated_file_path?: string | null;
          thumbnail_path?: string | null;
          status?:
            | "uploaded"
            | "preprocessing"
            | "ready"
            | "generating"
            | "generated"
            | "review_pending"
            | "approved"
            | "rejected"
            | "exported"
            | "failed";
          quality_score?: number | null;
          created_by?: string | null;
          reviewer_id?: string | null;
          review_note?: string | null;
          approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        Record<string, unknown>
      >;
      review_events: TableDefinition<
        {
          id: string;
          target_type: "source_document" | "content" | "image";
          target_id: string;
          action: "approved" | "approved_with_edit" | "rejected" | "duplicate";
          reviewer_id: string;
          note: string | null;
          previous_status: string | null;
          new_status: string | null;
          created_at: string;
        },
        {
          id?: string;
          target_type: "source_document" | "content" | "image";
          target_id: string;
          action: "approved" | "approved_with_edit" | "rejected" | "duplicate";
          reviewer_id: string;
          note?: string | null;
          previous_status?: string | null;
          new_status?: string | null;
          created_at?: string;
        },
        Record<string, unknown>
      >;
      audit_logs: TableDefinition<
        {
          id: string;
          user_id: string | null;
          action: string;
          target_type: string | null;
          target_id: string | null;
          detail: Json;
          ip_address: string | null;
          created_at: string;
        },
        {
          id?: string;
          user_id?: string | null;
          action: string;
          target_type?: string | null;
          target_id?: string | null;
          detail?: Json;
          ip_address?: string | null;
          created_at?: string;
        },
        Record<string, unknown>
      >;
      jobs: TableDefinition<
        {
          id: string;
          job_type:
            | "crawl"
            | "embed"
            | "generate_text"
            | "generate_image"
            | "export";
          target_type: string | null;
          target_id: string | null;
          target_name: string | null;
          status:
            | "queued"
            | "running"
            | "retrying"
            | "completed"
            | "failed"
            | "canceled";
          progress: number | null;
          attempt: number | null;
          max_attempts: number | null;
          last_error: string | null;
          error_detail_id: string | null;
          idempotency_key: string | null;
          next_retry_at: string | null;
          started_at: string | null;
          completed_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          job_type:
            | "crawl"
            | "embed"
            | "generate_text"
            | "generate_image"
            | "export";
          target_type?: string | null;
          target_id?: string | null;
          target_name?: string | null;
          status?:
            | "queued"
            | "running"
            | "retrying"
            | "completed"
            | "failed"
            | "canceled";
          progress?: number | null;
          attempt?: number | null;
          max_attempts?: number | null;
          last_error?: string | null;
          error_detail_id?: string | null;
          idempotency_key?: string | null;
          next_retry_at?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        Record<string, unknown>
      >;
    };
    Views: Record<string, never>;
    Functions: {
      get_user_role: {
        Args: Record<string, never>;
        Returns: string | null;
      };
      has_user_role: {
        Args: { allowed_roles: string[] };
        Returns: boolean;
      };
      match_embeddings: {
        Args: {
          query_embedding: string;
          match_threshold?: number;
          match_count?: number;
          filter_product_id?: string | null;
        };
        Returns: {
          id: string;
          chunk_id: string;
          product_id: string;
          content: string;
          similarity: number;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
