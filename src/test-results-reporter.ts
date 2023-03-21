import { parse } from 'test-results-parser';
import { Logger } from 'pino';
import axios, { AxiosInstance } from 'axios';

export type TestResultsReporterConfig = {
  readonly path: string;
  readonly format: TestResultsFormat;
  readonly url: string;
  readonly apiKey: string;
  readonly debug?: boolean;
};

export enum TestResultsFormat {
  Cucumber = 'cucumber',
  JUnit = 'junit',
  Mocha = 'mocha',
  TestNG = 'testng',
  xUnit = 'xunit',
}

export class TestResultsReporter {
  private readonly config: TestResultsReporterConfig;
  private readonly log: Logger;
  private readonly client: AxiosInstance;

  constructor(config: TestResultsReporterConfig, log: Logger) {
    this.config = config;
    this.log = log;
    this.client = axios.create({
      baseURL: config.url,
      headers: { authorization: config.apiKey },
    });
  }

  async process(paths: ReadonlyArray<string>): Promise<void> {
    const files = paths.flatMap((p) => p.split(',').map((v) => v.trim()));
    this.log.debug('Processing %d paths: %s', files.length, files.join(','));

    const results = parse({ type: this.config.format, files });
    this.log.info('Parsed total of %d test results', results.total);
  }
}
