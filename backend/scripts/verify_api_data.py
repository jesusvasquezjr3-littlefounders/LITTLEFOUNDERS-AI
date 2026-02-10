import requests
import json
import sys

BASE_URL = "http://localhost:8000/lesson-engine/lessons"

def check_lesson(code, check_fn):
    url = f"{BASE_URL}/{code}/play"
    try:
        response = requests.get(url)
        if response.status_code != 200:
            print(f"FAIL {code}: Status {response.status_code}")
            return False
        
        data = response.json()
        timeline = data.get("timeline", [])
        if len(timeline) < 2:
            print(f"FAIL {code}: Timeline too short")
            return False
            
        activity = timeline[1] # Index 1 is the activity
        
        if check_fn(activity):
            print(f"PASS {code}")
            return True
        else:
            print(f"FAIL {code}: Logic check failed. Data: {json.dumps(activity, indent=2)}")
            return False
            
    except Exception as e:
        print(f"FAIL {code}: Exception {e}")
        return False

def check_fill_blank(activity):
    # Expect blank_ids in correct_answer
    if "correct_answer" not in activity: return False
    return "blank_ids" in activity["correct_answer"]

def check_sequencing(activity):
    # Expect sequence in correct_answer
    if "correct_answer" not in activity: return False
    return "sequence" in activity["correct_answer"]

def check_math(activity):
    # Expect correctValue: 4
    if "correct_answer" not in activity: return False
    return activity["correct_answer"].get("correctValue") == 4

def check_estimation(activity):
    # Expect correctValue: 50, tolerance: 5
    if "correct_answer" not in activity: return False
    ca = activity["correct_answer"]
    return ca.get("correctValue") == 50 and ca.get("tolerance") == 5

def check_risk(activity):
    # Expect risk_options in content
    if "content" not in activity: return False
    return "risk_options" in activity["content"]

def check_concept(activity):
    # Expect concepts in content
    if "content" not in activity: return False
    return "concepts" in activity["content"]

def check_roleplay(activity):
    # Expect dialogue in content
    if "content" not in activity: return False
    return "dialogue" in activity["content"]

def check_story(activity):
    # Expect pages in content
    if "content" not in activity: return False
    return "pages" in activity["content"]

def run():
    results = []
    results.append(check_lesson("0-0-0-4", check_fill_blank))
    results.append(check_lesson("0-0-0-8", check_sequencing))
    results.append(check_lesson("0-0-0-9", check_math))
    results.append(check_lesson("0-0-0-11", check_estimation))
    results.append(check_lesson("0-0-0-12", check_risk))
    results.append(check_lesson("0-0-0-13", check_concept))
    results.append(check_lesson("0-0-0-14", check_roleplay))
    results.append(check_lesson("0-0-0-15", check_story))
    
    if all(results):
        print("ALL PASSED")
        sys.exit(0)
    else:
        print("SOME FAILED")
        sys.exit(1)

if __name__ == "__main__":
    run()
