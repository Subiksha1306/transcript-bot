import requests
import os

# Sample transcript for Day 1
transcript_day1 = """
PM: Let's start the standup. Haran, what's your update?
Haran: Yesterday I finished the API integration testing. Today I will work on the deployment automation. No blockers right now.
PM: Thanks. Sarah, how about you?
Sarah: I completed the database schema design. I'm currently working on the user authentication module. I'm blocked because I don't have the Azure credentials yet.
"""

# Sample transcript for Day 2
transcript_day2 = """
PM: Welcome to the standup. Haran, let's start with you.
Haran: I am still working on the deployment automation, it's taking a bit longer than expected. I plan to finish it today and start on production configuration. I am also blocked waiting for client access.
PM: Okay, Sarah?
Sarah: I got the credentials, so I finished the user authentication module. Today I will start working on the payment gateway integration.
"""

def test_api():
    url = "http://127.0.0.1:8000/process_transcript"
    
    print("Sending Day 1 Transcript...")
    response1 = requests.post(url, json={"team_name": "Backend Team", "transcript_text": transcript_day1})
    if response1.status_code == 200:
        print("\n--- Day 1 Summary ---\n")
        print(response1.json()["summary_markdown"])
    else:
        print(f"Error: {response1.text}")
        return

    print("\n" + "="*50 + "\n")

    print("Sending Day 2 Transcript...")
    response2 = requests.post(url, json={"team_name": "Backend Team", "transcript_text": transcript_day2})
    if response2.status_code == 200:
        print("\n--- Day 2 Summary ---\n")
        print(response2.json()["summary_markdown"])
    else:
        print(f"Error: {response2.text}")

if __name__ == "__main__":
    if not os.getenv("GEMINI_API_KEY"):
        print("Please set GEMINI_API_KEY environment variable before running the test.")
    else:
        test_api()
