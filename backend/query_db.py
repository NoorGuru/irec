import asyncio
from app.database import _get_client

async def run():
    client = await _get_client()
    res = client.table('user_portfolio').select('*').execute()
    for row in res.data:
        print(f"{row['ticker']}: cost={row['average_cost']}, price={row['current_price']}, shares={row['shares']}, ytd={row['ytd_return_pct']}")

asyncio.run(run())
