# 🧠 Digital Memory Search Engine

> **An AI-powered Personal Knowledge Management System that acts as your second brain.**

Digital Memory Search Engine (MemoryGPT) is a full-stack AI application that allows users to store, organize, search, and chat with their personal knowledge using Natural Language Processing (NLP), semantic search, vector embeddings, and Retrieval-Augmented Generation (RAG).

Instead of searching through folders or remembering file names, users can simply ask questions in natural language, and the system retrieves the most relevant information from their personal knowledge base.

---

# ✨ Features

## 🔐 Authentication

* User Registration & Login
* JWT Authentication
* Secure User Sessions

## 📂 Document Management

* Upload PDF, DOCX, TXT files
* Organize documents into a personal workspace
* View and manage uploaded files

## 📄 Intelligent Text Processing

* Automatic text extraction
* Document cleaning
* Smart chunking
* Metadata generation

## 🧠 Semantic Search

* Vector embeddings
* Similarity search
* Context-aware retrieval
* Cross-document search

## 💬 AI Chat

* Chat with your personal documents
* Context-aware conversations
* Source-based answers
* Chat history

## 📑 AI Summaries

* Generate document summaries
* Extract key points
* Highlight important concepts

## 🏷️ Smart Tag Generation

* Automatic keyword extraction
* AI-generated tags
* Better document organization

## 📚 Knowledge Management

* Search across multiple documents
* Personal knowledge base
* Long-term memory storage

---

# 🚀 How It Works

The system follows a Retrieval-Augmented Generation (RAG) architecture.

```text
                 Upload Document
                        │
                        ▼
               Text Extraction
                        │
                        ▼
                  Text Cleaning
                        │
                        ▼
                 Document Chunking
                        │
                        ▼
              Embedding Generation
                        │
                        ▼
              Vector Database Storage
                        │
                        ▼
                  User Question
                        │
                        ▼
              Semantic Similarity Search
                        │
                        ▼
             Retrieve Relevant Chunks
                        │
                        ▼
              Large Language Model
                        │
                        ▼
                AI Generated Answer
```

---

# 🏗️ System Architecture

```text
                  ┌──────────────────┐
                  │     Frontend     │
                  │     Next.js      │
                  └────────┬─────────┘
                           │
                    REST API Calls
                           │
                  ┌────────▼─────────┐
                  │     FastAPI      │
                  │      Backend     │
                  └────────┬─────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
 MongoDB          Vector Database      File Storage
(User Data)          (Embeddings)        (PDF/DOCX/TXT)

                           │
                           ▼
                    AI Processing Layer
          OCR • Embeddings • RAG • LLM
```

---

# 🛠️ Tech Stack

## Frontend

* Next.js
* React.js
* Tailwind CSS
* TypeScript
* shadcn/ui

## Backend

* FastAPI
* Python

## Database

* MongoDB

## Vector Database

* ChromaDB (or Qdrant)

## AI & Machine Learning

* Sentence Transformers
* LangChain
* Google Gemini API (or OpenAI)
* Retrieval-Augmented Generation (RAG)

## File Processing

* pdfplumber
* PyPDF2
* python-docx
* OCR (Tesseract/EasyOCR)

## Storage

* AWS S3 (Production)
* Local Storage (Development)

---

# 🧩 Core Modules

* Authentication Module
* Document Upload Module
* Text Extraction Pipeline
* Chunking Engine
* Embedding Generator
* Vector Search Engine
* AI Chat Engine
* Retrieval-Augmented Generation (RAG)
* Summary Generator
* Smart Tag Generator
* Chat History Manager

---

# 🔍 Search Pipeline

```text
User Query

↓

Embedding Generation

↓

Vector Similarity Search

↓

Retrieve Relevant Chunks

↓

Prompt Construction

↓

Large Language Model

↓

AI Response
```

---

# 🎯 Future Enhancements

* Voice Search
* Audio Transcription
* Image OCR
* Browser Extension
* YouTube Transcript Import
* Knowledge Graph Visualization
* Timeline View
* Flashcard Generator
* Quiz Generator
* Multi-Agent AI Assistants
* Mobile Application
* Team Collaboration
* Offline AI Support

---

# 📖 Use Cases

* Student Knowledge Management
* Research Paper Organization
* Personal Second Brain
* Interview Preparation
* Digital Note Taking
* Enterprise Knowledge Base
* Learning Assistant
* Personal AI Memory

---

# 💡 Why This Project?

Traditional search relies on exact keywords, making it difficult to locate information spread across multiple documents.

The Digital Memory Search Engine uses semantic search and Retrieval-Augmented Generation (RAG) to understand the meaning of user queries rather than just matching keywords. This enables users to retrieve knowledge naturally, chat with their personal documents, and build a long-term AI-powered memory that grows over time.

---

# 🤝 Contributing

Contributions are welcome!

1. Fork the repository.
2. Create a new feature branch.
3. Commit your changes.
4. Push to your branch.
5. Open a Pull Request.