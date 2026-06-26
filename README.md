# ShopSathi AI: The AI "Digitization System"

**Team - Saloni0908 & SaurabhRaj-110**

ShopSathi AI is a voice and vision-first Progressive Web App (PWA) designed to eliminate manual data entry for Kirana store owners in Tier-2/3 cities. By leveraging lightning-fast **Groq LPUs** (Llama 3) and **Google Gemini API**, ShopSathi converts Hinglish voice commands and photos of handwritten notebooks directly into a structured digital ledger.

## The Problem & The Pivot

**The Baseline:** The average Kirana merchant spends 60–90 minutes daily manually calculating handwritten udhaar (credit) entries, matching stock, and sending payment reminders. This causes revenue leakage and stockouts.

**The Pivot:** Our initial hypothesis was to build a WhatsApp chatbot ("familiarity equals adoption"). However, ethnographic observation showed that conversational UIs introduce too much friction during high-speed, repetitive transactions. We pivoted to a Local-First PWA, combining the speed of a native interface with AI to reduce data-entry activation energy to near zero.

## Core Features (V1)

- **Voice Munim (Powered by Groq LPUs):** Natural Hinglish voice commands. The merchant taps the mic and says "Suresh ka 500 udhaar likh do" or "Maggi packets add karo". Using Llama-3.3-70B on Groq, the AI identifies the intent and updates customer balances or inventory **instantly**, bypassing traditional API bottlenecks.
- **KhataSnap AI (Powered by Gemini Vision):** Merchants take a photo of their daily handwritten ledger. The system parses customer names, items, quantities, and total amounts, digitizing bulk offline entries in seconds.
- **Dynamic Daily Log:** An interactive, filterable ledger that tracks "Aaj ki Sales" (Today's Sales), Udhaar, and Purchase records. Allows users to switch dates seamlessly while preserving live real-time sync for current transactions.
- **Instant-Boot & Optimistic UI:** Engineered to combat spotty Jio/Airtel 4G networks in Uttar Pradesh. The app loads instantly from local storage, visually registers transactions immediately, and secretly syncs to the backend via background etch() calls.
- **Smart Reminders:** 1-click, auto-filled WhatsApp payment reminders tied directly to the customer's real-time credit balance.

## Tech Stack & Architecture

- **Frontend:** HTML5, CSS3 (Flexbox/CSS Grid native mobile styling), Vanilla JavaScript. Hosted on **Netlify** to bypass Indian ISP blocks on standard Vercel domains.
- **Backend:** Python, FastAPI, Uvicorn REST API. Hosted on **Render**.
- **AI Engine (Voice):** Groq API (llama-3.3-70b-versatile) for ultra-low latency intent extraction and NLP.
- **AI Engine (Vision):** Google Gemini API (models/gemini-2.0-flash) for image OCR and document parsing.
- **Data Strategy:** LocalStorage cache as the primary fast-read layer -> Background API Sync -> Cloud SQLite Database.

## OkCredit Finternship Deliverables Tracker

**Phase 1 & 2: Explore & Lock-In (Weeks 1-3)**
Identified core merchant friction: 1-2 hours lost daily to manual ledger math. Formulated testable hypothesis: Zero-touch AI input will reduce logging time to <5s per transaction. Pivoted from WhatsApp Bot to PWA for faster UI interactions.

**Phase 2: Build & POC Demo (Week 4)**
Deployed Python FastAPI backend to Render. Deployed Frontend UI to Netlify. Successfully integrated AI for Voice Intent parsing and Image OCR. Built resilient CSS architecture to prevent mobile-browser WebView collapse.

**Phase 3: V1 in Merchant's Hands & Optimization (Week 5)**
Conducted live field testing in Kanpur. Gathered initial feedback. Migrated the core NLP engine from Gemini to Groq (Llama 3 70B) to solve rate-limiting issues and achieve instant voice response times. Shipped UI improvements for dynamic date filtering and resilient offline fallback.

---

## Local Setup & Installation

If you want to run this project locally on your machine:

### 1. Backend (FastAPI)

`ash
# Clone the repository
git clone https://github.com/SaurabhRaj-110/Ok-Credit.git
cd Ok-Credit/backend

# Create virtual environment & install dependencies
python -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate
pip install -r requirements.txt

# Create an .env file and add your API Keys
echo "GEMINI_API_KEY=your_gemini_key_here" > .env
echo "GROQ_API_KEY=your_groq_key_here" >> .env

# Run the server
uvicorn app.main:app --reload
`

### 2. Frontend (HTML/JS)
You can serve the rontend/index.html file using any static file server like VS Code's Live Server, or by running python's http module inside the rontend directory:
`ash
cd ../frontend
python -m http.server 5500
`
Then visit http://localhost:5500 in your browser. (Note: Make sure the RENDER_API_URL variable in index.html is pointing to http://localhost:8000 for local testing).