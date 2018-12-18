/**
 * @license MIT
 *
 * shelby - Issue commands to (and get responses from) a persistent shell
 * https://github.com/gavinhungry/shelby
 */

const child_process = require('child_process');
const fs = require('fs');
const path = require('path');

module.exports = class Shelby {
  /**
   * Shelby constructor
   *
   * @example
   *
   *   let shell = new Shelby();
   *
   *   await shell.run('uname'); // 'Linux'
   *   await shell.run('FOOBAR=BAZ'); // null, no output
   *   await shell.run('echo $FOOBAR'); // 'BAZ'
   *
   *   await shell.exit();
   *
   * @param {Object} [opts]
   * @param {String} [opts.path] - absolute path to shell executable
   * @param {Number} [opts.timeout] - shell timeout, in ms
   * @param {Boolean} [opts.verbose] - log all shell output to console
   * @param {String} [opts.logFile] - absolute path to shell output log file
   * @param {Function} [opts.onError]
   */
  constructor({
    path: shellPath = '/bin/sh',
    timeout: shellTimeout = 0,
    verbose = false,
    logFile = null,
    onError = null
  } = {}) {
    if (!path.isAbsolute(shellPath)) {
      throw new Error('Shell path should be an absolute path');
    }

    this._shell = child_process.spawn(shellPath);
    this._exited = false;

    this._timeout = null;
    if (shellTimeout) {
      this._timeout = setTimeout(() => {
        throw new Error('Shell timed out');
      }, shellTimeout);
    }

    if (logFile && path.isAbsolute(logFile)) {
      this._logger = fs.createWriteStream(logFile);

      this._shell.stdout.pipe(this._logger);
      this._shell.stderr.pipe(this._logger);
    }

    this.verbose = !!verbose;

    if (typeof onError === 'function') {
      this.onError = onError;
    }
  }

  static get COMPLETED() {
    return '__SHELBY_COMMAND_COMPLETED__';
  }

  /**
   * Run a command and get output
   *
   * @param {String} command - command to run
   * @param {Object} [opts]
   * @param {Number} [opts.timeout] - command timeout, in ms
   * @param {Boolean} [opts.wait] - if false, run command and ignore output
   * @return {Promise.<String>} stdout output, or stderr if command fails
   */
  async run(command, {
    timeout: commandTimeout = 0,
    wait = true
  } = {}) {
    return new Promise((resolve, reject) => {
      if (!wait) {
        this._shell.stdin.write(`${command}\n`);
        return resolve();
      }

      let memo = {
        stdout: [],
        stderr: []
      };

      let timeout;

      if (commandTimeout) {
        timeout = setTimeout(() => {
          stopListening();
          reject(new Error('Command timed out'));
        }, commandTimeout);
      }

      let onData = (type, fin) => {
        let stdio = memo[type];

        return buf => {
          let data = buf.toString();
          let lines = data.split('\n').filter(Boolean);

          let index = lines.lastIndexOf(Shelby.COMPLETED);

          let isComplete = index >= 0;
          if (isComplete) {
            lines.splice(index, 1);
          }

          if (this.verbose && lines.length) {
            console.debug(lines.join('\n'));
          }

          stdio.push(...lines);

          if (isComplete) {
            if (timeout) {
              clearTimeout(timeout);
            }

            stopListening();
            fin(stdio.length ? stdio.join('\n') : null);
          }
        };
      };

      let onStdout = onData('stdout', resolve);
      let onStderr = onData('stderr', reject);

      this._shell.stdout.on('data', onStdout);
      this._shell.stderr.on('data', onStderr);

      let stopListening = () => {
        this._shell.stdout.off('data', onStdout);
        this._shell.stderr.off('data', onStderr);
      };

      // pipe stderr to sh, as csh cannot redirect to stderr itself
      this._shell.stdin.write(`${command} \
        && (echo ${Shelby.COMPLETED}) \
        || (echo ${Shelby.COMPLETED} | /bin/sh -c 'cat 1>&2')\n
      `);
    }).catch(err => {
      if (this.onError) {
        this.onError(err);
        return;
      }

      throw err;
    });
  }

  /**
   * Exit shell
   *
   * @return {Promise}
   */
  exit() {
    if (this._exited) {
      return Promise.resolve();
    }

    this._exited = true;

    if (this._timeout) {
      clearTimeout(this._timeout);
    }

    this._shell.stdin.end();

    return new Promise(resolve => {
      if (!this._logger) {
        return resolve();
      }

      this._logger.on('finish', resolve);
      this._logger.end();
    });
  }
};
