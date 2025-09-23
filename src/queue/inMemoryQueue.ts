import { EventEmitter } from 'events';
import { logger, logQueue } from '../monitoring/logger';
import { metrics } from '../monitoring/metrics';

// Node.js global functions
declare const setInterval: (callback: () => void, ms: number) => any;
declare const clearInterval: (id: any) => void;
declare const setTimeout: (callback: () => void, ms: number) => any;

export interface InMemoryJob {
  id: string;
  name: string;
  data: any;
  options: {
    priority: number;
    delay: number;
    attempts: number;
    backoff?: {
      type: 'exponential' | 'fixed';
      delay: number;
    };
    removeOnComplete?: number;
    removeOnFail?: number;
  };
  status: 'waiting' | 'delayed' | 'active' | 'completed' | 'failed';
  timestamp: number;
  attemptsMade: number;
  processAfter: number;
  lastError?: string;
}

export class InMemoryQueue extends EventEmitter {
  private jobs: Map<string, InMemoryJob> = new Map();
  private waitingQueue: InMemoryJob[] = [];
  private delayedQueue: InMemoryJob[] = [];
  private activeJobs: Set<string> = new Set();
  private completedJobs: InMemoryJob[] = [];
  private failedJobs: InMemoryJob[] = [];

  private processingInterval: any | null = null;
  private jobIdCounter: number = 0;
  private concurrency: number;
  private isProcessing: boolean = false;

  constructor(
    private queueName: string,
    options: { concurrency?: number } = {}
  ) {
    super();
    this.concurrency = options.concurrency || 5;
    this.startProcessing();
    logger.info(`In-memory queue '${queueName}' initialized with concurrency: ${this.concurrency}`);
  }

  async add(
    jobName: string,
    data: any,
    options: Partial<InMemoryJob['options']> = {}
  ): Promise<InMemoryJob> {
    const jobId = `${this.queueName}:${++this.jobIdCounter}:${Date.now()}`;
    const now = Date.now();

    const job: InMemoryJob = {
      id: jobId,
      name: jobName,
      data,
      options: {
        priority: options.priority || 5,
        delay: options.delay || 0,
        attempts: options.attempts || 3,
        backoff: options.backoff || { type: 'exponential', delay: 5000 },
        removeOnComplete: options.removeOnComplete || 50,
        removeOnFail: options.removeOnFail || 20
      },
      status: options.delay && options.delay > 0 ? 'delayed' : 'waiting',
      timestamp: now,
      attemptsMade: 0,
      processAfter: now + (options.delay || 0),
      lastError: undefined
    };

    this.jobs.set(jobId, job);

    if (job.status === 'delayed') {
      this.addToDelayedQueue(job);
    } else {
      this.addToWaitingQueue(job);
    }

    logQueue('added', jobId, this.queueName, {
      jobName,
      priority: job.options.priority,
      delay: job.options.delay
    });

    this.emit('added', job);
    return job;
  }

  private addToWaitingQueue(job: InMemoryJob): void {
    this.waitingQueue.push(job);
    this.waitingQueue.sort((a, b) => a.options.priority - b.options.priority);
  }

  private addToDelayedQueue(job: InMemoryJob): void {
    this.delayedQueue.push(job);
    this.delayedQueue.sort((a, b) => a.processAfter - b.processAfter);
  }

  process(jobName: string, concurrency: number, processor: (job: InMemoryJob) => Promise<any>): void;
  process(jobName: string, processor: (job: InMemoryJob) => Promise<any>): void;
  process(
    jobName: string,
    concurrencyOrProcessor: number | ((job: InMemoryJob) => Promise<any>),
    processor?: (job: InMemoryJob) => Promise<any>
  ): void {
    let actualProcessor: (job: InMemoryJob) => Promise<any>;

    if (typeof concurrencyOrProcessor === 'function') {
      actualProcessor = concurrencyOrProcessor;
    } else if (processor) {
      actualProcessor = processor;
    } else {
      throw new Error('Processor function is required');
    }

    this.on('process:' + jobName, actualProcessor);
    logger.info(`Processor registered for job type '${jobName}' in queue '${this.queueName}'`);
  }

  private startProcessing(): void {
    this.processingInterval = setInterval(async () => {
      if (this.isProcessing) return;
      this.isProcessing = true;

      try {
        await this.moveDelayedJobsToWaiting();
        await this.processWaitingJobs();
      } catch (error) {
        logger.error(`Error in queue processing for '${this.queueName}':`, error);
      } finally {
        this.isProcessing = false;
      }
    }, 1000); // Check every second
  }

  private async moveDelayedJobsToWaiting(): Promise<void> {
    const now = Date.now();
    const readyJobs: InMemoryJob[] = [];

    while (this.delayedQueue.length > 0 && this.delayedQueue[0].processAfter <= now) {
      const job = this.delayedQueue.shift()!;
      job.status = 'waiting';
      readyJobs.push(job);
    }

    readyJobs.forEach(job => this.addToWaitingQueue(job));
  }

  private async processWaitingJobs(): Promise<void> {
    const availableSlots = this.concurrency - this.activeJobs.size;

    for (let i = 0; i < availableSlots && this.waitingQueue.length > 0; i++) {
      const job = this.waitingQueue.shift()!;
      this.activeJobs.add(job.id);
      job.status = 'active';

      // Process job asynchronously
      this.processJob(job).catch(error => {
        logger.error(`Unexpected error processing job ${job.id}:`, error);
      });
    }
  }

  private async processJob(job: InMemoryJob): Promise<void> {
    const startTime = Date.now();

    logQueue('processing', job.id, this.queueName, {
      jobName: job.name,
      attempt: job.attemptsMade + 1,
      maxAttempts: job.options.attempts
    });

    try {
      job.attemptsMade++;

      if (this.listenerCount('process:' + job.name) === 0) {
        throw new Error(`No processor found for job type '${job.name}'`);
      }

      const result = await this.emitAsync('process:' + job.name, job);

      job.status = 'completed';
      this.activeJobs.delete(job.id);
      this.addToCompletedJobs(job);

      logQueue('completed', job.id, this.queueName, {
        processingTime: Date.now() - startTime,
        attempts: job.attemptsMade
      });

      this.emit('completed', job, result);
      metrics.recordNotificationSent(job.data.channel, 'success');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      job.lastError = errorMessage;
      this.activeJobs.delete(job.id);

      logQueue('failed', job.id, this.queueName, {
        error: errorMessage,
        attempt: job.attemptsMade,
        maxAttempts: job.options.attempts
      });

      if (job.attemptsMade < job.options.attempts) {
        // Retry the job
        await this.retryJob(job);
      } else {
        // Job failed permanently
        job.status = 'failed';
        this.addToFailedJobs(job);
        this.emit('failed', job, error);
        metrics.recordNotificationSent(job.data.channel, 'failed');
      }
    }
  }

  private async retryJob(job: InMemoryJob): Promise<void> {
    const backoffDelay = this.calculateBackoffDelay(job);
    job.processAfter = Date.now() + backoffDelay;
    job.status = 'delayed';

    this.addToDelayedQueue(job);

    logQueue('retry', job.id, this.queueName, {
      attempt: job.attemptsMade,
      maxAttempts: job.options.attempts,
      retryDelay: backoffDelay
    });

    this.emit('retry', job);
  }

  private calculateBackoffDelay(job: InMemoryJob): number {
    const baseDelay = job.options.backoff?.delay || 5000;

    if (job.options.backoff?.type === 'exponential') {
      return baseDelay * Math.pow(2, job.attemptsMade - 1);
    }

    return baseDelay;
  }

  private addToCompletedJobs(job: InMemoryJob): void {
    this.completedJobs.push(job);

    // Remove old completed jobs if limit exceeded
    if (job.options.removeOnComplete && this.completedJobs.length > job.options.removeOnComplete) {
      const toRemove = this.completedJobs.length - job.options.removeOnComplete;
      for (let i = 0; i < toRemove; i++) {
        const oldJob = this.completedJobs.shift()!;
        this.jobs.delete(oldJob.id);
      }
    }
  }

  private addToFailedJobs(job: InMemoryJob): void {
    this.failedJobs.push(job);

    // Remove old failed jobs if limit exceeded
    if (job.options.removeOnFail && this.failedJobs.length > job.options.removeOnFail) {
      const toRemove = this.failedJobs.length - job.options.removeOnFail;
      for (let i = 0; i < toRemove; i++) {
        const oldJob = this.failedJobs.shift()!;
        this.jobs.delete(oldJob.id);
      }
    }
  }

  private async emitAsync(event: string, ...args: any[]): Promise<any> {
    const listeners = this.listeners(event);
    if (listeners.length === 0) {
      throw new Error(`No listeners for event: ${event}`);
    }

    // Use the first listener (processor)
    const processor = listeners[0] as Function;
    return await processor(...args);
  }

  async getJobCounts(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    return {
      waiting: this.waitingQueue.length,
      active: this.activeJobs.size,
      completed: this.completedJobs.length,
      failed: this.failedJobs.length,
      delayed: this.delayedQueue.length
    };
  }

  async getJob(jobId: string): Promise<InMemoryJob | null> {
    return this.jobs.get(jobId) || null;
  }

  async removeJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    // Remove from appropriate queue
    switch (job.status) {
      case 'waiting':
        this.waitingQueue = this.waitingQueue.filter(j => j.id !== jobId);
        break;
      case 'delayed':
        this.delayedQueue = this.delayedQueue.filter(j => j.id !== jobId);
        break;
      case 'active':
        this.activeJobs.delete(jobId);
        break;
      case 'completed':
        this.completedJobs = this.completedJobs.filter(j => j.id !== jobId);
        break;
      case 'failed':
        this.failedJobs = this.failedJobs.filter(j => j.id !== jobId);
        break;
    }

    this.jobs.delete(jobId);
    return true;
  }

  async close(): Promise<void> {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    // Wait for active jobs to complete or timeout after 30 seconds
    const timeout = 30000;
    const start = Date.now();

    while (this.activeJobs.size > 0 && (Date.now() - start) < timeout) {
      await new Promise<void>(resolve => setTimeout(() => resolve(), 100));
    }

    this.removeAllListeners();
    logger.info(`In-memory queue '${this.queueName}' closed`);
  }

  getQueueName(): string {
    return this.queueName;
  }

  isHealthy(): boolean {
    return this.processingInterval !== null && !this.isProcessing;
  }
}