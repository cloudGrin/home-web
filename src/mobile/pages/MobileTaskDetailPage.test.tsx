import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MobileTaskDetailPage } from './MobileTaskDetailPage';
import { useAuthStore } from '@/features/auth/stores/authStore';
import type { Task } from '@/features/task/types/task.types';

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

function renderPage(initialPath = '/tasks/42') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/tasks/:id" element={<MobileTaskDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('MobileTaskDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMobilePermissions(['task:read', 'task:update', 'task:delete', 'task:complete']);
    fileServiceMocks.createFileAccessLink.mockResolvedValue({ url: '/inline-preview' });
    taskServiceMocks.getAttachmentDownloadUrl.mockReturnValue('/task-download');
    taskServiceMocks.createAttachmentAccessLink.mockResolvedValue({ url: '/task-download' });
    taskHooks.useTask.mockReturnValue({ data: baseTask, isLoading: false });
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

  it('moves a task to another matrix quadrant from the standalone detail page', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /移动象限/ }));
    fireEvent.click(screen.getByText('重要且紧急'));

    expect(updateMutate).toHaveBeenCalledWith(
      { id: 42, data: { important: true, urgent: true } },
      expect.any(Object)
    );
  });

  it('hides standalone detail actions without write permissions', async () => {
    setMobilePermissions(['task:read']);

    renderPage();

    expect(await screen.findByText('交电费')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /编辑/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /删除/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /移动象限/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /完成/ })).not.toBeInTheDocument();
  });

  it('marks standalone family tasks assigned to the current user', async () => {
    taskHooks.useTask.mockReturnValue({
      data: {
        ...baseTask,
        assigneeId: 1,
        assignee: { id: 1, username: 'tester', nickname: '我' },
      },
      isLoading: false,
    });

    renderPage();

    expect(await screen.findByText('指派给我')).toBeInTheDocument();
  });

  it('disables the standalone complete action while completion is pending', async () => {
    taskHooks.useCompleteTask.mockReturnValue({ mutate, isPending: true, variables: 42 });

    renderPage();

    expect(await screen.findByRole('button', { name: /完成/ })).toBeDisabled();
  });

  it('preopens a window before awaiting private attachment download links', async () => {
    const openedWindow = {
      close: vi.fn(),
      location: { href: '' },
      opener: {},
    } as unknown as Window;
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => openedWindow);
    const accessLink = deferred<{ url: string }>();
    taskServiceMocks.createAttachmentAccessLink.mockReturnValueOnce(accessLink.promise);
    taskHooks.useTask.mockReturnValue({
      data: {
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
      },
      isLoading: false,
    });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: '下载' }));
    expect(openSpy).toHaveBeenCalledWith('about:blank', '_blank');
    expect(openedWindow.location.href).toBe('');

    accessLink.resolve({ url: '/task-download' });
    await waitFor(() =>
      expect(taskServiceMocks.createAttachmentAccessLink).toHaveBeenCalledWith(
        baseTask.id,
        71,
        'attachment'
      )
    );
    await waitFor(() => expect(openedWindow.location.href).toBe('/task-download'));
  });

  it('preopens a window before awaiting private attachment preview links', async () => {
    const openedWindow = {
      close: vi.fn(),
      location: { href: '' },
      opener: {},
    } as unknown as Window;
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => openedWindow);
    const accessLink = deferred<{ url: string }>();
    fileServiceMocks.createFileAccessLink.mockReturnValueOnce(accessLink.promise);
    taskHooks.useTask.mockReturnValue({
      data: {
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
      },
      isLoading: false,
    });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: '预览' }));
    expect(openSpy).toHaveBeenCalledWith('about:blank', '_blank');
    expect(openedWindow.location.href).toBe('');

    accessLink.resolve({ url: '/inline-preview' });
    await waitFor(() =>
      expect(fileServiceMocks.createFileAccessLink).toHaveBeenCalledWith(71, 'inline')
    );
    await waitFor(() => expect(openedWindow.location.href).toBe('/inline-preview'));
  });
});
