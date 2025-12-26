import os
import json
from pathlib import Path
from threading import Lock
from dotenv import load_dotenv
from datetime import datetime, timezone
from fastapi import FastAPI, Request, HTTPException

load_dotenv()

PAXOS_API_KEY = os.getenv("PAXOS_API_KEY")

app = FastAPI()

paxos_events_file_lock = Lock()
paxos_events_file_path = Path("./live-events/live_paxos_events.json")

def log_paxos_event_to_file(event_data: dict):
    with paxos_events_file_lock:
        events = []
        if paxos_events_file_path.exists():
            try:
                with open(paxos_events_file_path, "r") as f:
                    events = json.load(f)
            except json.JSONDecodeError:
                events = []
        events.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "event": event_data
        })
        with open(paxos_events_file_path, "w") as f:
            json.dump(events, f, indent=2)

@app.get("/health")
async def health_check():
    return {"status": "online"}

@app.post("/")
async def paxos_webhook(request: Request):
    print(f"\n🌐 Client IP: {request.client.host}") # type: ignore
    api_key = request.headers.get("X-API-Key")
    if not api_key or api_key != PAXOS_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
    print("📋 Incoming Paxos webhook verified ✅")

    try:
        raw_body = await request.body()
        payload = json.loads(raw_body.decode())

        if payload.get('is_test'):
            print("Received test event, ignoring...")
            return {"status": "ok"}

        log_paxos_event_to_file(payload)
        print(f"✅ Event logged to {paxos_events_file_path}")

        event_type = payload.get('type')

        # Unmarshal the event data into an appropriate struct depending on its Type
        if event_type == 'identity.documents_required':
            print(f"received documents required event: {payload}, processing...")
            # process documents required event
        else:
            print(f"received unknown event type: {event_type}")

        return {"status": "ok"}

    except json.JSONDecodeError as e:
        print(f"error parsing webhook event: {e}")
        raise HTTPException(status_code=400, detail="Invalid JSON")
    except Exception as e:
        print(f"error reading request body: {e}")
        raise HTTPException(status_code=503, detail="Service error")

# uvicorn app:app --host 0.0.0.0 --port 8080 --reload