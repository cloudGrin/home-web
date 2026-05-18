import type { Task } from '../types/task.types';

export function isTaskAssignedToUser(task: Task, userId?: number | null) {
  return Boolean(userId && task.list?.scope === 'family' && task.assigneeId === userId);
}
