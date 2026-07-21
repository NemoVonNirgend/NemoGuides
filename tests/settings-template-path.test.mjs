import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('settings template path matches the Hub installation directory', async () => {
    const source = await readFile(new URL('../index.js', import.meta.url), 'utf8');

    assert.match(source, /const EXTENSION_FOLDER = 'third-party\/NemoGuides';/);
});

test('lorebook creation uses the current SillyTavern world-info contract', async () => {
    const source = await readFile(new URL('../lorebook-manager.js', import.meta.url), 'utf8');

    assert.match(source, /import \{ createNewWorldInfo, world_names \} from '\.\.\/\.\.\/\.\.\/world-info\.js';/);
    assert.match(source, /await createNewWorldInfo\(bookName\)/);
    assert.match(source, /world_names\.includes\(bookName\)/);
    assert.doesNotMatch(source, /\[NG\] _init_test/);
    assert.doesNotMatch(source, /\/api\/worldinfo\/create/);
});
