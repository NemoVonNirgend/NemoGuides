import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('settings template path matches the Hub installation directory', async () => {
    const source = await readFile(new URL('../index.js', import.meta.url), 'utf8');

    assert.match(source, /const EXTENSION_FOLDER = 'third-party\/NemoGuides';/);
});
