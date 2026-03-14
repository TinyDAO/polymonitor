import {
  pgTable,
  text,
  timestamp,
  uuid,
  decimal,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletAddress: text("wallet_address").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const kanbans = pgTable("kanbans", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const monitoredAddresses = pgTable(
  "monitored_addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kanbanId: uuid("kanban_id")
      .notNull()
      .references(() => kanbans.id, { onDelete: "cascade" }),
    address: text("address").notNull(),
    label: text("label").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("monitored_addresses_kanban_address").on(
      table.kanbanId,
      table.address
    ),
  ]
);

export const addressSnapshots = pgTable("address_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  addressId: uuid("address_id")
    .notNull()
    .references(() => monitoredAddresses.id, { onDelete: "cascade" }),
  polymarketValue: decimal("polymarket_value", { precision: 20, scale: 6 })
    .notNull()
    .default("0"),
  usdcBalance: decimal("usdc_balance", { precision: 20, scale: 6 })
    .notNull()
    .default("0"),
  totalValue: decimal("total_value", { precision: 20, scale: 6 })
    .notNull()
    .default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  kanbans: many(kanbans),
}));

export const kanbansRelations = relations(kanbans, ({ one, many }) => ({
  user: one(users),
  monitoredAddresses: many(monitoredAddresses),
}));

export const monitoredAddressesRelations = relations(
  monitoredAddresses,
  ({ one, many }) => ({
    kanban: one(kanbans),
    snapshots: many(addressSnapshots),
  })
);

export const addressSnapshotsRelations = relations(
  addressSnapshots,
  ({ one }) => ({
    monitoredAddress: one(monitoredAddresses),
  })
);
