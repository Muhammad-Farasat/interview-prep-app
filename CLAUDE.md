# InterviewAI — Complete Project Documentation

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Folder Structure](#3-folder-structure)
4. [App Flow](#4-app-flow)
5. [Screen-by-Screen Breakdown](#5-screen-by-screen-breakdown)
6. [Services](#6-services)
7. [Components](#7-components)
8. [Constants & Data](#8-constants--data)
9. [State Management](#9-state-management)
10. [Database](#10-database)
11. [Environment Variables](#11-environment-variables)
12. [Non-CRUD Features](#12-non-crud-features)
13. [Installation & Setup](#13-installation--setup)
14. [How to Run](#14-how-to-run)
15. [API Reference](#15-api-reference)
16. [Known Limitations](#16-known-limitations)
17. [Future Improvements](#17-future-improvements)

---

## 1. Project Overview

**InterviewAI** is a mobile application built with React Native (Expo) that helps developers practice technical and behavioural interview questions using AI-powered analysis.

The user records their answer to an interview question using their device camera and microphone. The audio is transcribed using **Groq's Whisper** model and then analyzed by **Groq's LLaMA 3** model, which returns a detailed score breakdown, filler word detection, speaking pace analysis, written feedback, and improvement suggestions — all in real time.

### Problem it solves
Pakistani fresh graduates and developers struggle to prepare for interviews without access to expensive coaching or senior mentors. InterviewAI gives every developer an AI coach in their pocket, for free.

### Target users
- Fresh CS graduates preparing for their first job
- Junior developers switching companies
- Self-taught developers entering the job market

---

## 2. Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Framework | React Native + Expo SDK 55 | Cross-platform mobile app |
| Language | TypeScript | Type safety throughout |
| Navigation | Expo Router (file-based) | Screen routing |
| AI — LLM | Groq API (LLaMA 3 8B) | Answer scoring & feedback |
| AI — Speech | Groq Whisper Large v3 | Audio transcription |
| Camera | expo-camera (`CameraView`) | Front camera preview |
| Audio | expo-av (`Audio.Recording`) | Microphone recording + metering |
| Local DB | expo-sqlite | Session history storage |
| State | Zustand | Global app state |
| Fast storage | react-native-mmkv | Key-value preferences |
| Charts | victory-native | Progress visualization |
| Animations | react-native-reanimated 2 | Animated scores and bars |
| Gestures | react-native-gesture-handler | Swipe and tap interactions |

---

## 3. Folder Structure

```
InterviewAI/
│
├── app/                          ← All screens (expo-router)
│   ├── _layout.tsx               ← Root navigation layout
│   │
│   ├── (tabs)/                   ← Bottom tab screens
│   │   ├── _layout.tsx           ← Tab bar configuration
│   │   ├── index.tsx             ← Home dashboard
│   │   ├── history.tsx           ← Past sessions list
│   │   └── progress.tsx          ← Charts & progress stats
│   │
│   └── interview/                ← Interview flow (no tab bar)
│       ├── setup.tsx             ← Pick role, difficulty, question
│       ├── session.tsx           ← Live recording screen
│       └── results.tsx           ← AI feedback & scores
│
├── components/                   ← Reusable UI components
│   ├── AudioWaveform.tsx         ← Animated mic level bars
│   ├── ScoreCard.tsx             ← Animated score display
│   └── StreakBadge.tsx           ← Daily streak counter
│
├── services/                     ← External API integrations
│   ├── groq.ts                   ← Groq LLaMA answer analysis
│   └── whisper.ts                ← Groq Whisper transcription
│
├── store/                        ← Global state
│   └── useInterviewStore.ts      ← Zustand store
│
├── db/                           ← Local database
│   └── database.ts               ← SQLite init, save, query
│
├── constants/                    ← Static data
│   └── questions.ts              ← Question bank by role
│
└── .env                          ← API keys (never commit this)
```

---

## 4. App Flow

```
App Launch
    │
    ▼
Home Screen (index.tsx)
    │
    │── tap "Start new interview"
    │
    ▼
Setup Screen (setup.tsx)
    │
    ├── Step 1: Pick a role
    │       Frontend / Backend / Mobile / General
    │
    ├── Step 2: Select difficulty
    │       Easy / Medium / Hard
    │
    ├── Step 3: Choose a question
    │       (filtered by role + difficulty)
    │
    └── tap "Start Interview"
            │
            ▼
        Session Screen (session.tsx)
            │
            ├── Camera turns on (front-facing)
            ├── User taps "Start Recording"
            │       ├── expo-av starts recording audio
            │       ├── Timer starts counting up
            │       └── AudioWaveform animates from mic metering
            │
            ├── User taps "Stop & Analyze"
            │       ├── Recording stops → gets audio URI
            │       ├── Audio sent to Groq Whisper → transcript
            │       ├── Transcript sent to Groq LLaMA → feedback JSON
            │       └── "Analyzing..." loader shown
            │
            ▼
        Results Screen (results.tsx)
            │
            ├── Overall score (animated 0 → score)
            ├── Score breakdown bars (Relevance, Clarity, Depth)
            ├── Speaking pace (words per minute)
            ├── Filler word count + list
            ├── AI written feedback paragraph
            ├── 3 improvement suggestions
            └── Full transcript
                    │
                    ├── "Try again" → back to Session
                    └── "Back to home" → Home screen
```

---

## 5. Screen-by-Screen Breakdown

### 5.1 Home Screen — `app/(tabs)/index.tsx`

**Purpose:** Entry point. Motivates the user and provides quick access to start.

**What it shows:**
- Greeting header
- Large "Start new interview" button (navigates to setup)
- Daily tip from a rotating list of 5 interview tips
- Role shortcut cards (Frontend, Backend, Mobile, General)

**Navigation:** tapping any role card or the start button goes to `/interview/setup`

---

### 5.2 Setup Screen — `app/interview/setup.tsx`

**Purpose:** Lets the user configure their interview session before recording.

**Three steps in order:**

**Step 1 — Pick a role**
- Displays 4 role cards in a 2-column grid
- Each card shows an emoji icon and role name
- Selecting a role filters the question list
- Changing role resets selected question

**Step 2 — Select difficulty**
- Three pills: Easy (green), Medium (amber), Hard (red)
- Filters questions by difficulty
- Changing difficulty resets selected question

**Step 3 — Choose a question**
- List of 3–5 questions matching role + difficulty
- Tapping a question expands a tip underneath it
- Only one question can be selected at a time

**Start button:**
- Disabled (grey) until both a role and a question are selected
- Enabled (purple) when ready
- Navigates to `/interview/session` passing `question`, `role`, and `tip` as route params

---

### 5.3 Session Screen — `app/interview/session.tsx`

**Purpose:** The core screen. Records the user's answer and sends it for AI analysis.

**Key elements:**

**Camera preview**
- Uses `CameraView` from `expo-camera` with `facing="front"`
- Rounded corners, fills top portion of screen
- Timer overlay in top-right corner

**Timer**
- Counts up in `MM:SS` format
- Red dot appears and pulses when recording is active
- Resets on each new recording

**Question card**
- Displays the selected question in a dark card below camera
- Purple label "Your question" above

**AudioWaveform component**
- 24 animated bars that respond to microphone metering
- When recording: bars animate up and down based on real audio level
- When stopped: bars collapse flat and turn grey

**Start / Stop button**
- Purple "Start Recording" → begins `Audio.Recording`
- Red "Stop & Analyze" → stops recording and triggers AI pipeline

**Processing state**
- Shows a spinner and "Analyzing your answer..." text
- Button is hidden during processing to prevent double-tap

**Permissions handling**
- Requests camera permission via `useCameraPermissions()`
- Requests microphone permission via `Audio.requestPermissionsAsync()`
- Shows a permission screen if denied

**On stop recording:**
1. `Audio.Recording.stopAndUnloadAsync()` → gets `audioUri`
2. Calculates `durationSeconds` from start time
3. Calls `transcribeAudio(audioUri)` → returns transcript string
4. Calls `analyzeAnswer(question, transcript, durationSeconds)` → returns `GroqFeedback`
5. Navigates to `/interview/results` with all data as route params

---

### 5.4 Results Screen — `app/interview/results.tsx`

**Purpose:** Displays everything the AI returned about the user's answer.

**Sections in order:**

**Overall score**
- Large animated number that counts from 0 to the actual score
- Color coded: green (75+), amber (50–74), red (below 50)

**Score breakdown**
- Three animated progress bars: Relevance, Clarity, Depth
- Each bar animates from 0% to the score width on load
- Color of bar matches score level

**Speaking pace**
- Words per minute calculated locally from transcript length ÷ duration
- Status: "too slow" (< 110 wpm), "good" (110–160 wpm), "too fast" (> 160 wpm)

**Filler word count**
- Count of detected filler words
- Green if 5 or fewer, red if more than 5

**Filler word list**
- Pill badges for each unique filler word detected
- Styled in red with dark background

**AI feedback paragraph**
- 2–3 sentence written feedback from Groq LLaMA

**Improvement suggestions**
- Bullet list of 3 specific things to improve

**Transcript**
- Full text of what the user said (from Whisper)
- Italic styling to distinguish from other text

**Question reminder**
- The original question shown at the bottom with purple left border

**Footer buttons**
- "Try again" → navigates back to session screen
- "Back to home" → navigates to home tab

---

### 5.5 History Screen — `app/(tabs)/history.tsx`

**Purpose:** Shows all past interview sessions from the local SQLite database.

**Planned features:**
- List of past sessions with date, role, score, question
- Tap to expand and see full feedback again
- Filter by role or score range
- Delete sessions

---

### 5.6 Progress Screen — `app/(tabs)/progress.tsx`

**Purpose:** Visualizes improvement over time using Victory Native charts.

**Planned features:**
- Line chart: overall score over last 10 sessions
- Bar chart: filler word count trend
- Streak counter: consecutive days practiced
- Skill radar: Relevance, Clarity, Depth averages

---

## 6. Services

### 6.1 `services/groq.ts` — Answer Analysis

**Function:** `analyzeAnswer(question, transcript, durationSeconds)`

**What it does locally (before API call):**
- Calculates words per minute from transcript length and duration
- Determines pace label: "too slow", "good", or "too fast"
- Uses regex to detect filler words: um, uh, like, you know, basically, literally, actually, sort of, kind of, right, okay, so
- Extracts unique filler words used

**What it sends to Groq:**
- The interview question
- The full transcript
- A strict system prompt asking for JSON only

**What Groq returns:**
```json
{
  "score": 78,
  "relevance": 80,
  "clarity": 75,
  "depth": 70,
  "feedback": "Your answer was well-structured...",
  "improvements": ["Add a concrete example", "Avoid filler words", "Elaborate on depth"]
}
```

**Full return type (`GroqFeedback`):**
```typescript
interface GroqFeedback {
  score: number;           // 0–100 overall
  relevance: number;       // 0–100 how relevant to question
  clarity: number;         // 0–100 how clear and structured
  depth: number;           // 0–100 how detailed
  fillerWords: string[];   // unique filler words detected
  fillerCount: number;     // total filler occurrences
  pace: 'too slow' | 'good' | 'too fast';
  wordsPerMinute: number;
  feedback: string;        // AI written paragraph
  improvements: string[];  // 3 improvement tips
}
```

**Model used:** `llama3-8b-8192`
**Temperature:** `0.3` (consistent outputs)
**Max tokens:** `500`

---

### 6.2 `services/whisper.ts` — Audio Transcription

**Function:** `transcribeAudio(audioUri)`

**What it does:**
- Takes the local audio file URI from expo-av
- Creates a `FormData` object with the audio file
- Sends to Groq's Whisper endpoint

**Endpoint:** `https://api.groq.com/openai/v1/audio/transcriptions`

**Model used:** `whisper-large-v3`

**Parameters sent:**
- `model`: `whisper-large-v3`
- `temperature`: `0` (deterministic transcription)
- `response_format`: `verbose_json`
- `language`: `en`

**Returns:** plain transcript string

**Important:** Uses the same `EXPO_PUBLIC_GROQ_KEY` as the LLaMA service. No separate OpenAI key needed.

---

## 7. Components

### 7.1 `AudioWaveform.tsx`

**Props:**
```typescript
interface Props {
  isRecording: boolean;
  metering?: number;      // dB value from expo-av (-160 to 0)
}
```

**How it works:**
- Renders 24 animated `Animated.View` bars in a row
- When `isRecording` is false: all bars collapse to 4px height, grey color
- When `isRecording` is true:
  - Converts `metering` (dB) to a height value: `(metering + 60) / 60 * 40`
  - Adds random offset per bar so they don't all move identically
  - Each bar runs an `Animated.loop` with `Animated.sequence` (up → down)
  - Different animation durations per bar (180ms + i×10ms) for organic feel
- On unmount or recording stop: all animations are stopped and cleaned up

**Colors:**
- Recording: purple `#7F77DD`
- Stopped: grey `#B4B2A9` at 30% opacity

---

### 7.2 `ScoreCard.tsx` (to be built)

Planned animated card component for displaying individual scores. Will use `react-native-reanimated` for spring animations.

---

### 7.3 `StreakBadge.tsx` (to be built)

Planned badge showing the user's consecutive daily practice streak. Will read from SQLite session dates.

---

## 8. Constants & Data

### `constants/questions.ts`

Contains all interview questions organized by role and difficulty.

**Structure:**
```typescript
interface Question {
  id: string;
  text: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tip: string;       // shown when question is selected in setup
}

interface Role {
  id: string;
  label: string;
  icon: string;      // emoji
  questions: Question[];
}
```

**Roles available:**
- `frontend` — Frontend Developer (5 questions)
- `backend` — Backend Developer (5 questions)
- `general` — General Software (5 questions)
- `mobile` — Mobile Developer (5 questions)

**Total questions:** 20 across all roles and difficulties

**Difficulty distribution per role:**
- 2 easy, 2 medium, 1 hard (approximate)

---

## 9. State Management

### `store/useInterviewStore.ts` — Zustand

Global state that persists across screens during an active session.

**Planned state shape:**
```typescript
interface InterviewStore {
  currentRole: string | null;
  currentQuestion: string | null;
  currentDifficulty: Difficulty | null;
  streak: number;
  totalSessions: number;
  setRole: (role: string) => void;
  setQuestion: (q: string) => void;
  incrementStreak: () => void;
}
```

Currently route params are used to pass data between interview screens (`setup → session → results`). Zustand will be used for global data like streak count and user preferences.

---

## 10. Database

### `db/database.ts` — SQLite

**Table: `sessions`**

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `role` | TEXT | Role name |
| `question` | TEXT | Full question text |
| `transcript` | TEXT | Whisper transcription |
| `score` | INTEGER | Overall score 0–100 |
| `filler_count` | INTEGER | Number of filler words |
| `pace` | INTEGER | Words per minute |
| `feedback` | TEXT | AI feedback paragraph |
| `created_at` | TEXT | ISO timestamp |

**Functions:**
- `initDB()` — creates the table if it doesn't exist. Call on app launch.
- `saveSession(data)` — inserts a new session row after results are shown
- `getSessions()` — returns all sessions ordered by newest first

---

## 11. Environment Variables

Create a `.env` file in the root of the project:

```env
EXPO_PUBLIC_GROQ_KEY=your_groq_api_key_here
```

**Where to get your Groq API key:**
1. Go to [console.groq.com](https://console.groq.com)
2. Sign up for a free account
3. Go to API Keys → Create API Key
4. Paste into `.env`

**Important rules:**
- Never commit `.env` to Git — it is already in `.gitignore`
- The `EXPO_PUBLIC_` prefix makes the key accessible in React Native code
- One key covers both Whisper transcription and LLaMA analysis

---

## 12. Non-CRUD Features

These are the technically impressive parts of the app — what makes it more than a form + database:

### 12.1 Real-time microphone metering
`expo-av` streams audio metering data (dB level) while recording via `setOnRecordingStatusUpdate`. This feeds into `AudioWaveform` to animate bars in real time based on actual voice volume.

### 12.2 Filler word detection algorithm
A regex pattern scans the transcript for 12 common filler words and counts total occurrences + unique words used. Runs locally without any API call.

### 12.3 Speaking pace calculation
Words per minute is calculated locally: `(wordCount / durationSeconds) * 60`. Then classified into three categories with thresholds (110 wpm / 160 wpm).

### 12.4 AI answer scoring via Groq LLaMA
The transcript and question are sent to `llama3-8b-8192` with a structured JSON prompt. The model returns relevance, clarity, and depth scores plus written feedback — all in under 1 second thanks to Groq's speed.

### 12.5 AI audio transcription via Groq Whisper
`whisper-large-v3` converts the recorded `.m4a` audio file into text. This is OpenAI Whisper-quality transcription running on Groq's infrastructure for speed.

### 12.6 Animated score counter
The overall score animates from 0 to the actual value using `Animated.timing` over 1200ms, giving the results screen a premium feel.

### 12.7 Animated progress bars
Score breakdown bars (Relevance, Clarity, Depth) animate from 0% width to their actual value with a 300ms delay, creating a sequential reveal effect.

### 12.8 Device camera integration
Front-facing camera is active during the session, showing the user themselves — simulating a real video interview environment.

---

## 13. Installation & Setup

### Prerequisites
- Node.js 18 or higher
- Expo CLI
- A physical Android or iOS device (or emulator) — camera and microphone don't work in web

### Step 1 — Clone or create the project
```bash
npx create-expo-app@latest InterviewAI --template blank-typescript
cd InterviewAI
```

### Step 2 — Install dependencies
```bash
# Expo native modules
npx expo install expo-router expo-camera expo-av
npx expo install expo-sqlite expo-notifications
npx expo install expo-file-system expo-speech

# UI & animation
npm install react-native-reanimated react-native-gesture-handler --legacy-peer-deps
npm install victory-native react-native-svg --legacy-peer-deps
npm install @shopify/flash-list --legacy-peer-deps

# State & storage
npm install zustand react-native-mmkv --legacy-peer-deps
npm install axios --legacy-peer-deps
```

> If you get peer dependency errors, always add `--legacy-peer-deps`

### Step 3 — Create folder structure
```bash
mkdir -p app/(tabs) app/interview components services store db constants
```

### Step 4 — Copy all files
Place each file from this project into its matching location as shown in section 3.

### Step 5 — Set up environment variables
```bash
# Create .env in root
echo "EXPO_PUBLIC_GROQ_KEY=your_key_here" > .env
```

### Step 6 — Update app.json
Add the scheme required by expo-router:
```json
{
  "expo": {
    "name": "InterviewAI",
    "slug": "interviewai",
    "scheme": "interviewai",
    "version": "1.0.0"
  }
}
```

---

## 14. How to Run

```bash
# Start the development server
npx expo start

# Then press:
# a → open on Android emulator
# i → open on iOS simulator
# Scan QR code → open on physical device via Expo Go app
```

**For physical device:** Install **Expo Go** from the Play Store or App Store, then scan the QR code shown in the terminal.

---

## 15. API Reference

### Groq — LLaMA 3 (Answer Analysis)

```
POST https://api.groq.com/openai/v1/chat/completions
Authorization: Bearer {GROQ_API_KEY}
Content-Type: application/json

Body:
{
  "model": "llama3-8b-8192",
  "max_tokens": 500,
  "temperature": 0.3,
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ]
}
```

### Groq — Whisper (Transcription)

```
POST https://api.groq.com/openai/v1/audio/transcriptions
Authorization: Bearer {GROQ_API_KEY}
Content-Type: multipart/form-data

Body (FormData):
- file: audio.m4a
- model: whisper-large-v3
- temperature: 0
- response_format: verbose_json
- language: en
```

---

## 16. Known Limitations

| Limitation | Reason | Workaround |
|---|---|---|
| No offline mode | Groq API requires internet | Show error message when offline |
| English only | Whisper set to `language: en` | Change to `ur` for Urdu support |
| `.m4a` format only | expo-av default on iOS | Android uses `.3gp` — may need format check |
| Camera not in web | Expo limitation | Test on physical device only |
| No user accounts | No backend | All data is local SQLite only |

---

## 17. Future Improvements

| Feature | Description | Priority |
|---|---|---|
| History screen | List all past sessions from SQLite with scores | High |
| Progress charts | Line chart of score over time using Victory Native | High |
| Streak system | Daily practice streak with push notification reminder | Medium |
| Urdu support | Switch Whisper language to `ur` for Urdu speakers | Medium |
| Custom questions | Let users type their own question | Medium |
| Video playback | Record and replay the session video | Low |
| Share results | Share score card as image to LinkedIn/WhatsApp | Low |
| Offline question bank | Practice without internet for question selection | Low |
| Company-specific prep | Amazon, Google, local Pakistani companies | Low |

---

*Built with React Native + Expo + Groq AI*