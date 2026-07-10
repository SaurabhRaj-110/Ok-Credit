import google.generativeai as genai
import os
import glob
import json

api_key = open('backend/.env', encoding='utf-8').read().split('GEMINI_API_KEY=')[1].split('\n')[0].strip('"')
genai.configure(api_key=api_key)
model = genai.GenerativeModel('models/gemini-2.5-flash')

files = glob.glob('C:/Users/saura/.gemini/antigravity/brain/37a860ad-573b-43cc-a9c2-8fecc9ea6f48/*.jpg') + glob.glob('C:/Users/saura/.gemini/antigravity/brain/37a860ad-573b-43cc-a9c2-8fecc9ea6f48/*.png')
# sort by time modified
files.sort(key=os.path.getmtime, reverse=True)

for fpath in files[:5]:
    try:
        with open(fpath, 'rb') as f:
            img_data = f.read()
        res = model.generate_content([{'mime_type': 'image/jpeg' if fpath.endswith('.jpg') else 'image/png', 'data': img_data}, 'Describe what is in this image briefly in 1 sentence.'])
        print(fpath)
        print(res.text.strip())
        print('-'*20)
    except Exception as e:
        print('Error on', fpath, e)
