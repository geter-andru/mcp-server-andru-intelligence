FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src/ ./src/
COPY LICENSE README.md ./

ENTRYPOINT ["node", "src/index.js"]
