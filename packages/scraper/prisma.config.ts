import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://fbstore:fbstore@localhost:5432/fbstore',
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL ?? 'postgresql://fbstore:fbstore@localhost:5432/fbstore_shadow',
  },
})
