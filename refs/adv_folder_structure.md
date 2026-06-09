Technical Specification: Feature-Based Architecture and Automated ESLint Enforcement

1. Architectural Overview

This specification defines a feature-based folder structure designed to eliminate architectural bloat and reduce cognitive load. By transitioning from a traditional "flat" architecture to a domain-encapsulated model, we ensure that complexity remains linear as the project scales. The primary objective is to maintain strict isolation between business domains while centralizing reusable primitives.

Project Hierarchy

The following tree represents the standardized directory structure.

src/
├── app/                  [The Glue: Pages, Middleware, Tasks]
├── features/             [Domain-Specific Modules]
│   ├── products/
│   │   ├── components/
│   │   ├── database/
│   │   └── server/
│   ├── users/
│   │   └── server/
│   └── sales/
│       ├── components/
│       └── server/
└── shared/               [Global Building Blocks]
    ├── components/
    ├── database/
    ├── lib/
    ├── api/
    └── utils/


Dependency Flow Logic

The architecture is governed by a strict hierarchy. Dependency must only flow downward.

+-----------------------+
|          App          | (Orchestration Layer)
+-----------+-----------+
            |
            v
+-----------+-----------+
|       Features        | (Domain-Specific Logic)
+-----------+-----------+
            |
            v
+-----------+-----------+
|        Shared         | (Global Primitives)
+-----------------------+



--------------------------------------------------------------------------------


2. Tier Definitions and Responsibilities

2.1 The Shared Tier (Global Building Blocks)

The shared tier contains low-level, reusable primitives that are agnostic of business logic. These modules serve as the foundation for the entire application.

* lib: Configurations for third-party libraries and global integrations.
* API: Shared API client configurations and base instances.
* database: The root database connection and global configuration.
* components: Generic UI elements (e.g., brand logos, navbars, buttons).
* utils: General-purpose utility functions (e.g., date formatters, number parsers).

2.2 The Features Tier (Domain-Specific Modules)

Each folder within features represents a distinct business domain (e.g., products, users, analytics). To ensure total encapsulation, features must replicate the global structure internally. For example, a database folder inside features/products handles domain-specific data access that should not be exposed globally. This "Replicated Structure" ensures that if a feature is deleted, its entire logic—from UI to database queries—is removed without leaving "dead" code in global folders.

2.3 The App Tier (The Glue)

The app tier is the orchestration layer. Beyond rendering pages (web) or panes (desktop), it manages global application concerns such as middleware.ts and automated tasks. It acts as the "glue" that composes building blocks from the features and shared tiers into a functional interface.


--------------------------------------------------------------------------------


3. Data Flow and Dependency Rules

To prevent circular dependencies and high coupling, the following import rules are mandatory:

* App → Features/Shared: The App tier has full visibility and can import from both Features and Shared tiers.
* Features → Shared: Features may consume global utilities and primitives.
* Features → Self: A feature is permitted to import its own internal modules (e.g., a feature component importing a feature utility).
* Shared → Shared: Global primitives may reference other shared primitives (e.g., a library using a utility).
* Prohibited: Cross-Feature Imports: A feature must never import from another feature. This ensures that the products domain remains entirely independent of the users domain.
* Prohibited: Bottom-Up Imports: Shared and Features tiers are strictly forbidden from importing from the App tier.


--------------------------------------------------------------------------------


4. ESLint Enforcement Configuration

Manual oversight is insufficient for maintaining architectural integrity. We utilize eslint-plugin-boundaries to automate enforcement.

4.1 Element Definitions

The elements configuration categorizes the src directory into functional zones. We use a capture group for featureName to enforce feature isolation.

settings: {
  "boundaries/elements": [
    {
      "type": "shared",
      "pattern": "shared/*"
    },
    {
      "type": "feature",
      "pattern": "features/*",
      "capture": ["featureName"]
    },
    {
      "type": "app",
      "pattern": "app/*"
    },
    {
      "type": "never-import",
      "pattern": ["middleware.ts", "tasks/*"]
    }
  ]
}


4.2 Rule Implementation

The configuration defaults to disallow for all imports, explicitly enabling only authorized pathways. The feature-to-self rule is the critical mechanism that prevents cross-feature leakage.

rules: {
  "boundaries/entry-point": [2, { "default": "disallow" }],
  "boundaries/no-unknown": 2,
  "boundaries/no-unknown-files": 2,
  "boundaries/element-types": [2, {
    "default": "disallow",
    "rules": [
      {
        "from": "shared",
        "allow": ["shared"]
      },
      {
        "from": "feature",
        "allow": [
          "shared",
          ["feature", { "featureName": "${from.featureName}" }]
        ]
      },
      {
        "from": "app",
        "allow": ["shared", "feature"]
      },
      {
        "from": "never-import",
        "allow": ["shared", "feature"]
      }
    ]
  }]
}


Note: no-unknown and no-unknown-files are enabled to ensure 100% directory coverage and prevent developers from bypassing rules by creating unmapped folders.


--------------------------------------------------------------------------------


5. Refactoring Strategy and Best Practices

Migration Workflow

To transition from a "flat" architecture to a feature-based model:

1. Identify Domain Boundaries: Group existing files into logical features (e.g., Sales, Products).
2. Relocate Logic: Move domain-specific components, actions, and schemas into their respective features/{name} folders.
3. Clean the Shared Tier: Strip the global shared folders of any code that is not truly generic and global.
4. Update Orchestration: Point the App tier imports to the new feature locations.

The Permissions Challenge: Data Injection

A common hurdle is a global permissions.ts file that imports from every feature, creating a massive dependency knot.

* The Problem: A permission check might import a getUserSubscription function (from the User feature) to check access for the Product feature.
* The Architect’s Solution: Use Data Injection. Instead of the permission function accepting a userId and fetching data internally (causing feature-coupling), refactor it to accept the necessary data—such as the userSubscription object—as a direct argument. Alternatively, decentralize the logic by placing feature-specific permissions within the features/{name}/permissions folder.

Benefits of Implementation

* Isolated Testing: Mocking is simplified because features have zero dependencies on other features.
* Safe Deletion: Developers can delete an entire feature folder with 100% confidence that it will not break unrelated domains.
* Parallel Development: Teams can work on separate feature folders simultaneously with minimal merge conflicts and zero architectural interference.
