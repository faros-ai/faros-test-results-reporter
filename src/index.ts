import { Command, Option } from 'commander';
import path from 'path';
import {
  TestResultsFormat,
  TestResultsReporter,
  TestResultsReporterConfig,
  TestType,
} from './test-results-reporter';

import pino from 'pino';

export const DEFAULT_GRAPH_NAME = 'default';
export const DEFAULT_GRAPH_VERSION = 'v2';
export const DEFAULT_ORIGIN = 'faros-test-results-reporter';
export const DEFAULT_API_URL = 'https://prod.api.faros.ai';

/** The main entry point. */
export function mainCommand(): Command {
  const cmd = new Command();

  const version = require(path.join(__dirname, '..', 'package.json')).version;

  cmd
    .name('faros-test-results-reporter')
    .description(
      'CLI for parsing & uploading test results (JUnit, TestNG, xUnit, Cucumber etc.) to Faros AI API'
    )
    .version(version)
    .argument(
      '<paths...>',
      'space or comma separated path(s) to test results file(s) (globs are supported)'
    );

  const format = new Option('--format <format>', 'tests results format')
    .choices(Object.values(TestResultsFormat))
    .makeOptionMandatory(true);
  cmd.addOption(format);

  const key = new Option(
    '-k, --api-key <key>',
    'Your Faros API key. See the documentation for more information on obtaining an API key'
  ).makeOptionMandatory(true);
  cmd.addOption(key);

  const url = new Option(
    '-u, --url <url>',
    'The Faros API url to send the test results to'
  ).default(DEFAULT_API_URL);
  cmd.addOption(url);

  const graph = new Option(
    '-g, --graph <name>',
    'The graph that the test results should be sent to'
  ).default(DEFAULT_GRAPH_NAME);
  cmd.addOption(graph);

  const graphVersion = new Option(
    '--graph-version <version>',
    'The graph version that the test results should be sent to'
  ).default(DEFAULT_GRAPH_VERSION);
  cmd.addOption(graphVersion);

  const origin = new Option(
    '--origin <name>',
    'The origin of the data that is being sent to Faros'
  ).default(DEFAULT_ORIGIN);
  cmd.addOption(origin);

  const source = new Option(
    '--test-source <name>',
    'The source where the test that was executed (e.g. "Jenkins", "CircleCI")'
  ).makeOptionMandatory(true);
  cmd.addOption(source);

  const type = new Option(
    '--test-type <name>',
    'The type of the test that was executed'
  )
    .choices(Object.values(TestType))
    .default(TestType.Unit);
  cmd.addOption(type);

  const start = new Option(
    '--test-start <time>',
    'The start time of the test in milliseconds since the epoch, ISO-8601, or "Now". (e.g. "1626804346019", "2021-07-20T18:05:46.019Z")'
  ).makeOptionMandatory(true);
  cmd.addOption(start);

  const end = new Option(
    '--test-end <time>',
    'The end time of the test in milliseconds since the epoch, ISO-8601, or "Now". (e.g. "1626804346019", "2021-07-20T18:05:46.019Z")'
  ).makeOptionMandatory(true);
  cmd.addOption(end);

  const commit = new Option(
    '--commit <uri>',
    'The URI of the commit of the form: <source>://<organization>/<repository>/<commit_sha> (e.g. "GitHub://faros-ai/my-repo/da500aa4f54cbf8f3eb47a1dc2c136715c9197b9")'
  ).makeOptionMandatory(true);
  cmd.addOption(commit);

  const debug = new Option('--debug', 'Enable debug logging').default(false);
  cmd.addOption(debug);

  const dryRun = new Option(
    '--dry-run',
    'Print the data instead of sending it'
  ).default(false);
  cmd.addOption(dryRun);

  const validateOnly = new Option(
    '--validate-only',
    'Data will not be consumed but instead will only be validated against Faros API schema'
  ).default(false);
  cmd.addOption(validateOnly);

  const concurrency = new Option(
    '--concurrency <number>',
    'Number of concurrent requests to Faros API'
  ).default(8);
  cmd.addOption(concurrency);

  cmd.action(async (paths, options) => {
    const config: TestResultsReporterConfig = { ...options };
    const log = pino({
      level: process.env.LOG_LEVEL ?? (config.debug ? 'debug' : 'info'),
      transport: { target: 'pino-pretty' },
    });
    try {
      await new TestResultsReporter(config, log).process(paths);
    } catch (err: any) {
      log.error({ err }, `Processing failed. Error: ${err.message}`);
      process.exit(1);
    }
  });

  return cmd;
}
