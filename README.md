# Home Web

[中文说明](./README.zh-CN.md)

Home Web is the React frontend for the Home self-hosted personal and family admin suite. It gives
`home-admin` a polished desktop console and a mobile-first `/m` experience for daily use: tasks,
insurance records, family posts, real-time chat, files, notifications, RBAC, and API key management.

It is built for people who want a practical private admin system they can run on their own server,
extend module by module, and keep simple enough for a single-instance deployment.

## Highlights

- Desktop admin console with React 18, Vite 7, TypeScript, Ant Design 5, Tailwind CSS, TanStack
  Query, and Zustand.
- Mobile H5 app under `/m` for family tasks, insurance, notifications, profile settings, family
  posts, and chat.
- Backend-driven dynamic routing from `/menus/user-menus`, with lazy-loaded page components and
  menu-level access control.
- Full RBAC management for users, roles, menus, and permissions.
- Task center with list, today, calendar, Eisenhower matrix, and anniversary views.
- Task attachments, check items, tags, assignees, recurring schedules, reminder snoozing, and
  continuous reminders.
- Family insurance module with members, policies, family view, attachments, status labels, payment
  dates, and reminder-focused mobile views.
- Family circle and chat with image/video uploads, comments, likes, replies, and Socket.IO refresh
  events.
- File manager for local or OSS-backed files, public/private access, previews, downloads, and
  temporary access links.
- Notification center with unread badge, mark-as-read flows, deep links, and mobile notification
  page.
- API app/key management with scope selection, one-time key display, access logs, and an integration
  guide.
- Automation task page for cron configuration, manual runs, and execution logs.
- Dark mode, responsive layouts, typed service layer, and Vitest component/unit coverage.

## Screens and Routes

The Vite build ships two SPA entries:

```text
/      Desktop admin console
/m     Mobile H5 app
```

The desktop console resolves most business pages from backend menu data. The mobile app has its own
route tree for fast daily workflows:

```text
/m/tasks
/m/tasks/:id
/m/insurance
/m/insurance/:id
/m/family
/m/family/compose
/m/family/chat
/m/notifications
/m/profile
```

## Tech Stack

- React 18 and React Router 7
- Vite 7 with SWC
- TypeScript 5.9
- Ant Design 5 and antd-mobile 5
- Tailwind CSS 4
- TanStack Query 5
- Zustand 5
- Axios
- Socket.IO client
- Vitest and Testing Library

## Requirements

- Node.js `>=20.19.0 || >=22.12.0`
- pnpm `>=9`
- A running `home-admin` backend, normally at `http://localhost:3000`

## Quick Start

```bash
pnpm install
pnpm dev
```

Open:

```text
http://localhost:3001
http://localhost:3001/m
```

Vite proxies `/api` and `/socket.io` to `http://localhost:3000` in development.

## Environment

Create `.env.local` or use the defaults from `.env.example`:

```bash
VITE_API_URL=http://localhost:3000/api/v1
VITE_APP_TITLE=home 管理后台
VITE_FAMILY_MEDIA_UPLOAD_MODE=local
```

For production behind the included nginx image, prefer a same-origin API path:

```bash
VITE_API_URL=/api/v1
VITE_FAMILY_MEDIA_UPLOAD_MODE=oss
```

`VITE_FAMILY_MEDIA_UPLOAD_MODE=oss` enables browser direct upload for family media when the backend
OSS configuration is also enabled. Otherwise the app uses normal backend multipart upload.
OSS CDN/custom domains are configured in `home-admin` with `FILE_OSS_BASE_URL`; the web app keeps
using backend file links and follows backend redirects.

## Useful Commands

```bash
pnpm dev             # Start Vite on port 3001
pnpm build           # Type-check and build both desktop and mobile entries
pnpm preview         # Preview the production build
pnpm lint            # Run ESLint
pnpm format:check    # Check Prettier formatting in src
pnpm test --run      # Run Vitest once
pnpm test:coverage   # Run Vitest with coverage
```

## Project Structure

```text
src/
  app/               Desktop app providers, dynamic routes, component registry
  mobile/            Mobile H5 entry, routes, pages, and mobile styles
  features/
    api-auth/        API apps, keys, scopes, access logs, integration guide
    auth/            Login, profile, password, auth store
    automation/      Cron task configuration and logs
    dashboard/       Admin overview cards and shortcuts
    family/          Family posts, media, chat services, realtime socket
    file/            File list, upload, preview, access links
    insurance/       Family members, policies, attachments, reminders
    notification/    Notification list, bell, hooks, deep links
    rbac/            User, role, menu, permission management
    task/            Task lists, views, forms, attachments, recurrence
  shared/            Layouts, guards, hooks, stores, request utilities, types
  assets/styles/     Global and theme styles
```

## Backend Contract

Home Web is designed to pair with `home-admin`. The frontend service layer is handwritten under
`src/features/**/services` and should be kept aligned with the backend controllers and generated
Swagger/OpenAPI contract after API changes.

Key integration points:

- `VITE_API_URL` points to the backend versioned API, usually `/api/v1`.
- `/menus/user-menus` drives desktop routes and sidebar entries.
- JWT access and refresh tokens are stored through the auth store.
- `/socket.io` is required for family realtime updates.
- File URLs may be public URLs, backend access links, or OSS redirects depending on backend storage.

## Docker

The Docker image builds both SPA entries and serves them with nginx. Runtime nginx proxies `/api`
and `/socket.io` to the backend via `API_UPSTREAM`.

```bash
pnpm docker:build
pnpm docker:run
```

Or run the full stack from the workspace root with Docker Compose.

## Testing

This project uses Vitest and Testing Library for unit and component tests. E2E/Playwright is not part
of the current setup.

```bash
pnpm test --run
pnpm lint
pnpm build
```

## Why Use It

Home Web is useful if you want a real self-hosted admin UI that already covers the everyday private
workflows many generic admin templates leave blank: family tasks, recurring reminders, insurance
records, shared media, notifications, API key access, and operational RBAC. It is small enough to
read, but complete enough to run.
