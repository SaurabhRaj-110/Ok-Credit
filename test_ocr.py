import google.generativeai as genai
import os
genai.configure(api_key=os.environ.get('GEMINI_API_KEY'))
model = genai.GenerativeModel('models/gemini-2.0-flash')
from PIL import Image
img = Image.open('C:/Users/saura/.gemini/antigravity/brain/37a860ad-573b-43cc-a9c2-8fecc9ea6f48/media__1782282577030.jpg')
print(model.generate_content(['extract text', img]).text)
