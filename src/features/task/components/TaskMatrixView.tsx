import { useMemo, useState, type DragEvent } from 'react';
import { Card, Empty, Space, Tag } from 'antd';
import { usePermission } from '@/shared/hooks/usePermission';
import { formatDate } from '@/shared/utils';
import { useAuthStore } from '@/features/auth/stores/authStore';
import type { PaginatedResult, Task, TaskActionPending } from '../types/task.types';
import { isTaskAssignedToUser } from '../utils/taskAssignment';
import { TaskQuickActions } from './TaskQuickActions';

interface MatrixMoveTarget {
  important: boolean;
  urgent: boolean;
}

interface TaskMatrixViewProps {
  data?: PaginatedResult<Task>;
  loading?: boolean;
  onEdit: (task: Task) => void;
  onComplete: (task: Task) => void;
  onReopen: (task: Task) => void;
  onSnooze?: (task: Task) => void;
  onDelete: (task: Task) => void;
  onMove?: (task: Task, target: MatrixMoveTarget) => void;
  actionPending?: TaskActionPending | null;
  movingTaskId?: number;
}

interface QuadrantDefinition {
  key: string;
  title: string;
  description: string;
  target: MatrixMoveTarget;
  match: (task: Task) => boolean;
}

const TASK_DRAG_TYPE = 'application/x-home-task-id';

const quadrants: QuadrantDefinition[] = [
  {
    key: 'important-urgent',
    title: '重要且紧急',
    description: '今天必须处理',
    target: { important: true, urgent: true },
    match: (task: Task) => task.important && task.urgent,
  },
  {
    key: 'important-not-urgent',
    title: '重要不紧急',
    description: '计划推进',
    target: { important: true, urgent: false },
    match: (task: Task) => task.important && !task.urgent,
  },
  {
    key: 'not-important-urgent',
    title: '不重要但紧急',
    description: '尽快处理或委托',
    target: { important: false, urgent: true },
    match: (task: Task) => !task.important && task.urgent,
  },
  {
    key: 'not-important-not-urgent',
    title: '不重要不紧急',
    description: '有空再做',
    target: { important: false, urgent: false },
    match: (task: Task) => !task.important && !task.urgent,
  },
];

function TaskCard({
  task,
  onEdit,
  onComplete,
  onReopen,
  onSnooze,
  onDelete,
  actionPending,
  currentUserId,
  canMove,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  task: Task;
  onEdit: (task: Task) => void;
  onComplete: (task: Task) => void;
  onReopen: (task: Task) => void;
  onSnooze?: (task: Task) => void;
  onDelete: (task: Task) => void;
  actionPending?: TaskActionPending | null;
  currentUserId?: number;
  canMove: boolean;
  isDragging: boolean;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      data-testid={`task-matrix-card-${task.id}`}
      draggable={canMove}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={[
        'rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition dark:border-slate-700 dark:bg-slate-900',
        canMove ? 'cursor-grab active:cursor-grabbing' : '',
        isDragging ? 'opacity-50 ring-2 ring-blue-500' : '',
      ].join(' ')}
    >
      <Space direction="vertical" size={6} className="w-full">
        <div className="font-medium text-slate-900 dark:text-slate-100">{task.title}</div>
        <div className="text-xs text-slate-500">截止：{formatDate.full(task.dueAt)}</div>
        {task.tags?.length ? (
          <Space size={[0, 4]} wrap>
            {task.tags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </Space>
        ) : null}
        {isTaskAssignedToUser(task, currentUserId) ? <Tag color="processing">指派给我</Tag> : null}
        <TaskQuickActions
          task={task}
          onEdit={onEdit}
          onComplete={onComplete}
          onReopen={onReopen}
          onSnooze={onSnooze}
          onDelete={onDelete}
          actionPending={actionPending}
        />
      </Space>
    </div>
  );
}

export function TaskMatrixView({
  data,
  loading,
  onEdit,
  onComplete,
  onReopen,
  onSnooze,
  onDelete,
  onMove,
  actionPending,
  movingTaskId,
}: TaskMatrixViewProps) {
  const { hasPermission } = usePermission();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const tasks = useMemo(() => data?.items ?? [], [data?.items]);
  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const [draggingTaskId, setDraggingTaskId] = useState<number | null>(null);
  const [activeQuadrantKey, setActiveQuadrantKey] = useState<string | null>(null);
  const canMoveTasks = hasPermission(['task:update']) && Boolean(onMove);

  const clearDragState = () => {
    setDraggingTaskId(null);
    setActiveQuadrantKey(null);
  };

  const handleDragStart = (task: Task) => (event: DragEvent<HTMLDivElement>) => {
    if (!canMoveTasks || movingTaskId === task.id) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(TASK_DRAG_TYPE, String(task.id));
    event.dataTransfer.setData('text/plain', String(task.id));
    setDraggingTaskId(task.id);
  };

  const handleDragOver = (quadrant: QuadrantDefinition) => (event: DragEvent<HTMLDivElement>) => {
    if (!canMoveTasks) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setActiveQuadrantKey(quadrant.key);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }

    setActiveQuadrantKey(null);
  };

  const handleDrop = (quadrant: QuadrantDefinition) => (event: DragEvent<HTMLDivElement>) => {
    if (!canMoveTasks) {
      return;
    }

    event.preventDefault();
    const taskId = Number(
      event.dataTransfer.getData(TASK_DRAG_TYPE) || event.dataTransfer.getData('text/plain')
    );
    const task = taskById.get(taskId);
    clearDragState();

    if (!task) {
      return;
    }

    if (task.important === quadrant.target.important && task.urgent === quadrant.target.urgent) {
      return;
    }

    onMove?.(task, quadrant.target);
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {quadrants.map((quadrant) => {
        const quadrantTasks = tasks.filter(quadrant.match);
        const isDropActive = activeQuadrantKey === quadrant.key;

        return (
          <Card
            key={quadrant.key}
            data-testid={`task-matrix-quadrant-${quadrant.key}`}
            loading={loading}
            title={quadrant.title}
            extra={<span className="text-xs text-slate-500">{quadrant.description}</span>}
            className={[
              'transition',
              isDropActive ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-950' : '',
            ].join(' ')}
            onDragOver={handleDragOver(quadrant)}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop(quadrant)}
          >
            {quadrantTasks.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无任务" />
            ) : (
              <Space direction="vertical" size={12} className="w-full">
                {quadrantTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onEdit={onEdit}
                    onComplete={onComplete}
                    onReopen={onReopen}
                    onSnooze={onSnooze}
                    onDelete={onDelete}
                    actionPending={actionPending}
                    currentUserId={currentUserId}
                    canMove={canMoveTasks && movingTaskId !== task.id}
                    isDragging={draggingTaskId === task.id}
                    onDragStart={handleDragStart(task)}
                    onDragEnd={clearDragState}
                  />
                ))}
              </Space>
            )}
          </Card>
        );
      })}
    </div>
  );
}
