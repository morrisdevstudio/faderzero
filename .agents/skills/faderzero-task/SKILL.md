---
name: faderzero-task
description: Automatic workflow to query the FaderZero Notion Todo database (f8b0eed2-0504-4044-bd93-f8561ff4a726), fetch tasks with status "À faire", execute the required code changes in the FaderZero project, validate via tests, and mark tasks as "Fait" in Notion. Use whenever the user asks to check, list, or complete FaderZero Notion tasks or todos.
---

# FaderZero Notion Task Execution Skill

Use this skill to fetch, execute, and update tasks from the official FaderZero Notion Todo database.

## Database Metadata

- **Database Name**: Todo (FaderZero)
- **Database ID**: `f8b0eed2-0504-4044-bd93-f8561ff4a726`
- **Parent Page ID**: `3aa97be3-9ba7-80f6-bb6e-d2febb27fc18`
- **Properties**:
  - `Statut` (status): `Idée` (pink), `À faire` (red), `En cours` (yellow), `Fait` (green)
  - `Tâche` (title): Main title/description of the task
  - `Type` (select): `Correction` (purple), `Features` (blue)
  - `Image` (files): Attached screenshots/files

## Step-by-Step Execution Workflow

### Step 1: Query the Notion Todo Database
Use Notion MCP tool `API-post-search` with `query: ""` to retrieve all pages in the workspace, and filter for items where:
```json
parent.type == "database_id" && parent.database_id == "f8b0eed2-0504-4044-bd93-f8561ff4a726"
```

### Step 2: Filter Tasks "À faire"
Filter pages where:
```json
properties.Statut.status.name == "À faire"
```
If no tasks are in "À faire" status, inform the user that all tasks are up to date.

### Step 3: Extract Task Details & Context
For each pending task:
1. Extract the title from `properties.Tâche.title[0].plain_text`.
2. Extract the task type (`Correction` or `Features`) and any attached images in `properties.Image.files`.
3. Call `API-get-block-children` with `block_id = <page_id>` to check if there are additional details or notes inside the page.

### Step 4: Implement Code Changes
1. Use codebase tools (`grep_search`, `view_file`) to locate the relevant components in `src/`.
2. Follow FaderZero architecture and design system rules:
   - Preserving dark mode aesthetics, clean tailwind styling, typography, and responsive design.
   - Preserving standard UI header conventions (`<section className="space-y-3 -mt-2">...`).
3. Make changes using code edit tools.

### Step 5: Validate Changes
Run automated verification before marking tasks as finished:
1. `npm run typecheck`
2. `npm run test`

### Step 6: Mark Tasks as "Fait" in Notion
For each completed task, update its status in Notion using `API-patch-page`:
```json
{
  "page_id": "<page_id>",
  "properties": {
    "Statut": {
      "status": {
        "name": "Fait"
      }
    }
  }
}
```

### Step 7: Final Summary
Present a clear summary to the user detailing:
- The completed Notion tasks with their original title.
- The files modified in the codebase with clickable `file://` links.
- Verification results (typecheck & vitest output).
