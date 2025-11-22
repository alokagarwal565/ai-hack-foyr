# AI-Powered Multi-App Platform 🚀

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Groq AI](https://img.shields.io/badge/Powered_by-Groq_AI-f55036?style=for-the-badge)

A sophisticated full-stack TypeScript application that demonstrates **dual-mode interaction** across three distinct applications: a Drawing Canvas, a Task Manager, and a Layout Grid Builder. Users can interact with each application either manually through traditional UI tools or via natural language commands powered by AI.

🔗 **Repository**: [https://github.com/alokagarwal565/ai-hack-foyr](https://github.com/alokagarwal565/ai-hack-foyr)

---

## ✨ Key Features

### 🎨 Smart Drawing Canvas

- **Dual-Mode**: Draw manually or use natural language commands (e.g., "draw a red circle").
- **AI Templates**: Recognizes complex requests like "draw a smiley face", "house", or "tree".
- **Smart Placement**: AI automatically positions new shapes to avoid overlaps.
- **Voice Control**: Speak commands directly to the canvas.

### ✅ AI Task Manager

- **Natural Language Creation**: "Create a high priority task to review code tomorrow".
- **Smart Filtering**: Filter tasks using conversation ("show me all high priority tasks").
- **Organization**: Priority levels, categories, and tags.

### 📐 Layout Grid Builder

- **AI Generation**: "Create a 3-column layout with a header and footer".
- **Drag & Drop**: Intuitive block positioning and resizing.
- **Responsive Grids**: Flexible column and row configurations.

### ⚡ Core Platform Features

- **Real-Time Collaboration**: WebSocket-based synchronization across all clients.
- **Voice-to-Text**: Integrated Whisper model for accurate voice commands.
- **Context Awareness**: AI understands the current state of your application.

---

## 🛠️ Technology Stack

### Frontend

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: TanStack Query + React Hooks
- **Routing**: wouter

### Backend

- **Server**: Express.js with Node.js
- **Real-Time**: WebSocket (ws)
- **AI Service**: Groq SDK (Llama 3.3 70B + Whisper)
- **Database**: Drizzle ORM (PostgreSQL ready)
- **Storage**: In-memory storage (development) / PostgreSQL (production)

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- A [Groq API Key](https://console.groq.com/) for AI functionality

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/alokagarwal565/ai-hack-foyr.git
   cd ai-hack-foyr
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Create a `.env` file in the root directory:

   ```env
   # Required for AI features
   GROQ_API_KEY=your_groq_api_key_here

   # Optional: For database persistence (defaults to in-memory if omitted)
   DATABASE_URL=postgresql://user:password@host:port/dbname

   # Server Configuration
   PORT=5000
   ```

4. **Run the Application**

   ```bash
   # Development mode (Frontend + Backend with hot reload)
   npm run dev
   ```

   The application will start at `http://localhost:5000`.

---

## 📖 Usage Guide

### Drawing Canvas

1. Navigate to the **Canvas** tab.
2. **Manual**: Select a tool from the sidebar (Rectangle, Circle, Line) and draw.
3. **AI**: Type or speak "Draw a blue triangle" or "Clear the canvas".
4. **Templates**: Try "Draw a sun" or "Draw a house".

### Task Manager

1. Navigate to the **Tasks** tab.
2. **Manual**: Click "+" to add a task.
3. **AI**: Type "Add a task to buy groceries" or "Mark all high priority tasks as complete".

### Layout Builder

1. Navigate to the **Layout** tab.
2. **Manual**: Drag blocks from the sidebar onto the grid.
3. **AI**: Type "Create a blog post layout with a large image and text".

---

## 📂 Project Structure

```
ai-hack-foyr/
├── client/                 # React Frontend
│   ├── src/
│   │   ├── components/     # UI & Feature components
│   │   ├── hooks/          # Custom hooks (useCanvas, useWebSocket)
│   │   └── pages/          # Application views
├── server/                 # Express Backend
│   ├── services/           # Groq AI integration
│   ├── routes.ts           # API & WebSocket routes
│   └── storage.ts          # Data persistence layer
└── shared/                 # Shared types & schemas
```

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Built with ❤️ using TypeScript and AI.
