import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '@/shared/utils/request';
import { taskService } from './task.service';

vi.mock('@/shared/utils/request', () => ({
  request: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('taskService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps task query and mutation endpoints to backend routes', () => {
    const dueAt = '2026-05-18T10:00:00.000Z';
    taskService.getTasks({ view: 'today', page: 1, limit: 10, keyword: 'family' });
    taskService.createTask({ title: 'Pay bills', listId: 1, dueAt });
    taskService.updateTask(9, { title: 'Pay rent' });
    taskService.completeTask(9);
    taskService.reopenTask(9);
    taskService.snoozeTaskReminder(9, { snoozeUntil: '2026-05-01T10:30:00.000Z' });
    taskService.deleteTask(9);

    expect(request.get).toHaveBeenCalledWith('/tasks', {
      params: { view: 'today', page: 1, limit: 10, keyword: 'family' },
    });
    expect(request.post).toHaveBeenCalledWith(
      '/tasks',
      { title: 'Pay bills', listId: 1, dueAt },
      expect.any(Object)
    );
    expect(request.put).toHaveBeenCalledWith('/tasks/9', { title: 'Pay rent' }, expect.any(Object));
    expect(request.patch).toHaveBeenCalledWith('/tasks/9/complete', undefined, expect.any(Object));
    expect(request.patch).toHaveBeenCalledWith('/tasks/9/reopen', undefined, expect.any(Object));
    expect(request.post).toHaveBeenCalledWith(
      '/tasks/9/reminder/snooze',
      { snoozeUntil: '2026-05-01T10:30:00.000Z' },
      expect.any(Object)
    );
    expect(request.delete).toHaveBeenCalledWith('/tasks/9', expect.any(Object));
  });

  it('serializes tag filters as comma-separated tags for the backend DTO', () => {
    taskService.getTasks({ view: 'list', page: 1, limit: 10, tags: ['home', 'work'] });

    expect(request.get).toHaveBeenCalledWith('/tasks', {
      params: { view: 'list', page: 1, limit: 10, tags: 'home,work' },
    });
  });

  it('uses task scoped assignee options instead of the user management list', () => {
    taskService.getTaskAssignees();

    expect(request.get).toHaveBeenCalledWith('/tasks/assignees');
  });

  it('maps task list CRUD endpoints to backend routes', () => {
    taskService.getTaskLists();
    taskService.ensureDefaultTaskLists();
    taskService.createTaskList({ name: 'Home', scope: 'family' });
    taskService.updateTaskList(3, { name: 'Personal', sort: 10 });
    taskService.deleteTaskList(3);

    expect(request.get).toHaveBeenCalledWith('/task-lists');
    expect(request.post).toHaveBeenCalledWith('/task-lists/defaults');
    expect(request.post).toHaveBeenCalledWith(
      '/task-lists',
      { name: 'Home', scope: 'family' },
      expect.any(Object)
    );
    expect(request.put).toHaveBeenCalledWith(
      '/task-lists/3',
      { name: 'Personal', sort: 10 },
      expect.any(Object)
    );
    expect(request.delete).toHaveBeenCalledWith('/task-lists/3', expect.any(Object));
  });
});
