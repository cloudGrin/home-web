import { useState } from 'react';
import { Button, Card, Checkbox, List, NavBar, Tag, Toast } from 'antd-mobile';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { createFileAccessLink } from '@/features/file/services/file.service';
import { resolveFileAccessUrl } from '@/features/file/utils/file-url';
import {
  useCompleteTask,
  useDeleteTask,
  useReopenTask,
  useSnoozeTaskReminder,
  useTask,
  useTaskAssignees,
  useTaskLists,
  useUpdateTask,
} from '@/features/task/hooks/useTasks';
import type {
  CreateTaskDto,
  Task,
  TaskAssignee,
  TaskAttachment,
  TaskList,
  UpdateTaskDto,
} from '@/features/task/types/task.types';
import { taskService } from '@/features/task/services/task.service';
import {
  closeAttachmentWindow,
  navigateAttachmentWindow,
  openAttachmentWindow,
} from '@/features/task/utils/attachmentWindow';
import { usePermission } from '@/shared/hooks/usePermission';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { isTaskAssignedToUser } from '@/features/task/utils/taskAssignment';
import { SnoozeSheet, TaskEditorPopup, TaskQuadrantSheet } from './MobileTaskPage';
import { formatTaskRecurrence } from '../utils/task';

function formatDateTime(value?: string | null) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-';
}

function userName(user?: TaskAssignee | null) {
  return user?.realName || user?.nickname || user?.username || '-';
}

function findList(task: Task, lists: TaskList[]) {
  return task.list ?? lists.find((list) => list.id === task.listId) ?? null;
}

function findAssignee(task: Task, users: TaskAssignee[]) {
  return task.assignee ?? users.find((user) => user.id === task.assigneeId) ?? null;
}

function isPreviewableAttachment(attachment: TaskAttachment) {
  const mimeType = attachment.file?.mimeType ?? '';
  return mimeType.startsWith('image/') || mimeType === 'application/pdf';
}

async function openAttachment(
  task: Task,
  attachment: TaskAttachment,
  disposition: 'inline' | 'attachment'
) {
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
}

export function MobileTaskDetailPage() {
  const navigate = useNavigate();
  const params = useParams();
  const taskId = Number(params.id);
  const [editorOpen, setEditorOpen] = useState(false);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [quadrantOpen, setQuadrantOpen] = useState(false);
  const { hasPermission } = usePermission();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const taskQuery = useTask(Number.isInteger(taskId) ? taskId : null);
  const listsQuery = useTaskLists();
  const usersQuery = useTaskAssignees();
  const updateTask = useUpdateTask();
  const completeTask = useCompleteTask();
  const reopenTask = useReopenTask();
  const snoozeTaskReminder = useSnoozeTaskReminder();
  const deleteTask = useDeleteTask();
  const task = taskQuery.data;
  const lists = listsQuery.data ?? [];
  const users = usersQuery.data ?? [];
  const list = task ? findList(task, lists) : null;
  const assignee = task ? findAssignee(task, users) : null;
  const isCompleted = task?.status === 'completed';
  const canUpdate = hasPermission(['task:update']);
  const canDelete = hasPermission(['task:delete']);
  const canComplete = hasPermission(['task:complete']);
  const canToggleTask = task ? (task.status === 'completed' ? canUpdate : canComplete) : false;
  const togglePendingTaskId = (
    completeTask.isPending
      ? completeTask.variables
      : reopenTask.isPending
        ? reopenTask.variables
        : undefined
  ) as number | undefined;
  const togglePending = task ? togglePendingTaskId === task.id : false;

  const handleSubmit = (payload: CreateTaskDto | UpdateTaskDto) => {
    if (!task) return;
    updateTask.mutate(
      { id: task.id, data: payload },
      {
        onSuccess: () => setEditorOpen(false),
      }
    );
  };

  const handleDelete = async () => {
    if (!task) return;
    deleteTask.mutate(task.id, {
      onSuccess: () => navigate('/tasks', { replace: true }),
    });
  };

  const handleMoveQuadrant = (target: Pick<UpdateTaskDto, 'important' | 'urgent'>) => {
    if (!task) return;
    if (task.important === target.important && task.urgent === target.urgent) {
      setQuadrantOpen(false);
      return;
    }

    updateTask.mutate(
      {
        id: task.id,
        data: target,
      },
      {
        onSuccess: () => setQuadrantOpen(false),
      }
    );
  };

  return (
    <div className="mobile-detail-page">
      <NavBar onBack={() => navigate(-1)}>任务详情</NavBar>
      <div className="mobile-detail-body mobile-detail-body-with-actions">
        {!task ? (
          <Card className="mobile-card">{taskQuery.isLoading ? '加载中...' : '任务不存在'}</Card>
        ) : (
          <div className="mobile-section">
            <Card className="mobile-card">
              <h1 className="mobile-title">{task.title}</h1>
              <div className="mobile-chip-row mt-3">
                <Tag color={task.status === 'completed' ? 'success' : 'primary'}>
                  {task.status === 'completed' ? '已完成' : '待办'}
                </Tag>
                {task.important ? <Tag color="danger">重要</Tag> : null}
                {task.urgent ? <Tag color="warning">紧急</Tag> : null}
                {isTaskAssignedToUser(task, currentUserId) ? (
                  <Tag color="primary">指派给我</Tag>
                ) : null}
                {task.taskType === 'anniversary' ? <Tag color="primary">纪念日</Tag> : null}
              </div>
              {task.description ? (
                <p className="mt-3 whitespace-pre-wrap">{task.description}</p>
              ) : null}
            </Card>

            <List className="mobile-detail-list">
              <List.Item extra={list?.name || '-'}>清单</List.Item>
              <List.Item extra={userName(assignee)}>负责人</List.Item>
              <List.Item extra={formatDateTime(task.dueAt)}>截止时间</List.Item>
              <List.Item extra={formatDateTime(task.remindAt)}>提醒时间</List.Item>
              <List.Item extra={formatTaskRecurrence(task.recurrenceType, task.recurrenceInterval)}>
                重复规则
              </List.Item>
              <List.Item extra={task.continuousReminderEnabled ? '每 30 分钟，直到完成' : '关闭'}>
                持续提醒
              </List.Item>
              <List.Item extra={task.tags?.join(', ') || '-'}>标签</List.Item>
            </List>
            {task.checkItems?.length ? (
              <Card className="mobile-card">
                <h2 className="mobile-section-title">检查清单</h2>
                <div className="mobile-task-check-list">
                  {task.checkItems.map((item, index) => (
                    <Checkbox
                      key={item.id ?? index}
                      checked={item.completed}
                      disabled={!canUpdate}
                      onChange={(completed) => {
                        if (!canUpdate) return;
                        updateTask.mutate({
                          id: task.id,
                          data: {
                            checkItems: task.checkItems?.map((current, currentIndex) => ({
                              id: current.id,
                              title: current.title,
                              completed: currentIndex === index ? completed : current.completed,
                              sort: current.sort ?? currentIndex,
                            })),
                          },
                        });
                      }}
                    >
                      {item.title}
                    </Checkbox>
                  ))}
                </div>
              </Card>
            ) : null}
            {task.attachments?.length ? (
              <Card className="mobile-card">
                <h2 className="mobile-section-title">附件</h2>
                <div className="mobile-task-attachment-list">
                  {task.attachments.map((attachment) => (
                    <div key={attachment.fileId} className="mobile-task-attachment-row">
                      <div>
                        <strong>
                          {attachment.file?.originalName || `文件 #${attachment.fileId}`}
                        </strong>
                        <span>{attachment.file?.mimeType || '未知类型'}</span>
                      </div>
                      <div>
                        {isPreviewableAttachment(attachment) ? (
                          <Button
                            size="mini"
                            fill="outline"
                            onClick={() => void openAttachment(task, attachment, 'inline')}
                          >
                            预览
                          </Button>
                        ) : null}
                        <Button
                          size="mini"
                          fill="outline"
                          onClick={() => void openAttachment(task, attachment, 'attachment')}
                        >
                          下载
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}
          </div>
        )}
      </div>
      {task ? (
        <div className="mobile-bottom-actions">
          {canDelete ? (
            <Button
              size="small"
              color="danger"
              fill="outline"
              loading={deleteTask.isPending}
              onClick={() => void handleDelete()}
            >
              删除
            </Button>
          ) : null}
          <div className="mobile-bottom-actions-right">
            {canUpdate ? (
              <Button
                size="small"
                color="primary"
                fill="outline"
                onClick={() => setQuadrantOpen(true)}
              >
                移动象限
              </Button>
            ) : null}
            {canToggleTask ? (
              <Button
                size="small"
                color={isCompleted ? 'default' : 'success'}
                disabled={togglePending}
                onClick={() => {
                  if (togglePending) return;
                  if (isCompleted) {
                    reopenTask.mutate(task.id);
                    return;
                  }
                  completeTask.mutate(task.id);
                }}
              >
                {isCompleted ? '重开' : '完成'}
              </Button>
            ) : null}
            {canUpdate ? (
              <Button size="small" color="primary" onClick={() => setEditorOpen(true)}>
                编辑
              </Button>
            ) : null}
            {canUpdate && task.remindAt && !isCompleted ? (
              <Button
                size="small"
                color="primary"
                fill="outline"
                loading={snoozeTaskReminder.isPending}
                onClick={() => setSnoozeOpen(true)}
              >
                稍后
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      <TaskEditorPopup
        open={editorOpen}
        task={task ?? null}
        lists={lists.filter((item) => !item.isArchived)}
        users={users}
        defaultListId={lists.find((item) => !item.isArchived)?.id}
        submitting={updateTask.isPending}
        onClose={() => setEditorOpen(false)}
        onSubmit={handleSubmit}
      />
      <SnoozeSheet
        open={snoozeOpen}
        onClose={() => setSnoozeOpen(false)}
        onSelect={(snoozeUntil) => {
          if (!task) return;
          snoozeTaskReminder.mutate({ id: task.id, data: { snoozeUntil } });
          setSnoozeOpen(false);
        }}
      />
      <TaskQuadrantSheet
        open={quadrantOpen}
        task={task ?? null}
        onClose={() => setQuadrantOpen(false)}
        onSelect={handleMoveQuadrant}
      />
    </div>
  );
}
