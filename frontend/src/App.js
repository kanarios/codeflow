import React, { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import MonacoEditor from '@monaco-editor/react';
import { useLocation, useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';
import Loading from '@monaco-editor/react';
import './editor.css';
import './App.css';

const BACKEND_URL = process.env.NODE_ENV === 'production'
  ? window.location.origin
  : (process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001');

// Константы для куки
const COOKIE_NAME = 'userName';
const COOKIE_SURNAME = 'userSurname';
const COOKIE_EXPIRES = 1; // 1 день

console.log(BACKEND_URL);
const socket = io(BACKEND_URL, {
  transports: ['websocket', 'polling'],
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  autoConnect: true,
  withCredentials: false
});

// Выносим компонент за пределы основного компонента
const NameInput = React.memo(({
  userName,
  userSurname,
  onNameChange,
  onSurnameChange,
  onSubmit
}) => (
  <div className="name-input-container">
    <h2>Добро пожаловать!</h2>
    <div className="input-group">
      <input
        type="text"
        placeholder="Имя *"
        value={userName}
        onChange={onNameChange}
        required
      />
      <input
        type="text"
        placeholder="Фамилия (опционально)"
        value={userSurname}
        onChange={onSurnameChange}
      />
      <button
        onClick={onSubmit}
        disabled={!userName.trim()}
      >
        Продолжить
      </button>
    </div>
  </div>
));

function App() {
  const [sessionId, setSessionId] = useState(null);
  const [code, setCode] = useState('');
  const [output, setOutput] = useState('');
  const [language, setLanguage] = useState('python');
  const [copySuccess, setCopySuccess] = useState(false);
  const [languages] = useState([
    { id: 'javascript', name: 'JavaScript', example: 'console.log("Hello World!");' },
    { id: 'typescript', name: 'TypeScript', example: 'console.log("Hello World!");' },
    { id: 'python', name: 'Python', example: 'print("Hello World!")' },
    { id: 'java', name: 'Java', example: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello World!");\n    }\n}' }
  ]);
  const [joinSessionId, setJoinSessionId] = useState('');
  const [error, setError] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [selections, setSelections] = useState({});
  const [editorInstance, setEditorInstance] = useState(null);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [userName, setUserName] = useState(Cookies.get(COOKIE_NAME) || '');
  const [userSurname, setUserSurname] = useState(Cookies.get(COOKIE_SURNAME) || '');
  const [isNameSet, setIsNameSet] = useState(!!Cookies.get(COOKIE_NAME));

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected to server');
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setError('Ошибка подключения к серверу');
    });

    socket.on('code_update', (newCode) => {
      setCode(newCode);
    });

    socket.on('session_joined', (sessionData) => {
      console.log('Joined session, received data:', sessionData);
      setCode(sessionData.code);
      setLanguage(sessionData.language);
    });

    socket.on('execution_result', (result) => {
      console.log('Received execution result:', result);
      setOutput(result);
      setIsExecuting(false);
    });

    socket.on('execution_error', (error) => {
      console.error('Execution error:', error);
      setOutput(`Ошибка: ${error}`);
      setIsExecuting(false);
    });

    socket.on('session_created', (id) => {
      console.log('Session created:', id);
      setSessionId(id);
      setError(null);
    });

    socket.on('selection_update', ({ userId, selection }) => {
      setSelections(prev => ({
        ...prev,
        [userId]: selection
      }));
    });

    socket.on('user_disconnected', ({ userId }) => {
      setSelections(prev => {
        const newSelections = { ...prev };
        delete newSelections[userId];
        return newSelections;
      });
    });

    return () => {
      socket.off('code_update');
      socket.off('session_joined');
      socket.off('execution_result');
      socket.off('execution_error');
      socket.off('connect');
      socket.off('connect_error');
      socket.off('session_created');
      socket.off('selection_update');
      socket.off('user_disconnected');
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sessionFromUrl = params.get('session');
    if (sessionFromUrl && !sessionId) {
      console.log('Joining session from URL:', sessionFromUrl);
      socket.emit('join_session', sessionFromUrl);
      setSessionId(sessionFromUrl);
    }
  }, [location, sessionId]);

  const createSession = () => {
    console.log('Creating session...');
    socket.emit('create_session', language);
  };

  const handleJoinSession = (e) => {
    e.preventDefault();
    console.log('Joining session:', joinSessionId);
    if (!joinSessionId) {
      setError('Введите ID сессии');
      return;
    }
    socket.emit('join_session', joinSessionId);
    setSessionId(joinSessionId);
    setError(null);
  };

  const handleSessionIdChange = (e) => {
    setJoinSessionId(e.target.value);
    setError(null);
  };

  const handleCodeChange = (newCode) => {
    console.log('Code changed');
    setCode(newCode);
    socket.emit('code_change', { sessionId, code: newCode });
  };

  const executeCode = () => {
    if (!code.trim()) {
      setError('Напишите код перед выполнением');
      setTimeout(() => setError(null), 3000); // Скрыть ошибку через 3 секунды
      return;
    }

    console.log('Executing code:', code);
    setIsExecuting(true);
    setOutput('Выполняется...');
    socket.emit('execute_code', { sessionId, code });
  };

  const handleLanguageChange = (e) => {
    const newLanguage = e.target.value;
    setLanguage(newLanguage);
    const currentLanguage = languages.find(l => l.id === newLanguage);
    setCode(currentLanguage.example);
  };

  const handleShare = async () => {
    const url = `${window.location.origin}?session=${sessionId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Обработчик горячих клавиш
  const handleKeyPress = useCallback((event) => {
    // Ctrl/Cmd + Enter для запуска кода
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      if (!isExecuting && code.trim()) executeCode();
    }
    // Ctrl/Cmd + S для сохранения кода в файл
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault();
      downloadCode();
    }
  }, [isExecuting, code]);

  // Регистрация обработчика горячих клавиш
  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  // Функция сохранения кода
  const downloadCode = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `code.${getFileExtension(language)}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Получение расширения файла по языку
  const getFileExtension = (lang) => {
    const extensions = {
      javascript: 'js',
      python: 'py',
      ruby: 'rb',
      java: 'java'
    };
    return extensions[lang] || 'txt';
  };

  // Обработчик инициализации редактора
  const handleEditorDidMount = (editor, monaco) => {
    setEditorInstance(editor);
    window.monacoInstance = monaco;
    setIsEditorReady(true);

    editor.onDidChangeCursorSelection((e) => {
      if (sessionId) {
        const selection = {
          startLineNumber: e.selection.startLineNumber,
          startColumn: e.selection.startColumn,
          endLineNumber: e.selection.endLineNumber,
          endColumn: e.selection.endColumn
        };
        socket.emit('selection_change', { sessionId, selection });
      }
    });
  };

  const handleEditorWillMount = (monaco) => {
    monaco.editor.defineTheme('custom-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#1e1e1e',
      }
    });
  };

  const handleEditorValidation = (markers) => {
    // Обработка ошибок валидации кода
    markers.forEach((marker) => console.log('Validation:', marker.message));
  };

  useEffect(() => {
    if (editorInstance && selections && window.monacoInstance) {
      // Удаляем старые декорации
      const oldDecorations = editorInstance.getModel()?.getAllDecorations() || [];
      editorInstance.deltaDecorations(
        oldDecorations.map(d => d.id),
        []
      );

      // Добавляем новые декорации для каждого пользователя
      Object.entries(selections).forEach(([userId, selection], index) => {
        if (!selection) return;

        editorInstance.deltaDecorations(
          [],
          [{
            range: new window.monacoInstance.Range(
              selection.startLineNumber,
              selection.startColumn,
              selection.endLineNumber,
              selection.endColumn
            ),
            options: {
              className: `remote-selection remote-selection-${index % 4}`,
              hoverMessage: { value: `Выделение пользователя ${userId.slice(0, 6)}` },
              beforeContentClassName: 'remote-selection-label',
              before: {
                content: `👤 ${userId.slice(0, 6)}`,
                backgroundColor: getColorForIndex(index)
              }
            }
          }]
        );
      });
    }
  }, [editorInstance, selections]);

  // Функция для получения цвета по индексу
  const getColorForIndex = (index) => {
    const colors = ['#ffc600', '#ff00c6', '#00ffc6', '#c6ff00'];
    return colors[index % colors.length];
  };

  // Обновим обработчик изменения выделения
  const handleSelectionChange = useCallback((selection) => {
    if (sessionId) {
      socket.emit('selection_change', {
        sessionId,
        selection,
        userName: userSurname ? `${userName} ${userSurname}` : userName
      });
    }
  }, [sessionId, userName, userSurname]);

  // Обновим отображение выделений других пользователей
  const handleSelectionUpdate = useCallback(({ userId, selection, userName }) => {
    setSelections(prev => ({
      ...prev,
      [userId]: { ...selection, userName }
    }));
  }, []);

  const handleNameSubmit = useCallback(() => {
    if (userName.trim()) {
      setIsNameSet(true);
      const fullName = userSurname ? `${userName} ${userSurname}` : userName;
      socket.emit('set_user_name', { fullName });
      // Сохраняем в куки
      Cookies.set(COOKIE_NAME, userName, { expires: COOKIE_EXPIRES });
      if (userSurname) {
        Cookies.set(COOKIE_SURNAME, userSurname, { expires: COOKIE_EXPIRES });
      }
    }
  }, [userName, userSurname]);

  const handleNameChange = useCallback((e) => {
    setUserName(e.target.value);
  }, []);

  const handleSurnameChange = useCallback((e) => {
    setUserSurname(e.target.value);
  }, []);

  // Функция для выхода (очистка данных)
  const handleLogout = useCallback(() => {
    Cookies.remove(COOKIE_NAME);
    Cookies.remove(COOKIE_SURNAME);
    setUserName('');
    setUserSurname('');
    setIsNameSet(false);
    setSessionId(null);
  }, []);

  return (
    <div className="app">
      <h1 className="title">
        <a href="/" className="home-link">
          Livecoding Interview
        </a>
      </h1>
      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}
      {!isNameSet ? (
        <NameInput
          userName={userName}
          userSurname={userSurname}
          onNameChange={handleNameChange}
          onSurnameChange={handleSurnameChange}
          onSubmit={handleNameSubmit}
        />
      ) : (
        <>
          <div className="user-info">
            <span>{userSurname ? `${userName} ${userSurname}` : userName}</span>
            <button onClick={handleLogout} className="logout-button">
              <span className="icon">🚪</span>
              Выйти
            </button>
          </div>
          {!sessionId ? (
            <div className="session-controls">
              <p>
                Создайте новую сессию или присоединитесь к существующей
              </p>
              <div className="input-group">
                <button onClick={createSession} className="create-button">
                  <span className="icon">➕</span>
                  Создать сессию
                </button>
                <div className="or-divider">или</div>
                <form onSubmit={handleJoinSession}>
                  <input
                    placeholder="ID сессии"
                    value={joinSessionId}
                    onChange={handleSessionIdChange}
                  />
                  <button
                    type="submit"
                    className="join-button"
                    disabled={!joinSessionId.trim()}
                  >
                    <span className="icon">➜</span>
                    Войти
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="editor-container">
              <div className="session-info">
                <div className="session-id">
                  <span className="icon">🔑</span>
                  ID сессии: <code>{sessionId}</code>
                  <button
                    onClick={handleShare}
                    className="tool-button"
                    title="Скопировать ссылку на сессию"
                  >
                    <span className="icon">{copySuccess ? '✓' : '🔗'}</span>
                    {copySuccess ? 'Скопировано!' : 'Поделиться'}
                  </button>
                </div>
                <select value={language} onChange={handleLanguageChange}>
                  {languages.map(lang => (
                    <option key={lang.id} value={lang.id}>
                      {lang.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="toolbar">
                <div className="toolbar-group">
                  <button
                    onClick={executeCode}
                    disabled={isExecuting}
                    className="run-button"
                    title="Запустить код (Ctrl + Enter)"
                  >
                    <span className="icon">
                      {isExecuting ? '⏳' : '▶️'}
                    </span>
                    {isExecuting ? 'Выполняется...' : 'Запустить код'}
                  </button>
                </div>
              </div>
              <div className="editor-workspace">
                <div className="editor-main">
                  <div className="monaco-editor-container">
                    <MonacoEditor
                      height="100%"
                      language={language}
                      value={code}
                      onChange={handleCodeChange}
                      onMount={handleEditorDidMount}
                      theme="vs-dark"
                    />
                  </div>
                </div>
                <div className="output-panel">
                  <pre className="output-content">{output || 'Здесь появится результат выполнения кода'}</pre>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;