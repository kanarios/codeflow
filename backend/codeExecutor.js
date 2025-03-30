const Docker = require('dockerode');
const docker = new Docker();

async function executeCode(language, code) {
  console.log(`Executing ${language} code:`, code);
  const containerConfig = {
    Image: getImageForLanguage(language),
    Cmd: getCommandForLanguage(language, code),
    NetworkDisabled: true,
    Memory: 100 * 1024 * 1024, // 100 MB
    MemorySwap: 0,
    AttachStdout: true,
    AttachStderr: true,
    Tty: false,
    OpenStdin: false,
    StdinOnce: false
  };

  let container;
  try {
    console.log('Creating container with config:', containerConfig);
    container = await docker.createContainer(containerConfig);
    console.log('Container created, starting...');
    await container.start();
    console.log('Container started, getting logs...');

    await container.wait();

    const output = await new Promise((resolve, reject) => {
      container.logs({
        stdout: true,
        stderr: true,
        follow: false,
        timestamps: false,
        tail: 'all'
      }, (err, data) => {
        if (err) {
          reject(err);
        } else {
          const cleanOutput = data
            .toString('utf8')
            .split('\n')
            .map(line => line.slice(1))
            .join('\n')
            .trim();
          resolve(cleanOutput);
        }
      });
    });

    console.log('Got output:', output);
    await container.remove({ force: true });
    return output;
  } catch (error) {
    console.error('Error executing code:', error);
    if (container) {
      try {
        await container.remove({ force: true });
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
    }
    throw new Error(`Execution error: ${error.message}`);
  }
}

function getImageForLanguage(language) {
  const images = {
    javascript: 'node:alpine',
    python: 'python:alpine',
    java: 'openjdk:alpine',
    ruby: 'ruby:alpine'
  };
  return images[language] || 'node:alpine';
}

function getCommandForLanguage(language, code) {
  const commands = {
    javascript: ['node', '-e', code],
    python: ['python', '-c', code],
    ruby: ['ruby', '-e', code],
    java: [] // Requires additional processing
  };
  return commands[language] || ['node', '-e', code];
}

module.exports = { executeCode };