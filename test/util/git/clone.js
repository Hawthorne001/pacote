const clone = require('../../../lib/util/git/clone.js')

const t = require('tap')
const fs = require('fs')
const {spawn} = require('child_process')
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')
const { promisify } = require('util')
const { resolve, basename } = require('path')

const port = 12345 + (+process.env.TAP_CHILD_ID || 0)
const spawnGit = require('../../../lib/util/git/spawn.js')
const me = resolve(__dirname, basename(__filename, '.js'))
rimraf.sync(me)
const remote = `git://localhost:${port}/repo`
const submodsRemote = `git://localhost:${port}/submodule-repo`
const repo = resolve(me, 'repo')

t.test('create repo', { bail: true }, t => {
  const git = (...cmd) => spawnGit(cmd, { cwd: repo })
  const write = (f, c) => fs.writeFileSync(`${repo}/${f}`, c)
  mkdirp.sync(repo)
  return git('init')
  .then(() => write('foo', 'bar'))
  .then(() => git('add', 'foo'))
  .then(() => git('commit', '-m', 'foobar'))
  .then(() => git('tag', '-a', 'asdf', '-m', 'asdf'))
  .then(() => write('bar', 'foo'))
  .then(() => git('add', 'bar'))
  .then(() => git('commit', '-m', 'barfoo'))
  .then(() => git('tag', 'quux'))
  .then(() => write('bob', 'obo'))
  .then(() => git('add', 'bob'))
  .then(() => git('commit', '-m', 'bob plays the obo'))
  .then(() => write('pull-file', 'a humble request that you pull'))
  .then(() => git('add', 'pull-file'))
  .then(() => git('commit', '-m', 'the ref file'))
  .then(() => git('update-ref', 'refs/pull/1/head', 'HEAD'))
  .then(() => write('rando-ref', 'some rando ref'))
  .then(() => git('add', 'rando-ref'))
  .then(() => git('commit', '-m', 'so rando'))
  .then(() => git('update-ref', 'refs/rando/file', 'HEAD'))
  .then(() => write('other-file', 'file some other bits'))
  .then(() => git('add', 'other-file'))
  .then(() => git('commit', '-m', 'others'))
  .then(() => git('tag', '-am', 'version 1.2.3', 'version-1.2.3'))
  .then(() => git('tag', '-am', 'too big', '69' + Math.pow(2, 53) + '.0.0'))
  .then(() => write('gleep', 'glorp'))
  .then(() => git('add', 'gleep'))
  .then(() => git('commit', '-m', 'gleep glorp'))
  .then(() => git('tag', '-am', 'head version', '69.42.0'))
})

t.test('spawn daemon', { bail: true }, t => {
  const daemon = spawn('git', [
    'daemon',
    `--port=${port}`,
    '--export-all',
    '--verbose',
    '--informative-errors',
    '--reuseaddr',
    `--base-path=.`,
    '--listen=localhost',
  ], { cwd: me, stdio: ['pipe', 1, 'pipe' ] })
  const onDaemonData = c => {
    // prepare to slay the daemon
    const cpid = c.toString().match(/^\[(\d+)\]/)
    if (cpid && cpid[1]) {
      daemon.stderr.removeListener('data', onDaemonData)
      const pid = +cpid[1]
      t.parent.teardown(() => process.kill(pid))
      t.end()
    }
  }
  daemon.stderr.on('data', onDaemonData)
  // only clean up the dir once the daemon is banished
  daemon.on('close', () => rimraf.sync(me))
})

t.test('create a repo with a submodule', { bail: true }, t => {
  const repo = resolve(me, 'submodule-repo')
  const git = (...cmd) => spawnGit(cmd, { cwd: repo })
  const write = (f, c) => fs.writeFileSync(`${repo}/${f}`, c)
  mkdirp.sync(repo)
  return git('init')
    .then(() => write('file', 'data'))
    .then(() => git('add', 'file'))
    .then(() => git('commit', '-m', 'file'))
    .then(() => git('submodule', 'add', remote, 'fooblz'))
    .then(() => git('commit', '-m', 'add submodule'))
    .then(() => write('foo', 'bar'))
    .then(() => git('add', 'foo'))
    .then(() => git('commit', '-m', 'foobar'))
    .then(() => git('tag', '-a', 'asdf', '-m', 'asdf'))
    .then(() => write('bar', 'foo'))
    .then(() => git('add', 'bar'))
    .then(() => git('commit', '-m', 'barfoo'))
    .then(() => git('tag', 'quux'))
    .then(() => write('bob', 'obo'))
    .then(() => git('add', 'bob'))
    .then(() => git('commit', '-m', 'bob plays the obo'))
    .then(() => write('pull-file', 'a humble request that you pull'))
    .then(() => git('add', 'pull-file'))
    .then(() => git('commit', '-m', 'the ref file'))
    .then(() => git('update-ref', 'refs/pull/1/head', 'HEAD'))
    .then(() => write('rando-ref', 'some rando ref'))
    .then(() => git('add', 'rando-ref'))
    .then(() => git('commit', '-m', 'so rando'))
    .then(() => git('update-ref', 'refs/rando/file', 'HEAD'))
    .then(() => write('other-file', 'file some other bits'))
    .then(() => git('add', 'other-file'))
    .then(() => git('commit', '-m', 'others'))
    .then(() => git('tag', '-am', 'version 1.2.3', 'version-1.2.3'))
    .then(() => git('tag', '-am', 'too big', '69' + Math.pow(2, 53) + '.0.0'))
    .then(() => write('gleep', 'glorp'))
    .then(() => git('add', 'gleep'))
    .then(() => git('commit', '-m', 'gleep glorp'))
    .then(() => git('tag', '-am', 'head version', '69.42.0'))
})

const windowsPlatform = process.platform === 'win32' ? null : 'win32'
const posixPlatform = process.platform === 'win32' ? 'posix' : null
const platforms = [windowsPlatform, posixPlatform]
// note: localhost is not in shallowHosts, so null is like false
const shallows = [true, null]
const refs = [
  undefined,
  null,
  'refs/rando/file',
  'pull/1',
  '699007199254740992.0.0^^',
  'semver:1.x',
]

const npa = require('npm-package-arg')
const hashre = /^[a-f0-9]{40}$/

t.test('check every out', t => {
  t.jobs = 2
  t.plan(platforms.length)
  platforms.forEach(fakePlatform => t.test(`platform=${fakePlatform}`, t => {
    t.jobs = 2
    t.plan(shallows.length)
    shallows.forEach(gitShallow => t.test(`shallow=${gitShallow}`, t => {
      t.jobs = 2
      t.plan(refs.length)
      refs.forEach(ref => t.test(`ref=${ref}`, t => {
        const opts = { fakePlatform, gitShallow }
        const safeRef = `${ref}`.replace(/[^a-z0-9.]/g, '-')
        const name = `${fakePlatform}-${gitShallow}-${safeRef}`
        const target = resolve(me, name)
        const spec = npa(remote + (ref ? `#${ref}` : ''))
        return clone(remote, ref, target, spec, opts)
          .then(sha => t.match(sha, hashre, `got a sha for ref=${ref}`))
      }))
    }))
  }))
})

t.test('again, with a submodule', t => {
  t.jobs = 2
  t.plan(platforms.length)
  platforms.forEach(fakePlatform => t.test(`platform=${fakePlatform}`, t => {
    t.jobs = 2
    t.plan(shallows.length)
    shallows.forEach(gitShallow => t.test(`shallow=${gitShallow}`, t => {
      t.jobs = 2
      t.plan(refs.length)
      refs.forEach(ref => t.test(`ref=${ref}`, t => {
        const opts = { fakePlatform, gitShallow }
        const safeRef = `${ref}`.replace(/[^a-z0-9.]/g, '-')
        const name = `withsub-${fakePlatform}-${gitShallow}-${safeRef}`
        const target = resolve(me, name)
        const spec = npa(submodsRemote + (ref ? `#${ref}` : ''))
        return clone(submodsRemote, ref, target, spec, opts)
          .then(sha => t.match(sha, hashre, `got a sha for ref=${ref}`))
          .then(() => {
            const sub = resolve(target, 'fooblz')
            t.ok(fs.statSync(sub).isDirectory(), 'sub is directory')
            t.equal(fs.readFileSync(sub + '/gleep', 'utf8'), 'glorp',
              'gleep file is glorpy')
          })
      }))
    }))
  }))
})
