import re

with open('frontend/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r'<div style="font-size: 40px;">.*?</div>', '', content)

with open('frontend/index.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("Fire icon removed")
