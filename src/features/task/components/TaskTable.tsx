import dayjs from 'dayjs';
import { Space, Table, Tag, Tooltip } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  RollbackOutlined,
} from '@ant-design/icons';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import type { SorterResult } from 'antd/es/table/interface';
import { StatusBadge, TableActions } from '@/shared/components';
import { formatDate } from '@/shared/utils';
import { useAuthStore } from '@/features/auth/stores/authStore';
import type { PaginatedResult, Task, TaskActionPending, TaskActionType } from '../types/task.types';
import { isTaskAssignedToUser } from '../utils/taskAssignment';

interface TaskTableProps {
  data?: PaginatedResult<Task>;
  loading?: boolean;
  onEdit: (task: Task) => void;
  onComplete: (task: Task) => void;
  onReopen: (task: Task) => void;
  onSnooze?: (task: Task) => void;
  onDelete: (task: Task) => void;
  onTableChange: (pagination: TablePaginationConfig, sorter: SorterResult<Task>) => void;
  actionPending?: TaskActionPending | null;
}

function isActionPending(
  actionPending: TaskActionPending | null | undefined,
  task: Task,
  type?: TaskActionType
) {
  return actionPending?.taskId === task.id && (!type || actionPending.type === type);
}

function getStatus(task: Task) {
  if (task.status === 'completed') {
    return { status: 'success' as const, text: '已完成' };
  }
  if (task.dueAt && dayjs(task.dueAt).isBefore(dayjs())) {
    return { status: 'error' as const, text: '已过期' };
  }
  return { status: 'warning' as const, text: '待办' };
}

function renderTags(tags?: string[] | null) {
  if (!tags?.length) {
    return '-';
  }

  return (
    <Space size={[0, 4]} wrap>
      {tags.map((tag) => (
        <Tag key={tag}>{tag}</Tag>
      ))}
    </Space>
  );
}

export function TaskTable({
  data,
  loading,
  onEdit,
  onComplete,
  onReopen,
  onSnooze,
  onDelete,
  onTableChange,
  actionPending,
}: TaskTableProps) {
  const currentUserId = useAuthStore((state) => state.user?.id);
  const columns: ColumnsType<Task> = [
    {
      title: '任务',
      dataIndex: 'title',
      key: 'title',
      width: 260,
      sorter: true,
      render: (title: string, record) => (
        <Space direction="vertical" size={2}>
          <Tooltip title={record.description || title}>
            <span className="font-medium text-slate-900 dark:text-slate-100">{title}</span>
          </Tooltip>
          <span className="text-xs text-slate-500">
            {record.list?.name || `清单 #${record.listId}`}
          </span>
          {isTaskAssignedToUser(record, currentUserId) ? <Tag color="processing">指派给我</Tag> : null}
          {record.checkItems?.length || record.attachments?.length ? (
            <span className="text-xs text-slate-500">
              {record.checkItems?.length
                ? `检查项 ${record.checkItems.filter((item) => item.completed).length}/${record.checkItems.length}`
                : null}
              {record.checkItems?.length && record.attachments?.length ? ' · ' : null}
              {record.attachments?.length ? `附件 ${record.attachments.length}` : null}
            </span>
          ) : null}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (_, record) => {
        const status = getStatus(record);
        return <StatusBadge status={status.status} text={status.text} />;
      },
    },
    {
      title: '截止时间',
      dataIndex: 'dueAt',
      key: 'dueAt',
      width: 170,
      sorter: true,
      render: formatDate.full,
    },
    {
      title: '提醒时间',
      dataIndex: 'remindAt',
      key: 'remindAt',
      width: 170,
      sorter: true,
      render: formatDate.full,
    },
    {
      title: '负责人',
      dataIndex: 'assignee',
      width: 120,
      render: (_, record) =>
        record.assignee?.realName ||
        record.assignee?.nickname ||
        record.assignee?.username ||
        (record.assigneeId ? `用户 #${record.assigneeId}` : '-'),
    },
    {
      title: '象限',
      key: 'matrix',
      width: 120,
      render: (_, record) => (
        <Space size={4}>
          {record.important ? <Tag color="red">重要</Tag> : <Tag>普通</Tag>}
          {record.urgent ? <Tag color="orange">紧急</Tag> : null}
        </Space>
      ),
    },
    {
      title: '标签',
      dataIndex: 'tags',
      width: 180,
      render: renderTags,
    },
    {
      title: '操作',
      key: 'actions',
      fixed: 'right',
      width: 220,
      render: (_, record) => {
        const rowPending = isActionPending(actionPending, record);

        return (
          <TableActions
            actions={[
              record.status === 'completed'
                ? {
                    label: '重开',
                    icon: <RollbackOutlined />,
                    onClick: () => onReopen(record),
                    permission: 'task:update',
                    loading: isActionPending(actionPending, record, 'reopen'),
                    disabled: rowPending,
                  }
                : {
                    label: '完成',
                    icon: <CheckCircleOutlined />,
                    onClick: () => onComplete(record),
                    permission: 'task:complete',
                    loading: isActionPending(actionPending, record, 'complete'),
                    disabled: rowPending,
                  },
              {
                label: '编辑',
                icon: <EditOutlined />,
                onClick: () => onEdit(record),
                permission: 'task:update',
                disabled: rowPending,
              },
              ...(onSnooze && record.status !== 'completed' && record.remindAt
                ? [
                    {
                      label: '稍后',
                      icon: <ClockCircleOutlined />,
                      onClick: () => onSnooze(record),
                      permission: 'task:update',
                      loading: isActionPending(actionPending, record, 'snooze'),
                      disabled: rowPending,
                    },
                  ]
                : []),
              {
                label: '删除',
                icon: <DeleteOutlined />,
                onClick: () => onDelete(record),
                danger: true,
                permission: 'task:delete',
                loading: isActionPending(actionPending, record, 'delete'),
                disabled: rowPending,
              },
            ]}
          />
        );
      },
    },
  ];

  return (
    <Table<Task>
      columns={columns}
      dataSource={data?.items ?? []}
      rowKey="id"
      loading={loading}
      pagination={{
        current: data?.page ?? 1,
        pageSize: data?.pageSize ?? 10,
        total: data?.total ?? 0,
        pageSizeOptions: [10, 20, 50, 100],
        showSizeChanger: true,
        showQuickJumper: true,
        showTotal: (total) => `共 ${total} 条`,
      }}
      onChange={(pagination, _filters, sorter) =>
        onTableChange(pagination, Array.isArray(sorter) ? sorter[0] : sorter)
      }
      scroll={{ x: 1350 }}
    />
  );
}
