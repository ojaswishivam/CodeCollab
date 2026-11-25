# 📋 CodeCollab Studio - Feature Roadmap & TODO Checklist

> Comprehensive development roadmap, feature backlog, and architectural enhancement checklist for **CodeCollab Studio**.

---

## 📊 Roadmap Overview & Progress Tracker

| Milestone | Focus Area | Status | Priority | Target Timeline |
| :--- | :--- | :---: | :---: | :---: |
| **Phase 1** | Quick Wins, UX Polish & Developer Tooling | `Ready to Start` | 🔥 High | Sprint 1 (Week 1) |
| **Phase 2** | AI Pair-Programmer & In-Room Collaboration | `Planned` | 🔥 High | Sprint 2 (Week 2) |
| **Phase 3** | LeetCode-Style Test Runner & Interview Mode | `Planned` | ⚡ Medium | Sprint 3 (Week 3) |
| **Phase 4** | Multi-File Workspaces & Live Web Preview | `Planned` | ⚡ Medium | Sprint 4 (Week 4) |
| **Phase 5** | Sandbox Hardening, PTY Terminal & WebAssembly | `Planned` | 🛡️ Security | Sprint 5 (Week 5) |

---

## 🚀 Phase 1: Quick Wins, UX Polish & Developer Tooling

Focus on immediate developer ergonomics, code formatting, and navigation helpers.

- [ ] **1.1 Code Auto-Formatting Integration (`Prettier` & Language Formatters)**
  - [ ] Add `Prettier` support for JavaScript/TypeScript (`Ctrl+Shift+F` / format-on-save toggle).
  - [ ] Add Black/Autopep8 formatter support for Python snippets.
  - [ ] Add Clang-Format integration for C++ source files.
  - [ ] Add "Format Code" button to Monaco editor toolbar.

- [ ] **1.2 "Follow Collaborator" Viewport & Focus Mode**
  - [ ] Click on any collaborator avatar in the presence bar to engage "Follow Mode".
  - [ ] Smooth auto-scrolling to the tracked user's cursor position in Monaco Editor.
  - [ ] Visual indicator banner (`"Following @Dev-384 — Click anywhere to detach"`).

- [ ] **1.3 Editor Customization & Themes**
  - [ ] Support Monaco themes: `VS-Dark`, `Monokai`, `One Dark Pro`, `Dracula`, `GitHub Dark`.
  - [ ] Toggle settings for minimap, tab size (2 vs 4 spaces), word wrap, and line numbers.
  - [ ] Keybinding mode selection (Standard VS Code, Vim mode, Emacs mode).

- [ ] **1.4 1-Click Code Sharing & Gist Export**
  - [ ] Export current editor code directly as a secret/public GitHub Gist via GitHub API.
  - [ ] Generate quick shareable read-only links with embedded code snippets.
  - [ ] Single-click "Copy Shareable Room Link" with feedback toast.

---

## 🤖 Phase 2: AI Pair-Programmer & In-Room Collaboration

Integrate generative AI assistance and real-time communication directly into rooms.

- [ ] **2.1 AI Error Diagnosis & 1-Click Auto-Fix**
  - [ ] Detect runtime errors, exceptions, and compile errors in execution panel.
  - [ ] Add **"💡 Explain & Auto-Fix with AI"** button on terminal failure output.
  - [ ] Generate structured explanation + unified diff preview before applying the fix.
  - [ ] 1-Click **"Apply Fix to Editor"** modifying CRDT state smoothly.

- [ ] **2.2 In-Room Collaborative AI Assistant Panel**
  - [ ] Collapsible AI Chat sidebar powered by Gemini / Claude / OpenAI API.
  - [ ] Code context injection: AI automatically receives current editor snippet and runtime errors.
  - [ ] Synchronized AI responses visible to all active collaborators in the room.
  - [ ] Quick prompt shortcuts: *"Explain this code"*, *"Optimize time complexity"*, *"Generate unit tests"*.

- [ ] **2.3 Real-Time In-Room Text Chat**
  - [ ] Synchronized room text chat panel with Markdown, emojis, and syntax-highlighted code snippets.
  - [ ] Sound/visual notification pill on new incoming messages while chat is minimized.
  - [ ] Direct `@mention` notifications for collaborators in the room.

- [ ] **2.4 WebRTC Peer-to-Peer Voice & Video Calls**
  - [ ] 1-Click "Join Voice / Video Call" within the active room.
  - [ ] Peer-to-peer audio/video mesh using WebRTC (zero external meeting links needed).
  - [ ] Mute, camera toggle, and screen share capabilities.

---

## 🧪 Phase 3: LeetCode-Style Test Runner & Interview Mode

Turn CodeCollab into a technical interview and algorithmic practice platform.

- [ ] **3.1 Multi-Case Unit Test Runner**
  - [ ] Add dedicated **"Test Cases"** tab alongside the single `stdin` console.
  - [ ] Allow adding arbitrary test cases with structured `Input` and `Expected Output`.
  - [ ] Batch execution dispatcher running all cases in parallel inside sandbox.
  - [ ] Visual results grid:
    - [ ] `Test Case 1`: ✅ Passed (12ms, 14MB RAM)
    - [ ] `Test Case 2`: ❌ Failed — Expected `[0, 1]`, Got `[1, 0]`
    - [ ] Execution difference highlighter for mismatch outputs.

- [ ] **3.2 Technical Interviewer Mode**
  - [ ] **Synchronized Countdown Timer:** 30min / 45min / 60min stopwatch visible to interviewer & candidate.
  - [ ] **Problem Statement Drawer:** Markdown problem description panel with examples and constraints.
  - [ ] **Interviewer Private Notes:** Private scratchpad for ratings and evaluation notes.
  - [ ] **Candidate Lock / Read-Only Switch:** Freeze candidate editor during evaluation.

- [ ] **3.3 Pre-Loaded Problem Library (DSA & Algorithms)**
  - [ ] Built-in curated catalog of 20+ standard data structure & algorithm problems (Easy, Medium, Hard).
  - [ ] 1-Click "Load Problem into Room" with starter code templates and pre-populated test cases.

---

## 📂 Phase 4: Multi-File Project Workspaces & Live Web Preview

Transition from single-file scratchpad to full project architecture.

- [ ] **4.1 Multi-File Virtual Project Tree**
  - [ ] Sidebar file explorer supporting folders, files, file creation, rename, and deletion.
  - [ ] Real-time CRDT synchronization for file system operations using `Y.Map`.
  - [ ] Multi-tab editor bar allowing switching between active files.
  - [ ] Multi-file runner: zip/tar payload dispatcher executing entrypoint files (`index.js`, `main.py`).

- [ ] **4.2 Live Web Preview Tab (HTML / CSS / JS / React)**
  - [ ] Embedded sandboxed `<iframe>` live preview with real-time hot-reloading.
  - [ ] Responsive device viewport switcher (Desktop `100%`, Tablet `768px`, Mobile `375px`).
  - [ ] Virtual DOM console interceptor streaming `console.log()` to the terminal tab.

- [ ] **4.3 CRDT Time Machine & Version History Replay**
  - [ ] Historical revision scrubber to replay room edits keystroke-by-keystroke.
  - [ ] Create named checkpoint snapshots (e.g., *"Checkpoint before refactoring"*).
  - [ ] Side-by-side visual diff viewer between revisions.

---

## 🛡️ Phase 5: Sandbox Hardening, PTY Terminal & WebAssembly

Deep architectural improvements for performance, safety, and operational scale.

- [ ] **5.1 Interactive WebSocket PTY Terminal (xterm.js)**
  - [ ] Replace batch `stdin` with full bi-directional pseudo-terminal (`node-pty` / `xterm.js`).
  - [ ] Support interactive CLI applications (Python interactive REPL, `top`, `vim`, curses).
  - [ ] ANSI color escape code rendering and cursor positioning.

- [ ] **5.2 Expanded Multi-Language Runtimes**
  - [ ] **TypeScript / TSX** (Node / Bun runtime).
  - [ ] **Rust** (`rustc` / `cargo` compilation & execution).
  - [ ] **Go** (`go run` runtime).
  - [ ] **Java** (`OpenJDK 21` compilation & execution).

- [ ] **5.3 Client-Side WebAssembly (Wasm) Zero-Latency Runtimes**
  - [ ] Run Python code directly in the browser with **Pyodide** (0ms execution latency, 0 server cost).
  - [ ] Run JavaScript/TypeScript inside WebAssembly V8 isolate workers.
  - [ ] Offline execution toggle for zero-network environments.

- [ ] **5.4 Enterprise Granular Room Permissions & Security**
  - [ ] Room Access Control: `Public`, `Unlisted (Link only)`, `Password-Protected`, `Private (Invite only)`.
  - [ ] Granular user roles per room: `Owner`, `Editor`, `Commenter`, `Viewer (Read-only)`.
  - [ ] Rate limiting & abuse prevention (Redis token bucket per IP for `/api/execute`).

---

## 📌 Implementation Checklist & Notes

```markdown
Legend:
- [ ] Not Started
- [/] In Progress
- [x] Completed
```

### Next Immediate Steps:
1. Choose feature from **Phase 1** or **Phase 2** to implement.
2. Create feature branch: `git checkout -b feature/<feature-name>`.
3. Test CRDT synchronization with multiple browser tabs.
4. Run `npm run build` in `client` and `server` before merging.
