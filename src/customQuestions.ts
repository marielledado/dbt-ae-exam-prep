import { Question } from "./types";

// Questions added in this fork (9001+). Each one has an entry in `customEvidence.ts`.
// Kept apart from `questions.ts` and `formatQuestions.ts` so that changes from the original repo merge without conflicts.
export const customQuestions: Question[] = [
  {
    id: 9001,
    format: "fill_blank",
    category: "Managing dbt models governance",
    difficulty: "Advanced",
    questionText:
      "Version 2 of `dim_customers` renames the column `country` to `country_name`. The top-level `columns` describe version 2. Complete the entry for version 1 so that it takes every top-level column except `country_name` and adds its own `country` column.",
    codeSnippet:
      "models:\n  - name: dim_customers\n    latest_version: 2\n    columns:\n      - name: customer_id\n        data_type: int\n      - name: country_name\n        data_type: varchar\n    versions:\n      - v: 2\n      - v: 1\n        columns:\n          - [[1]]: all\n            [[2]]: [country_name]\n          - name: country\n            data_type: varchar",
    codeLanguage: "yaml",
    blanks: [{ accepted: ["include"] }, { accepted: ["exclude"] }],
    explanation:
      "CORRECT ACTION:\nInside a version's `columns`, `include: all` takes the columns defined in the model's top-level `columns` property, and `exclude` lists the ones to leave out. Version 1 then declares `country` itself.\n\nCOMMON MISTAKES:\n- `select` and `except`: these are SQL words, not keys of the `versions` property.\n- `columns: all`: `columns` is the list that holds the `include` entry, not the key that takes `all`.\n- `inherit`: the `versions` property has no such key.",
    references: "https://docs.getdbt.com/reference/resource-properties/versions",
    dbtVersionFocus: "Model versions (include and exclude)",
  },
  {
    id: 9002,
    category: "Managing dbt models governance",
    difficulty: "Intermediate",
    questionText:
      "`dim_customers` has versions 1 and 2, with `latest_version: 2`. Version 1 sets `deprecation_date: 2026-01-01`, and that date has passed. `fct_orders` still selects from `{{ ref('dim_customers', v=1) }}`. No `--warn-error` flag and no `warn_error_options` are set. What happens on `dbt run`?",
    options: [
      "dbt raises a compilation error for `fct_orders`, because version 1 is deprecated.",
      "dbt logs deprecation warnings, and builds both versions and `fct_orders`.",
      "dbt skips version 1 and `fct_orders`, and builds version 2 only.",
      "dbt points `fct_orders` to version 2, because version 1 is deprecated.",
    ],
    correctAnswers: [1],
    explanation:
      "CORRECT ACTION:\nA passed `deprecation_date` generates warnings: one for the deprecated model, and one for each reference to it. The run still builds every selected model and exits with code 0. Promoting these warnings to errors takes `--warn-error` or `warn_error_options`.\n\nINCORRECT COMPETING OPTIONS:\n- A compilation error: the reference to a deprecated version is a warning, not an error, unless warnings are promoted to errors.\n- Skipping version 1 and `fct_orders`: a deprecation date does not disable a model or its children.\n- Pointing `fct_orders` to version 2: a pinned `ref` keeps resolving to the version it names.",
    references: "https://docs.getdbt.com/reference/resource-properties/deprecation_date",
    dbtVersionFocus: "Model versions (deprecation_date)",
  },
  {
    id: 9003,
    category: "Managing dbt models governance",
    difficulty: "Advanced",
    questionText:
      "`dim_customers` is materialized as a view and declares the properties below. Its SQL returns one row, in which `customer_id` is a null value of type integer. What happens on `dbt run --select dim_customers`?",
    codeSnippet:
      "models:\n  - name: dim_customers\n    config:\n      materialized: view\n      contract:\n        enforced: true\n    columns:\n      - name: customer_id\n        data_type: int\n        constraints:\n          - type: not_null",
    codeLanguage: "yaml",
    options: [
      "dbt fails the model, because the null `customer_id` violates the `not_null` constraint.",
      "dbt fails while parsing, because a contract cannot be enforced on a view.",
      "dbt checks the column name and data type, ignores the constraint, and builds the view.",
      "dbt builds the view without checking the column name, the data type or the constraint.",
    ],
    correctAnswers: [2],
    explanation:
      "CORRECT ACTION:\nAn enforced contract is supported on a view: dbt compares the names and data types the SQL returns with the ones in the YAML before it builds. Constraints are never applied on models materialized as `view`, so dbt logs a warning that the constraint is ignored, and the view is built with the null value.\n\nINCORRECT COMPETING OPTIONS:\n- Failing on the null value: that happens for a `table` or `incremental` model on a platform that enforces `not_null`, not for a view.\n- Failing while parsing: contracts are supported on models materialized as `view`.\n- Building without any check: the name and data type check of the contract still runs for a view. A wrong data type fails the model.",
    references: "https://docs.getdbt.com/docs/mesh/govern/model-contracts",
    dbtVersionFocus: "Model contracts and constraints on views",
  },
  {
    id: 9004,
    format: "fill_blank",
    category: "Managing dbt models governance",
    difficulty: "Intermediate",
    questionText:
      "Each row of `fct_order_lines` is identified by `order_id` and `line_id` together. The model is a table with an enforced contract. The `name` and `data_type` of each column are declared further down in the file and are not shown. Complete the model-level constraint so that the primary key covers both columns.",
    codeSnippet:
      "models:\n  - name: fct_order_lines\n    config:\n      materialized: table\n      contract:\n        enforced: true\n    constraints:\n      - type: primary_key\n        [[1]]: [order_id, line_id]",
    codeLanguage: "yaml",
    blanks: [{ accepted: ["columns"] }],
    explanation:
      "CORRECT ACTION:\nA model-level constraint takes `columns`, the list of column names to apply the constraint over. A primary key over more than one column must be defined at the model level.\n\nCOMMON MISTAKES:\n- `column`: the key is plural, also for a single column.\n- `keys` or `fields`: constraints have no such key.\n- A `primary_key` constraint on each of the two columns: dbt stops with a parsing error, because multiple `primary_key` constraints at the column level are not supported.",
    references: "https://docs.getdbt.com/reference/resource-properties/constraints",
    dbtVersionFocus: "Constraints (model level)",
  },
  {
    id: 9005,
    category: "Troubleshooting and optimizing dbt pipelines",
    difficulty: "Intermediate",
    questionText:
      "The `not_null` test on `stg_orders.order_id` has the config below and finds 3 null values today. `fct_orders` selects from `stg_orders`. What does `dbt build` do?",
    codeSnippet: 'data_tests:\n  - not_null:\n      config:\n        severity: error\n        warn_if: ">0"\n        error_if: ">10"',
    codeLanguage: "yaml",
    options: [
      "The test returns an error, and dbt skips `fct_orders`.",
      "The test returns an error, and dbt builds `fct_orders`.",
      "The test passes, and dbt builds `fct_orders`.",
      "The test returns a warning, and dbt builds `fct_orders`.",
    ],
    correctAnswers: [3],
    explanation:
      "CORRECT ACTION:\nWith `severity: error`, dbt checks `error_if` first. Three failures do not meet `>10`, so dbt then checks `warn_if`. Three failures meet `>0`, so the test returns a warning. A warning does not block downstream resources, so `fct_orders` is built.\n\nINCORRECT COMPETING OPTIONS:\n- An error and a skipped `fct_orders`: that is the result when the number of failures meets `error_if`, for example with `error_if: \">2\"`.\n- An error and a built `fct_orders`: in `dbt build`, a test that returns an error causes downstream resources to skip.\n- A passing test: three failures meet the `warn_if` condition, so the test does not pass.",
    references: "https://docs.getdbt.com/reference/resource-configs/severity",
    dbtVersionFocus: "Data test thresholds (warn_if and error_if)",
  },
  {
    id: 9006,
    category: "Troubleshooting and optimizing dbt pipelines",
    difficulty: "Intermediate",
    questionText:
      "`fct_orders` selects from `stg_orders`, which already exists in the target schema. The `not_null` test on `stg_orders.order_id` has severity `error` and would fail on today's data. You run `dbt build --select fct_orders`. What happens?",
    options: [
      "dbt builds `fct_orders`, because the test on `stg_orders` is not selected.",
      "dbt skips `fct_orders`, because the test on its parent fails.",
      "dbt runs the test first, then builds `fct_orders` with a warning.",
      "dbt rebuilds `stg_orders`, runs its test, and skips `fct_orders`.",
    ],
    correctAnswers: [0],
    explanation:
      "CORRECT ACTION:\n`--select fct_orders` selects `fct_orders` and the tests that depend on it. The `not_null` test depends on `stg_orders` only, so it is not selected and does not run. Nothing blocks `fct_orders`, and dbt builds it.\n\nINCORRECT COMPETING OPTIONS:\n- Skipping `fct_orders`: a test blocks downstream resources only when it is part of the run. `dbt build --select +fct_orders` would select it, and then `fct_orders` is skipped.\n- Running the test first: a test on an unselected parent is not selected indirectly through `fct_orders`.\n- Rebuilding `stg_orders`: the selection has no `+` before the model name, so ancestors are not selected.",
    references: "https://docs.getdbt.com/reference/node-selection/test-selection-examples",
    dbtVersionFocus: "dbt build and test selection",
  },
  {
    id: 9007,
    format: "hotspot",
    category: "Troubleshooting and optimizing dbt pipelines",
    difficulty: "Intermediate",
    questionText:
      "In a new, empty schema, the first command you run is `dbt run`. `raw_orders` is a seed, and `stg_orders` reads it with `ref`. `stg_customers` selects literal values and has no parents. All models are views. Select every model that dbt does not build.",
    target: {
      kind: "dag",
      nodes: [
        { id: "raw_orders", label: "seed: raw_orders", column: 0, row: 0 },
        { id: "stg_orders", label: "stg_orders", column: 1, row: 0 },
        { id: "stg_customers", label: "stg_customers", column: 1, row: 1 },
        { id: "fct_orders", label: "fct_orders", column: 2, row: 0 },
      ],
      edges: [
        ["raw_orders", "stg_orders"],
        ["stg_orders", "fct_orders"],
      ],
      correctNodes: ["stg_orders", "fct_orders"],
    },
    explanation:
      "CORRECT ACTION:\nThe `dbt run` command only applies to models, so the seed is not loaded and its table does not exist. `stg_orders` fails with a database error, and `fct_orders` is skipped because its parent failed. Running `dbt seed` first, or `dbt build` in place of `dbt run`, loads the seed before the models that read it.\n\nCOMMON MISTAKES:\n- `stg_customers`: it does not depend on the seed, so it is built.\n- `seed: raw_orders`: it is not loaded by `dbt run`, but it is a seed, not a model.",
    references: "https://docs.getdbt.com/reference/commands/run",
    dbtVersionFocus: "dbt run and seeds",
  },
  {
    id: 9008,
    format: "fill_blank",
    category: "Troubleshooting and optimizing dbt pipelines",
    difficulty: "Basic",
    questionText:
      "The folder `prod-artifacts` holds the `manifest.json` of the latest production run. Complete the command that clones the production `fct_orders` into your development schema.",
    codeSnippet: "dbt clone --select fct_orders [[1]] prod-artifacts",
    codeLanguage: "bash",
    blanks: [{ accepted: ["--state", "--defer-state"] }],
    explanation:
      "CORRECT ACTION:\n`dbt clone` clones selected nodes from the specified state to the target schema, so it needs the path to the artifacts of the environment to clone from. Without it, dbt stops with a runtime error that says `--state` or `--defer-state` is required.\n\nCOMMON MISTAKES:\n- `--defer`: it changes how `ref` resolves and takes no path.\n- `--target`: it names the output in `profiles.yml` to build into, not the artifacts to clone from.\n- `--from`: `dbt clone` has no such flag.",
    references: "https://docs.getdbt.com/reference/commands/clone",
    dbtVersionFocus: "dbt clone",
  },
  {
    id: 9009,
    category: "Implementing and maintaining external dependencies",
    difficulty: "Basic",
    questionText:
      "`dbt parse` fails on the exposure below with `Parsing Error: Invalid exposures config`. The model `fct_orders` exists. Which change makes the exposure valid?",
    codeSnippet: "exposures:\n  - name: weekly_kpis\n    type: dashboard\n    depends_on:\n      - ref('fct_orders')",
    codeLanguage: "yaml",
    options: [
      "Add a `maturity` of `high`.",
      "Add a `url` for the dashboard.",
      "Add an `owner` with a `name`.",
      "Add a `description` of the dashboard.",
    ],
    correctAnswers: [2],
    explanation:
      "CORRECT ACTION:\nAn exposure requires a `name`, a `type` and an `owner`, and the owner needs a `name` or an `email`. The exposure above has no `owner`, so dbt rejects it.\n\nINCORRECT COMPETING OPTIONS:\n- `maturity`: it is an optional property.\n- `url`: it is an optional property.\n- `description`: it is an optional property.",
    references: "https://docs.getdbt.com/docs/build/exposures",
    dbtVersionFocus: "Exposures (required properties)",
  },
  {
    id: 9010,
    category: "Implementing and maintaining external dependencies",
    difficulty: "Intermediate",
    questionText:
      "The exposure `weekly_kpis` lists `ref('fct_revenue')` under `depends_on`. A developer deletes the model `fct_revenue` and leaves the exposure unchanged. They then run `dbt run --select stg_orders`, a model that the exposure does not depend on. What happens?",
    options: [
      "dbt builds `stg_orders`, because the exposure is not selected.",
      "dbt stops with a compilation error about the node the exposure depends on.",
      "dbt builds `stg_orders` and logs a warning about the exposure.",
      "dbt builds `stg_orders` and disables the exposure for this run.",
    ],
    correctAnswers: [1],
    explanation:
      "CORRECT ACTION:\ndbt resolves every `ref` in the project while it parses, including the ones under an exposure's `depends_on`. The exposure depends on a node that is not found, so dbt stops with a compilation error before it runs anything, whatever the selection is.\n\nINCORRECT COMPETING OPTIONS:\n- Building because the exposure is not selected: the error is raised while dbt parses the project, before it applies the selection.\n- Logging a warning: a `ref` to a node that is not found is an error, not a warning.\n- Disabling the exposure: dbt does not disable a resource on its own. Setting `enabled: false` on the exposure, or fixing its `depends_on`, removes the error.",
    references: "https://docs.getdbt.com/reference/exposure-properties",
    dbtVersionFocus: "Exposures (depends_on)",
  },
  {
    id: 9011,
    format: "fill_blank",
    category: "Implementing and maintaining external dependencies",
    difficulty: "Intermediate",
    questionText:
      "The source `shop` has the tables `orders` and `payments`, and both have a `freshness` config. Complete the command so that dbt checks the freshness of `orders` only.",
    codeSnippet: 'dbt source freshness --select "[[1]]:[[2]]"',
    codeLanguage: "bash",
    blanks: [{ accepted: ["source"] }, { accepted: ["shop.orders"] }],
    explanation:
      "CORRECT ACTION:\nThe `source` method selects sources. `source:shop.orders` names one table of the source `shop`, and `source:shop` would select every table of that source.\n\nCOMMON MISTAKES:\n- `shop.orders` without the method: the selection matches no node, and dbt checks nothing.\n- `sources` or `table` as the method: the method is named `source`.\n- `orders` without the source name: a source table is addressed as `source_name.table_name`.",
    references: "https://docs.getdbt.com/reference/commands/source",
    dbtVersionFocus: "Source freshness (selecting sources)",
  },
  {
    id: 9012,
    category: "Implementing and maintaining external dependencies",
    difficulty: "Intermediate",
    questionText:
      "The source table `shop.orders` sets a `loaded_at_field` and a `freshness` config with `error_after: {count: 2, period: day}`. Its newest row was loaded five days ago. `stg_orders` selects from this source. A nightly job runs one command, `dbt build`. What happens?",
    options: [
      "dbt skips `stg_orders`, because its source is past `error_after`.",
      "dbt builds `stg_orders` and logs a freshness warning for the source.",
      "dbt fails before it builds anything, because the freshness check runs first.",
      "dbt builds `stg_orders`, because `dbt build` does not check source freshness.",
    ],
    correctAnswers: [3],
    explanation:
      "CORRECT ACTION:\n`dbt build` runs models, tests, snapshots and seeds. It does not check source freshness. To obtain freshness information for sources, the job needs the `dbt source freshness` command as its own step.\n\nINCORRECT COMPETING OPTIONS:\n- Skipping `stg_orders`: nothing in `dbt build` evaluates `error_after`, so nothing blocks the model.\n- Logging a freshness warning: the freshness config is read only by `dbt source freshness`.\n- Failing before the build: no freshness check runs as part of `dbt build`.",
    references: "https://docs.getdbt.com/docs/build/sources",
    dbtVersionFocus: "Source freshness and dbt build",
  },
  {
    id: 9013,
    category: "Leveraging the dbt state",
    difficulty: "Basic",
    questionText:
      "A developer runs `dbt ls --select state:modified`. No `--state` flag is passed, and no environment variable for the state path is set. What happens?",
    options: [
      "dbt compares the project with `target/manifest.json` from the previous run.",
      "dbt lists every node, because every node counts as new.",
      "dbt stops with a runtime error, because it has no comparison manifest.",
      "dbt lists no nodes, because nothing can be compared.",
    ],
    correctAnswers: [2],
    explanation:
      "CORRECT ACTION:\nThe `state` method compares the project against a manifest from a prior invocation. dbt can use those artifacts only when their file path is passed to the `--state` flag, or set in the matching environment variable. Without it, dbt stops with `Got a state selector method, but no comparison manifest`.\n\nINCORRECT COMPETING OPTIONS:\n- Comparing with `target/manifest.json`: dbt does not use the `target/` directory as the comparison state by default.\n- Listing every node as new: `state:new` needs a comparison manifest too.\n- Listing no nodes: the command ends with an error, not with an empty selection.",
    references: "https://docs.getdbt.com/reference/node-selection/state-selection",
    dbtVersionFocus: "State selection (the --state flag)",
  },
  {
    id: 9014,
    category: "Leveraging the dbt state",
    difficulty: "Advanced",
    questionText:
      "`prod-artifacts` holds the production manifest. In a pull request, the only change is a longer `description` for the model `stg_orders` in its YAML file. `persist_docs` is not enabled anywhere in the project. What does `dbt ls --select state:modified --state prod-artifacts` return?",
    options: [
      "`stg_orders`, because any change to a model's YAML properties counts.",
      "No nodes, because a `description` change counts only when `persist_docs` is enabled.",
      "`stg_orders` and its children, because documentation changes apply downstream.",
      "Every model in that YAML file, because dbt compares state file by file.",
    ],
    correctAnswers: [1],
    explanation:
      "CORRECT ACTION:\nA changed `description` is treated as a modification, but only when `persist_docs` is enabled. Here it is not, so no node differs from the production manifest and the selection is empty.\n\nINCORRECT COMPETING OPTIONS:\n- `stg_orders` alone: a `description` change with `persist_docs` not enabled does not mark the model as modified.\n- `stg_orders` and its children: `state:modified` without a `+` never adds children, and here the model itself is not selected.\n- Every model in the file: dbt compares each node, not each file.",
    references: "https://docs.getdbt.com/reference/node-selection/state-comparison-caveats",
    dbtVersionFocus: "State comparison (descriptions)",
  },
  {
    id: 9015,
    format: "hotspot",
    category: "Leveraging the dbt state",
    difficulty: "Advanced",
    questionText:
      '`prod-artifacts` holds the production manifest. In a pull request, the only change is the body of the macro `cents_to_dollars`. `stg_payments` calls this macro, and no other model does. Select every model that `dbt build --select "state:modified+" --state prod-artifacts` builds.',
    target: {
      kind: "dag",
      nodes: [
        { id: "stg_orders", label: "stg_orders", column: 0, row: 0 },
        { id: "stg_payments", label: "stg_payments", column: 0, row: 1 },
        { id: "dim_customers", label: "dim_customers", column: 0, row: 2 },
        { id: "fct_orders", label: "fct_orders", column: 1, row: 0 },
      ],
      edges: [
        ["stg_orders", "fct_orders"],
        ["stg_payments", "fct_orders"],
      ],
      correctNodes: ["stg_payments", "fct_orders"],
    },
    explanation:
      "CORRECT ACTION:\ndbt marks as modified any resource that depends on a changed macro, so `state:modified` selects `stg_payments` although its own file is unchanged. The `+` adds its descendant `fct_orders`.\n\nCOMMON MISTAKES:\n- `stg_orders`: it does not call the macro. It is a parent of `fct_orders`, and `state:modified+` adds descendants, not the other parents of those descendants.\n- `dim_customers`: it does not call the macro and is not downstream of `stg_payments`.",
    references: "https://docs.getdbt.com/reference/node-selection/methods",
    dbtVersionFocus: "State comparison (macros)",
  },
  {
    id: 9016,
    format: "fill_blank",
    category: "Leveraging the dbt state",
    difficulty: "Advanced",
    questionText:
      "Your development schema holds an old copy of `stg_orders`. `fct_orders` selects from it with `ref`. You want `fct_orders` to compile against the production `stg_orders` recorded in `prod-artifacts`, although the development copy exists. Complete the command with the missing flag.",
    codeSnippet: "dbt compile --select fct_orders --defer [[1]] --state prod-artifacts",
    codeLanguage: "bash",
    blanks: [{ accepted: ["--favor-state"] }],
    explanation:
      "CORRECT ACTION:\nWith `--defer`, dbt resolves a `ref` using the state manifest only if the node is not among the selected nodes and it does not exist in the database. When `--favor-state` is passed, dbt prioritizes node definitions from the `--state` directory, so the `ref` resolves to production although the development copy exists.\n\nCOMMON MISTAKES:\n- `--full-refresh`: it rebuilds the selected models and does not change how `ref` resolves.\n- `--target prod`: it points the whole command at the production output, so `fct_orders` would also compile for production.\n- `--empty`: it limits refs and sources to zero rows and does not change which relation a `ref` points to.",
    references: "https://docs.getdbt.com/reference/node-selection/defer",
    dbtVersionFocus: "Defer (--favor-state)",
  },
];
