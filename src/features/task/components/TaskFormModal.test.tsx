import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import dayjs from 'dayjs';
import { TaskFormModal } from './TaskFormModal';
import { renderWithProviders, userEvent } from '@/test/test-utils';
import type { Task } from '../types/task.types';

const defaultDueAt = dayjs('2026-05-18T18:00:00.000Z');

const task: Task = {
  id: 9,
  title: '整理家庭账单',
  description: '旧描述',
  listId: 1,
  assigneeId: 2,
  status: 'pending',
  taskType: 'task',
  dueAt: '2026-05-01T10:00:00.000Z',
  remindAt: '2026-05-01T09:00:00.000Z',
  important: false,
  urgent: false,
  tags: ['home'],
  recurrenceType: 'none',
  recurrenceInterval: null,
  continuousReminderEnabled: true,
  continuousReminderIntervalMinutes: 30,
  createdAt: '2026-04-01T00:00:00.000Z',
  updatedAt: '2026-04-01T00:00:00.000Z',
};

describe('TaskFormModal', () => {
  beforeEach(() => {
    vi.stubGlobal('getComputedStyle', () => ({
      getPropertyValue: () => '',
    }));
  });

  it('submits null for nullable fields cleared while editing', async () => {
    const onSubmit = vi.fn();

    renderWithProviders(
      <TaskFormModal
        open
        task={task}
        lists={[{ id: 1, name: '家庭计划', scope: 'family', sort: 0, isArchived: false }]}
        users={[{ id: 2, username: 'family-user', nickname: 'Family' }]}
        submitting={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    const description = screen.getByPlaceholderText('补充任务说明');
    await userEvent.clear(description);
    await userEvent.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        description: null,
      })
    );
  });

  it('clears stale recurrence interval when switching to weekdays', async () => {
    const onSubmit = vi.fn();

    renderWithProviders(
      <TaskFormModal
        open
        task={{
          ...task,
          recurrenceType: 'custom',
          recurrenceInterval: 30,
        }}
        lists={[{ id: 1, name: '家庭计划', scope: 'family', sort: 0, isArchived: false }]}
        users={[{ id: 2, username: 'family-user', nickname: 'Family' }]}
        submitting={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await userEvent.click(screen.getByLabelText('重复规则'));
    await userEvent.click(await screen.findByText('工作日'));
    await userEvent.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        recurrenceType: 'weekdays',
        recurrenceInterval: null,
      })
    );
  });

  it('keeps recurrence interval for repeat rules supported by the backend', async () => {
    const onSubmit = vi.fn();

    renderWithProviders(
      <TaskFormModal
        open
        task={{
          ...task,
          recurrenceType: 'custom',
          recurrenceInterval: 30,
        }}
        lists={[{ id: 1, name: '家庭计划', scope: 'family', sort: 0, isArchived: false }]}
        users={[{ id: 2, username: 'family-user', nickname: 'Family' }]}
        submitting={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await userEvent.click(screen.getByLabelText('重复规则'));
    await userEvent.click(await screen.findByText('每天'));
    await userEvent.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        recurrenceType: 'daily',
        recurrenceInterval: 30,
      })
    );
  });

  it('does not reset edited values when task lists refresh while the modal stays open', async () => {
    const onSubmit = vi.fn();
    const { rerender } = renderWithProviders(
      <TaskFormModal
        open
        task={null}
        lists={[{ id: 1, name: '家庭计划', scope: 'family', sort: 0, isArchived: false }]}
        users={[]}
        defaultDueAt={defaultDueAt}
        submitting={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await userEvent.type(
      screen.getByPlaceholderText('例如：给家里买菜、准备周会、结婚纪念日'),
      '用户正在输入'
    );

    rerender(
      <TaskFormModal
        open
        task={null}
        lists={[
          { id: 1, name: '家庭计划', scope: 'family', sort: 0, isArchived: false },
          { id: 2, name: '新清单', scope: 'family', sort: 1, isArchived: false },
        ]}
        users={[]}
        submitting={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByDisplayValue('用户正在输入')).toBeInTheDocument();
  });

  it('uses the first active list when task lists load after the create modal opens', async () => {
    const onSubmit = vi.fn();
    const { rerender } = renderWithProviders(
      <TaskFormModal
        open
        task={null}
        lists={[]}
        users={[]}
        defaultDueAt={defaultDueAt}
        submitting={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    rerender(
      <TaskFormModal
        open
        task={null}
        lists={[{ id: 2, name: '家庭计划', scope: 'family', sort: 0, isArchived: false }]}
        users={[]}
        defaultDueAt={defaultDueAt}
        submitting={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await userEvent.type(
      screen.getByPlaceholderText('例如：给家里买菜、准备周会、结婚纪念日'),
      '列表稍后加载的任务'
    );
    await userEvent.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        listId: 2,
      })
    );
  });

  it('shows task list scope labels without changing the submitted list id', async () => {
    const onSubmit = vi.fn();

    renderWithProviders(
      <TaskFormModal
        open
        task={null}
        lists={[
          { id: 1, name: '家庭计划', scope: 'family', sort: 0, isArchived: false },
          { id: 2, name: '个人事项', scope: 'personal', sort: 1, isArchived: false },
        ]}
        users={[]}
        defaultDueAt={defaultDueAt}
        submitting={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await userEvent.click(screen.getByLabelText('所属清单'));

    expect((await screen.findAllByText('家庭计划（家庭）')).length).toBeGreaterThan(0);
    const personalListOptions = await screen.findAllByText('个人事项（个人）');
    expect(personalListOptions.length).toBeGreaterThan(0);

    await userEvent.click(personalListOptions[0]);
    await userEvent.type(
      screen.getByPlaceholderText('例如：给家里买菜、准备周会、结婚纪念日'),
      '区分清单范围'
    );
    await userEvent.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        listId: 2,
      })
    );
  });

  it('does not offer personal lists when editing a family task', async () => {
    const onSubmit = vi.fn();

    renderWithProviders(
      <TaskFormModal
        open
        task={{
          ...task,
          list: { id: 1, name: '家庭计划', scope: 'family', sort: 0, isArchived: false },
        }}
        lists={[
          { id: 1, name: '家庭计划', scope: 'family', sort: 0, isArchived: false },
          { id: 2, name: '个人事项', scope: 'personal', sort: 1, isArchived: false },
        ]}
        users={[{ id: 2, username: 'family-user', nickname: 'Family' }]}
        submitting={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await userEvent.click(screen.getByLabelText('所属清单'));

    expect((await screen.findAllByText('家庭计划（家庭）')).length).toBeGreaterThan(0);
    expect(screen.queryByText('个人事项（个人）')).not.toBeInTheDocument();
  });

  it('clears the assignee when a new task uses a personal list', async () => {
    const onSubmit = vi.fn();

    renderWithProviders(
      <TaskFormModal
        open
        lists={[
          { id: 1, name: '家庭计划', scope: 'family', sort: 0, isArchived: false },
          { id: 2, name: '个人事项', scope: 'personal', sort: 1, isArchived: false },
        ]}
        users={[{ id: 2, username: 'family-user', nickname: 'Family' }]}
        defaultDueAt={defaultDueAt}
        defaultListId={1}
        submitting={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await userEvent.click(screen.getByLabelText('负责人'));
    await userEvent.click(await screen.findByText('Family'));
    await userEvent.click(screen.getByLabelText('所属清单'));
    await userEvent.click((await screen.findAllByText('个人事项（个人）'))[0]);

    await waitFor(() => expect(screen.queryByLabelText('负责人')).not.toBeInTheDocument());
    await userEvent.type(
      screen.getByPlaceholderText('例如：给家里买菜、准备周会、结婚纪念日'),
      '个人任务'
    );
    await userEvent.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const payload = onSubmit.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).toEqual(expect.objectContaining({ listId: 2 }));
    expect(payload).not.toHaveProperty('assigneeId');
  });

  it('requires moving a task out of an archived list before saving', async () => {
    const onSubmit = vi.fn();

    renderWithProviders(
      <TaskFormModal
        open
        task={{
          ...task,
          listId: 3,
          list: { id: 3, name: '已归档', scope: 'family', sort: 0, isArchived: true },
        }}
        lists={[
          { id: 3, name: '已归档', scope: 'family', sort: 0, isArchived: true },
          { id: 4, name: '可用清单', scope: 'family', sort: 1, isArchived: false },
        ]}
        users={[{ id: 2, username: 'family-user', nickname: 'Family' }]}
        submitting={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'OK' }));

    expect(
      (await screen.findAllByText('当前任务所属清单已归档，请迁移到可用清单')).length
    ).toBeGreaterThan(0);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects blank task titles before submitting', async () => {
    const onSubmit = vi.fn();

    renderWithProviders(
      <TaskFormModal
        open
        task={null}
        lists={[{ id: 1, name: '家庭计划', scope: 'family', sort: 0, isArchived: false }]}
        users={[]}
        defaultDueAt={defaultDueAt}
        submitting={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await userEvent.type(
      screen.getByPlaceholderText('例如：给家里买菜、准备周会、结婚纪念日'),
      '   '
    );
    await userEvent.click(screen.getByRole('button', { name: 'OK' }));

    expect(await screen.findByText('任务标题不能为空')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not expose reminder channels and submits continuous reminders by default', async () => {
    const onSubmit = vi.fn();

    renderWithProviders(
      <TaskFormModal
        open
        task={null}
        lists={[{ id: 1, name: '家庭计划', scope: 'family', sort: 0, isArchived: false }]}
        users={[]}
        defaultDueAt={defaultDueAt}
        submitting={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await userEvent.type(
      screen.getByPlaceholderText('例如：给家里买菜、准备周会、结婚纪念日'),
      '持续提醒任务'
    );
    expect(screen.queryByLabelText('提醒渠道')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        continuousReminderEnabled: true,
        continuousReminderIntervalMinutes: 30,
      })
    );
  });

  it('loads and submits the continuous reminder interval', async () => {
    const onSubmit = vi.fn();

    renderWithProviders(
      <TaskFormModal
        open
        task={{
          ...task,
          continuousReminderIntervalMinutes: 45,
        }}
        lists={[{ id: 1, name: '家庭计划', scope: 'family', sort: 0, isArchived: false }]}
        users={[{ id: 2, username: 'family-user', nickname: 'Family' }]}
        submitting={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByRole('spinbutton', { name: '提醒间隔' })).toHaveValue('45');

    await userEvent.clear(screen.getByRole('spinbutton', { name: '提醒间隔' }));
    await userEvent.type(screen.getByRole('spinbutton', { name: '提醒间隔' }), '15');
    await userEvent.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        continuousReminderEnabled: true,
        continuousReminderIntervalMinutes: 15,
      })
    );
  });

  it('submits checklist items from the task form', async () => {
    const onSubmit = vi.fn();

    renderWithProviders(
      <TaskFormModal
        open
        task={null}
        lists={[{ id: 1, name: '家庭计划', scope: 'family', sort: 0, isArchived: false }]}
        users={[]}
        defaultDueAt={defaultDueAt}
        submitting={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await userEvent.type(
      screen.getByPlaceholderText('例如：给家里买菜、准备周会、结婚纪念日'),
      '理赔材料'
    );
    await userEvent.click(screen.getByRole('button', { name: /添加检查项/ }));
    await userEvent.type(screen.getByPlaceholderText('检查项 1'), '拍照');
    await userEvent.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        checkItems: [expect.objectContaining({ title: '拍照', completed: false, sort: 0 })],
      })
    );
  });

  it('submits checklist items in the reordered display order', async () => {
    const onSubmit = vi.fn();

    renderWithProviders(
      <TaskFormModal
        open
        task={null}
        lists={[{ id: 1, name: '家庭计划', scope: 'family', sort: 0, isArchived: false }]}
        users={[]}
        defaultDueAt={defaultDueAt}
        submitting={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await userEvent.type(
      screen.getByPlaceholderText('例如：给家里买菜、准备周会、结婚纪念日'),
      '检查排序'
    );
    await userEvent.click(screen.getByRole('button', { name: /添加检查项/ }));
    await userEvent.click(screen.getByRole('button', { name: /添加检查项/ }));
    await userEvent.type(screen.getByPlaceholderText('检查项 1'), '第一项');
    await userEvent.type(screen.getByPlaceholderText('检查项 2'), '第二项');
    await userEvent.click(screen.getAllByRole('button', { name: /上移/ })[1]);
    await userEvent.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        checkItems: [
          expect.objectContaining({ title: '第二项', sort: 0 }),
          expect.objectContaining({ title: '第一项', sort: 1 }),
        ],
      })
    );
  });

  it('requires a due date before submitting tasks', async () => {
    const onSubmit = vi.fn();

    renderWithProviders(
      <TaskFormModal
        open
        task={null}
        lists={[{ id: 1, name: '家庭计划', scope: 'family', sort: 0, isArchived: false }]}
        users={[]}
        submitting={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await userEvent.type(
      screen.getByPlaceholderText('例如：给家里买菜、准备周会、结婚纪念日'),
      '重复任务'
    );
    await userEvent.click(screen.getByLabelText('重复规则'));
    await userEvent.click(await screen.findByText('每天'));
    await userEvent.click(screen.getByRole('button', { name: 'OK' }));

    expect(await screen.findByText('请选择截止时间')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('requires a date for anniversary tasks', async () => {
    const onSubmit = vi.fn();

    renderWithProviders(
      <TaskFormModal
        open
        task={null}
        lists={[{ id: 1, name: '家庭计划', scope: 'family', sort: 0, isArchived: false }]}
        users={[]}
        submitting={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await userEvent.type(
      screen.getByPlaceholderText('例如：给家里买菜、准备周会、结婚纪念日'),
      '纪念日'
    );
    await userEvent.click(screen.getByLabelText('类型'));
    await userEvent.click(await screen.findByText('纪念日'));
    await userEvent.click(screen.getByRole('button', { name: 'OK' }));

    expect(await screen.findByText('纪念日必须设置日期')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('converts remindOffset to absolute remindAt on submit for recurring tasks', async () => {
    const onSubmit = vi.fn();

    renderWithProviders(
      <TaskFormModal
        open
        task={{
          ...task,
          dueAt: '2026-06-15T10:00:00.000Z',
          remindAt: '2026-06-12T10:00:00.000Z', // 3 days before = 4320 min
          recurrenceType: 'monthly',
          recurrenceInterval: 1,
        }}
        lists={[{ id: 1, name: '家庭计划', scope: 'family', sort: 0, isArchived: false }]}
        users={[{ id: 2, username: 'family-user', nickname: 'Family' }]}
        submitting={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const payload = onSubmit.mock.calls[0][0] as { remindAt?: string };
    expect(payload.remindAt).toBe('2026-06-12T10:00:00.000Z');
  });

  it('preserves an existing custom recurring reminder when it does not match preset offsets', async () => {
    const onSubmit = vi.fn();
    const customRemindAt = '2026-06-15T08:45:00.000Z';

    renderWithProviders(
      <TaskFormModal
        open
        task={{
          ...task,
          dueAt: '2026-06-15T10:00:00.000Z',
          remindAt: customRemindAt,
          recurrenceType: 'monthly',
          recurrenceInterval: 1,
        }}
        lists={[{ id: 1, name: '家庭计划', scope: 'family', sort: 0, isArchived: false }]}
        users={[{ id: 2, username: 'family-user', nickname: 'Family' }]}
        submitting={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ remindAt: customRemindAt }));
  });

  it('sends remindAt null when no offset selected for recurring task', async () => {
    const onSubmit = vi.fn();

    renderWithProviders(
      <TaskFormModal
        open
        task={{
          ...task,
          dueAt: '2026-06-15T10:00:00.000Z',
          remindAt: null,
          recurrenceType: 'monthly',
          recurrenceInterval: 1,
        }}
        lists={[{ id: 1, name: '家庭计划', scope: 'family', sort: 0, isArchived: false }]}
        users={[{ id: 2, username: 'family-user', nickname: 'Family' }]}
        submitting={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ remindAt: null }));
  });

  it('rejects reminders scheduled after the due date', async () => {
    const onSubmit = vi.fn();

    renderWithProviders(
      <TaskFormModal
        open
        task={{
          ...task,
          dueAt: '2026-05-01T09:00:00.000Z',
          remindAt: '2026-05-01T10:00:00.000Z',
        }}
        lists={[{ id: 1, name: '家庭计划', scope: 'family', sort: 0, isArchived: false }]}
        users={[{ id: 2, username: 'family-user', nickname: 'Family' }]}
        submitting={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'OK' }));

    expect(await screen.findAllByText('提醒时间不能晚于截止时间')).not.toHaveLength(0);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each([
    ['weekly', '52'],
    ['monthly', '12'],
    ['yearly', '10'],
  ] as const)('caps %s recurrence interval by its display unit', (recurrenceType, max) => {
    const { unmount } = renderWithProviders(
      <TaskFormModal
        open
        task={{
          ...task,
          recurrenceType,
          recurrenceInterval: 1,
        }}
        lists={[{ id: 1, name: '家庭计划', scope: 'family', sort: 0, isArchived: false }]}
        users={[{ id: 2, username: 'family-user', nickname: 'Family' }]}
        submitting={false}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByRole('spinbutton', { name: '重复间隔' })).toHaveAttribute(
      'aria-valuemax',
      max
    );
    unmount();
  });
});
