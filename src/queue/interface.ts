export interface QueueJob {
  id: string;
  name: string;
  data: any;
  opts?: {
    priority?: number;
    delay?: number;
    attempts?: number;
  };
  timestamp: number;
  attemptsMade: number;
}

export interface QueueJobCounts {
  waiting?: number;
  active?: number;
  completed?: number;
  failed?: number;
  delayed?: number;
}

export interface IQueue {
  add(
    jobName: string,
    data: any,
    options?: {
      priority?: number;
      delay?: number;
      attempts?: number;
      backoff?: {
        type: 'exponential' | 'fixed';
        delay: number;
      };
      removeOnComplete?: number;
      removeOnFail?: number;
    }
  ): Promise<QueueJob>;

  process(
    jobName: string,
    concurrency: number,
    processor: (job: QueueJob) => Promise<any>
  ): void;
  process(
    jobName: string,
    processor: (job: QueueJob) => Promise<any>
  ): void;

  getJobCounts(): Promise<QueueJobCounts>;
  close(): Promise<void>;
  isHealthy(): boolean;
  getQueueName(): string;

  // Event handling
  on(event: 'completed', listener: (job: QueueJob, result?: any) => void): this;
  on(event: 'failed', listener: (job: QueueJob, err: Error) => void): this;
  on(event: 'stalled', listener: (job: QueueJob) => void): this;
  on(event: 'retry', listener: (job: QueueJob) => void): this;
  on(event: string, listener: (...args: any[]) => void): this;

  emit(event: 'completed', job: QueueJob, result?: any): boolean;
  emit(event: 'failed', job: QueueJob, err: Error): boolean;
  emit(event: 'stalled', job: QueueJob): boolean;
  emit(event: 'retry', job: QueueJob): boolean;
  emit(event: string, ...args: any[]): boolean;
}

export interface QueueManagerOptions {
  concurrency?: number;
  attempts?: number;
  backoffDelay?: number;
}

export interface IQueueManager {
  initializeQueues(): Promise<void>;
  addNotificationJob(
    notificationId: string,
    channel: string,
    recipient: string,
    message: string,
    options?: {
      priority?: 'high' | 'medium' | 'low';
      delay?: number;
      attempts?: number;
    }
  ): Promise<QueueJob>;
  addTemplateJob(
    templateId: string,
    data: Record<string, any>
  ): Promise<QueueJob>;
  getQueueStats(): Promise<any>;
  checkQueueHealth(): Promise<boolean>;
  getQueues(): { notificationQueue: IQueue | null; templateQueue: IQueue | null };
}