CREATE TYPE "public"."audit_outcome" AS ENUM('success', 'failure');--> statement-breakpoint
CREATE TYPE "public"."competency_type" AS ENUM('core', 'technical', 'generic', 'digital', 'entrepreneurial');--> statement-breakpoint
CREATE TYPE "public"."locale" AS ENUM('en', 'ar');--> statement-breakpoint
CREATE TYPE "public"."occupation_level" AS ENUM('major_group', 'sub_major_group', 'minor_group', 'unit_group', 'occupation');--> statement-breakpoint
CREATE TYPE "public"."record_status" AS ENUM('draft', 'in_review', 'approved', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."template_kind" AS ENUM('curriculum', 'unit', 'document');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" uuid,
	"actor_email" varchar(254),
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(30),
	"entity_id" uuid,
	"outcome" "audit_outcome" DEFAULT 'success' NOT NULL,
	"ip" "inet",
	"user_agent" varchar(400),
	"request_id" varchar(64),
	"changes" jsonb,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "competencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"title_en" varchar(300) NOT NULL,
	"title_ar" varchar(300) NOT NULL,
	"description_en" text,
	"description_ar" text,
	"type" "competency_type" NOT NULL,
	"framework_level_id" uuid,
	"performance_criteria_en" text,
	"performance_criteria_ar" text,
	"status" "record_status" DEFAULT 'draft' NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"row_version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "curricula" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"previous_version_id" uuid,
	"title_en" varchar(300) NOT NULL,
	"title_ar" varchar(300) NOT NULL,
	"summary_en" text,
	"summary_ar" text,
	"occupation_id" uuid,
	"framework_level_id" uuid,
	"institution_id" uuid,
	"template_id" uuid,
	"program_type_code" varchar(50),
	"duration_months" integer DEFAULT 0 NOT NULL,
	"effective_from" date,
	"sections" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "record_status" DEFAULT 'draft' NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"row_version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "curriculum_units" (
	"curriculum_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"term" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_mandatory" boolean DEFAULT true NOT NULL,
	CONSTRAINT "curriculum_units_curriculum_id_unit_id_pk" PRIMARY KEY("curriculum_id","unit_id")
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"original_name" varchar(255) NOT NULL,
	"mime_type" varchar(120) NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"storage_key" varchar(200) NOT NULL,
	"entity_type" varchar(30),
	"entity_id" uuid,
	"uploaded_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "framework_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"framework_id" uuid NOT NULL,
	"level" integer NOT NULL,
	"name_en" varchar(300) NOT NULL,
	"name_ar" varchar(300) NOT NULL,
	"knowledge_en" text,
	"knowledge_ar" text,
	"skills_en" text,
	"skills_ar" text,
	"autonomy_en" text,
	"autonomy_ar" text,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"row_version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "frameworks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name_en" varchar(300) NOT NULL,
	"name_ar" varchar(300) NOT NULL,
	"description" text,
	"version_label" varchar(30) DEFAULT '1.0' NOT NULL,
	"status" "record_status" DEFAULT 'draft' NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"row_version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "institutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name_en" varchar(300) NOT NULL,
	"name_ar" varchar(300) NOT NULL,
	"type_code" varchar(50),
	"governorate_code" varchar(50),
	"address" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"row_version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"code" varchar(30) NOT NULL,
	"text_en" text NOT NULL,
	"text_ar" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title_en" varchar(300) NOT NULL,
	"title_ar" varchar(300) NOT NULL,
	"link" varchar(500),
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "occupation_competencies" (
	"occupation_id" uuid NOT NULL,
	"competency_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "occupation_competencies_occupation_id_competency_id_pk" PRIMARY KEY("occupation_id","competency_id")
);
--> statement-breakpoint
CREATE TABLE "occupations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"title_en" varchar(300) NOT NULL,
	"title_ar" varchar(300) NOT NULL,
	"description_en" text,
	"description_ar" text,
	"level" "occupation_level" NOT NULL,
	"parent_id" uuid,
	"isco_code" varchar(10),
	"sector_code" varchar(50),
	"status" "record_status" DEFAULT 'draft' NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"row_version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "occupations_not_self_parent" CHECK ("occupations"."parent_id" IS NULL OR "occupations"."parent_id" <> "occupations"."id")
);
--> statement-breakpoint
CREATE TABLE "reference_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"code" varchar(50) NOT NULL,
	"label_en" varchar(300) NOT NULL,
	"label_ar" varchar(300) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"row_version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reference_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name_en" varchar(300) NOT NULL,
	"name_ar" varchar(300) NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"row_version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"family_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"replaced_by_id" uuid,
	"ip" "inet",
	"user_agent" varchar(400),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name_en" varchar(100) NOT NULL,
	"name_ar" varchar(100) NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"permissions" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"row_version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name_en" varchar(300) NOT NULL,
	"name_ar" varchar(300) NOT NULL,
	"description_en" text,
	"description_ar" text,
	"kind" "template_kind" NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "record_status" DEFAULT 'draft' NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"row_version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unit_competencies" (
	"unit_id" uuid NOT NULL,
	"competency_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unit_competencies_unit_id_competency_id_pk" PRIMARY KEY("unit_id","competency_id")
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"title_en" varchar(300) NOT NULL,
	"title_ar" varchar(300) NOT NULL,
	"description_en" text,
	"description_ar" text,
	"framework_level_id" uuid,
	"credit_hours" numeric(5, 1) DEFAULT 0 NOT NULL,
	"theory_hours" integer DEFAULT 0 NOT NULL,
	"practical_hours" integer DEFAULT 0 NOT NULL,
	"assessment_en" text,
	"assessment_ar" text,
	"status" "record_status" DEFAULT 'draft' NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"row_version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "units_hours_nonneg" CHECK ("units"."theory_hours" >= 0 AND "units"."practical_hours" >= 0)
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(254) NOT NULL,
	"full_name_en" varchar(200) NOT NULL,
	"full_name_ar" varchar(200) NOT NULL,
	"password_hash" text,
	"external_subject" varchar(255),
	"institution_id" uuid,
	"locale" "locale" DEFAULT 'ar' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"password_changed_at" timestamp with time zone,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"row_version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" varchar(30) NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" varchar(30) NOT NULL,
	"from_status" "record_status",
	"to_status" "record_status" NOT NULL,
	"comment" text,
	"actor_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "competencies" ADD CONSTRAINT "competencies_framework_level_id_framework_levels_id_fk" FOREIGN KEY ("framework_level_id") REFERENCES "public"."framework_levels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curricula" ADD CONSTRAINT "curricula_occupation_id_occupations_id_fk" FOREIGN KEY ("occupation_id") REFERENCES "public"."occupations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curricula" ADD CONSTRAINT "curricula_framework_level_id_framework_levels_id_fk" FOREIGN KEY ("framework_level_id") REFERENCES "public"."framework_levels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curricula" ADD CONSTRAINT "curricula_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curricula" ADD CONSTRAINT "curricula_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curricula" ADD CONSTRAINT "curricula_previous_version_fk" FOREIGN KEY ("previous_version_id") REFERENCES "public"."curricula"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_units" ADD CONSTRAINT "curriculum_units_curriculum_id_curricula_id_fk" FOREIGN KEY ("curriculum_id") REFERENCES "public"."curricula"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_units" ADD CONSTRAINT "curriculum_units_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framework_levels" ADD CONSTRAINT "framework_levels_framework_id_frameworks_id_fk" FOREIGN KEY ("framework_id") REFERENCES "public"."frameworks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_outcomes" ADD CONSTRAINT "learning_outcomes_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupation_competencies" ADD CONSTRAINT "occupation_competencies_occupation_id_occupations_id_fk" FOREIGN KEY ("occupation_id") REFERENCES "public"."occupations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupation_competencies" ADD CONSTRAINT "occupation_competencies_competency_id_competencies_id_fk" FOREIGN KEY ("competency_id") REFERENCES "public"."competencies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupations" ADD CONSTRAINT "occupations_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."occupations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_items" ADD CONSTRAINT "reference_items_list_id_reference_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."reference_lists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_competencies" ADD CONSTRAINT "unit_competencies_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_competencies" ADD CONSTRAINT "unit_competencies_competency_id_competencies_id_fk" FOREIGN KEY ("competency_id") REFERENCES "public"."competencies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_framework_level_id_framework_levels_id_fk" FOREIGN KEY ("framework_level_id") REFERENCES "public"."framework_levels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_events" ADD CONSTRAINT "workflow_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_logs_occurred_idx" ON "audit_logs" USING btree ("occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "competencies_code_uq" ON "competencies" USING btree (lower("code"));--> statement-breakpoint
CREATE INDEX "competencies_title_trgm" ON "competencies" USING gin ("title_en" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "curricula_code_version_uq" ON "curricula" USING btree (lower("code"),"version");--> statement-breakpoint
CREATE INDEX "curricula_status_idx" ON "curricula" USING btree ("status");--> statement-breakpoint
CREATE INDEX "curricula_institution_idx" ON "curricula" USING btree ("institution_id");--> statement-breakpoint
CREATE INDEX "curricula_occupation_idx" ON "curricula" USING btree ("occupation_id");--> statement-breakpoint
CREATE INDEX "curricula_title_trgm" ON "curricula" USING gin ("title_en" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "curriculum_units_unit_idx" ON "curriculum_units" USING btree ("unit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "files_storage_key_uq" ON "files" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "files_entity_idx" ON "files" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "framework_levels_fw_level_uq" ON "framework_levels" USING btree ("framework_id","level");--> statement-breakpoint
CREATE UNIQUE INDEX "frameworks_code_uq" ON "frameworks" USING btree (lower("code"));--> statement-breakpoint
CREATE UNIQUE INDEX "institutions_code_uq" ON "institutions" USING btree (lower("code"));--> statement-breakpoint
CREATE UNIQUE INDEX "learning_outcomes_unit_code_uq" ON "learning_outcomes" USING btree ("unit_id","code");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "occ_comp_comp_idx" ON "occupation_competencies" USING btree ("competency_id");--> statement-breakpoint
CREATE UNIQUE INDEX "occupations_code_uq" ON "occupations" USING btree (lower("code"));--> statement-breakpoint
CREATE INDEX "occupations_parent_idx" ON "occupations" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "occupations_title_trgm" ON "occupations" USING gin ("title_en" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "reference_items_list_code_uq" ON "reference_items" USING btree ("list_id",lower("code"));--> statement-breakpoint
CREATE UNIQUE INDEX "reference_lists_code_uq" ON "reference_lists" USING btree (lower("code"));--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_tokens_hash_uq" ON "refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_family_idx" ON "refresh_tokens" USING btree ("family_id");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_code_uq" ON "roles" USING btree (lower("code"));--> statement-breakpoint
CREATE UNIQUE INDEX "templates_code_uq" ON "templates" USING btree (lower("code"));--> statement-breakpoint
CREATE INDEX "unit_comp_comp_idx" ON "unit_competencies" USING btree ("competency_id");--> statement-breakpoint
CREATE UNIQUE INDEX "units_code_uq" ON "units" USING btree (lower("code"));--> statement-breakpoint
CREATE INDEX "units_title_trgm" ON "units" USING gin ("title_en" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "user_roles_role_idx" ON "user_roles" USING btree ("role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "users_external_subject_uq" ON "users" USING btree ("external_subject");--> statement-breakpoint
CREATE INDEX "workflow_events_entity_idx" ON "workflow_events" USING btree ("entity_type","entity_id","occurred_at");