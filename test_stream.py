import asyncio
import httpx
import json

async def main():
    async with httpx.AsyncClient(timeout=60.0) as client:
        # Assuming we need to authenticate to test properly, or we can just see if it rejects with 401
        response = await client.post("http://localhost:8000/api/v1/extract/stream", json={"youtube_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"})
        print(f"Status: {response.status_code}")
        async for chunk in response.aiter_text():
            print("Chunk:", chunk)

asyncio.run(main())
