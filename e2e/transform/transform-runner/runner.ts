/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import Emittery from 'emittery';
import throat from 'throat';
import {TestResult, createEmptyTestResult} from '@jest/test-result';
import type {Config} from '@jest/types';
import {Test, TestRunnerContext, TestWatcher} from 'jest-runner';

export default class BaseTestRunner {
  private _globalConfig: Config.GlobalConfig;
  private _context: TestRunnerContext;
  private readonly eventEmitter = new Emittery();

  constructor(globalConfig: Config.GlobalConfig, context?: TestRunnerContext) {
    this._globalConfig = globalConfig;
    this._context = context || {};
  }

  on = this.eventEmitter.on.bind(this.eventEmitter);

  async runTests(tests: Array<Test>, watcher: TestWatcher): Promise<void> {
    const mutex = throat(1);
    return tests.reduce(
      (promise, test) =>
        mutex(() =>
          promise
            .then(
              async (): Promise<TestResult> => {
                await this.eventEmitter.emit('test-file-start', [test]);
                return {
                  ...createEmptyTestResult(),
                  numPassingTests: 1,
                  testFilePath: test.path,
                  testResults: [
                    {
                      ancestorTitles: [],
                      duration: 2,
                      failureDetails: [],
                      failureMessages: [],
                      fullName: 'sample test',
                      location: null,
                      numPassingAsserts: 1,
                      status: 'passed',
                      title: 'sample test',
                    },
                  ],
                };
              },
            )
            .then(result =>
              this.eventEmitter.emit('test-file-success', [test, result]),
            )
            .catch(err =>
              this.eventEmitter.emit('test-file-failure', [test, err]),
            ),
        ),
      Promise.resolve(),
    );
  }
}
