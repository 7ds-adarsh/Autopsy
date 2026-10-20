CREATE TABLE "pipeline_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid NOT NULL,
	"monitor_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"status" text NOT NULL,
	"detail" text,
	"payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pipeline_events" ADD CONSTRAINT "pipeline_events_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_events" ADD CONSTRAINT "pipeline_events_monitor_id_api_monitors_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."api_monitors"("id") ON DELETE cascade ON UPDATE no action;