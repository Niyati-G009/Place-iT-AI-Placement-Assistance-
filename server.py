import os
import re
import json
import io
import requests
from flask import Flask, request, jsonify, render_template, session, Response
from flask_cors import CORS
from supabase import create_client, Client
from werkzeug.utils import secure_filename
from openai import OpenAI

import PyPDF2
import docx

app = Flask(__name__)
app.secret_key = '46d0f03be8976d4e2e0c2bef4c67ba5d'

# --- CONFIGURATION ---
SUPABASE_URL = "https://votcomqtsfmqlxaioyry.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvdGNvbXF0c2ZtcWx4YWlveXJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5OTMxMjAsImV4cCI6MjA4NDU2OTEyMH0.AnjJzyndB2gIhcStmX1_571yJS-B-nYjNRz3L8Qr3_w"
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

OPENROUTER_API_KEY = "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"
OR_CLIENT = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=OPENROUTER_API_KEY,
)
MODEL_NAME = "google/gemini-2.0-flash-001"

ELEVENLABS_API_KEY = 'sk_1face4687533aebeac9229f37584f4b2e689f3ad0d093a57'
ELEVENLABS_VOICE_ID = "EXAVITQu4vr4xnSDxMaL"

CORS(app)

# --- HELPER FUNCTIONS ---

def extract_text_from_file(file):
    file.seek(0)
    filename = secure_filename(file.filename)
    file_ext = os.path.splitext(filename)[1].lower()
    text = ""
    try:
        if file_ext == '.pdf':
            pdf_reader = PyPDF2.PdfReader(file)
            for page in pdf_reader.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
        elif file_ext == '.docx':
            doc = docx.Document(file)
            for para in doc.paragraphs:
                text += para.text + "\n"
        elif file_ext == '.txt':
            text = file.read().decode('utf-8', errors='ignore')
        else:
            return None
        return text.strip()
    except Exception as e:
        print(f"Error reading file: {e}")
        return None

def clean_json_response(raw_text):
    """Strips markdown fences, whitespace, and extracts first JSON object/array."""
    text = raw_text.strip()
    # Remove markdown code fences
    text = re.sub(r'^```[a-zA-Z]*\s*', '', text)
    text = re.sub(r'\s*```$', '', text)
    text = text.strip()
    # Extract first JSON object if there's surrounding text
    match = re.search(r'\{[\s\S]*\}', text)
    if match:
        return match.group(0)
    return text

def get_chat_history_from_db(chat_id, limit=10):
    """Fetch recent messages for a chat from Supabase to maintain context."""
    try:
        response = (
            supabase.table('messages')
            .select("role, content")
            .eq('chat_id', chat_id)
            .order('created_at', desc=True)
            .limit(limit)
            .execute()
        )
        # Reverse so oldest is first
        messages = list(reversed(response.data))
        return [{"role": m["role"] if m["role"] == "user" else "assistant", "content": m["content"]} for m in messages]
    except Exception as e:
        print(f"History fetch error: {e}")
        return []

# --- ROUTES ---

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/get-history', methods=['GET'])
def get_history():
    try:
        response = supabase.table('chats').select("*").order('created_at', desc=True).execute()
        return jsonify(response.data)
    except Exception as e:
        print(f"Get history error: {e}")
        return jsonify([]), 500

@app.route('/get-chat/<chat_id>', methods=['GET'])
def get_chat_messages(chat_id):
    try:
        response = (
            supabase.table('messages')
            .select("*")
            .eq('chat_id', chat_id)
            .order('created_at', desc=False)
            .execute()
        )
        return jsonify(response.data)
    except Exception as e:
        print(f"Get chat error: {e}")
        return jsonify([]), 500

@app.route('/chat', methods=['POST'])
def chat_endpoint():
    try:
        data = request.json
        user_message = data.get('message', '').strip()
        chat_id = data.get('chat_id')
        chat_title = data.get('title', 'New Conversation')

        if not user_message:
            return jsonify({"reply": "Please say something!"})

        # Upsert chat record
        existing_chat = supabase.table('chats').select("id").eq("id", chat_id).execute()
        if not existing_chat.data:
            supabase.table('chats').insert({"id": chat_id, "title": chat_title}).execute()

        # Save user message
        supabase.table('messages').insert({
            "chat_id": chat_id, "role": "user", "content": user_message
        }).execute()

        # Build conversation history for context
        history = get_chat_history_from_db(chat_id, limit=10)
        # Remove the last message since we'll add it ourselves
        if history and history[-1]["content"] == user_message:
            history = history[:-1]

        messages = [
            {
                "role": "system",
                "content": (
                    "You are Place-iT, a professional AI Student Placement Assistant. "
                    "Help students with resume tips, interview preparation, coding practice, "
                    "career guidance, and job search strategies. Keep answers concise, structured, "
                    "and actionable. Use markdown tables and bullet points when helpful."
                )
            },
            *history,
            {"role": "user", "content": user_message}
        ]

        completion = OR_CLIENT.chat.completions.create(
            model=MODEL_NAME,
            messages=messages
        )
        ai_reply = completion.choices[0].message.content

        # Save AI reply
        supabase.table('messages').insert({
            "chat_id": chat_id, "role": "ai", "content": ai_reply
        }).execute()

        return jsonify({"reply": ai_reply})

    except Exception as e:
        print(f"Chat Error: {e}")
        return jsonify({"reply": "I'm having trouble connecting right now. Please try again in a moment."}), 500

@app.route('/voice-chat', methods=['POST'])
def voice_chat_endpoint():
    try:
        data = request.json
        user_message = data.get('message', '').strip()
        if not user_message:
            return jsonify({"reply": "I didn't catch that."})

        completion = OR_CLIENT.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are Place-iT voice assistant. Reply in plain conversational English only. "
                        "NO markdown, NO bullet points, NO lists. Max 2 sentences. Be warm and direct."
                    )
                },
                {"role": "user", "content": user_message}
            ]
        )
        ai_reply = completion.choices[0].message.content
        # Strip all markdown for clean TTS
        clean_reply = re.sub(r'[*_`#>\[\]\-]', '', ai_reply).strip()

        return jsonify({"reply": clean_reply})

    except Exception as e:
        print(f"Voice chat error: {e}")
        return jsonify({"reply": "Sorry, I had trouble responding. Please try again."}), 500

@app.route('/tts', methods=['POST'])
def tts_proxy():
    if not ELEVENLABS_API_KEY:
        return jsonify({"error": "TTS key not configured"}), 503
    try:
        data = request.json
        text = data.get('text', '').strip()
        if not text:
            return jsonify({"error": "No text provided"}), 400

        url = f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID}"
        headers = {
            "xi-api-key": ELEVENLABS_API_KEY,
            "Content-Type": "application/json"
        }
        payload = {
            "text": text,
            "model_id": "eleven_turbo_v2",
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.75}
        }
        el_response = requests.post(url, json=payload, headers=headers, stream=True, timeout=15)
        if el_response.status_code == 200:
            return Response(el_response.iter_content(chunk_size=4096), mimetype='audio/mpeg')
        print(f"ElevenLabs error: {el_response.status_code} {el_response.text}")
        return jsonify({"error": "TTS generation failed"}), 500

    except requests.Timeout:
        return jsonify({"error": "TTS request timed out"}), 504
    except Exception as e:
        print(f"TTS error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/analyze-resume', methods=['POST'])
def analyze_resume():
    try:
        resume_text = ""
        jd_text = request.form.get('jd', '').strip()

        if 'file' in request.files:
            file = request.files['file']
            if not file.filename:
                return jsonify({"error": "No file selected."}), 400
            resume_text = extract_text_from_file(file)
            if resume_text is None:
                return jsonify({"error": "Unsupported file type. Please upload PDF, DOCX, or TXT."}), 400
        elif 'text' in request.form:
            resume_text = request.form['text'].strip()

        if not resume_text or len(resume_text) < 50:
            return jsonify({"error": "Resume too short or unreadable. Please check your file."}), 400

        jd_section = f"\n\nJob Description:\n{jd_text}" if jd_text else "\n\n(No job description provided — do general analysis)"

        prompt = f"""Analyze this resume and return ONLY a valid JSON object with exactly these fields:
{{
  "ats_score": <integer 0-100>,
  "experience_level": "<Entry Level|Intermediate|Senior>",
  "keyword_match": "<x/y format>",
  "matched_keywords": ["<keyword1>", "<keyword2>"],
  "missing_skills": ["<skill1>", "<skill2>"],
  "feedback_tips": ["<tip1>", "<tip2>", "<tip3>"],
  "strengths": ["<strength1>", "<strength2>"],
  "weak_phrases": ["<phrase1>"],
  "summary": "<2-3 sentence summary of the resume>"
}}

Resume:
{resume_text[:4000]}
{jd_section}

Return ONLY the JSON. No explanation, no markdown fences."""

        completion = OR_CLIENT.chat.completions.create(
            model=MODEL_NAME,
            messages=[{"role": "user", "content": prompt}]
        )

        raw_content = completion.choices[0].message.content
        cleaned = clean_json_response(raw_content)
        result = json.loads(cleaned)

        # Validate required fields exist
        required_fields = ["ats_score", "experience_level", "keyword_match",
                           "matched_keywords", "missing_skills", "feedback_tips",
                           "strengths", "weak_phrases", "summary"]
        for field in required_fields:
            if field not in result:
                result[field] = [] if field in ["matched_keywords", "missing_skills",
                                                 "feedback_tips", "strengths", "weak_phrases"] else ""

        # Clamp ATS score
        result["ats_score"] = max(0, min(100, int(result.get("ats_score", 0))))

        return jsonify(result)

    except json.JSONDecodeError as e:
        print(f"JSON parse error: {e}\nRaw: {raw_content if 'raw_content' in locals() else 'N/A'}")
        return jsonify({"error": "AI returned an unexpected format. Please try again."}), 500
    except Exception as e:
        print(f"Analysis Error: {e}")
        return jsonify({"error": "Analysis failed. Please try again."}), 500

if __name__ == '__main__':
    app.run(port=5000, debug=True)
