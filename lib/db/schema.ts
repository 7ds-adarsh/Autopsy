import { pgTable, uuid, text, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";

// 1. Users
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  githubId: text("github_id").notNull().unique(),
  username: text("username").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 2. Repositories
export const repositories = pgTable("repositories", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  githubRepoId: text("github_repo_id"),
  owner: text("owner").notNull(),
  name: text("name").notNull(),
  fullName: text("full_name").notNull(),
  installationId: text("installation_id"),
  defaultBranch: text("default_branch").default("main"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 3. API Monitors
export const apiMonitors = pgTable("api_monitors", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  repositoryId: uuid("repository_id").references(() => repositories.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  baseUrl: text("base_url").notNull(),
  endpoint: text("endpoint").notNull(),
  method: text("method").notNull().default("GET"), // 'GET' | 'POST'
  pathParams: jsonb("path_params"),
  queryParams: jsonb("query_params"),
  additionalHeaders: jsonb("additional_headers"),
  authType: text("auth_type").notNull().default("none"), // 'none' | 'api_key' | 'bearer'
  authHeaderName: text("auth_header_name"),
  discoverySource: text("discovery_source").default("manual"), // 'scan' | 'manual'
  discoveryConfidence: text("discovery_confidence"), // 'high' | 'medium' | 'low'
  monitoringEnabled: boolean("monitoring_enabled").default(true).notNull(),
  intervalMinutes: integer("interval_minutes").default(5).notNull(),
  lastCheckedAt: timestamp("last_checked_at"),
  lastStatus: text("last_status").default("pending"), // 'healthy' | 'incident' | 'error' | 'pending'
  activeBaselineId: uuid("active_baseline_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 4. API Credentials (stored isolated and encrypted, never joined by default)
export const apiCredentials = pgTable("api_credentials", {
  id: uuid("id").primaryKey().defaultRandom(),
  monitorId: uuid("monitor_id")
    .references(() => apiMonitors.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  encryptedValue: text("encrypted_value").notNull(), // "iv:tag:ciphertext"
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 5. Baselines
export const baselines = pgTable("baselines", {
  id: uuid("id").primaryKey().defaultRandom(),
  monitorId: uuid("monitor_id")
    .references(() => apiMonitors.id, { onDelete: "cascade" })
    .notNull(),
  responseBody: jsonb("response_body").notNull(),
  structureSummary: jsonb("structure_summary").notNull(),
  captureMethod: text("capture_method").notNull().default("live"), // 'live' | 'sample'
  capturedAt: timestamp("captured_at").defaultNow().notNull(),
});

// 6. Incidents
export const incidents = pgTable("incidents", {
  id: uuid("id").primaryKey().defaultRandom(),
  monitorId: uuid("monitor_id")
    .references(() => apiMonitors.id, { onDelete: "cascade" })
    .notNull(),
  baselineId: uuid("baseline_id").references(() => baselines.id, { onDelete: "set null" }),
  severity: text("severity").notNull(), // 'low' | 'medium' | 'high' | 'critical'
  diff: jsonb("diff").notNull(), // DiffResult
  isSimulation: boolean("is_simulation").default(false).notNull(),
  status: text("status").notNull().default("open"), // 'open' | 'investigating' | 'resolved'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 7. Autopsy Reports
export const autopsyReports = pgTable("autopsy_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  incidentId: uuid("incident_id")
    .references(() => incidents.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  whatChanged: text("what_changed").notNull(),
  applicationImpact: jsonb("application_impact").notNull(), // AffectedFile[]
  failurePath: jsonb("failure_path").notNull(), // FailureStep[]
  rootCause: text("root_cause").notNull(),
  recommendedFix: text("recommended_fix").notNull(),
  proposedPatch: text("proposed_patch"),
  confidence: text("confidence").notNull(), // 'high' | 'medium' | 'low'
  confidenceEvidence: jsonb("confidence_evidence").notNull(), // string[]
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Repository = typeof repositories.$inferSelect;
export type ApiMonitor = typeof apiMonitors.$inferSelect;
export type Baseline = typeof baselines.$inferSelect;
export type Incident = typeof incidents.$inferSelect;
export type AutopsyReport = typeof autopsyReports.$inferSelect;
