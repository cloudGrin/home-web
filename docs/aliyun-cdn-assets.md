# Aliyun CDN Assets Setup

This document records the production setup for serving `home-web` JS/CSS assets through the
dedicated Aliyun CDN domain `assets.grin.cool`.

## Target Topology

```text
HTML, API, WebSocket, service worker:
https://q.210313.cn:8088

Generated JS/CSS assets:
https://assets.grin.cool/assets/home/<hashed-file>

Private family media and attachments:
https://static.grin.cool/<oss-object-path>?OSSAccessKeyId=...&Signature=...
```

`assets.grin.cool` is only for public frontend build artifacts. Do not store private media in this
public-read OSS bucket.

## Aliyun OSS

1. Create or use a public-read OSS bucket dedicated to frontend static assets.
2. Configure OSS mirroring/back-to-origin for the `assets/home/` prefix:

   ```text
   Requested object:
   /assets/home/<hashed-file>

   Origin URL:
   https://q.210313.cn:8088/assets/<hashed-file>
   ```

3. Keep the bucket public-read because browser JS/CSS requests are unsigned.
4. Keep the existing private OSS bucket and `static.grin.cool` setup unchanged for file/media
   access signed by the backend.

## Aliyun CDN

1. Add `assets.grin.cool` as an Aliyun CDN accelerated domain.
2. Use the public-read assets OSS bucket as the CDN origin.
3. Configure cache for frontend build artifacts:

   ```text
   Path: /assets/home/*
   TTL: 1 year
   Cache-Control: public, max-age=31536000, immutable
   ```

4. Add an HTTP response header for module script and stylesheet loading:

   ```text
   Access-Control-Allow-Origin: *
   ```

5. It is safe for `/assets/home/*` to ignore query strings because Vite build artifacts are
   versioned by hashed filenames.

Do not point `assets.grin.cool` at the private media OSS bucket. That bucket requires signed query
parameters and is already exposed through `static.grin.cool`.

## Frontend Build

Build `home-web` with:

```sh
VITE_ASSET_BASE_URL=https://assets.grin.cool/assets/home/ pnpm build
```

For Docker builds, pass the same value as a build argument:

```sh
docker build \
  --build-arg VITE_API_URL=/api/v1 \
  --build-arg VITE_FAMILY_MEDIA_UPLOAD_MODE=oss \
  --build-arg VITE_INSURANCE_ATTACHMENT_UPLOAD_MODE=oss \
  --build-arg VITE_ASSET_BASE_URL=https://assets.grin.cool/assets/home/ \
  -t home-web .
```

The built files remain under `dist/assets/` in the web image. The browser-facing URLs are rewritten
to `https://assets.grin.cool/assets/home/<hashed-file>`, matching the OSS mirror origin rule above.

## Verification

After deploying a new web image, pick a real file from `dist/assets/` and verify CDN access:

```sh
curl -I https://assets.grin.cool/assets/home/Pagination-CCWNLvag.js
```

Expected headers:

```text
HTTP/2 200
access-control-allow-origin: *
cache-control: public, max-age=31536000, immutable
```

Browser checks:

- `index.html` and `/m/index.html` load from `q.210313.cn`.
- JS/CSS/modulepreload requests load from `assets.grin.cool/assets/home/`.
- `/mobile-sw.js` still loads from `q.210313.cn` and remains `Cache-Control: no-cache`.
- Family media still goes through `/api/v1/files/:id/access` and redirects to `static.grin.cool`.
- DevTools Console has no CORS, module script, stylesheet, or service worker install errors.
