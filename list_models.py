import google.generativeai as genai
import os
api_key = open('backend/.env', encoding='utf-8').read().split('GEMINI_API_KEY=')[1].split('\n')[0].strip('"')
genai.configure(api_key=api_key)
for m in genai.list_models():
    if 'generateContent' in m.supported_generation_methods:
        print(m.name)
