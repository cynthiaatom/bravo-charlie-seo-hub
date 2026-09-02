import { getTableColumns, getTableName, is, Table } from "drizzle-orm";
import { getTableConfig as getPgTableConfig } from "drizzle-orm/pg-core";
import { getTableConfig as getSqliteTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import * as sqlite from "./bravo-charlie.schema";
import * as pg from "./pg/bravo-charlie.schema";

type Dialect = "sqlite" | "pg";

const sortStrings = (values: string[]) =>
  values.toSorted((a, b) => a.localeCompare(b));

function tablesFrom(mod: Record<string, unknown>) {
  const out = new Map<string, Table>();
  for (const value of Object.values(mod)) {
    if (is(value, Table)) out.set(getTableName(value), value);
  }
  return out;
}

const getConfig = (table: Table, dialect: Dialect) =>
  dialect === "pg" ? getPgTableConfig(table) : getSqliteTableConfig(table);

function columnShape(table: Table) {
  return Object.values(getTableColumns(table))
    .map((column) => ({
      name: column.name,
      notNull: column.notNull,
      dataType: column.dataType,
      hasDefault: column.hasDefault,
      enumValues: Array.isArray(column.enumValues)
        ? sortStrings(
            column.enumValues.filter(
              (value): value is string => typeof value === "string",
            ),
          )
        : null,
    }))
    .toSorted((a, b) => a.name.localeCompare(b.name));
}

function columnName(value: unknown): string | null {
  if (
    value &&
    typeof value === "object" &&
    "name" in value &&
    typeof value.name === "string"
  ) {
    return value.name;
  }
  return null;
}

function primaryKeys(table: Table, dialect: Dialect) {
  const keys = new Set<string>();
  for (const column of Object.values(getTableColumns(table))) {
    if (column.primary) keys.add(column.name);
  }
  for (const composite of getConfig(table, dialect).primaryKeys) {
    for (const column of composite.columns) keys.add(column.name);
  }
  return sortStrings([...keys]);
}

function uniqueConstraints(table: Table, dialect: Dialect) {
  const config = getConfig(table, dialect);
  const tuples = new Set<string>();
  for (const index of config.indexes) {
    if (!index.config.unique) continue;
    const columns = index.config.columns
      .map(columnName)
      .filter((name): name is string => name !== null);
    tuples.add(
      sortStrings(columns).join(",") +
        (index.config.where ? "|partial" : ""),
    );
  }
  for (const constraint of config.uniqueConstraints) {
    tuples.add(sortStrings(constraint.columns.map((column) => column.name)).join(","));
  }
  for (const column of Object.values(getTableColumns(table))) {
    if (column.isUnique) tuples.add(column.name);
  }
  return sortStrings([...tuples]);
}

function foreignKeys(table: Table, dialect: Dialect) {
  return sortStrings(
    getConfig(table, dialect).foreignKeys.map((foreignKey) => {
      const reference = foreignKey.reference();
      const columns = sortStrings(
        reference.columns.map((column) => column.name),
      ).join(",");
      const referencedTable = getTableName(reference.foreignTable);
      const referencedColumns = sortStrings(
        reference.foreignColumns.map((column) => column.name),
      ).join(",");
      return `${columns}->${referencedTable}.${referencedColumns} onDelete=${foreignKey.onDelete ?? "none"}`;
    }),
  );
}

describe("Bravo Charlie D1/Postgres schema parity", () => {
  const sqliteTables = tablesFrom(sqlite);
  const pgTables = tablesFrom(pg);

  it("defines the same table set", () => {
    expect(sortStrings([...pgTables.keys()])).toEqual(
      sortStrings([...sqliteTables.keys()]),
    );
  });

  for (const [name, sqliteTable] of sqliteTables) {
    describe(`table "${name}"`, () => {
      const pgTable = pgTables.get(name);

      it("exists in both dialects", () => {
        expect(pgTable).toBeDefined();
      });

      if (!pgTable) continue;

      it("has matching columns", () => {
        expect(columnShape(pgTable)).toEqual(columnShape(sqliteTable));
      });

      it("has matching primary keys", () => {
        expect(primaryKeys(pgTable, "pg")).toEqual(
          primaryKeys(sqliteTable, "sqlite"),
        );
      });

      it("has matching unique constraints", () => {
        expect(uniqueConstraints(pgTable, "pg")).toEqual(
          uniqueConstraints(sqliteTable, "sqlite"),
        );
      });

      it("has matching foreign keys", () => {
        expect(foreignKeys(pgTable, "pg")).toEqual(
          foreignKeys(sqliteTable, "sqlite"),
        );
      });
    });
  }
});
