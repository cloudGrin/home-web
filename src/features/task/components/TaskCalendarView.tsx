import { useEffect, useMemo, useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import { Badge, Button, Empty, List, Space, Tag } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { cn, formatDate } from '@/shared/utils';
import { useAuthStore } from '@/features/auth/stores/authStore';
import type { PaginatedResult, Task, TaskActionPending } from '../types/task.types';
import {
  groupTasksByCalendarDate,
  isRecurringTask,
  sortCalendarOccurrences,
  type TaskCalendarOccurrence,
} from '../utils/taskCalendar';
import { isTaskAssignedToUser } from '../utils/taskAssignment';
import { TaskQuickActions } from './TaskQuickActions';

interface TaskCalendarViewProps {
  data?: PaginatedResult<Task>;
  loading?: boolean;
  month: Dayjs;
  startDate?: string;
  endDate?: string;
  onMonthChange: (month: Dayjs) => void;
  onEdit: (task: Task) => void;
  onComplete: (task: Task) => void;
  onReopen: (task: Task) => void;
  onSnooze?: (task: Task) => void;
  onDelete: (task: Task) => void;
  actionPending?: TaskActionPending | null;
}

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

function getItemStatus(item: TaskCalendarOccurrence) {
  if (item.task.status === 'completed') {
    return 'success' as const;
  }

  if (item.task.urgent) {
    return 'error' as const;
  }

  if (item.task.important) {
    return 'warning' as const;
  }

  return 'processing' as const;
}

function getDefaultSelectedDate(month: Dayjs) {
  const today = dayjs();
  return today.isSame(month, 'month') ? today.startOf('day') : month.startOf('month');
}

function getMonthGridDates(month: Dayjs) {
  const monthStart = month.startOf('month');
  const mondayOffset = monthStart.day() === 0 ? 6 : monthStart.day() - 1;
  const gridStart = monthStart.subtract(mondayOffset, 'day');

  return Array.from({ length: 42 }, (_, index) => gridStart.add(index, 'day'));
}

function formatDateHeading(date: Dayjs) {
  return `${date.format('YYYY-MM-DD')} 周${WEEKDAY_LABELS[date.day() === 0 ? 6 : date.day() - 1]}`;
}

export function TaskCalendarView({
  data,
  loading,
  month,
  startDate,
  endDate,
  onMonthChange,
  onEdit,
  onComplete,
  onReopen,
  onSnooze,
  onDelete,
  actionPending,
}: TaskCalendarViewProps) {
  const currentUserId = useAuthStore((state) => state.user?.id);
  const groups = useMemo(
    () => groupTasksByCalendarDate(data?.items ?? [], startDate, endDate),
    [data?.items, endDate, startDate]
  );
  const currentMonth = month.startOf('month');
  const [selectedDate, setSelectedDate] = useState(() => getDefaultSelectedDate(currentMonth));
  const selectedDateKey = selectedDate.format('YYYY-MM-DD');
  const selectedItems = sortCalendarOccurrences(groups.get(selectedDateKey) ?? []);
  const monthDates = useMemo(() => getMonthGridDates(currentMonth), [currentMonth]);

  useEffect(() => {
    setSelectedDate((previous) =>
      previous.isSame(currentMonth, 'month') ? previous : getDefaultSelectedDate(currentMonth)
    );
  }, [currentMonth]);

  const handleMonthChange = (nextMonth: Dayjs) => {
    onMonthChange(nextMonth.startOf('month'));
  };

  const renderDateCell = (date: Dayjs) => {
    const dateKey = date.format('YYYY-MM-DD');
    const inCurrentMonth = date.isSame(currentMonth, 'month');
    const isSelected = date.isSame(selectedDate, 'day');
    const isToday = date.isSame(dayjs(), 'day');
    const tasks = sortCalendarOccurrences(groups.get(dateKey) ?? []);
    const visibleTasks = tasks.slice(0, 2);
    const extraCount = tasks.length - visibleTasks.length;

    return (
      <button
        key={dateKey}
        type="button"
        aria-label={inCurrentMonth ? `选择 ${dateKey}` : `非当前月 ${dateKey}`}
        disabled={!inCurrentMonth}
        onClick={() => setSelectedDate(date.startOf('day'))}
        className={cn(
          'h-[58px] min-w-0 rounded-md border px-2 py-1.5 text-left transition',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1',
          inCurrentMonth
            ? 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/50'
            : 'cursor-default border-slate-100 bg-slate-50/60 text-slate-300',
          isSelected && 'border-indigo-500 bg-indigo-50 shadow-sm',
          isToday && !isSelected && 'border-emerald-300 bg-emerald-50/60'
        )}
      >
        <div className="mb-1 flex items-center justify-between gap-1">
          <span
            className={cn(
              'text-xs font-semibold',
              inCurrentMonth ? 'text-slate-800' : 'text-slate-300',
              isSelected && 'text-indigo-700'
            )}
          >
            {date.date()}
          </span>
          {tasks.length > 0 ? (
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] leading-none',
                isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
              )}
            >
              {tasks.length}项
            </span>
          ) : null}
        </div>
        <div className="space-y-0.5">
          {visibleTasks.map((item) => (
            <div key={item.key} className="flex min-w-0 items-center gap-1 text-[11px] leading-4">
              <Badge status={getItemStatus(item)} />
              <span className="truncate text-slate-600">{item.task.title}</span>
            </div>
          ))}
          {extraCount > 0 ? (
            <div className="text-[11px] leading-4 text-slate-500">+{extraCount} 项</div>
          ) : null}
        </div>
      </button>
    );
  };

  const selectedDetailTitle = formatDateHeading(selectedDate);

  if (loading && !data?.items.length) {
    return (
      <div
        data-testid="task-calendar-grid"
        className="rounded-lg border border-slate-200 bg-white p-6"
      >
        加载中
      </div>
    );
  }

  return (
    <div
      data-testid="task-calendar-layout"
      className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]"
    >
      <div
        data-testid="task-calendar-grid"
        className="rounded-lg border border-slate-200 bg-white p-4"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-base font-semibold text-slate-900">
              {currentMonth.format('YYYY年MM月')}
            </div>
            <div className="text-xs text-slate-500">点击日期查看当天任务</div>
          </div>
          <Space size={8}>
            <Button
              aria-label="上个月"
              icon={<LeftOutlined />}
              onClick={() => handleMonthChange(currentMonth.subtract(1, 'month'))}
            />
            <Button
              aria-label="下个月"
              icon={<RightOutlined />}
              onClick={() => handleMonthChange(currentMonth.add(1, 'month'))}
            />
          </Space>
        </div>
        <div className="grid grid-cols-7 gap-1.5 pb-1 text-center text-xs font-medium text-slate-500">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label}>{label}</div>
          ))}
        </div>
        <div data-testid="task-calendar-compact-days" className="grid grid-cols-7 gap-1.5">
          {monthDates.map(renderDateCell)}
        </div>
      </div>

      <aside
        data-testid="task-calendar-day-detail"
        className="rounded-lg border border-slate-200 bg-white p-4"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-slate-900">{selectedDetailTitle}</div>
            <div className="text-xs text-slate-500">{selectedItems.length} 项任务</div>
          </div>
        </div>
        {selectedItems.length > 0 ? (
          <List
            rowKey="key"
            dataSource={selectedItems}
            renderItem={(item) => (
              <List.Item
                className="rounded-md border border-slate-100 px-3"
                actions={[
                  <TaskQuickActions
                    key="actions"
                    task={item.task}
                    onEdit={onEdit}
                    onComplete={onComplete}
                    onReopen={onReopen}
                    onSnooze={onSnooze}
                    onDelete={onDelete}
                    actionPending={actionPending}
                  />,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space size={[8, 4]} wrap>
                      <span>{item.task.title}</span>
                      {item.task.status === 'completed' ? <Tag color="green">已完成</Tag> : null}
                      {isRecurringTask(item.task) ? <Tag color="blue">重复</Tag> : null}
                      {isTaskAssignedToUser(item.task, currentUserId) ? (
                        <Tag color="processing">指派给我</Tag>
                      ) : null}
                    </Space>
                  }
                  description={
                    <Space size={[8, 4]} wrap>
                      <span>截止：{formatDate.full(item.occurrenceDueAt)}</span>
                      <span>提醒：{formatDate.full(item.occurrenceRemindAt)}</span>
                      {item.task.list?.name ? <Tag>{item.task.list.name}</Tag> : null}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        ) : (
          <Empty description="当天没有任务" />
        )}
      </aside>
    </div>
  );
}
