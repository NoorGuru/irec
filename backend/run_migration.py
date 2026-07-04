import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def main():
    conn = await asyncpg.connect(
        host=os.getenv('SUPABASE_DB_HOST'),
        user='postgres',
        password=os.getenv('SUPABASE_DB_PASSWORD'),
        database='postgres',
        port=5432
    )
    with open('migrations/016_add_advanced_analytics.sql', 'r') as f:
        sql = f.read()
    await conn.execute(sql)
    await conn.close()
    print("Migration successful")

asyncio.run(main())
