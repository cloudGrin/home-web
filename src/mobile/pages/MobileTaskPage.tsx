import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import {
  Button,
  Card,
  Checkbox,
  DatePicker,
  Input,
  List,
  Popup,
  PullToRefresh,
  SearchBar,
  Selector,
  SwipeAction,
  Switch,
  Tag,
  TextArea,
  Toast,
} from 'antd-mobile';
import {
  AppstoreOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EllipsisOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  FilterOutlined,
  FlagOutlined,
  FolderOpenOutlined,
  PaperClipOutlined,
  PlusOutlined,
  SettingOutlined,
  TagsOutlined,
  UploadOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useSearchParams } from 'react-router-dom';
import { createFileAccessLink, uploadFile } from '@/features/file/services/file.service';
import { resolveFileAccessUrl } from '@/features/file/utils/file-url';
import {
  closeAttachmentWindow,
  navigateAttachmentWindow,
  openAttachmentWindow,
} from '@/features/task/utils/attachmentWindow';
import {
  useCompleteTask,
  useCreateTask,
  useCreateTaskList,
  useDeleteTask,
  useDeleteTaskList,
  useReopenTask,
  useSnoozeTaskReminder,
  useTask,
  useTaskAssignees,
  useTaskLists,
  useTasks,
  useUpdateTask,
  useUpdateTaskList,
} from '@/features/task/hooks/useTasks';
import type {
  CreateTaskDto,
  CreateTaskListDto,
  QueryTasksParams,
  Task,
  TaskAssignee,
  TaskAttachment,
  TaskCheckItem,
  TaskList,
  TaskRecurrenceType,
  TaskSortField,
  TaskSortOrder,
  TaskStatus,
  TaskType,
  TaskView,
  UpdateTaskDto,
  UpdateTaskListDto,
} from '@/features/task/types/task.types';
import { taskService } from '@/features/task/services/task.service';
import {
  groupTasksByCalendarDate,
  sortCalendarOccurrences,
} from '@/features/task/utils/taskCalendar';
import { getAnniversaryDisplay, sortAnniversaryTasks } from '@/features/task/utils/taskAnniversary';
import {
  getTaskListShortcuts,
  pickDefaultTaskListId,
  saveLastTaskListId,
} from '@/features/task/utils/taskListPreference';
import { isTaskAssignedToUser } from '@/features/task/utils/taskAssignment';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { usePermission } from '@/shared/hooks/usePermission';
import { formatTaskRecurrence, mobileTaskRecurrenceLabels } from '../utils/task';
import { MobileModuleHeader } from '../components/MobileModuleHeader';

type MobileTaskView = TaskView;

interface TaskDraft {
  title: string;
  description: string;
  listId?: number;
  assigneeId?: number;
  taskType: TaskType;
  dueAt?: Date;
  remindAt?: Date;
  important: boolean;
  urgent: boolean;
  tags: string;
  attachmentFileIds: number[];
  attachments: TaskAttachment[];
  checkItems: Array<{
    id?: number;
    title: string;
    completed: boolean;
    sort: number;
  }>;
  recurrenceType: TaskRecurrenceType;
  recurrenceInterval: string;
  continuousReminderEnabled: boolean;
}

type MatrixQuadrant = 'important-urgent' | 'important' | 'urgent' | 'normal';
type MobileDatePreset = 'all' | 'today' | 'next7' | 'month' | 'custom';
type MobileSortValue = 'default' | 'dueAtAsc' | 'dueAtDesc' | 'createdAtDesc';

interface MobileDateFilter {
  preset: MobileDatePreset;
  customStart?: Date;
  customEnd?: Date;
}

const taskViews: MobileTaskView[] = ['today', 'calendar', 'matrix', 'anniversary'];

const dockViewOptions: Array<{
  label: string;
  value: MobileTaskView;
  icon: ReactNode;
}> = [
  { label: '今天', value: 'today', icon: <CheckSquareOutlined /> },
  { label: '日历', value: 'calendar', icon: <CalendarOutlined /> },
  { label: '四象限', value: 'matrix', icon: <AppstoreOutlined /> },
  { label: '纪念日', value: 'anniversary', icon: <ClockCircleOutlined /> },
];

const taskTypeOptions: Array<{ label: string; value: TaskType }> = [
  { label: '普通任务', value: 'task' },
  { label: '纪念日', value: 'anniversary' },
];

const recurrenceOptions: Array<{ label: string; value: TaskRecurrenceType }> = [
  { label: mobileTaskRecurrenceLabels.none, value: 'none' },
  { label: mobileTaskRecurrenceLabels.daily, value: 'daily' },
  { label: mobileTaskRecurrenceLabels.weekly, value: 'weekly' },
  { label: mobileTaskRecurrenceLabels.monthly, value: 'monthly' },
  { label: mobileTaskRecurrenceLabels.yearly, value: 'yearly' },
  { label: mobileTaskRecurrenceLabels.weekdays, value: 'weekdays' },
  { label: mobileTaskRecurrenceLabels.custom, value: 'custom' },
];

const reminderOffsetOptions = [
  { label: '提前 15 分钟', amount: 15, unit: 'minute' as const },
  { label: '提前 30 分钟', amount: 30, unit: 'minute' as const },
  { label: '提前 1 小时', amount: 1, unit: 'hour' as const },
  { label: '提前 2 小时', amount: 2, unit: 'hour' as const },
  { label: '提前 1 天', amount: 1, unit: 'day' as const },
  { label: '提前 2 天', amount: 2, unit: 'day' as const },
  { label: '提前 3 天', amount: 3, unit: 'day' as const },
  { label: '提前 1 周', amount: 1, unit: 'week' as const },
];

const statusOptions: Array<{ label: string; value: 'all' | TaskStatus }> = [
  { label: '全部', value: 'all' },
  { label: '待办', value: 'pending' },
  { label: '完成', value: 'completed' },
];

const datePresetOptions: Array<{ label: string; value: MobileDatePreset }> = [
  { label: '全部日期', value: 'all' },
  { label: '今天', value: 'today' },
  { label: '未来 7 天', value: 'next7' },
  { label: '本月', value: 'month' },
  { label: '自定义', value: 'custom' },
];

const sortOptions: Array<{ label: string; value: MobileSortValue }> = [
  { label: '默认排序', value: 'default' },
  { label: '截止最近', value: 'dueAtAsc' },
  { label: '截止最远', value: 'dueAtDesc' },
  { label: '创建最新', value: 'createdAtDesc' },
];

const sortParams: Record<MobileSortValue, { sort?: TaskSortField; order?: TaskSortOrder }> = {
  default: {},
  dueAtAsc: { sort: 'dueAt', order: 'ASC' },
  dueAtDesc: { sort: 'dueAt', order: 'DESC' },
  createdAtDesc: { sort: 'createdAt', order: 'DESC' },
};

const quadrantOptions: Array<{
  label: string;
  roman: string;
  value: MatrixQuadrant;
  colorClass: string;
}> = [
  { label: '重要且紧急', roman: 'I', value: 'important-urgent', colorClass: 'danger' },
  { label: '重要不紧急', roman: 'II', value: 'important', colorClass: 'warning' },
  { label: '紧急不重要', roman: 'III', value: 'urgent', colorClass: 'primary' },
  { label: '不重要不紧急', roman: 'IV', value: 'normal', colorClass: 'success' },
];

const highVolumeViews = new Set<MobileTaskView>(['calendar', 'matrix', 'anniversary']);

function parseTaskView(value: string | null): MobileTaskView {
  return value && taskViews.includes(value as MobileTaskView) ? (value as MobileTaskView) : 'today';
}

function parseTaskId(value: string | null) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

function getUserName(user?: TaskAssignee | null) {
  return user?.realName || user?.nickname || user?.username || '';
}

function getTaskAssignee(task: Task, users: TaskAssignee[]) {
  return task.assignee ?? users.find((user) => user.id === task.assigneeId) ?? null;
}

function getTaskList(task: Task, lists: TaskList[]) {
  return task.list ?? lists.find((list) => list.id === task.listId) ?? null;
}

function isPreviewableAttachment(attachment: TaskAttachment) {
  const mimeType = attachment.file?.mimeType ?? '';
  return mimeType.startsWith('image/') || mimeType === 'application/pdf';
}

function formatDateTime(value?: string | Date | null) {
  return value ? dayjs(value).format('MM-DD HH:mm') : '';
}

function formatFullDateTime(value?: string | Date | null) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-';
}

function getTaskDay(task: Task) {
  return dayjs(task.dueAt || task.remindAt || task.createdAt).format('YYYY-MM-DD');
}

function getViewTitle(view: MobileTaskView, month: dayjs.Dayjs) {
  if (view === 'today') return '今天';
  if (view === 'calendar') return month.format('M月');
  if (view === 'matrix') return '四象限';
  if (view === 'anniversary') return '纪念日';
  return '任务';
}

function getTaskListEmptyText(view: MobileTaskView) {
  if (view === 'today') return '今天没有任务';
  if (view === 'anniversary') return '暂无纪念日';
  return '暂无任务';
}

function getCalendarEmptyText(selectedDay: string) {
  return dayjs(selectedDay).isSame(dayjs(), 'day') ? '今天没有任务' : '当天没有任务';
}

function getDefaultTaskDueAt() {
  return dayjs().hour(18).minute(0).second(0).millisecond(0).toDate();
}

function buildQueryParams(
  view: MobileTaskView,
  filters: {
    keyword?: string;
    listId?: number;
    assigneeId?: number;
    status?: TaskStatus;
    tags?: string[];
    page: number;
    sortValue: MobileSortValue;
    dateFilter: MobileDateFilter;
  },
  month: dayjs.Dayjs
): QueryTasksParams {
  const sort = sortParams[filters.sortValue];
  const params: QueryTasksParams = {
    view,
    page: filters.page,
    limit: highVolumeViews.has(view) ? 100 : 50,
    keyword: filters.keyword || undefined,
    listId: filters.listId,
    assigneeId: filters.assigneeId,
    status: view === 'today' ? undefined : filters.status,
    tags: filters.tags?.length ? filters.tags : undefined,
    sort: sort.sort,
    order: sort.order,
  };

  if (view === 'calendar') {
    params.startDate = month.startOf('month').toISOString();
    params.endDate = month.endOf('month').toISOString();
  }

  return params;
}

function buildEmptyDraft({
  defaultListId,
  taskType = 'task',
  dueAt = getDefaultTaskDueAt(),
}: {
  defaultListId?: number;
  taskType?: TaskType;
  dueAt?: Date;
} = {}): TaskDraft {
  return {
    title: '',
    description: '',
    listId: defaultListId,
    assigneeId: undefined,
    taskType,
    dueAt,
    remindAt: undefined,
    important: false,
    urgent: false,
    tags: '',
    attachmentFileIds: [],
    attachments: [],
    checkItems: [],
    recurrenceType: taskType === 'anniversary' ? 'yearly' : 'none',
    recurrenceInterval: '',
    continuousReminderEnabled: taskType !== 'anniversary',
  };
}

function draftFromTask(task: Task): TaskDraft {
  return {
    title: task.title,
    description: task.description ?? '',
    listId: task.listId,
    assigneeId: task.assigneeId ?? undefined,
    taskType: task.taskType,
    dueAt: task.dueAt ? new Date(task.dueAt) : undefined,
    remindAt: task.remindAt ? new Date(task.remindAt) : undefined,
    important: task.important,
    urgent: task.urgent,
    tags: task.tags?.join(', ') ?? '',
    attachmentFileIds: task.attachments?.map((attachment) => attachment.fileId) ?? [],
    attachments: task.attachments ?? [],
    checkItems:
      task.checkItems?.map((item, index) => ({
        id: item.id,
        title: item.title,
        completed: item.completed,
        sort: item.sort ?? index,
      })) ?? [],
    recurrenceType: task.recurrenceType,
    recurrenceInterval: task.recurrenceInterval ? String(task.recurrenceInterval) : '',
    continuousReminderEnabled: task.continuousReminderEnabled ?? true,
  };
}

function tagsFromText(value: string) {
  return value
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function taskDraftToPayload(draft: TaskDraft, isEditing: boolean): CreateTaskDto | UpdateTaskDto {
  const title = draft.title.trim();
  if (!title) {
    throw new Error('请输入任务标题');
  }
  if (!draft.listId) {
    throw new Error('请选择清单');
  }
  if (!draft.dueAt) {
    throw new Error('请选择截止时间');
  }
  if (draft.remindAt && draft.dueAt && draft.remindAt.getTime() > draft.dueAt.getTime()) {
    throw new Error('提醒时间不能晚于截止时间');
  }
  if (draft.recurrenceType !== 'none' && !draft.dueAt) {
    throw new Error('重复任务必须设置截止时间');
  }
  if (draft.taskType === 'anniversary' && !draft.dueAt) {
    throw new Error('纪念日必须设置日期');
  }

  const payload: CreateTaskDto = {
    title,
    description: draft.description.trim() || null,
    listId: draft.listId,
    assigneeId: draft.assigneeId ?? null,
    taskType: draft.taskType,
    dueAt: draft.dueAt.toISOString(),
    remindAt: draft.remindAt ? draft.remindAt.toISOString() : null,
    important: draft.important,
    urgent: draft.urgent,
    tags: tagsFromText(draft.tags),
    attachmentFileIds: draft.attachmentFileIds,
    checkItems: draft.checkItems
      .map((item, index) => ({
        id: item.id,
        title: item.title.trim(),
        completed: item.completed,
        sort: index,
      }))
      .filter((item) => item.title),
    recurrenceType: draft.recurrenceType,
    recurrenceInterval: draft.recurrenceInterval ? Number(draft.recurrenceInterval) : null,
    continuousReminderEnabled: draft.continuousReminderEnabled,
  };

  return isEditing ? payload : payload;
}

function getTaskQuadrant(task: Task): MatrixQuadrant {
  if (task.important && task.urgent) return 'important-urgent';
  if (task.important) return 'important';
  if (task.urgent) return 'urgent';
  return 'normal';
}

function getQuadrantTarget(value: MatrixQuadrant) {
  return {
    important: value === 'important-urgent' || value === 'important',
    urgent: value === 'important-urgent' || value === 'urgent',
  };
}

function isSameTaskList(left: Task[], right: Task[]) {
  return (
    left.length === right.length &&
    left.every((task, index) => {
      const other = right[index];
      return other && task.id === other.id && task.updatedAt === other.updatedAt;
    })
  );
}

function flattenPagedTasks(pagedTasks: Record<number, Task[]>, page: number) {
  const tasksById = new Map<number, Task>();

  for (let pageIndex = 1; pageIndex <= page; pageIndex += 1) {
    (pagedTasks[pageIndex] ?? []).forEach((task) => {
      tasksById.set(task.id, task);
    });
  }

  return Array.from(tasksById.values());
}

export function MobileTaskPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission } = usePermission();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const view = parseTaskView(searchParams.get('view'));
  const selectedTaskId = parseTaskId(searchParams.get('taskId'));
  const selectedDay = searchParams.get('date') || dayjs().format('YYYY-MM-DD');
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [listId, setListId] = useState<number>();
  const [assigneeId, setAssigneeId] = useState<number>();
  const [status, setStatus] = useState<TaskStatus>();
  const [tagText, setTagText] = useState('');
  const [sortValue, setSortValue] = useState<MobileSortValue>('default');
  const [dateFilter, setDateFilter] = useState<MobileDateFilter>({ preset: 'all' });
  const [calendarMonth, setCalendarMonth] = useState(() => dayjs(selectedDay).startOf('month'));
  const [editorOpen, setEditorOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [listManageOpen, setListManageOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [optimisticStatuses, setOptimisticStatuses] = useState<Record<number, TaskStatus>>({});
  const [pagedTasks, setPagedTasks] = useState<Record<number, Task[]>>({});
  const [matrixMoveTask, setMatrixMoveTask] = useState<Task | null>(null);
  const canCreate = hasPermission(['task:create']);
  const canUpdate = hasPermission(['task:update']);
  const canDelete = hasPermission(['task:delete']);
  const canComplete = hasPermission(['task:complete']);
  const canManageLists = hasPermission(['task-list:manage']);

  const taskListsQuery = useTaskLists();
  const assigneesQuery = useTaskAssignees();
  const taskLists = taskListsQuery.data ?? [];
  const activeLists = taskLists.filter((list) => !list.isArchived);
  const users = assigneesQuery.data ?? [];
  const queryParams = useMemo(() => {
    const tags = tagsFromText(tagText);
    return buildQueryParams(
      view,
      {
        keyword: keyword.trim(),
        listId,
        assigneeId,
        status,
        tags,
        page,
        sortValue,
        dateFilter,
      },
      calendarMonth
    );
  }, [
    assigneeId,
    calendarMonth,
    dateFilter,
    keyword,
    listId,
    page,
    sortValue,
    status,
    tagText,
    view,
  ]);
  const tasksQuery = useTasks(queryParams);
  const selectedTaskQuery = useTask(selectedTaskId ?? null);
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const completeTask = useCompleteTask();
  const reopenTask = useReopenTask();
  const snoozeTaskReminder = useSnoozeTaskReminder();
  const deleteTask = useDeleteTask();
  const togglePendingTaskId = (
    completeTask.isPending
      ? completeTask.variables
      : reopenTask.isPending
        ? reopenTask.variables
        : undefined
  ) as number | undefined;
  const aggregationKey = useMemo(
    () =>
      [
        view,
        keyword.trim(),
        listId,
        assigneeId,
        status,
        tagText,
        sortValue,
        dateFilter.preset,
        dateFilter.customStart?.toISOString(),
        dateFilter.customEnd?.toISOString(),
        calendarMonth.format('YYYY-MM'),
      ].join('|'),
    [assigneeId, calendarMonth, dateFilter, keyword, listId, sortValue, status, tagText, view]
  );
  const pageTasks = useMemo(() => tasksQuery.data?.items ?? [], [tasksQuery.data?.items]);
  const aggregatedTasks = useMemo(() => flattenPagedTasks(pagedTasks, page), [page, pagedTasks]);
  const rawTasks = page <= 1 ? pageTasks : aggregatedTasks;
  const tasks = useMemo(
    () =>
      rawTasks.map((task) => {
        const optimisticStatus = optimisticStatuses[task.id];
        return optimisticStatus ? { ...task, status: optimisticStatus } : task;
      }),
    [optimisticStatuses, rawTasks]
  );
  const canLoadMore = (tasksQuery.data?.total ?? 0) > rawTasks.length;
  const defaultListId = pickDefaultTaskListId(activeLists, listId);
  const selectedTask =
    tasks.find((task) => task.id === selectedTaskId) ?? selectedTaskQuery.data ?? null;
  const defaultTaskType: TaskType = view === 'anniversary' ? 'anniversary' : 'task';

  useEffect(() => {
    setPagedTasks({});
    setPage(1);
  }, [aggregationKey]);

  useEffect(() => {
    setPagedTasks((previous) => {
      const hasStalePages = Object.keys(previous).some((pageKey) => Number(pageKey) > page);
      const previousPageTasks = previous[page] ?? [];
      if (!hasStalePages && isSameTaskList(previousPageTasks, pageTasks)) {
        return previous;
      }

      const next: Record<number, Task[]> = {};
      Object.entries(previous).forEach(([pageKey, tasks]) => {
        const pageNumber = Number(pageKey);
        if (pageNumber <= page) {
          next[pageNumber] = tasks;
        }
      });
      next[page] = pageTasks;
      return next;
    });
  }, [page, pageTasks]);

  useEffect(() => {
    setOptimisticStatuses((previous) => {
      const next = { ...previous };
      let changed = false;

      rawTasks.forEach((task) => {
        if (next[task.id] === task.status) {
          delete next[task.id];
          changed = true;
        }
      });

      return changed ? next : previous;
    });
  }, [rawTasks]);

  useEffect(() => {
    if (view === 'calendar') {
      const nextMonth = dayjs(selectedDay).startOf('month');
      if (!nextMonth.isSame(calendarMonth, 'month')) {
        setCalendarMonth(nextMonth);
      }
    }
  }, [calendarMonth, selectedDay, view]);

  const updateQuery = (updater: (next: URLSearchParams) => void) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      updater(next);
      return next;
    });
  };

  const setTaskView = (nextView: MobileTaskView) => {
    setPage(1);
    if (nextView === 'matrix') {
      setStatus(undefined);
    }
    updateQuery((next) => {
      next.set('view', nextView);
      next.delete('taskId');
      if (nextView === 'calendar' && !next.get('date')) {
        next.set('date', selectedDay);
      }
    });
  };

  const setCalendarDay = (day: string) => {
    setPage(1);
    updateQuery((next) => {
      next.set('view', 'calendar');
      next.set('date', day);
      next.delete('taskId');
    });
  };

  const changeCalendarMonth = (nextMonth: dayjs.Dayjs) => {
    const normalized = nextMonth.startOf('month');
    const currentDate = dayjs(selectedDay).date();
    const nextDay = normalized.date(Math.min(currentDate, normalized.daysInMonth()));
    setPage(1);
    setCalendarMonth(normalized);
    setCalendarDay(nextDay.format('YYYY-MM-DD'));
  };

  const changeKeyword = (value: string) => {
    setKeyword(value);
    setPage(1);
  };

  const openTaskDetail = (task: Task) => {
    updateQuery((next) => {
      next.set('taskId', String(task.id));
    });
  };

  const closeTaskDetail = () => {
    updateQuery((next) => {
      next.delete('taskId');
    });
  };

  const openCreate = () => {
    setEditingTask(null);
    setEditorOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditingTask(task);
    setEditorOpen(true);
  };

  const moveTaskToQuadrant = (task: Task, target: Pick<UpdateTaskDto, 'important' | 'urgent'>) => {
    if (task.important === target.important && task.urgent === target.urgent) {
      setMatrixMoveTask(null);
      return;
    }

    updateTask.mutate(
      {
        id: task.id,
        data: target,
      },
      {
        onSuccess: () => {
          setMatrixMoveTask(null);
          setPage(1);
        },
      }
    );
  };

  const handleSubmit = (payload: CreateTaskDto | UpdateTaskDto) => {
    if (payload.listId) {
      saveLastTaskListId(payload.listId);
    }

    if (editingTask) {
      updateTask.mutate(
        { id: editingTask.id, data: payload },
        {
          onSuccess: () => {
            setEditorOpen(false);
            setEditingTask(null);
          },
        }
      );
      return;
    }

    createTask.mutate(payload as CreateTaskDto, {
      onSuccess: () => setEditorOpen(false),
    });
  };

  const toggleComplete = (task: Task) => {
    if (togglePendingTaskId === task.id) {
      return;
    }

    const nextStatus: TaskStatus = task.status === 'completed' ? 'pending' : 'completed';
    setOptimisticStatuses((previous) => ({ ...previous, [task.id]: nextStatus }));

    const rollback = () => {
      setOptimisticStatuses((previous) => {
        const next = { ...previous };
        delete next[task.id];
        return next;
      });
    };

    if (task.status === 'completed') {
      reopenTask.mutate(task.id, {
        onSuccess: (updatedTask) =>
          setOptimisticStatuses((previous) => ({
            ...previous,
            [task.id]: updatedTask.status,
          })),
        onError: rollback,
      });
      return;
    }
    completeTask.mutate(task.id, {
      onSuccess: (updatedTask) =>
        setOptimisticStatuses((previous) => ({
          ...previous,
          [task.id]: updatedTask.status,
        })),
      onError: rollback,
    });
  };

  return (
    <div className="mobile-page mobile-task-page">
      <MobileModuleHeader
        taskMode
        title={getViewTitle(view, calendarMonth)}
        actions={
          <>
            <Button fill="none" onClick={() => setFilterOpen(true)}>
              <FilterOutlined />
            </Button>
            {canManageLists ? (
              <Button fill="none" onClick={() => setListManageOpen(true)}>
                <SettingOutlined />
              </Button>
            ) : null}
          </>
        }
      />

      <div className="mobile-task-search">
        <SearchBar placeholder="搜索任务" value={keyword} onChange={changeKeyword} />
      </div>

      <div className="mobile-task-content">
        <PullToRefresh onRefresh={async () => void (await tasksQuery.refetch())}>
          {view === 'calendar' ? (
            <CalendarTaskView
              month={calendarMonth}
              selectedDay={selectedDay}
              tasks={tasks}
              lists={taskLists}
              users={users}
              currentUserId={currentUserId}
              loading={tasksQuery.isLoading}
              onMonthChange={changeCalendarMonth}
              onDayChange={setCalendarDay}
              onOpen={openTaskDetail}
              onEdit={openEdit}
              onToggleComplete={toggleComplete}
              togglePendingTaskId={togglePendingTaskId}
              onDelete={(task) => deleteTask.mutate(task.id)}
              canUpdate={canUpdate}
              canDelete={canDelete}
              canComplete={canComplete}
            />
          ) : view === 'matrix' ? (
            <MatrixTaskView
              tasks={tasks}
              lists={taskLists}
              users={users}
              currentUserId={currentUserId}
              loading={tasksQuery.isLoading}
              onOpen={openTaskDetail}
              onEdit={openEdit}
              onToggleComplete={toggleComplete}
              togglePendingTaskId={togglePendingTaskId}
              onDelete={(task) => deleteTask.mutate(task.id)}
              canUpdate={canUpdate}
              canDelete={canDelete}
              canComplete={canComplete}
            />
          ) : view === 'anniversary' ? (
            <AnniversaryTaskView
              tasks={tasks}
              loading={tasksQuery.isLoading}
              onOpen={openTaskDetail}
              onEdit={openEdit}
              onDelete={(task) => deleteTask.mutate(task.id)}
              canUpdate={canUpdate}
              canDelete={canDelete}
            />
          ) : (
            <TaskListView
              tasks={tasks}
              lists={taskLists}
              users={users}
              currentUserId={currentUserId}
              loading={tasksQuery.isLoading}
              emptyText={getTaskListEmptyText(view)}
              showDayHeader={view === 'list'}
              onOpen={openTaskDetail}
              onEdit={openEdit}
              onToggleComplete={toggleComplete}
              togglePendingTaskId={togglePendingTaskId}
              onDelete={(task) => deleteTask.mutate(task.id)}
              canUpdate={canUpdate}
              canDelete={canDelete}
              canComplete={canComplete}
            />
          )}
        </PullToRefresh>
        {canLoadMore ? (
          <div className="mobile-load-more">
            <Button
              size="small"
              fill="outline"
              loading={tasksQuery.isFetching}
              onClick={() => setPage((current) => current + 1)}
            >
              加载更多
            </Button>
          </div>
        ) : null}
      </div>

      {canCreate && activeLists.length > 0 ? (
        <Button className="mobile-fab mobile-task-fab" color="primary" onClick={openCreate}>
          <PlusOutlined />
        </Button>
      ) : null}

      <TaskDock view={view} onChange={setTaskView} />

      <TaskDetailSheet
        open={Boolean(selectedTaskId)}
        loading={selectedTaskQuery.isLoading && !selectedTask}
        task={selectedTask}
        lists={taskLists}
        users={users}
        currentUserId={currentUserId}
        togglePendingTaskId={togglePendingTaskId}
        onClose={closeTaskDetail}
        onEdit={(task) => {
          openEdit(task);
          closeTaskDetail();
        }}
        onToggleComplete={toggleComplete}
        onSnooze={(task, snoozeUntil) =>
          snoozeTaskReminder.mutate({ id: task.id, data: { snoozeUntil } })
        }
        snoozePending={snoozeTaskReminder.isPending}
        onUpdateCheckItems={(task, checkItems) =>
          updateTask.mutate({
            id: task.id,
            data: {
              checkItems,
            },
          })
        }
        onDelete={(task) =>
          deleteTask.mutate(task.id, {
            onSuccess: closeTaskDetail,
          })
        }
        onMoveQuadrant={(task) => setMatrixMoveTask(task)}
        canUpdate={canUpdate}
        canDelete={canDelete}
        canComplete={canComplete}
      />

      <TaskEditorPopup
        open={editorOpen}
        task={editingTask}
        lists={activeLists}
        users={users}
        defaultListId={defaultListId}
        defaultTaskType={defaultTaskType}
        submitting={createTask.isPending || updateTask.isPending}
        onClose={() => {
          setEditorOpen(false);
          setEditingTask(null);
        }}
        onSubmit={handleSubmit}
      />

      <TaskFilterPopup
        open={filterOpen}
        lists={taskLists}
        users={users}
        listId={listId}
        assigneeId={assigneeId}
        status={status}
        tagText={tagText}
        sortValue={sortValue}
        dateFilter={dateFilter}
        view={view}
        onClose={() => setFilterOpen(false)}
        onApply={(next) => {
          setPage(1);
          setListId(next.listId);
          setAssigneeId(next.assigneeId);
          setStatus(next.status);
          setTagText(next.tagText);
          setSortValue(next.sortValue);
          setDateFilter(next.dateFilter);
          setFilterOpen(false);
        }}
      />

      {canManageLists ? (
        <TaskListManagePopup
          open={listManageOpen}
          lists={taskLists}
          onClose={() => setListManageOpen(false)}
        />
      ) : null}

      <TaskQuadrantSheet
        open={Boolean(matrixMoveTask)}
        task={matrixMoveTask}
        onClose={() => setMatrixMoveTask(null)}
        onSelect={(target) => {
          if (!matrixMoveTask) return;
          moveTaskToQuadrant(matrixMoveTask, target);
        }}
      />
    </div>
  );
}

function TaskDock({
  view,
  onChange,
}: {
  view: MobileTaskView;
  onChange: (view: MobileTaskView) => void;
}) {
  return (
    <nav className="mobile-task-dock">
      {dockViewOptions.map((item) => (
        <button
          key={item.value}
          type="button"
          className={`mobile-task-dock-item${view === item.value ? ' active' : ''}`}
          onClick={() => onChange(item.value)}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

function AnniversaryTaskView({
  tasks,
  loading,
  onOpen,
  onEdit,
  onDelete,
  canUpdate,
  canDelete,
}: {
  tasks: Task[];
  loading?: boolean;
  onOpen: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const sortedTasks = useMemo(() => sortAnniversaryTasks(tasks), [tasks]);

  if (loading) {
    return <Card className="mobile-task-list-card">加载中...</Card>;
  }

  if (sortedTasks.length === 0) {
    return <MobileEmptyState title="暂无纪念日" />;
  }

  return (
    <div className="mobile-anniversary-list">
      {sortedTasks.map((task) => (
        <AnniversaryTaskCard
          key={task.id}
          task={task}
          onOpen={onOpen}
          onEdit={canUpdate ? onEdit : undefined}
          onDelete={canDelete ? onDelete : undefined}
        />
      ))}
    </div>
  );
}

function AnniversaryTaskCard({
  task,
  onOpen,
  onEdit,
  onDelete,
}: {
  task: Task;
  onOpen: (task: Task) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
}) {
  const display = getAnniversaryDisplay(task);
  const isCompleted = task.status === 'completed';
  const countdownNumber = display.daysUntil === null ? '--' : String(display.daysUntil);
  const countdownUnit = display.daysUntil === 0 ? '今天' : '天';
  const content = (
    <div
      className={`mobile-anniversary-card${isCompleted ? ' completed' : ''}`}
      data-testid={`mobile-anniversary-card-${task.id}`}
      onClick={() => onOpen(task)}
    >
      <div className="mobile-anniversary-countdown">
        <strong>{countdownNumber}</strong>
        <span>{countdownUnit}</span>
      </div>
      <div className="mobile-anniversary-card-title">
        <h2>{task.title}</h2>
        <span>{display.nextDateLabel}</span>
      </div>
      <div className="mobile-anniversary-card-meta">
        <span>{display.daysUntil === 0 ? '就是今天' : display.countdownText}</span>
      </div>
    </div>
  );

  const rightActions = [
    ...(onEdit
      ? [{ key: 'edit', text: '编辑', color: 'primary' as const, onClick: () => onEdit(task) }]
      : []),
    ...(onDelete
      ? [{ key: 'delete', text: '删除', color: 'danger' as const, onClick: () => onDelete(task) }]
      : []),
  ];

  if (rightActions.length === 0) {
    return content;
  }

  return <SwipeAction rightActions={rightActions}>{content}</SwipeAction>;
}

function TaskListView({
  tasks,
  lists,
  users,
  currentUserId,
  loading,
  emptyText,
  showDayHeader,
  onOpen,
  onEdit,
  onToggleComplete,
  togglePendingTaskId,
  onDelete,
  canUpdate,
  canDelete,
  canComplete,
}: {
  tasks: Task[];
  lists: TaskList[];
  users: TaskAssignee[];
  currentUserId?: number;
  loading?: boolean;
  emptyText: string;
  showDayHeader?: boolean;
  onOpen: (task: Task) => void;
  onEdit: (task: Task) => void;
  onToggleComplete: (task: Task) => void;
  togglePendingTaskId?: number;
  onDelete: (task: Task) => void;
  canUpdate: boolean;
  canDelete: boolean;
  canComplete: boolean;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach((task) => {
      const key = getTaskDay(task);
      map.set(key, [...(map.get(key) ?? []), task]);
    });
    return Array.from(map.entries()).sort(([left], [right]) => left.localeCompare(right));
  }, [tasks]);

  if (loading) {
    return <Card className="mobile-task-list-card">加载中...</Card>;
  }

  if (tasks.length === 0) {
    return <MobileEmptyState title={emptyText} />;
  }

  return (
    <div className="mobile-task-groups">
      {grouped.map(([day, dayTasks]) => (
        <section key={day}>
          {showDayHeader ? (
            <div className="mobile-task-day-title">{dayjs(day).format('MM月DD日')}</div>
          ) : null}
          <div className="mobile-task-list-card">
            {dayTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                lists={lists}
                users={users}
                currentUserId={currentUserId}
                onOpen={onOpen}
                onEdit={canUpdate ? onEdit : undefined}
                onToggleComplete={onToggleComplete}
                togglePending={togglePendingTaskId === task.id}
                onDelete={canDelete ? onDelete : undefined}
                canToggleComplete={task.status === 'completed' ? canUpdate : canComplete}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function TaskRow({
  task,
  lists,
  users,
  currentUserId,
  onOpen,
  onEdit,
  onToggleComplete,
  togglePending,
  onDelete,
  canToggleComplete = true,
  compact,
  displayDueAt,
  displayRemindAt,
}: {
  task: Task;
  lists: TaskList[];
  users: TaskAssignee[];
  currentUserId?: number;
  onOpen: (task: Task) => void;
  onEdit?: (task: Task) => void;
  onToggleComplete: (task: Task) => void;
  togglePending?: boolean;
  onDelete?: (task: Task) => void;
  canToggleComplete?: boolean;
  compact?: boolean;
  displayDueAt?: string | null;
  displayRemindAt?: string | null;
}) {
  const list = getTaskList(task, lists);
  const assignee = getTaskAssignee(task, users);
  const isCompleted = task.status === 'completed';
  const dueAt = displayDueAt ?? task.dueAt;
  const remindAt = displayRemindAt ?? task.remindAt;
  const anniversaryDisplay =
    task.taskType === 'anniversary' && !displayDueAt && !displayRemindAt
      ? getAnniversaryDisplay(task)
      : undefined;
  const content = (
    <div className={`mobile-task-row${compact ? ' compact' : ''}`} onClick={() => onOpen(task)}>
      <Checkbox
        checked={isCompleted}
        disabled={togglePending || !canToggleComplete}
        onClick={(event: MouseEvent) => event.stopPropagation()}
        onChange={() => {
          if (canToggleComplete) {
            onToggleComplete(task);
          }
        }}
      />
      <div className="mobile-task-row-main">
        <div className={`mobile-task-title${isCompleted ? ' completed' : ''}`}>{task.title}</div>
        <div className="mobile-task-meta-line">
          {anniversaryDisplay ? (
            <>
              <span className="primary">{anniversaryDisplay.nextDateLabel}</span>
              <span>{anniversaryDisplay.countdownText}</span>
              <span>纪念日</span>
            </>
          ) : (
            <>
              {dueAt ? <span className="primary">{formatDateTime(dueAt)}</span> : null}
              {remindAt ? <span>提醒</span> : null}
              {task.recurrenceType !== 'none' ? <span>重复</span> : null}
            </>
          )}
          {task.checkItems?.length ? (
            <span>
              {task.checkItems.filter((item) => item.completed).length}/{task.checkItems.length}
            </span>
          ) : null}
          {task.attachments?.length ? <span>附件 {task.attachments.length}</span> : null}
          {assignee ? <span>{getUserName(assignee)}</span> : null}
          {isTaskAssignedToUser(task, currentUserId) ? (
            <span className="mobile-task-assigned-me">指派给我</span>
          ) : null}
        </div>
      </div>
      {list ? <span className="mobile-task-list-name">{list.name}</span> : null}
    </div>
  );

  const rightActions = [
    ...(onEdit
      ? [{ key: 'edit', text: '编辑', color: 'primary' as const, onClick: () => onEdit(task) }]
      : []),
    ...(onDelete
      ? [{ key: 'delete', text: '删除', color: 'danger' as const, onClick: () => onDelete(task) }]
      : []),
  ];

  if (rightActions.length === 0 || compact) {
    return content;
  }

  return <SwipeAction rightActions={rightActions}>{content}</SwipeAction>;
}

function MobileEmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mobile-task-empty">
      <div className="mobile-task-empty-illustration">
        <CalendarOutlined />
      </div>
      <strong>{title}</strong>
      <span>{subtitle ?? '放松一下吧'}</span>
    </div>
  );
}

function CalendarTaskView({
  month,
  selectedDay,
  tasks,
  lists,
  users,
  currentUserId,
  loading,
  onMonthChange,
  onDayChange,
  onOpen,
  onEdit,
  onToggleComplete,
  togglePendingTaskId,
  onDelete,
  canUpdate,
  canDelete,
  canComplete,
}: {
  month: dayjs.Dayjs;
  selectedDay: string;
  tasks: Task[];
  lists: TaskList[];
  users: TaskAssignee[];
  currentUserId?: number;
  loading?: boolean;
  onMonthChange: (month: dayjs.Dayjs) => void;
  onDayChange: (day: string) => void;
  onOpen: (task: Task) => void;
  onEdit: (task: Task) => void;
  onToggleComplete: (task: Task) => void;
  togglePendingTaskId?: number;
  onDelete: (task: Task) => void;
  canUpdate: boolean;
  canDelete: boolean;
  canComplete: boolean;
}) {
  const [mode, setMode] = useState<'month' | 'list'>('month');
  const days = useMemo(() => {
    const start = month.startOf('month').startOf('week');
    return Array.from({ length: 42 }, (_, index) => start.add(index, 'day'));
  }, [month]);
  const monthStart = month.startOf('month').toISOString();
  const monthEnd = month.endOf('month').toISOString();
  const occurrencesByDay = useMemo(
    () => groupTasksByCalendarDate(tasks, monthStart, monthEnd),
    [monthEnd, monthStart, tasks]
  );
  const selectedOccurrences = sortCalendarOccurrences(occurrencesByDay.get(selectedDay) ?? []);
  const groupedOccurrences = useMemo(
    () =>
      Array.from(occurrencesByDay.entries())
        .filter(([day]) => dayjs(day).isSame(month, 'month'))
        .sort(([left], [right]) => left.localeCompare(right)),
    [month, occurrencesByDay]
  );

  return (
    <div className="mobile-calendar-view">
      <div className="mobile-calendar-controls">
        <Button size="mini" fill="none" onClick={() => onMonthChange(month.subtract(1, 'month'))}>
          上月
        </Button>
        <strong>{month.format('YYYY年M月')}</strong>
        <Button size="mini" fill="none" onClick={() => onMonthChange(month.add(1, 'month'))}>
          下月
        </Button>
      </div>
      <div className="mobile-calendar-mode">
        <Button
          size="mini"
          color={mode === 'month' ? 'primary' : 'default'}
          onClick={() => setMode('month')}
        >
          月历
        </Button>
        <Button
          size="mini"
          color={mode === 'list' ? 'primary' : 'default'}
          onClick={() => setMode('list')}
        >
          列表
        </Button>
      </div>
      {mode === 'month' ? (
        <>
          <div className="mobile-calendar-weekdays">
            {['日', '一', '二', '三', '四', '五', '六'].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="mobile-calendar-board">
            {days.map((day) => {
              const dateKey = day.format('YYYY-MM-DD');
              const count = occurrencesByDay.get(dateKey)?.length ?? 0;
              const active = selectedDay === dateKey;
              return (
                <div key={dateKey} className="flex items-center justify-center">
                  <button
                    className={`mobile-calendar-date${active ? ' active' : ''}${
                      day.isSame(month, 'month') ? '' : ' muted'
                    }`}
                    type="button"
                    onClick={() => onDayChange(dateKey)}
                  >
                    <span>{day.date()}</span>
                    {count > 0 ? <i>{count}</i> : null}
                  </button>
                </div>
              );
            })}
          </div>
          <div className="mobile-calendar-selected-card">
            <div className="mobile-calendar-selected-title">
              {dayjs(selectedDay).format('M月D日')}
            </div>
            {loading ? (
              <div className="mobile-muted">加载中...</div>
            ) : selectedOccurrences.length === 0 ? (
              <MobileEmptyState title={getCalendarEmptyText(selectedDay)} />
            ) : (
              <div className="mobile-task-list-card flush">
                {selectedOccurrences.map((item) => (
                  <TaskRow
                    key={item.key}
                    task={item.task}
                    lists={lists}
                    users={users}
                    currentUserId={currentUserId}
                    onOpen={onOpen}
                    onEdit={canUpdate ? onEdit : undefined}
                    onToggleComplete={onToggleComplete}
                    togglePending={togglePendingTaskId === item.task.id}
                    onDelete={canDelete ? onDelete : undefined}
                    canToggleComplete={item.task.status === 'completed' ? canUpdate : canComplete}
                    displayDueAt={item.occurrenceDueAt}
                    displayRemindAt={item.occurrenceRemindAt}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      ) : loading ? (
        <Card className="mobile-task-list-card">加载中...</Card>
      ) : groupedOccurrences.length === 0 ? (
        <MobileEmptyState title="本月没有任务" />
      ) : (
        <div className="mobile-task-groups">
          {groupedOccurrences.map(([day, items]) => (
            <section key={day}>
              <div className="mobile-task-day-title">{dayjs(day).format('MM月DD日')}</div>
              <div className="mobile-task-list-card">
                {sortCalendarOccurrences(items).map((item) => (
                  <TaskRow
                    key={item.key}
                    task={item.task}
                    lists={lists}
                    users={users}
                    currentUserId={currentUserId}
                    onOpen={onOpen}
                    onEdit={canUpdate ? onEdit : undefined}
                    onToggleComplete={onToggleComplete}
                    togglePending={togglePendingTaskId === item.task.id}
                    onDelete={canDelete ? onDelete : undefined}
                    canToggleComplete={item.task.status === 'completed' ? canUpdate : canComplete}
                    displayDueAt={item.occurrenceDueAt}
                    displayRemindAt={item.occurrenceRemindAt}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function MatrixTaskView({
  tasks,
  lists,
  users,
  currentUserId,
  loading,
  onOpen,
  onEdit,
  onToggleComplete,
  togglePendingTaskId,
  onDelete,
  canUpdate,
  canDelete,
  canComplete,
}: {
  tasks: Task[];
  lists: TaskList[];
  users: TaskAssignee[];
  currentUserId?: number;
  loading?: boolean;
  onOpen: (task: Task) => void;
  onEdit: (task: Task) => void;
  onToggleComplete: (task: Task) => void;
  togglePendingTaskId?: number;
  onDelete: (task: Task) => void;
  canUpdate: boolean;
  canDelete: boolean;
  canComplete: boolean;
}) {
  const tasksByQuadrant = useMemo(() => {
    const map = new Map<MatrixQuadrant, Task[]>();
    quadrantOptions.forEach((option) => map.set(option.value, []));
    tasks.forEach((task) => {
      const key = getTaskQuadrant(task);
      map.set(key, [...(map.get(key) ?? []), task]);
    });
    return map;
  }, [tasks]);

  if (loading) {
    return <Card className="mobile-task-list-card">加载中...</Card>;
  }

  return (
    <div className="mobile-matrix-board">
      {quadrantOptions.map((option) => {
        const quadrantTasks = tasksByQuadrant.get(option.value) ?? [];
        return (
          <section key={option.value} className={`mobile-matrix-panel ${option.colorClass}`}>
            <div className="mobile-matrix-panel-header">
              <span>{option.roman}</span>
              <strong>{option.label}</strong>
            </div>
            {quadrantTasks.length === 0 ? (
              <div className="mobile-matrix-empty">没有任务</div>
            ) : (
              <div className="mobile-matrix-task-list">
                {quadrantTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    compact
                    task={task}
                    lists={lists}
                    users={users}
                    currentUserId={currentUserId}
                    onOpen={onOpen}
                    onEdit={canUpdate ? onEdit : undefined}
                    onToggleComplete={onToggleComplete}
                    togglePending={togglePendingTaskId === task.id}
                    onDelete={canDelete ? onDelete : undefined}
                    canToggleComplete={task.status === 'completed' ? canUpdate : canComplete}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function TaskDetailSheet({
  open,
  loading,
  task,
  lists,
  users,
  currentUserId,
  togglePendingTaskId,
  onClose,
  onEdit,
  onToggleComplete,
  onSnooze,
  snoozePending,
  onUpdateCheckItems,
  onDelete,
  onMoveQuadrant,
  canUpdate,
  canDelete,
  canComplete,
}: {
  open: boolean;
  loading?: boolean;
  task: Task | null;
  lists: TaskList[];
  users: TaskAssignee[];
  currentUserId?: number;
  togglePendingTaskId?: number;
  onClose: () => void;
  onEdit: (task: Task) => void;
  onToggleComplete: (task: Task) => void;
  onSnooze: (task: Task, snoozeUntil: string) => void;
  snoozePending?: boolean;
  onUpdateCheckItems: (task: Task, checkItems: TaskCheckItem[]) => void;
  onDelete: (task: Task) => void;
  onMoveQuadrant: (task: Task) => void;
  canUpdate: boolean;
  canDelete: boolean;
  canComplete: boolean;
}) {
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const list = task ? getTaskList(task, lists) : null;
  const assignee = task ? getTaskAssignee(task, users) : null;
  const canToggleTask = task ? (task.status === 'completed' ? canUpdate : canComplete) : false;
  const togglePending = task ? togglePendingTaskId === task.id : false;

  const handleDelete = async () => {
    if (!task) return;
    onDelete(task);
  };

  return (
    <Popup visible={open} onMaskClick={onClose} bodyStyle={{ borderRadius: '18px 18px 0 0' }}>
      <div className="mobile-popup-body mobile-task-detail-sheet">
        <div className="mobile-popup-header">
          <strong>任务详情</strong>
          <Button size="mini" fill="none" onClick={onClose}>
            关闭
          </Button>
        </div>
        {loading || !task ? (
          <div className="mobile-empty">{loading ? '加载中...' : '任务不存在'}</div>
        ) : (
          <>
            <div className="mobile-task-detail-title-row">
              <Checkbox
                checked={task.status === 'completed'}
                disabled={togglePendingTaskId === task.id || !canToggleTask}
                onChange={() => {
                  if (canToggleTask) {
                    onToggleComplete(task);
                  }
                }}
              />
              <h2 className={task.status === 'completed' ? 'completed' : ''}>{task.title}</h2>
            </div>
            <div className="mobile-task-detail-meta-card">
              <DetailLine label="清单" value={list?.name || '-'} />
              <DetailLine label="负责人" value={getUserName(assignee) || '-'} />
              <DetailLine label="截止" value={formatFullDateTime(task.dueAt)} />
              <DetailLine label="提醒" value={formatFullDateTime(task.remindAt)} />
              <DetailLine
                label="重复"
                value={formatTaskRecurrence(task.recurrenceType, task.recurrenceInterval)}
              />
              <DetailLine
                label="持续"
                value={task.continuousReminderEnabled ? '每 30 分钟，直到完成' : '关闭'}
              />
            </div>
            {task.description ? (
              <div className="mobile-task-detail-note">{task.description}</div>
            ) : null}
            {task.checkItems?.length ? (
              <div className="mobile-task-detail-card">
                <div className="mobile-task-detail-card-title">检查清单</div>
                {task.checkItems.map((item, index) => (
                  <Checkbox
                    key={item.id ?? index}
                    checked={item.completed}
                    disabled={!canUpdate}
                    onChange={(checked) => {
                      if (!canUpdate) return;
                      const next = (task.checkItems ?? []).map((current, currentIndex) => ({
                        id: current.id,
                        title: current.title,
                        completed: currentIndex === index ? checked : current.completed,
                        sort: current.sort ?? currentIndex,
                      }));
                      onUpdateCheckItems(task, next);
                    }}
                  >
                    {item.title}
                  </Checkbox>
                ))}
              </div>
            ) : null}
            {task.attachments?.length ? (
              <TaskAttachmentList task={task} attachments={task.attachments} />
            ) : null}
            <div className="mobile-chip-row">
              {task.important ? <Tag color="danger">重要</Tag> : null}
              {task.urgent ? <Tag color="warning">紧急</Tag> : null}
              {isTaskAssignedToUser(task, currentUserId) ? (
                <Tag color="primary">指派给我</Tag>
              ) : null}
              {task.taskType === 'anniversary' ? <Tag color="primary">纪念日</Tag> : null}
              {task.tags?.map((tag) => (
                <Tag key={tag}>{tag}</Tag>
              ))}
            </div>
            <div className="mobile-sheet-actions">
              {canDelete ? (
                <Button
                  size="small"
                  color="danger"
                  fill="outline"
                  onClick={() => void handleDelete()}
                >
                  <DeleteOutlined /> 删除
                </Button>
              ) : null}
              <div>
                {canUpdate ? (
                  <Button
                    size="small"
                    color="primary"
                    fill="outline"
                    onClick={() => onMoveQuadrant(task)}
                  >
                    <AppstoreOutlined /> 移动象限
                  </Button>
                ) : null}
                {canUpdate ? (
                  <Button size="small" color="primary" fill="outline" onClick={() => onEdit(task)}>
                    <EditOutlined /> 编辑
                  </Button>
                ) : null}
                {canUpdate && task.remindAt && task.status !== 'completed' ? (
                  <Button
                    size="small"
                    color="primary"
                    fill="outline"
                    loading={snoozePending}
                    onClick={() => setSnoozeOpen(true)}
                  >
                    <ClockCircleOutlined /> 稍后
                  </Button>
                ) : null}
                {canToggleTask ? (
                  <Button
                    size="small"
                    color="success"
                    disabled={togglePending}
                    onClick={() => {
                      if (togglePending) return;
                      onToggleComplete(task);
                    }}
                  >
                    {task.status === 'completed' ? '取消完成' : '完成'}
                  </Button>
                ) : null}
              </div>
            </div>
            <SnoozeSheet
              open={snoozeOpen}
              onClose={() => setSnoozeOpen(false)}
              onSelect={(snoozeUntil) => {
                onSnooze(task, snoozeUntil);
                setSnoozeOpen(false);
              }}
            />
          </>
        )}
      </div>
    </Popup>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="mobile-task-detail-line">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TaskAttachmentList({ task, attachments }: { task: Task; attachments: TaskAttachment[] }) {
  const openAttachment = async (
    attachment: TaskAttachment,
    disposition: 'inline' | 'attachment'
  ) => {
    let openedWindow: Window | null = null;
    try {
      if (disposition === 'attachment') {
        openedWindow = openAttachmentWindow();
        const { url } = await taskService.createAttachmentAccessLink(
          task.id,
          attachment.fileId,
          'attachment'
        );
        navigateAttachmentWindow(openedWindow, resolveFileAccessUrl(url));
        return;
      }

      const file = attachment.file;
      if (file?.isPublic && file.url) {
        window.open(resolveFileAccessUrl(file.url), '_blank', 'noopener,noreferrer');
        return;
      }
      openedWindow = openAttachmentWindow();
      const { url } = await createFileAccessLink(attachment.fileId, 'inline');
      navigateAttachmentWindow(openedWindow, resolveFileAccessUrl(url));
    } catch {
      closeAttachmentWindow(openedWindow);
      Toast.show({ icon: 'fail', content: '附件访问失败', position: 'center' });
    }
  };

  return (
    <div className="mobile-task-detail-card">
      <div className="mobile-task-detail-card-title">附件</div>
      {attachments.map((attachment) => (
        <div key={attachment.fileId} className="mobile-task-attachment-row">
          <div>
            <strong>{attachment.file?.originalName || `文件 #${attachment.fileId}`}</strong>
            <span>{attachment.file?.mimeType || '未知类型'}</span>
          </div>
          <div>
            {isPreviewableAttachment(attachment) ? (
              <Button
                size="mini"
                fill="outline"
                onClick={() => void openAttachment(attachment, 'inline')}
              >
                <EyeOutlined /> 预览
              </Button>
            ) : null}
            <Button
              size="mini"
              fill="outline"
              onClick={() => void openAttachment(attachment, 'attachment')}
            >
              <DownloadOutlined /> 下载
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

const snoozeOptions = [
  { label: '15 分钟', getValue: () => dayjs().add(15, 'minute').toISOString() },
  { label: '30 分钟', getValue: () => dayjs().add(30, 'minute').toISOString() },
  { label: '1 小时', getValue: () => dayjs().add(1, 'hour').toISOString() },
  { label: '3 小时', getValue: () => dayjs().add(3, 'hour').toISOString() },
  {
    label: '明天',
    getValue: () => dayjs().add(1, 'day').hour(9).minute(0).second(0).millisecond(0).toISOString(),
  },
  {
    label: '明天上午',
    getValue: () => dayjs().add(1, 'day').hour(10).minute(0).second(0).millisecond(0).toISOString(),
  },
  {
    label: '下个整点',
    getValue: () => dayjs().add(1, 'hour').minute(0).second(0).millisecond(0).toISOString(),
  },
];

export function SnoozeSheet({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (snoozeUntil: string) => void;
}) {
  const [customOpen, setCustomOpen] = useState(false);

  return (
    <Popup visible={open} onMaskClick={onClose} bodyStyle={{ borderRadius: '18px 18px 0 0' }}>
      <div className="mobile-popup-body mobile-field-sheet">
        <div className="mobile-popup-header">
          <strong>稍后提醒</strong>
          <Button size="mini" fill="none" onClick={onClose}>
            关闭
          </Button>
        </div>
        <div className="mobile-editor-chip-grid">
          {snoozeOptions.map((option) => (
            <Button
              key={option.label}
              size="small"
              fill="outline"
              onClick={() => onSelect(option.getValue())}
            >
              {option.label}
            </Button>
          ))}
          <Button size="small" fill="outline" onClick={() => setCustomOpen(true)}>
            自定义
          </Button>
        </div>
      </div>
      <DatePicker
        visible={customOpen}
        value={new Date()}
        precision="minute"
        onClose={() => setCustomOpen(false)}
        onConfirm={(date) => {
          setCustomOpen(false);
          onSelect(date.toISOString());
        }}
      />
    </Popup>
  );
}

export function TaskQuadrantSheet({
  open,
  task,
  onClose,
  onSelect,
}: {
  open: boolean;
  task: Task | null;
  onClose: () => void;
  onSelect: (target: Pick<UpdateTaskDto, 'important' | 'urgent'>) => void;
}) {
  const current = task ? getTaskQuadrant(task) : undefined;

  return (
    <Popup visible={open} onMaskClick={onClose} bodyStyle={{ borderRadius: '18px 18px 0 0' }}>
      <div className="mobile-popup-body mobile-field-sheet">
        <div className="mobile-popup-header">
          <strong>移动到四象限</strong>
          <Button size="mini" fill="none" onClick={onClose}>
            关闭
          </Button>
        </div>
        <div className="mobile-editor-chip-grid">
          {quadrantOptions.map((option) => (
            <Button
              key={option.value}
              size="small"
              color={current === option.value ? 'primary' : 'default'}
              fill={current === option.value ? 'solid' : 'outline'}
              onClick={() => onSelect(getQuadrantTarget(option.value))}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>
    </Popup>
  );
}

export function TaskEditorPopup({
  open,
  task,
  lists,
  users,
  defaultListId,
  defaultTaskType = 'task',
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  task: Task | null;
  lists: TaskList[];
  users: TaskAssignee[];
  defaultListId?: number;
  defaultTaskType?: TaskType;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateTaskDto | UpdateTaskDto) => void;
}) {
  const [draft, setDraft] = useState<TaskDraft>(() =>
    buildEmptyDraft({ defaultListId, taskType: defaultTaskType })
  );
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [anniversaryDateOpen, setAnniversaryDateOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(
      task ? draftFromTask(task) : buildEmptyDraft({ defaultListId, taskType: defaultTaskType })
    );
  }, [defaultListId, defaultTaskType, open, task]);

  useEffect(() => {
    if (open) return;
    setScheduleOpen(false);
    setListOpen(false);
    setAssigneeOpen(false);
    setTagsOpen(false);
    setMoreOpen(false);
    setAnniversaryDateOpen(false);
  }, [open]);

  const updateDraft = (patch: Partial<TaskDraft>) => {
    setDraft((previous) => ({ ...previous, ...patch }));
  };

  const selectTaskType = (taskType: TaskType) => {
    updateDraft({
      taskType,
      dueAt: taskType === 'anniversary' ? (draft.dueAt ?? new Date()) : draft.dueAt,
      recurrenceType:
        taskType === 'anniversary' && draft.recurrenceType === 'none'
          ? 'yearly'
          : draft.recurrenceType,
      important: taskType === 'anniversary' ? false : draft.important,
      urgent: taskType === 'anniversary' ? false : draft.urgent,
      continuousReminderEnabled:
        taskType === 'anniversary' ? false : draft.continuousReminderEnabled,
    });
  };

  const handleSave = () => {
    try {
      onSubmit(taskDraftToPayload(draft, Boolean(task)));
    } catch (error) {
      Toast.show({
        icon: 'fail',
        content: error instanceof Error ? error.message : '请检查任务内容',
        position: 'center',
      });
    }
  };

  const selectedList = lists.find((list) => list.id === draft.listId);
  const selectedUser = users.find((user) => user.id === draft.assigneeId);
  const isAnniversary = draft.taskType === 'anniversary';
  const listShortcuts = getTaskListShortcuts(lists, draft.listId);
  const hasMoreLists = lists.filter((list) => !list.isArchived).length > listShortcuts.length;

  const handleAttachmentUpload = async (file?: File) => {
    if (!file) return;
    try {
      const uploaded = await uploadFile(file, { module: 'task-attachment' });
      updateDraft({
        attachmentFileIds: [...draft.attachmentFileIds, uploaded.id],
        attachments: [
          ...draft.attachments,
          {
            id: uploaded.id,
            taskId: task?.id ?? 0,
            fileId: uploaded.id,
            sort: draft.attachments.length,
            file: uploaded,
          },
        ],
      });
      Toast.show({ icon: 'success', content: '附件已上传', position: 'center' });
    } catch {
      Toast.show({ icon: 'fail', content: '附件上传失败', position: 'center' });
    }
  };

  const removeAttachment = (fileId: number) => {
    updateDraft({
      attachmentFileIds: draft.attachmentFileIds.filter((id) => id !== fileId),
      attachments: draft.attachments.filter((attachment) => attachment.fileId !== fileId),
    });
  };

  const openEditorAttachment = async (
    attachment: TaskAttachment,
    disposition: 'inline' | 'attachment'
  ) => {
    let openedWindow: Window | null = null;
    try {
      if (disposition === 'attachment') {
        openedWindow = openAttachmentWindow();
        const { url } = task?.id
          ? await taskService.createAttachmentAccessLink(task.id, attachment.fileId, 'attachment')
          : await createFileAccessLink(attachment.fileId, 'attachment');
        navigateAttachmentWindow(openedWindow, resolveFileAccessUrl(url));
        return;
      }

      const file = attachment.file;
      if (file?.isPublic && file.url) {
        window.open(resolveFileAccessUrl(file.url), '_blank');
        return;
      }

      openedWindow = openAttachmentWindow();
      const { url } = await createFileAccessLink(attachment.fileId, disposition);
      navigateAttachmentWindow(openedWindow, resolveFileAccessUrl(url));
    } catch {
      closeAttachmentWindow(openedWindow);
      Toast.show({ icon: 'fail', content: '附件打开失败', position: 'center' });
    }
  };

  const addCheckItem = () => {
    updateDraft({
      checkItems: [
        ...draft.checkItems,
        {
          title: '',
          completed: false,
          sort: draft.checkItems.length,
        },
      ],
    });
  };

  const updateCheckItem = (
    index: number,
    patch: Partial<{ title: string; completed: boolean }>
  ) => {
    updateDraft({
      checkItems: draft.checkItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      ),
    });
  };

  const removeCheckItem = (index: number) => {
    updateDraft({
      checkItems: draft.checkItems.filter((_item, itemIndex) => itemIndex !== index),
    });
  };

  const moveCheckItem = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= draft.checkItems.length) {
      return;
    }

    const next = [...draft.checkItems];
    const [item] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, item);
    updateDraft({
      checkItems: next.map((checkItem, index) => ({ ...checkItem, sort: index })),
    });
  };

  return (
    <Popup visible={open} onMaskClick={onClose} bodyStyle={{ borderRadius: '18px 18px 0 0' }}>
      <div className="mobile-popup-body mobile-quick-editor">
        <div className="mobile-popup-header">
          <strong>{task ? '编辑任务' : isAnniversary ? '新增纪念日' : '新建任务'}</strong>
          <Button size="mini" color="primary" loading={submitting} onClick={handleSave}>
            {isAnniversary ? '保存纪念日' : '保存'}
          </Button>
        </div>
        <div className="mobile-editor-list-shortcuts">
          {listShortcuts.map((list) => (
            <button
              key={list.id}
              type="button"
              className={draft.listId === list.id ? 'active' : ''}
              onClick={() => updateDraft({ listId: list.id })}
            >
              {list.name}
            </button>
          ))}
          {hasMoreLists ? (
            <button type="button" onClick={() => setListOpen(true)}>
              更多
            </button>
          ) : null}
        </div>
        <Input
          className="mobile-editor-title-input"
          value={draft.title}
          placeholder={isAnniversary ? '纪念日名称' : '准备做什么？'}
          onChange={(title: string) => updateDraft({ title })}
        />
        {isAnniversary ? (
          <button
            type="button"
            className="mobile-editor-date-card"
            onClick={() => setAnniversaryDateOpen(true)}
          >
            <span>纪念日日期</span>
            <strong>{draft.dueAt ? dayjs(draft.dueAt).format('YYYY-MM-DD') : '请选择'}</strong>
          </button>
        ) : null}
        <TextArea
          className="mobile-editor-description"
          value={draft.description}
          rows={3}
          placeholder="描述"
          onChange={(description: string) => updateDraft({ description })}
        />

        <div className="mobile-editor-summary">
          {draft.dueAt ? <Tag color="primary">截止 {formatDateTime(draft.dueAt)}</Tag> : null}
          {draft.remindAt ? <Tag color="warning">提醒 {formatDateTime(draft.remindAt)}</Tag> : null}
          {draft.recurrenceType !== 'none' ? (
            <Tag color="primary">
              {formatTaskRecurrence(
                draft.recurrenceType,
                draft.recurrenceInterval ? Number(draft.recurrenceInterval) : null
              )}
            </Tag>
          ) : null}
          {selectedList ? <Tag>{selectedList.name}</Tag> : null}
          {selectedUser ? <Tag>{getUserName(selectedUser)}</Tag> : null}
        </div>

        <div className="mobile-editor-toolbar">
          {isAnniversary ? null : (
            <button type="button" onClick={() => setScheduleOpen(true)}>
              <CalendarOutlined />
              <span>日期</span>
            </button>
          )}
          {isAnniversary ? null : (
            <>
              <button
                type="button"
                className={draft.important ? 'active danger' : ''}
                onClick={() => updateDraft({ important: !draft.important })}
              >
                <FlagOutlined />
                <span>重要</span>
              </button>
              <button
                type="button"
                className={draft.urgent ? 'active warning' : ''}
                onClick={() => updateDraft({ urgent: !draft.urgent })}
              >
                <ExclamationCircleOutlined />
                <span>紧急</span>
              </button>
            </>
          )}
          <button type="button" onClick={() => setTagsOpen(true)}>
            <TagsOutlined />
            <span>标签</span>
          </button>
          {!isAnniversary ? (
            <button type="button" onClick={addCheckItem}>
              <CheckSquareOutlined />
              <span>检查项</span>
            </button>
          ) : null}
          <label className="mobile-editor-upload-button">
            <UploadOutlined />
            <span>附件</span>
            <input
              type="file"
              onChange={(event) => {
                void handleAttachmentUpload(event.target.files?.[0]);
                event.currentTarget.value = '';
              }}
            />
          </label>
          <button type="button" onClick={() => setListOpen(true)}>
            <FolderOpenOutlined />
            <span>清单</span>
          </button>
          <button type="button" onClick={() => setAssigneeOpen(true)}>
            <UserOutlined />
            <span>负责人</span>
          </button>
          <button type="button" onClick={() => setMoreOpen(true)}>
            <EllipsisOutlined />
            <span>更多</span>
          </button>
        </div>
        {draft.checkItems.length ? (
          <div className="mobile-editor-section">
            <strong>检查清单</strong>
            {draft.checkItems.map((item, index) => (
              <div key={index} className="mobile-editor-check-item">
                <Checkbox
                  checked={item.completed}
                  onChange={(completed) => updateCheckItem(index, { completed })}
                />
                <Input
                  value={item.title}
                  placeholder="检查项"
                  onChange={(title) => updateCheckItem(index, { title })}
                />
                <div className="mobile-editor-check-actions">
                  <Button
                    size="mini"
                    fill="none"
                    disabled={index === 0}
                    onClick={() => moveCheckItem(index, index - 1)}
                  >
                    上移
                  </Button>
                  <Button
                    size="mini"
                    fill="none"
                    disabled={index === draft.checkItems.length - 1}
                    onClick={() => moveCheckItem(index, index + 1)}
                  >
                    下移
                  </Button>
                </div>
                <Button size="mini" fill="none" onClick={() => removeCheckItem(index)}>
                  删除
                </Button>
              </div>
            ))}
          </div>
        ) : null}
        {draft.attachments.length ? (
          <div className="mobile-editor-section">
            <strong>附件</strong>
            {draft.attachments.map((attachment) => (
              <div key={attachment.fileId} className="mobile-editor-attachment-row">
                <PaperClipOutlined />
                <span>{attachment.file?.originalName || `文件 #${attachment.fileId}`}</span>
                <div className="mobile-editor-attachment-actions">
                  {isPreviewableAttachment(attachment) ? (
                    <Button
                      size="mini"
                      fill="none"
                      onClick={() => void openEditorAttachment(attachment, 'inline')}
                    >
                      预览
                    </Button>
                  ) : null}
                  <Button
                    size="mini"
                    fill="none"
                    onClick={() => void openEditorAttachment(attachment, 'attachment')}
                  >
                    下载
                  </Button>
                  <Button
                    size="mini"
                    fill="none"
                    onClick={() => removeAttachment(attachment.fileId)}
                  >
                    删除
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <ScheduleSheet
        open={scheduleOpen}
        draft={draft}
        onClose={() => setScheduleOpen(false)}
        onChange={updateDraft}
      />
      <DatePicker
        visible={anniversaryDateOpen}
        value={draft.dueAt ?? new Date()}
        precision="day"
        onClose={() => setAnniversaryDateOpen(false)}
        onConfirm={(dueAt: Date) => updateDraft({ dueAt })}
      />
      <FieldSheet title="选择清单" open={listOpen} onClose={() => setListOpen(false)}>
        <Selector
          options={lists.map((list) => ({ label: list.name, value: list.id }))}
          value={draft.listId ? [draft.listId] : []}
          onChange={(items: Array<string | number>) =>
            updateDraft({ listId: Number(items[0]) || undefined })
          }
        />
      </FieldSheet>
      <FieldSheet title="负责人" open={assigneeOpen} onClose={() => setAssigneeOpen(false)}>
        <Selector
          options={[
            { label: '不指定', value: 0 },
            ...users.map((user) => ({ label: getUserName(user), value: user.id })),
          ]}
          value={[draft.assigneeId ?? 0]}
          onChange={(items: Array<string | number>) =>
            updateDraft({ assigneeId: Number(items[0]) || undefined })
          }
        />
      </FieldSheet>
      <FieldSheet title="标签" open={tagsOpen} onClose={() => setTagsOpen(false)}>
        <Input
          value={draft.tags}
          placeholder="用逗号分隔"
          onChange={(tags) => updateDraft({ tags })}
        />
      </FieldSheet>
      <FieldSheet title="更多" open={moreOpen} onClose={() => setMoreOpen(false)}>
        <div className="mobile-field mobile-field-card">
          <label>类型</label>
          <Selector
            options={taskTypeOptions}
            value={[draft.taskType]}
            onChange={(items: Array<string | number>) =>
              selectTaskType((items[0] as TaskType) || 'task')
            }
          />
        </div>
      </FieldSheet>
    </Popup>
  );
}

function ScheduleSheet({
  open,
  draft,
  onClose,
  onChange,
}: {
  open: boolean;
  draft: TaskDraft;
  onClose: () => void;
  onChange: (patch: Partial<TaskDraft>) => void;
}) {
  const [duePickerOpen, setDuePickerOpen] = useState(false);
  const [remindPickerOpen, setRemindPickerOpen] = useState(false);
  const isAnniversary = draft.taskType === 'anniversary';

  const setDuePreset = (preset: 'today' | 'tomorrow' | 'next-week') => {
    const base =
      preset === 'today'
        ? dayjs()
        : preset === 'tomorrow'
          ? dayjs().add(1, 'day')
          : dayjs().add(1, 'week');
    onChange({ dueAt: base.hour(18).minute(0).second(0).millisecond(0).toDate() });
  };

  const setReminderOffset = (option: (typeof reminderOffsetOptions)[number]) => {
    if (!draft.dueAt) {
      Toast.show({ icon: 'fail', content: '请先设置截止时间', position: 'center' });
      return;
    }
    onChange({ remindAt: dayjs(draft.dueAt).subtract(option.amount, option.unit).toDate() });
  };

  return (
    <Popup visible={open} onMaskClick={onClose} bodyStyle={{ borderRadius: '18px 18px 0 0' }}>
      <div className="mobile-popup-body mobile-schedule-sheet">
        <div className="mobile-popup-header">
          <strong>日期与规则</strong>
          <Button size="mini" fill="none" onClick={onClose}>
            完成
          </Button>
        </div>
        <div className="mobile-schedule-card">
          <label>{isAnniversary ? '纪念日日期' : '截止'}</label>
          <div className="mobile-editor-chip-grid">
            <Button size="small" fill="outline" onClick={() => setDuePreset('today')}>
              今天
            </Button>
            <Button size="small" fill="outline" onClick={() => setDuePreset('tomorrow')}>
              明天
            </Button>
            <Button size="small" fill="outline" onClick={() => setDuePreset('next-week')}>
              下周
            </Button>
            <Button size="small" fill="outline" onClick={() => setDuePickerOpen(true)}>
              自定义
            </Button>
          </div>
          <div className="mobile-schedule-value">
            {draft.dueAt ? formatFullDateTime(draft.dueAt) : '未设置'}
          </div>
        </div>

        {isAnniversary ? null : (
          <div className="mobile-schedule-card">
            <label>提醒</label>
            <div className="mobile-editor-chip-grid">
              {reminderOffsetOptions.map((option) => (
                <Button
                  key={option.label}
                  size="small"
                  fill="outline"
                  onClick={() => setReminderOffset(option)}
                >
                  {option.label}
                </Button>
              ))}
              <Button size="small" fill="outline" onClick={() => setRemindPickerOpen(true)}>
                自定义
              </Button>
            </div>
            <div className="mobile-schedule-value">
              {draft.remindAt ? formatFullDateTime(draft.remindAt) : '未提醒'}
              {draft.remindAt ? (
                <Button size="mini" fill="none" onClick={() => onChange({ remindAt: undefined })}>
                  清除
                </Button>
              ) : null}
            </div>
            <div className="mobile-schedule-value">
              <span>持续提醒</span>
              <Switch
                checked={draft.continuousReminderEnabled}
                onChange={(continuousReminderEnabled) => onChange({ continuousReminderEnabled })}
              />
            </div>
            <div className="mobile-muted">每 30 分钟，直到完成</div>
          </div>
        )}

        <div className="mobile-schedule-card">
          <label>重复</label>
          <Selector
            options={recurrenceOptions}
            value={[draft.recurrenceType]}
            onChange={(items: Array<string | number>) =>
              onChange({ recurrenceType: (items[0] as TaskRecurrenceType) || 'none' })
            }
          />
          {draft.recurrenceType !== 'none' && draft.recurrenceType !== 'weekdays' ? (
            <Input
              type="number"
              value={draft.recurrenceInterval}
              placeholder="重复间隔，留空为 1"
              onChange={(recurrenceInterval: string) => onChange({ recurrenceInterval })}
            />
          ) : null}
        </div>
      </div>
      <DatePicker
        visible={duePickerOpen}
        value={draft.dueAt ?? new Date()}
        precision="minute"
        onClose={() => setDuePickerOpen(false)}
        onConfirm={(dueAt: Date) => onChange({ dueAt })}
      />
      <DatePicker
        visible={remindPickerOpen}
        value={draft.remindAt ?? new Date()}
        precision="minute"
        onClose={() => setRemindPickerOpen(false)}
        onConfirm={(remindAt: Date) => onChange({ remindAt })}
      />
    </Popup>
  );
}

function FieldSheet({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Popup visible={open} onMaskClick={onClose} bodyStyle={{ borderRadius: '18px 18px 0 0' }}>
      <div className="mobile-popup-body mobile-field-sheet">
        <div className="mobile-popup-header">
          <strong>{title}</strong>
          <Button size="mini" fill="none" onClick={onClose}>
            完成
          </Button>
        </div>
        {children}
      </div>
    </Popup>
  );
}

function TaskFilterPopup({
  open,
  lists,
  users,
  listId,
  assigneeId,
  status,
  tagText,
  sortValue,
  dateFilter,
  view,
  onClose,
  onApply,
}: {
  open: boolean;
  lists: TaskList[];
  users: TaskAssignee[];
  listId?: number;
  assigneeId?: number;
  status?: TaskStatus;
  tagText: string;
  sortValue: MobileSortValue;
  dateFilter: MobileDateFilter;
  view: MobileTaskView;
  onClose: () => void;
  onApply: (values: {
    listId?: number;
    assigneeId?: number;
    status?: TaskStatus;
    tagText: string;
    sortValue: MobileSortValue;
    dateFilter: MobileDateFilter;
  }) => void;
}) {
  const [draftListId, setDraftListId] = useState<number | undefined>(listId);
  const [draftAssigneeId, setDraftAssigneeId] = useState<number | undefined>(assigneeId);
  const [draftStatus, setDraftStatus] = useState<TaskStatus | undefined>(status);
  const [draftTags, setDraftTags] = useState(tagText);
  const [draftSortValue, setDraftSortValue] = useState<MobileSortValue>(sortValue);
  const [draftDateFilter, setDraftDateFilter] = useState<MobileDateFilter>(dateFilter);
  const [customStartOpen, setCustomStartOpen] = useState(false);
  const [customEndOpen, setCustomEndOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraftListId(listId);
    setDraftAssigneeId(assigneeId);
    setDraftStatus(status);
    setDraftTags(tagText);
    setDraftSortValue(sortValue);
    setDraftDateFilter(dateFilter);
  }, [assigneeId, dateFilter, listId, open, sortValue, status, tagText]);

  const resetFilters = () => {
    setDraftListId(undefined);
    setDraftAssigneeId(undefined);
    setDraftStatus(undefined);
    setDraftTags('');
    setDraftSortValue('default');
    setDraftDateFilter({ preset: 'all' });
  };
  const showDateFilter = view === 'list';

  return (
    <Popup visible={open} onMaskClick={onClose} bodyStyle={{ borderRadius: '18px 18px 0 0' }}>
      <div className="mobile-popup-body mobile-filter-popup">
        <div className="mobile-popup-header">
          <strong>筛选任务</strong>
          <Button size="mini" fill="none" onClick={onClose}>
            取消
          </Button>
        </div>
        <div className="mobile-field mobile-field-card">
          <label>清单</label>
          <Selector
            options={[
              { label: '全部', value: 0 },
              ...lists.map((list) => ({ label: list.name, value: list.id })),
            ]}
            value={[draftListId ?? 0]}
            onChange={(items: Array<string | number>) =>
              setDraftListId(Number(items[0]) || undefined)
            }
          />
        </div>
        <div className="mobile-field mobile-field-card">
          <label>负责人</label>
          <Selector
            options={[
              { label: '全部', value: 0 },
              ...users.map((user) => ({ label: getUserName(user), value: user.id })),
            ]}
            value={[draftAssigneeId ?? 0]}
            onChange={(items: Array<string | number>) =>
              setDraftAssigneeId(Number(items[0]) || undefined)
            }
          />
        </div>
        <div className="mobile-field mobile-field-card">
          <label>状态</label>
          <Selector
            options={statusOptions}
            value={[draftStatus ?? 'all']}
            onChange={(items: Array<string | number>) =>
              setDraftStatus(items[0] === 'all' ? undefined : (items[0] as TaskStatus))
            }
          />
        </div>
        <div className="mobile-field mobile-field-card">
          <label>标签</label>
          <Input value={draftTags} placeholder="用逗号分隔" onChange={setDraftTags} />
        </div>
        <div className="mobile-field mobile-field-card">
          <label>排序</label>
          <Selector
            options={sortOptions}
            value={[draftSortValue]}
            onChange={(items: Array<string | number>) =>
              setDraftSortValue((items[0] as MobileSortValue) || 'default')
            }
          />
        </div>
        {showDateFilter ? (
          <div className="mobile-field mobile-field-card">
            <label>日期</label>
            <Selector
              options={datePresetOptions}
              value={[draftDateFilter.preset]}
              onChange={(items: Array<string | number>) =>
                setDraftDateFilter((previous) => ({
                  ...previous,
                  preset: (items[0] as MobileDatePreset) || 'all',
                }))
              }
            />
            {draftDateFilter.preset === 'custom' ? (
              <div className="mobile-editor-chip-grid mt-2">
                <Button size="small" fill="outline" onClick={() => setCustomStartOpen(true)}>
                  {draftDateFilter.customStart
                    ? dayjs(draftDateFilter.customStart).format('MM-DD')
                    : '开始日期'}
                </Button>
                <Button size="small" fill="outline" onClick={() => setCustomEndOpen(true)}>
                  {draftDateFilter.customEnd
                    ? dayjs(draftDateFilter.customEnd).format('MM-DD')
                    : '结束日期'}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="mobile-popup-actions">
          <Button size="small" fill="outline" onClick={resetFilters}>
            重置
          </Button>
          <Button
            size="small"
            color="primary"
            onClick={() =>
              onApply({
                listId: draftListId,
                assigneeId: draftAssigneeId,
                status: draftStatus,
                tagText: draftTags,
                sortValue: draftSortValue,
                dateFilter: showDateFilter ? draftDateFilter : { preset: 'all' },
              })
            }
          >
            应用
          </Button>
        </div>
        <DatePicker
          visible={customStartOpen}
          value={draftDateFilter.customStart ?? new Date()}
          precision="day"
          onClose={() => setCustomStartOpen(false)}
          onConfirm={(date) => {
            setCustomStartOpen(false);
            setDraftDateFilter((previous) => ({ ...previous, customStart: date }));
          }}
        />
        <DatePicker
          visible={customEndOpen}
          value={draftDateFilter.customEnd ?? draftDateFilter.customStart ?? new Date()}
          precision="day"
          onClose={() => setCustomEndOpen(false)}
          onConfirm={(date) => {
            setCustomEndOpen(false);
            setDraftDateFilter((previous) => ({ ...previous, customEnd: date }));
          }}
        />
      </div>
    </Popup>
  );
}

function TaskListManagePopup({
  open,
  lists,
  onClose,
}: {
  open: boolean;
  lists: TaskList[];
  onClose: () => void;
}) {
  const createList = useCreateTaskList();
  const updateList = useUpdateTaskList();
  const deleteList = useDeleteTaskList();
  const [editing, setEditing] = useState<TaskList | null>(null);
  const [name, setName] = useState('');
  const [scope, setScope] = useState<'personal' | 'family'>('personal');
  const [isArchived, setIsArchived] = useState(false);

  const reset = () => {
    setEditing(null);
    setName('');
    setScope('personal');
    setIsArchived(false);
  };

  const editList = (list: TaskList) => {
    setEditing(list);
    setName(list.name);
    setScope(list.scope);
    setIsArchived(list.isArchived);
  };

  const saveList = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Toast.show({ icon: 'fail', content: '请输入清单名称', position: 'center' });
      return;
    }

    if (editing) {
      const payload: UpdateTaskListDto = { name: trimmedName, scope, isArchived };
      updateList.mutate({ id: editing.id, data: payload }, { onSuccess: reset });
      return;
    }

    const payload: CreateTaskListDto = { name: trimmedName, scope, isArchived: false };
    createList.mutate(payload, { onSuccess: reset });
  };

  return (
    <Popup visible={open} onMaskClick={onClose} bodyStyle={{ borderRadius: '18px 18px 0 0' }}>
      <div className="mobile-popup-body mobile-list-popup">
        <div className="mobile-popup-header">
          <strong>清单管理</strong>
          <Button size="mini" fill="outline" onClick={reset}>
            新建
          </Button>
        </div>
        <div className="mobile-form-panel mb-3">
          <div className="mobile-field">
            <label>清单名称</label>
            <Input value={name} placeholder="例如：家庭待办" onChange={setName} />
          </div>
          <div className="mobile-field">
            <label>范围</label>
            <Selector
              options={[
                { label: '家庭', value: 'family' },
                { label: '个人', value: 'personal' },
              ]}
              value={[scope]}
              onChange={(items: Array<string | number>) =>
                setScope((items[0] as 'personal' | 'family') || 'personal')
              }
            />
          </div>
          {editing ? (
            <List>
              <List.Item extra={<Switch checked={isArchived} onChange={setIsArchived} />}>
                归档
              </List.Item>
            </List>
          ) : null}
          <div className="mobile-form-actions">
            <Button
              size="small"
              color="primary"
              loading={createList.isPending || updateList.isPending}
              onClick={saveList}
            >
              {editing ? '保存' : '创建'}
            </Button>
          </div>
        </div>
        <List className="mobile-form-list">
          {lists.map((list) => (
            <List.Item
              key={list.id}
              description={`${list.scope === 'family' ? '家庭' : '个人'}${list.isArchived ? ' · 已归档' : ''}`}
              extra={
                <div className="flex gap-2">
                  <Button size="mini" onClick={() => editList(list)}>
                    编辑
                  </Button>
                  <Button
                    size="mini"
                    color="danger"
                    fill="outline"
                    loading={deleteList.isPending && deleteList.variables === list.id}
                    onClick={() => deleteList.mutate(list.id)}
                  >
                    删除
                  </Button>
                </div>
              }
            >
              {list.name}
            </List.Item>
          ))}
        </List>
      </div>
    </Popup>
  );
}
