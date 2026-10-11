(function (root) {
  'use strict';
  const PP = (root.PP = root.PP || {});
  const KEY = 'pputt.profiles.v1';
  const OLD = 'parallaxPutting.shots.v1';

  let book = { list: [], activeId: null };

  function read() {
    try {
      const raw = root.localStorage && root.localStorage.getItem(KEY);
      if (raw) book = JSON.parse(raw) || book;
    } catch (e) {}
    if (!book.list) book.list = [];
    return book;
  }
  function write() {
    try {
      if (root.localStorage) root.localStorage.setItem(KEY, JSON.stringify(book));
    } catch (e) {}
  }

  function newId() {
    return 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
  }

  function clean(name) {
    return String(name || '').trim().slice(0, 18) || 'Player';
  }

  function create(name) {
    const p = { id: newId(), name: clean(name), made: Date.now() };
    book.list.push(p);
    book.activeId = p.id;
    write();
    return p;
  }

  function remove(id) {
    book.list = book.list.filter((p) => p.id !== id);
    try {
      if (root.localStorage) {
        root.localStorage.removeItem('pputt.shots.' + id);
        root.localStorage.removeItem('pputt.rounds.' + id);
      }
    } catch (e) {}
    if (book.activeId === id) book.activeId = book.list.length ? book.list[0].id : null;
    write();
  }

  function rename(id, name) {
    const p = book.list.find((q) => q.id === id);
    if (p) {
      p.name = clean(name);
      write();
    }
  }

  function setActive(id) {
    if (book.list.some((p) => p.id === id)) {
      book.activeId = id;
      write();
      return true;
    }
    return false;
  }

  function active() {
    return book.list.find((p) => p.id === book.activeId) || null;
  }

  function all() {
    return book.list.slice();
  }

  function init() {
    read();
    if (!book.list.length) {
      let legacy = null;
      try {
        legacy = root.localStorage && root.localStorage.getItem(OLD);
      } catch (e) {}
      const p = create(legacy ? 'Player 1' : 'Guest');
      if (legacy) {
        try {
          root.localStorage.setItem('pputt.shots.' + p.id, legacy);
          root.localStorage.removeItem(OLD);
        } catch (e) {}
      }
    }
    if (!active() && book.list.length) {
      book.activeId = book.list[0].id;
      write();
    }
    return active();
  }

  PP.profiles = { init, all, active, setActive, create, remove, rename };
})(typeof window !== 'undefined' ? window : globalThis);
