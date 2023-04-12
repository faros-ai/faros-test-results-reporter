import { parse } from 'test-results-parser';
import { Logger } from 'pino';
import axios, { AxiosInstance } from 'axios';
import { VError } from 'verror';
import { v4 as uuidv4 } from 'uuid';
import pLimit from 'p-limit';

export type TestResultsReporterConfig = {
  readonly path: string;
  readonly format: TestResultsFormat;
  readonly url: string;
  readonly apiKey: string;
  readonly graph: string;
  readonly graphVersion: string;
  readonly origin: string;
  readonly testType: TestType;
  readonly testSource: string;
  readonly testStart: string;
  readonly testEnd: string;
  readonly commit: string;
  readonly debug?: boolean;
  readonly dryRun?: boolean;
  readonly validateOnly?: boolean;
  readonly concurrency: number;
};

export enum TestResultsFormat {
  Cucumber = 'cucumber',
  JUnit = 'junit',
  Mocha = 'mocha',
  TestNG = 'testng',
  xUnit = 'xunit',
}

export enum TestType {
  Functional = 'Functional',
  Integration = 'Integration',
  Manual = 'Manual',
  Performance = 'Performance',
  Regression = 'Regression',
  Security = 'Security',
  Unit = 'Unit',
  Custom = 'Custom',
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
    this.log.info('Parsed %d test results', results.total);

    const workerPromises = [];
    const limit = pLimit(Number(this.config.concurrency));

    for (const ts of results.suites) {
      const cases = [];
      for (const tc of ts.cases) {
        const steps = [];
        for (const s of tc.steps) {
          steps.push({
            id: uuidv4(),
            name: s.name,
            status: this.convertStatus(s.status),
            statusDetails:
              s.failure && s.stack_trace
                ? `${s.failure} : ${s.stack_trace}`
                : s.failure ?? s.stack_trace,
          });
        }
        cases.push({
          id: uuidv4(),
          name: tc.name,
          type: this.config.testType,
          status: this.convertStatus(tc.status),
          statusDetails:
            tc.failure && tc.stack_trace
              ? `${tc.failure} : ${tc.stack_trace}`
              : tc.failure ?? tc.stack_trace,
          ...(steps.length > 0 ? { step: steps } : {}),
        });
      }

      const data = {
        type: 'TestExecution',
        version: '0.0.1',
        origin: this.config.origin,
        data: {
          commit: {
            uri: this.config.commit,
          },
          test: {
            id: uuidv4(),
            suite: ts.name,
            source: this.config.testSource,
            type: this.config.testType,
            status: this.convertStatus(ts.status),
            statusDetails: ts.status,
            stats: {
              success: ts.passed,
              failure: ts.failed,
              skipped: ts.skipped,
              unknown: 0,
              custom: 0,
              total: ts.total,
            },
            startTime: ts.timestamp || this.config.testStart,
            endTime: ts.timestamp
              ? new Date(Date.parse(ts.timestamp) + ts.duration).toISOString()
              : this.config.testEnd,
            ...(cases.length > 0 ? { case: cases } : {}),
          },
        },
      };

      if (this.config.dryRun !== true) {
        workerPromises.push(
          limit(async () => {
            const id = data.data.test.id;
            try {
              this.log.debug(
                'Reporting event %s: %s',
                id,
                JSON.stringify(data)
              );
              const headers = this.config.graphVersion
                ? {'x-faros-graph-version': this.config.graphVersion}
                : undefined;

              await this.client.post(
                `/graphs/${this.config.graph}/events`,
                data,
                {
                  params: {
                    full: true,
                    validateOnly: this.config.validateOnly,
                  },
                  headers,
                }
              );
              this.log.debug('Delivered event %s', id);
            } catch (err: any) {
              const url =
                `${err.config?.baseURL}${err.config?.url}` ?? 'Faros API';
              const response = err.response?.data
                ? ` Response: ${JSON.stringify(err.response.data)}`
                : '';
              const msg = `Failed to post event ${id} to ${url}. Error: ${err.message}.${response}`;
              throw new VError(msg);
            }
          })
        );
      }
    }

    // Wait for all the requests to complete
    await Promise.all(workerPromises);

    this.log.info('Processed %d test suites', results.suites.length);
    this.log.info('Done.');
  }

  private convertStatus(status: string): string {
    switch (status.toLowerCase()) {
      case 'success':
      case 'succeed':
      case 'succeeded':
      case 'pass':
      case 'passed':
        return 'Success';
      case 'skip':
      case 'skipped':
      case 'disable':
      case 'disabled':
        return 'Skipped';
      case 'fail':
      case 'failed':
      case 'failure':
        return 'Failure';
      default:
        return 'Custom';
    }
  }
}
