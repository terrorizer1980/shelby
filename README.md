shelby
======
Issue commands to (and get responses from) a persistent shell. No dependencies.

Only tested with `bash` and `csh`/`tcsh`.

Installation
------------

```js
const Shelby = require('shelby');
```

Usage
-----

```js
let shell = new Shelby();
```

### Constructor Options

  - `path` (`String`): absolute path to shell binary
    (default: `/bin/sh`)

  - `timeout` (`Number`): timeout (in ms) before shell exits with error
    (default: `0`)

  - `verbose` (`Boolean`): if `true`, log all shell output to console
    (default: `false`)

  - `logFile` (`String`): absolute path to shell output log file
    (default: `null`)

  - `onError` (`Function`): callback function for all command errors
    (default: `null`)

### Commands

```js
await shell.run('uname'); // 'Linux'
await shell.run('FOOBAR=BAZ'); // null, no output
await shell.run('echo $FOOBAR'); // 'BAZ'
```

```js
await shell.exit();
```

#### Command Options

  - `timeout` (`Number`): timeout (in ms) before command times out
    (default: `0`)

  - `wait` (`Boolean`): if false, run command and ignore output, resolving
    immediately (default: `true`)

License
-------
This software is released under the terms of the **MIT license**. See `LICENSE`.
