# Parent-Child Assignment Linking Test Guide

## Overview
This guide shows how to test the new parent-child assignment linking feature for strict consolidation separation.

## Database Setup
1. Run the migration: `migration_add_parent_assignment.sql`
2. This adds `parent_report_assignment_id` column to `report_assignment` table

## Test Scenario: Coordinator "Fire Drill" Assignment

### Step 1: Create Coordinator's Assignment
**POST** `http://localhost:5000/reports/accomplishment/give`
```json
{
  "category_id": 0,
  "given_by": 53110,
  "quarter": 2,
  "year": 50000,
  "from_date": "2025-10-29",
  "to_date": "2025-11-20",
  "instruction": "TEST",
  "is_given": 1,
  "assignees": [53110],
  "title": "Fire Drill - Coordinator"
}
```
**Response**: `{ "report_assignment_id": 100 }` (example)

### Step 2: Create Teacher Assignment
**POST** `http://localhost:5000/reports/accomplishment/give`
```json
{
  "category_id": 0,
  "given_by": 53110,
  "quarter": 2,
  "year": 50000,
  "from_date": "2025-10-29",
  "to_date": "2025-11-20",
  "instruction": "TEST",
  "is_given": 1,
  "assignees": [53094, 53095, 53096],
  "title": "Fire Drill - Teachers"
}
```
**Response**: `{ "report_assignment_id": 101 }` (example)

### Step 3: Link Parent-Child
**POST** `http://localhost:5000/reports/accomplishment/link-parent`
```json
{
  "teacher_assignment_id": 101,
  "coordinator_assignment_id": 100
}
```
**Response**: `{ "success": true, "message": "Parent assignment linked successfully" }`

### Step 4: Test Consolidation with Parent-Child Filtering

#### Option A: Using Parent Assignment ID (Strict Separation)
**GET** `http://localhost:5000/reports/accomplishment/{coordinator_submission_id}/peers?pra=100`
- Only shows teacher submissions from assignment 101 (child of 100)
- Excludes submissions from other coordinators

#### Option B: Using Regular Assignment ID (Current Behavior)
**GET** `http://localhost:5000/reports/accomplishment/{coordinator_submission_id}/peers?ra=101`
- Shows all submissions from assignment 101
- Same as current behavior

### Step 5: Test Consolidate with Parent Filtering
**POST** `http://localhost:5000/reports/accomplishment/{coordinator_submission_id}/consolidate`
```json
{
  "title": "Fire Drill",
  "parent_assignment_id": 100
}
```
- Only consolidates from teacher submissions linked to coordinator's assignment 100
- Provides strict separation between different coordinators

## Benefits of Parent-Child Linking

1. **Strict Separation**: Each coordinator only sees their own assigned teachers
2. **Scalable**: Works with multiple coordinators and their specific teacher groups
3. **Secure**: No cross-contamination between different coordinator assignments
4. **Clean Hierarchy**: Clear parent-child relationship in the database
5. **Backward Compatible**: Existing functionality still works with `ra` parameter

## Frontend Integration

The frontend should:
1. Pass `pra={coordinator_assignment_id}` when coordinator opens consolidate modal
2. Pass `parent_assignment_id` in consolidate POST request body
3. Use the new `/link-parent` endpoint after creating teacher assignments

This ensures coordinators can only consolidate from their specifically assigned teachers, not from all teachers in the system.
