import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import dayjs from 'dayjs';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MobileTaskPage, TaskEditorPopup } from './MobileTaskPage';
import type { Task } from '@/features/task/types/task.types';
import { useAuthStore } from '@/features/auth/stores/authStore';

const fileServiceMocks = vi.hoisted(() => ({
  createFileAccessLink: vi.fn(),
  uploadFile: vi.fn(),
}));
const taskServiceMocks = vi.hoisted(() => ({
  getAttachmentDownloadUrl: vi.fn(),
  createAttachmentAccessLink: vi.fn(),
}));
const taskHooks = vi.hoisted(() => ({
  useTaskLists: vi.fn(),
  useTaskAssignees: vi.fn(),
  useTasks: vi.fn(),
  useTask: vi.fn(),
  useCreateTask: vi.fn(),
  useUpdateTask: vi.fn(),
  useCompleteTask: vi.fn(),
  useReopenTask: vi.fn(),
  useSnoozeTaskReminder: vi.fn(),
  useDeleteTask: vi.fn(),
  useCreateTaskList: vi.fn(),
  useUpdateTaskList: vi.fn(),
  useDeleteTaskList: vi.fn(),
}));

vi.mock('@/features/file/services/file.service', () => fileServiceMocks);
vi.mock('@/features/file/utils/file-url', () => ({
  resolveFileAccessUrl: (url: string) => url,
}));
vi.mock('@/features/task/services/task.service', () => ({
  taskService: taskServiceMocks,
}));
vi.mock('@/features/task/hooks/useTasks', () => taskHooks);

const mutate = vi.fn();
const updateMutate = vi.fn();

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function setMobilePermissions(permissions: string[]) {
  useAuthStore.setState({
    token: 'token',
    refreshToken: 'refresh-token',
    user: {
      id: 1,
      username: 'tester',
      email: 'tester@example.com',
      status: 'active',
      roles: [],
      permissions,
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
    },
  });
}

const baseTask: Task = {
  id: 42,
  title: '交电费',
  description: '每月账单',
  listId: 1,
  list: { id: 1, name: '收集箱', scope: 'family', sort: 1, isArchived: false },
  assigneeId: 2,
  assignee: { id: 2, username: 'mom', nickname: '妈妈' },
  status: 'pending',
  taskType: 'task',
  dueAt: '2026-05-02T10:00:00.000Z',
  remindAt: '2026-05-02T09:00:00.000Z',
  remindedAt: null,
  completedAt: null,
  important: true,
  urgent: false,
  tags: ['家庭'],
  recurrenceType: 'monthly',
  recurrenceInterval: 1,
  continuousReminderEnabled: true,
  continuousReminderIntervalMinutes: 30,
  createdAt: '2026-05-01T10:00:00.000Z',
  updatedAt: '2026-05-01T10:00:00.000Z',
};

function renderPage(initialPath = '/tasks') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <MobileTaskPage />
    </MemoryRouter>
  );
}

function readMobileCss() {
  return readFileSync('src/mobile/styles.css', 'utf8');
}

function cssRule(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return readMobileCss().match(new RegExp(`${escapedSelector} \\{[\\s\\S]*?\\n\\}`))?.[0] ?? '';
}

describe('MobileTaskPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMobilePermissions([
      'task:read',
      'task:create',
      'task:update',
      'task:delete',
      'task:complete',
      'task-list:manage',
    ]);
    fileServiceMocks.createFileAccessLink.mockResolvedValue({ url: '/inline-preview' });
    taskServiceMocks.getAttachmentDownloadUrl.mockReturnValue('/task-download');
    taskServiceMocks.createAttachmentAccessLink.mockResolvedValue({ url: '/task-download' });
    window.localStorage.removeItem('home-task-last-list-id');
    taskHooks.useTaskLists.mockReturnValue({
      data: [{ id: 1, name: '收集箱', scope: 'family', sort: 1, isArchived: false }],
    });
    taskHooks.useTaskAssignees.mockReturnValue({
      data: [{ id: 2, username: 'mom', nickname: '妈妈' }],
    });
    taskHooks.useTasks.mockReturnValue({
      data: { items: [baseTask], total: 1, page: 1, pageSize: 100 },
      isLoading: false,
      refetch: vi.fn().mockResolvedValue(undefined),
    });
    taskHooks.useTask.mockReturnValue({ data: undefined, isLoading: false });
    taskHooks.useCreateTask.mockReturnValue({ mutate, isPending: false });
    taskHooks.useUpdateTask.mockReturnValue({ mutate: updateMutate, isPending: false });
    taskHooks.useCompleteTask.mockReturnValue({ mutate, isPending: false });
    taskHooks.useReopenTask.mockReturnValue({ mutate, isPending: false });
    taskHooks.useSnoozeTaskReminder.mockReturnValue({ mutate, isPending: false });
    taskHooks.useDeleteTask.mockReturnValue({ mutate, isPending: false });
    taskHooks.useCreateTaskList.mockReturnValue({ mutate, isPending: false });
    taskHooks.useUpdateTaskList.mockReturnValue({ mutate, isPending: false });
    taskHooks.useDeleteTaskList.mockReturnValue({ mutate, isPending: false });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('defaults /m/tasks to the today task view', async () => {
    renderPage();

    await waitFor(() =>
      expect(taskHooks.useTasks).toHaveBeenCalledWith(expect.objectContaining({ view: 'today' }))
    );
    expect(screen.getByRole('heading', { name: '今天' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '列表' })).not.toBeInTheDocument();
  });

  it('falls back old mobile list view URLs to today', async () => {
    renderPage('/tasks?view=today');

    await waitFor(() =>
      expect(taskHooks.useTasks).toHaveBeenCalledWith(expect.objectContaining({ view: 'today' }))
    );
  });

  it('opens a task detail sheet from the taskId query parameter', async () => {
    taskHooks.useTask.mockReturnValue({ data: baseTask, isLoading: false });

    renderPage('/tasks?taskId=42');

    expect(await screen.findByText('任务详情')).toBeInTheDocument();
    expect(screen.getAllByText('交电费').length).toBeGreaterThan(0);
    expect(taskHooks.useTask).toHaveBeenCalledWith(42);
  });

  it('switches task views through the mobile task dock', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /日历/ }));

    await waitFor(() =>
      expect(taskHooks.useTasks).toHaveBeenLastCalledWith(
        expect.objectContaining({ view: 'calendar' })
      )
    );
    expect(screen.getByRole('heading', { name: /月/ })).toBeInTheDocument();
  });

  it('keeps the add task button above the standalone app bottom dock', () => {
    const css = readMobileCss();
    const baseFabIndex = css.indexOf('.mobile-fab {');
    const taskFabIndex = css.indexOf('.mobile-fab.mobile-task-fab {');

    expect(taskFabIndex).toBeGreaterThan(baseFabIndex);
    expect(cssRule('.mobile-fab.mobile-task-fab')).toContain(
      'bottom: calc(86px + env(safe-area-inset-bottom));'
    );
  });

  it('shows all four matrix quadrants at the same time', () => {
    renderPage('/tasks?view=matrix');

    expect(screen.getByText('重要且紧急')).toBeInTheDocument();
    expect(screen.getByText('重要不紧急')).toBeInTheDocument();
    expect(screen.getByText('紧急不重要')).toBeInTheDocument();
    expect(screen.getByText('不重要不紧急')).toBeInTheDocument();
  });

  it('shows recurring task occurrences in the calendar list mode', async () => {
    taskHooks.useTasks.mockReturnValue({
      data: {
        items: [
          {
            ...baseTask,
            title: '每周缴费',
            dueAt: '2026-05-01T10:00:00.000Z',
            remindAt: null,
            recurrenceType: 'weekly',
            recurrenceInterval: 1,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 100,
      },
      isLoading: false,
      refetch: vi.fn().mockResolvedValue(undefined),
    });

    renderPage('/tasks?view=calendar&date=2026-05-01');

    const listModeButtons = await screen.findAllByRole('button', { name: '列表' });
    fireEvent.click(listModeButtons[0]);

    expect(await screen.findByText('05月01日')).toBeInTheDocument();
    expect(screen.getByText('05月08日')).toBeInTheDocument();
    expect(screen.getByText('05月15日')).toBeInTheDocument();
    expect(screen.getByText('05月22日')).toBeInTheDocument();
    expect(screen.getByText('05月29日')).toBeInTheDocument();
    expect(screen.getAllByText('每周缴费')).toHaveLength(5);
  });

  it('creates anniversary tasks from the anniversary dock view', async () => {
    const { container } = renderPage('/tasks?view=anniversary');

    const createButton = container.querySelector('.mobile-task-fab');
    expect(createButton).not.toBeNull();
    fireEvent.click(createButton as Element);

    expect(await screen.findByText('纪念日日期')).toBeInTheDocument();
    fireEvent.change(await screen.findByPlaceholderText('纪念日名称'), {
      target: { value: '结婚纪念日' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存纪念日' }));

    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        expect.objectContaining({ taskType: 'anniversary' }),
        expect.any(Object)
      )
    );
  });

  it('renders anniversary cards with the upcoming countdown', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-10T12:00:00.000Z'));
    taskHooks.useTasks.mockReturnValue({
      data: {
        items: [
          {
            ...baseTask,
            id: 77,
            title: '结婚纪念日',
            taskType: 'anniversary',
            dueAt: '2020-05-20T00:00:00.000Z',
            remindAt: null,
            recurrenceType: 'yearly',
            continuousReminderEnabled: false,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 100,
      },
      isLoading: false,
      refetch: vi.fn().mockResolvedValue(undefined),
    });

    renderPage('/tasks?view=anniversary');

    const card = screen.getByTestId('mobile-anniversary-card-77');
    expect(card).toBeInTheDocument();
    expect(screen.getByText('结婚纪念日')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('天')).toBeInTheDocument();
    expect(screen.getByText('2026-05-20')).toBeInTheDocument();
    expect(screen.queryByText('原始日期 2020-05-20')).not.toBeInTheDocument();
    expect(screen.queryByText('6 周年')).not.toBeInTheDocument();
    expect(screen.queryByText('待纪念')).not.toBeInTheDocument();
    expect(card.textContent).not.toContain('收集箱');
    expect(card.textContent).not.toContain('妈妈');
  });

  it('shows anniversary countdown semantics in the regular mobile task list', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-10T12:00:00.000Z'));
    taskHooks.useTasks.mockReturnValue({
      data: {
        items: [
          {
            ...baseTask,
            id: 78,
            title: '结婚纪念日',
            taskType: 'anniversary',
            dueAt: '2020-05-20T00:00:00.000Z',
            remindAt: null,
            recurrenceType: 'yearly',
            continuousReminderEnabled: false,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 50,
      },
      isLoading: false,
      refetch: vi.fn().mockResolvedValue(undefined),
    });

    renderPage('/tasks?view=list');

    const row = screen.getByText('结婚纪念日').closest('.mobile-task-row');
    expect(row).not.toBeNull();
    expect(row?.textContent).toContain('2026-05-20');
    expect(row?.textContent).toContain('还有 10 天');
    expect(row?.textContent).toContain('纪念日');
    expect(row?.textContent).not.toContain('重复');
  });

  it('uses a neutral anniversary card style instead of a red background', () => {
    const cardRule = cssRule('.mobile-anniversary-card');
    const countdownRule = cssRule('.mobile-anniversary-countdown');

    expect(cardRule).not.toContain('244, 114, 182');
    expect(cardRule).not.toContain('255, 241, 242');
    expect(countdownRule).not.toContain('#e11d48');
  });

  it('submits mobile checklist items in the reordered display order', async () => {
    const { container } = renderPage('/tasks?view=today');

    const createButton = container.querySelector('.mobile-task-fab');
    expect(createButton).not.toBeNull();
    fireEvent.click(createButton as Element);

    fireEvent.change(await screen.findByPlaceholderText('准备做什么？'), {
      target: { value: '整理材料' },
    });
    fireEvent.click(screen.getByRole('button', { name: /检查项/ }));
    fireEvent.click(screen.getByRole('button', { name: /检查项/ }));

    const inputs = screen.getAllByPlaceholderText('检查项');
    fireEvent.change(inputs[0], { target: { value: '第一项' } });
    fireEvent.change(inputs[1], { target: { value: '第二项' } });
    fireEvent.click(screen.getAllByRole('button', { name: '上移' })[1]);
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          checkItems: [
            expect.objectContaining({ title: '第二项', sort: 0 }),
            expect.objectContaining({ title: '第一项', sort: 1 }),
          ],
        }),
        expect.any(Object)
      )
    );
  });

  it('previews and downloads existing attachments from the mobile editor', async () => {
    const previewWindow = {
      close: vi.fn(),
      location: { href: '' },
      opener: {},
    } as unknown as Window;
    const downloadWindow = {
      close: vi.fn(),
      location: { href: '' },
      opener: {},
    } as unknown as Window;
    const openSpy = vi
      .spyOn(window, 'open')
      .mockImplementationOnce(() => previewWindow)
      .mockImplementationOnce(() => downloadWindow);
    const accessLink = deferred<{ url: string }>();
    taskServiceMocks.createAttachmentAccessLink.mockReturnValueOnce(accessLink.promise);

    render(
      <TaskEditorPopup
        open
        task={{
          ...baseTask,
          attachments: [
            {
              id: 7,
              taskId: baseTask.id,
              fileId: 71,
              sort: 0,
              file: {
                id: 71,
                originalName: '理赔材料.pdf',
                mimeType: 'application/pdf',
                size: 1024,
                module: 'task-attachment',
                createdAt: '2026-05-01T00:00:00.000Z',
                updatedAt: '2026-05-01T00:00:00.000Z',
              },
            },
          ],
        }}
        lists={[{ id: 1, name: '收集箱', scope: 'family', sort: 1, isArchived: false }]}
        users={[]}
        defaultListId={1}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '预览' }));
    await waitFor(() =>
      expect(fileServiceMocks.createFileAccessLink).toHaveBeenCalledWith(71, 'inline')
    );
    expect(openSpy).toHaveBeenCalledWith('about:blank', '_blank');
    expect(previewWindow.location.href).toBe('/inline-preview');

    fireEvent.click(screen.getByRole('button', { name: '下载' }));
    expect(openSpy).toHaveBeenCalledWith('about:blank', '_blank');
    expect(downloadWindow.location.href).toBe('');

    accessLink.resolve({ url: '/task-download' });
    await waitFor(() =>
      expect(taskServiceMocks.createAttachmentAccessLink).toHaveBeenCalledWith(
        baseTask.id,
        71,
        'attachment'
      )
    );
    await waitFor(() => expect(downloadWindow.location.href).toBe('/task-download'));
  });

  it('preopens a window before awaiting private attachment preview links from the mobile editor', async () => {
    const openedWindow = {
      close: vi.fn(),
      location: { href: '' },
      opener: {},
    } as unknown as Window;
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => openedWindow);
    const accessLink = deferred<{ url: string }>();
    fileServiceMocks.createFileAccessLink.mockReturnValueOnce(accessLink.promise);

    render(
      <TaskEditorPopup
        open
        task={{
          ...baseTask,
          attachments: [
            {
              id: 7,
              taskId: baseTask.id,
              fileId: 71,
              sort: 0,
              file: {
                id: 71,
                originalName: '理赔材料.pdf',
                mimeType: 'application/pdf',
                size: 1024,
                module: 'task-attachment',
                createdAt: '2026-05-01T00:00:00.000Z',
                updatedAt: '2026-05-01T00:00:00.000Z',
              },
            },
          ],
        }}
        lists={[{ id: 1, name: '收集箱', scope: 'family', sort: 1, isArchived: false }]}
        users={[]}
        defaultListId={1}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '预览' }));
    expect(openSpy).toHaveBeenCalledWith('about:blank', '_blank');
    expect(openedWindow.location.href).toBe('');

    accessLink.resolve({ url: '/inline-preview' });
    await waitFor(() =>
      expect(fileServiceMocks.createFileAccessLink).toHaveBeenCalledWith(71, 'inline')
    );
    await waitFor(() => expect(openedWindow.location.href).toBe('/inline-preview'));
  });

  it('uses the shared recent task list when creating on mobile', async () => {
    const expectedDueAt = dayjs().hour(18).minute(0).second(0).millisecond(0);
    window.localStorage.setItem('home-task-last-list-id', '2');
    taskHooks.useTaskLists.mockReturnValue({
      data: [
        { id: 1, name: '收集箱', scope: 'family', sort: 1, isArchived: false },
        { id: 2, name: '个人事项', scope: 'personal', sort: 2, isArchived: false },
      ],
    });
    const { container } = renderPage('/tasks?view=today');

    const createButton = container.querySelector('.mobile-task-fab');
    expect(createButton).not.toBeNull();
    fireEvent.click(createButton as Element);

    fireEvent.change(await screen.findByPlaceholderText('准备做什么？'), {
      target: { value: '使用最近清单' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        expect.objectContaining({ listId: 2, dueAt: expect.any(String) }),
        expect.any(Object)
      )
    );
    const payload = mutate.mock.calls[0][0] as { dueAt: string };
    expect(dayjs(payload.dueAt).format('YYYY-MM-DD HH:mm')).toBe(
      expectedDueAt.format('YYYY-MM-DD HH:mm')
    );
  });

  it('marks mobile family tasks assigned to the current user', async () => {
    taskHooks.useTasks.mockReturnValue({
      data: {
        items: [
          {
            ...baseTask,
            assigneeId: 1,
            assignee: { id: 1, username: 'tester', nickname: '我' },
          },
        ],
        total: 1,
        page: 1,
        pageSize: 50,
      },
      isLoading: false,
      refetch: vi.fn().mockResolvedValue(undefined),
    });

    renderPage('/tasks?view=today');

    expect(await screen.findByText('指派给我')).toBeInTheDocument();
  });

  it('loads the next mobile task page and appends it to the current view', async () => {
    taskHooks.useTasks.mockImplementation((params) => ({
      data: {
        items: params.page === 2 ? [{ ...baseTask, id: 43, title: '第二页任务' }] : [baseTask],
        total: 2,
        page: params.page ?? 1,
        pageSize: 1,
      },
      isLoading: false,
      isFetching: false,
      refetch: vi.fn().mockResolvedValue(undefined),
    }));

    renderPage('/tasks?view=today');

    expect(await screen.findByText('交电费')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '加载更多' }));

    await waitFor(() =>
      expect(taskHooks.useTasks).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }))
    );
    expect(await screen.findByText('第二页任务')).toBeInTheDocument();
  });

  it('removes stale tasks when a loaded mobile page no longer returns them', async () => {
    let includeSecondPageTask = true;
    taskHooks.useTasks.mockImplementation((params) => ({
      data: {
        items:
          params.page === 2
            ? includeSecondPageTask
              ? [{ ...baseTask, id: 43, title: '第二页任务' }]
              : []
            : [baseTask],
        total: includeSecondPageTask ? 2 : 1,
        page: params.page ?? 1,
        pageSize: 1,
      },
      isLoading: false,
      isFetching: false,
      refetch: vi.fn().mockResolvedValue(undefined),
    }));
    const view = renderPage('/tasks?view=today');

    fireEvent.click(await screen.findByRole('button', { name: '加载更多' }));
    expect(await screen.findByText('第二页任务')).toBeInTheDocument();

    includeSecondPageTask = false;
    view.rerender(
      <MemoryRouter initialEntries={['/tasks?view=today']}>
        <MobileTaskPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.queryByText('第二页任务')).not.toBeInTheDocument());
  });

  it('applies mobile-friendly sort filters without list date filters', async () => {
    const { container } = renderPage('/tasks?view=today');

    const filterButton = container.querySelector('.mobile-task-header-actions button');
    expect(filterButton).not.toBeNull();
    fireEvent.click(filterButton as Element);
    expect(screen.queryByText('未来 7 天')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('截止最近'));
    fireEvent.click(screen.getByRole('button', { name: '应用' }));

    await waitFor(() =>
      expect(taskHooks.useTasks).toHaveBeenLastCalledWith(
        expect.objectContaining({
          view: 'today',
          sort: 'dueAt',
          order: 'ASC',
        })
      )
    );
    expect(taskHooks.useTasks).toHaveBeenLastCalledWith(
      expect.not.objectContaining({
        startDate: expect.any(String),
        endDate: expect.any(String),
      })
    );
  });

  it('moves a mobile matrix task through the detail action sheet', async () => {
    taskHooks.useTask.mockReturnValue({ data: baseTask, isLoading: false });

    renderPage('/tasks?taskId=42');

    fireEvent.click(await screen.findByRole('button', { name: /移动象限/ }));
    fireEvent.click(screen.getByText('重要且紧急'));

    expect(updateMutate).toHaveBeenCalledWith(
      { id: 42, data: { important: true, urgent: true } },
      expect.any(Object)
    );
  });

  it('disables the mobile detail sheet complete action while completion is pending', async () => {
    taskHooks.useTask.mockReturnValue({ data: baseTask, isLoading: false });
    taskHooks.useCompleteTask.mockReturnValue({ mutate, isPending: true, variables: 42 });

    renderPage('/tasks?taskId=42');

    expect(await screen.findByRole('button', { name: /完成/ })).toBeDisabled();
  });

  it('hides mobile task actions when the user lacks write permissions', async () => {
    setMobilePermissions(['task:read']);
    taskHooks.useTask.mockReturnValue({ data: baseTask, isLoading: false });
    const { container } = renderPage('/tasks?taskId=42');

    expect(container.querySelector('.mobile-task-fab')).toBeNull();
    expect(await screen.findByText('任务详情')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /编辑/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /删除/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /移动象限/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /完成/ })).not.toBeInTheDocument();
  });
});
