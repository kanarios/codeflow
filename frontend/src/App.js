import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { io } from 'socket.io-client';
import MonacoEditor from '@monaco-editor/react';
import { useLocation, useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';
import './editor.css';
import './App.css';
import { RemoteCursorManager, RemoteSelectionManager } from '@convergencelabs/monaco-collab-ext';

const BACKEND_URL = process.env.NODE_ENV === 'production'
  ? window.location.origin
  : (process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001');

// Constants for cookies
const COOKIE_NICKNAME = 'codeflow_nickname';
const COOKIE_CONSENT = 'codeflow_cookie_consent';
const COOKIE_EXPIRES = 1; // 1 day

// Arrays for generating random nicknames
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

// Function for generating random nickname
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

// Component outside the main component
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

// Function for generating random avatar color
const getRandomColor = () => {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA5A5', '#A5FFD6',
    '#A5D1FF', '#FFA5E0', '#DEFF5C', '#FF5C5C', '#5CE1FF'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

// Component for displaying participant avatar
const ParticipantAvatar = ({ userName, userId, currentUserId }) => {
  // Use the first letter of the name for the avatar
  const displayName = userName && userName !== 'Anonymous' ? userName : 'Anonymous';
  const initials = displayName !== 'Anonymous' ? displayName.charAt(0).toUpperCase() : '?';

  // Generate color based on userId for consistency
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
        {currentUserId === userId && ' (You)'}
      </div>
    </div>
  );
};

// Component for displaying participants list
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

// Component for displaying text selection by other users
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

// Component for Cookie Banner
const CookieBanner = ({ onClose }) => {
  return (
    <div className="cookie-banner">
      <div className="cookie-content">
        <p>Это приложение использует файлы cookie для сохранения вашего никнейма и обеспечения лучшего опыта использования.</p>
      </div>
      <button className="cookie-close" onClick={onClose} aria-label="Закрыть" title="Закрыть">
        ✕
      </button>
    </div>
  );
};

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
  const remoteCursorManagerRef = useRef(null);
  const remoteSelectionManagerRef = useRef(null);
  const [showCookieBanner, setShowCookieBanner] = useState(false);

  // Check cookie consent on component mount
  useEffect(() => {
    const cookieConsent = Cookies.get(COOKIE_CONSENT);
    if (!cookieConsent) {
      setShowCookieBanner(true);
    }
  }, []);

  // Handle closing the cookie banner
  const handleCookieConsent = () => {
    Cookies.set(COOKIE_CONSENT, 'true', { expires: 365 }); // Cookie consent valid for 1 year
    setShowCookieBanner(false);
  };

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected to server');

      // Send user name when connecting
      if (userName) {
        const fullName = userSurname ? `${userName} ${userSurname}` : userName;
        socket.emit('set_user_name', { fullName });
      }
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setError('Connection error');
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
      setOutput(`Error: ${error}`);
      setIsExecuting(false);
    });

    socket.on('session_created', (id) => {
      console.log('Session created:', id);
      setSessionId(id);
      setError(null);
    });

    socket.on('selection_update', ({ userId, selection, userName }) => {
      // Update selections for tracking
      setSelections(prev => ({
        ...prev,
        [userId]: selection
      }));

      // Check if managers and editor are initialized
      if (!remoteCursorManagerRef.current || !remoteSelectionManagerRef.current || !editorInstance) {
        return;
      }

      try {
        // Update remote cursor
        const remoteCursor = remoteCursorManagerRef.current.addCursor(
          userId,
          getColorForIndex(userId.charCodeAt(0) % 4),
          userName || userId.slice(0, 6)
        );

        // Set cursor position at the end of selection
        if (remoteCursor && selection) {
          remoteCursor.setOffset(selection.endLineNumber, selection.endColumn);
        }

        // Update remote selection
        if (selection && (selection.startLineNumber !== selection.endLineNumber || selection.startColumn !== selection.endColumn)) {
          const remoteSelection = remoteSelectionManagerRef.current.addSelection(
            userId,
            getColorForIndex(userId.charCodeAt(0) % 4)
          );

          if (remoteSelection) {
            remoteSelection.setOffsets(
              selection.startLineNumber, selection.startColumn,
              selection.endLineNumber, selection.endColumn
            );
          }
        } else {
          // Check if selection exists before it's removed
          try {
            remoteSelectionManagerRef.current.removeSelection(userId);
          } catch (e) {
            console.log(`Selection for user ${userId} not found:`, e.message);
          }
        }
      } catch (e) {
        console.log(`Error updating cursor/selection for ${userId}:`, e.message);
      }
    });

    socket.on('user_disconnected', ({ userId }) => {
      setSelections(prev => {
        const newSelections = { ...prev };
        delete newSelections[userId];
        return newSelections;
      });

      // Check if managers are initialized
      if (!remoteCursorManagerRef.current || !remoteSelectionManagerRef.current) {
        return;
      }

      try {
        if (remoteCursorManagerRef.current) {
          try {
            remoteCursorManagerRef.current.removeCursor(userId);
          } catch (e) {
            console.log(`Cursor for user ${userId} not found:`, e.message);
          }
        }

        if (remoteSelectionManagerRef.current) {
          try {
            remoteSelectionManagerRef.current.removeSelection(userId);
          } catch (e) {
            console.log(`Selection for user ${userId} not found:`, e.message);
          }
        }
      } catch (e) {
        console.log(`Error removing cursor/selection for ${userId}:`, e.message);
      }
    });

    socket.on('participants_update', (participantsInfo) => {
      console.log('Participants update:', participantsInfo);

      setParticipants(prevParticipants => {
        // Create map of existing participants with their names
        const existingParticipantsMap = {};
        prevParticipants.forEach(p => {
          if (p.userName && p.userName !== 'Anonymous') {
            existingParticipantsMap[p.userId] = p.userName;
          }
        });

        // Update list, keeping names of existing participants
        return participantsInfo.map(participant => {
          // If this is the current user, always use their current name
          if (participant.userId === socket.id) {
            const fullName = userSurname ? `${userName} ${userSurname}` : userName;
            return {
              ...participant,
              userName: fullName || 'Anonymous'
            };
          }

          // If participant already has a name, use it
          if (participant.userName && participant.userName !== 'Anonymous') {
            return participant;
          }

          // If we have a saved name for this participant, use it
          if (existingParticipantsMap[participant.userId]) {
            return {
              ...participant,
              userName: existingParticipantsMap[participant.userId]
            };
          }

          // Otherwise use name from update
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
      socket.off('selection_update');
      socket.off('user_disconnected');
      socket.off('participants_update');

      // Clear resources of cursor and selection managers
      // Check if managers are initialized
      if (!remoteCursorManagerRef.current || !remoteSelectionManagerRef.current) {
        return;
      }

      try {
        // Get all cursor identifiers and remove them
        if (selections) {
          Object.keys(selections).forEach(userId => {
            try {
              remoteCursorManagerRef.current.removeCursor(userId);
            } catch (e) {
              console.log(`Cursor for user ${userId} not found:`, e.message);
            }

            try {
              remoteSelectionManagerRef.current.removeSelection(userId);
            } catch (e) {
              console.log(`Selection for user ${userId} not found:`, e.message);
            }
          });
        }
      } catch (e) {
        console.log('Error clearing resources of cursor and selection managers:', e.message);
      }
    };
  }, [userName, userSurname, editorInstance, selections]);

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
    // Form full name of user
    const fullName = userSurname ? `${userName} ${userSurname}` : userName;

    // Send name to server before creating session
    socket.emit('set_user_name', { fullName });

    // Create session
    socket.emit('create_session', language);

    // Add current user to participants list
    setParticipants([{
      userId: socket.id,
      userName: fullName || 'Anonymous'
    }]);
  };

  const handleJoinSession = (e) => {
    e.preventDefault();
    console.log('Joining session:', joinSessionId);
    if (!joinSessionId) {
      setError('Enter session ID');
      return;
    }

    // Form full name of user
    const fullName = userSurname ? `${userName} ${userSurname}` : userName;

    // Send name to server before joining session
    socket.emit('set_user_name', { fullName });

    // Join session
    socket.emit('join_session', joinSessionId);
    setSessionId(joinSessionId);
    setError(null);

    // Add current user to participants list
    setParticipants(prevParticipants => {
      // Check if current user already exists in list
      const userExists = prevParticipants.some(p => p.userId === socket.id);
      if (userExists) {
        // Update user name if already in list
        return prevParticipants.map(p =>
          p.userId === socket.id
            ? { ...p, userName: fullName || 'Anonymous' }
            : p
        );
      } else {
        // Add user if not in list
        return [...prevParticipants, {
          userId: socket.id,
          userName: fullName || 'Anonymous'
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
    setCode(newCode);
    socket.emit('code_change', { sessionId, code: newCode });
  };

  const executeCode = () => {
    if (!code.trim()) {
      setError('Write code before execution');
      setTimeout(() => setError(null), 3000); // Hide error after 3 seconds
      return;
    }

    console.log('Executing code:', code);
    setIsExecuting(true);
    setOutput('Executing...');
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

  // Hotkey handler
  const handleKeyPress = useCallback((event) => {
    // Ctrl/Cmd + Enter to run code
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      if (!isExecuting && code.trim()) executeCode();
    }
    // Ctrl/Cmd + S to save code to file
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault();
      downloadCode();
    }
  }, [isExecuting, code]);

  // Register hotkey handler
  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  // Function to save code
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

  // Get file extension based on language
  const getFileExtension = (lang) => {
    const extensions = {
      javascript: 'js',
      python: 'py',
      ruby: 'rb',
      java: 'java'
    };
    return extensions[lang] || 'txt';
  };

  // Handler for editor initialization
  const handleEditorDidMount = useCallback((editor, monaco) => {
    setEditorInstance(editor);
    window.monacoInstance = monaco;
    setIsEditorReady(true);

    // Add handler for key events to solve Python autocompletion issue
    editor.onKeyDown((e) => {
      if (e.keyCode === monaco.KeyCode.Period) { // Code for dot
        // Get current position and line content
        const position = editor.getPosition();
        const model = editor.getModel();
        if (position && model) {
          const lineContent = model.getLineContent(position.lineNumber);
          // Check if there's `[]` before current position
          const textBeforeCursor = lineContent.substring(0, position.column - 1).trimRight();
          if (textBeforeCursor.endsWith('[]')) {
            // After user inputs dot, artificially trigger autocompletion
            setTimeout(() => {
              editor.trigger('python-autocomplete', 'editor.action.triggerSuggest', {});
            }, 50);
          }
        }
      }
    });

    // Initialize remote cursor manager
    remoteCursorManagerRef.current = new RemoteCursorManager({
      editor: editor,
      tooltipDuration: 2000,
      remoteCursorColorSeed: 'cursor'
    });

    // Initialize remote selection manager
    remoteSelectionManagerRef.current = new RemoteSelectionManager({
      editor: editor,
      selectionColorSeed: 'selection'
    });

    // Add existing cursors and selections if they exist
    if (selections && Object.keys(selections).length > 0) {
      Object.entries(selections).forEach(([userId, selection]) => {
        try {
          const remoteCursor = remoteCursorManagerRef.current.addCursor(
            userId,
            getColorForIndex(userId.charCodeAt(0) % 4),
            userId.slice(0, 6)
          );

          if (remoteCursor && selection) {
            remoteCursor.setOffset(selection.endLineNumber, selection.endColumn);
          }

          if (selection && (selection.startLineNumber !== selection.endLineNumber || selection.startColumn !== selection.endColumn)) {
            const remoteSelection = remoteSelectionManagerRef.current.addSelection(
              userId,
              getColorForIndex(userId.charCodeAt(0) % 4)
            );

            if (remoteSelection) {
              remoteSelection.setOffsets(
                selection.startLineNumber, selection.startColumn,
                selection.endLineNumber, selection.endColumn
              );
            }
          }
        } catch (e) {
          console.log(`Error adding cursor/selection for ${userId}:`, e.message);
        }
      });
    }

    editor.onDidChangeCursorSelection((e) => {
      if (sessionId) {
        const selection = {
          startLineNumber: e.selection.startLineNumber,
          startColumn: e.selection.startColumn,
          endLineNumber: e.selection.endLineNumber,
          endColumn: e.selection.endColumn
        };

        // Form full name of user
        const fullName = userSurname ? `${userName} ${userSurname}` : userName;

        // Send selection with user name
        socket.emit('selection_change', {
          sessionId,
          selection,
          userName: fullName || 'Anonymous'
        });
      }
    });
  }, [sessionId, userName, userSurname, selections]);

  const handleEditorWillMount = useCallback((monaco) => {
    // Define editor theme
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

    // Set theme
    monaco.editor.setTheme('custom-dark');

    // Add autocompletion for JavaScript
    monaco.languages.registerCompletionItemProvider('javascript', {
      triggerCharacters: ['.'],
      provideCompletionItems: (model, position) => {
        // Add JavaScript data types and their methods
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
          // ... existing code ...
        ];
        return { suggestions };
      }
    });

    // Add autocompletion for Python
    monaco.languages.registerCompletionItemProvider('python', {
      triggerCharacters: ['.'],
      provideCompletionItems: (model, position) => {
        // Get current line up to cursor
        const textUntilPosition = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column
        });

        // Define Python data types and their methods
        const pythonTypes = {
          'list': [
            { name: 'append', snippet: 'append(${1:item})' },
            { name: 'clear', snippet: 'clear()' },
            { name: 'copy', snippet: 'copy()' },
            { name: 'count', snippet: 'count(${1:value})' },
            { name: 'extend', snippet: 'extend(${1:iterable})' },
            { name: 'index', snippet: 'index(${1:value})' },
            { name: 'insert', snippet: 'insert(${1:index}, ${2:item})' },
            { name: 'pop', snippet: 'pop(${1:index})' },
            { name: 'remove', snippet: 'remove(${1:value})' },
            { name: 'reverse', snippet: 'reverse()' },
            { name: 'sort', snippet: 'sort()' }
          ],
          'str': [
            { name: 'capitalize', snippet: 'capitalize()' },
            { name: 'center', snippet: 'center(${1:width})' },
            { name: 'count', snippet: 'count(${1:sub})' },
            { name: 'encode', snippet: 'encode(${1:encoding})' },
            { name: 'endswith', snippet: 'endswith(${1:suffix})' },
            { name: 'find', snippet: 'find(${1:sub})' },
            { name: 'format', snippet: 'format(${1:args})' },
            { name: 'index', snippet: 'index(${1:sub})' },
            { name: 'isalnum', snippet: 'isalnum()' },
            { name: 'isalpha', snippet: 'isalpha()' },
            { name: 'isdigit', snippet: 'isdigit()' },
            { name: 'islower', snippet: 'islower()' },
            { name: 'isupper', snippet: 'isupper()' },
            { name: 'join', snippet: 'join(${1:iterable})' },
            { name: 'lower', snippet: 'lower()' },
            { name: 'replace', snippet: 'replace(${1:old}, ${2:new})' },
            { name: 'split', snippet: 'split(${1:separator})' },
            { name: 'startswith', snippet: 'startswith(${1:prefix})' },
            { name: 'strip', snippet: 'strip()' },
            { name: 'upper', snippet: 'upper()' }
          ],
          'dict': [
            { name: 'clear', snippet: 'clear()' },
            { name: 'copy', snippet: 'copy()' },
            { name: 'get', snippet: 'get(${1:key})' },
            { name: 'items', snippet: 'items()' },
            { name: 'keys', snippet: 'keys()' },
            { name: 'pop', snippet: 'pop(${1:key})' },
            { name: 'update', snippet: 'update(${1:other})' },
            { name: 'values', snippet: 'values()' }
          ],
          'set': [
            { name: 'add', snippet: 'add(${1:elem})' },
            { name: 'clear', snippet: 'clear()' },
            { name: 'copy', snippet: 'copy()' },
            { name: 'difference', snippet: 'difference(${1:other_set})' },
            { name: 'discard', snippet: 'discard(${1:elem})' },
            { name: 'intersection', snippet: 'intersection(${1:other_set})' },
            { name: 'issubset', snippet: 'issubset(${1:other_set})' },
            { name: 'issuperset', snippet: 'issuperset(${1:other_set})' },
            { name: 'pop', snippet: 'pop()' },
            { name: 'remove', snippet: 'remove(${1:elem})' },
            { name: 'union', snippet: 'union(${1:other_set})' }
          ]
        };

        // Simple check for "a = []." pattern
        const currentLine = model.getLineContent(position.lineNumber);
        const emptyListDotPattern = /(\w+)\s*=\s*\[\]\.?/;
        const emptyListMatch = currentLine.match(emptyListDotPattern);

        // Checks for empty list
        const hasDotAtPosition = currentLine.substring(0, position.column).endsWith('.');
        const isAfterEmptyList = currentLine.substring(0, position.column-1).trimEnd().endsWith('[]');
        const isJustAfterDot = position.column > 0 && currentLine.charAt(position.column - 1) === '.';
        const lineContainsEmptyList = currentLine.includes('[]');

        // Quick check for case a = [].
        if ((emptyListMatch && hasDotAtPosition) ||
            (lineContainsEmptyList && isAfterEmptyList && isJustAfterDot) ||
            (currentLine.includes('[]') && currentLine.indexOf('[]') < position.column &&
             currentLine.indexOf('.', currentLine.indexOf('[]')) < position.column &&
             currentLine.indexOf('.', currentLine.indexOf('[]')) > currentLine.indexOf('[]'))) {
          return {
            suggestions: pythonTypes['list'].map(item => ({
              label: item.name,
              kind: monaco.languages.CompletionItemKind.Method,
              insertText: item.snippet,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              detail: 'list - method'
            }))
          };
        }

        // Improved heuristics for determining type
        let suggestions = [];
        // Improved regular expressions for determining data types
        const listVarMatch = textUntilPosition.match(/(\w+)\s*=\s*\[.*?\]\.?$/);
        const emptyListAssignment = textUntilPosition.match(/(\w+)\s*=\s*\[\]/);
        const emptyListWithDot = textUntilPosition.match(/(\w+)\s*=\s*\[\]\.$/);
        const listLiteralDot = textUntilPosition.match(/\[.*?\]\.$/);
        const listVarDot = textUntilPosition.match(/(\w+)\.$/);

        // More precise determination of variable immediately before dot
        const lastWord = textUntilPosition.match(/(\w+)\.$/);
        const lastWordValue = lastWord ? lastWord[1] : '';

        // Check entire content of editor
        if (listVarDot && model) {
          const content = model.getValue();
          const varName = listVarDot[1];

          // Simple heuristic analysis - does any variable exist defined as list
          if (content.match(new RegExp(`${varName}\\s*=\\s*\\[`, 'g'))) {
            // If we found definition of variable as list, add this to state for future checks
            window._pythonVarTypes = window._pythonVarTypes || {};
            window._pythonVarTypes[varName] = 'list';
          }
        }

        // If this is list with dot at the end
        if (listVarMatch || listLiteralDot || emptyListWithDot ||
          textUntilPosition.endsWith('list().') ||
          textUntilPosition.match(/\w+\s*=\s*\[.*\].*\n.*\1\.$/s) ||
          (emptyListAssignment && lastWord && lastWord[1] === emptyListAssignment[1]) ||
          (lastWord && window._pythonVarTypes && window._pythonVarTypes[lastWord[1]] === 'list')) {
          pythonTypes['list'].forEach(item => {
            suggestions.push({
              label: item.name,
              kind: monaco.languages.CompletionItemKind.Method,
              insertText: item.snippet,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              detail: 'list - method'
            });
          });
        }

        const strVarMatch = textUntilPosition.match(/(\w+)\s*=\s*["'].*?["']\.?$/);
        const strLiteralDot = textUntilPosition.match(/["'].*?["']\.$/);

        // If this is string with dot at the end
        if (strVarMatch || strLiteralDot || textUntilPosition.endsWith('str().') || textUntilPosition.match(/\w+\s*=\s*["'].*["'].*\n.*\1\.$/s)) {
          pythonTypes['str'].forEach(item => {
            suggestions.push({
              label: item.name,
              kind: monaco.languages.CompletionItemKind.Method,
              insertText: item.snippet,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              detail: 'string - method'
            });
          });
        }

        const dictVarMatch = textUntilPosition.match(/(\w+)\s*=\s*\{.*?\}\.?$/);
        const dictLiteralDot = textUntilPosition.match(/\{.*?\}\.$/);

        // If this is dictionary with dot at the end
        if (dictVarMatch || dictLiteralDot || textUntilPosition.endsWith('dict().') || textUntilPosition.match(/\w+\s*=\s*\{.*\}.*\n.*\1\.$/s)) {
          pythonTypes['dict'].forEach(item => {
            suggestions.push({
              label: item.name,
              kind: monaco.languages.CompletionItemKind.Method,
              insertText: item.snippet,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              detail: 'dictionary - method'
            });
          });
        }

        // If we still don't have suggestions but have a variable before the dot
        if (suggestions.length === 0 && lastWord) {
          // Try to find variable definition in text above
          const fullText = model.getValue();

          // Search for variable definitions
          const listDef = new RegExp(`${lastWordValue}\\s*=\\s*\\[.*?\\]`, 'g');
          const emptyListDef = new RegExp(`${lastWordValue}\\s*=\\s*\\[\\]`, 'g');
          const strDef = new RegExp(`${lastWordValue}\\s*=\\s*["'].*?["']`, 'g');
          const dictDef = new RegExp(`${lastWordValue}\\s*=\\s*\\{.*?\\}`, 'g');
          const emptyDictDef = new RegExp(`${lastWordValue}\\s*=\\s*\\{\\}`, 'g');

          // Check type definition
          if (fullText.match(listDef) || fullText.match(emptyListDef) || fullText.match(new RegExp(`${lastWordValue}\\s*=\\s*list\\(`, 'g'))) {
            pythonTypes['list'].forEach(item => {
              suggestions.push({
                label: item.name,
                kind: monaco.languages.CompletionItemKind.Method,
                insertText: item.snippet,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                detail: 'list - method'
              });
            });
          } else if (fullText.match(strDef) || fullText.match(new RegExp(`${lastWordValue}\\s*=\\s*str\\(`, 'g'))) {
            pythonTypes['str'].forEach(item => {
              suggestions.push({
                label: item.name,
                kind: monaco.languages.CompletionItemKind.Method,
                insertText: item.snippet,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                detail: 'string - method'
              });
            });
          } else if (fullText.match(dictDef) || fullText.match(emptyDictDef) || fullText.match(new RegExp(`${lastWordValue}\\s*=\\s*dict\\(`, 'g'))) {
            pythonTypes['dict'].forEach(item => {
              suggestions.push({
                label: item.name,
                kind: monaco.languages.CompletionItemKind.Method,
                insertText: item.snippet,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                detail: 'dictionary - method'
              });
            });
          } else {
            // If no definition found, suggest all methods
            for (const type in pythonTypes) {
              pythonTypes[type].forEach(item => {
                suggestions.push({
                  label: item.name,
                  kind: monaco.languages.CompletionItemKind.Method,
                  insertText: item.snippet,
                  insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                  detail: `${type} - method (possibly)`
                });
              });
            }
          }
        }

        // Add Python built-in functions
        const builtinFunctions = [
          { name: 'abs', snippet: 'abs(${1:number})' },
          { name: 'all', snippet: 'all(${1:iterable})' },
          { name: 'any', snippet: 'any(${1:iterable})' },
          { name: 'bin', snippet: 'bin(${1:number})' },
          { name: 'bool', snippet: 'bool(${1:value})' },
          { name: 'chr', snippet: 'chr(${1:i})' },
          { name: 'dict', snippet: 'dict(${1:kwargs})' },
          { name: 'enumerate', snippet: 'enumerate(${1:iterable})' },
          { name: 'float', snippet: 'float(${1:value})' },
          { name: 'format', snippet: 'format(${1:value}, ${2:format_spec})' },
          { name: 'hex', snippet: 'hex(${1:number})' },
          { name: 'input', snippet: 'input(${1:prompt})' },
          { name: 'int', snippet: 'int(${1:value})' },
          { name: 'len', snippet: 'len(${1:obj})' },
          { name: 'list', snippet: 'list(${1:iterable})' },
          { name: 'max', snippet: 'max(${1:iterable})' },
          { name: 'min', snippet: 'min(${1:iterable})' },
          { name: 'open', snippet: 'open(${1:file}, ${2:mode})' },
          { name: 'ord', snippet: 'ord(${1:c})' },
          { name: 'pow', snippet: 'pow(${1:base}, ${2:exp})' },
          { name: 'print', snippet: 'print(${1:object})' },
          { name: 'range', snippet: 'range(${1:stop})' },
          { name: 'round', snippet: 'round(${1:number})' },
          { name: 'set', snippet: 'set(${1:iterable})' },
          { name: 'sorted', snippet: 'sorted(${1:iterable})' },
          { name: 'str', snippet: 'str(${1:object})' },
          { name: 'sum', snippet: 'sum(${1:iterable})' },
          { name: 'tuple', snippet: 'tuple(${1:iterable})' },
          { name: 'type', snippet: 'type(${1:object})' },
          { name: 'zip', snippet: 'zip(${1:iterables})' }
        ];

        // If no specific suggestions, add built-in functions
        if (suggestions.length === 0) {
          builtinFunctions.forEach(item => {
            suggestions.push({
              label: item.name,
              kind: monaco.languages.CompletionItemKind.Function,
              insertText: item.snippet,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              detail: 'built-in function'
            });
          });
        }

        return { suggestions };
      }
    });

    // Add autocompletion for TypeScript
    monaco.languages.registerCompletionItemProvider('typescript', {
      triggerCharacters: ['.'],
      provideCompletionItems: (model, position) => {
        // TypeScript data types and methods (including types from JavaScript)
        const tsTypes = {
          'Array': [
            { name: 'push', snippet: 'push(${1:item})' },
            { name: 'pop', snippet: 'pop()' },
            { name: 'shift', snippet: 'shift()' },
            { name: 'unshift', snippet: 'unshift(${1:item})' },
            { name: 'slice', snippet: 'slice(${1:start}, ${2:end})' },
            { name: 'splice', snippet: 'splice(${1:start}, ${2:deleteCount}, ${3:items})' },
            { name: 'forEach', snippet: 'forEach((${1:item}) => {\n\t${2}\n})' },
            { name: 'map', snippet: 'map<${1:ReturnType}>((${2:item}) => {\n\t${3}\n\treturn ${4:item};\n})' },
            { name: 'filter', snippet: 'filter((${1:item}) => {\n\t${2}\n\treturn ${3:condition};\n})' },
            { name: 'reduce', snippet: 'reduce((${1:accumulator}, ${2:current}) => {\n\t${3}\n\treturn ${4:accumulator};\n}, ${5:initialValue})' },
            { name: 'find', snippet: 'find((${1:item}) => {\n\t${2}\n\treturn ${3:condition};\n})' },
            { name: 'findIndex', snippet: 'findIndex((${1:item}) => {\n\t${2}\n\treturn ${3:condition};\n})' },
            { name: 'some', snippet: 'some((${1:item}) => {\n\t${2}\n\treturn ${3:condition};\n})' },
            { name: 'every', snippet: 'every((${1:item}) => {\n\t${2}\n\treturn ${3:condition};\n})' }
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
          'Promise': [
            { name: 'then', snippet: 'then<${1:ReturnType}>((${2:result}) => {\n\t${3}\n})' },
            { name: 'catch', snippet: 'catch((${1:error}) => {\n\t${2}\n})' },
            { name: 'finally', snippet: 'finally(() => {\n\t${1}\n})' }
          ],
          'Map': [
            { name: 'clear', snippet: 'clear()' },
            { name: 'delete', snippet: 'delete(${1:key})' },
            { name: 'get', snippet: 'get(${1:key})' },
            { name: 'has', snippet: 'has(${1:key})' },
            { name: 'set', snippet: 'set(${1:key}, ${2:value})' },
            { name: 'size', snippet: 'size' },
            { name: 'forEach', snippet: 'forEach((${1:value}, ${2:key}) => {\n\t${3}\n})' }
          ],
          'Set': [
            { name: 'add', snippet: 'add(${1:value})' },
            { name: 'clear', snippet: 'clear()' },
            { name: 'delete', snippet: 'delete(${1:value})' },
            { name: 'has', snippet: 'has(${1:value})' },
            { name: 'size', snippet: 'size' },
            { name: 'forEach', snippet: 'forEach((${1:value}) => {\n\t${2}\n})' }
          ]
        };

        // Standard TypeScript snippets
        const tsSnippets = [
          { name: 'interface', snippet: 'interface ${1:Name} {\n\t${2:property}: ${3:type};\n}' },
          { name: 'type', snippet: 'type ${1:Name} = ${2:Type};' },
          { name: 'class', snippet: 'class ${1:Name} {\n\t${2}\n}' },
          { name: 'enum', snippet: 'enum ${1:Name} {\n\t${2:Value1},\n\t${3:Value2}\n}' },
          { name: 'function', snippet: 'function ${1:name}(${2:params}): ${3:returnType} {\n\t${4}\n}' },
          { name: 'const', snippet: 'const ${1:name}: ${2:type} = ${3:value};' },
          { name: 'let', snippet: 'let ${1:name}: ${2:type} = ${3:value};' },
          { name: 'import', snippet: 'import { ${1:module} } from "${2:package}";' },
          { name: 'export', snippet: 'export ${1:declaration};' },
          { name: 'async', snippet: 'async ${1:name}(${2:params}): Promise<${3:returnType}> {\n\t${4}\n}' },
          { name: 'await', snippet: 'await ${1:promise};' },
          { name: 'try-catch', snippet: 'try {\n\t${1}\n} catch (${2:error}) {\n\t${3}\n}' }
        ];

        // Collect suggestions for autocompletion
        const suggestions = [];

        // Add all standard TypeScript snippets
        tsSnippets.forEach(item => {
          suggestions.push({
            label: item.name,
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: item.snippet,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: 'TypeScript snippet'
          });
        });

        // Add data type methods
        Object.keys(tsTypes).forEach(type => {
          tsTypes[type].forEach(item => {
            suggestions.push({
              label: item.name,
              kind: monaco.languages.CompletionItemKind.Method,
              insertText: item.snippet,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              detail: `${type} - method`
            });
          });
        });

        return { suggestions };
      }
    });

    // Add autocompletion for Ruby
    monaco.languages.registerCompletionItemProvider('ruby', {
      triggerCharacters: ['.'],
      provideCompletionItems: (model, position) => {
        // Ruby data types and methods
        const rubyTypes = {
          'Array': [
            { name: 'push', snippet: 'push(${1:item})' },
            { name: 'pop', snippet: 'pop' },
            { name: 'shift', snippet: 'shift' },
            { name: 'unshift', snippet: 'unshift(${1:item})' },
            { name: 'each', snippet: 'each do |${1:item}|\n\t${2}\nend' },
            { name: 'map', snippet: 'map do |${1:item}|\n\t${2}\nend' },
            { name: 'select', snippet: 'select do |${1:item}|\n\t${2}\nend' },
            { name: 'reject', snippet: 'reject do |${1:item}|\n\t${2}\nend' },
            { name: 'length', snippet: 'length' },
            { name: 'size', snippet: 'size' },
            { name: 'empty?', snippet: 'empty?' },
            { name: 'include?', snippet: 'include?(${1:item})' },
            { name: 'join', snippet: 'join(${1:separator})' },
            { name: 'first', snippet: 'first' },
            { name: 'last', snippet: 'last' }
          ],
          'String': [
            { name: 'length', snippet: 'length' },
            { name: 'size', snippet: 'size' },
            { name: 'upcase', snippet: 'upcase' },
            { name: 'downcase', snippet: 'downcase' },
            { name: 'capitalize', snippet: 'capitalize' },
            { name: 'gsub', snippet: 'gsub(${1:pattern}, ${2:replacement})' },
            { name: 'strip', snippet: 'strip' },
            { name: 'split', snippet: 'split(${1:separator})' },
            { name: 'include?', snippet: 'include?(${1:other_str})' },
            { name: 'start_with?', snippet: 'start_with?(${1:prefix})' },
            { name: 'end_with?', snippet: 'end_with?(${1:suffix})' },
            { name: 'empty?', snippet: 'empty?' }
          ],
          'Hash': [
            { name: 'each', snippet: 'each do |${1:key}, ${2:value}|\n\t${3}\nend' },
            { name: 'map', snippet: 'map do |${1:key}, ${2:value}|\n\t${3}\nend' },
            { name: 'keys', snippet: 'keys' },
            { name: 'values', snippet: 'values' },
            { name: 'length', snippet: 'length' },
            { name: 'size', snippet: 'size' },
            { name: 'empty?', snippet: 'empty?' },
            { name: 'has_key?', snippet: 'has_key?(${1:key})' },
            { name: 'key?', snippet: 'key?(${1:key})' },
            { name: 'has_value?', snippet: 'has_value?(${1:value})' },
            { name: 'value?', snippet: 'value?(${1:value})' },
            { name: 'merge', snippet: 'merge(${1:other_hash})' }
          ]
        };

        // Standard Ruby snippets
        const rubySnippets = [
          { name: 'class', snippet: 'class ${1:Name}\n\t${2}\nend' },
          { name: 'def', snippet: 'def ${1:method_name}\n\t${2}\nend' },
          { name: 'if', snippet: 'if ${1:condition}\n\t${2}\nend' },
          { name: 'unless', snippet: 'unless ${1:condition}\n\t${2}\nend' },
          { name: 'case', snippet: 'case ${1:value}\nwhen ${2:condition}\n\t${3}\nelse\n\t${4}\nend' },
          { name: 'puts', snippet: 'puts ${1}' },
          { name: 'attr_accessor', snippet: 'attr_accessor :${1:attribute}' },
          { name: 'attr_reader', snippet: 'attr_reader :${1:attribute}' },
          { name: 'attr_writer', snippet: 'attr_writer :${1:attribute}' },
          { name: 'require', snippet: 'require "${1:lib}"' },
          { name: 'module', snippet: 'module ${1:Name}\n\t${2}\nend' },
          { name: 'while', snippet: 'while ${1:condition}\n\t${2}\nend' },
          { name: 'until', snippet: 'until ${1:condition}\n\t${2}\nend' },
          { name: 'begin-rescue', snippet: 'begin\n\t${1}\nrescue ${2:Exception} => ${3:e}\n\t${4}\nend' }
        ];

        // Collect suggestions for autocompletion
        const suggestions = [];

        // Add all standard Ruby snippets
        rubySnippets.forEach(item => {
          suggestions.push({
            label: item.name,
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: item.snippet,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: 'Ruby snippet'
          });
        });

        // Add data type methods
        Object.keys(rubyTypes).forEach(type => {
          rubyTypes[type].forEach(item => {
            suggestions.push({
              label: item.name,
              kind: monaco.languages.CompletionItemKind.Method,
              insertText: item.snippet,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              detail: `${type} - method`
            });
          });
        });

        return { suggestions };
      }
    });

    // Add autocompletion for Java
    monaco.languages.registerCompletionItemProvider('java', {
      triggerCharacters: ['.'],
      provideCompletionItems: (model, position) => {
        // Java data types and methods
        const javaTypes = {
          'ArrayList': [
            { name: 'add', snippet: 'add(${1:element})' },
            { name: 'remove', snippet: 'remove(${1:index})' },
            { name: 'get', snippet: 'get(${1:index})' },
            { name: 'set', snippet: 'set(${1:index}, ${2:element})' },
            { name: 'size', snippet: 'size()' },
            { name: 'clear', snippet: 'clear()' },
            { name: 'isEmpty', snippet: 'isEmpty()' },
            { name: 'contains', snippet: 'contains(${1:element})' },
            { name: 'forEach', snippet: 'forEach(${1:element} -> {\n\t${2}\n})' }
          ],
          'String': [
            { name: 'length', snippet: 'length()' },
            { name: 'charAt', snippet: 'charAt(${1:index})' },
            { name: 'substring', snippet: 'substring(${1:beginIndex}, ${2:endIndex})' },
            { name: 'equals', snippet: 'equals(${1:anotherString})' },
            { name: 'equalsIgnoreCase', snippet: 'equalsIgnoreCase(${1:anotherString})' },
            { name: 'compareTo', snippet: 'compareTo(${1:anotherString})' },
            { name: 'indexOf', snippet: 'indexOf(${1:str})' },
            { name: 'lastIndexOf', snippet: 'lastIndexOf(${1:str})' },
            { name: 'toLowerCase', snippet: 'toLowerCase()' },
            { name: 'toUpperCase', snippet: 'toUpperCase()' },
            { name: 'trim', snippet: 'trim()' },
            { name: 'replace', snippet: 'replace(${1:oldChar}, ${2:newChar})' },
            { name: 'split', snippet: 'split(${1:regex})' }
          ],
          'HashMap': [
            { name: 'put', snippet: 'put(${1:key}, ${2:value})' },
            { name: 'get', snippet: 'get(${1:key})' },
            { name: 'remove', snippet: 'remove(${1:key})' },
            { name: 'containsKey', snippet: 'containsKey(${1:key})' },
            { name: 'containsValue', snippet: 'containsValue(${1:value})' },
            { name: 'size', snippet: 'size()' },
            { name: 'clear', snippet: 'clear()' },
            { name: 'isEmpty', snippet: 'isEmpty()' },
            { name: 'keySet', snippet: 'keySet()' },
            { name: 'values', snippet: 'values()' },
            { name: 'entrySet', snippet: 'entrySet()' },
            { name: 'forEach', snippet: 'forEach((${1:key}, ${2:value}) -> {\n\t${3}\n})' }
          ]
        };

        // Standard Java snippets
        const javaSnippets = [
          { name: 'class', snippet: 'public class ${1:Name} {\n\t${2}\n}' },
          { name: 'main', snippet: 'public static void main(String[] args) {\n\t${1}\n}' },
          { name: 'sout', snippet: 'System.out.println(${1});' },
          { name: 'method', snippet: 'public ${1:returnType} ${2:methodName}(${3:parameters}) {\n\t${4}\n}' },
          { name: 'if', snippet: 'if (${1:condition}) {\n\t${2}\n}' },
          { name: 'if-else', snippet: 'if (${1:condition}) {\n\t${2}\n} else {\n\t${3}\n}' },
          { name: 'for', snippet: 'for (int ${1:i} = 0; ${1:i} < ${2:max}; ${1:i}++) {\n\t${3}\n}' },
          { name: 'foreach', snippet: 'for (${1:Type} ${2:item} : ${3:collection}) {\n\t${4}\n}' },
          { name: 'while', snippet: 'while (${1:condition}) {\n\t${2}\n}' },
          { name: 'switch', snippet: 'switch (${1:variable}) {\n\tcase ${2:value}:\n\t\t${3}\n\t\tbreak;\n\tdefault:\n\t\t${4}\n\t\tbreak;\n}' },
          { name: 'try-catch', snippet: 'try {\n\t${1}\n} catch (${2:Exception} ${3:e}) {\n\t${4}\n}' },
          { name: 'try-catch-finally', snippet: 'try {\n\t${1}\n} catch (${2:Exception} ${3:e}) {\n\t${4}\n} finally {\n\t${5}\n}' },
          { name: 'interface', snippet: 'public interface ${1:Name} {\n\t${2}\n}' },
          { name: 'enum', snippet: 'public enum ${1:Name} {\n\t${2}\n}' },
          { name: 'ArrayList', snippet: 'ArrayList<${1:Type}> ${2:name} = new ArrayList<>();' },
          { name: 'HashMap', snippet: 'HashMap<${1:KeyType}, ${2:ValueType}> ${3:name} = new HashMap<>();' }
        ];

        // Collect suggestions for autocompletion
        const suggestions = [];

        // Add all standard Java snippets
        javaSnippets.forEach(item => {
          suggestions.push({
            label: item.name,
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: item.snippet,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: 'Java snippet'
          });
        });

        // Add data type methods
        Object.keys(javaTypes).forEach(type => {
          javaTypes[type].forEach(item => {
            suggestions.push({
              label: item.name,
              kind: monaco.languages.CompletionItemKind.Method,
              insertText: item.snippet,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              detail: `${type} - method`
            });
          });
        });

        return { suggestions };
      }
    });
  }, []);

  const handleEditorValidation = useCallback((markers) => {
    // Handle code validation errors
    markers.forEach((marker) => console.log('Validation:', marker.message));
  }, []);

  // Function to get color based on index
  const getColorForIndex = (index) => {
    const colors = ['#ffc600', '#ff00c6', '#00ffc6', '#c6ff00'];
    return colors[index % colors.length];
  };

  // Update selection handler
  const handleSelectionChange = useCallback((selection) => {
    if (sessionId) {
      socket.emit('selection_change', {
        sessionId,
        selection,
        userName: userSurname ? `${userName} ${userSurname}` : userName
      });
    }
  }, [sessionId, userName, userSurname]);

  // Update selection update handler
  const handleSelectionUpdate = useCallback(({ userId, selection, userName }) => {
    setSelections(prev => ({
      ...prev,
      [userId]: { ...selection, userName }
    }));
  }, []);

  const handleNameSubmit = useCallback(() => {
    if (userName.trim()) {
      setIsNameSet(true);

      // Form full user name
      const fullName = userSurname ? `${userName} ${userSurname}` : userName;

      // Send name to server
      socket.emit('set_user_name', { fullName });
      console.log('Sent user name:', fullName);

      // If user is already in session, update their name in participants list
      if (sessionId) {
        setParticipants(prevParticipants => {
          return prevParticipants.map(p =>
            p.userId === socket.id
              ? { ...p, userName: fullName }
              : p
          );
        });

        // If user is already in session, send selection update with new name
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

      // Save to cookies
      Cookies.set(COOKIE_NICKNAME, userName, { expires: COOKIE_EXPIRES });
    }
  }, [userName, userSurname, sessionId, editorInstance]);

  const handleNameChange = useCallback((e) => {
    setUserName(e.target.value);
  }, []);

  // Function to logout (clear data)
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
          Fluxcode
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
            // If user is already connected, send name to server
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
                    {isExecuting ? 'Running...' : 'Run'}
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={downloadCode}
                    disabled={!code.trim()}
                  >
                    <span className="icon">💾</span>
                    Download
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={handleShare}
                    disabled={!sessionId}
                  >
                    <span className="icon">🔗</span>
                    Share
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
                  <pre className="output-content">{output || 'Result will appear here'}</pre>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {showCookieBanner && <CookieBanner onClose={handleCookieConsent} />}
    </div>
  );
}

export default App;