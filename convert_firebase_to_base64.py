import json
import base64

# Read the Firebase service account JSON file
with open('kampos-65ce9-firebase-adminsdk-fbsvc-d50fc9f4b5.json', 'r') as file:
    json_content = file.read()

# Convert to base64
base64_encoded = base64.b64encode(json_content.encode('utf-8')).decode('utf-8')

print("Add this to your .env file as FIREBASE_CREDENTIALS_BASE64:")
print(base64_encoded)