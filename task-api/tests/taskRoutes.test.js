const request = require('supertest');
const app = require('../src/app');
const taskService = require('../src/services/taskService');

describe('taskRoutes Integration Tests', () => {
  beforeEach(() => {
    taskService._reset();
  });

  describe('GET /tasks/stats', () => {
    it('should return 200 and zero stats when no tasks exist (Happy Path & Edge Case)', async () => {
      const res = await request(app).get('/tasks/stats');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        todo: 0,
        in_progress: 0,
        done: 0,
        overdue: 0,
      });
    });

    it('should calculate stats correctly (Happy Path)', async () => {
      taskService.create({ title: 'Task 1', status: 'todo' });
      taskService.create({ title: 'Task 2', status: 'in_progress' });
      taskService.create({ title: 'Task 3', status: 'done' });
      
      const res = await request(app).get('/tasks/stats');
      expect(res.status).toBe(200);
      expect(res.body.todo).toBe(1);
      expect(res.body.in_progress).toBe(1);
      expect(res.body.done).toBe(1);
    });

    it('should calculate overdue tasks correctly (Edge Case 2)', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 2);

      taskService.create({ title: 'Task 1', status: 'todo', dueDate: pastDate.toISOString() });
      taskService.create({ title: 'Task 2', status: 'done', dueDate: pastDate.toISOString() }); // Not overdue because done

      const res = await request(app).get('/tasks/stats');
      expect(res.status).toBe(200);
      expect(res.body.overdue).toBe(1);
    });
  });

  describe('GET /tasks', () => {
    it('should return all tasks (Happy Path)', async () => {
      const t1 = taskService.create({ title: 'Task A' });
      const t2 = taskService.create({ title: 'Task B' });

      const res = await request(app).get('/tasks');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].id).toBe(t1.id);
      expect(res.body[1].id).toBe(t2.id);
    });

    it('should filter tasks by status (Edge Case 1)', async () => {
      const t1 = taskService.create({ title: 'Task A', status: 'todo' });
      taskService.create({ title: 'Task B', status: 'in_progress' });

      const res = await request(app).get('/tasks?status=todo');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(t1.id);
    });

    it('should paginate tasks (Edge Case 2 - exhibiting current offset bug)', async () => {
      taskService.create({ title: 'T1' });
      taskService.create({ title: 'T2' });
      taskService.create({ title: 'T3' });
      taskService.create({ title: 'T4' });

      // page=1 & limit=2 => offset is 2. Expect T3 and T4
      const res = await request(app).get('/tasks?page=1&limit=2');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].title).toBe('T3');
      expect(res.body[1].title).toBe('T4');
    });

    it('should fallback to defaults on invalid pagination params (Invalid Input)', async () => {
      taskService.create({ title: 'T1' });
      
      const res = await request(app).get('/tasks?page=abc&limit=xyz');
      expect(res.status).toBe(200);
      // abc parses to NaN, defaults page to 1. limit defaults to 10.
      // Offset is 1 * 10 = 10, so it returns empty list because there are only 1 tasks
      expect(res.body).toEqual([]);
    });
  });

  describe('POST /tasks', () => {
    it('should create a task with required title (Happy Path)', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: 'New Task' });
      
      expect(res.status).toBe(201);
      expect(res.body.title).toBe('New Task');
      expect(res.body.id).toBeDefined();
    });

    it('should create task with custom properties (Edge Case 1)', async () => {
      const dueDate = new Date().toISOString();
      const res = await request(app)
        .post('/tasks')
        .send({
          title: 'Custom Task',
          status: 'in_progress',
          priority: 'high',
          dueDate,
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('in_progress');
      expect(res.body.priority).toBe('high');
      expect(res.body.dueDate).toBe(dueDate);
    });

    it('should accept additional fields but only schema fields will affect task (Edge Case 2)', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: 'Extra Fields', extra: 'ignored' });
      
      expect(res.status).toBe(201);
      expect(res.body.extra).toBeUndefined();
    });

    it('should reject missing title (Invalid Input)', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ description: 'No title' });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('title is required and must be a non-empty string');
    });

    it('should reject empty title string (Invalid Input)', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: '   ' });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('title is required and must be a non-empty string');
    });

    it('should reject invalid status (Invalid Input)', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: 'Task', status: 'not-a-status' });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('status must be one of');
    });

    it('should reject invalid priority (Invalid Input)', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: 'Task', priority: 'critical' });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('priority must be one of');
    });

    it('should reject invalid dueDate (Invalid Input)', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: 'Task', dueDate: 'not-a-date' });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('dueDate must be a valid ISO date string');
    });

    // Falsy Value Validation Bypass checks
    it('should reject empty string status (Falsy Check)', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: 'Task', status: '' });
      expect(res.status).toBe(400);
    });

    it('should reject empty string priority (Falsy Check)', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: 'Task', priority: '' });
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /tasks/:id', () => {
    it('should update task details successfully (Happy Path)', async () => {
      const task = taskService.create({ title: 'Original Title' });
      
      const res = await request(app)
        .put(`/tasks/${task.id}`)
        .send({ title: 'Updated Title', status: 'in_progress' });
      
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Updated Title');
      expect(res.body.status).toBe('in_progress');
    });

    it('should return 404 for updating non-existent task (Edge Case 1)', async () => {
      const res = await request(app)
        .put('/tasks/non-existent-uuid')
        .send({ title: 'Updated Title' });
      
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Task not found');
    });

    it('should retain non-updated fields (Edge Case 2)', async () => {
      const task = taskService.create({ title: 'Keep Title', description: 'Keep Desc' });
      
      const res = await request(app)
        .put(`/tasks/${task.id}`)
        .send({ status: 'done' });
      
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Keep Title');
      expect(res.body.description).toBe('Keep Desc');
      expect(res.body.status).toBe('done');
    });

    it('should reject empty title update (Invalid Input)', async () => {
      const task = taskService.create({ title: 'Original Title' });
      
      const res = await request(app)
        .put(`/tasks/${task.id}`)
        .send({ title: '' });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('title must be a non-empty string');
    });

    it('should reject invalid status (Invalid Input)', async () => {
      const task = taskService.create({ title: 'Original Title' });
      const res = await request(app)
        .put(`/tasks/${task.id}`)
        .send({ status: 'unknown' });
      expect(res.status).toBe(400);
    });

    it('should reject empty string status (Falsy Check)', async () => {
      const task = taskService.create({ title: 'Original Title' });
      const res = await request(app)
        .put(`/tasks/${task.id}`)
        .send({ status: '' });
      expect(res.status).toBe(400);
    });

    it('should reject empty string priority (Falsy Check)', async () => {
      const task = taskService.create({ title: 'Original Title' });
      const res = await request(app)
        .put(`/tasks/${task.id}`)
        .send({ priority: '' });
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /tasks/:id', () => {
    it('should delete existing task and return 204 (Happy Path)', async () => {
      const task = taskService.create({ title: 'Task to Delete' });
      
      const res = await request(app).delete(`/tasks/${task.id}`);
      expect(res.status).toBe(204);
      expect(taskService.findById(task.id)).toBeUndefined();
    });

    it('should return 404 if task to delete does not exist (Edge Case 1)', async () => {
      const res = await request(app).delete('/tasks/non-existent-uuid');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Task not found');
    });

    it('should handle deleting twice gracefully returning 404 on second attempt (Edge Case 2)', async () => {
      const task = taskService.create({ title: 'Delete twice' });
      
      const res1 = await request(app).delete(`/tasks/${task.id}`);
      expect(res1.status).toBe(204);

      const res2 = await request(app).delete(`/tasks/${task.id}`);
      expect(res2.status).toBe(404);
    });
  });

  describe('PATCH /tasks/:id/complete', () => {
    it('should mark task as done and return 200 (Happy Path)', async () => {
      const task = taskService.create({ title: 'Complete me', status: 'todo' });
      
      const res = await request(app).patch(`/tasks/${task.id}/complete`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('done');
      expect(res.body.completedAt).toBeDefined();
    });

    it('should return 404 if task to complete does not exist (Edge Case 1)', async () => {
      const res = await request(app).patch('/tasks/non-existent-uuid/complete');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Task not found');
    });

    it('should work fine even if task is already complete (Edge Case 2)', async () => {
      const task = taskService.create({ title: 'Already complete', status: 'done' });
      
      const res = await request(app).patch(`/tasks/${task.id}/complete`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('done');
    });
  });

  describe('PATCH /tasks/:id/assign', () => {
    it('should assign a task to a user and return 200 (Happy Path)', async () => {
      const task = taskService.create({ title: 'Assign me' });
      
      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: 'John Doe' });
      
      expect(res.status).toBe(200);
      expect(res.body.assignee).toBe('John Doe');
      
      // verify it's persisted
      const updated = taskService.findById(task.id);
      expect(updated.assignee).toBe('John Doe');
    });

    it('should return 404 for assigning a non-existent task (Edge Case 1)', async () => {
      const res = await request(app)
        .patch('/tasks/non-existent-uuid/assign')
        .send({ assignee: 'John Doe' });
      
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Task not found');
    });

    it('should allow overwriting an assignee if already assigned (Edge Case 2)', async () => {
      const task = taskService.create({ title: 'Reassign' });
      task.assignee = 'Alice';
      
      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: 'Bob' });
      
      expect(res.status).toBe(200);
      expect(res.body.assignee).toBe('Bob');
    });

    it('should reject missing assignee (Invalid Input)', async () => {
      const task = taskService.create({ title: 'Assign me' });
      
      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({});
      
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('assignee is required and must be a non-empty string');
    });

    it('should reject empty assignee string (Invalid Input)', async () => {
      const task = taskService.create({ title: 'Assign me' });
      
      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: '   ' });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('assignee is required and must be a non-empty string');
    });
  });
});
