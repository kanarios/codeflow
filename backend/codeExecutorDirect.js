const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

async function executeCode(language, code) {
  const tmpDir = '/tmp';
  const fileId = crypto.randomBytes(16).toString('hex');

  try {
    switch (language.toLowerCase()) {
      case 'javascript':
        return await executeJavaScript(code);
      case 'typescript':
        return await executeTypeScript(code, tmpDir, fileId);
      case 'python':
        const pythonCode = code.replace(/console\.log\((.*)\);?/g, 'print($1)');
        return await executePython(pythonCode, tmpDir, fileId);
      case 'java':
        return await executeJava(code, tmpDir, fileId);
      default:
        throw new Error('Unsupported language');
    }
  } catch (error) {
    throw new Error(`Execution error: ${error.message}`);
  }
}

function executeJavaScript(code) {
  return new Promise((resolve, reject) => {
    const vm = require('vm');
    let output = [];

    // Создаем безопасный контекст выполнения
    const context = {
      console: {
        log: (...args) => {
          output.push(args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
          ).join(' '));
        }
      },
      setTimeout: () => {}, // Заглушка для setTimeout
      setInterval: () => {}, // Заглушка для setInterval
      process: undefined,
      require: undefined
    };

    try {
      vm.runInNewContext(code, context, {
        timeout: 5000,
        displayErrors: true
      });
      resolve(output.join('\n'));
    } catch (error) {
      reject(error);
    }
  });
}

async function executeTypeScript(code, tmpDir, fileId) {
  const tsFile = path.join(tmpDir, `${fileId}.ts`);
  const jsFile = path.join(tmpDir, `${fileId}.js`);

  try {
    // Записываем TypeScript код во временный файл
    await fs.writeFile(tsFile, code);

    // Компилируем TypeScript в JavaScript
    await new Promise((resolve, reject) => {
      exec(`tsc ${tsFile} --target ES2018 --module commonjs`, {
        timeout: 5000
      }, (error, stdout, stderr) => {
        if (error) reject(new Error(stderr));
        else resolve(stdout);
      });
    });

    // Читаем скомпилированный JavaScript
    const jsCode = await fs.readFile(jsFile, 'utf8');

    // Выполняем JavaScript
    return await executeJavaScript(jsCode);
  } finally {
    // Очищаем временные файлы
    await Promise.all([
      fs.unlink(tsFile).catch(() => {}),
      fs.unlink(jsFile).catch(() => {})
    ]);
  }
}

async function executePython(code, tmpDir, fileId) {
  const filePath = path.join(tmpDir, `${fileId}.py`);
  await fs.writeFile(filePath, code);

  return new Promise((resolve, reject) => {
    exec(`python3 ${filePath}`, {
      timeout: 5000,
      maxBuffer: 1024 * 1024
    }, (error, stdout, stderr) => {
      fs.unlink(filePath).catch(() => {});
      if (error) reject(new Error(stderr));
      else resolve(stdout);
    });
  });
}

async function executeJava(code, tmpDir, fileId) {
  // Извлекаем имя класса из кода
  const classMatch = code.match(/public\s+class\s+(\w+)/);
  if (!classMatch) {
    throw new Error('No public class found in Java code');
  }
  const className = classMatch[1];

  const javaFile = path.join(tmpDir, `${className}.java`);
  const classFile = path.join(tmpDir, `${className}.class`);

  try {
    // Записываем Java код во временный файл
    await fs.writeFile(javaFile, code);

    // Компилируем Java код
    await new Promise((resolve, reject) => {
      exec(`javac ${javaFile}`, {
        timeout: 5000
      }, (error, stdout, stderr) => {
        if (error) reject(new Error(stderr));
        else resolve(stdout);
      });
    });

    // Запускаем скомпилированный Java класс
    return new Promise((resolve, reject) => {
      exec(`java -cp ${tmpDir} ${className}`, {
        timeout: 5000,
        maxBuffer: 1024 * 1024
      }, (error, stdout, stderr) => {
        if (error) reject(new Error(stderr));
        else resolve(stdout);
      });
    });
  } finally {
    // Очищаем временные файлы
    await Promise.all([
      fs.unlink(javaFile).catch(() => {}),
      fs.unlink(classFile).catch(() => {})
    ]);
  }
}

module.exports = { executeCode };