/* ShellMan file-type icons.
 * window.ShellmanFileIcons.render(item, size) -> inline SVG string.
 * item = { name, is_dir }. Folders keep the amber folder; files get a document
 * silhouette in the type's brand color with a label or glyph on it. */
(function () {
  'use strict';

  // ---- glyphs (white, drawn inside the 24x24 box on the document body) ----
  const G = {
    code:  '<polyline points="9.5 11.5 7.5 14 9.5 16.5" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><polyline points="14.5 11.5 16.5 14 14.5 16.5" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
    term:  '<polyline points="8 11.5 11 14.2 8 17" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><line x1="12.5" y1="17.2" x2="16.5" y2="17.2" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>',
    lines: '<line x1="8" y1="11.5" x2="16" y2="11.5" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/><line x1="8" y1="14.5" x2="16" y2="14.5" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/><line x1="8" y1="17.5" x2="12.5" y2="17.5" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>',
    image: '<circle cx="9.4" cy="12" r="1.5" fill="#fff"/><path d="M6.5 19l3.6-4.4 2.6 2.7 2-2.2 2.8 3.9z" fill="#fff"/>',
    video: '<path d="M9.5 10.8v6.4l5.6-3.2z" fill="#fff"/>',
    audio: '<path d="M10.5 17.5V10l5.5-1.4v7.4" fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/><circle cx="9" cy="17.6" r="1.7" fill="#fff"/><circle cx="14.6" cy="16.2" r="1.7" fill="#fff"/>',
    zip:   '<rect x="11" y="8" width="2" height="1.6" fill="#fff"/><rect x="11" y="11" width="2" height="1.6" fill="#fff"/><rect x="11" y="14" width="2" height="1.6" fill="#fff"/><rect x="9.8" y="17" width="4.4" height="3" rx="1" fill="none" stroke="#fff" stroke-width="1.4"/>',
    db:    '<ellipse cx="12" cy="10.4" rx="4.4" ry="1.8" fill="#fff"/><path d="M7.6 10.4v6.4c0 1 2 1.8 4.4 1.8s4.4-.8 4.4-1.8v-6.4" fill="none" stroke="#fff" stroke-width="1.5"/><path d="M7.6 13.6c0 1 2 1.8 4.4 1.8s4.4-.8 4.4-1.8" fill="none" stroke="#fff" stroke-width="1.3"/>',
    key:   '<circle cx="9.6" cy="13.5" r="2.5" fill="none" stroke="#fff" stroke-width="1.6"/><path d="M12.1 13.5H18M16 13.5v2.4M14 13.5v1.8" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>',
    lock:  '<rect x="8" y="13" width="8" height="6" rx="1.4" fill="#fff"/><path d="M9.6 13v-1.6a2.4 2.4 0 0 1 4.8 0V13" fill="none" stroke="#fff" stroke-width="1.5"/>',
    gear:  '<circle cx="12" cy="14.5" r="2.2" fill="none" stroke="#fff" stroke-width="1.6"/><path d="M12 9.6v1.5M12 17.9v1.5M7.1 14.5h1.5M15.4 14.5h1.5M8.6 11.1l1 1M14.4 16.9l1 1M15.4 11.1l-1 1M9.6 16.9l-1 1" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>',
    bin:   '<text x="12" y="13.2" text-anchor="middle" font-family="ui-monospace,Menlo,Consolas,monospace" font-weight="700" font-size="4.6" fill="#fff">1010</text><text x="12" y="18" text-anchor="middle" font-family="ui-monospace,Menlo,Consolas,monospace" font-weight="700" font-size="4.6" fill="#fff">0101</text>',
    box:   '<path d="M12 9l5 2.6v5.2L12 19.4l-5-2.6v-5.2z" fill="none" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/><path d="M7 11.6l5 2.6 5-2.6M12 14.2v5.2" fill="none" stroke="#fff" stroke-width="1.4"/>',
    git:   '<circle cx="9" cy="10.8" r="1.5" fill="#fff"/><circle cx="9" cy="18" r="1.5" fill="#fff"/><circle cx="15.4" cy="13.4" r="1.5" fill="#fff"/><path d="M9 12.3v4.2M9 14.2c0-1 .8-1.6 2-1.6h2.6" fill="none" stroke="#fff" stroke-width="1.4"/>',
    braces:'<path d="M10 9.6c-1.4 0-1.8.7-1.8 1.8v1.1c0 .7-.4 1.2-1.2 1.5.8.3 1.2.8 1.2 1.5v1.1c0 1.1.4 1.8 1.8 1.8M14 9.6c1.4 0 1.8.7 1.8 1.8v1.1c0 .7.4 1.2 1.2 1.5-.8.3-1.2.8-1.2 1.5v1.1c0 1.1-.4 1.8-1.8 1.8" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
    // python: two interlocking snakes, drawn point-symmetric
    py: '<g transform="translate(5.6 6.9) scale(.64)"><path id="smPyA" d="M10 1C6 1 6 2.8 6 2.8V5h4.2v.8H4.8C3 5.8 1 7 1 10.2s1.8 4.2 1.8 4.2H4.4V12C4.4 9.8 5.9 8.4 8 8.4h4.6c1.4 0 2.4-1 2.4-2.4V3.3C15 1.6 12.6 1 10 1z" fill="#3776ab"/><circle cx="8" cy="3.2" r=".85" fill="#fff"/><g transform="rotate(180 10 10)"><path d="M10 1C6 1 6 2.8 6 2.8V5h4.2v.8H4.8C3 5.8 1 7 1 10.2s1.8 4.2 1.8 4.2H4.4V12C4.4 9.8 5.9 8.4 8 8.4h4.6c1.4 0 2.4-1 2.4-2.4V3.3C15 1.6 12.6 1 10 1z" fill="#ffd43b"/><circle cx="8" cy="3.2" r=".85" fill="#fff"/></g></g>'
  };

  // ---- type table: [doc color, label | glyph key, text color] ----
  const T = {};
  const add = (exts, color, mark, tc) => exts.split(' ').forEach(e => { T[e] = [color, mark, tc || '#fff']; });

  // code
  add('py pyw pyi pyc ipynb', '#f1f5f9', 'py');
  add('js mjs cjs', '#f7df1e', 'JS', '#1c1917');
  add('jsx', '#0ea5c4', 'JSX');
  add('ts mts cts', '#3178c6', 'TS');
  add('tsx', '#2563eb', 'TSX');
  add('vue', '#41b883', 'VUE');
  add('svelte', '#ff3e00', 'SV');
  add('html htm xhtml', '#e44d26', 'HTML');
  add('css', '#2965f1', 'CSS');
  add('scss sass', '#cd6799', 'SCSS');
  add('less', '#1d365d', 'LESS');
  add('php phtml', '#777bb4', 'PHP');
  add('rb erb gemspec rake', '#cc342d', 'RB');
  add('go', '#00add8', 'GO');
  add('rs', '#b7410e', 'RS');
  add('java jar class', '#e76f00', 'JAVA');
  add('kt kts', '#7f52ff', 'KT');
  add('swift', '#fa7343', 'SWFT');
  add('c', '#00599c', 'C');
  add('h', '#6d28d9', 'H');
  add('cpp cc cxx hpp hh', '#00599c', 'C++');
  add('cs', '#68217a', 'C#');
  add('lua', '#000080', 'LUA');
  add('pl pm', '#39457e', 'PL');
  add('r', '#276dc3', 'R');
  add('dart', '#0175c2', 'DART');
  add('sql', '#0f766e', 'SQL');
  add('sh bash zsh fish ksh', '#16a34a', 'term');
  add('bat cmd ps1', '#2563eb', 'term');
  add('asm s', '#6b7280', 'ASM');
  // data / config
  add('json jsonc json5 map', '#d97706', 'braces');
  add('yaml yml', '#cb171e', 'YML');
  add('toml', '#9c4221', 'TOML');
  add('xml xsl xslt plist', '#f97316', 'XML');
  add('ini cfg conf cnf properties service socket timer desktop rules', '#64748b', 'gear');
  add('env', '#ca8a04', 'ENV');
  add('csv tsv', '#16a34a', 'CSV');
  add('db sqlite sqlite3 mdb frm ibd myd', '#0369a1', 'db');
  add('lock', '#64748b', 'lock');
  add('pem key crt cer pub gpg asc p12 pfx csr', '#d97706', 'key');
  // docs
  add('md markdown mdx rst', '#0ea5e9', 'MD');
  add('txt text', '#64748b', 'lines');
  add('log out err', '#78716c', 'LOG');
  add('pdf', '#dc2626', 'PDF');
  add('doc docx odt rtf', '#2b579a', 'DOC');
  add('xls xlsx ods', '#217346', 'XLS');
  add('ppt pptx odp', '#d24726', 'PPT');
  // media
  add('png jpg jpeg gif webp bmp tiff tif avif heic ico', '#10b981', 'image');
  add('svg', '#f59e0b', 'SVG');
  add('psd ai fig sketch xcf', '#7c3aed', 'image');
  add('mp4 mkv avi mov webm wmv flv m4v mpg mpeg', '#ef4444', 'video');
  add('mp3 wav flac ogg m4a aac wma opus', '#a855f7', 'audio');
  add('ttf otf woff woff2 eot', '#475569', 'Aa');
  // archives / packages / binaries
  add('zip tar gz tgz bz2 xz rar 7z zst lz4 tbz2 txz', '#e11d48', 'zip');
  add('deb', '#a80030', 'DEB');
  add('rpm', '#ee0000', 'RPM');
  add('iso img dmg', '#475569', 'ISO');
  add('exe dll msi', '#3b82f6', 'EXE');
  add('bin so o a ko elf out dat', '#475569', 'bin');
  add('apk', '#3ddc84', 'APK', '#14532d');
  add('whl egg', '#3776ab', 'PKG');
  add('pid sock tmp bak swp old orig', '#94a3b8', 'lines');

  // exact / prefix file names
  const NAMES = {
    'dockerfile': ['#2496ed', 'box'], 'docker-compose.yml': ['#2496ed', 'box'], 'docker-compose.yaml': ['#2496ed', 'box'],
    'compose.yml': ['#2496ed', 'box'], 'compose.yaml': ['#2496ed', 'box'], '.dockerignore': ['#2496ed', 'box'],
    'makefile': ['#6d8086', 'MK'], 'cmakelists.txt': ['#064f8c', 'CMK'], 'procfile': ['#7e57c2', 'PROC'], 'vagrantfile': ['#1868f2', 'VAG'],
    'package.json': ['#cb3837', 'NPM'], 'package-lock.json': ['#cb3837', 'NPM'], 'yarn.lock': ['#2c8ebb', 'YRN'], 'pnpm-lock.yaml': ['#f69220', 'PNPM'],
    'requirements.txt': ['#3776ab', 'PIP'], 'pipfile': ['#3776ab', 'PIP'], 'pyproject.toml': ['#3776ab', 'PY'], 'setup.py': ['#f1f5f9', 'py'],
    'composer.json': ['#885630', 'COMP'], 'composer.lock': ['#885630', 'COMP'], 'gemfile': ['#cc342d', 'GEM'], 'go.mod': ['#00add8', 'GO'], 'go.sum': ['#00add8', 'GO'],
    'cargo.toml': ['#b7410e', 'CRGO'], 'cargo.lock': ['#b7410e', 'CRGO'],
    'readme': ['#0ea5e9', 'MD'], 'readme.md': ['#0ea5e9', 'MD'], 'license': ['#64748b', 'LIC'], 'license.md': ['#64748b', 'LIC'], 'license.txt': ['#64748b', 'LIC'],
    'changelog': ['#64748b', 'lines'], 'changelog.md': ['#0ea5e9', 'MD'],
    '.gitignore': ['#f05033', 'git'], '.gitattributes': ['#f05033', 'git'], '.gitmodules': ['#f05033', 'git'], '.gitkeep': ['#f05033', 'git'],
    '.htaccess': ['#d22128', 'HT'], '.htpasswd': ['#d22128', 'key'],
    '.bashrc': ['#16a34a', 'term'], '.bash_profile': ['#16a34a', 'term'], '.bash_history': ['#16a34a', 'term'], '.profile': ['#16a34a', 'term'], '.zshrc': ['#16a34a', 'term'], '.bash_logout': ['#16a34a', 'term'],
    '.vimrc': ['#019733', 'VIM'], '.npmrc': ['#cb3837', 'NPM'], '.editorconfig': ['#64748b', 'gear'], '.eslintrc': ['#4b32c3', 'ESL'], '.prettierrc': ['#56b3b4', 'PRT'],
    'nginx.conf': ['#009639', 'NGX'], 'httpd.conf': ['#d22128', 'APA'], 'apache2.conf': ['#d22128', 'APA'], 'ports.conf': ['#d22128', 'APA'],
    'authorized_keys': ['#d97706', 'key'], 'known_hosts': ['#d97706', 'key'], 'id_rsa': ['#d97706', 'key'], 'id_rsa.pub': ['#d97706', 'key'],
    'id_ed25519': ['#d97706', 'key'], 'id_ed25519.pub': ['#d97706', 'key'], 'id_ecdsa': ['#d97706', 'key'],
    'passwd': ['#64748b', 'gear'], 'shadow': ['#64748b', 'lock'], 'hosts': ['#64748b', 'gear'], 'fstab': ['#64748b', 'gear'], 'crontab': ['#64748b', 'gear'], 'sudoers': ['#64748b', 'lock']
  };

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

  function lookup(name) {
    const lower = String(name || '').toLowerCase();
    if (NAMES[lower]) return NAMES[lower].concat('#fff');
    if (lower.startsWith('.env')) return T.env;
    if (lower.startsWith('dockerfile')) return NAMES.dockerfile.concat('#fff');
    if (lower.startsWith('readme')) return NAMES.readme.concat('#fff');
    if (lower.startsWith('license') || lower.startsWith('copying')) return NAMES.license.concat('#fff');
    if (/\.tar\.(gz|bz2|xz|zst)$/.test(lower)) return T.tar;
    // rotated logs: syslog.1, access.log.2.gz
    if (/\.log(\.\d+)?(\.gz)?$/.test(lower) || /\.\d+$/.test(lower) && /log|syslog|messages/.test(lower)) return T.log;
    const dot = lower.lastIndexOf('.');
    if (dot > 0 || (dot === 0 && lower.indexOf('.', 1) > 0)) {
      const ext = lower.slice(lower.lastIndexOf('.') + 1);
      if (T[ext]) return T[ext];
    }
    return null;
  }

  const FOLDER = '<path d="M3 6a2 2 0 0 1 2-2h4.5l2 2H19a2 2 0 0 1 2 2v2H3V6z" fill="#f59e0b" fill-opacity="0.35" stroke="#f59e0b" stroke-width="1.5"/><path d="M2.5 10h19l-1.5 9a2 2 0 0 1-2 2h-12a2 2 0 0 1-2-2l-1.5-9z" fill="#f59e0b" fill-opacity="0.9" stroke="#fbbf24" stroke-width="1.5"/>';

  function label(text, tc) {
    const n = text.length;
    const fs = n <= 1 ? 9 : n === 2 ? 7.6 : n === 3 ? 6.2 : n === 4 ? 5.1 : 4.3;
    return '<text x="12" y="' + (n <= 2 ? 17 : 16.6) + '" text-anchor="middle" font-family="Inter,Segoe UI,Arial,sans-serif" font-weight="800" font-size="' + fs + '" fill="' + tc + '">' + esc(text) + '</text>';
  }

  function render(item, size) {
    size = size || 18;
    const st = 'width:' + size + 'px;height:' + size + 'px;flex-shrink:0;';
    if (item && item.is_dir) {
      return '<svg style="' + st + '" viewBox="0 0 24 24" fill="none">' + FOLDER + '</svg>';
    }
    const hit = lookup(item && item.name) || ['#64748b', null, '#fff'];
    const color = hit[0], mark = hit[1], tc = hit[2] || '#fff';
    const light = color === '#f1f5f9';
    let inner = '';
    if (mark && G[mark]) inner = G[mark];
    else if (mark) inner = label(mark, tc);
    const stroke = light ? ' stroke="#cbd5e1" stroke-width="1"' : '';
    // document body + folded corner
    return '<svg style="' + st + '" viewBox="0 0 24 24" fill="none" data-ft="' + esc(mark || 'file') + '">' +
      '<path d="M6 1.5h8.2L20 7.3V20.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-17a2 2 0 0 1 2-2z" fill="' + color + '"' + stroke + '/>' +
      '<path d="M14.2 1.5L20 7.3h-4.2a1.6 1.6 0 0 1-1.6-1.6z" fill="' + (light ? '#cbd5e1' : '#fff') + '" fill-opacity="' + (light ? '1' : '.4') + '"/>' +
      inner + '</svg>';
  }

  window.ShellmanFileIcons = { render: render, lookup: lookup };
})();
