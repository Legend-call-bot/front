const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const globalForPrisma = global;

function createPrismaClient() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
        throw new Error("DATABASE_URL이 설정되어 있지 않습니다.");
    }

    const pool = new Pool({
        connectionString: databaseUrl,
    });

    const adapter = new PrismaPg(pool);

    return new PrismaClient({
        adapter,
    });
}

const prisma = globalForPrisma.__prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.__prisma = prisma;
}

module.exports = prisma;
