import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { TaskCenterPage } from './TaskCenterPage';
import { createMockUser, renderWithProviders, setMockUser, userEvent } from '@/test/test-utils';

const taskHookMocks = vi.hoisted(() => ({
  useTaskLists: vi.fn(),
  useTasks: vi.fn(),
  useCreateTask: vi.fn(),
  useUpdateTask: vi.fn(),
  useCompleteTask: vi.fn(),
  useReopenTask: vi.fn(),
  useSnoozeTaskReminder: vi.fn(),
  useDeleteTask: vi.fn(),
  useCreateTaskList: vi.fn(),
  useUpdateTaskList: vi.fn(),
  useDeleteTaskList: vi.fn(),
  useTaskAssignees: vi.fn(),
}));

const userHookMocks = vi.hoisted(() => ({
  useUsers: vi.fn(),
}));

vi.mock('../hooks/useTasks', () => taskHookMocks);

vi.mock('@/features/rbac/user/hooks/useUsers', () => userHookMocks);

vi.mock('@/shared/hooks/useBreadcrumb', () => ({
  useBreadcrumb: () => [],
}));

const emptyTasks = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 10,
};

function mockMutation() {
  return {
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  };
}

function mockMutationWithSuccess() {
  return {
    mutate: vi.fn((_variables, options) => options?.onSuccess?.()),
    mutateAsync: vi.fn(),
    isPending: false,
  };
}

function renderTaskCenter(initialPath = '/tasks') {
  window.history.pushState({}, '', initialPath);
  return renderWithProviders(
    <MemoryRouter initialEntries={[initialPath]}>
      <TaskCenterPage />
    </MemoryRouter>
  );
}

function getLastTaskQueryParams() {
  const calls = taskHookMocks.useTasks.mock.calls;
  return calls[calls.length - 1]?.[0];
}

function createTaskFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 31,
    title: '日历任务',
    listId: 1,
    status: 'pending',
    taskType: 'task',
    dueAt: dayjs().hour(10).minute(0).second(0).millisecond(0).toISOString(),
    remindAt: null,
    important: false,
    urgent: false,
    recurrenceType: 'none',
    continuousReminderEnabled: true,
    continuousReminderIntervalMinutes: 30,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    ...overrides,
  };
}

function createDataTransfer() {
  const store = new Map<string, string>();

  return {
    effectAllowed: '',
    dropEffect: '',
    setData: vi.fn((type: string, value: string) => store.set(type, value)),
    getData: vi.fn((type: string) => store.get(type) ?? ''),
  };
}

function TaskCenterWithNotificationJump() {
  const navigate = useNavigate();

  return (
    <>
      <button type="button" onClick={() => navigate('/tasks?taskId=88')}>
        打开任务通知
      </button>
      <TaskCenterPage />
    </>
  );
}

function TaskCenterWithTaskIdClear() {
  const navigate = useNavigate();

  return (
    <>
      <button type="button" onClick={() => navigate('/tasks')}>
        清理任务通知
      </button>
      <TaskCenterPage />
    </>
  );
}

describe('TaskCenterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.removeItem('home-task-last-list-id');
    window.history.pushState({}, '', '/tasks');
    vi.stubGlobal('getComputedStyle', () => ({
      getPropertyValue: () => '',
    }));

    taskHookMocks.useTaskLists.mockReturnValue({
      data: [{ id: 1, name: '家庭计划', scope: 'family', sort: 0, isArchived: false }],
      isLoading: false,
    });
    taskHookMocks.useTasks.mockReturnValue({
      data: emptyTasks,
      isLoading: false,
      refetch: vi.fn(),
    });
    userHookMocks.useUsers.mockReturnValue({
      data: { items: [], total: 0, page: 1, pageSize: 100 },
      isLoading: false,
    });
    taskHookMocks.useCreateTask.mockReturnValue(mockMutation());
    taskHookMocks.useUpdateTask.mockReturnValue(mockMutation());
    taskHookMocks.useCompleteTask.mockReturnValue(mockMutation());
    taskHookMocks.useReopenTask.mockReturnValue(mockMutation());
    taskHookMocks.useSnoozeTaskReminder.mockReturnValue(mockMutation());
    taskHookMocks.useDeleteTask.mockReturnValue(mockMutation());
    taskHookMocks.useCreateTaskList.mockReturnValue(mockMutation());
    taskHookMocks.useUpdateTaskList.mockReturnValue(mockMutation());
    taskHookMocks.useDeleteTaskList.mockReturnValue(mockMutation());
    taskHookMocks.useTaskAssignees.mockReturnValue({
      data: [],
      isLoading: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders task center tabs', () => {
    setMockUser(
      createMockUser({
        permissions: ['task:read', 'task:create', 'task-list:manage'],
      })
    );

    renderTaskCenter();

    expect(screen.getByText('任务中心')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: '清单' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '今日' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '日历' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '四象限' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '纪念日' })).toBeInTheDocument();
  });

  it('defaults task center queries to today', () => {
    setMockUser(
      createMockUser({
        permissions: ['task:read'],
      })
    );

    renderTaskCenter();

    expect(getLastTaskQueryParams()).toEqual(
      expect.objectContaining({
        view: 'today',
      })
    );
  });

  it('hides create button without task:create permission', () => {
    setMockUser(
      createMockUser({
        permissions: ['task:read'],
      })
    );

    renderTaskCenter();

    expect(screen.queryByRole('button', { name: /新建任务/ })).not.toBeInTheDocument();
  });

  it('opens task form when user has create permission', async () => {
    setMockUser(
      createMockUser({
        permissions: ['task:read', 'task:create'],
      })
    );

    renderTaskCenter();

    fireEvent.click(screen.getByRole('button', { name: /新建任务/ }));

    expect(
      screen.getByPlaceholderText('例如：给家里买菜、准备周会、结婚纪念日')
    ).toBeInTheDocument();
  });

  it('defaults new calendar tasks into the current calendar date range', async () => {
    const createMutation = mockMutationWithSuccess();
    taskHookMocks.useCreateTask.mockReturnValue(createMutation);
    setMockUser(
      createMockUser({
        permissions: ['task:read', 'task:create'],
      })
    );

    renderTaskCenter();
    await userEvent.click(screen.getByRole('tab', { name: '日历' }));
    const calendarParams = getLastTaskQueryParams();

    await userEvent.click(screen.getByRole('button', { name: /新建任务/ }));
    await userEvent.type(
      screen.getByPlaceholderText('例如：给家里买菜、准备周会、结婚纪念日'),
      '日历里新建的任务'
    );
    await userEvent.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() =>
      expect(createMutation.mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          dueAt: expect.any(String),
        }),
        expect.any(Object)
      )
    );

    const payload = createMutation.mutate.mock.calls[0][0] as { dueAt: string };
    expect(dayjs(payload.dueAt).isBefore(dayjs(calendarParams.startDate))).toBe(false);
    expect(dayjs(payload.dueAt).isAfter(dayjs(calendarParams.endDate))).toBe(false);
  });

  it('defaults new PC tasks to today at 18:00', async () => {
    const expectedDueAt = dayjs().hour(18).minute(0).second(0).millisecond(0);
    const createMutation = mockMutationWithSuccess();
    taskHookMocks.useCreateTask.mockReturnValue(createMutation);
    setMockUser(
      createMockUser({
        permissions: ['task:read', 'task:create'],
      })
    );

    renderTaskCenter();
    await userEvent.click(screen.getByRole('button', { name: /新建任务/ }));
    await userEvent.type(
      screen.getByPlaceholderText('例如：给家里买菜、准备周会、结婚纪念日'),
      '默认今天截止'
    );
    await userEvent.click(screen.getByRole('button', { name: 'OK' }));

    const payload = createMutation.mutate.mock.calls[0][0] as { dueAt: string };
    expect(dayjs(payload.dueAt).format('YYYY-MM-DD HH:mm')).toBe(
      expectedDueAt.format('YYYY-MM-DD HH:mm')
    );
  });

  it('marks family tasks assigned to the current user', () => {
    taskHookMocks.useTasks.mockReturnValue({
      data: {
        items: [
          createTaskFixture({
            title: '我的家庭任务',
            list: { id: 1, name: '家庭计划', scope: 'family', sort: 0, isArchived: false },
            assigneeId: 999,
            assignee: { id: 999, username: 'testuser', nickname: '我' },
          }),
        ],
        total: 1,
        page: 1,
        pageSize: 10,
      },
      isLoading: false,
      refetch: vi.fn(),
    });
    setMockUser(
      createMockUser({
        permissions: ['task:read'],
      })
    );

    renderTaskCenter();

    expect(screen.getByText('指派给我')).toBeInTheDocument();
  });

  it('uses the recent task list when creating from an aggregated PC view', async () => {
    const createMutation = mockMutationWithSuccess();
    window.localStorage.setItem('home-task-last-list-id', '2');
    taskHookMocks.useTaskLists.mockReturnValue({
      data: [
        { id: 1, name: '家庭计划', scope: 'family', sort: 0, isArchived: false },
        { id: 2, name: '个人事项', scope: 'personal', sort: 1, isArchived: false },
      ],
      isLoading: false,
    });
    taskHookMocks.useCreateTask.mockReturnValue(createMutation);
    setMockUser(
      createMockUser({
        permissions: ['task:read', 'task:create'],
      })
    );

    renderTaskCenter();
    await userEvent.click(screen.getByRole('tab', { name: '今日' }));
    await userEvent.click(screen.getByRole('button', { name: /新建任务/ }));
    await userEvent.type(
      screen.getByPlaceholderText('例如：给家里买菜、准备周会、结婚纪念日'),
      '使用最近清单'
    );
    await userEvent.click(screen.getByRole('button', { name: 'OK' }));

    expect(createMutation.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        listId: 2,
      }),
      expect.any(Object)
    );
  });

  it('initializes task query from notification taskId links', () => {
    window.history.pushState({}, '', '/tasks?taskId=42');
    setMockUser(
      createMockUser({
        permissions: ['task:read'],
      })
    );

    renderTaskCenter('/tasks?taskId=42');

    expect(taskHookMocks.useTasks).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 42,
      })
    );
  });

  it('uses task assignee options without querying the user management list', () => {
    setMockUser(
      createMockUser({
        permissions: ['task:read'],
      })
    );

    renderTaskCenter();

    expect(taskHookMocks.useTaskAssignees).toHaveBeenCalled();
  });

  it('shows task list scope labels in the list filter options', async () => {
    taskHookMocks.useTaskLists.mockReturnValue({
      data: [
        { id: 1, name: '家庭计划', scope: 'family', sort: 0, isArchived: false },
        { id: 2, name: '个人事项', scope: 'personal', sort: 1, isArchived: false },
      ],
      isLoading: false,
    });
    setMockUser(
      createMockUser({
        permissions: ['task:read'],
      })
    );

    renderTaskCenter();
    await userEvent.click(screen.getByText('全部清单'));

    expect(await screen.findByText('家庭计划（家庭）')).toBeInTheDocument();
    expect(await screen.findByText('个人事项（个人）')).toBeInTheDocument();
  });

  it('adds a default date range when switching to calendar view', async () => {
    setMockUser(
      createMockUser({
        permissions: ['task:read'],
      })
    );

    renderTaskCenter();
    await userEvent.click(screen.getByRole('tab', { name: '日历' }));

    expect(taskHookMocks.useTasks).toHaveBeenLastCalledWith(
      expect.objectContaining({
        view: 'calendar',
        startDate: expect.any(String),
        endDate: expect.any(String),
      })
    );
  });

  it('shows calendar tasks immediately after switching to calendar view', async () => {
    taskHookMocks.useTasks.mockImplementation((params) => ({
      data:
        params.view === 'calendar'
          ? { items: [createTaskFixture()], total: 1, page: 1, pageSize: 100 }
          : emptyTasks,
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    }));
    setMockUser(
      createMockUser({
        permissions: ['task:read'],
      })
    );

    renderTaskCenter();
    await userEvent.click(screen.getByRole('tab', { name: '日历' }));

    const calendarGrid = await screen.findByTestId('task-calendar-grid');
    expect(calendarGrid).toBeInTheDocument();
    expect(within(calendarGrid).getByText('日历任务')).toBeInTheDocument();
  });

  it('keeps calendar grid and month range after searching on the calendar view', async () => {
    taskHookMocks.useTasks.mockImplementation((params) => ({
      data:
        params.view === 'calendar'
          ? {
              items: [createTaskFixture({ title: '筛选后的日历任务' })],
              total: 1,
              page: 1,
              pageSize: 100,
            }
          : emptyTasks,
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    }));
    setMockUser(
      createMockUser({
        permissions: ['task:read'],
      })
    );

    renderTaskCenter();
    await userEvent.click(screen.getByRole('tab', { name: '日历' }));
    await userEvent.click(screen.getByRole('button', { name: /查询/ }));

    expect(getLastTaskQueryParams()).toEqual(
      expect.objectContaining({
        view: 'calendar',
        startDate: expect.any(String),
        endDate: expect.any(String),
      })
    );
    const calendarGrid = screen.getByTestId('task-calendar-grid');
    expect(calendarGrid).toBeInTheDocument();
    expect(within(calendarGrid).getByText('筛选后的日历任务')).toBeInTheDocument();
  });

  it('hides date range filter and load-more pagination on the calendar view', async () => {
    taskHookMocks.useTasks.mockReturnValue({
      data: {
        items: Array.from({ length: 100 }, (_, index) =>
          createTaskFixture({
            id: index + 1,
            title: `任务 ${index + 1}`,
          })
        ),
        total: 101,
        page: 1,
        pageSize: 100,
      },
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    setMockUser(
      createMockUser({
        permissions: ['task:read'],
      })
    );

    renderTaskCenter();
    await userEvent.click(screen.getByRole('tab', { name: '日历' }));
    await userEvent.click(screen.getByRole('button', { name: /展开/ }));

    expect(screen.queryByText('日期范围')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /加载更多/ })).not.toBeInTheDocument();
  });

  it('loads the next matrix page without exceeding the backend limit', async () => {
    taskHookMocks.useTasks.mockReturnValue({
      data: {
        items: Array.from({ length: 100 }, (_, index) => ({
          id: index + 1,
          title: `任务 ${index + 1}`,
          listId: 1,
          status: 'pending',
          taskType: 'task',
          important: false,
          urgent: false,
          recurrenceType: 'none',
          continuousReminderEnabled: true,
          continuousReminderIntervalMinutes: 30,
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
        })),
        total: 101,
        page: 1,
        pageSize: 100,
      },
      isLoading: false,
      refetch: vi.fn(),
    });
    setMockUser(
      createMockUser({
        permissions: ['task:read'],
      })
    );

    renderTaskCenter();
    await userEvent.click(screen.getByRole('tab', { name: '四象限' }));
    await userEvent.click(await screen.findByRole('button', { name: /加载更多/ }));

    expect(taskHookMocks.useTasks).toHaveBeenLastCalledWith(
      expect.objectContaining({
        view: 'matrix',
        page: 2,
        limit: 100,
      })
    );
  });

  it('updates task urgency and importance when dragging across matrix quadrants', async () => {
    const updateMutation = mockMutationWithSuccess();
    const matrixTasksData = {
      items: [
        createTaskFixture({
          id: 31,
          title: '矩阵任务',
          important: false,
          urgent: false,
        }),
      ],
      total: 1,
      page: 1,
      pageSize: 100,
    };

    taskHookMocks.useUpdateTask.mockReturnValue(updateMutation);
    taskHookMocks.useTasks.mockImplementation((params) => ({
      data: params.view === 'matrix' ? matrixTasksData : emptyTasks,
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    }));
    setMockUser(
      createMockUser({
        permissions: ['task:read', 'task:update'],
      })
    );
    const dataTransfer = createDataTransfer();

    renderTaskCenter();
    await userEvent.click(screen.getByRole('tab', { name: '四象限' }));

    fireEvent.dragStart(await screen.findByTestId('task-matrix-card-31'), { dataTransfer });
    fireEvent.dragOver(screen.getByTestId('task-matrix-quadrant-important-urgent'), {
      dataTransfer,
    });
    fireEvent.drop(screen.getByTestId('task-matrix-quadrant-important-urgent'), {
      dataTransfer,
    });

    expect(updateMutation.mutate).toHaveBeenCalledWith(
      { id: 31, data: { important: true, urgent: true } },
      expect.any(Object)
    );
  });

  it('reacts to taskId changes while staying on the task center route', async () => {
    setMockUser(
      createMockUser({
        permissions: ['task:read'],
      })
    );

    window.history.pushState({}, '', '/tasks?taskId=42');
    renderWithProviders(
      <MemoryRouter initialEntries={['/tasks?taskId=42']}>
        <TaskCenterWithNotificationJump />
      </MemoryRouter>
    );

    expect(taskHookMocks.useTasks).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 42,
      })
    );

    await userEvent.click(screen.getByRole('button', { name: '打开任务通知' }));

    expect(taskHookMocks.useTasks).toHaveBeenLastCalledWith(
      expect.objectContaining({
        view: 'list',
        taskId: 88,
      })
    );
  });

  it('clears notification taskId filters when switching tabs', async () => {
    setMockUser(
      createMockUser({
        permissions: ['task:read'],
      })
    );

    renderTaskCenter('/tasks?taskId=42');
    await userEvent.click(screen.getByRole('tab', { name: '四象限' }));

    expect(getLastTaskQueryParams()).toEqual(
      expect.objectContaining({
        view: 'matrix',
      })
    );
    expect(getLastTaskQueryParams()).not.toEqual(
      expect.objectContaining({
        taskId: 42,
      })
    );
  });

  it('clears notification taskId filters when the URL query is removed', async () => {
    setMockUser(
      createMockUser({
        permissions: ['task:read'],
      })
    );

    window.history.pushState({}, '', '/tasks?taskId=42');
    renderWithProviders(
      <MemoryRouter initialEntries={['/tasks?taskId=42']}>
        <TaskCenterWithTaskIdClear />
      </MemoryRouter>
    );

    expect(getLastTaskQueryParams()).toEqual(
      expect.objectContaining({
        taskId: 42,
      })
    );

    await userEvent.click(screen.getByRole('button', { name: '清理任务通知' }));

    expect(getLastTaskQueryParams()).not.toEqual(
      expect.objectContaining({
        taskId: 42,
      })
    );
  });

  it('does not carry the calendar default date range back to the today view', async () => {
    setMockUser(
      createMockUser({
        permissions: ['task:read'],
      })
    );

    renderTaskCenter();
    await userEvent.click(screen.getByRole('tab', { name: '日历' }));
    await userEvent.click(screen.getByRole('tab', { name: '今日' }));

    expect(getLastTaskQueryParams()).toEqual(
      expect.objectContaining({
        view: 'today',
      })
    );
    expect(getLastTaskQueryParams()).not.toEqual(
      expect.objectContaining({
        startDate: expect.any(String),
        endDate: expect.any(String),
      })
    );
  });

  it('disables creating tasks with a tooltip when every task list is archived', async () => {
    taskHookMocks.useTaskLists.mockReturnValue({
      data: [{ id: 1, name: '归档清单', scope: 'family', sort: 0, isArchived: true }],
      isLoading: false,
    });
    setMockUser(
      createMockUser({
        permissions: ['task:read', 'task:create'],
      })
    );

    renderTaskCenter();

    const createButton = screen.getByRole('button', { name: /新建任务/ });
    expect(createButton).toBeDisabled();

    await userEvent.hover(createButton.parentElement ?? createButton);
    expect(await screen.findByText('请先创建或启用一个任务清单')).toBeInTheDocument();
  });

  it('disables row actions while the matching task action is pending', () => {
    taskHookMocks.useTasks.mockReturnValue({
      data: {
        items: [
          {
            id: 7,
            title: '待完成任务',
            listId: 1,
            status: 'pending',
            taskType: 'task',
            important: false,
            urgent: false,
            recurrenceType: 'none',
            continuousReminderEnabled: true,
            continuousReminderIntervalMinutes: 30,
            createdAt: '2026-04-01T00:00:00.000Z',
            updatedAt: '2026-04-01T00:00:00.000Z',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
      },
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    taskHookMocks.useCompleteTask.mockReturnValue({
      ...mockMutation(),
      isPending: true,
      variables: 7,
    });
    setMockUser(
      createMockUser({
        permissions: ['task:read', 'task:complete', 'task:update', 'task:delete'],
      })
    );

    renderTaskCenter();

    expect(screen.getByRole('button', { name: /完成/ })).toBeDisabled();
  });

  it('clears date range params when switching to views that do not support date filtering', async () => {
    setMockUser(
      createMockUser({
        permissions: ['task:read'],
      })
    );

    renderTaskCenter();
    await userEvent.click(screen.getByRole('tab', { name: '日历' }));
    expect(getLastTaskQueryParams()).toEqual(
      expect.objectContaining({
        view: 'calendar',
        startDate: expect.any(String),
        endDate: expect.any(String),
      })
    );

    await userEvent.click(screen.getByRole('tab', { name: '四象限' }));

    expect(getLastTaskQueryParams()).toEqual(
      expect.objectContaining({
        view: 'matrix',
      })
    );
    expect(getLastTaskQueryParams()).not.toEqual(
      expect.objectContaining({
        startDate: expect.any(String),
        endDate: expect.any(String),
      })
    );
  });

  it('maps table sorting to backend sort params', async () => {
    setMockUser(
      createMockUser({
        permissions: ['task:read'],
      })
    );

    renderTaskCenter();
    await userEvent.click(screen.getByRole('columnheader', { name: /截止时间/ }));

    expect(taskHookMocks.useTasks).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sort: 'dueAt',
        order: 'ASC',
      })
    );
  });
});
