FROM node:20-slim

WORKDIR /app

COPY package.json /app/package.json
RUN npm install --production

COPY server /app/server
COPY public /app/public

ENV PORT=10000
ENV NODE_ENV=production

EXPOSE 10000

CMD ["node", "server/index.js"]
