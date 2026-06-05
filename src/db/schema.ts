// Drizzle schema — FROZEN. Single source of truth for the DB.
import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  uuid,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const events = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    source: text("source").notNull(),
    sourceId: text("source_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    url: text("url").notNull(),
    imageUrl: text("image_url"),
    venue: text("venue"),
    neighborhood: text("neighborhood"),
    startTime: timestamp("start_time", { withTimezone: true }),
    endTime: timestamp("end_time", { withTimezone: true }),
    isFree: boolean("is_free").default(false).notNull(),
    priceMin: integer("price_min"), // cents
    priceMax: integer("price_max"), // cents
    category: text("category").default("other").notNull(),
    tags: jsonb("tags").$type<string[]>().default([]).notNull(),
    raw: jsonb("raw"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    srcUnique: uniqueIndex("events_source_sourceid_idx").on(t.source, t.sourceId),
    startIdx: index("events_start_time_idx").on(t.startTime),
  })
);

export const profiles = pgTable("profiles", {
  id: text("id").primaryKey(), // 'me'
  interests: jsonb("interests").$type<string[]>().default([]).notNull(),
  vibe: text("vibe").default("").notNull(),
  neighborhoods: jsonb("neighborhoods").$type<string[]>().default([]).notNull(),
  priceMaxCents: integer("price_max_cents"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const matchCache = pgTable(
  "match_cache",
  {
    eventId: uuid("event_id").notNull(),
    profileHash: text("profile_hash").notNull(),
    score: integer("score").notNull(),
    reason: text("reason").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: uniqueIndex("match_cache_pk").on(t.eventId, t.profileHash),
  })
);

export const interactions = pgTable("interactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id").notNull(),
  action: text("action").notNull(), // 'save' | 'dismiss' | 'going'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
