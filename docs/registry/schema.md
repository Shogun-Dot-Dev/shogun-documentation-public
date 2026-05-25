---
sidebar_position: 2
title: Registry Schema
---

# Registry Schema

Registry entries live in `src/data/registry.ts`.

| Field | Purpose |
| --- | --- |
| `id` | Stable machine-readable identifier. |
| `title` | Human-readable documentation name. |
| `description` | Short summary for the registry card. |
| `category` | Broad grouping such as Product, API, Guide, or Operations. |
| `audience` | Primary reader group. |
| `status` | Lifecycle state: Active, Preview, Deprecated, or Archived. |
| `owner` | Team or person responsible for accuracy. |
| `url` | Public destination URL. |
| `updatedAt` | Last meaningful content update in ISO date format. |
| `tags` | Search and filtering keywords. |

Keep descriptions short and actionable. If an entry is not public, do not add it to this registry.
