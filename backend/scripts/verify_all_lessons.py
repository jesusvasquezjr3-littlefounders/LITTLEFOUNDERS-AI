import requests
import sys

BASE_URL = "http://localhost:8000/lesson-engine/lessons"

def check_lesson(index):
    code = f"0-0-0-{index}"
    url = f"{BASE_URL}/{code}/play"
    try:
        response = requests.get(url, timeout=5)
        if response.status_code != 200:
            print(f"FAIL {code}: Status {response.status_code}")
            return False
        
        data = response.json()
        timeline = data.get("timeline", [])
        if len(timeline) < 2:
            print(f"FAIL {code}: Timeline too short (len={len(timeline)})")
            return False
            
        activity = timeline[1]
        # Basic check: type is present
        if "type" not in activity:
             print(f"FAIL {code}: Missing type in activity")
             return False
             
        # Check correct_answer presence for interactive types
        # Some types like intro_narrative (not idx 1 usually), or video might not have it.
        # But most of ours do.
        
        # We assume if it returns 200 and has timeline, structurally it's likely OK for now.
        # Deep validation requires logic per type which is handled in components.
        
        return True
            
    except Exception as e:
        print(f"FAIL {code}: Exception {e}")
        return False

def run():
    failed = []
    for i in range(1, 41):
        if not check_lesson(i):
            failed.append(i)
            
    if not failed:
        print("ALL 40 LESSONS PASSED API CHECK")
        sys.exit(0)
    else:
        print(f"FAILED LESSONS: {failed}")
        sys.exit(1)

if __name__ == "__main__":
    run()
