import { LeakyBucket } from 'ts-leaky-bucket';
import { BackoffError } from "./BackoffError";

interface RequestRateLimiterOptions {
  backoffTime: number
  requestRate: number
  interval: number,
  timeout: number,
}

export interface RequestHandler<T> {
  execute: () => Promise<T>
}

export class RequestRateLimiter {

  private defaultOptions: RequestRateLimiterOptions = {
    backoffTime: 10,
    requestRate: 60,
    interval: 60,
    timeout: 600
  }
  private options: RequestRateLimiterOptions;
  private bucket: LeakyBucket;

  constructor(opts?: Partial<RequestRateLimiterOptions>) {
    this.options = {
      ...this.defaultOptions,
      ...opts
    }
    // this.backoffTime = backoffTime;
    // this.requestRate = requestRate;
    // this.interval = interval;
    // this.timeout = timeout;

    // use leaky bucket to limit requests
    this.bucket = new LeakyBucket({
      capacity: this.options.requestRate,
      intervalMillis: this.options.interval,
      timeoutMillis: this.options.timeout * 1000,
    });
  }

  /**
  * promise that resolves when the rate limited becomes idle
  * once resolved, the call to this method must be repeated
  * in order to become notified again.
  */
  async idle() {
    return this.bucket.awaitEmpty();
  }

  /**
  * enqueue a request
  */
  async request<T>(request: RequestHandler<T>) {
    // log.info(`throttling request`);

    // execute the request. if the request handler returns an instance 
    // of the BackoffError the request will be re-enqueued
    const doRequest = async (): Promise<T> => {
      // log.debug(`Executing request`);

      // wait for the next free slot, if the request cannot be executed
      // in time, an error will be thrown
      await this.bucket.throttle();

      try {
        return await request.execute();
      }
      catch (err) {
        if (err instanceof BackoffError) {
          this.bucket.pause(this.options.backoffTime);
          return await doRequest();
        } else {
          throw err;
        }
      }
    };

    return await doRequest();
  }



  /**
  * actually execute the requests
  */
  // async executeRequest(requestConfig: any) {
  //   if (!this.requestHandler) {
  //     throw new Error(`No request handler present! Please register on using the setRequestHandler method!`);
  //   }

  //   return await this.requestHandler(requestConfig);
  // }




  /**
  * set the reuqest handler that shall be used to handle the requests
  */
  // setRequestHandler(requestHandler: any) {
  //   if (typeof requestHandler === 'function') {
  //     this.requestHandler = requestHandler;
  //   } else if (typeof requestHandler === 'object' &&
  //     typeof requestHandler.request === 'function') {

  //     // wrap the class, so that the internal interface 
  //     // inside this class is always the same
  //     this.requestHandler = async (requestConfig) => {
  //       return await requestHandler.request(requestConfig);
  //     };
  //   } else {
  //     throw new Error(`Invalid request handler. Expected a function or an object with a request method!`);
  //   }
  // }
}