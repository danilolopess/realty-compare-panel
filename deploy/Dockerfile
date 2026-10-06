# syntax=docker/dockerfile:1
# Build só na máquina local. A VPS recebe a imagem pronta (docker save | ssh docker load).

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN --mount=type=secret,id=appenv,required=true \
    node deploy/build-with-env.mjs
RUN ./node_modules/.bin/esbuild server/prod.ts \
    --bundle --platform=node --format=esm --packages=external \
    --outfile=dist-server/server.mjs

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    POSTGREST_URL=http://postgrest:3000
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server/server.mjs ./server.mjs
COPY docker/auth.sql ./docker/auth.sql
USER node
EXPOSE 8080
CMD ["node", "server.mjs"]
