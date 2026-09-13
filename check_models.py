import requests

API_KEY = "AIzaSyDMMTvV7Oao2njv_MuTSRmgt_gH0e7Wic4"
r = requests.get(f"https://generativelanguage.googleapis.com/v1/models?key={API_KEY}")
data = r.json()

print("=== Models that support generateContent ===")
for m in data.get('models', []):
    if 'generateContent' in m.get('supportedGenerationMethods', []):
        print(m['name'])
