import google.generativeai as genai
import os
import json
api_key = open('backend/.env', encoding='utf-8').read().split('GEMINI_API_KEY=')[1].split('\n')[0].strip('"')
genai.configure(api_key=api_key)
model = genai.GenerativeModel('models/gemini-1.5-flash')
try:
    with open('C:/Users/saura/.gemini/antigravity/brain/37a860ad-573b-43cc-a9c2-8fecc9ea6f48/media__1783347264076.jpg', 'rb') as f:
        img_data = f.read()
    print('Calling API...')
    res = model.generate_content([{'mime_type': 'application/octet-stream', 'data': img_data}, 'extract text'])
    print('SUCCESS')
except Exception as e:
    print('ERROR:', type(e).__name__, str(e))
