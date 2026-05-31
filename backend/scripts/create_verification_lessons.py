import logging
import os
import sys

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add parent directory to path to import backend modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import settings
from models import Lesson

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database connection
DATABASE_URL = f"postgresql://{settings.database_username}:{settings.database_password}@{settings.database_hostname}:{settings.database_port}/{settings.database_name}"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def create_lesson_data(index, activity_type):
    """
    Creates a minimal valid lesson data structure for a given activity type.
    """
    lesson_code = f"0-0-0-{index}"
    title = f"Test Lesson {index} - {activity_type}"

    # Base content structure
    content_base = {
        "lesson_code": lesson_code,
        "title_es": title,
        "title_en": title,
        "description_es": f"Testing {activity_type}",
        "description_en": f"Testing {activity_type}",
        "duration": 5,
        "age_rate": "0-99",
        "points_reward": 10,
        "adventure_level": 0,
        "saga_level": 0,
        "topic_level": 0,
        "lesson_number": index,
        "content_es": [],
        "content_en": []
    }

    # Generate specific activity content based on type
    activity_content = generate_activity_content(activity_type)

    # Construct the full lesson content
    # We add an intro narrative -> the activity -> potentially a completion message?
    # For now just the activity to keep it simple and focused on the engine logic.

    # Adding a simple intro to ensure lesson starts correctly usually
    intro = {
        "type": "intro_narrative",
        "character_code": "drrho",
        "content": {
            "transcript": f"Testing activity {activity_type}. Go!"
        }
    }

    content_base["content_es"] = [intro, activity_content]
    content_base["content_en"] = [intro, activity_content]

    return content_base

def generate_activity_content(activity_type):
    """
    Generates the specific JSON content for an activity type.
    """
    base = {"type": activity_type, "character_code": "liruf"}

    if activity_type == "intro_narrative":
        base["content"] = {"transcript": "This is a test narrative."}

    elif activity_type == "multiple_choice":
        base["content"] = {
            "question": "Select option A",
            "instruction": "Select A",
            "options": [
                {"id": "a", "text": "Option A"},
                {"id": "b", "text": "Option B"}
            ]
        }
        base["correct_answer"] = {"correctOptionId": "a"}
        base["feedback"] = {"success": "Good", "error": "Bad"}

    elif activity_type == "drag_drop" or activity_type == "classification":
         # Assuming classification structure based on read file
        base["content"] = {
            "instruction": "Classify items",
            "categories": [
                {"id": "c1", "label": "Cat 1"},
                {"id": "c2", "label": "Cat 2"}
            ],
            "items": [
                {"id": "i1", "text": "Item 1", "category": "c1"},
                {"id": "i2", "text": "Item 2", "category": "c2"}
            ]
        }
        base["correct_answer"] = {
            "classifications": {"i1": "c1", "i2": "c2"}
        }
        base["feedback"] = {"success": "Good", "error": "Bad"}

    elif activity_type == "match_pairs" or activity_type == "matching_pairs":
        base["type"] = "matching_pairs" # Normalize name if needed
        base["content"] = {
            "instruction": "Match pairs",
            "pairs": [
                {"id": "p1", "left": "L1", "right": "R1"},
                {"id": "p2", "left": "L2", "right": "R2"}
            ]
        }

    elif activity_type == "fill_blank":
        base["content"] = {
            "instruction": "Fill the blank",
            "segments": [
                {"type": "text", "text": "Hello "},
                {"type": "blank", "id": "b1"}
            ],
            "options": [
                {"id": "world", "text": "world"},
                {"id": "mars", "text": "mars"}
            ]
        }
        base["correct_answer"] = {
            "blank_ids": {"b1": "world"}
        }
        base["feedback"] = {"success": "Good", "error": "Bad"}

    elif activity_type == "shop_simulation" or activity_type == "shop_sim":
        base["type"] = "shop_sim"
        base["content"] = {
            "instruction": "Buy items under budget",
            "budget": 100,
            "products": [
                {"id": "p1", "name": "Item 1", "price": 50},
                {"id": "p2", "name": "Item 2", "price": 60}
            ]
        }
        # Implicitly correct if keeping under budget and buying something

    elif activity_type == "coin_counter":
        base["content"] = {
            "instruction": "Make 15",
            "targetAmount": 15,
            "coins_available": [
                {"value": 1}, {"value": 5}, {"value": 10}
            ]
        }

    elif activity_type == "estimation_slider":
        base["content"] = {
            "instruction": "Estimate 50",
            "min": 0,
            "max": 100,
            "step": 1,
            "unit": "%"
        }
        base["correct_answer"] = {"correctValue": 50, "tolerance": 5}

    elif activity_type == "true_false":
        base["content"] = {
            "statement": "Is this true?",
            "instruction": "True or False"
        }
        base["correct_answer"] = {"isTrue": True}
        base["feedback"] = {"success": "Good", "error": "Bad"}

    elif activity_type == "sequencing":
        base["content"] = {
            "instruction": "Order 1, 2, 3",
            "items": [
                {"id": "1", "text": "1"}, # Component uses 'text', used 'content' before? Snippet says item.text
                {"id": "2", "text": "2"},
                {"id": "3", "text": "3"}
            ]
        }
        base["correct_answer"] = {"sequence": ["1", "2", "3"]}

    elif activity_type == "math_challenge":
        base["content"] = {
            "question": "2 + 2 = ?",
            "instruction": "Calculate",
            "keypadType": "numeric"
        }
        base["correct_answer"] = {"correctValue": 4}
        base["feedback"] = {"success": "Good", "error": "Bad"}

    elif activity_type == "word_scramble":
        base["content"] = {
            "instruction": "Unscramble TEST",
            "word": "TEST",
            "hint": "Exam"
        }

    elif activity_type == "risk_reward":
        base["content"] = {
            "question": "Scenario description",
            "risk_options": [
                {"id": "safe", "text": "Safe option", "type": "safe", "reward": "Low reward"},
                {"id": "risky", "text": "Risky option", "type": "risk", "reward": "High reward"}
            ]
        }
        base["correct_answer"] = {"correctOptionId": "safe"}

    elif activity_type == "concept_builder":
        base["content"] = {
            "question": "Concept Name",
            "concepts": [
                {"id": "p1", "label": "Part 1", "type": "block"},
                {"id": "p2", "label": "Part 2", "type": "block"}
            ]
        }
        base["correct_answer"] = {"sequence": ["p1", "p2"]}
        # Often informational or simple interaction

    elif activity_type == "roleplay_chat":
        base["content"] = {
            "context": "Chat scenario",
            "dialogue": [
                {"id": "Msg1", "sender": "npc", "text": "Hello", "name": "Bot"}
            ],
            "choices": [
                {"id": "opt1", "text": "Hi back"}
            ]
        }
        base["correct_answer"] = {"correctOptionId": "opt1"}

    elif activity_type == "story_mode":
        base["content"] = {
            "pages": [
                {
                    "id": "p1",
                    "text": "Start of story",
                    "choices": [{"id": "c1", "text": "Continue", "next_page": "end"}]
                },
                {
                    "id": "end",
                    "text": "The end",
                    "choices": []
                }
            ]
        }

    elif activity_type == "price_detective":
         base["content"] = {
            "instruction": "Which is cheaper?",
            "items": [
                {"id": "i1", "price": 10, "name": "Cheap"},
                {"id": "i2", "price": 20, "name": "Expensive"}
            ]
         }
         base["correct_answer"] = {"correctOptionId": "i1"}

    elif activity_type == "spot_trap" or activity_type == "spot_the_trap":
        base["type"] = "spot_trap"
        base["content"] = {
            "instruction": "Find the scam",
            "scenarios": [
                {"id": "s1", "text": "Legit offer", "isTrap": False},
                {"id": "s2", "text": "Scam offer", "isTrap": True}
            ]
        }
        base["correct_answer"] = {"trapId": "s2"}

    elif activity_type == "impact_meter":
        base["content"] = {
             "instruction": "Make a choice",
             "options": [
                 {"id": "o1", "text": "Option 1", "impact": 50}
             ]
        }

    elif activity_type == "market_reaction":
        base["content"] = {
            "news": "Market is up",
            "options": [
                {"id": "buy", "text": "Buy"},
                {"id": "sell", "text": "Sell"}
            ]
        }
        base["correct_answer"] = {"bestAction": "buy"}

    elif activity_type == "mystery_investment":
        base["content"] = {
            "assets": [
                {"id": "a1", "name": "Mystery A", "return": 10},
                {"id": "a2", "name": "Mystery B", "return": -5}
            ]
        }
        base["correct_answer"] = {"bestAsset": "a1"}

    elif activity_type == "budget_builder":
        base["content"] = {
            "instruction": "Allocate budget",
            "totalIncome": 100,
            "categories": [
                {"id": "c1", "name": "Cat 1", "suggestedPercent": 50},
                {"id": "c2", "name": "Cat 2", "suggestedPercent": 50}
            ]
        }
        base["correct_answer"] = {
            "allocation": {"c1": "50", "c2": "50"}
        }

    elif activity_type == "bill_splitter":
        base["content"] = {
            "total": 100,
            "people": 2,
            "instruction": "Split the bill"
        }
        # Simulation

    elif activity_type == "credit_score_builder" or activity_type == "credit_score":
        base["type"] = "credit_score" # Normalize
        base["content"] = {
            "instruction": "Improve score",
            "initialScore": 600,
            "scenarios": [
                {
                    "text": "Scenario 1",
                    "options": [
                        {"id": "good", "text": "Good", "scoreChange": 50},
                        {"id": "bad", "text": "Bad", "scoreChange": -50}
                    ]
                }
            ]
        }
        base["correct_answer"] = {"minScore": 640}

    elif activity_type == "debt_strategy":
        base["content"] = {
            "debts": [
                {"id": "d1", "amount": 100, "rate": 20},
                {"id": "d2", "amount": 100, "rate": 10}
            ],
            "budget": 50
        }

    elif activity_type == "emergency_fund":
        base["content"] = {
             "initialFund": 1000,
             "events": [
                 {
                     "text": "Emergency!",
                     "options": [
                         {"id": "pay", "text": "Pay", "cost": 500},
                         {"id": "ignore", "text": "Ignore", "cost": 0}
                     ]
                 }
             ]
        }

    elif activity_type == "expense_timeline" or activity_type == "timeline":
         base["type"] = "expense_timeline"
         base["content"] = {
             "events": [
                 {"id": "e1", "text": "Event 1"},
                 {"id": "e2", "text": "Event 2"}
             ]
         }
         base["correct_answer"] = {"order": ["e1", "e2"]}

    elif activity_type == "goal_roadmap":
        base["content"] = {
            "goals": [
                {"id": "g1", "text": "Goal 1", "cost": 100}
            ]
        }

    elif activity_type == "inflation_simulator":
        base["content"] = {
            "years": 5,
            "inflation": 3
        }

    elif activity_type == "interest_calculator":
        base["content"] = {
            "principal": 100,
            "rate": 5
        }

    elif activity_type == "mindset_comparison":
         base["content"] = {
             "scenarios": [
                 {"text": "Situation"}
             ]
         }

    elif activity_type == "opportunity_cost":
        base["content"] = {
            "choices": [
                {"id": "c1", "text": "Choice 1", "value": 10},
                {"id": "c2", "text": "Choice 2", "value": 5}
            ]
        }

    elif activity_type == "passive_income":
        base["content"] = {
            "targetIncome": 10,
            "streams": [
                {"id": "s1", "name": "Stream 1", "monthlyIncome": 10},
                {"id": "s2", "name": "Stream 2", "monthlyIncome": 1}
            ]
        }

    elif activity_type == "portfolio_builder":
        base["content"] = {
            "assets": [
                {"id": "stocks", "name": "Stocks"},
                {"id": "bonds", "name": "Bonds"}
            ]
        }

    elif activity_type == "quiz_battle":
        base["content"] = {
            "questions": [
                {"text": "Q1", "options": [{"id": "a", "text": "A"}], "correct": "a"}
            ]
        }
        base["correct_answer"] = {"minScore": 0}

    elif activity_type == "salary_comparison":
        base["content"] = {
            "offers": [
                {"id": "o1", "salary": 100},
                {"id": "o2", "salary": 200}
            ]
        }
        base["correct_answer"] = {"bestOffer": "o2"}

    elif activity_type == "savings_race":
        base["content"] = {
             "goal": 100,
             "turn_limit": 10
        }

    elif activity_type == "subscription_tracker":
        base["content"] = {
            "subscriptions": [
                {"id": "s1", "cost": 10}
            ]
        }

    elif activity_type == "tax_puzzle":
        base["content"] = {
            "income": 100,
            "brackets": []
        }

    elif activity_type == "tap_action":
        base["content"] = {
            "statement": "Tap true",
            "instruction": "Tap",
            "items": [
                {"id": "i1", "text": "True", "isTarget": True},
                {"id": "i2", "text": "False", "isTarget": False}
            ]
        }

    # Fallback/Default
    else:
         base["content"] = {"text": f"Placeholder for {activity_type}"}

    return base


def run():
    session = SessionLocal()

    # List of all activity types from manifest (normalized)
    activity_types = [
        "intro_narrative", "tap_action", "matching_pairs", "fill_blank",
        "multiple_choice", "classification", "true_false", "sequencing",
        "math_challenge", "word_scramble", "estimation_slider", "risk_reward",
        "concept_builder", "roleplay_chat", "story_mode", "coin_counter",
        "shop_sim", "price_detective", "spot_trap", "impact_meter",
        "market_reaction", "mystery_investment", "budget_builder",
        "bill_splitter", "credit_score_builder", "debt_strategy",
        "emergency_fund", "expense_timeline", "goal_roadmap",
        "inflation_simulator", "interest_calculator", "mindset_comparison",
        "opportunity_cost", "passive_income", "portfolio_builder",
        "quiz_battle", "salary_comparison", "savings_race",
        "subscription_tracker", "tax_puzzle"
    ]

    try:
        for i, activity_type in enumerate(activity_types, 1):
            lesson_data = create_lesson_data(i, activity_type)

            # Check if exists, update or create
            existing = session.query(Lesson).filter(Lesson.lesson_code == lesson_data["lesson_code"]).first()
            if existing:
                logger.info(f"Updating lesson {lesson_data['lesson_code']}")
                for key, value in lesson_data.items():
                    setattr(existing, key, value)
            else:
                logger.info(f"Creating lesson {lesson_data['lesson_code']}")
                lesson = Lesson(**lesson_data)
                session.add(lesson)

        session.commit()
        logger.info("Successfully created/updated all verification lessons.")

    except Exception as e:
        session.rollback()
        logger.error(f"Error creating lessons: {e}")
        raise
    finally:
        session.close()

if __name__ == "__main__":
    run()
