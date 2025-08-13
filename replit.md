# Overview

This is an AI-powered drawing canvas application that demonstrates dual-mode interaction - users can either manually draw shapes using traditional UI tools or control the canvas through natural language commands via AI. The application is built as a full-stack TypeScript solution with a React frontend and Express backend, featuring real-time communication through WebSockets and AI integration via Groq for natural language processing.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The client is built with React and TypeScript, using Vite as the build tool. The UI leverages shadcn/ui components for a modern, accessible design system built on top of Radix UI primitives and styled with Tailwind CSS. The application uses a custom hook-based architecture for state management:

- **Canvas Management**: `useCanvas` hook handles drawing state, tool selection, and shape manipulation
- **WebSocket Communication**: `useWebSocket` hook manages real-time bidirectional communication with the server
- **Voice Input**: `useVoiceInput` hook handles browser-based audio recording and processing

The routing is handled by wouter (a lightweight React router), and state management combines React Query for server state with local React hooks for UI state.

## Backend Architecture
The server is built with Express.js and TypeScript, implementing both REST API endpoints and WebSocket connections for real-time features. The architecture follows a modular approach:

- **HTTP Routes**: RESTful endpoints for CRUD operations on shapes and canvas state
- **WebSocket Server**: Real-time communication for live canvas updates and AI chat
- **Storage Layer**: Abstracted storage interface with in-memory implementation (designed to be easily replaced with persistent storage)
- **AI Service**: Groq integration for natural language command interpretation

The backend uses a middleware pattern for request logging and error handling, with separate route handlers for different functional areas.

## Data Storage
Currently uses an in-memory storage implementation through the `MemStorage` class, which implements the `IStorage` interface. This provides:

- Shape persistence and manipulation
- Canvas state management
- Chat message history
- User data (prepared for authentication features)

The storage is designed with Drizzle ORM schemas that define PostgreSQL table structures, making it straightforward to migrate to persistent database storage when needed.

## Real-time Communication
WebSocket implementation enables bidirectional communication between client and server:

- **Canvas Synchronization**: Real-time shape updates across connected clients
- **AI Chat Interface**: Live chat with AI assistant for natural language commands
- **Voice Command Processing**: Audio data transmission for voice-to-text conversion

## AI Integration
The Groq service provides natural language processing capabilities:

- **Command Interpretation**: Converts natural language to structured drawing commands
- **Context Awareness**: Understands current canvas state when processing commands
- **Flexible Output**: Returns structured data for shape creation, modification, or deletion

## Component Architecture
The frontend follows a component-driven architecture:

- **Canvas Components**: Specialized components for drawing tools, canvas rendering, and AI controls
- **UI Components**: Reusable shadcn/ui components for consistent design
- **Page Components**: Route-level components that compose the application views

## Development Workflow
The application supports both development and production modes:

- **Development**: Vite dev server with HMR, Express backend with auto-reload
- **Production**: Static asset serving with optimized builds
- **Type Safety**: Full TypeScript coverage across frontend, backend, and shared schemas

## Authentication & Security
The architecture includes preparation for user authentication with database schemas and session management, though currently operates without authentication requirements.

# External Dependencies

## Core Technologies
- **React**: Frontend framework with hooks-based state management
- **Express.js**: Backend web framework for API and WebSocket server
- **TypeScript**: Type safety across the entire application stack
- **Vite**: Frontend build tool and development server

## UI Framework
- **shadcn/ui**: Component library built on Radix UI primitives
- **Tailwind CSS**: Utility-first CSS framework for styling
- **Radix UI**: Accessible component primitives

## Database & ORM
- **Drizzle ORM**: Type-safe database ORM with PostgreSQL support
- **@neondatabase/serverless**: PostgreSQL database driver for serverless environments

## AI & Communication
- **Groq SDK**: AI service integration for natural language processing
- **WebSockets (ws)**: Real-time bidirectional communication
- **MediaRecorder API**: Browser-based audio recording for voice commands

## Development Tools
- **React Query (@tanstack/react-query)**: Server state management and caching
- **wouter**: Lightweight client-side routing
- **date-fns**: Date manipulation utilities
- **class-variance-authority**: Utility for creating component variants

## File Upload & Processing
- **multer**: Middleware for handling multipart/form-data (prepared for file uploads)

The application is designed to be easily deployable on platforms like Replit, with configuration for both development and production environments.