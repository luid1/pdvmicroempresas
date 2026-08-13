# Backend HETROS (NestJS + Prisma) — deploy em Render/Railway/Fly
FROM node:20-bookworm-slim

WORKDIR /app

# Prisma precisa do openssl
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Dependências (usa o lockfile)
COPY package*.json ./
RUN npm ci

# Código + geração do client + build
COPY . .
RUN npx prisma generate && npm run build

EXPOSE 3002

# Ao subir: aplica migrations versionadas no banco gerenciado e inicia.
# 1ª subida sobre um banco pré-existente (criado por db push): rode uma vez
#   `npx prisma migrate resolve --applied 20260708000000_baseline` para baselinar.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main"]
