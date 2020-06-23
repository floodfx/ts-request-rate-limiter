import { RequestRateLimiter, RequestHandler, BackoffError } from "./index";


describe('Rate Limiter', () => {

  const limiter = new RequestRateLimiter();

  test('return request response', async () => {
    const response = await limiter.request(new MockRequestHandler("ok"));
    expect(response).toEqual({ status: "ok" });
  });


  test('enqueue one request, fail', async () => {
    expect.assertions(2)
    await limiter.request(new MockRequestHandler("fail")).catch((err: Error) => {
      expect(err).not.toBeUndefined();
      expect(err.message).toEqual("fail");
    });
  });


  test('enqueue one request, back off', async () => {
    const limiter = new RequestRateLimiter({
      backoffTime: .5,
    });

    const start = Date.now();
    await limiter.request(new MockRequestHandler("backoff"));

    // needs to take 1-5 secs, because the leaky bucket is drained on pause
    // and the request has a value of 1 and the backoff time is .5
    expect(Date.now() - start).toBeGreaterThan(1500);
  });


  test('idle promise', async () => {
    const limiter = new RequestRateLimiter();
    let idleCalled = false;

    await limiter.request(new MockRequestHandler("ok"));
    limiter.idle().then(() => idleCalled = true);

    await limiter.request(new MockRequestHandler("ok"));
    expect(idleCalled).toBeTruthy()
  });
});



type MockRequestActions = "fail" | "backoff" | "ok";
class MockRequestHandler implements RequestHandler<{ status: string }> {

  private action: MockRequestActions;
  private counter = 0;
  constructor(action: MockRequestActions) {
    this.action = action;
  }

  async execute() {
    if (this.action === 'fail') {
      throw new Error(this.action);
    } else if (this.action === 'backoff' && !this.counter) {
      this.counter = 1;
      throw new BackoffError(this.action);
    } else {
      return {
        status: this.action,
      }
    }
  }
}