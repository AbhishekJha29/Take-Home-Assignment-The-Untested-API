const taskService = require('../src/services/taskService');

describe('taskService Unit Tests', () => {
  beforeEach(() => {
    taskService._reset();
  });

  describe('create', () => {
    it('should create a task with default values', () => {
      const task = taskService.create({ title: 'Test Task' });
      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
      expect(task.title).toBe('Test Task');
      expect(task.description).toBe('');
      expect(task.status).toBe('todo');
      expect(task.priority).toBe('medium');
      expect(task.dueDate).toBeNull();
      expect(task.completedAt).toBeNull();
      expect(task.createdAt).toBeDefined();
    });

    it('should create a task with custom values', () => {
      const dueDate = new Date().toISOString();
      const task = taskService.create({
        title: 'Custom Task',
        description: 'Custom Desc',
        status: 'in_progress',
        priority: 'high',
        dueDate,
      });
      expect(task.title).toBe('Custom Task');
      expect(task.description).toBe('Custom Desc');
      expect(task.status).toBe('in_progress');
      expect(task.priority).toBe('high');
      expect(task.dueDate).toBe(dueDate);
    });
  });

  describe('getAll', () => {
    it('should return an empty array initially', () => {
      expect(taskService.getAll()).toEqual([]);
    });

    it('should return all created tasks', () => {
      const t1 = taskService.create({ title: 'Task 1' });
      const t2 = taskService.create({ title: 'Task 2' });
      const all = taskService.getAll();
      expect(all).toHaveLength(2);
      expect(all).toEqual(expect.arrayContaining([t1, t2]));
    });
  });

  describe('findById', () => {
    it('should return undefined if task is not found', () => {
      expect(taskService.findById('non-existent-id')).toBeUndefined();
    });

    it('should return the correct task by id', () => {
      const task = taskService.create({ title: 'Target Task' });
      const found = taskService.findById(task.id);
      expect(found).toEqual(task);
    });
  });

  describe('getByStatus', () => {
    it('should return empty list when no tasks match', () => {
      taskService.create({ title: 'Task 1', status: 'todo' });
      expect(taskService.getByStatus('done')).toEqual([]);
    });

    it('should return matching tasks', () => {
      const t1 = taskService.create({ title: 'Task 1', status: 'todo' });
      const t2 = taskService.create({ title: 'Task 2', status: 'in_progress' });
      const found = taskService.getByStatus('todo');
      expect(found).toHaveLength(1);
      expect(found[0]).toEqual(t1);
    });

    it('should exhibit substring match bug (known behavior)', () => {
      // Bug: getByStatus uses string.includes().
      // Searching for "o" matches "todo", "in_progress", and "done"
      const t1 = taskService.create({ title: 'Task 1', status: 'todo' });
      const t2 = taskService.create({ title: 'Task 2', status: 'in_progress' });
      const t3 = taskService.create({ title: 'Task 3', status: 'done' });
      
      const found = taskService.getByStatus('o');
      expect(found).toHaveLength(3); // All three statuses contain the letter 'o'
    });
  });

  describe('getPaginated', () => {
    it('should return tasks based on current paginated offset calculation (known bug)', () => {
      const t1 = taskService.create({ title: 'Task 1' });
      const t2 = taskService.create({ title: 'Task 2' });
      const t3 = taskService.create({ title: 'Task 3' });
      const t4 = taskService.create({ title: 'Task 4' });

      // Bug: offset = page * limit
      // If page = 1, limit = 2 => offset = 2. It will skip first 2 items and return t3, t4.
      const page1 = taskService.getPaginated(1, 2);
      expect(page1).toHaveLength(2);
      expect(page1[0]).toEqual(t3);
      expect(page1[1]).toEqual(t4);

      // If page = 0, limit = 2 => offset = 0. It returns t1, t2.
      const page0 = taskService.getPaginated(0, 2);
      expect(page0).toHaveLength(2);
      expect(page0[0]).toEqual(t1);
      expect(page0[1]).toEqual(t2);
    });
  });

  describe('getStats', () => {
    it('should return zero counts initially', () => {
      expect(taskService.getStats()).toEqual({
        todo: 0,
        in_progress: 0,
        done: 0,
        overdue: 0,
      });
    });

    it('should aggregate counts correctly', () => {
      taskService.create({ title: 'T1', status: 'todo' });
      taskService.create({ title: 'T2', status: 'in_progress' });
      taskService.create({ title: 'T3', status: 'done' });

      const stats = taskService.getStats();
      expect(stats.todo).toBe(1);
      expect(stats.in_progress).toBe(1);
      expect(stats.done).toBe(1);
      expect(stats.overdue).toBe(0);
    });

    it('should count overdue tasks correctly', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1); // Yesterday

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1); // Tomorrow

      // Overdue: status !== 'done' and dueDate in the past
      taskService.create({ title: 'Overdue Todo', status: 'todo', dueDate: pastDate.toISOString() });
      taskService.create({ title: 'Overdue In Progress', status: 'in_progress', dueDate: pastDate.toISOString() });
      
      // Not overdue because status is 'done'
      taskService.create({ title: 'Completed Past', status: 'done', dueDate: pastDate.toISOString() });
      
      // Not overdue because dueDate is in the future
      taskService.create({ title: 'Future Todo', status: 'todo', dueDate: futureDate.toISOString() });

      const stats = taskService.getStats();
      expect(stats.overdue).toBe(2);
    });
  });

  describe('update', () => {
    it('should return null if updating non-existent task', () => {
      const result = taskService.update('non-existent-id', { title: 'Updated' });
      expect(result).toBeNull();
    });

    it('should update provided fields and keep others', () => {
      const task = taskService.create({ title: 'Original', description: 'Desc' });
      const updated = taskService.update(task.id, { title: 'Updated' });
      
      expect(updated).toBeDefined();
      expect(updated.title).toBe('Updated');
      expect(updated.description).toBe('Desc'); // remains unchanged
      
      const retrieved = taskService.findById(task.id);
      expect(retrieved.title).toBe('Updated');
    });
  });

  describe('remove', () => {
    it('should return false if task to remove does not exist', () => {
      expect(taskService.remove('non-existent-id')).toBe(false);
    });

    it('should remove the task and return true', () => {
      const task = taskService.create({ title: 'To Remove' });
      const result = taskService.remove(task.id);
      expect(result).toBe(true);
      expect(taskService.findById(task.id)).toBeUndefined();
    });
  });

  describe('completeTask', () => {
    it('should return null if task does not exist', () => {
      expect(taskService.completeTask('non-existent-id')).toBeNull();
    });

    it('should set status to done, completedAt timestamp, and reset priority to medium (known bug/behavior)', () => {
      const task = taskService.create({ title: 'Complete Me', priority: 'high', status: 'todo' });
      const completed = taskService.completeTask(task.id);

      expect(completed).toBeDefined();
      expect(completed.status).toBe('done');
      expect(completed.priority).toBe('medium'); // Bug: resets priority to medium
      expect(completed.completedAt).toBeDefined();
      expect(new Date(completed.completedAt).getTime()).not.toBeNaN();
    });
  });

  describe('assignTask', () => {
    it('should return null if task does not exist', () => {
      expect(taskService.assignTask('non-existent-id', 'John Doe')).toBeNull();
    });

    it('should set assignee and return updated task', () => {
      const task = taskService.create({ title: 'Task to Assign' });
      const updated = taskService.assignTask(task.id, 'John Doe');
      expect(updated).toBeDefined();
      expect(updated.assignee).toBe('John Doe');
    });

    it('should overwrite existing assignee (documented behavior)', () => {
      const task = taskService.create({ title: 'Task to Reassign' });
      taskService.assignTask(task.id, 'John Doe');
      const updated = taskService.assignTask(task.id, 'Jane Doe');
      expect(updated.assignee).toBe('Jane Doe');
    });
  });
});
