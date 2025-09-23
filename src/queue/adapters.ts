import { IQueue, QueueJob, QueueJobCounts } from './interface';
import { InMemoryQueue, InMemoryJob } from './inMemoryQueue';

// Import Bull types only when needed
type BullQueue = any;
type BullJob = any;

export class BullQueueAdapter implements IQueue {
  constructor(private bullQueue: BullQueue) {}

  async add(
    jobName: string,
    data: any,
    options?: {
      priority?: number;
      delay?: number;
      attempts?: number;
      backoff?: { type: 'exponential' | 'fixed'; delay: number };
      removeOnComplete?: number;
      removeOnFail?: number;
    }
  ): Promise<QueueJob> {
    const bullJob = await this.bullQueue.add(jobName, data, {
      priority: options?.priority,
      delay: options?.delay,
      attempts: options?.attempts,
      backoff: options?.backoff,
      removeOnComplete: options?.removeOnComplete,
      removeOnFail: options?.removeOnFail
    });

    return this.convertBullJobToQueueJob(bullJob);
  }

  process(jobName: string, concurrency: number, processor: (job: QueueJob) => Promise<any>): void;
  process(jobName: string, processor: (job: QueueJob) => Promise<any>): void;
  process(
    jobName: string,
    concurrencyOrProcessor: number | ((job: QueueJob) => Promise<any>),
    processor?: (job: QueueJob) => Promise<any>
  ): void {
    if (typeof concurrencyOrProcessor === 'function') {
      this.bullQueue.process(jobName, async (bullJob: BullJob) => {
        const queueJob = this.convertBullJobToQueueJob(bullJob);
        return await concurrencyOrProcessor(queueJob);
      });
    } else if (processor) {
      this.bullQueue.process(jobName, concurrencyOrProcessor, async (bullJob: BullJob) => {
        const queueJob = this.convertBullJobToQueueJob(bullJob);
        return await processor(queueJob);
      });
    }
  }

  async getJobCounts(): Promise<QueueJobCounts> {
    return await this.bullQueue.getJobCounts();
  }

  async close(): Promise<void> {
    await this.bullQueue.close();
  }

  isHealthy(): boolean {
    return this.bullQueue.client.status === 'ready';
  }

  getQueueName(): string {
    return this.bullQueue.name;
  }

  on(event: string, listener: (...args: any[]) => void): this {
    this.bullQueue.on(event, listener);
    return this;
  }

  emit(event: string, ...args: any[]): boolean {
    return this.bullQueue.emit(event, ...args);
  }

  private convertBullJobToQueueJob(bullJob: BullJob): QueueJob {
    return {
      id: bullJob.id.toString(),
      name: bullJob.name,
      data: bullJob.data,
      opts: bullJob.opts,
      timestamp: bullJob.timestamp,
      attemptsMade: bullJob.attemptsMade
    };
  }
}

export class InMemoryQueueAdapter implements IQueue {
  constructor(private inMemoryQueue: InMemoryQueue) {}

  async add(
    jobName: string,
    data: any,
    options?: {
      priority?: number;
      delay?: number;
      attempts?: number;
      backoff?: { type: 'exponential' | 'fixed'; delay: number };
      removeOnComplete?: number;
      removeOnFail?: number;
    }
  ): Promise<QueueJob> {
    const inMemoryJob = await this.inMemoryQueue.add(jobName, data, options);
    return this.convertInMemoryJobToQueueJob(inMemoryJob);
  }

  process(jobName: string, concurrency: number, processor: (job: QueueJob) => Promise<any>): void;
  process(jobName: string, processor: (job: QueueJob) => Promise<any>): void;
  process(
    jobName: string,
    concurrencyOrProcessor: number | ((job: QueueJob) => Promise<any>),
    processor?: (job: QueueJob) => Promise<any>
  ): void {
    if (typeof concurrencyOrProcessor === 'function') {
      this.inMemoryQueue.process(jobName, async (inMemoryJob) => {
        const queueJob = this.convertInMemoryJobToQueueJob(inMemoryJob);
        return await concurrencyOrProcessor(queueJob);
      });
    } else if (processor) {
      this.inMemoryQueue.process(jobName, concurrencyOrProcessor, async (inMemoryJob) => {
        const queueJob = this.convertInMemoryJobToQueueJob(inMemoryJob);
        return await processor(queueJob);
      });
    }
  }

  async getJobCounts(): Promise<QueueJobCounts> {
    return await this.inMemoryQueue.getJobCounts();
  }

  async close(): Promise<void> {
    await this.inMemoryQueue.close();
  }

  isHealthy(): boolean {
    return this.inMemoryQueue.isHealthy();
  }

  getQueueName(): string {
    return this.inMemoryQueue.getQueueName();
  }

  on(event: string, listener: (...args: any[]) => void): this {
    this.inMemoryQueue.on(event, (...args) => {
      // Convert InMemoryJob to QueueJob for listeners
      if (event === 'completed' || event === 'failed' || event === 'stalled' || event === 'retry') {
        const [job, ...rest] = args;
        if (job && typeof job === 'object' && 'id' in job) {
          const queueJob = this.convertInMemoryJobToQueueJob(job as InMemoryJob);
          listener(queueJob, ...rest);
          return;
        }
      }
      listener(...args);
    });
    return this;
  }

  emit(event: string, ...args: any[]): boolean {
    return this.inMemoryQueue.emit(event, ...args);
  }

  private convertInMemoryJobToQueueJob(inMemoryJob: InMemoryJob): QueueJob {
    return {
      id: inMemoryJob.id,
      name: inMemoryJob.name,
      data: inMemoryJob.data,
      opts: {
        priority: inMemoryJob.options.priority,
        delay: inMemoryJob.options.delay,
        attempts: inMemoryJob.options.attempts
      },
      timestamp: inMemoryJob.timestamp,
      attemptsMade: inMemoryJob.attemptsMade
    };
  }
}