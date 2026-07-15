# Task Manager API - Bug Report

This report documents all bugs and design limitations discovered during the testing and code review phase of the Task Manager API. 

> [!NOTE]
> Per the assignment requirements, only **one** bug was intentionally fixed—**Bug 3: Falsy Values Validation Bypass Bug** (the highest impact data-integrity bug). The remaining bugs are documented below for full transparency and reference.

---

## Bug 1: Pagination Offset Calculation Bug

**Severity:** High

**Location:** `src/services/taskService.js` in `getPaginated`

### Expected Behavior
Requesting page `1` with a limit of `10` should return the first 10 items (indexes `0` to `9`) from the task list.

### Actual Behavior
Page `1` starts at offset `10` (skipping the first 10 tasks) and returns items at indexes `10` to `19`. Requesting page `1` behaves like requesting page `2`.

### How It Was Discovered
Discovered during unit testing of pagination logic and integration testing of `GET /tasks?page=1&limit=2`.

### Root Cause
The offset is calculated using the formula:
```javascript
const offset = page * limit;
```
For the default page `1`, this evaluates to `1 * limit`, shifting the range by one full page and leaving the initial tasks unretrievable via normal pagination.

### Suggested Fix
Correct the offset formula to use a 1-based index calculation:
```javascript
const offset = (page - 1) * limit;
```

### Status
- Not Fixed (Documented Only)

---

## Bug 2: Status Filtering Substring Match Bug

**Severity:** Medium

**Location:** `src/services/taskService.js` in `getByStatus`

### Expected Behavior
Filtering tasks by status should perform an exact match against the task's status property (e.g. `'todo'`, `'in_progress'`, or `'done'`).

### Actual Behavior
Filtering by status matches partial substrings. For example, querying `/tasks?status=o` matches and returns all tasks in the system since `'todo'`, `'in_progress'`, and `'done'` all contain the character `'o'`.

### How It Was Discovered
Discovered during codebase review of task filtering logic and verified in unit tests.

### Root Cause
The filter uses the `.includes()` string method:
```javascript
const getByStatus = (status) => tasks.filter((t) => t.status.includes(status));
```

### Suggested Fix
Change the comparison to exact matching:
```javascript
const getByStatus = (status) => tasks.filter((t) => t.status === status);
```

### Status
- Not Fixed (Documented Only)

---

## Bug 3: Falsy Values Validation Bypass Bug

**Severity:** High

**Location:** `src/utils/validators.js` in `validateCreateTask` and `validateUpdateTask`

### Expected Behavior
When creating or updating a task, if the request payload contains `status` or `priority` properties, their values must be validated, even if they are empty strings `""` or other falsy values. Invalid or empty values should trigger a `400 Bad Request` response.

### Actual Behavior
Providing an empty string `status: ""` or `priority: ""` bypasses the validator. They are saved in the data store as empty strings, bypassing schema defaults and corrupting the task's data structure.

### How It Was Discovered
Discovered during source code review and verified by integration tests where empty status/priority requests returned `201 Created` or `200 OK`.

### Root Cause
Validation checks used truthiness checks:
```javascript
if (body.status && !VALID_STATUSES.includes(body.status))
```
Since an empty string `""` is falsy in JavaScript, the condition evaluates to `false`, causing the validation check to be skipped entirely.

### Suggested Fix
Replace the presence check from checking truthiness to checking for explicit presence (`!== undefined`).

### Status
- Fixed 

---

## Bug 4: Overwriting Task Priority on Completion Bug

**Severity:** Medium

**Location:** `src/services/taskService.js` in `completeTask`

### Expected Behavior
Completing a task should set its status to `'done'` and store a `completedAt` timestamp, leaving the original task priority level intact.

### Actual Behavior
Completing a task resets its priority back to `'medium'`, overriding and destroying any user-specified priority level.

### How It Was Discovered
Discovered during unit testing of `completeTask`.

### Root Cause
The update object hardcodes priority:
```javascript
const updated = {
  ...task,
  priority: 'medium',
  status: 'done',
  completedAt: new Date().toISOString(),
};
```

### Suggested Fix
Remove the hardcoded `priority` field from the update object in `completeTask` so that the original priority is preserved:
```javascript
const updated = {
  ...task,
  status: 'done',
  completedAt: new Date().toISOString(),
};
```

### Status
- Not Fixed (Documented Only)

---

## Bug 5: Filtering + Pagination Behavior (Design Limitation)

**Severity:** Medium

**Location:** `src/routes/tasks.js` in `GET /tasks` route handler

### Expected Behavior
Requesting filtered tasks with pagination query parameters (e.g. `GET /tasks?status=todo&page=1&limit=5`) should return a paginated list of tasks matching the status.

### Actual Behavior
The route handler evaluates conditions exclusively: if a `status` query parameter is present, it returns all matching tasks immediately and ignores pagination parameters altogether.

### How It Was Discovered
Discovered during route code review and verified by integration testing.

### Root Cause
The implementation uses disjoint conditional blocks:
```javascript
if (status) {
  const tasks = taskService.getByStatus(status);
  return res.json(tasks);
}

if (page !== undefined || limit !== undefined) {
  // ...
}
```

### Suggested Fix
Modify the route handler to first filter the task array by status, and then apply pagination to the filtered subset.

### Status
- Not Fixed (Documented Only)

---

## Bug 6: Negative or Invalid Pagination Parameters

**Severity:** Low

**Location:** `src/routes/tasks.js` in `GET /tasks` route handler

### Expected Behavior
Providing negative or invalid pagination values (e.g., `page=-5` or `limit=-2`) should be rejected with a `400 Bad Request` status or handled gracefully (clamped to positive values).

### Actual Behavior
Negative inputs are parsed as integers and passed directly to the `slice()` method, which performs backward slicing from the end of the array, returning incorrect/unexpected sets of tasks.

### How It Was Discovered
Discovered during input validation review and verified in route integration testing.

### Root Cause
There is no validation check on `pageNum` and `limitNum` for non-negative values before passing them to `taskService.getPaginated()`.

### Suggested Fix
Add checks to ensure `pageNum >= 1` and `limitNum >= 1`, or return a `400 Bad Request` if invalid query values are passed.

### Status
- Not Fixed (Documented Only)
