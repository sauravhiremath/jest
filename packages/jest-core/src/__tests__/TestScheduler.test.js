/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {SummaryReporter} from '@jest/reporters';
import {makeProjectConfig} from '@jest/test-utils';
import TestScheduler from '../TestScheduler';
import * as testSchedulerHelper from '../testSchedulerHelper';

jest.mock('@jest/reporters');
let events = {};

const mockSerialRunner = {
  isSerial: true,
  on: jest.fn((eventName, callback) => {
    events[eventName] = callback;
  }),
  runTests: jest.fn(),
};
jest.mock('jest-runner-serial', () => jest.fn(() => mockSerialRunner), {
  virtual: true,
});

const mockParallelRunner = {
  on: jest.fn((eventName, callback) => {
    events[eventName] = callback;
  }),
  runTests: jest.fn(),
};
jest.mock('jest-runner-parallel', () => jest.fn(() => mockParallelRunner), {
  virtual: true,
});

const spyShouldRunInBand = jest.spyOn(testSchedulerHelper, 'shouldRunInBand');

beforeEach(() => {
  events = {};
  mockSerialRunner.runTests.mockClear();
  mockSerialRunner.on.mockClear();
  mockParallelRunner.runTests.mockClear();
  mockParallelRunner.on.mockClear();
  spyShouldRunInBand.mockClear();
});

test('config for reporters supports `default`', () => {
  const undefinedReportersScheduler = new TestScheduler(
    {
      reporters: undefined,
    },
    {},
  );
  const numberOfReporters =
    undefinedReportersScheduler._dispatcher._reporters.length;

  const stringDefaultReportersScheduler = new TestScheduler(
    {
      reporters: ['default'],
    },
    {},
  );
  expect(stringDefaultReportersScheduler._dispatcher._reporters.length).toBe(
    numberOfReporters,
  );

  const defaultReportersScheduler = new TestScheduler(
    {
      reporters: [['default', {}]],
    },
    {},
  );
  expect(defaultReportersScheduler._dispatcher._reporters.length).toBe(
    numberOfReporters,
  );

  const emptyReportersScheduler = new TestScheduler(
    {
      reporters: [],
    },
    {},
  );
  expect(emptyReportersScheduler._dispatcher._reporters.length).toBe(0);
});

test('.addReporter() .removeReporter()', () => {
  const scheduler = new TestScheduler({}, {});
  const reporter = new SummaryReporter();
  scheduler.addReporter(reporter);
  expect(scheduler._dispatcher._reporters).toContain(reporter);
  scheduler.removeReporter(SummaryReporter);
  expect(scheduler._dispatcher._reporters).not.toContain(reporter);
});

test('schedule tests run in parallel per default', async () => {
  const scheduler = new TestScheduler({}, {});
  const test = {
    context: {
      config: makeProjectConfig({
        moduleFileExtensions: ['.js'],
        runner: 'jest-runner-parallel',
        transform: [],
      }),
      hasteFS: {
        matchFiles: jest.fn(() => []),
      },
    },
    path: './test/path.js',
  };
  const tests = [test, test];

  await scheduler.scheduleTests(tests, {isInterrupted: jest.fn()});

  expect(mockParallelRunner.runTests).toHaveBeenCalled();
  expect(mockParallelRunner.runTests.mock.calls[0][2].serial).toBeFalsy();
});

test('schedule tests run in serial if the runner flags them', async () => {
  const scheduler = new TestScheduler({}, {});
  const test = {
    context: {
      config: makeProjectConfig({
        moduleFileExtensions: ['.js'],
        runner: 'jest-runner-serial',
        transform: [],
      }),
      hasteFS: {
        matchFiles: jest.fn(() => []),
      },
    },
    path: './test/path.js',
  };

  const tests = [test, test];
  await scheduler.scheduleTests(tests, {isInterrupted: jest.fn()});

  expect(mockSerialRunner.runTests).toHaveBeenCalled();
  expect(mockSerialRunner.runTests.mock.calls[0][2].serial).toBeTruthy();
});

test('should bail after `n` failures', async () => {
  const scheduler = new TestScheduler({bail: 2}, {});
  const test = {
    context: {
      config: makeProjectConfig({
        moduleFileExtensions: ['.js'],
        rootDir: './',
        runner: 'jest-runner-serial',
        transform: [],
      }),
      hasteFS: {
        matchFiles: jest.fn(() => []),
      },
    },
    path: './test/path.js',
  };

  const tests = [test];
  const setState = jest.fn();
  await scheduler.scheduleTests(tests, {
    isInterrupted: jest.fn(),
    isWatchMode: () => true,
    setState,
  });
  await mockSerialRunner.runTests(tests, {
    numFailingTests: 2,
    snapshot: {},
    testResults: [{}],
  });
  expect(setState).toBeCalledWith({interrupted: true});
});

test('should not bail if less than `n` failures', async () => {
  const scheduler = new TestScheduler({bail: 2}, {});
  const test = {
    context: {
      config: makeProjectConfig({
        moduleFileExtensions: ['.js'],
        rootDir: './',
        runner: 'jest-runner-serial',
        transform: [],
      }),
      hasteFS: {
        matchFiles: jest.fn(() => []),
      },
    },
    path: './test/path.js',
  };

  const tests = [test];
  const setState = jest.fn();
  await scheduler.scheduleTests(tests, {
    isInterrupted: jest.fn(),
    isWatchMode: () => true,
    setState,
  });
  expect(setState).not.toBeCalled();
});

test('should set runInBand to run in serial', async () => {
  const scheduler = new TestScheduler({}, {});
  const test = {
    context: {
      config: makeProjectConfig({
        moduleFileExtensions: ['.js'],
        runner: 'jest-runner-parallel',
        transform: [],
      }),
      hasteFS: {
        matchFiles: jest.fn(() => []),
      },
    },
    path: './test/path.js',
  };
  const tests = [test, test];

  spyShouldRunInBand.mockReturnValue(true);

  await scheduler.scheduleTests(tests, {isInterrupted: jest.fn()});

  expect(spyShouldRunInBand).toHaveBeenCalled();
  expect(mockParallelRunner.runTests).toHaveBeenCalled();
  expect(mockParallelRunner.runTests.mock.calls[0][2].serial).toBeTruthy();
});

test('should set runInBand to not run in serial', async () => {
  const scheduler = new TestScheduler({}, {});
  const test = {
    context: {
      config: makeProjectConfig({
        moduleFileExtensions: ['.js'],
        runner: 'jest-runner-parallel',
        transform: [],
      }),
      hasteFS: {
        matchFiles: jest.fn(() => []),
      },
    },
    path: './test/path.js',
  };
  const tests = [test, test];

  spyShouldRunInBand.mockReturnValue(false);

  await scheduler.scheduleTests(tests, {isInterrupted: jest.fn()});

  expect(spyShouldRunInBand).toHaveBeenCalled();
  expect(mockParallelRunner.runTests).toHaveBeenCalled();
  expect(mockParallelRunner.runTests.mock.calls[0][2].serial).toBeFalsy();
});
