import { Command, Option } from 'commander';
import path from 'path';
import {
  TestResultsFormat,
  TestResultsReporter,
  TestResultsReporterConfig,
} from './test-results-reporter';

import pino from 'pino';

export const DEFAULT_GRAPH_NAME = 'default';
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
    'Your Faros API key. See the documentation for more information on obtaining an api key'
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

  const debug = new Option('--debug', 'Enable debug logging').default(false);
  cmd.addOption(debug);

  cmd.action(async (str, options) => {
    const config: TestResultsReporterConfig = { ...options };
    const log = pino({
      level: process.env.LOG_LEVEL ?? (config.debug ? 'debug' : 'info'),
      transport: { target: 'pino-pretty' },
    });
    try {
      await new TestResultsReporter(config, log).process(str);
    } catch (err: any) {
      log.error({ err }, `Processing failed. Error: ${err.message}`);
      process.exit(1);
    }
  });

  return cmd;
}
