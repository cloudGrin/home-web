import type { FileEntity } from '@/features/file/types/file.types';

export type TaskStatus = 'pending' | 'completed';

export type TaskType = 'task' | 'anniversary';

export type TaskRecurrenceType =
  | 'none'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'weekdays'
  | 'custom';

export type TaskListScope = 'personal' | 'family';

export type TaskView = 'list' | 'today' | 'calendar' | 'matrix' | 'anniversary';

export type TaskSortField =
  | 'createdAt'
  | 'updatedAt'
  | 'dueAt'
  | 'remindAt'
  | 'completedAt'
  | 'title';

export type TaskSortOrder = 'ASC' | 'DESC';

export type TaskActionType = 'complete' | 'reopen' | 'delete' | 'snooze';

export interface TaskActionPending {
  type: TaskActionType;
  taskId?: number;
}

export interface TaskList {
  id: number;
  name: string;
  scope: TaskListScope;
  color?: string | null;
  sort: number;
  isArchived: boolean;
  ownerId?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface TaskAssignee {
  id: number;
  username: string;
  nickname?: string | null;
  realName?: string | null;
}

export interface TaskAttachment {
  id: number;
  taskId: number;
  fileId: number;
  sort: number;
  file?: FileEntity;
}

export interface TaskCheckItem {
  id?: number;
  taskId?: number;
  title: string;
  completed: boolean;
  completedAt?: string | null;
  sort: number;
}

export interface Task {
  id: number;
  title: string;
  description?: string | null;
  listId: number;
  list?: TaskList;
  creatorId?: number | null;
  assigneeId?: number | null;
  assignee?: TaskAssignee | null;
  status: TaskStatus;
  taskType: TaskType;
  dueAt?: string | null;
  remindAt?: string | null;
  remindedAt?: string | null;
  nextReminderAt?: string | null;
  completedAt?: string | null;
  important: boolean;
  urgent: boolean;
  tags?: string[] | null;
  attachments?: TaskAttachment[];
  checkItems?: TaskCheckItem[];
  recurrenceType: TaskRecurrenceType;
  recurrenceInterval?: number | null;
  continuousReminderEnabled: boolean;
  continuousReminderIntervalMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages?: number;
}

export interface QueryTasksParams {
  view?: TaskView;
  page?: number;
  limit?: number;
  taskId?: number;
  listId?: number;
  assigneeId?: number;
  status?: TaskStatus;
  startDate?: string;
  endDate?: string;
  keyword?: string;
  tags?: string[];
  sort?: TaskSortField;
  order?: TaskSortOrder;
}

export interface CreateTaskDto {
  title: string;
  description?: string | null;
  listId: number;
  assigneeId?: number | null;
  taskType?: TaskType;
  dueAt: string;
  remindAt?: string | null;
  important?: boolean;
  urgent?: boolean;
  tags?: string[];
  attachmentFileIds?: number[];
  checkItems?: Array<{
    id?: number;
    title: string;
    completed?: boolean;
    sort?: number;
  }>;
  recurrenceType?: TaskRecurrenceType;
  recurrenceInterval?: number | null;
  continuousReminderEnabled?: boolean;
  continuousReminderIntervalMinutes?: number;
}

export type UpdateTaskDto = Partial<CreateTaskDto>;

export interface SnoozeTaskReminderDto {
  snoozeUntil: string;
}

export interface CreateTaskListDto {
  name: string;
  scope?: TaskListScope;
  color?: string;
  sort?: number;
  isArchived?: boolean;
}

export interface UpdateTaskListDto extends Partial<Omit<CreateTaskListDto, 'color'>> {
  color?: string | null;
}
