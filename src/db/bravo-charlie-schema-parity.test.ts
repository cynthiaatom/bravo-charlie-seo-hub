import { getTableColumns, getTableName, is, Table } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import * as sqlite from "./bravo-charlie.schema";
import * as pg from "./pg/bravo-charlie.schema";

function tablesFrom(mod: Record<string, unknown>) {
  const out = new Map<string, Table>();
  for (const value of Object.values(mod)) {
    if (is(value, Table)) out.set(getTableName(value), value);
  }
  return out;
}

function shape(table: Table) {
  return Object.values(getTableColumns(table))
    .map((column) => ({ name: column.name, notNull: column.notNull, dataType: column.dataType }))
    .toSorted((a, b) => a.name.localeCompare(b.name));
}

describe("Bravo Charlie D1/Postgres schema parity", () => {
  const sqliteTables = tablesFrom(sqlite);
  const pgTables = tablesFrom(pg);

  it("defines the same table set", () => {
    expect([...pgTables.keys()].toSorted()).toEqual([...sqliteTables.keys()].toSorted());
  });

  for (const [name, sqliteTable] of sqliteTables) {
    it(`${name} has matching columns`, () => {
      const pgTable = pgTables.get(name);
      expect(pgTable).toBeDefined();
      if (pgTable) expect(shape(pgTable)).toEqual(shape(sqliteTable));
    });
  }
});
