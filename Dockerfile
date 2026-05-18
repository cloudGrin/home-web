FROM node:22.20-alpine AS build

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.3.0 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
ARG VITE_API_URL=/api/v1
ARG VITE_APP_TITLE
ARG VITE_FAMILY_MEDIA_UPLOAD_MODE=local
ARG VITE_INSURANCE_ATTACHMENT_UPLOAD_MODE
ARG VITE_ASSET_BASE_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_APP_TITLE=$VITE_APP_TITLE
ENV VITE_FAMILY_MEDIA_UPLOAD_MODE=$VITE_FAMILY_MEDIA_UPLOAD_MODE
ENV VITE_INSURANCE_ATTACHMENT_UPLOAD_MODE=$VITE_INSURANCE_ATTACHMENT_UPLOAD_MODE
ENV VITE_ASSET_BASE_URL=$VITE_ASSET_BASE_URL
RUN pnpm run build

FROM nginx:1.27-alpine

ENV API_UPSTREAM=http://host.docker.internal:3000
ENV NGINX_ENVSUBST_FILTER="^API_UPSTREAM$"

COPY deploy/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
