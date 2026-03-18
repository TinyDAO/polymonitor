import {
  pgTable,
  text,
  timestamp,
  uuid,
  decimal,
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletAddress: text("wallet_address").notNull().unique(),
  points: integer("points").notNull().default(100),
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

export const kanbanInvitations = pgTable("kanban_invitations", {
  token: text("token").primaryKey(),
  kanbanId: uuid("kanban_id")
    .notNull()
    .references(() => kanbans.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const kanbanMembers = pgTable(
  "kanban_members",
  {
    kanbanId: uuid("kanban_id")
      .notNull()
      .references(() => kanbans.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("kanban_members_kanban_user").on(table.kanbanId, table.userId),
  ]
);

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
  kanbanMemberships: many(kanbanMembers),
}));

export const kanbansRelations = relations(kanbans, ({ one, many }) => ({
  user: one(users),
  monitoredAddresses: many(monitoredAddresses),
  invitations: many(kanbanInvitations),
  members: many(kanbanMembers),
}));

export const kanbanInvitationsRelations = relations(
  kanbanInvitations,
  ({ one }) => ({
    kanban: one(kanbans),
  })
);

export const kanbanMembersRelations = relations(kanbanMembers, ({ one }) => ({
  kanban: one(kanbans),
  user: one(users),
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
