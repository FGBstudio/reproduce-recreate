import os
import json
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

def audit_leed_telemetry():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Missing credentials")
        return

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # 1. Find some LEED devices
    res = supabase.table("devices").select("id, device_id, name, model").ilike("model", "%IAQ%").limit(10).execute()
    devices = res.data or []
    
    if not devices:
        print("No LEED-like devices found")
        return

    print(f"Auditing {len(devices)} devices...")
    
    for dev in devices:
        dev_id = dev["id"]
        # Query latest O3 for this device
        res_t = supabase.table("telemetry").select("metric, value, ts").eq("device_id", dev_id).eq("metric", "iaq.o3").order("ts", desc=True).limit(5).execute()
        points = res_t.data or []
        
        if points:
            print(f"\nDevice: {dev['name']} ({dev['device_id']}) Model: {dev['model']}")
            print(f"  Found O3 records: {len(points)}")
            for p in points:
                print(f"    {p['ts']}: {p['value']}")
        else:
            # print(f"  Device {dev['device_id']} has NO O3")
            pass

if __name__ == "__main__":
    audit_leed_telemetry()
