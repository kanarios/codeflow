import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';
import MonacoEditor from '@monaco-editor/react';
import { useLocation, useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';
import './editor.css';
import './App.css';

const BACKEND_URL = process.env.NODE_ENV === 'production'
  ? window.location.origin
  : (process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001');

// Константы для куки
const COOKIE_NICKNAME = 'codeflow_nickname';
const COOKIE_EXPIRES = 1; // 1 день

// Массивы для генерации случайных никнеймов
const adjectives = [
  'Fiery', 'Icy', 'Wise', 'Swift', 'Bright',
  'Dark', 'Great', 'Silent', 'Loud', 'Shining',
  'Eternal', 'Light', 'Mighty', 'Steel', 'Brave',
  'Merry', 'Mystic', 'Magical', 'Stellar', 'Elegant',
  'Cosmic', 'Cyber', 'Digital', 'Electric', 'Frozen',
  'Golden', 'Hidden', 'Infinite', 'Jade', 'Keen',
  'Lunar', 'Noble', 'Phantom', 'Quantum', 'Royal',
  'Shadow', 'Thunder', 'Ultra', 'Vivid', 'Wild'
];

const nouns = [
  'Warrior', 'Mage', 'Dragon', 'Eagle', 'Wolf',
  'Fox', 'Tiger', 'Genius', 'Ninja', 'Ghost',
  'Phoenix', 'Hero', 'Knight', 'Astronaut', 'Pilot',
  'Panther', 'Falcon', 'Storm', 'Seeker', 'Master',
  'Archer', 'Blade', 'Coder', 'Drifter', 'Explorer',
  'Fury', 'Guardian', 'Hunter', 'Inventor', 'Joker',
  'King', 'Legend', 'Marauder', 'Navigator', 'Oracle',
  'Pirate', 'Ranger', 'Samurai', 'Titan', 'Voyager'
];

// Функция для генерации случайного никнейма
const generateRandomNickname = () => {
  const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${randomAdjective}_${randomNoun}${Math.floor(Math.random() * 100)}`;
};

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
  nickname,
  onNicknameChange,
  onGenerateNickname,
  onSubmit
}) => (
  <div className="name-input-container">
    <h2>Welcome!</h2>
    <div className="input-group">
      <div className="nickname-input-container">
        <input
          type="text"
          placeholder="Enter your nickname *"
          value={nickname}
          onChange={onNicknameChange}
          required
          className="nickname-input"
        />
        <button
          className="generate-nickname-button"
          onClick={onGenerateNickname}
          title="Generate random nickname"
        >
          🎲
        </button>
      </div>
      <button
        onClick={onSubmit}
        disabled={!nickname.trim()}
      >
        Continue
      </button>
    </div>
  </div>
));

// Функция для генерации случайного цвета для аватарки
const getRandomColor = () => {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA5A5', '#A5FFD6',
    '#A5D1FF', '#FFA5E0', '#DEFF5C', '#FF5C5C', '#5CE1FF'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

// Компонент для отображения аватарки участника
const ParticipantAvatar = ({ userName, userId, currentUserId }) => {
  // Используем первую букву имени для аватарки
  const displayName = userName && userName !== 'Аноним' ? userName : 'Аноним';
  const initials = displayName !== 'Аноним' ? displayName.charAt(0).toUpperCase() : '?';

  // Генерируем цвет на основе userId для постоянства
  const color = useMemo(() => {
    const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA5A5', '#A5FFD6',
      '#A5D1FF', '#FFA5E0', '#DEFF5C', '#FF5C5C', '#5CE1FF'
    ];
    return colors[hash % colors.length];
  }, [userId]);

  return (
    <div
      className="participant-item"
    >
      <div
        className="participant-avatar"
        style={{
          backgroundColor: color,
          border: currentUserId === userId ? '2px solid #fff' : 'none'
        }}
      >
        {initials}
      </div>
      <div className="participant-name">
        {displayName}
        {currentUserId === userId && ' (Вы)'}
      </div>
    </div>
  );
};

// Компонент для отображения списка участников
const ParticipantsList = ({ participants, currentUserId }) => {
  return (
    <div className="participants-list">
      {participants.map(participant => (
        <ParticipantAvatar
          key={participant.userId}
          userName={participant.userName}
          userId={participant.userId}
          currentUserId={currentUserId}
        />
      ))}
    </div>
  );
};

// Компонент для отображения выделения текста другими пользователями
const SelectionDecoration = React.memo(({ selection, color, userName }) => {
  return (
    <div
      style={{
        position: 'absolute',
        top: selection.startLineNumber - 1,
        left: selection.startColumn - 1,
        width: selection.endColumn - selection.startColumn + 2,
        height: selection.endLineNumber - selection.startLineNumber + 1,
        backgroundColor: color,
        opacity: 0.2,
        pointerEvents: 'none'
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '2px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: color,
              marginRight: '4px'
            }}
          ></div>
          <span style={{ fontSize: '12px', color: '#fff' }}>{userName}</span>
        </div>
        <div style={{ fontSize: '12px', color: '#ccc' }}>
          {selection.startLineNumber} - {selection.endLineNumber}
        </div>
      </div>
    </div>
  );
});

// Добавляем компонент для отображения курсора другого пользователя
const RemoteCursor = React.memo(({ position, color, userName }) => {
  return (
    <div
      style={{
        position: 'absolute',
        top: position.lineNumber - 1,
        left: position.column - 1,
        width: '2px',
        height: '18px',
        backgroundColor: color,
        opacity: 0.8,
        pointerEvents: 'none',
        zIndex: 100
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '-18px',
          left: '0',
          fontSize: '12px',
          padding: '2px 4px',
          borderRadius: '4px',
          backgroundColor: color,
          color: '#fff',
          whiteSpace: 'nowrap',
          pointerEvents: 'none'
        }}
      >
        {userName}
      </div>
    </div>
  );
});

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
  const [userName, setUserName] = useState(Cookies.get(COOKIE_NICKNAME) || '');
  const [userSurname, setUserSurname] = useState('');
  const [isNameSet, setIsNameSet] = useState(!!Cookies.get(COOKIE_NICKNAME));
  const [participants, setParticipants] = useState([]);

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected to server');

      // Отправляем имя пользователя при подключении
      if (userName) {
        const fullName = userSurname ? `${userName} ${userSurname}` : userName;
        socket.emit('set_user_name', { fullName });
      }
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setError('Ошибка подключения к серверу');
    });

    socket.on('code_update', (newCode) => {
      // Сохраняем текущую позицию курсора перед обновлением кода
      const currentPosition = editorInstance?.getPosition();

      // Обновляем код
      setCode(newCode);

      // Восстанавливаем позицию курсора после обновления кода
      if (currentPosition && editorInstance) {
        setTimeout(() => {
          editorInstance.setPosition(currentPosition);
          editorInstance.revealPositionInCenter(currentPosition);
        }, 0);
      }
    });

    socket.on('session_joined', (sessionData) => {
      console.log('Joined session, received data:', sessionData);

      // Сохраняем текущую позицию курсора перед обновлением кода
      const currentPosition = editorInstance?.getPosition();

      // Обновляем код и язык
      setCode(sessionData.code);
      setLanguage(sessionData.language);

      // Восстанавливаем позицию курсора после обновления кода
      if (currentPosition && editorInstance) {
        setTimeout(() => {
          editorInstance.setPosition(currentPosition);
          editorInstance.revealPositionInCenter(currentPosition);
        }, 0);
      }
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

    socket.on('user_disconnected', ({ userId }) => {
      setSelections(prev => {
        const newSelections = { ...prev };
        delete newSelections[userId];
        return newSelections;
      });
    });

    socket.on('participants_update', (participantsInfo) => {
      console.log('Participants update:', participantsInfo);

      setParticipants(prevParticipants => {
        // Создаем карту существующих участников с их именами
        const existingParticipantsMap = {};
        prevParticipants.forEach(p => {
          if (p.userName && p.userName !== 'Аноним') {
            existingParticipantsMap[p.userId] = p.userName;
          }
        });

        // Обновляем список, сохраняя имена существующих участников
        return participantsInfo.map(participant => {
          // Если это текущий пользователь, всегда используем его текущее имя
          if (participant.userId === socket.id) {
            const fullName = userSurname ? `${userName} ${userSurname}` : userName;
            return {
              ...participant,
              userName: fullName || 'Аноним'
            };
          }

          // Если у участника уже есть имя, отличное от 'Аноним', используем его
          if (participant.userName && participant.userName !== 'Аноним') {
            return participant;
          }

          // Если у нас есть сохраненное имя для этого участника, используем его
          if (existingParticipantsMap[participant.userId]) {
            return {
              ...participant,
              userName: existingParticipantsMap[participant.userId]
            };
          }

          // В противном случае используем имя из обновления
          return participant;
        });
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
      socket.off('user_disconnected');
      socket.off('participants_update');
    };
  }, [userName, userSurname]);

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
    // Формируем полное имя пользователя
    const fullName = userSurname ? `${userName} ${userSurname}` : userName;

    // Отправляем имя на сервер перед созданием сессии
    socket.emit('set_user_name', { fullName });

    // Создаем сессию
    socket.emit('create_session', language);

    // Добавляем текущего пользователя в список участников
    setParticipants([{
      userId: socket.id,
      userName: fullName || 'Аноним'
    }]);
  };

  const handleJoinSession = (e) => {
    e.preventDefault();
    console.log('Joining session:', joinSessionId);
    if (!joinSessionId) {
      setError('Введите ID сессии');
      return;
    }

    // Формируем полное имя пользователя
    const fullName = userSurname ? `${userName} ${userSurname}` : userName;

    // Отправляем имя на сервер перед присоединением к сессии
    socket.emit('set_user_name', { fullName });

    // Присоединяемся к сессии
    socket.emit('join_session', joinSessionId);
    setSessionId(joinSessionId);
    setError(null);

    // Добавляем текущего пользователя в список участников
    setParticipants(prevParticipants => {
      // Проверяем, есть ли уже текущий пользователь в списке
      const userExists = prevParticipants.some(p => p.userId === socket.id);
      if (userExists) {
        // Обновляем имя пользователя, если он уже в списке
        return prevParticipants.map(p =>
          p.userId === socket.id
            ? { ...p, userName: fullName || 'Аноним' }
            : p
        );
      } else {
        // Добавляем пользователя, если его нет в списке
        return [...prevParticipants, {
          userId: socket.id,
          userName: fullName || 'Аноним'
        }];
      }
    });
  };

  const handleSessionIdChange = (e) => {
    setJoinSessionId(e.target.value);
    setError(null);
  };

  const handleCodeChange = (newCode) => {
    console.log('Code changed');

    // Сохраняем текущую позицию курсора перед обновлением кода
    const currentPosition = editorInstance?.getPosition();

    // Обновляем код
    setCode(newCode);

    // Отправляем изменения на сервер
    socket.emit('code_change', { sessionId, code: newCode });

    // Восстанавливаем позицию курсора после обновления кода
    if (currentPosition && editorInstance) {
      setTimeout(() => {
        editorInstance.setPosition(currentPosition);
        editorInstance.revealPositionInCenter(currentPosition);
      }, 0);
    }
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
  const handleEditorDidMount = useCallback((editor, monaco) => {
    setEditorInstance(editor);
    window.monacoInstance = monaco;
    setIsEditorReady(true);

    // Добавляем флаг для отслеживания, было ли изменение курсора вызвано программно
    let isLocalSelectionChange = true;

    // Добавляем обработчик изменения курсора
    editor.onDidChangeCursorSelection((e) => {
      // Проверяем, что изменение курсора было вызвано пользователем, а не программно
      if (sessionId && isLocalSelectionChange) {
        // Создаем объект выделения
        const selection = {
          startLineNumber: e.selection.startLineNumber,
          startColumn: e.selection.startColumn,
          endLineNumber: e.selection.endLineNumber,
          endColumn: e.selection.endColumn
        };

        // Формируем полное имя пользователя
        const fullName = userSurname ? `${userName} ${userSurname}` : userName;

        // Отправляем информацию о выделении на сервер
        socket.emit('selection_change', {
          sessionId,
          selection,
          userName: fullName || 'Аноним'
        });
      }
      // Сбрасываем флаг после обработки события
      isLocalSelectionChange = true;
    });

    // Добавляем обработчик для отображения курсоров других пользователей
    socket.on('selection_update', ({ userId, selection }) => {
      // Не перемещаем курсор текущего пользователя, только отображаем курсоры других
      if (userId !== socket.id) {
        // Обновляем состояние selections для отображения курсоров других пользователей
        setSelections(prev => ({
          ...prev,
          [userId]: selection
        }));
      }
    });

    // Отписываемся от события при размонтировании компонента
    return () => {
      socket.off('selection_update');
    };
  }, [sessionId, userName, userSurname]);

  const handleEditorWillMount = useCallback((monaco) => {
    // Определяем тему редактора
    monaco.editor.defineTheme('custom-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#1e1e1e',
        'editor.foreground': '#d4d4d4',
        'editor.lineHighlightBackground': '#2a2a2a',
        'editor.selectionBackground': '#264f78',
        'editor.inactiveSelectionBackground': '#3a3d41'
      }
    });

    // Устанавливаем тему
    monaco.editor.setTheme('custom-dark');

    // Добавляем автодополнение для JavaScript
    monaco.languages.registerCompletionItemProvider('javascript', {
      provideCompletionItems: (model, position) => {
    // Добавляем типы данных и их методы для JavaScript
    const jsTypes = {
      'Array': [
        { name: 'push', snippet: 'push(${1:item})' },
        { name: 'pop', snippet: 'pop()' },
        { name: 'shift', snippet: 'shift()' },
        { name: 'unshift', snippet: 'unshift(${1:item})' },
        { name: 'slice', snippet: 'slice(${1:start}, ${2:end})' },
        { name: 'splice', snippet: 'splice(${1:start}, ${2:deleteCount}, ${3:items})' },
        { name: 'forEach', snippet: 'forEach((${1:item}) => {\n\t${2}\n})' },
        { name: 'map', snippet: 'map((${1:item}) => {\n\t${2}\n\treturn ${3:item};\n})' },
        { name: 'filter', snippet: 'filter((${1:item}) => {\n\t${2}\n\treturn ${3:condition};\n})' },
        { name: 'reduce', snippet: 'reduce((${1:accumulator}, ${2:current}) => {\n\t${3}\n\treturn ${4:accumulator};\n}, ${5:initialValue})' },
      ],
      'String': [
        { name: 'charAt', snippet: 'charAt(${1:index})' },
        { name: 'concat', snippet: 'concat(${1:string})' },
        { name: 'includes', snippet: 'includes(${1:searchString})' },
        { name: 'indexOf', snippet: 'indexOf(${1:searchValue})' },
        { name: 'lastIndexOf', snippet: 'lastIndexOf(${1:searchValue})' },
        { name: 'match', snippet: 'match(${1:regexp})' },
        { name: 'replace', snippet: 'replace(${1:searchValue}, ${2:replaceValue})' },
        { name: 'slice', snippet: 'slice(${1:start}, ${2:end})' },
        { name: 'split', snippet: 'split(${1:separator})' },
        { name: 'substring', snippet: 'substring(${1:start}, ${2:end})' },
        { name: 'toLowerCase', snippet: 'toLowerCase()' },
        { name: 'toUpperCase', snippet: 'toUpperCase()' },
        { name: 'trim', snippet: 'trim()' },
        { name: 'length', snippet: 'length' }
      ],
      'Object': [
        { name: 'keys', snippet: 'keys(${1:obj})' },
        { name: 'values', snippet: 'values(${1:obj})' },
        { name: 'entries', snippet: 'entries(${1:obj})' },
        { name: 'assign', snippet: 'assign(${1:target}, ${2:source})' },
        { name: 'hasOwnProperty', snippet: 'hasOwnProperty(${1:prop})' },
        { name: 'toString', snippet: 'toString()' }
      ],
      'Number': [
        { name: 'toFixed', snippet: 'toFixed(${1:digits})' },
        { name: 'toPrecision', snippet: 'toPrecision(${1:precision})' },
        { name: 'toString', snippet: 'toString(${1:radix})' },
        { name: 'valueOf', snippet: 'valueOf()' }
      ],
      'Promise': [
        { name: 'then', snippet: 'then((${1:result}) => {\n\t${2}\n})' },
        { name: 'catch', snippet: 'catch((${1:error}) => {\n\t${2}\n})' },
        { name: 'finally', snippet: 'finally(() => {\n\t${1}\n})' }
      ]
    };

        const suggestions = [
          // ... существующий код ...
        ];
        return { suggestions };
      }
    });
  }, []);

  const handleEditorValidation = useCallback((markers) => {
    // Обработка ошибок валидации кода
    markers.forEach((marker) => console.log('Validation:', marker.message));
  }, []);

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
        if (!selection || userId === socket.id) return; // Не отображаем свой собственный курсор

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
              stickiness: window.monacoInstance.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
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

      // Формируем полное имя пользователя
      const fullName = userSurname ? `${userName} ${userSurname}` : userName;

      // Отправляем имя на сервер
      socket.emit('set_user_name', { fullName });
      console.log('Отправлено имя пользователя:', fullName);

      // Если пользователь уже в сессии, обновляем его имя в списке участников
      if (sessionId) {
        setParticipants(prevParticipants => {
          return prevParticipants.map(p =>
            p.userId === socket.id
              ? { ...p, userName: fullName }
              : p
          );
        });

        // Если пользователь уже в сессии, отправляем обновление выделения с новым именем
        if (editorInstance) {
          const selection = editorInstance.getSelection();
          if (selection) {
            socket.emit('selection_change', {
              sessionId,
              selection: {
                startLineNumber: selection.startLineNumber,
                startColumn: selection.startColumn,
                endLineNumber: selection.endLineNumber,
                endColumn: selection.endColumn
              },
              userName: fullName
            });
          }
        }
      }

      // Сохраняем в куки
      Cookies.set(COOKIE_NICKNAME, userName, { expires: COOKIE_EXPIRES });
    }
  }, [userName, userSurname, sessionId, editorInstance]);

  const handleNameChange = useCallback((e) => {
    setUserName(e.target.value);
  }, []);

  // Функция для выхода (очистка данных)
  const handleLogout = useCallback(() => {
    Cookies.remove(COOKIE_NICKNAME);
    setUserName('');
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
          nickname={userName}
          onNicknameChange={handleNameChange}
          onGenerateNickname={() => {
            const newName = generateRandomNickname();
            setUserName(newName);
            // Если пользователь уже подключен, отправляем имя на сервер
            if (socket.connected) {
              socket.emit('set_user_name', { fullName: newName });
            }
          }}
          onSubmit={handleNameSubmit}
        />
      ) : (
        <>
          <div className="user-info">
            <span>{userName}</span>
            <button onClick={handleLogout} className="logout-button">
              <span className="icon">🚪</span>
              Logout
            </button>
          </div>
          {!sessionId ? (
            <div className="session-controls">
              <p>
                Create a new session or join an existing one
              </p>
              <div className="input-group">
                <button onClick={createSession} className="create-button">
                  <span className="icon">➕</span>
                  Create Session
                </button>
                <div className="or-divider">or</div>
                <form onSubmit={handleJoinSession}>
                  <input
                    placeholder="Session ID"
                    value={joinSessionId}
                    onChange={handleSessionIdChange}
                  />
                  <button
                    type="submit"
                    className="join-button"
                    disabled={!joinSessionId.trim()}
                  >
                    <span className="icon">➜</span>
                    Join
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="editor-container">
              <div className="editor-header">
                <div className="editor-language">
                  <select
                    value={language}
                    onChange={handleLanguageChange}
                    disabled={!sessionId}
                  >
                  {languages.map(lang => (
                    <option key={lang.id} value={lang.id}>
                      {lang.name}
                    </option>
                  ))}
                </select>
              </div>
                <div className="participants-container">
                  <ParticipantsList
                    participants={participants}
                    currentUserId={socket.id}
                  />
                </div>
                <div className="editor-actions">
                  <button
                    className="btn btn-primary"
                    onClick={executeCode}
                    disabled={isExecuting || !code.trim()}
                  >
                    <span className="icon">▶️</span>
                    {isExecuting ? 'Выполнение...' : 'Выполнить'}
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={downloadCode}
                    disabled={!code.trim()}
                  >
                    <span className="icon">💾</span>
                    Скачать
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={handleShare}
                    disabled={!sessionId}
                  >
                    <span className="icon">🔗</span>
                    Поделиться
                  </button>
                </div>
              </div>

              <div className="editor-output-container">
                  <div className="monaco-editor-container">
                    <MonacoEditor
                      height="100%"
                      language={language}
                      value={code}
                      onChange={handleCodeChange}
                      onMount={handleEditorDidMount}
                      beforeMount={handleEditorWillMount}
                      theme="vs-dark"
                      options={{
                        minimap: { enabled: true },
                        scrollBeyondLastLine: false,
                        fontSize: 14,
                        fontFamily: "'Fira Code', monospace",
                        automaticLayout: true,
                        tabSize: 2,
                        wordWrap: 'on',
                        quickSuggestions: true,
                        suggestOnTriggerCharacters: true,
                        acceptSuggestionOnEnter: 'on',
                        snippetSuggestions: 'top',
                        cursorSmoothCaretAnimation: 'on',
                        cursorBlinking: 'smooth',
                        renderWhitespace: 'selection',
                        autoClosingBrackets: 'always',
                        autoClosingQuotes: 'always',
                        autoSurround: 'languageDefined',
                        readOnly: false,
                        disableLayerHinting: true,
                        hideCursorInOverviewRuler: false,
                        overviewRulerBorder: false,
                        renderLineHighlight: 'all',
                        renderLineHighlightOnlyWhenFocus: false,
                        suggest: {
                          showKeywords: true,
                          showSnippets: true,
                          showClasses: true,
                          showFunctions: true,
                          showVariables: true,
                          showWords: true,
                          showMethods: true,
                          showProperties: true
                        }
                      }}
                    />
                  </div>

                <div className="output-container">
                <div className="output-panel">
                  <pre className="output-content">{output || 'Здесь появится результат выполнения кода'}</pre>
                  </div>
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