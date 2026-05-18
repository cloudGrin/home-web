import type { TaskList } from '../types/task.types';

export const TASK_LAST_LIST_ID_STORAGE_KEY = 'home-task-last-list-id';

function getActiveLists(lists: TaskList[]) {
  return lists.filter((list) => !list.isArchived);
}

function getStoredTaskListId() {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const storedId = Number(window.localStorage.getItem(TASK_LAST_LIST_ID_STORAGE_KEY));
  return Number.isInteger(storedId) && storedId > 0 ? storedId : undefined;
}

export function saveLastTaskListId(listId?: number | null) {
  if (!listId || typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(TASK_LAST_LIST_ID_STORAGE_KEY, String(listId));
}

export function pickDefaultTaskListId(lists: TaskList[], preferredListId?: number) {
  const activeLists = getActiveLists(lists);
  if (preferredListId && activeLists.some((list) => list.id === preferredListId)) {
    return preferredListId;
  }

  const storedId = getStoredTaskListId();
  if (storedId && activeLists.some((list) => list.id === storedId)) {
    return storedId;
  }

  return (
    activeLists.find((list) => list.scope === 'personal')?.id ??
    activeLists.find((list) => list.scope === 'family')?.id ??
    activeLists[0]?.id
  );
}

export function getTaskListShortcuts(
  lists: TaskList[],
  selectedListId?: number,
  maxCount = 5
) {
  const activeLists = getActiveLists(lists);
  const storedId = getStoredTaskListId();
  const ids = [
    selectedListId,
    storedId,
    ...activeLists.filter((list) => list.scope === 'personal').map((list) => list.id),
    ...activeLists.filter((list) => list.scope === 'family').map((list) => list.id),
    ...activeLists.map((list) => list.id),
  ];
  const orderedIds = Array.from(new Set(ids.filter((id): id is number => Boolean(id))));
  const listById = new Map(activeLists.map((list) => [list.id, list]));

  return orderedIds
    .map((id) => listById.get(id))
    .filter((list): list is TaskList => Boolean(list))
    .slice(0, maxCount);
}
