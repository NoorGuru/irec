import os
from dotenv import load_dotenv
load_dotenv('.env')

from supabase import create_client
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
client = create_client(url, key)

res = client.table('user_portfolio').select('*').execute()
for row in res.data:
    print(f"{row['ticker']}: cost={row['average_cost']}, price={row['current_price']}, shares={row['shares']}, total_return_pct={row['total_return_pct']}")
