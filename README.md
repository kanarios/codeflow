# CodeFlow 🚀

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)
[![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)
[![Node.js](https://img.shields.io/badge/node.js-%2343853D.svg?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/react-%2320232a.svg?style=flat&logo=react&logoColor=%2361DAFB)](https://reactjs.org/)

A powerful real-time collaborative coding tool. CodeFlow makes it easy to conduct technical interviews, teach programming, and collaborate on code with your team.

[CodeFlow Demo](https://livecoding-327628718bd5.herokuapp.com)

## ✨ Features

- 🔄 **Real-time collaborative editing**
- 🎯 **Multi-language support** (JavaScript, Python, Java, TypeScript)
- 👥 **Multi-cursor tracking**
- 🚀 **Instant code execution**
- 🔒 **Secure sandboxed environment**
- 🎨 **Syntax highlighting**
- 📱 **Responsive design**

## 🚀 Quick Start

### Prerequisites

- Node.js ≥ 16.0.0
- npm ≥ 8.0.0
- Docker and Docker Compose

### Installation and Running

1. Clone the repository:

```bash
git clone https://github.com/yourusername/codeflow.git
cd codeflow
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
make dev
```

4. Or run with Docker:

```bash
make docker-up
```

## 🛠️ Technology Stack

### Frontend
- **React** - UI framework
- **Monaco Editor** - Code editor
- **Socket.IO Client** - Real-time communication
- **CSS Modules** - Styling

### Backend
- **Node.js** - Runtime environment
- **Express** - Web framework
- **Socket.IO** - WebSocket server
- **Docker** - Code execution isolation

## 📖 Documentation

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | 5001 | No |
| `NODE_ENV` | Environment | development | No |
| `CORS_ORIGIN` | CORS origin | * | No |
| `DOCKER_GROUP_ID` | Docker group ID | 999 | Yes |

### API Endpoints

#### WebSocket Events

| Event | Description | Payload |
|-------|-------------|---------|
| `code:change` | Code update | `{ code: string }` |
| `cursor:move` | Cursor position | `{ position: number }` |
| `execution:start` | Run code | `{ language: string }` |

#### HTTP Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/sessions/:id` | Get session |
| POST | `/api/sessions` | Create session |

## 🔧 Development

### Project Structure

```
codeflow/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── styles/
│   ├── public/
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── services/
│   │   └── utils/
│   └── package.json
└── docker-compose.yml
```

### Available Commands

| Command | Description |
|---------|-------------|
| `make install` | Install dependencies |
| `make dev` | Start development servers |
| `make build` | Build for production |
| `make test` | Run tests |
| `make docker-up` | Start with Docker |
| `make docker-down` | Stop Docker containers |
| `make logs` | View logs |

## 🔒 Security

- Isolated code execution in Docker containers
- Memory and CPU limits for containers
- Network access disabled in containers
- Input validation and sanitization
- Rate limiting for API endpoints

## 📈 Performance

- Real-time latency: < 100ms
- Code execution timeout: 10s
- Maximum file size: 1MB
- Container memory limit: 100MB
- Maximum concurrent users per room: 100

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please read our [Contributing Guidelines](CONTRIBUTING.md) for details.

## 🐛 Known Issues

- Running code for TypeScript and Java does not work (WORK IN PROGRESS)
- Safari has some Monaco Editor rendering issues

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Authors

- **kanarios** - *Project Creator* - [GitHub](https://github.com/kanarios)

## 🙏 Acknowledgments

- [Monaco Editor](https://microsoft.github.io/monaco-editor/) for the amazing code editor
- [Socket.IO](https://socket.io/) for reliable real-time capabilities
- [Docker](https://www.docker.com/) for secure code execution
- All contributors who help make CodeFlow better

---

<p align="center">
  Built with ❤️ by QA for engineers
</p>

