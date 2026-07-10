import requests

url = "http://127.0.0.1:8000/api/snap/process"
files = {'file': open('C:/Users/saura/.gemini/antigravity/brain/37a860ad-573b-43cc-a9c2-8fecc9ea6f48/media__1783680419560.png', 'rb')}
data = {'merchant_id': 'test_merchant'}

try:
    response = requests.post(url, files=files, data=data)
    print(response.status_code)
    print(response.json())
except Exception as e:
    print(e)
