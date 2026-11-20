import type { Evidence } from "./evidence";

// Evidence for the questions in `customQuestions.ts`.
// Quotes are short excerpts from the dbt docs. Runs were made on dbt-core 1.11.17 with dbt-duckdb 1.11.1.
const RUN_VERSION = "1.11";

export const customEvidence: Record<number, Evidence> = {
  9001: {
    quotes: [
      {
        page: "versions",
        url: "https://docs.getdbt.com/reference/resource-properties/versions",
        text: "to include or exclude in a versioned implementation of that model",
      },
    ],
    run: {
      dbtVersion: RUN_VERSION,
      commands: [
        "# models/dim_customers_v1.sql, models/dim_customers_v2.sql, and the YAML of the question with `include: all` and `exclude: [country_name]`",
        "dbt parse",
        "# read the columns of each version in target/manifest.json",
      ],
      observed:
        "dbt parse exits with code 0. manifest.json: dim_customers.v2 has columns ['customer_id', 'country_name']; dim_customers.v1 has columns ['customer_id', 'country'].",
    },
  },
  9002: {
    quotes: [
      {
        page: "deprecation_date",
        url: "https://docs.getdbt.com/reference/resource-properties/deprecation_date",
        text: "the deprecation date has passed, a warning is generated",
      },
    ],
    run: {
      dbtVersion: RUN_VERSION,
      commands: [
        "# dim_customers with versions 1 and 2, latest_version: 2, deprecation_date: 2026-01-01 on version 1; fct_orders selects from ref('dim_customers', v=1); run on 2026-11-20",
        "dbt run",
      ],
      observed:
        "'[WARNING]: Model dim_customers.v1 has passed its deprecation date of 2026-01-01T00:00:00+01:00. This model should be disabled or removed.' and \"[WARNING]: While compiling 'fct_orders': Found a reference to dim_customers.v1, which was deprecated on '2026-01-01T00:00:00+01:00'.\" Then '1 of 3 OK created sql view model dev.dim_customers_v1', '2 of 3 OK created sql view model dev.dim_customers_v2', '3 of 3 OK created sql view model dev.fct_orders', Done. PASS=3 WARN=0 ERROR=0 SKIP=0, exit code 0.",
    },
  },
  9003: {
    quotes: [
      {
        page: "Model contracts",
        url: "https://docs.getdbt.com/docs/mesh/govern/model-contracts",
        text: "Materializing your model as `table` or `incremental` (**not** `view` or `ephemeral`).",
      },
    ],
    run: {
      dbtVersion: RUN_VERSION,
      commands: [
        "# YAML of the question; dim_customers.sql: select cast(null as int) as customer_id",
        "dbt run",
        "# change the SQL to: select 'a' as customer_id",
        "dbt run",
        "# change the SQL back, set materialized: table",
        "dbt run",
      ],
      observed:
        "View with a null value: '[WARNING]: Constraint types are not supported for view materializations and will be ignored.', then 'OK created sql view model dev.dim_customers', exit code 0. View with a varchar column: 'This model has an enforced contract that failed ... | customer_id | VARCHAR | INTEGER | data type mismatch |', exit code 1. Table with a null value: 'Constraint Error: NOT NULL constraint failed', exit code 1.",
    },
  },
  9004: {
    quotes: [
      {
        page: "constraints",
        url: "https://docs.getdbt.com/reference/resource-properties/constraints",
        text: "`columns` (model-level only): List of column names to apply the constraint over.",
      },
    ],
    run: {
      dbtVersion: RUN_VERSION,
      commands: [
        "# fct_order_lines: table, contract enforced, model-level constraint type primary_key with columns [order_id, line_id]",
        "dbt run",
        "grep -i 'primary key' target/run/sandbox/models/fct_order_lines.sql",
        "# move the constraint: a column-level primary_key on order_id and another on line_id",
        "dbt run",
      ],
      observed:
        "Model-level constraint: 'OK created sql table model dev.fct_order_lines', and the DDL contains 'primary key (order_id, line_id)'. Two column-level primary_key constraints: 'Parsing Error: Primary key constraint error', exit code 2.",
    },
  },
  9005: {
    quotes: [
      {
        page: "severity, error_if, and warn_if",
        url: "https://docs.getdbt.com/reference/resource-configs/severity",
        text: "`error_if`: conditional expression (default: `!=0`)",
      },
    ],
    run: {
      dbtVersion: RUN_VERSION,
      commands: [
        "# stg_orders returns 5 rows, 3 with a null order_id; not_null test with severity: error, warn_if: '>0', error_if: '>10'; fct_orders selects from stg_orders",
        "dbt build",
        "# change error_if to '>2'",
        "dbt build",
      ],
      observed:
        "error_if '>10': '2 of 3 WARN 3 not_null_stg_orders_order_id', '3 of 3 OK created sql view model dev.fct_orders', Done. PASS=2 WARN=1 ERROR=0 SKIP=0, exit code 0. error_if '>2': '2 of 3 FAIL 3 not_null_stg_orders_order_id', '3 of 3 SKIP relation dev.fct_orders', Done. PASS=1 WARN=0 ERROR=1 SKIP=1, exit code 1.",
    },
  },
  9006: {
    quotes: [
      {
        page: "Test selection examples",
        url: "https://docs.getdbt.com/reference/node-selection/test-selection-examples",
        text: "tests can also be selected _indirectly_ through relationships in your DAG",
      },
    ],
    run: {
      dbtVersion: RUN_VERSION,
      commands: [
        "# stg_orders returns one row with a null order_id and has a not_null test; fct_orders selects from stg_orders",
        "dbt run --select stg_orders",
        "dbt build --select fct_orders",
        "dbt build --select +fct_orders",
      ],
      observed:
        "--select fct_orders: '1 of 1 OK created sql view model dev.fct_orders', Done. PASS=1 WARN=0 ERROR=0 SKIP=0 TOTAL=1, exit code 0. --select +fct_orders: '2 of 3 FAIL 1 not_null_stg_orders_order_id', '3 of 3 SKIP relation dev.fct_orders', exit code 1.",
    },
  },
  9007: {
    quotes: [
      {
        page: "About dbt run command",
        url: "https://docs.getdbt.com/reference/commands/run",
        text: "The `dbt run` command only applies to models.",
      },
    ],
    run: {
      dbtVersion: RUN_VERSION,
      commands: [
        "# empty schema; seeds/raw_orders.csv; stg_orders selects from ref('raw_orders'); fct_orders selects from ref('stg_orders'); stg_customers: select 1 as customer_id",
        "dbt run",
        "dbt build",
      ],
      observed:
        "dbt run: '1 of 3 OK created sql view model dev.stg_customers', '2 of 3 ERROR creating sql view model dev.stg_orders' (Catalog Error: Table with name raw_orders does not exist!), '3 of 3 SKIP relation dev.fct_orders', exit code 1. dbt build: the seed is loaded before stg_orders, Done. PASS=4 WARN=0 ERROR=0 SKIP=0, exit code 0.",
    },
  },
  9008: {
    quotes: [
      {
        page: "About dbt clone command",
        url: "https://docs.getdbt.com/reference/commands/clone",
        text: "clones selected nodes from the specified state to the target schema(s)",
      },
    ],
    run: {
      dbtVersion: RUN_VERSION,
      commands: [
        "# fct_orders built as a table with --target prod; its target/manifest.json copied to prod-artifacts/",
        "dbt clone --select fct_orders",
        "dbt clone --select fct_orders --state prod-artifacts",
        "dbt clone --select fct_orders --defer-state prod-artifacts --full-refresh",
      ],
      observed:
        "Without a state path: 'Runtime Error: --state or --defer-state are required for deferral, but neither was provided', exit code 2. With --state: Done. PASS=1, exit code 0, and dev.fct_orders exists (a view on DuckDB, which cannot clone tables). With --defer-state: Done. PASS=1, exit code 0.",
    },
  },
  9009: {
    quotes: [
      {
        page: "Add Exposures to your DAG",
        url: "https://docs.getdbt.com/docs/build/exposures",
        text: "**owner**: `name` or `email` required; additional properties allowed",
      },
    ],
    run: {
      dbtVersion: RUN_VERSION,
      commands: [
        "# the exposure of the question, without an owner",
        "dbt parse",
        "# add owner: {name: Ana}",
        "dbt parse",
        "# replace the owner with owner: {email: ana@example.com}",
        "dbt parse",
      ],
      observed:
        "Without an owner: 'Parsing Error: Invalid exposures config given in ... models/e.yml', exit code 2. With an owner that has only a name: exit code 0. With an owner that has only an email: exit code 0.",
    },
  },
  9010: {
    quotes: [],
    run: {
      dbtVersion: RUN_VERSION,
      commands: [
        "# models stg_orders and fct_orders exist; the exposure weekly_kpis has depends_on: [ref('fct_revenue')], and no model fct_revenue exists",
        "dbt run --select stg_orders",
      ],
      observed:
        "Compilation Error: Exposure 'exposure.sandbox.weekly_kpis' (models/e.yml) depends on a node named 'fct_revenue' which was not found. Exit code 2, and no model is run.",
    },
  },
  9011: {
    quotes: [
      {
        page: "About dbt source command",
        url: "https://docs.getdbt.com/reference/commands/source",
        text: "To check freshness for a subset of these sources, use the `--select` flag.",
      },
    ],
    run: {
      dbtVersion: RUN_VERSION,
      commands: [
        "# source shop with the tables orders and payments, both with a freshness config",
        'dbt source freshness --select "source:shop.orders"',
        'dbt source freshness --select "shop.orders"',
        'dbt source freshness --select "source:shop"',
      ],
      observed:
        "source:shop.orders: '1 of 1 ... freshness of shop.orders', one source checked. shop.orders without the method: \"The selection criterion 'shop.orders' does not match any enabled nodes\", nothing checked. source:shop: both tables checked, '1 of 2' and '2 of 2'.",
    },
  },
  9012: {
    quotes: [
      {
        page: "Add sources to your DAG",
        url: "https://docs.getdbt.com/docs/build/sources",
        text: "To obtain freshness information for your sources, use the `dbt source freshness` command",
      },
    ],
    run: {
      dbtVersion: RUN_VERSION,
      commands: [
        "# source shop.orders with loaded_at_field and error_after: {count: 2, period: day}; newest loaded_at value is from 2020; stg_orders selects from the source",
        "dbt source freshness",
        "dbt build",
      ],
      observed:
        "dbt source freshness: 'ERROR STALE freshness of shop.orders', exit code 1. dbt build: 'OK created sql view model dev.stg_orders', no freshness line in the log, Done. PASS=3 WARN=0 ERROR=0 SKIP=0, exit code 0.",
    },
  },
  9013: {
    quotes: [
      {
        page: "About state in dbt",
        url: "https://docs.getdbt.com/reference/node-selection/state-selection",
        text: "as long as their file path is passed to the `--state` flag",
      },
    ],
    run: {
      dbtVersion: RUN_VERSION,
      commands: ["dbt ls --select state:modified --resource-type model"],
      observed: "Runtime Error: Got a state selector method, but no comparison manifest. Exit code 2.",
    },
  },
  9014: {
    quotes: [
      {
        page: "Caveats to state comparison",
        url: "https://docs.getdbt.com/reference/node-selection/state-comparison-caveats",
        text: "treated as a modification, but only when `persist_docs` is enabled",
      },
    ],
    run: {
      dbtVersion: RUN_VERSION,
      commands: [
        "# project built once; target/manifest.json copied to prod-state/; persist_docs not set",
        "dbt ls --select state:modified --state prod-state --resource-type model",
        "# change only the description of stg_orders in its YAML file",
        "dbt ls --select state:modified --state prod-state --resource-type model",
      ],
      observed:
        "Before the change: \"The selection criterion 'state:modified' does not match any enabled nodes\", No nodes selected! After the description change: the same output, No nodes selected!",
    },
  },
  9015: {
    quotes: [
      {
        page: "Node selector methods",
        url: "https://docs.getdbt.com/reference/node-selection/methods",
        text: "`state:modified.macros`: Changes to upstream macros (whether called directly or indirectly by another macro)",
      },
    ],
    run: {
      dbtVersion: RUN_VERSION,
      commands: [
        "# stg_payments calls the macro cents_to_dollars; fct_orders selects from stg_orders and stg_payments; dim_customers has no parents; target/manifest.json copied to prod-state/",
        "# change only the body of the macro cents_to_dollars",
        "dbt ls --select state:modified --state prod-state --resource-type model",
        'dbt ls --select "state:modified+" --state prod-state --resource-type model',
        'dbt ls --select "state:modified.body" --state prod-state --resource-type model',
      ],
      observed:
        "state:modified: sandbox.stg_payments. state:modified+: sandbox.fct_orders and sandbox.stg_payments. state:modified.body: No nodes selected!",
    },
  },
  9016: {
    quotes: [
      {
        page: "Defer",
        url: "https://docs.getdbt.com/reference/node-selection/defer",
        text: "When `--favor-state` is passed, dbt prioritizes node definitions from the `--state` directory.",
      },
    ],
    run: {
      dbtVersion: RUN_VERSION,
      commands: [
        "# all models built in the schemas prod and dev; the prod manifest.json copied to prod-state/",
        "dbt compile --select fct_orders --defer --state prod-state",
        "dbt compile --select fct_orders --defer --favor-state --state prod-state",
        "# read target/compiled/sandbox/models/fct_orders.sql after each command",
      ],
      observed:
        'With --defer only: from "db"."dev"."stg_orders". With --defer and --favor-state: from "db"."prod"."stg_orders". After dropping dev.stg_orders, --defer alone also resolves to "db"."prod"."stg_orders".',
    },
  },
};
