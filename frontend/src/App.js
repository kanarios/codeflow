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
const COOKIE_NICKNAME = 'userNickname';
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
    // Определяем тему редактора
    monaco.editor.defineTheme('custom-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#1e1e1e',
      }
    });

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
        { name: 'find', snippet: 'find((${1:item}) => {\n\t${2}\n\treturn ${3:condition};\n})' },
        { name: 'some', snippet: 'some((${1:item}) => {\n\t${2}\n\treturn ${3:condition};\n})' },
        { name: 'every', snippet: 'every((${1:item}) => {\n\t${2}\n\treturn ${3:condition};\n})' },
        { name: 'sort', snippet: 'sort((${1:a}, ${2:b}) => {\n\t${3}\n\treturn ${4:a - b};\n})' },
        { name: 'join', snippet: 'join(${1:separator})' },
        { name: 'length', snippet: 'length' }
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

    // Добавляем типы данных и их методы для Python
    const pythonTypes = {
      'list': [
        { name: 'append', snippet: 'append(${1:item})' },
        { name: 'extend', snippet: 'extend(${1:iterable})' },
        { name: 'insert', snippet: 'insert(${1:index}, ${2:item})' },
        { name: 'remove', snippet: 'remove(${1:item})' },
        { name: 'pop', snippet: 'pop(${1:index})' },
        { name: 'clear', snippet: 'clear()' },
        { name: 'index', snippet: 'index(${1:item})' },
        { name: 'count', snippet: 'count(${1:item})' },
        { name: 'sort', snippet: 'sort(${1:key}=${2:None}, ${3:reverse}=${4:False})' },
        { name: 'reverse', snippet: 'reverse()' },
        { name: 'copy', snippet: 'copy()' }
      ],
      'dict': [
        { name: 'keys', snippet: 'keys()' },
        { name: 'values', snippet: 'values()' },
        { name: 'items', snippet: 'items()' },
        { name: 'get', snippet: 'get(${1:key}, ${2:default}=${3:None})' },
        { name: 'update', snippet: 'update(${1:other})' },
        { name: 'pop', snippet: 'pop(${1:key})' },
        { name: 'popitem', snippet: 'popitem()' },
        { name: 'clear', snippet: 'clear()' },
        { name: 'copy', snippet: 'copy()' },
        { name: 'setdefault', snippet: 'setdefault(${1:key}, ${2:default}=${3:None})' }
      ],
      'str': [
        { name: 'capitalize', snippet: 'capitalize()' },
        { name: 'casefold', snippet: 'casefold()' },
        { name: 'center', snippet: 'center(${1:width})' },
        { name: 'count', snippet: 'count(${1:sub})' },
        { name: 'encode', snippet: 'encode(${1:encoding}=${2:"utf-8"})' },
        { name: 'endswith', snippet: 'endswith(${1:suffix})' },
        { name: 'expandtabs', snippet: 'expandtabs(${1:tabsize}=${2:8})' },
        { name: 'find', snippet: 'find(${1:sub})' },
        { name: 'format', snippet: 'format(${1:args})' },
        { name: 'index', snippet: 'index(${1:sub})' },
        { name: 'isalnum', snippet: 'isalnum()' },
        { name: 'isalpha', snippet: 'isalpha()' },
        { name: 'isdecimal', snippet: 'isdecimal()' },
        { name: 'isdigit', snippet: 'isdigit()' },
        { name: 'islower', snippet: 'islower()' },
        { name: 'isnumeric', snippet: 'isnumeric()' },
        { name: 'isspace', snippet: 'isspace()' },
        { name: 'istitle', snippet: 'istitle()' },
        { name: 'isupper', snippet: 'isupper()' },
        { name: 'join', snippet: 'join(${1:iterable})' },
        { name: 'ljust', snippet: 'ljust(${1:width})' },
        { name: 'lower', snippet: 'lower()' },
        { name: 'lstrip', snippet: 'lstrip()' },
        { name: 'replace', snippet: 'replace(${1:old}, ${2:new})' },
        { name: 'rfind', snippet: 'rfind(${1:sub})' },
        { name: 'rindex', snippet: 'rindex(${1:sub})' },
        { name: 'rjust', snippet: 'rjust(${1:width})' },
        { name: 'rstrip', snippet: 'rstrip()' },
        { name: 'split', snippet: 'split(${1:sep}=${2:None})' },
        { name: 'splitlines', snippet: 'splitlines()' },
        { name: 'startswith', snippet: 'startswith(${1:prefix})' },
        { name: 'strip', snippet: 'strip()' },
        { name: 'swapcase', snippet: 'swapcase()' },
        { name: 'title', snippet: 'title()' },
        { name: 'upper', snippet: 'upper()' }
      ],
      'set': [
        { name: 'add', snippet: 'add(${1:elem})' },
        { name: 'clear', snippet: 'clear()' },
        { name: 'copy', snippet: 'copy()' },
        { name: 'difference', snippet: 'difference(${1:other_set})' },
        { name: 'difference_update', snippet: 'difference_update(${1:other_set})' },
        { name: 'discard', snippet: 'discard(${1:elem})' },
        { name: 'intersection', snippet: 'intersection(${1:other_set})' },
        { name: 'intersection_update', snippet: 'intersection_update(${1:other_set})' },
        { name: 'isdisjoint', snippet: 'isdisjoint(${1:other_set})' },
        { name: 'issubset', snippet: 'issubset(${1:other_set})' },
        { name: 'issuperset', snippet: 'issuperset(${1:other_set})' },
        { name: 'pop', snippet: 'pop()' },
        { name: 'remove', snippet: 'remove(${1:elem})' },
        { name: 'symmetric_difference', snippet: 'symmetric_difference(${1:other_set})' },
        { name: 'symmetric_difference_update', snippet: 'symmetric_difference_update(${1:other_set})' },
        { name: 'union', snippet: 'union(${1:other_set})' },
        { name: 'update', snippet: 'update(${1:other_set})' }
      ],
      'tuple': [
        { name: 'count', snippet: 'count(${1:value})' },
        { name: 'index', snippet: 'index(${1:value})' }
      ],
      'int': [
        { name: 'bit_length', snippet: 'bit_length()' },
        { name: 'to_bytes', snippet: 'to_bytes(${1:length}, ${2:byteorder})' },
        { name: 'from_bytes', snippet: 'from_bytes(${1:bytes}, ${2:byteorder})' }
      ],
      'float': [
        { name: 'as_integer_ratio', snippet: 'as_integer_ratio()' },
        { name: 'is_integer', snippet: 'is_integer()' },
        { name: 'hex', snippet: 'hex()' }
      ],
      'bool': [
        { name: '__and__', snippet: '__and__(${1:other})' },
        { name: '__or__', snippet: '__or__(${1:other})' },
        { name: '__xor__', snippet: '__xor__(${1:other})' }
      ],
      'bytes': [
        { name: 'decode', snippet: 'decode(${1:encoding}=${2:"utf-8"})' },
        { name: 'fromhex', snippet: 'fromhex(${1:string})' },
        { name: 'hex', snippet: 'hex()' }
      ],
      'bytearray': [
        { name: 'append', snippet: 'append(${1:item})' },
        { name: 'extend', snippet: 'extend(${1:iterable})' },
        { name: 'insert', snippet: 'insert(${1:index}, ${2:item})' },
        { name: 'remove', snippet: 'remove(${1:item})' },
        { name: 'pop', snippet: 'pop(${1:index})' },
        { name: 'clear', snippet: 'clear()' },
        { name: 'decode', snippet: 'decode(${1:encoding}=${2:"utf-8"})' }
      ],
      'complex': [
        { name: 'real', snippet: 'real' },
        { name: 'imag', snippet: 'imag' },
        { name: 'conjugate', snippet: 'conjugate()' }
      ],
      'frozenset': [
        { name: 'copy', snippet: 'copy()' },
        { name: 'difference', snippet: 'difference(${1:other_set})' },
        { name: 'intersection', snippet: 'intersection(${1:other_set})' },
        { name: 'isdisjoint', snippet: 'isdisjoint(${1:other_set})' },
        { name: 'issubset', snippet: 'issubset(${1:other_set})' },
        { name: 'issuperset', snippet: 'issuperset(${1:other_set})' },
        { name: 'symmetric_difference', snippet: 'symmetric_difference(${1:other_set})' },
        { name: 'union', snippet: 'union(${1:other_set})' }
      ],
      'range': [
        { name: 'start', snippet: 'start' },
        { name: 'stop', snippet: 'stop' },
        { name: 'step', snippet: 'step' }
      ],
      'memoryview': [
        { name: 'tobytes', snippet: 'tobytes()' },
        { name: 'tolist', snippet: 'tolist()' },
        { name: 'hex', snippet: 'hex()' }
      ],
      'datetime': [
        { name: 'now', snippet: 'now()' },
        { name: 'today', snippet: 'today()' },
        { name: 'strftime', snippet: 'strftime(${1:format})' },
        { name: 'strptime', snippet: 'strptime(${1:date_string}, ${2:format})' },
        { name: 'timestamp', snippet: 'timestamp()' },
        { name: 'date', snippet: 'date()' },
        { name: 'time', snippet: 'time()' },
        { name: 'replace', snippet: 'replace(${1:year}=${2:self.year})' },
        { name: 'weekday', snippet: 'weekday()' },
        { name: 'isoformat', snippet: 'isoformat()' }
      ],
      'date': [
        { name: 'today', snippet: 'today()' },
        { name: 'fromtimestamp', snippet: 'fromtimestamp(${1:timestamp})' },
        { name: 'strftime', snippet: 'strftime(${1:format})' },
        { name: 'replace', snippet: 'replace(${1:year}=${2:self.year})' },
        { name: 'weekday', snippet: 'weekday()' },
        { name: 'isoformat', snippet: 'isoformat()' }
      ],
      'time': [
        { name: 'strftime', snippet: 'strftime(${1:format})' },
        { name: 'replace', snippet: 'replace(${1:hour}=${2:self.hour})' },
        { name: 'isoformat', snippet: 'isoformat()' }
      ],
      'timedelta': [
        { name: 'total_seconds', snippet: 'total_seconds()' },
        { name: 'days', snippet: 'days' },
        { name: 'seconds', snippet: 'seconds' },
        { name: 'microseconds', snippet: 'microseconds' }
      ],
      'numpy.ndarray': [
        { name: 'shape', snippet: 'shape' },
        { name: 'size', snippet: 'size' },
        { name: 'ndim', snippet: 'ndim' },
        { name: 'dtype', snippet: 'dtype' },
        { name: 'T', snippet: 'T' },
        { name: 'reshape', snippet: 'reshape(${1:newshape})' },
        { name: 'flatten', snippet: 'flatten()' },
        { name: 'transpose', snippet: 'transpose()' },
        { name: 'sum', snippet: 'sum(${1:axis}=${2:None})' },
        { name: 'mean', snippet: 'mean(${1:axis}=${2:None})' },
        { name: 'min', snippet: 'min(${1:axis}=${2:None})' },
        { name: 'max', snippet: 'max(${1:axis}=${2:None})' },
        { name: 'argmin', snippet: 'argmin(${1:axis}=${2:None})' },
        { name: 'argmax', snippet: 'argmax(${1:axis}=${2:None})' },
        { name: 'copy', snippet: 'copy()' },
        { name: 'fill', snippet: 'fill(${1:value})' },
        { name: 'tolist', snippet: 'tolist()' }
      ],
      'pandas.DataFrame': [
        { name: 'head', snippet: 'head(${1:n}=${2:5})' },
        { name: 'tail', snippet: 'tail(${1:n}=${2:5})' },
        { name: 'info', snippet: 'info()' },
        { name: 'describe', snippet: 'describe()' },
        { name: 'shape', snippet: 'shape' },
        { name: 'columns', snippet: 'columns' },
        { name: 'index', snippet: 'index' },
        { name: 'dtypes', snippet: 'dtypes' },
        { name: 'values', snippet: 'values' },
        { name: 'sort_values', snippet: 'sort_values(${1:by})' },
        { name: 'sort_index', snippet: 'sort_index()' },
        { name: 'groupby', snippet: 'groupby(${1:by})' },
        { name: 'merge', snippet: 'merge(${1:right}, ${2:how}=${3:"inner"})' },
        { name: 'join', snippet: 'join(${1:other})' },
        { name: 'drop', snippet: 'drop(${1:labels})' },
        { name: 'dropna', snippet: 'dropna()' },
        { name: 'fillna', snippet: 'fillna(${1:value})' },
        { name: 'apply', snippet: 'apply(${1:func})' },
        { name: 'applymap', snippet: 'applymap(${1:func})' },
        { name: 'copy', snippet: 'copy()' },
        { name: 'corr', snippet: 'corr()' },
        { name: 'count', snippet: 'count()' },
        { name: 'nunique', snippet: 'nunique()' },
        { name: 'idxmax', snippet: 'idxmax()' },
        { name: 'idxmin', snippet: 'idxmin()' },
        { name: 'to_csv', snippet: 'to_csv(${1:path_or_buf}=${2:None})' },
        { name: 'to_excel', snippet: 'to_excel(${1:excel_writer})' },
        { name: 'to_json', snippet: 'to_json(${1:path_or_buf}=${2:None})' },
        { name: 'to_dict', snippet: 'to_dict()' }
      ],
      'pandas.Series': [
        { name: 'head', snippet: 'head(${1:n}=${2:5})' },
        { name: 'tail', snippet: 'tail(${1:n}=${2:5})' },
        { name: 'value_counts', snippet: 'value_counts()' },
        { name: 'unique', snippet: 'unique()' },
        { name: 'nunique', snippet: 'nunique()' },
        { name: 'describe', snippet: 'describe()' },
        { name: 'mean', snippet: 'mean()' },
        { name: 'median', snippet: 'median()' },
        { name: 'mode', snippet: 'mode()' },
        { name: 'min', snippet: 'min()' },
        { name: 'max', snippet: 'max()' },
        { name: 'sum', snippet: 'sum()' },
        { name: 'count', snippet: 'count()' },
        { name: 'apply', snippet: 'apply(${1:func})' },
        { name: 'map', snippet: 'map(${1:arg})' },
        { name: 'sort_values', snippet: 'sort_values()' },
        { name: 'sort_index', snippet: 'sort_index()' },
        { name: 'reset_index', snippet: 'reset_index()' },
        { name: 'dropna', snippet: 'dropna()' },
        { name: 'fillna', snippet: 'fillna(${1:value})' },
        { name: 'isna', snippet: 'isna()' },
        { name: 'notna', snippet: 'notna()' },
        { name: 'to_frame', snippet: 'to_frame()' },
        { name: 'to_list', snippet: 'to_list()' }
      ]
    };

    // Регистрируем провайдер автокомплита для JavaScript с поддержкой типов данных
    monaco.languages.registerCompletionItemProvider('javascript', {
      triggerCharacters: ['.'],
      provideCompletionItems: (model, position) => {
        const textUntilPosition = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column
        });

        const match = textUntilPosition.match(/(\w+)\.\s*$/);
        if (!match) {
          return { suggestions: [] };
        }

        const varName = match[1];
        let varType = null;

        // Простой анализ типа переменной на основе объявления
        const fileContent = model.getValue();
        const varDeclarations = [
          // Массивы
          { regex: new RegExp(`(const|let|var)\\s+${varName}\\s*=\\s*\\[`, 'i'), type: 'Array' },
          // Строки
          { regex: new RegExp(`(const|let|var)\\s+${varName}\\s*=\\s*['"\`]`, 'i'), type: 'String' },
          // Объекты
          { regex: new RegExp(`(const|let|var)\\s+${varName}\\s*=\\s*\\{`, 'i'), type: 'Object' },
          // Числа
          { regex: new RegExp(`(const|let|var)\\s+${varName}\\s*=\\s*\\d`, 'i'), type: 'Number' },
          // Промисы
          { regex: new RegExp(`(const|let|var)\\s+${varName}\\s*=\\s*(new\\s+Promise|fetch|axios)`, 'i'), type: 'Promise' }
        ];

        for (const decl of varDeclarations) {
          if (decl.regex.test(fileContent)) {
            varType = decl.type;
            break;
          }
        }

        if (!varType) {
          return { suggestions: [] };
        }

        const methods = jsTypes[varType] || [];
        const suggestions = methods.map(method => ({
          label: method.name,
          kind: monaco.languages.CompletionItemKind.Method,
          insertText: method.snippet,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: `${varType}.${method.name}`,
          documentation: `Метод типа ${varType}`
        }));

        return { suggestions };
      }
    });

    // Регистрируем провайдер автокомплита для Python с поддержкой типов данных
    monaco.languages.registerCompletionItemProvider('python', {
      triggerCharacters: ['.'],
      provideCompletionItems: (model, position) => {
        const textUntilPosition = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column
        });

        const match = textUntilPosition.match(/(\w+)\.\s*$/);
        if (!match) {
          return { suggestions: [] };
        }

        const varName = match[1];
        let varType = null;

        // Простой анализ типа переменной на основе объявления
        const fileContent = model.getValue();
        const varDeclarations = [
          // Списки
          { regex: new RegExp(`${varName}\\s*=\\s*\\[`, 'i'), type: 'list' },
          { regex: new RegExp(`${varName}\\s*:\\s*list`, 'i'), type: 'list' },
          // Словари
          { regex: new RegExp(`${varName}\\s*=\\s*\\{`, 'i'), type: 'dict' },
          { regex: new RegExp(`${varName}\\s*:\\s*dict`, 'i'), type: 'dict' },
          // Строки
          { regex: new RegExp(`${varName}\\s*=\\s*['"\`]`, 'i'), type: 'str' },
          { regex: new RegExp(`${varName}\\s*:\\s*str`, 'i'), type: 'str' },
          // Множества
          { regex: new RegExp(`${varName}\\s*=\\s*set\\(`, 'i'), type: 'set' },
          { regex: new RegExp(`${varName}\\s*:\\s*set`, 'i'), type: 'set' },
          // Кортежи
          { regex: new RegExp(`${varName}\\s*=\\s*\\(`, 'i'), type: 'tuple' },
          { regex: new RegExp(`${varName}\\s*=\\s*tuple\\(`, 'i'), type: 'tuple' },
          { regex: new RegExp(`${varName}\\s*:\\s*tuple`, 'i'), type: 'tuple' },
          // Целые числа
          { regex: new RegExp(`${varName}\\s*=\\s*\\d+[^.]`, 'i'), type: 'int' },
          { regex: new RegExp(`${varName}\\s*=\\s*int\\(`, 'i'), type: 'int' },
          { regex: new RegExp(`${varName}\\s*:\\s*int`, 'i'), type: 'int' },
          // Числа с плавающей точкой
          { regex: new RegExp(`${varName}\\s*=\\s*\\d+\\.\\d*`, 'i'), type: 'float' },
          { regex: new RegExp(`${varName}\\s*=\\s*float\\(`, 'i'), type: 'float' },
          { regex: new RegExp(`${varName}\\s*:\\s*float`, 'i'), type: 'float' },
          // Логические значения
          { regex: new RegExp(`${varName}\\s*=\\s*(True|False)`, 'i'), type: 'bool' },
          { regex: new RegExp(`${varName}\\s*=\\s*bool\\(`, 'i'), type: 'bool' },
          { regex: new RegExp(`${varName}\\s*:\\s*bool`, 'i'), type: 'bool' },
          // Байты
          { regex: new RegExp(`${varName}\\s*=\\s*b['"\`]`, 'i'), type: 'bytes' },
          { regex: new RegExp(`${varName}\\s*=\\s*bytes\\(`, 'i'), type: 'bytes' },
          { regex: new RegExp(`${varName}\\s*:\\s*bytes`, 'i'), type: 'bytes' },
          // Массив байтов
          { regex: new RegExp(`${varName}\\s*=\\s*bytearray\\(`, 'i'), type: 'bytearray' },
          { regex: new RegExp(`${varName}\\s*:\\s*bytearray`, 'i'), type: 'bytearray' },
          // Комплексные числа
          { regex: new RegExp(`${varName}\\s*=\\s*\\d+[\\+\\-]\\d*j`, 'i'), type: 'complex' },
          { regex: new RegExp(`${varName}\\s*=\\s*complex\\(`, 'i'), type: 'complex' },
          { regex: new RegExp(`${varName}\\s*:\\s*complex`, 'i'), type: 'complex' },
          // Неизменяемые множества
          { regex: new RegExp(`${varName}\\s*=\\s*frozenset\\(`, 'i'), type: 'frozenset' },
          { regex: new RegExp(`${varName}\\s*:\\s*frozenset`, 'i'), type: 'frozenset' },
          // Диапазоны
          { regex: new RegExp(`${varName}\\s*=\\s*range\\(`, 'i'), type: 'range' },
          { regex: new RegExp(`${varName}\\s*:\\s*range`, 'i'), type: 'range' },
          // Представления памяти
          { regex: new RegExp(`${varName}\\s*=\\s*memoryview\\(`, 'i'), type: 'memoryview' },
          { regex: new RegExp(`${varName}\\s*:\\s*memoryview`, 'i'), type: 'memoryview' },
          // Дата и время
          { regex: new RegExp(`${varName}\\s*=\\s*datetime\\.`, 'i'), type: 'datetime' },
          { regex: new RegExp(`${varName}\\s*:\\s*datetime`, 'i'), type: 'datetime' },
          // Дата
          { regex: new RegExp(`${varName}\\s*=\\s*date\\.`, 'i'), type: 'date' },
          { regex: new RegExp(`${varName}\\s*:\\s*date`, 'i'), type: 'date' },
          // Время
          { regex: new RegExp(`${varName}\\s*=\\s*time\\.`, 'i'), type: 'time' },
          { regex: new RegExp(`${varName}\\s*:\\s*time`, 'i'), type: 'time' },
          // Разница во времени
          { regex: new RegExp(`${varName}\\s*=\\s*timedelta\\(`, 'i'), type: 'timedelta' },
          { regex: new RegExp(`${varName}\\s*:\\s*timedelta`, 'i'), type: 'timedelta' },
          // NumPy массивы
          { regex: new RegExp(`${varName}\\s*=\\s*np\\.array\\(`, 'i'), type: 'numpy.ndarray' },
          { regex: new RegExp(`${varName}\\s*=\\s*numpy\\.array\\(`, 'i'), type: 'numpy.ndarray' },
          { regex: new RegExp(`${varName}\\s*:\\s*np\\.ndarray`, 'i'), type: 'numpy.ndarray' },
          { regex: new RegExp(`${varName}\\s*:\\s*numpy\\.ndarray`, 'i'), type: 'numpy.ndarray' },
          // Pandas DataFrame
          { regex: new RegExp(`${varName}\\s*=\\s*pd\\.DataFrame\\(`, 'i'), type: 'pandas.DataFrame' },
          { regex: new RegExp(`${varName}\\s*=\\s*pandas\\.DataFrame\\(`, 'i'), type: 'pandas.DataFrame' },
          { regex: new RegExp(`${varName}\\s*:\\s*pd\\.DataFrame`, 'i'), type: 'pandas.DataFrame' },
          { regex: new RegExp(`${varName}\\s*:\\s*pandas\\.DataFrame`, 'i'), type: 'pandas.DataFrame' },
          // Pandas Series
          { regex: new RegExp(`${varName}\\s*=\\s*pd\\.Series\\(`, 'i'), type: 'pandas.Series' },
          { regex: new RegExp(`${varName}\\s*=\\s*pandas\\.Series\\(`, 'i'), type: 'pandas.Series' },
          { regex: new RegExp(`${varName}\\s*:\\s*pd\\.Series`, 'i'), type: 'pandas.Series' },
          { regex: new RegExp(`${varName}\\s*:\\s*pandas\\.Series`, 'i'), type: 'pandas.Series' }
        ];

        for (const decl of varDeclarations) {
          if (decl.regex.test(fileContent)) {
            varType = decl.type;
            break;
          }
        }

        if (!varType) {
          return { suggestions: [] };
        }

        const methods = pythonTypes[varType] || [];
        const suggestions = methods.map(method => ({
          label: method.name,
          kind: monaco.languages.CompletionItemKind.Method,
          insertText: method.snippet,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: `${varType}.${method.name}`,
          documentation: `Метод типа ${varType}`
        }));

        return { suggestions };
      }
    });

    // Настройка автокомплита для JavaScript
    monaco.languages.registerCompletionItemProvider('javascript', {
      provideCompletionItems: (model, position) => {
        const suggestions = [
          {
            label: 'console.log',
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: 'console.log($1);',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Выводит сообщение в консоль'
          },
          {
            label: 'function',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'function ${1:name}(${2:params}) {\n\t${3}\n}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Объявление функции'
          },
          {
            label: 'if',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'if (${1:condition}) {\n\t${2}\n}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Условный оператор if'
          },
          {
            label: 'for',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'for (let ${1:i} = 0; ${1:i} < ${2:array}.length; ${1:i}++) {\n\t${3}\n}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Цикл for'
          }
        ];
        return { suggestions };
      }
    });

    // Настройка автокомплита для Python
    monaco.languages.registerCompletionItemProvider('python', {
      provideCompletionItems: (model, position) => {
        const suggestions = [
          {
            label: 'print',
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: 'print($1)',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Выводит сообщение в консоль'
          },
          {
            label: 'def',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'def ${1:name}(${2:params}):\n\t${3:pass}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Объявление функции'
          },
          {
            label: 'if',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'if ${1:condition}:\n\t${2:pass}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Условный оператор if'
          },
          {
            label: 'for',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'for ${1:item} in ${2:items}:\n\t${3:pass}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Цикл for'
          },
          // Декораторы
          {
            label: '@dataclass',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '@dataclass\nclass ${1:ClassName}:\n\t${2:field_name}: ${3:type} = ${4:default_value}\n\t${5}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Декоратор dataclass из модуля dataclasses'
          },
          {
            label: '@property',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '@property\ndef ${1:property_name}(self):\n\t${2:pass}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Декоратор property для создания свойств класса'
          },
          {
            label: '@staticmethod',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '@staticmethod\ndef ${1:method_name}(${2:params}):\n\t${3:pass}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Декоратор staticmethod для создания статических методов'
          },
          {
            label: '@classmethod',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '@classmethod\ndef ${1:method_name}(cls, ${2:params}):\n\t${3:pass}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Декоратор classmethod для создания методов класса'
          },
          {
            label: '@abstractmethod',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '@abstractmethod\ndef ${1:method_name}(self, ${2:params}):\n\t${3:pass}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Декоратор abstractmethod из модуля abc для создания абстрактных методов'
          },
          {
            label: '@lru_cache',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '@lru_cache(maxsize=${1:None})\ndef ${2:function_name}(${3:params}):\n\t${4:pass}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Декоратор lru_cache из модуля functools для кэширования результатов функции'
          },
          {
            label: '@contextmanager',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '@contextmanager\ndef ${1:function_name}(${2:params}):\n\ttry:\n\t\t${3:yield resource}\n\tfinally:\n\t\t${4:cleanup}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Декоратор contextmanager из модуля contextlib для создания контекстных менеджеров'
          },
          {
            label: '@wraps',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '@wraps(${1:wrapped_function})\ndef ${2:wrapper}(${3:params}):\n\t${4:pass}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Декоратор wraps из модуля functools для сохранения метаданных функции'
          },
          {
            label: '@pytest.fixture',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '@pytest.fixture\ndef ${1:fixture_name}(${2:params}):\n\t${3:pass}\n\treturn ${4:value}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Декоратор fixture из модуля pytest для создания фикстур'
          },
          {
            label: '@pytest.mark.parametrize',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '@pytest.mark.parametrize("${1:param}", [${2:values}])\ndef ${3:test_name}(${4:params}):\n\t${5:pass}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Декоратор parametrize из модуля pytest для параметризации тестов'
          },
          {
            label: '@app.route',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '@app.route("/${1:path}", methods=[${2:"GET"}])\ndef ${3:view_function}(${4:params}):\n\t${5:pass}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Декоратор route из Flask для определения маршрутов'
          },
          {
            label: '@login_required',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '@login_required\ndef ${1:view_function}(${2:params}):\n\t${3:pass}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Декоратор login_required из Flask-Login для защиты маршрутов'
          },
          {
            label: '@api_view',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '@api_view([${1:"GET"}])\ndef ${2:view_function}(${3:request}):\n\t${4:pass}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Декоратор api_view из Django REST framework для определения API-представлений'
          },
          {
            label: '@receiver',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '@receiver(${1:signal})\ndef ${2:receiver_function}(${3:sender}, ${4:**kwargs}):\n\t${5:pass}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Декоратор receiver из Django для обработки сигналов'
          },
          {
            label: '@asyncio.coroutine',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '@asyncio.coroutine\ndef ${1:coroutine_function}(${2:params}):\n\t${3:pass}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Декоратор coroutine из модуля asyncio для создания корутин (устаревший, используйте async def)'
          },
          {
            label: '@async_timeout',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'async with async_timeout.timeout(${1:timeout}):\n\t${2:pass}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Контекстный менеджер timeout из модуля async_timeout для ограничения времени выполнения асинхронного кода'
          },
          {
            label: '@cached_property',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '@cached_property\ndef ${1:property_name}(self):\n\t${2:pass}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Декоратор cached_property из модуля functools для создания кэшируемых свойств'
          },
          {
            label: '@total_ordering',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '@total_ordering\nclass ${1:ClassName}:\n\t${2:pass}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Декоратор total_ordering из модуля functools для автоматического создания методов сравнения'
          },
          {
            label: '@singledispatch',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '@singledispatch\ndef ${1:function_name}(${2:arg}):\n\t${3:pass}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Декоратор singledispatch из модуля functools для создания функций с перегрузкой по типу аргумента'
          },
          {
            label: '@singledispatchmethod',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '@singledispatchmethod\ndef ${1:method_name}(self, ${2:arg}):\n\t${3:pass}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Декоратор singledispatchmethod из модуля functools для создания методов с перегрузкой по типу аргумента'
          },
          // Дополнительные сниппеты для Python
          {
            label: 'class',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'class ${1:ClassName}:\n\tdef __init__(self, ${2:params}):\n\t\t${3:pass}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Объявление класса'
          },
          {
            label: 'with',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'with ${1:expression} as ${2:target}:\n\t${3:pass}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Оператор with для работы с контекстными менеджерами'
          },
          {
            label: 'try-except',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'try:\n\t${1:pass}\nexcept ${2:Exception} as ${3:e}:\n\t${4:pass}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Блок try-except для обработки исключений'
          },
          {
            label: 'try-except-finally',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'try:\n\t${1:pass}\nexcept ${2:Exception} as ${3:e}:\n\t${4:pass}\nfinally:\n\t${5:pass}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Блок try-except-finally для обработки исключений с блоком finally'
          },
          {
            label: 'async def',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'async def ${1:function_name}(${2:params}):\n\t${3:pass}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Объявление асинхронной функции'
          },
          {
            label: 'await',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'await ${1:coroutine}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Оператор await для ожидания завершения корутины'
          },
          {
            label: 'async for',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'async for ${1:item} in ${2:async_iterable}:\n\t${3:pass}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Асинхронный цикл for'
          },
          {
            label: 'async with',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'async with ${1:expression} as ${2:target}:\n\t${3:pass}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Асинхронный оператор with'
          },
          {
            label: 'lambda',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'lambda ${1:params}: ${2:expression}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Лямбда-выражение'
          },
          {
            label: 'list comprehension',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '[${1:expression} for ${2:item} in ${3:iterable}]',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Списковое включение'
          },
          {
            label: 'dict comprehension',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '{${1:key}: ${2:value} for ${3:item} in ${4:iterable}}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Словарное включение'
          },
          {
            label: 'set comprehension',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '{${1:expression} for ${2:item} in ${3:iterable}}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Множественное включение'
          },
          {
            label: 'generator expression',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '(${1:expression} for ${2:item} in ${3:iterable})',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Генераторное выражение'
          }
        ];
        return { suggestions };
      }
    });

    // Настройка автокомплита для TypeScript
    monaco.languages.registerCompletionItemProvider('typescript', {
      provideCompletionItems: (model, position) => {
        const suggestions = [
          {
            label: 'console.log',
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: 'console.log($1);',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Выводит сообщение в консоль'
          },
          {
            label: 'interface',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'interface ${1:Name} {\n\t${2:property}: ${3:type};\n}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Объявление интерфейса'
          },
          {
            label: 'class',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'class ${1:Name} {\n\tconstructor(${2:params}) {\n\t\t${3}\n\t}\n}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Объявление класса'
          },
          {
            label: 'arrow function',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '(${1:params}) => {\n\t${2}\n}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Стрелочная функция'
          }
        ];
        return { suggestions };
      }
    });

    // Настройка автокомплита для Java
    monaco.languages.registerCompletionItemProvider('java', {
      provideCompletionItems: (model, position) => {
        const suggestions = [
          {
            label: 'System.out.println',
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: 'System.out.println($1);',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Выводит сообщение в консоль'
          },
          {
            label: 'class',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'public class ${1:Name} {\n\t${2}\n}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Объявление класса'
          },
          {
            label: 'main',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'public static void main(String[] args) {\n\t${1}\n}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Метод main'
          },
          {
            label: 'for',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'for (int ${1:i} = 0; ${1:i} < ${2:length}; ${1:i}++) {\n\t${3}\n}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Цикл for'
          }
        ];
        return { suggestions };
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
      socket.emit('set_user_name', { fullName: userName });
      // Сохраняем в куки
      Cookies.set(COOKIE_NICKNAME, userName, { expires: COOKIE_EXPIRES });
    }
  }, [userName]);

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
          onGenerateNickname={() => setUserName(generateRandomNickname())}
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
                        ursorSmoothCaretAnimation: 'on',
                        cursorBlinking: 'smooth',
                        renderWhitespace: 'selection',
                        autoClosingBrackets: 'always',
                        autoClosingQuotes: 'always',
                        autoSurround: 'languageDefined',
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