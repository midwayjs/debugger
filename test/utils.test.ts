import { vscodeSupport } from '../src';
import { resolve } from 'path';
import { existsSync, remove, readJSONSync } from 'fs-extra';
import * as assert from 'assert';
describe('/test/utils.test.ts', () => {
  it('vscodeSupport', async () => {
    const vscodeDir = resolve(__dirname, '.vscode');
    const vscodeFile = resolve(vscodeDir, 'settings.json');
    if (existsSync(vscodeDir)) {
      await remove(vscodeDir);
    }
    const originTermProgram = process.env.TERM_PROGRAM;
    process.env.TERM_PROGRAM = 'vscode';
    vscodeSupport({
      cwd: __dirname,
    });
    process.env.TERM_PROGRAM = originTermProgram;
    assert(existsSync(vscodeFile));
    const json = readJSONSync(vscodeFile);
    assert(json['debug.node.autoAttach'] === 'on');
    assert(json['debug.javascript.usePreviewAutoAttach'] === false);
    await remove(vscodeDir);
  });
});