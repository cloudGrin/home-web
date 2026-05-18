import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Upload,
  message,
} from 'antd';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  EyeOutlined,
  MinusCircleOutlined,
  PlusOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { createFileAccessLink, uploadFile } from '@/features/file/services/file.service';
import { resolveFileAccessUrl } from '@/features/file/utils/file-url';
import type {
  CreateTaskDto,
  Task,
  TaskAssignee,
  TaskAttachment,
  TaskList,
  TaskRecurrenceType,
  TaskType,
  UpdateTaskDto,
} from '../types/task.types';
import { taskService } from '../services/task.service';
import {
  closeAttachmentWindow,
  navigateAttachmentWindow,
  openAttachmentWindow,
} from '../utils/attachmentWindow';
import { formatTaskListOptionLabel } from '../utils/taskList';

interface TaskFormModalProps {
  open: boolean;
  task: Task | null;
  lists: TaskList[];
  users: TaskAssignee[];
  defaultDueAt?: Dayjs;
  defaultListId?: number;
  defaultTaskType?: TaskType;
  submitting?: boolean;
  onCancel: () => void;
  onSubmit: (data: CreateTaskDto | UpdateTaskDto) => void;
}

interface TaskFormValues {
  title: string;
  description?: string;
  listId: number;
  assigneeId?: number;
  taskType: TaskType;
  dueAt?: Dayjs;
  remindAt?: Dayjs;
  remindOffset?: RemindOffsetValue;
  important: boolean;
  urgent: boolean;
  tags?: string[];
  attachmentFileIds?: number[];
  checkItems?: Array<{
    id?: number;
    title?: string;
    completed?: boolean;
    sort?: number;
  }>;
  recurrenceType: TaskRecurrenceType;
  recurrenceInterval?: number;
  continuousReminderEnabled: boolean;
  continuousReminderIntervalMinutes?: number;
}

const recurrenceOptions: Array<{ label: string; value: TaskRecurrenceType }> = [
  { label: '不重复', value: 'none' },
  { label: '每天', value: 'daily' },
  { label: '每周', value: 'weekly' },
  { label: '每月', value: 'monthly' },
  { label: '每年', value: 'yearly' },
  { label: '工作日', value: 'weekdays' },
  { label: '自定义间隔', value: 'custom' },
];

const CUSTOM_REMIND_OFFSET = 'custom';
type RemindOffsetValue = number | typeof CUSTOM_REMIND_OFFSET;

const remindOffsetOptions: Array<{ label: string; value: number }> = [
  { label: '提前 15 分钟', value: 15 },
  { label: '提前 30 分钟', value: 30 },
  { label: '提前 1 小时', value: 60 },
  { label: '提前 2 小时', value: 120 },
  { label: '提前 1 天', value: 24 * 60 },
  { label: '提前 2 天', value: 2 * 24 * 60 },
  { label: '提前 3 天', value: 3 * 24 * 60 },
  { label: '提前 1 周', value: 7 * 24 * 60 },
];

function toRemindOffset(
  dueAt?: string | null,
  remindAt?: string | null
): RemindOffsetValue | undefined {
  if (!dueAt || !remindAt) return undefined;
  const diff = dayjs(dueAt).diff(dayjs(remindAt), 'minute');
  return remindOffsetOptions.some((o) => o.value === diff) ? diff : CUSTOM_REMIND_OFFSET;
}

const recurrenceIntervalConfig: Partial<Record<TaskRecurrenceType, { unit: string; max: number }>> =
  {
    daily: { unit: '天', max: 365 },
    weekly: { unit: '周', max: 52 },
    monthly: { unit: '月', max: 12 },
    yearly: { unit: '年', max: 10 },
    custom: { unit: '天', max: 365 },
  };

function supportsRecurrenceInterval(type: TaskRecurrenceType) {
  return type in recurrenceIntervalConfig;
}

function toDateValue(value?: string | null) {
  return value ? dayjs(value) : undefined;
}

function attachmentIds(task?: Task | null) {
  return task?.attachments?.map((attachment) => attachment.fileId) ?? [];
}

function isPreviewableAttachment(attachment: TaskAttachment) {
  const mimeType = attachment.file?.mimeType ?? '';
  return mimeType.startsWith('image/') || mimeType === 'application/pdf';
}

function normalizeCheckItems(values?: TaskFormValues['checkItems']) {
  return (values ?? [])
    .map((item, index) => ({
      id: item.id,
      title: item.title?.trim() ?? '',
      completed: item.completed ?? false,
      sort: index,
    }))
    .filter((item) => item.title);
}

function toPayload(values: TaskFormValues, isEditing: boolean): CreateTaskDto | UpdateTaskDto {
  const isRecurring = values.recurrenceType !== 'none';
  if (!values.dueAt) {
    throw new Error('请选择截止时间');
  }

  const payload: CreateTaskDto = {
    title: values.title.trim(),
    listId: values.listId,
    dueAt: values.dueAt.toISOString(),
    taskType: values.taskType,
    important: values.important,
    urgent: values.urgent,
    tags: values.tags ?? [],
    attachmentFileIds: values.attachmentFileIds ?? [],
    checkItems: normalizeCheckItems(values.checkItems),
    recurrenceType: values.recurrenceType,
    continuousReminderEnabled: values.continuousReminderEnabled,
  };
  if (values.taskType !== 'anniversary') {
    payload.continuousReminderIntervalMinutes = values.continuousReminderIntervalMinutes ?? 30;
  }

  const description = values.description?.trim();
  if (description) {
    payload.description = description;
  } else if (isEditing) {
    payload.description = null;
  }
  if (values.assigneeId) {
    payload.assigneeId = values.assigneeId;
  } else if (isEditing) {
    payload.assigneeId = null;
  }
  if (isRecurring) {
    const computedRemindAt =
      values.dueAt && typeof values.remindOffset === 'number'
        ? values.dueAt.subtract(values.remindOffset, 'minute').toISOString()
        : null;
    if (values.remindOffset === CUSTOM_REMIND_OFFSET && values.remindAt) {
      payload.remindAt = values.remindAt.toISOString();
    } else if (computedRemindAt) {
      payload.remindAt = computedRemindAt;
    } else if (isEditing) {
      payload.remindAt = null;
    }
  } else {
    if (values.remindAt) {
      payload.remindAt = values.remindAt.toISOString();
    } else if (isEditing) {
      payload.remindAt = null;
    }
  }

  if (supportsRecurrenceInterval(values.recurrenceType) && values.recurrenceInterval) {
    payload.recurrenceInterval = values.recurrenceInterval;
  } else if (isEditing) {
    payload.recurrenceInterval = null;
  }

  return payload;
}

export function TaskFormModal({
  open,
  task,
  lists,
  users,
  defaultDueAt,
  defaultListId,
  defaultTaskType = 'task',
  submitting,
  onCancel,
  onSubmit,
}: TaskFormModalProps) {
  const [form] = Form.useForm<TaskFormValues>();
  const [uploadedAttachments, setUploadedAttachments] = useState<TaskAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const activeLists = lists.filter((list) => !list.isArchived);
  const firstActiveListId =
    defaultListId && activeLists.some((list) => list.id === defaultListId)
      ? defaultListId
      : activeLists[0]?.id;
  const initializedKeyRef = useRef<number | 'create' | null>(null);

  const handleRecurrenceTypeChange = (value: TaskRecurrenceType) => {
    if (value === 'none') {
      form.setFieldValue('remindOffset', undefined);
    } else {
      form.setFieldValue('remindAt', undefined);
    }
  };

  const handleTaskTypeChange = (value: TaskType) => {
    if (value !== 'anniversary') {
      return;
    }

    if (form.getFieldValue('recurrenceType') === 'none') {
      form.setFieldValue('recurrenceType', 'yearly');
    }
    form.setFieldsValue({
      urgent: false,
      important: false,
      continuousReminderEnabled: false,
    });
  };
  const currentList = task
    ? (lists.find((list) => list.id === task.listId) ?? task.list)
    : undefined;
  const mustMigrateArchivedList = Boolean(task && currentList?.isArchived);
  const customRecurringReminder =
    task?.recurrenceType !== 'none' &&
    task?.remindAt &&
    toRemindOffset(task.dueAt, task.remindAt) === CUSTOM_REMIND_OFFSET
      ? task.remindAt
      : null;
  const currentRemindOffsetOptions: Array<{ label: string; value: RemindOffsetValue }> =
    customRecurringReminder
      ? [
          {
            label: `保留当前提醒时间（${dayjs(customRecurringReminder).format('YYYY-MM-DD HH:mm')}）`,
            value: CUSTOM_REMIND_OFFSET,
          },
          ...remindOffsetOptions,
        ]
      : remindOffsetOptions;
  const watchedTaskType = Form.useWatch('taskType', form);
  const watchedListId = Form.useWatch('listId', form);
  const selectedFormList =
    lists.find((list) => list.id === watchedListId) ??
    (task && task.listId === watchedListId ? task.list : undefined);
  const canAssignTask = selectedFormList?.scope !== 'personal';
  const isAnniversaryForm =
    watchedTaskType === 'anniversary' || (!task && defaultTaskType === 'anniversary');

  useEffect(() => {
    if (!open) {
      initializedKeyRef.current = null;
      form.resetFields();
      setUploadedAttachments([]);
      return;
    }

    const nextKey = task?.id ?? 'create';
    if (initializedKeyRef.current === nextKey) {
      return;
    }
    initializedKeyRef.current = nextKey;

    if (task) {
      const isRecurring = task.recurrenceType !== 'none';
      const remindOffset = isRecurring ? toRemindOffset(task.dueAt, task.remindAt) : undefined;
      form.setFieldsValue({
        title: task.title,
        description: task.description ?? undefined,
        listId: mustMigrateArchivedList ? undefined : task.listId,
        assigneeId: task.assigneeId ?? undefined,
        taskType: task.taskType,
        dueAt: toDateValue(task.dueAt),
        remindAt:
          isRecurring && remindOffset !== CUSTOM_REMIND_OFFSET
            ? undefined
            : toDateValue(task.remindAt),
        remindOffset,
        important: task.important,
        urgent: task.urgent,
        tags: task.tags ?? [],
        attachmentFileIds: attachmentIds(task),
        checkItems: task.checkItems?.map((item, index) => ({
          id: item.id,
          title: item.title,
          completed: item.completed,
          sort: item.sort ?? index,
        })),
        recurrenceType: task.recurrenceType,
        recurrenceInterval: task.recurrenceInterval ?? undefined,
        continuousReminderEnabled: task.continuousReminderEnabled ?? true,
        continuousReminderIntervalMinutes: task.continuousReminderIntervalMinutes ?? 30,
      });
      setUploadedAttachments(task.attachments ?? []);
      return;
    }

    const nextTaskType = defaultTaskType;
    form.setFieldsValue({
      title: '',
      description: undefined,
      listId: firstActiveListId,
      assigneeId: undefined,
      taskType: nextTaskType,
      dueAt: nextTaskType === 'anniversary' ? (defaultDueAt ?? dayjs()) : defaultDueAt,
      remindAt: undefined,
      remindOffset: undefined,
      important: false,
      urgent: false,
      tags: [],
      attachmentFileIds: [],
      checkItems: [],
      recurrenceType: nextTaskType === 'anniversary' ? 'yearly' : 'none',
      recurrenceInterval: undefined,
      continuousReminderEnabled: nextTaskType !== 'anniversary',
      continuousReminderIntervalMinutes: 30,
    });
    setUploadedAttachments([]);
  }, [defaultDueAt, defaultTaskType, firstActiveListId, form, mustMigrateArchivedList, open, task]);

  useEffect(() => {
    if (!open || task || form.getFieldValue('listId') || !firstActiveListId) {
      return;
    }

    form.setFieldValue('listId', firstActiveListId);
  }, [firstActiveListId, form, open, task]);

  useEffect(() => {
    if (!open || canAssignTask || !form.getFieldValue('assigneeId')) {
      return;
    }

    form.setFieldValue('assigneeId', undefined);
  }, [canAssignTask, form, open, watchedListId]);

  const handleOk = async () => {
    let values: TaskFormValues;

    try {
      values = await form.validateFields();
    } catch {
      // Ant Design has already rendered field-level validation errors.
      return;
    }

    onSubmit(toPayload(values, Boolean(task)));
  };

  const handleAttachmentUpload = async (file: File) => {
    setUploading(true);
    try {
      const uploaded = await uploadFile(file, {
        module: 'task-attachment',
      });
      const currentIds = form.getFieldValue('attachmentFileIds') ?? [];
      form.setFieldValue('attachmentFileIds', [...currentIds, uploaded.id]);
      setUploadedAttachments((previous) => [
        ...previous,
        {
          id: uploaded.id,
          taskId: task?.id ?? 0,
          fileId: uploaded.id,
          sort: previous.length,
          file: uploaded,
        },
      ]);
      message.success('附件已上传');
    } catch {
      message.error('附件上传失败');
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (fileId: number) => {
    const next = (form.getFieldValue('attachmentFileIds') ?? []).filter(
      (item: number) => item !== fileId
    );
    form.setFieldValue('attachmentFileIds', next);
    setUploadedAttachments((previous) => previous.filter((item) => item.fileId !== fileId));
  };

  const previewAttachment = async (attachment: TaskAttachment) => {
    if (!isPreviewableAttachment(attachment)) {
      message.info('该文件类型不支持预览');
      return;
    }

    try {
      const file = attachment.file;
      if (file?.isPublic && file.url) {
        window.open(resolveFileAccessUrl(file.url), '_blank', 'noopener,noreferrer');
        return;
      }
      const { url } = await createFileAccessLink(attachment.fileId, 'inline');
      window.open(resolveFileAccessUrl(url), '_blank', 'noopener,noreferrer');
    } catch {
      message.error('附件预览失败');
    }
  };

  const downloadAttachment = async (attachment: TaskAttachment) => {
    const openedWindow = openAttachmentWindow();
    try {
      if (task?.id) {
        const { url } = await taskService.createAttachmentAccessLink(
          task.id,
          attachment.fileId,
          'attachment'
        );
        navigateAttachmentWindow(openedWindow, resolveFileAccessUrl(url));
        return;
      }

      const { url } = await createFileAccessLink(attachment.fileId, 'attachment');
      navigateAttachmentWindow(openedWindow, resolveFileAccessUrl(url));
    } catch {
      closeAttachmentWindow(openedWindow);
      message.error('附件下载失败');
    }
  };

  return (
    <Modal
      title={task ? '编辑任务' : defaultTaskType === 'anniversary' ? '新增纪念日' : '新建任务'}
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={submitting}
      destroyOnHidden
      forceRender
      width={720}
    >
      <Form form={form} layout="vertical">
        {mustMigrateArchivedList ? (
          <Alert
            className="mb-4"
            type="warning"
            showIcon
            message="当前任务所属清单已归档，请迁移到可用清单"
          />
        ) : null}

        <Form.Item
          name="title"
          label="标题"
          rules={[
            { required: true, message: '请输入任务标题' },
            {
              validator: (_, value?: string) =>
                value?.trim() ? Promise.resolve() : Promise.reject(new Error('任务标题不能为空')),
            },
            { max: 200, message: '标题不能超过 200 个字符' },
          ]}
        >
          <Input
            placeholder={
              isAnniversaryForm ? '例如：结婚纪念日' : '例如：给家里买菜、准备周会、结婚纪念日'
            }
            allowClear
          />
        </Form.Item>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Form.Item
            name="listId"
            label="所属清单"
            rules={[
              {
                required: true,
                message: mustMigrateArchivedList
                  ? '当前任务所属清单已归档，请迁移到可用清单'
                  : '请选择清单',
              },
            ]}
          >
            <Select
              placeholder="请选择清单"
              options={activeLists.map((list) => ({
                label: formatTaskListOptionLabel(list),
                value: list.id,
              }))}
            />
          </Form.Item>

          {canAssignTask ? (
            <Form.Item name="assigneeId" label="负责人">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="可不指定"
                options={users.map((user) => ({
                  label: user.realName || user.nickname || user.username,
                  value: user.id,
                }))}
              />
            </Form.Item>
          ) : null}
        </div>

        <Form.Item name="description" label="描述">
          <Input.TextArea rows={3} placeholder="补充任务说明" allowClear />
        </Form.Item>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Form.Item name="taskType" label="类型">
            <Select
              onChange={handleTaskTypeChange}
              options={[
                { label: '普通任务', value: 'task' },
                { label: '纪念日', value: 'anniversary' },
              ]}
            />
          </Form.Item>

          <Form.Item name="tags" label="标签">
            <Select mode="tags" placeholder="输入后回车添加标签" tokenSeparators={[',']} />
          </Form.Item>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Form.Item
            name="dueAt"
            label={isAnniversaryForm ? '纪念日日期' : '截止时间'}
            dependencies={['taskType', 'recurrenceType', 'remindAt', 'remindOffset']}
            rules={[
              {
                validator: (_, value?: Dayjs) => {
                  const taskType = form.getFieldValue('taskType');
                  const recurrenceType = form.getFieldValue('recurrenceType');
                  const isRecurring = recurrenceType !== 'none';
                  const remindAt = form.getFieldValue('remindAt');
                  const remindOffset = form.getFieldValue('remindOffset');

                  if (taskType === 'anniversary' && !value) {
                    return Promise.reject(new Error('纪念日必须设置日期'));
                  }
                  if (!value) {
                    return Promise.reject(new Error('请选择截止时间'));
                  }
                  if (isRecurring && !value) {
                    return Promise.reject(new Error('重复任务必须设置截止时间'));
                  }
                  if (
                    value &&
                    remindAt &&
                    (!isRecurring || remindOffset === CUSTOM_REMIND_OFFSET) &&
                    dayjs(remindAt).isAfter(value)
                  ) {
                    return Promise.reject(new Error('提醒时间不能晚于截止时间'));
                  }

                  return Promise.resolve();
                },
              },
            ]}
          >
            <DatePicker
              showTime
              className="w-full"
              placeholder={isAnniversaryForm ? '请选择纪念日日期' : '请选择截止时间'}
            />
          </Form.Item>

          {isAnniversaryForm ? null : (
            <Form.Item
              noStyle
              shouldUpdate={(prev, next) => prev.recurrenceType !== next.recurrenceType}
            >
              {({ getFieldValue }) => {
                const isRecurring = getFieldValue('recurrenceType') !== 'none';

                return isRecurring ? (
                  <>
                    <Form.Item name="remindOffset" label="提醒时间">
                      <Select
                        allowClear
                        placeholder="不提醒"
                        options={currentRemindOffsetOptions}
                      />
                    </Form.Item>
                    <Form.Item name="remindAt" hidden>
                      <DatePicker />
                    </Form.Item>
                  </>
                ) : (
                  <Form.Item
                    name="remindAt"
                    label="提醒时间"
                    dependencies={['dueAt']}
                    rules={[
                      {
                        validator: (_, value?: Dayjs) => {
                          const dueAt = form.getFieldValue('dueAt');
                          if (value && dueAt && dayjs(value).isAfter(dueAt)) {
                            return Promise.reject(new Error('提醒时间不能晚于截止时间'));
                          }
                          return Promise.resolve();
                        },
                      },
                    ]}
                  >
                    <DatePicker showTime className="w-full" placeholder="请选择提醒时间" />
                  </Form.Item>
                );
              }}
            </Form.Item>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Form.Item name="recurrenceType" label="重复规则">
            <Select options={recurrenceOptions} onChange={handleRecurrenceTypeChange} />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev, next) => prev.recurrenceType !== next.recurrenceType}
          >
            {({ getFieldValue }) => {
              const recurrenceType = getFieldValue('recurrenceType') as TaskRecurrenceType;
              const config = recurrenceIntervalConfig[recurrenceType];

              return config ? (
                <Form.Item name="recurrenceInterval" label="重复间隔">
                  <InputNumber
                    min={1}
                    max={config.max}
                    addonAfter={config.unit}
                    className="w-full!"
                    placeholder="留空则为 1"
                  />
                </Form.Item>
              ) : (
                <Form.Item label="重复间隔">
                  <InputNumber disabled className="w-full!" placeholder="当前规则无需填写" />
                </Form.Item>
              );
            }}
          </Form.Item>
        </div>

        <Form.Item name="attachmentFileIds" hidden>
          <Select mode="multiple" />
        </Form.Item>
        <Form.Item label="附件">
          <Upload.Dragger
            beforeUpload={(file) => {
              void handleAttachmentUpload(file);
              return false;
            }}
            showUploadList={false}
            disabled={uploading}
          >
            <p>
              <UploadOutlined /> 点击或拖拽上传附件
            </p>
          </Upload.Dragger>
          {uploadedAttachments.length ? (
            <div className="mt-3 space-y-2">
              {uploadedAttachments.map((attachment) => (
                <Space key={attachment.fileId} size={8}>
                  <span>{attachment.file?.originalName || `文件 #${attachment.fileId}`}</span>
                  {isPreviewableAttachment(attachment) ? (
                    <Button
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => void previewAttachment(attachment)}
                    >
                      预览
                    </Button>
                  ) : null}
                  <Button size="small" onClick={() => void downloadAttachment(attachment)}>
                    下载
                  </Button>
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeAttachment(attachment.fileId)}
                  />
                </Space>
              ))}
            </div>
          ) : null}
        </Form.Item>

        {isAnniversaryForm ? null : (
          <Form.Item label="检查清单">
            <Form.List name="checkItems">
              {(fields, { add, remove, move }) => (
                <div className="space-y-2">
                  {fields.map(({ key, name, ...restField }, index) => (
                    <Space key={key} align="baseline" className="w-full">
                      <Form.Item {...restField} name={[name, 'completed']} valuePropName="checked">
                        <Switch size="small" />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'title']} className="mb-0">
                        <Input placeholder={`检查项 ${index + 1}`} />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'id']} hidden>
                        <Input />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'sort']} hidden>
                        <InputNumber />
                      </Form.Item>
                      <Button
                        size="small"
                        type="text"
                        disabled={index === 0}
                        icon={<ArrowUpOutlined />}
                        onClick={() => move(name, name - 1)}
                      >
                        上移
                      </Button>
                      <Button
                        size="small"
                        type="text"
                        disabled={index === fields.length - 1}
                        icon={<ArrowDownOutlined />}
                        onClick={() => move(name, name + 1)}
                      >
                        下移
                      </Button>
                      <Button
                        size="small"
                        type="text"
                        danger
                        icon={<MinusCircleOutlined />}
                        onClick={() => remove(name)}
                      />
                    </Space>
                  ))}
                  <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({})}>
                    添加检查项
                  </Button>
                </div>
              )}
            </Form.List>
          </Form.Item>
        )}

        {isAnniversaryForm ? null : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Form.Item name="continuousReminderEnabled" label="持续提醒" valuePropName="checked">
              <Switch checkedChildren="开启" unCheckedChildren="关闭" />
            </Form.Item>
            <Form.Item
              noStyle
              shouldUpdate={(prev, next) =>
                prev.continuousReminderEnabled !== next.continuousReminderEnabled
              }
            >
              {({ getFieldValue }) =>
                getFieldValue('continuousReminderEnabled') ? (
                  <Form.Item name="continuousReminderIntervalMinutes" label="提醒间隔">
                    <InputNumber min={1} max={1440} addonAfter="分钟" className="w-full!" />
                  </Form.Item>
                ) : null
              }
            </Form.Item>
          </div>
        )}

        {isAnniversaryForm ? null : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Form.Item name="important" label="重要" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="urgent" label="紧急" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>
        )}
      </Form>
    </Modal>
  );
}
