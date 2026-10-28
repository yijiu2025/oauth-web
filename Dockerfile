# oauth-web 前端多阶段构建镜像
#
# 构建期注入的 VITE_* 变量（--build-arg）会被 Vite 编译进静态产物，
# 运行期改环境变量无效。敏感值（如 VITE_SIGN_APP_KEY）经 build-arg 传入，
# 不要写死在 Dockerfile 里。
#
# 用法见 docs/engineering/deployment.md「方式 D / D.1」。

# ---------- 阶段 1：构建前端 ----------
FROM node:22-slim AS build
WORKDIR /app

# 先装依赖（利用 layer 缓存，源码不变时不必重装）
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund

# 再拷源码并构建
COPY . .

# 🔴 构建期变量：通过 docker build --build-arg 传入，默认空 = 与前端同源
ARG VITE_API_BASE_URL=""
ARG VITE_ALLOWED_PARENT_ORIGINS=""
ARG VITE_SIGN_APP_KEY=""
ARG VITE_SOCIAL_ENDPOINT=""
ARG VITE_SOCIAL_PROVIDERS=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_ALLOWED_PARENT_ORIGINS=$VITE_ALLOWED_PARENT_ORIGINS \
    VITE_SIGN_APP_KEY=$VITE_SIGN_APP_KEY \
    VITE_SOCIAL_ENDPOINT=$VITE_SOCIAL_ENDPOINT \
    VITE_SOCIAL_PROVIDERS=$VITE_SOCIAL_PROVIDERS

RUN npm run build

# ---------- 阶段 2：nginx 托管静态产物 ----------
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
